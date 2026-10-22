import { z } from "zod";
import { calendarDate } from "./dates";
export const slots = ["breakfast", "lunch", "dinner", "snack"] as const;
export const dateSchema = z.string().refine((value) => {
  try {
    calendarDate(value);
    return true;
  } catch {
    return false;
  }
}, "Invalid calendar date");
const positive = z.number().finite().positive().max(100000);
export const preferencesSchema = z
  .object({
    version: z.number().int().nonnegative().default(0),
    kcalTarget: positive.nullable().default(null),
    calorieTolerance: z.number().gt(0).lt(1).default(0.1),
    proteinMinimumG: positive.nullable().default(null),
    fibreMinimumG: positive.nullable().default(null),
    enabledSlots: z
      .array(z.enum(slots))
      .min(1)
      .max(4)
      .default(["breakfast", "lunch", "dinner", "snack"]),
    servings: positive.max(20).default(1),
    dietaryPattern: z.enum(["vegetarian", "vegan"]).nullable().default(null),
    excludedIngredients: z
      .array(z.string().trim().min(1).max(80))
      .max(40)
      .default([]),
    dislikedIngredients: z
      .array(z.string().trim().min(1).max(80))
      .max(40)
      .default([]),
    maxPreparationMinutes: positive.max(1440).nullable().default(null),
    prioritizePlantVariety: z.boolean().default(false),
    includeFermentedOptions: z.boolean().default(false),
  })
  .strict();
export const defaultPreferences = () => preferencesSchema.parse({});
export const entryRequestSchema = z
  .object({
    recipeId: z.string().uuid(),
    plannedFor: dateSchema,
    mealSlot: z.enum(slots),
    servings: positive.max(20).default(1),
    locked: z.boolean().default(true),
    expectedRevision: z.number().int().nonnegative().optional(),
  })
  .strict();
export const deleteRequestSchema = z
  .object({
    id: z.string().uuid(),
    expectedRevision: z.number().int().nonnegative(),
  })
  .strict();
export const generationRequestSchema = z
  .object({
    weekStart: dateSchema,
    day: dateSchema.optional(),
    baseGenerationId: z.string().uuid().optional(),
    sourceMode: z.enum(["saved", "suggestions"]).default("saved"),
    unlockedIds: z.array(z.string().uuid()).max(28).default([]),
    swap: z
      .object({ plannedFor: dateSchema, mealSlot: z.enum(slots) })
      .optional(),
    dismissed: z.array(z.string().max(300)).max(60).default([]),
  })
  .strict();
