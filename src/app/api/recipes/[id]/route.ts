import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, isDbConfigured } from '@/lib/db/client';
import { recipeIngredients, recipes, recipeSteps } from '@/lib/db/schema';
import { requireUserId } from '@/lib/auth/require-user';
import { recipeSchema } from '@/lib/recipe-schema';

const updateRequestSchema = z.object({
  draft: recipeSchema.optional(),
  sourceUrl: z.string().nullable().optional(),
  collectionId: z.string().uuid().nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isDbConfigured()) {
    return NextResponse.json({ ok: false, message: 'The database is not configured yet.' }, { status: 503 });
  }
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ ok: false, message: 'Sign in required.' }, { status: 401 });

  const { id } = await params;
  const parsed = updateRequestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ ok: false, message: 'Invalid update payload.' }, { status: 400 });
  const { draft, sourceUrl, collectionId } = parsed.data;

  const [existing] = await db().select({ id: recipes.id }).from(recipes)
    .where(and(eq(recipes.id, id), eq(recipes.userId, userId)));
  if (!existing) return NextResponse.json({ ok: false, message: 'Recipe not found.' }, { status: 404 });

  const updates: Partial<typeof recipes.$inferInsert> = { updatedAt: new Date() };
  if (draft) {
    updates.title = draft.title;
    updates.creator = draft.creator;
    updates.category = draft.category;
    updates.prepMinutes = draft.prepMinutes;
    updates.cookMinutes = draft.cookMinutes;
    updates.servings = draft.servings != null ? String(draft.servings) : null;
  }
  if (sourceUrl !== undefined) updates.sourceUrl = sourceUrl;
  if (collectionId !== undefined) updates.collectionId = collectionId;

  await db().update(recipes).set(updates).where(eq(recipes.id, id));

  if (draft) {
    await db().delete(recipeIngredients).where(eq(recipeIngredients.recipeId, id));
    await db().insert(recipeIngredients).values(draft.ingredients.map((ingredient) => ({
      recipeId: id,
      position: ingredient.position,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      name: ingredient.name,
      notes: ingredient.notes,
      aisle: ingredient.aisle,
    })));

    await db().delete(recipeSteps).where(eq(recipeSteps.recipeId, id));
    await db().insert(recipeSteps).values(draft.steps.map((step) => ({
      recipeId: id,
      position: step.position,
      instruction: step.instruction,
    })));
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isDbConfigured()) {
    return NextResponse.json({ ok: false, message: 'The database is not configured yet.' }, { status: 503 });
  }
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ ok: false, message: 'Sign in required.' }, { status: 401 });

  const { id } = await params;
  const [existing] = await db().select({ id: recipes.id }).from(recipes)
    .where(and(eq(recipes.id, id), eq(recipes.userId, userId)));
  if (!existing) return NextResponse.json({ ok: false, message: 'Recipe not found.' }, { status: 404 });

  await db().delete(recipes).where(eq(recipes.id, id));

  return NextResponse.json({ ok: true });
}
