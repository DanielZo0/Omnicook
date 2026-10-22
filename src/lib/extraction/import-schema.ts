import { z } from 'zod';
import { recipeSchema } from '../recipe-schema';

// Editing and recovery must allow fields that the save boundary rejects.
export const editableRecipeSchema = recipeSchema.extend({
  title: z.string().max(180),
  ingredients: z.array(recipeSchema.shape.ingredients.element.extend({name:z.string().max(160)})).max(150),
  steps: z.array(recipeSchema.shape.steps.element.extend({instruction:z.string().max(2000)})).max(150),
});
export type EditableRecipeDraft = z.infer<typeof editableRecipeSchema>;
export const importExtractionSchema = editableRecipeSchema.extend({
  title: z.string().trim().min(1).max(180),
  ingredients: z.array(recipeSchema.shape.ingredients.element.extend({name:z.string().trim().min(1).max(160)})).min(1).max(150),
  completeness: z.enum(['complete','incomplete']),
  missingFields: z.array(z.enum(['ingredients','instructions'])).max(2),
}).superRefine((value, ctx) => {
  if (value.completeness === 'complete' && (!recipeSchema.safeParse(value).success || value.missingFields.length)) {
    ctx.addIssue({code:'custom',message:'A complete import requires actual ingredients and instructions.'});
  }
  if (value.completeness === 'incomplete' && !value.missingFields.length) ctx.addIssue({code:'custom',message:'Identify the missing source content.'});
});
export type ImportExtraction = z.infer<typeof importExtractionSchema>;
