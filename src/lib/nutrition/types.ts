import { z } from "zod";
const publicUrl = z
  .string()
  .url()
  .refine((s) => {
    const u = new URL(s);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[|172\.(1[6-9]|2\d|3[01])\.)/i.test(
        u.hostname,
      ) &&
      u.hostname.includes(".")
    );
  });
export const sourceRefSchema = z.object({
  providerId: z.string().min(1).max(80),
  externalId: z.string().min(1).max(160),
  normalizationVersion: z.string().min(1).max(40),
  retrievedAt: z.string().datetime(),
  sourceUrl: publicUrl,
  attribution: z.string().min(1).max(500),
});
export type SourceRef = z.infer<typeof sourceRefSchema>;
export type Range = { min: number; max: number };
export const rangeSchema = z
  .object({
    min: z.number().finite().nonnegative(),
    max: z.number().finite().nonnegative(),
  })
  .refine((x) => x.max >= x.min);
export const nutrientNames = [
  "kcal",
  "proteinG",
  "fibreG",
  "carbohydrateG",
  "fatG",
] as const;
export type Nutrient = (typeof nutrientNames)[number];
const nutrientSchema = z.object({
  kcal: rangeSchema.nullable(),
  proteinG: rangeSchema.nullable(),
  fibreG: rangeSchema.nullable(),
  carbohydrateG: rangeSchema.nullable(),
  fatG: rangeSchema.nullable(),
});
export type Nutrients = z.infer<typeof nutrientSchema>;
export const foodRecordSchema = z.object({
  ref: sourceRefSchema,
  name: z.string().min(1),
  state: z.enum(["raw", "cooked", "other"]),
  nutrientsPer100g: nutrientSchema,
  portions: z.array(
    z.object({ unit: z.string(), grams: z.number().finite().positive() }),
  ),
});
export type FoodRecord = z.infer<typeof foodRecordSchema>;
export type FoodCandidate = {
  ref: SourceRef;
  name: string;
  state: FoodRecord["state"];
};
export const estimateSchema = z.object({
  status: z.enum(["complete", "partial", "unavailable"]),
  nutrients: nutrientSchema,
  missing: z.array(z.string()),
  fingerprint: z.string(),
  estimatorVersion: z.string(),
  sources: z.array(sourceRefSchema),
});
export type NutritionEstimate = z.infer<typeof estimateSchema>;
export const ingredientSchema = z.object({
  position: z.number().int().nonnegative(),
  quantity: z.string().nullable(),
  unit: z.string().nullable(),
  name: z.string().min(1),
  notes: z.string().nullable(),
  aisle: z.enum(["Produce", "Dairy & chilled", "Pantry"]),
});
export const sourcedRecipeSchema = z.object({
  ref: sourceRefSchema,
  title: z.string().min(1).max(180),
  ingredients: z.array(ingredientSchema).min(1).max(150),
  steps: z
    .array(
      z.object({
        position: z.number().int().nonnegative(),
        instruction: z.string().min(1),
      }),
    )
    .min(1)
    .max(150),
  servings: z.number().finite().positive().nullable(),
  prepMinutes: z.number().nonnegative().nullable(),
  cookMinutes: z.number().nonnegative().nullable(),
  category: z.string(),
  imageUrl: publicUrl.nullable(),
  imageLicence: z.string().min(1),
});
export type SourcedRecipe = z.infer<typeof sourcedRecipeSchema>;
export function sourceKey(
  ref: Pick<SourceRef, "providerId" | "externalId" | "normalizationVersion">,
): string {
  return JSON.stringify([
    ref.providerId,
    ref.externalId,
    ref.normalizationVersion,
  ]);
}
export function emptyNutrients(): Nutrients {
  return {
    kcal: null,
    proteinG: null,
    fibreG: null,
    carbohydrateG: null,
    fatG: null,
  };
}
export function unavailableEstimate(
  reason = "Nutrition has not been analysed.",
): NutritionEstimate {
  return {
    status: "unavailable",
    nutrients: emptyNutrients(),
    missing: [reason],
    fingerprint: "",
    estimatorVersion: "1",
    sources: [],
  };
}
export interface NutrientProvider {
  id: string;
  normalizationVersion: string;
  search(query: string, signal: AbortSignal): Promise<FoodCandidate[]>;
  getFood(id: string, signal: AbortSignal): Promise<FoodRecord>;
}
export interface RecipeSuggestionProvider {
  id: string;
  normalizationVersion: string;
  search(query: string, signal: AbortSignal): Promise<SourcedRecipe[]>;
}
