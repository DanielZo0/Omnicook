import type { MobileRecipe } from "../mobile/demo-data";
import type { PlannableRecipe } from "./types";
import { unavailableEstimate } from "../nutrition/types";
import { foodFeatures } from "./foods";
export function mobileToPlannable(r: MobileRecipe): PlannableRecipe {
  const ingredients =
    r.structuredIngredients ||
    r.a.map((i, position) => {
      const match = i.amt.match(/^([\d\s.,/½¼¾⅓⅔⅛⅜⅝⅞–-]+)\s*(.*)$/);
      return {
        position,
        name: i.name,
        quantity: match?.[1]?.trim() || null,
        unit: match?.[2] || null,
        notes: null,
        aisle: i.aisle,
      };
    });
  const recipe: PlannableRecipe = {
    key: r.id,
    title: r.t,
    ingredients,
    steps: r.m.map((instruction, position) => ({ position, instruction })),
    servings: r.yieldServings === undefined ? r.n : r.yieldServings,
    prepMinutes:
      r.prepMinutes === undefined ? parseInt(r.time) || null : r.prepMinutes,
    cookMinutes: r.cookMinutes === undefined ? 0 : r.cookMinutes,
    category: r.k,
    imageUrl: r.img,
    source: { kind: "recipe", recipeId: r.id },
    revision: JSON.stringify([ingredients, r.yieldServings, r.m]),
    nutrition: unavailableEstimate(),
    plantFoods: [],
    fermentedFoods: [],
    exclusionStatus: "unknown",
  };
  return { ...recipe, ...foodFeatures(recipe) };
}
