import type { PreviewRecipe } from './CombinedFlows';
import type { MobileRecipe } from '../../lib/mobile/demo-data';
import type { StructuredIngredient } from '../../lib/planner/types';
import { normalizeUnit, parseQuantity, scaleQuantity } from '../../lib/nutrition/quantity';

// Keep the quantity separate so the planner uses the same range/fraction scaler
// as recipe detail. Unsupported descriptions remain readable and unquantified.
export function parsePreviewIngredient(text: string, position: number): StructuredIngredient {
  const original = text.trim();
  const match = original.match(/^([\d\s.,/½¼¾⅓⅔⅛⅜⅝⅞–—-]+)(.*)$/);
  const quantity = match?.[1].trim() || null;
  if (!match || !parseQuantity(quantity) || !match[2].trim()) {
    return { position, quantity: null, unit: null, name: original, notes: null, aisle: 'Pantry' };
  }
  const rest = match[2].trim();
  const unit = rest.match(/^(kg|mg|g|ml|l|tsp|tbsp|cups?|oz|lbs?|grams?|kilograms?|millilitres?|milliliters?|tablespoons?|teaspoons?)\b\.?\s*/i);
  const name = unit ? rest.slice(unit[0].length).trim() : rest;
  if (!name) return { position, quantity: null, unit: null, name: original, notes: null, aisle: 'Pantry' };
  return { position, quantity, unit: unit ? normalizeUnit(unit[1]) : null, name, notes: null, aisle: 'Pantry' };
}

export function previewToMobile(recipe: PreviewRecipe, ingredients: string[], steps: string[]): MobileRecipe {
  const structuredIngredients = ingredients.map((text, position) =>
    parsePreviewIngredient(recipe.substitution && text.includes('cream') ? recipe.substitution : text, position));
  return {
    id: String(recipe.id), t: recipe.title, c: recipe.author, s: recipe.source || 'Cookbook', k: 'Dinner',
    time: recipe.time === null ? 'Time not set' : `${recipe.time} min`,
    n: recipe.yieldServings, yieldServings: recipe.yieldServings,
    prepMinutes: recipe.time, cookMinutes: recipe.time === null ? null : 0,
    img: recipe.image, sourceUrl: recipe.sourceUrl || null, collectionId: null,
    structuredIngredients,
    a: structuredIngredients.map(i => ({ amt: [i.quantity, i.unit].filter(Boolean).join(' '), name: i.name, aisle: i.aisle })),
    m: steps,
  };
}

export function savedRecipeLabel(recipe: PreviewRecipe, destinations: string[]): string {
  if (recipe.source) return recipe.source;
  if (recipe.own) return destinations.some(d => d !== 'discover') ? 'Shared with family' : 'Your recipe';
  if (destinations.includes('discover')) return 'Saved from Discover';
  return destinations.length ? 'Saved from family' : 'Saved recipe';
}

// Detail, cooking and shopping share the same parsed quantities and scaler.
export function scalePreviewIngredient(text: string, factor: number): string {
  if (factor === 1) return text;
  const ingredient = parsePreviewIngredient(text, 0);
  if (!ingredient.quantity) return text;
  return [scaleQuantity(ingredient.quantity, factor), ingredient.unit, ingredient.name].filter(Boolean).join(' ');
}
