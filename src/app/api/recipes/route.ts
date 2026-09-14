import { NextResponse } from 'next/server';
import { desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db, isDbConfigured } from '@/lib/db/client';
import { recipeIngredients, recipes, recipeSteps } from '@/lib/db/schema';
import { requireUserId } from '@/lib/auth/require-user';
import { recipeSchema } from '@/lib/recipe-schema';

export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ ok: false, message: 'The database is not configured yet.' }, { status: 503 });
  }
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ ok: false, message: 'Sign in required.' }, { status: 401 });

  const rows = await db().select().from(recipes).where(eq(recipes.userId, userId)).orderBy(desc(recipes.createdAt));
  const recipeIds = rows.map((r) => r.id);
  const ingredients = recipeIds.length ? await db().select().from(recipeIngredients).where(inArray(recipeIngredients.recipeId, recipeIds)) : [];
  const steps = recipeIds.length ? await db().select().from(recipeSteps).where(inArray(recipeSteps.recipeId, recipeIds)) : [];

  const data = rows.map((r) => ({
    id: r.id,
    title: r.title,
    creator: r.creator,
    sourceUrl: r.sourceUrl,
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
});

export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ ok: false, message: 'The database is not configured yet.' }, { status: 503 });
  }
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ ok: false, message: 'Sign in required.' }, { status: 401 });

  const parsed = createRequestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ ok: false, message: 'Invalid recipe payload.' }, { status: 400 });
  const { draft, sourceUrl, collectionId } = parsed.data;

  const [recipe] = await db().insert(recipes).values({
    userId,
    title: draft.title,
    creator: draft.creator,
    sourceUrl,
    category: draft.category,
    prepMinutes: draft.prepMinutes,
    cookMinutes: draft.cookMinutes,
    servings: draft.servings != null ? String(draft.servings) : null,
    collectionId,
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

  return NextResponse.json({ ok: true, id: recipe.id });
}
