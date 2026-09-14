import { z } from 'zod';

export const recipeSchema = z.object({
  title: z.string().min(1).max(180),
  creator: z.string().max(120).nullable().default(null),
  category: z.enum(['Breakfast', 'Lunch', 'Dinner', 'Dessert', 'Snack', 'Other']).default('Other'),
  prepMinutes: z.number().int().nonnegative().nullable().default(null),
  cookMinutes: z.number().int().nonnegative().nullable().default(null),
  servings: z.number().positive().nullable().default(null),
  ingredients: z.array(z.object({
    position: z.number().int().nonnegative(),
    quantity: z.string().max(80).nullable().default(null),
    unit: z.string().max(60).nullable().default(null),
    name: z.string().min(1).max(160),
    notes: z.string().max(300).nullable().default(null),
    aisle: z.enum(['Produce', 'Dairy & chilled', 'Pantry']).default('Pantry'),
  })).min(1),
  steps: z.array(z.object({
    position: z.number().int().nonnegative(),
    instruction: z.string().min(1).max(2000),
  })).min(1),
});

export type RecipeDraft = z.infer<typeof recipeSchema>;
