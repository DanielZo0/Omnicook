'use client';

import type { RecipeDraft } from '@/lib/recipe-schema';

export type Aisle = 'Produce' | 'Dairy & chilled' | 'Pantry';

export type VaultRecipe = {
  id: string;
  title: string;
  creator: string | null;
  sourceUrl: string | null;
  category: string;
  prepMinutes: number | null;
  cookMinutes: number | null;
  servings: number | null;
  createdAt: string;
  collectionId: string | null;
  ingredients: { position: number; quantity: string | null; unit: string | null; name: string; notes: string | null; aisle: Aisle }[];
  steps: { position: number; instruction: string }[];
};

export type MealPlanItem = {
  id: string;
  recipeId: string;
  recipeTitle: string;
  plannedFor: string;
  mealSlot: string;
};

export type Collection = { id: string; name: string };

async function callApi<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const data = await response.json();
  if (!response.ok || data.ok === false) {
    throw new Error(data.message ?? 'Something went wrong.');
  }
  return data as T;
}

export async function listRecipes(): Promise<VaultRecipe[]> {
  const data = await callApi<{ recipes: VaultRecipe[] }>('/api/recipes');
  return data.recipes;
}

export async function createRecipeFromDraft(draft: RecipeDraft, sourceUrl: string | null, collectionId: string | null = null): Promise<void> {
  await callApi('/api/recipes', {
    method: 'POST',
    body: JSON.stringify({ draft, sourceUrl, collectionId }),
  });
}

export async function updateRecipe(id: string, updates: { draft?: RecipeDraft; sourceUrl?: string | null; collectionId?: string | null }): Promise<void> {
  await callApi(`/api/recipes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function listCollections(): Promise<Collection[]> {
  const data = await callApi<{ collections: Collection[] }>('/api/collections');
  return data.collections;
}

export async function createCollection(name: string): Promise<Collection> {
  const data = await callApi<{ collection: Collection }>('/api/collections', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  return data.collection;
}

export async function listMealPlanItems(): Promise<MealPlanItem[]> {
  const data = await callApi<{ items: MealPlanItem[] }>('/api/meal-plan');
  return data.items;
}

export async function upsertMealPlanItem(recipeId: string, plannedFor: string, mealSlot: string): Promise<void> {
  await callApi('/api/meal-plan', {
    method: 'POST',
    body: JSON.stringify({ recipeId, plannedFor, mealSlot }),
  });
}
