import type { VaultRecipe } from '@/lib/api/client';
import type { MobileRecipe } from './demo-data';

const PLACEHOLDER_IMAGE = 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=900&q=80';

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
    img: PLACEHOLDER_IMAGE,
    sourceUrl: recipe.sourceUrl,
    collectionId: recipe.collectionId,
    a: recipe.ingredients.map((ingredient) => ({
      amt: [ingredient.quantity, ingredient.unit].filter(Boolean).join(' ') || '—',
      name: ingredient.name,
      aisle: ingredient.aisle,
    })),
    m: recipe.steps.map((step) => step.instruction),
  };
}
