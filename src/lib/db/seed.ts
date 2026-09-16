import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/client';
import { recipeIngredients, recipes, recipeSteps, seededUsers } from '@/lib/db/schema';
import { STARTER_RECIPES } from '@/lib/db/seed-recipes';

/** Gives a brand-new account a starter set of recipes on their first vault load. Runs once per user. */
export async function ensureSeeded(userId: string) {
  const [already] = await db().select({ userId: seededUsers.userId }).from(seededUsers).where(eq(seededUsers.userId, userId));
  if (already) return;

  for (const { draft, sourceUrl } of STARTER_RECIPES) {
    const [recipe] = await db().insert(recipes).values({
      userId,
      title: draft.title,
      creator: draft.creator,
      sourceUrl,
      category: draft.category,
      prepMinutes: draft.prepMinutes,
      cookMinutes: draft.cookMinutes,
      servings: draft.servings != null ? String(draft.servings) : null,
      collectionId: null,
    }).returning();

    await db().insert(recipeIngredients).values(draft.ingredients.map((ingredient) => ({
      recipeId: recipe.id,
      position: ingredient.position,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      name: ingredient.name,
      notes: ingredient.notes,
      aisle: ingredient.aisle,
    })));

    await db().insert(recipeSteps).values(draft.steps.map((step) => ({
      recipeId: recipe.id,
      position: step.position,
      instruction: step.instruction,
    })));
  }

  await db().insert(seededUsers).values({ userId }).onConflictDoNothing();
}
