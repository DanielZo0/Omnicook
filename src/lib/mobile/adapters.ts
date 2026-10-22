import type { VaultRecipe } from '@/lib/api/client';
import type { MobileRecipe } from './demo-data';
import { normalizeImageUrl } from '../image-url';

function imageForRecipe(recipe: VaultRecipe): string {
  return normalizeImageUrl(recipe.imageUrl) ?? '/recipe-placeholder.svg';
}

export function vaultToMobile(recipe: VaultRecipe): MobileRecipe {
  const minutes = (recipe.prepMinutes ?? 0) + (recipe.cookMinutes ?? 0);
  let source = 'Imported';
  if (recipe.sourceUrl) {
    try { source = new URL(recipe.sourceUrl).hostname.replace(/^www\./, ''); } catch { /* keep default */ }
  }
  return {
    id: recipe.id,
    t: recipe.title,
    c: recipe.creator ?? source,
    s: source,
    k: recipe.category,
    time: minutes > 0 ? `${minutes} min` : 'Time not set',
    n: recipe.servings ?? 1,
    img: imageForRecipe(recipe),
    photoMetadata: recipe.photoMetadata,
    photoPending: recipe.photoPending,
    sourceUrl: recipe.sourceUrl,
    originalRecipeUrl: recipe.originalRecipeUrl??null,
    collectionId: recipe.collectionId,
    a: recipe.ingredients.map((ingredient) => ({
      amt: [ingredient.quantity, ingredient.unit].filter(Boolean).join(' ') || '—',
      name: ingredient.name,
      aisle: ingredient.aisle,
    })),
    m: recipe.steps.map((step) => step.instruction),
  };
}
