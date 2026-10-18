import { after, NextResponse } from 'next/server';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db, isDbConfigured } from '@/lib/db/client';
import { collections, recipeIngredients, recipes, recipeSteps } from '@/lib/db/schema';
import { requireUserId } from '@/lib/auth/require-user';
import { recipeSchema } from '@/lib/recipe-schema';
import { ensureSeeded } from '@/lib/db/seed';
import { imageUrlSchema, normalizeImageUrl } from '@/lib/image-url';
import { ensureRecipePhoto, photosEnabled, photoNeedsWork, recipeSummaryColumns } from '@/lib/photos/service';

export const maxDuration = 120;

export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ ok: false, message: 'The database is not configured yet.' }, { status: 503 });
  }
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ ok: false, message: 'Sign in required.' }, { status: 401 });

  await ensureSeeded(userId);

  const rows = await db().select(recipeSummaryColumns).from(recipes).where(eq(recipes.userId, userId)).orderBy(desc(recipes.createdAt));
  if (photosEnabled()) {
    const activeJobs = rows.filter(r => r.photoMetadata?.status === 'pending' && !photoNeedsWork(r.photoMetadata)).length;
    const queued = rows.filter(r => photoNeedsWork(r.photoMetadata)).slice(0, Math.max(0, 2-activeJobs));
    if (queued.length) after(() => Promise.all(queued.map(r => ensureRecipePhoto(r.id,userId))).then(() => {}));
  }
  const recipeIds = rows.map((r) => r.id);
  const ingredients = recipeIds.length ? await db().select().from(recipeIngredients).where(inArray(recipeIngredients.recipeId, recipeIds)) : [];
  const steps = recipeIds.length ? await db().select().from(recipeSteps).where(inArray(recipeSteps.recipeId, recipeIds)) : [];

  const data = rows.map((r) => ({
    id: r.id,
    title: r.title,
    creator: r.creator,
    sourceUrl: r.sourceUrl,
    imageUrl: r.hasPhoto ? `/api/recipes/${r.id}/photo?v=${r.updatedAt.getTime()}` : r.imageUrl,
    photoMetadata: r.photoMetadata,
    photoPending: photosEnabled() && (photoNeedsWork(r.photoMetadata) || r.photoMetadata?.status === 'pending'),
    category: r.category,
    prepMinutes: r.prepMinutes,
    cookMinutes: r.cookMinutes,
    servings: r.servings != null ? Number(r.servings) : null,
    createdAt: r.createdAt.toISOString(),
    collectionId: r.collectionId,
    ingredients: ingredients
      .filter((i) => i.recipeId === r.id)
      .sort((a, b) => a.position - b.position)
      .map((i) => ({ position: i.position, quantity: i.quantity, unit: i.unit, name: i.name, notes: i.notes, aisle: i.aisle })),
    steps: steps
      .filter((st) => st.recipeId === r.id)
      .sort((a, b) => a.position - b.position)
      .map((st) => ({ position: st.position, instruction: st.instruction })),
  }));

  return NextResponse.json({ ok: true, recipes: data });
}

const createRequestSchema = z.object({
  draft: recipeSchema,
  sourceUrl: z.string().nullable(),
  collectionId: z.string().uuid().nullable(),
  imageUrl: imageUrlSchema.optional().default(null),
});

export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ ok: false, message: 'The database is not configured yet.' }, { status: 503 });
  }
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ ok: false, message: 'Sign in required.' }, { status: 401 });

  const parsed = createRequestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ ok: false, message: 'Invalid recipe payload.' }, { status: 400 });
  const { draft, sourceUrl, collectionId, imageUrl } = parsed.data;

  if (collectionId !== null) {
    const [collection] = await db().select({ id: collections.id }).from(collections)
      .where(and(eq(collections.id, collectionId), eq(collections.userId, userId)));
    if (!collection) return NextResponse.json({ ok: false, message: 'Collection not found.' }, { status: 404 });
  }

  const [recipe] = await db().insert(recipes).values({
    userId,
    title: draft.title,
    creator: draft.creator,
    sourceUrl,
    imageUrl: normalizeImageUrl(imageUrl),
    category: draft.category,
    prepMinutes: draft.prepMinutes,
    cookMinutes: draft.cookMinutes,
    servings: draft.servings != null ? String(draft.servings) : null,
    collectionId,
  }).returning({id: recipes.id});

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

  if (photosEnabled()) after(() => ensureRecipePhoto(recipe.id,userId));
  return NextResponse.json({ ok: true, id: recipe.id });
}
