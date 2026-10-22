import "server-only";
import {
  withPlannerTransaction,
  PlannerError,
} from "../db/planner-transaction";
import { loadRecipes, ownerState, bumpRevision } from "../planner/repository";
import { nutrientProvider } from "./providers/registry";
import {
  sourceKey,
  foodRecordSchema,
  type FoodRecord,
  type SourceRef,
} from "./types";
import { estimateRecipe, recipeFingerprint } from "./estimate";
import { claimProviderRequest } from './budget';
export async function cachedFood(ref: SourceRef, ownerId: string, signal=AbortSignal.timeout(10000)): Promise<FoodRecord> {
  const p = nutrientProvider();
  if (
    !p ||
    p.id !== ref.providerId ||
    p.normalizationVersion !== ref.normalizationVersion
  )
    throw new PlannerError("That nutrition source is not enabled.");
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);
  const [cached] =
    await sql`SELECT record FROM nutrient_food_cache WHERE provider_id=${p.id} AND external_id=${ref.externalId} AND normalization_version=${p.normalizationVersion} AND expires_at>now()`;
  if (cached) return foodRecordSchema.parse(cached.record);
  await claimProviderRequest(ownerId,p.id);
  const record = foodRecordSchema.parse(
    await p.getFood(ref.externalId, signal),
  );
  await sql`INSERT INTO nutrient_food_cache(provider_id,external_id,normalization_version,record,expires_at) VALUES(${p.id},${ref.externalId},${p.normalizationVersion},${JSON.stringify(record)}::jsonb,now()+interval '30 days') ON CONFLICT(provider_id,external_id,normalization_version) DO UPDATE SET record=EXCLUDED.record,expires_at=EXCLUDED.expires_at`;
  return record;
}
export async function analyzeRecipe(
  userId: string,
  id: string,
  confirmation?: {
    position: number;
    foodRef: SourceRef;
    expectedFingerprint: string;
  },
  reviewPosition?:number,
) {
  const p = nutrientProvider();
  if (!p)
    throw new PlannerError(
      "Nutrition lookup is not configured. Manual planning is still available.",
      503,
    );
  const providerKey = sourceKey({
    providerId: p.id,
    externalId: "analysis",
    normalizationVersion: p.normalizationVersion,
  });
  const before = await withPlannerTransaction(userId, async (c) => {
    const recipe = (await loadRecipes(c, userId)).find((r) => r.key === id);
    if (!recipe) throw new PlannerError("Recipe not found.", 404);
    const fingerprint = recipeFingerprint(recipe);
    const rows = await c.query(
      "SELECT matches FROM nutrition_analyses WHERE user_id=$1 AND recipe_id=$2 AND fingerprint=$3 AND provider_key=$4",
      [userId, id, fingerprint, providerKey],
    );
    return {
      recipe,
      fingerprint,
      matches: (rows.rows[0]?.matches || {}) as Record<string, FoodRecord>,
    };
  });
  if (confirmation) {
    if (confirmation.expectedFingerprint !== before.fingerprint)
      throw new PlannerError(
        "Recipe changed. Reload the nutrition review.",
        409,
      );
    if (
      !before.recipe.ingredients.some(
        (i) => i.position === confirmation.position,
      )
    )
      throw new PlannerError("Ingredient not found.", 404);
    before.matches[confirmation.position] = await cachedFood(
      confirmation.foodRef,
      userId,
    );
  }
  let estimate = estimateRecipe(before.recipe, before.matches);
  await withPlannerTransaction(userId, async (c) => {
    const current = (await loadRecipes(c, userId)).find((r) => r.key === id);
    if (!current || recipeFingerprint(current) !== before.fingerprint)
      throw new PlannerError(
        "Recipe changed. Reload the nutrition review.",
        409,
      );
    await ownerState(c, userId);
    const latest=(await c.query('SELECT matches FROM nutrition_analyses WHERE user_id=$1 AND recipe_id=$2 AND fingerprint=$3 AND provider_key=$4',[userId,id,before.fingerprint,providerKey])).rows[0]?.matches||{};
    before.matches=confirmation?{...latest,[confirmation.position]:before.matches[confirmation.position]}:{...before.matches,...latest};
    estimate=estimateRecipe(current,before.matches);
    await c.query(
      "INSERT INTO nutrition_analyses(user_id,recipe_id,fingerprint,provider_key,analysis,matches) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id,recipe_id,fingerprint,provider_key) DO UPDATE SET analysis=EXCLUDED.analysis,matches=EXCLUDED.matches,created_at=now()",
      [
        userId,
        id,
        before.fingerprint,
        providerKey,
        JSON.stringify(estimate),
        JSON.stringify(before.matches),
      ],
    );
    await bumpRevision(c, userId);
  });
  const unresolved = before.recipe.ingredients.filter((i) => reviewPosition!==undefined?i.position===reviewPosition:!before.matches[i.position]);
  const candidates = [];
  const deadline = AbortSignal.timeout(15000);
  for (const ingredient of unresolved.slice(0, 4)) {
    try {
      await claimProviderRequest(userId,p.id);
      candidates.push({
        ingredient,
        candidates: await p.search(ingredient.name, deadline),
      });
    } catch {
      candidates.push({
        ingredient,
        candidates: [],
        message: "Food lookup is unavailable. Try again later.",
      });
    }
  }
  return { estimate, candidates, remaining: unresolved.length };
}
