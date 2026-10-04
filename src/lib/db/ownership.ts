import 'server-only';
import { and, eq } from 'drizzle-orm';
import { db } from './client';
import { collections, recipes } from './schema';

export async function findOwnedRecipe(userId: string, recipeId: string) {
  const [recipe] = await db()
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(eq(recipes.id, recipeId), eq(recipes.userId, userId)));
  return recipe ?? null;
}

export async function findOwnedCollection(userId: string, collectionId: string) {
  const [collection] = await db()
    .select({ id: collections.id })
    .from(collections)
    .where(and(eq(collections.id, collectionId), eq(collections.userId, userId)));
  return collection ?? null;
}
