import "server-only";
import {
  sourcedRecipeSchema,
  type SourcedRecipe,
  type RecipeSuggestionProvider,
} from "../../nutrition/types";
type Meal = Record<string, string | null>;
export function normalizeMeal(meal: Meal): SourcedRecipe {
  const ingredients = [];
  for (let i = 1; i <= 20; i++) {
    const name = meal["strIngredient" + i]?.trim();
    if (!name) continue;
    const measure = meal["strMeasure" + i]?.trim() || "";
    const match = measure.match(/^([\d\s.,/½¼¾⅓⅔⅛⅜⅝⅞–-]+)\s*([\p{L}]+)?$/u);
    ingredients.push({
      position: ingredients.length,
      name,
      quantity: match?.[1]?.trim() || null,
      unit: match?.[2] || null,
      notes: match ? null : measure || null,
      aisle: "Pantry",
    });
  }
  const id = meal.idMeal || "";
  const sourceUrl = `https://www.themealdb.com/meal/${encodeURIComponent(id)}`;
  return sourcedRecipeSchema.parse({
    ref: {
      providerId: "themealdb",
      externalId: id,
      normalizationVersion: "1",
      retrievedAt: new Date().toISOString(),
      sourceUrl,
      attribution: "Recipe data and artwork: TheMealDB",
    },
    title: meal.strMeal,
    ingredients,
    steps: (meal.strInstructions || "")
      .split(/\r?\n+/)
      .filter((x) => x.trim())
      .map((instruction, position) => ({ position, instruction })),
    servings: null,
    prepMinutes: null,
    cookMinutes: null,
    category: meal.strCategory || "Other",
    imageUrl: meal.strMealThumb || null,
    imageLicence:
      "TheMealDB API content; attribution required under provider terms",
  });
}
export class TheMealDbProvider implements RecipeSuggestionProvider {
  readonly id = "themealdb";
  readonly normalizationVersion = "1";
  constructor(private key: string) {}
  async search(query: string, signal: AbortSignal): Promise<SourcedRecipe[]> {
    const response = await fetch(
      `https://www.themealdb.com/api/json/v1/${encodeURIComponent(this.key)}/search.php?s=${encodeURIComponent(query)}`,
      { signal, cache: "no-store" },
    );
    if (!response.ok)
      throw Error("Recipe suggestions are temporarily unavailable.");
    const data = (await response.json()) as { meals?: Meal[] };
    return (data.meals || []).slice(0, 15).flatMap((m) => {
      try {
        return [normalizeMeal(m)];
      } catch {
        return [];
      }
    });
  }
}
