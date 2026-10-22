import "server-only";
import type { RecipeSuggestionProvider } from "../../nutrition/types";
import { TheMealDbProvider } from "./themealdb";
export function suggestionProvider(): RecipeSuggestionProvider | null {
  return process.env.RECIPE_SUGGESTION_PROVIDER === "themealdb" &&
    process.env.THEMEALDB_API_KEY &&
    process.env.THEMEALDB_PRODUCTION_ACCESS === "true"
    ? new TheMealDbProvider(process.env.THEMEALDB_API_KEY)
    : null;
}
