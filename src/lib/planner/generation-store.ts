import "server-only";
import {
  withPlannerTransaction,
  PlannerError,
} from "../db/planner-transaction";
import {
  stateFromClient,
  ownerState,
  checkRevision,
  bumpRevision,
} from "./repository";
import { generatePlan } from "./generate";
import type { GeneratedPlan } from "./types";
import { generationRequestSchema } from "./schemas";
import type { z } from "zod";
import { findSuggestions } from "../suggestions/service";
export async function createGeneration(
  userId: string,
  request: z.infer<typeof generationRequestSchema>,
) {
  const state = await withPlannerTransaction(userId, (c) =>
    stateFromClient(c, userId, request.weekStart),
  );
  if (request.baseGenerationId) {
    const base = await withPlannerTransaction(
      userId,
      async (c) =>
        (
          await c.query(
            "SELECT draft FROM planner_generations WHERE id=$1 AND user_id=$2 AND expires_at>now()",
            [request.baseGenerationId, userId],
          )
        ).rows[0]?.draft as GeneratedPlan | undefined,
    );
    if (!base || base.baseRevision !== state.revision)
      throw new PlannerError(
        "The preview changed or expired. Generate again.",
        409,
      );
    state.entries = base.entries;
    for (const e of base.entries)
      if (e.recipe && !state.recipes.some((r) => r.key === e.recipe!.key))
        state.recipes.push(e.recipe);
  }
  let suggestionMessage: string | null = null;
  if (request.sourceMode === "suggestions") {
    const result = await findSuggestions(userId, state.preferences);
    state.recipes.push(...result.recipes);
    suggestionMessage = result.message;
  }
  const draft = generatePlan(state, request, userId);
  if (suggestionMessage) draft.unmetGoals.unshift(suggestionMessage);
  await withPlannerTransaction(userId, async (c) => {
    const o = await ownerState(c, userId);
    checkRevision(o.revision, draft.baseRevision);
    await c.query(
      "DELETE FROM planner_generations WHERE user_id=$1 AND expires_at<now()",
      [userId],
    );
    const count = await c.query(
      "SELECT count(*)::int AS n FROM planner_generations WHERE user_id=$1 AND expires_at>now()",
      [userId],
    );
    if (count.rows[0].n >= 20)
      throw new PlannerError("Too many recent previews. Try again later.", 429);
    await c.query(
      "INSERT INTO planner_generations(id,user_id,draft,expires_at) VALUES($1,$2,$3,$4)",
      [draft.id, userId, JSON.stringify(draft), new Date(draft.expiresAt)],
    );
  });
  return draft;
}
export async function applyGeneration(
  userId: string,
  generationId: string,
  idempotencyKey: string,
) {
  return withPlannerTransaction(userId, async (c) => {
    const previous = (
      await c.query(
        "SELECT generation_id,result FROM planner_applications WHERE user_id=$1 AND idempotency_key=$2",
        [userId, idempotencyKey],
      )
    ).rows[0];
    if (previous) {
      if (previous.generation_id !== generationId)
        throw new PlannerError(
          "This Apply request was already used for another preview.",
          409,
        );
      return previous.result;
    }
    const stored = (
      await c.query(
        "SELECT draft,expires_at FROM planner_generations WHERE id=$1 AND user_id=$2",
        [generationId, userId],
      )
    ).rows[0];
    if (!stored) throw new PlannerError("Plan preview not found.", 404);
    const draft = stored.draft as GeneratedPlan;
    if (+new Date(stored.expires_at) < Date.now())
      throw new PlannerError(
        "This plan preview expired. Generate a new one.",
        409,
      );
    const start =
      draft.entries[0]?.plannedFor || Object.keys(draft.daySummaries)[0];
    if (!start) throw new PlannerError("This preview has no meals to apply.");
    const state = await stateFromClient(c, userId, start);
    checkRevision(state.revision, draft.baseRevision);
    if (state.preferences.version !== draft.preferenceVersion)
      throw new PlannerError(
        "Your nutrition settings changed. Generate again.",
        409,
      );
    for (const [key, revision] of Object.entries(draft.recipeRevisions))
      if (state.recipes.find((r) => r.key === key)?.revision !== revision)
        throw new PlannerError(
          "A recipe changed. Generate again before applying.",
          409,
        );
    for(const old of state.entries)if(!draft.entries.some(e=>e.id===old.id))await c.query('DELETE FROM meal_plan_items WHERE id=$1 AND user_id=$2',[old.id,userId]);
    for (const entry of draft.entries) {
      const old = state.entries.find((e) => e.id === entry.id);
      if (old && old.version === entry.version) continue;
      let snapshotId: string | null = null,
        recipeId: string | null = null;
      if (entry.source.kind === "recipe") {
        recipeId = entry.source.recipeId;
        if (!state.recipes.some((r) => r.key === recipeId))
          throw new PlannerError("Recipe not found.", 404);
      } else {
        snapshotId = entry.source.snapshotId;
        const snapshot = (
          await c.query(
            "SELECT id FROM planner_snapshots WHERE id=$1 AND user_id=$2",
            [snapshotId, userId],
          )
        ).rows[0];
        if (!snapshot) {
          if (entry.recipe?.source.kind !== "suggestion")
            throw new PlannerError("Suggestion is unavailable.");
          await c.query(
            "INSERT INTO planner_snapshots(id,user_id,recipe) VALUES($1,$2,$3)",
            [snapshotId, userId, JSON.stringify(entry.recipe)],
          );
        }
      }
      await c.query(
        "INSERT INTO meal_plan_items(id,user_id,recipe_id,snapshot_id,planned_for,meal_slot,servings,locked,version) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(user_id,planned_for,meal_slot) DO UPDATE SET recipe_id=EXCLUDED.recipe_id,snapshot_id=EXCLUDED.snapshot_id,servings=EXCLUDED.servings,locked=EXCLUDED.locked,version=meal_plan_items.version+1",
        [
          entry.id,
          userId,
          recipeId,
          snapshotId,
          entry.plannedFor,
          entry.mealSlot,
          entry.servings,
          entry.locked,
          entry.version,
        ],
      );
    }
    await bumpRevision(c, userId);
    const result = await stateFromClient(c, userId, start);
    await c.query(
      "INSERT INTO planner_applications(user_id,idempotency_key,generation_id,result) VALUES($1,$2,$3,$4)",
      [userId, idempotencyKey, generationId, JSON.stringify(result)],
    );
    return result;
  });
}
