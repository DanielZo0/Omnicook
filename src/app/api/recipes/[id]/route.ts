import { after, NextResponse } from 'next/server';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { sourceLinkSchema } from '@/lib/recipes/source-links';
import { db, isDbConfigured } from '@/lib/db/client';
import { collections, recipeIngredients, recipes, recipeSteps } from '@/lib/db/schema';
import { requireUserId } from '@/lib/auth/require-user';
import { recipeSchema } from '@/lib/recipe-schema';
import { imageUrlSchema, normalizeImageUrl } from '@/lib/image-url';
import { ensureRecipePhoto, photosEnabled } from '@/lib/photos/service';
import { photoRecipeChanged } from '@/lib/photos/policy';

export const maxDuration = 120;

const updateRequestSchema = z.object({
  draft: recipeSchema.optional(),
  sourceUrl: sourceLinkSchema.nullable().optional(),
  originalRecipeUrl: sourceLinkSchema.nullable().optional(),
  collectionId: z.string().uuid().nullable().optional(),
  imageUrl: imageUrlSchema.optional(),
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
  const { draft, sourceUrl, originalRecipeUrl, collectionId, imageUrl } = parsed.data;

  const [existing] = await db().select({ id: recipes.id, title:recipes.title, photoMetadata:recipes.photoMetadata }).from(recipes)
    .where(and(eq(recipes.id, id), eq(recipes.userId, userId)));
  if (!existing) return NextResponse.json({ ok: false, message: 'Recipe not found.' }, { status: 404 });

  if (collectionId !== undefined && collectionId !== null) {
    const [collection] = await db().select({ id: collections.id }).from(collections)
      .where(and(eq(collections.id, collectionId), eq(collections.userId, userId)));
    if (!collection) return NextResponse.json({ ok: false, message: 'Collection not found.' }, { status: 404 });
  }

  const updates: Partial<typeof recipes.$inferInsert> = { updatedAt: new Date() };
  let resetPhoto = false;
  let dishChanged = false;
  if (draft && existing.photoMetadata?.kind !== 'user' && existing.photoMetadata?.kind !== 'source') {
    const [ingredients,steps] = await Promise.all([
      db().select({name:recipeIngredients.name}).from(recipeIngredients).where(eq(recipeIngredients.recipeId,id)).orderBy(recipeIngredients.position),
      db().select({instruction:recipeSteps.instruction}).from(recipeSteps).where(eq(recipeSteps.recipeId,id)).orderBy(recipeSteps.position),
    ]);
    dishChanged = photoRecipeChanged({title:existing.title,ingredients,steps},draft);
  }
  if (draft) {
    updates.title = draft.title;
    updates.creator = draft.creator;
    updates.category = draft.category;
    updates.prepMinutes = draft.prepMinutes;
    updates.cookMinutes = draft.cookMinutes;
    updates.servings = draft.servings != null ? String(draft.servings) : null;
  }
  if (sourceUrl !== undefined) updates.sourceUrl = sourceUrl;
  if (originalRecipeUrl !== undefined) updates.originalRecipeUrl = originalRecipeUrl;
  if (imageUrl !== undefined) updates.imageUrl = normalizeImageUrl(imageUrl);
  if (imageUrl !== undefined && existing.photoMetadata?.kind !== 'user') {
    resetPhoto = true;
  } else if (dishChanged) {
    // A materially edited draft needs an illustration of the edited dish.
    resetPhoto = true;
  }
  if (collectionId !== undefined) updates.collectionId = collectionId;

  await db().update(recipes).set({...updates, ...(resetPhoto ? {
    // Check at write time: an upload can win after the earlier ownership read.
    photoData:sql`CASE WHEN ${recipes.photoMetadata}->>'kind' = 'user' THEN ${recipes.photoData} ELSE NULL END`,
    photoMetadata:sql`CASE WHEN ${recipes.photoMetadata}->>'kind' = 'user' THEN ${recipes.photoMetadata} ELSE NULL END`,
  } : {})}).where(and(eq(recipes.id, id), eq(recipes.userId, userId)));

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

  if (photosEnabled() && resetPhoto) after(() => ensureRecipePhoto(id,userId));
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

  await db().delete(recipes).where(and(eq(recipes.id, id), eq(recipes.userId, userId)));

  return NextResponse.json({ ok: true });
}
