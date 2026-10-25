import { z } from 'zod';
import { recipeSchema } from '../recipe-schema';

// Editing and recovery must allow fields that the save boundary rejects.
export const editableRecipeSchema = recipeSchema.extend({
  title: z.string().max(180),
  ingredients: z.array(recipeSchema.shape.ingredients.element.extend({name:z.string().max(160)})).max(150),
  steps: z.array(recipeSchema.shape.steps.element.extend({instruction:z.string().max(2000)})).max(150),
});
export type EditableRecipeDraft = z.infer<typeof editableRecipeSchema>;
const ingredientSchema = recipeSchema.shape.ingredients.element.extend({name:z.string().trim().min(1).max(160)});
export const formulaAlternativeSchema = z.object({
  id:z.string().min(1).max(64).regex(/^[a-z0-9-]+$/),
  label:z.string().trim().min(1).max(120),
  ingredients:z.array(ingredientSchema).min(1).max(150),
});
export const formulaAlternativesSchema = z.array(formulaAlternativeSchema).min(2).max(8).superRefine((items,ctx)=>{
  if(new Set(items.map(i=>i.id)).size!==items.length || new Set(items.map(i=>i.label.toLowerCase())).size!==items.length)
    ctx.addIssue({code:'custom',message:'Formula IDs and labels must be unique.'});
});
export type FormulaAlternative = z.infer<typeof formulaAlternativeSchema>;
export const importExtractionSchema = editableRecipeSchema.extend({
  title: z.string().trim().min(1).max(180),
  ingredients: z.array(ingredientSchema).max(150),
  alternatives: formulaAlternativesSchema.optional(),
  completeness: z.enum(['complete','incomplete']),
  missingFields: z.array(z.enum(['ingredients','instructions'])).max(2),
}).superRefine((value, ctx) => {
  if(value.alternatives ? value.ingredients.length>0 || value.steps.length>0 || value.completeness!=='incomplete' || value.missingFields.length!==1 || value.missingFields[0]!=='instructions' : !value.ingredients.length) ctx.addIssue({code:'custom',message:'Keep alternatives separate with no shared method; otherwise provide ingredients.'});
  if (value.completeness === 'complete' && (!recipeSchema.safeParse(value).success || value.missingFields.length)) {
    ctx.addIssue({code:'custom',message:'A complete import requires actual ingredients and instructions.'});
  }
  if (value.completeness === 'incomplete' && !value.missingFields.length) ctx.addIssue({code:'custom',message:'Identify the missing source content.'});
});
export type ImportExtraction = z.infer<typeof importExtractionSchema>;
