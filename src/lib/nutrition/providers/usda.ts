import "server-only";
import {
  foodRecordSchema,
  type NutrientProvider,
  type FoodRecord,
  type FoodCandidate,
  type Nutrients,
} from "../types";
type UsdaFood = {
  fdcId: number;
  description: string;
  foodNutrients?: {
    nutrient?: { id: number };
    nutrientId?: number;
    amount?: number;
    value?: number;
  }[];
  foodPortions?: {
    gramWeight: number;
    amount: number;
    modifier?: string;
    measureUnit?: { name: string };
  }[];
};
function state(name: string): FoodRecord["state"] {
  return /\b(cooked|boiled|roasted|baked|fried)\b/i.test(name)
    ? "cooked"
    : /\braw\b/i.test(name)
      ? "raw"
      : "other";
}
export class UsdaProvider implements NutrientProvider {
  readonly id = "usda";
  readonly normalizationVersion = "1";
  constructor(private key: string) {}
  private async request(path: string, signal: AbortSignal): Promise<unknown> {
    const u = new URL("https://api.nal.usda.gov/fdc/v1/" + path);
    u.searchParams.set("api_key", this.key);
    const r = await fetch(u, { signal, cache: "no-store" });
    if (!r.ok)
      throw Error(
        r.status === 429
          ? "Nutrition source is temporarily rate limited."
          : "Nutrition source is unavailable.",
      );
    return r.json();
  }
  private ref(f: UsdaFood) {
    return {
      providerId: this.id,
      externalId: String(f.fdcId),
      normalizationVersion: this.normalizationVersion,
      retrievedAt: new Date().toISOString(),
      sourceUrl: `https://fdc.nal.usda.gov/food-details/${f.fdcId}/nutrients`,
      attribution: "USDA FoodData Central (CC0)",
    };
  }
  async search(query: string, signal: AbortSignal): Promise<FoodCandidate[]> {
    const data = (await this.request(
      `foods/search?query=${encodeURIComponent(query)}&pageSize=8&dataType=Foundation,SR%20Legacy`,
      signal,
    )) as { foods?: UsdaFood[] };
    return (data.foods || []).map((f) => ({
      ref: this.ref(f),
      name: f.description,
      state: state(f.description),
    }));
  }
  async getFood(id: string, signal: AbortSignal): Promise<FoodRecord> {
    if (!/^\d+$/.test(id)) throw Error("Invalid food identifier.");
    const f = (await this.request(`food/${id}`, signal)) as UsdaFood;
    const n = (ids: number[]) => {
      for (const id of ids) {
        const row = f.foodNutrients?.find(
            (x) => (x.nutrient?.id ?? x.nutrientId) === id,
          ),
          v = row?.amount ?? row?.value;
        if (typeof v === "number" && Number.isFinite(v) && v >= 0)
          return { min: v, max: v };
      }
      return null;
    };
    const nutrientsPer100g: Nutrients = {
      kcal: n([1008, 2047, 2048]),
      proteinG: n([1003]),
      fibreG: n([1079]),
      carbohydrateG: n([1005]),
      fatG: n([1004]),
    };
    const portions = (f.foodPortions || [])
      .flatMap((p) =>
        p.amount > 0 && p.gramWeight > 0
          ? [
              {
                unit:
                  p.measureUnit?.name === "undetermined"
                    ? p.modifier || ""
                    : p.measureUnit?.name || p.modifier || "",
                grams: p.gramWeight / p.amount,
              },
            ]
          : [],
      )
      .filter((p) => p.unit);
    return foodRecordSchema.parse({
      ref: this.ref(f),
      name: f.description,
      state: state(f.description),
      nutrientsPer100g,
      portions,
    });
  }
}
