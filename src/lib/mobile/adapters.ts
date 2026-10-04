import type { VaultRecipe } from '@/lib/api/client';
import type { MobileRecipe } from './demo-data';

const CATEGORY_IMAGES: Record<string, string[]> = {
  Breakfast: [
    'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1506084868230-bb9d95c24759?auto=format&fit=crop&w=900&q=80',
  ],
  Lunch: [
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1547496502-affa22d38842?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80',
  ],
  Dinner: [
    'https://images.unsplash.com/photo-1551218808-94e220e084d2?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1498837167922-ddd27525d352?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=900&q=80',
  ],
  Dessert: [
    'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=900&q=80',
  ],
  Snack: [
    'https://images.unsplash.com/photo-1541592106381-b31e9677c0e5?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1600490036275-35f78f2f7e3f?auto=format&fit=crop&w=900&q=80',
  ],
  Other: [
    'https://images.unsplash.com/photo-1495521821757-a1efb6729352?auto=format&fit=crop&w=900&q=80',
    'https://images.unsplash.com/photo-1495195129352-aeb325a55b65?auto=format&fit=crop&w=900&q=80',
  ],
};

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash;
}

function imageForRecipe(recipe: VaultRecipe): string {
  const options = CATEGORY_IMAGES[recipe.category] ?? CATEGORY_IMAGES.Other;
  return options[hashString(recipe.id) % options.length];
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
