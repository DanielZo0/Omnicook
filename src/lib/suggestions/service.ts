import "server-only";
import type { PlannerPreferences, PlannableRecipe } from "../planner/types";
import { suggestionProvider } from "./providers/registry";
import { sourceKey, unavailableEstimate } from "../nutrition/types";
import { foodFeatures } from "../planner/foods";
import { nutrientProvider } from '../nutrition/providers/registry';
import { cachedFood } from '../nutrition/repository';
import { claimProviderRequest } from '../nutrition/budget';
import { estimateRecipe } from '../nutrition/estimate';
import type {FoodRecord} from '../nutrition/types';
export async function findSuggestions(
  ownerId: string,
  _preferences: PlannerPreferences,
): Promise<{ recipes: PlannableRecipe[]; message: string | null }> {
  const provider = suggestionProvider();
  if (!provider)
    return {
      recipes: [],
      message:
        "New recipe suggestions are not configured. Your cookbook is still available.",
    };
  const signal = AbortSignal.timeout(15000),
    results: PlannableRecipe[] = [];
  try {
    let lookups=0;
    const nutrient=nutrientProvider();
    for (const query of ["lentil", "oat"]) {
      if (signal.aborted) break;
      await claimProviderRequest(ownerId,provider.id);
      for (const r of await provider.search(query, signal)) {
        const matches:Record<string,FoodRecord>={};
        if(nutrient&&r.servings&&results.length<5){
          for(const ingredient of r.ingredients){
            if(signal.aborted||lookups>=20)break;lookups++;
            await claimProviderRequest(ownerId,nutrient.id);
            const candidates=await nutrient.search(ingredient.name,signal);
            const normalize=(s:string)=>s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
            const exact=candidates.filter(c=>normalize(c.name)===normalize(ingredient.name));
            if(exact.length===1)matches[ingredient.position]=await cachedFood(exact[0].ref,ownerId,signal);
          }
        }
        results.push({
          key: sourceKey(r.ref),
          title: r.title,
          ingredients: r.ingredients,
          steps: r.steps,
          servings: r.servings,
          prepMinutes: r.prepMinutes,
          cookMinutes: r.cookMinutes,
          category: ['Breakfast','Lunch','Dinner','Dessert','Snack','Other'].includes(r.category)?r.category:'Other',
          imageUrl: r.imageUrl,
          imageLicence:r.imageLicence,
          source: { kind: "suggestion", ref: r.ref },
          revision: sourceKey(r.ref),
          nutrition: r.servings?estimateRecipe(r,matches):unavailableEstimate('Recipe yield is unknown. This recipe cannot meet nutrition targets.'),
          ...foodFeatures(r),
          exclusionStatus: "unknown",
        });
        if (results.length >= 30) break;
      }
    }
    return {
      recipes: [...new Map(results.map((r) => [r.key, r])).values()],
      message: results.some((r) => !r.servings)
        ? "Some new recipes lack a stated yield or nutrition. They cannot be used to meet nutrition targets."
        : null,
    };
  } catch {
    return {
      recipes: [],
      message:
        "Recipe suggestions are temporarily unavailable. Using your cookbook only.",
    };
  }
}
