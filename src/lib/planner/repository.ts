import "server-only";
import { createHash, randomUUID } from "node:crypto";
import {
  withPlannerTransaction,
  PlannerError,
  type PlannerClient,
} from "../db/planner-transaction";
import { defaultPreferences, preferencesSchema, slots } from "./schemas";
import { calendarDate, weekDates, addDays } from "./dates";
import type {
  PlannerState,
  PlanEntry,
  PlannableRecipe,
  PlannerPreferences,
  MealSlot,
} from "./types";
import {
  unavailableEstimate,
  type NutritionEstimate,
} from "../nutrition/types";
import { recipeFingerprint } from "../nutrition/estimate";
import { nutrientProvider } from "../nutrition/providers/registry";
import { suggestionProvider } from "../suggestions/providers/registry";
export const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export async function ownerState(c: PlannerClient, userId: string) {
  await c.query(
    "INSERT INTO planner_state(user_id) VALUES($1) ON CONFLICT DO NOTHING",
    [userId],
  );
  return (
    await c.query("SELECT * FROM planner_state WHERE user_id=$1 FOR UPDATE", [
      userId,
    ])
  ).rows[0];
}
export async function bumpRevision(c: PlannerClient, userId: string) {
  await c.query(
    "UPDATE planner_state SET revision=revision+1 WHERE user_id=$1",
    [userId],
  );
}
export function checkRevision(actual: number, expected?: number) {
  if (expected !== undefined && actual !== expected)
    throw new PlannerError(
      "Your plan changed in another window. Refresh and try again.",
      409,
    );
}
export async function loadRecipes(
  c: PlannerClient,
  userId: string,
): Promise<PlannableRecipe[]> {
  const { rows } = await c.query(
    `SELECT r.id,r.title,r.servings,r.prep_minutes,r.cook_minutes,r.category,r.image_url,r.created_at,(r.photo_data IS NOT NULL) AS has_photo,COALESCE((SELECT jsonb_agg(jsonb_build_object('position',position,'name',name,'quantity',quantity,'unit',unit,'notes',notes,'aisle',aisle) ORDER BY position) FROM recipe_ingredients WHERE recipe_id=r.id),'[]') AS ingredients,COALESCE((SELECT jsonb_agg(jsonb_build_object('position',position,'instruction',instruction) ORDER BY position) FROM recipe_steps WHERE recipe_id=r.id),'[]') AS steps FROM recipes r WHERE user_id=$1 ORDER BY created_at`,
    [userId],
  );
  const analyses = (
    await c.query(
      "SELECT DISTINCT ON(recipe_id,fingerprint) recipe_id,fingerprint,analysis FROM nutrition_analyses WHERE user_id=$1 ORDER BY recipe_id,fingerprint,created_at DESC",
      [userId],
    )
  ).rows;
  return rows.map((r) => {
    const servings = r.servings === null ? null : Number(r.servings);
    const content = { ingredients: r.ingredients, servings };
    const analysis = analyses.find(
      (a) =>
        a.recipe_id === r.id && a.fingerprint === recipeFingerprint(content),
    );
    return {
      key: r.id,
      title: r.title,
      ingredients: r.ingredients,
      steps: r.steps,
      servings,
      prepMinutes: r.prep_minutes,
      cookMinutes: r.cook_minutes,
      category: r.category,
      imageUrl: r.has_photo ? `/api/recipes/${r.id}/photo` : r.image_url,
      source: { kind: "recipe" as const, recipeId: r.id },
      revision: hash({
        ...content,
        title: r.title,
        steps: r.steps,
        prep: r.prep_minutes,
        cook: r.cook_minutes,
        category: r.category,
        analysis: analysis?.analysis,
      }),
      nutrition:
        (analysis?.analysis as NutritionEstimate) || unavailableEstimate(),
      plantFoods: [],
      fermentedFoods: [],
      exclusionStatus: "unknown" as const,
    };
  });
}
export async function stateFromClient(
  c: PlannerClient,
  userId: string,
  start: string,
): Promise<PlannerState> {
  const monday = weekDates(start)[0],
    owner = await ownerState(c, userId),
    recipes = await loadRecipes(c, userId);
  const { rows } = await c.query(
    "SELECT m.*,m.planned_for::text AS calendar_date,s.recipe AS snapshot FROM meal_plan_items m LEFT JOIN planner_snapshots s ON s.id=m.snapshot_id AND s.user_id=m.user_id WHERE m.user_id=$1 AND planned_for >= $2::date AND planned_for < $3::date ORDER BY planned_for,meal_slot",
    [userId, monday, addDays(monday, 7)],
  );
  const entries: PlanEntry[] = rows.map((r) => ({
    id: r.id,
    plannedFor: r.calendar_date,
    mealSlot: r.meal_slot,
    source: r.recipe_id
      ? { kind: "recipe", recipeId: r.recipe_id }
      : { kind: "suggestion", snapshotId: r.snapshot_id },
    servings: Number(r.servings),
    locked: r.locked,
    version: r.version,
    recipe: r.recipe_id
      ? recipes.find((x) => x.key === r.recipe_id)
      : r.snapshot,
  }));
  return {
    weekStart: monday,
    revision: owner.revision,
    entries,
    preferences: preferencesSchema.parse({
      ...defaultPreferences(),
      ...owner.preferences,
    }),
    recipes,
    capabilities: {
      nutrition: !!nutrientProvider(),
      suggestions: !!suggestionProvider(),
    },
  };
}
export function getPlannerWeek(userId: string, start: string) {
  calendarDate(start);
  return withPlannerTransaction(userId, (c) =>
    stateFromClient(c, userId, start),
  );
}
export async function putPlanEntry(
  userId: string,
  input: {
    recipeId: string;
    plannedFor: string;
    mealSlot: MealSlot;
    servings: number;
    locked: boolean;
    expectedRevision?: number;
  },
): Promise<PlannerState> {
  return withPlannerTransaction(userId, async (c) => {
    const owner = await ownerState(c, userId);
    checkRevision(owner.revision, input.expectedRevision);
    const r = await c.query(
      "SELECT id FROM recipes WHERE id=$1 AND user_id=$2",
      [input.recipeId, userId],
    );
    if (!r.rowCount) throw new PlannerError("Recipe not found.", 404);
    await c.query(
      "INSERT INTO meal_plan_items(user_id,recipe_id,planned_for,meal_slot,servings,locked) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id,planned_for,meal_slot) DO UPDATE SET recipe_id=EXCLUDED.recipe_id,snapshot_id=NULL,servings=EXCLUDED.servings,locked=EXCLUDED.locked,version=meal_plan_items.version+1",
      [
        userId,
        input.recipeId,
        input.plannedFor,
        input.mealSlot,
        input.servings,
        input.locked,
      ],
    );
    await bumpRevision(c, userId);
    return stateFromClient(c, userId, input.plannedFor);
  });
}
export async function removePlanEntry(
  userId: string,
  id: string,
  expectedRevision: number,
): Promise<void> {
  await withPlannerTransaction(userId, async (c) => {
    const o = await ownerState(c, userId);
    checkRevision(o.revision, expectedRevision);
    const r = await c.query(
      "DELETE FROM meal_plan_items WHERE id=$1 AND user_id=$2",
      [id, userId],
    );
    if (!r.rowCount) throw new PlannerError("Meal not found.", 404);
    await bumpRevision(c, userId);
  });
}
export async function savePreferences(
  userId: string,
  p: PlannerPreferences,
  expectedVersion: number,
) {
  return withPlannerTransaction(userId, async (c) => {
    const o = await ownerState(c, userId);
    const existing = preferencesSchema.parse(o.preferences);
    if (existing.version !== expectedVersion)
      throw new PlannerError(
        "Your settings changed. Reload them before saving.",
        409,
      );
    const next = { ...p, version: existing.version + 1 };
    await c.query(
      "UPDATE planner_state SET preferences=$2,revision=revision+1 WHERE user_id=$1",
      [userId, JSON.stringify(next)],
    );
    return next;
  });
}
export { randomUUID, slots };
