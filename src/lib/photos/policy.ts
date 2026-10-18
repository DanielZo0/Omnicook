import type { PhotoRecipe } from './types';
import type { PhotoMetadata } from './types';

function identity(recipe: PhotoRecipe) {
  const normalize=(value:string)=>value.trim().toLowerCase().replace(/\s+/g,' ');
  return JSON.stringify({title:normalize(recipe.title),ingredients:recipe.ingredients.map(i=>normalize(i.name)),steps:recipe.steps.map(s=>normalize(s.instruction))});
}
export function photoRecipeChanged(before:PhotoRecipe,after:PhotoRecipe) {
  return identity(before)!==identity(after);
}
export function photoNeedsWork(metadata:PhotoMetadata | null,now=Date.now()) {
  if (!metadata) return true;
  if (metadata.status==='pending') return !metadata.startedAt || Date.parse(metadata.startedAt)<now-120_000;
  return metadata.status==='unavailable' && (metadata.attempts ?? 1)<3 && Boolean(metadata.retryAfter) && Date.parse(metadata.retryAfter!)<=now;
}
