import "server-only";
import type { NutrientProvider } from "../types";
import { UsdaProvider } from "./usda";
export function nutrientProvider(): NutrientProvider | null {
  const id = process.env.NUTRIENT_PROVIDER || "usda";
  return id === "usda" && process.env.USDA_API_KEY
    ? new UsdaProvider(process.env.USDA_API_KEY)
    : null;
}
