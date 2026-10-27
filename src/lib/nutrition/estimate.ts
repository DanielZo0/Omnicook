import type { StructuredIngredient } from "../planner/types";
import {
  emptyNutrients,
  nutrientNames,
  type FoodRecord,
  type NutritionEstimate,
} from "./types";
import { ingredientGrams } from "./quantity";
type RecipeInput = {
  ingredients: Pick<
    StructuredIngredient,
    "position" | "name" | "quantity" | "unit" | "notes"
  >[];
  servings: number | null;
};
export function recipeFingerprint(recipe: RecipeInput): string {
  return JSON.stringify({
    servings: recipe.servings,
    ingredients: recipe.ingredients.map((i) => [
      i.position,
      i.name,
      i.quantity,
      i.unit,
      i.notes,
    ]),
  });
}
export function estimateRecipe(
  recipe: RecipeInput,
  matches: Record<string, FoodRecord>,
): NutritionEstimate {
  const nutrients = emptyNutrients(),
    missing: string[] = [],
    sources: FoodRecord["ref"][] = [];
  let resolved = 0;
  const sums = Object.fromEntries(
    nutrientNames.map((k) => [k, { min: 0, max: 0, known: true }]),
  ) as Record<
    (typeof nutrientNames)[number],
    { min: number; max: number; known: boolean }
  >;
  for (const i of recipe.ingredients) {
    const food = matches[i.position];
    const state = /\b(cooked|boiled|baked|roasted|fried)\b/i.test(
      i.name + " " + (i.notes || ""),
    )
      ? "cooked"
      : /\braw\b/i.test(i.name)
        ? "raw"
        : null;
    const grams =
      food && (!state || food.state === state)
        ? ingredientGrams(i.quantity, i.unit, food)
        : null;
    if (!food || !grams) {
      missing.push(
        `${i.name}: ${food ? "quantity, portion weight or food state needs review" : "choose a food match"}`,
      );
      for (const key of nutrientNames) sums[key].known = false;
      continue;
    }
    resolved++;
    sources.push(food.ref);
    for (const key of nutrientNames) {
      const n = food.nutrientsPer100g[key];
      if (n) {
        sums[key].min += (n.min * grams.min) / 100;
        sums[key].max += (n.max * grams.max) / 100;
      } else {
        sums[key].known = false;
      }
    }
  }
  for (const key of nutrientNames)
    if (sums[key].known && recipe.ingredients.length)
      nutrients[key] = { min: sums[key].min, max: sums[key].max };
  for (const key of ["kcal", "proteinG", "fibreG"] as const)
    if (!nutrients[key] && resolved === recipe.ingredients.length)
      missing.push(`${key}: source nutrient is unavailable`);
  if (
    !recipe.servings ||
    !Number.isFinite(recipe.servings) ||
    recipe.servings <= 0
  )
    missing.push(
      "Recipe yield is unknown. Set the recipe servings before estimating a portion.",
    );
  return {
    status:
      resolved === 0 ? "unavailable" : missing.length ? "partial" : "complete",
    nutrients,
    missing,
    fingerprint: recipeFingerprint(recipe),
    estimatorVersion: "1",
    sources: [...new Map(sources.map((s) => [JSON.stringify(s), s])).values()],
  };
}
