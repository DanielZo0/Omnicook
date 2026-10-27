import "server-only";
import {
  withPlannerTransaction,
  PlannerError,
} from "../db/planner-transaction";
import { ownerState, bumpRevision } from "../planner/repository";
import type { PlannableRecipe } from "../planner/types";
import { recipeSchema } from "../recipe-schema";
export async function saveSuggestionToCookbook(
  userId: string,
  snapshotId: string,
): Promise<{ recipeId: string }> {
  return withPlannerTransaction(userId, async (c) => {
    await ownerState(c, userId);
    const row = (
      await c.query(
        "SELECT * FROM planner_snapshots WHERE id=$1 AND user_id=$2 FOR UPDATE",
        [snapshotId, userId],
      )
    ).rows[0];
    if (!row) throw new PlannerError("Suggestion not found.", 404);
    if (row.saved_recipe_id) return { recipeId: row.saved_recipe_id };
    const r = row.recipe as PlannableRecipe;
    if (r.source.kind !== "suggestion")
      throw new PlannerError("Suggestion source is missing.");
    const draft = recipeSchema.parse({
      title: r.title,
      creator: r.source.ref.attribution,
      category: [
        "Breakfast",
        "Lunch",
        "Dinner",
        "Dessert",
        "Snack",
        "Other",
      ].includes(r.category)
        ? r.category
        : "Other",
      servings: r.servings,
      prepMinutes: r.prepMinutes,
      cookMinutes: r.cookMinutes,
      ingredients: r.ingredients,
      steps: r.steps,
    });
    const created = (
      await c.query(
        "INSERT INTO recipes(user_id,title,creator,source_url,image_url,category,servings,prep_minutes,cook_minutes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id",
        [
          userId,
          draft.title,
          draft.creator,
          r.source.ref.sourceUrl,
          r.imageUrl,
          draft.category,
          draft.servings,
          draft.prepMinutes,
          draft.cookMinutes,
        ],
      )
    ).rows[0];
    for (const i of draft.ingredients)
      await c.query(
        "INSERT INTO recipe_ingredients(recipe_id,position,quantity,unit,name,notes,aisle) VALUES($1,$2,$3,$4,$5,$6,$7)",
        [created.id, i.position, i.quantity, i.unit, i.name, i.notes, i.aisle],
      );
    for (const step of draft.steps)
      await c.query(
        "INSERT INTO recipe_steps(recipe_id,position,instruction) VALUES($1,$2,$3)",
        [created.id, step.position, step.instruction],
      );
    await c.query(
      "UPDATE planner_snapshots SET saved_recipe_id=$2 WHERE id=$1 AND user_id=$3",
      [snapshotId, created.id, userId],
    );
    await bumpRevision(c, userId);
    return { recipeId: created.id };
  });
}
