import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, isDbConfigured } from '@/lib/db/client';
import { mealPlanItems, recipes } from '@/lib/db/schema';
import { requireUserId } from '@/lib/auth/require-user';

export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ ok: false, message: 'The database is not configured yet.' }, { status: 503 });
  }
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ ok: false, message: 'Sign in required.' }, { status: 401 });

  const rows = await db()
    .select({
      id: mealPlanItems.id,
      recipeId: mealPlanItems.recipeId,
      plannedFor: mealPlanItems.plannedFor,
      mealSlot: mealPlanItems.mealSlot,
      recipeTitle: recipes.title,
    })
    .from(mealPlanItems)
    .innerJoin(recipes, eq(recipes.id, mealPlanItems.recipeId))
    .where(eq(mealPlanItems.userId, userId))
    .orderBy(asc(mealPlanItems.plannedFor));

  return NextResponse.json({ ok: true, items: rows });
}

const upsertRequestSchema = z.object({
  recipeId: z.string().uuid(),
  plannedFor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealSlot: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
});

export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ ok: false, message: 'The database is not configured yet.' }, { status: 503 });
  }
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ ok: false, message: 'Sign in required.' }, { status: 401 });

  const parsed = upsertRequestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ ok: false, message: 'Invalid meal plan entry.' }, { status: 400 });
  const { recipeId, plannedFor, mealSlot } = parsed.data;

  await db().insert(mealPlanItems)
    .values({ userId, recipeId, plannedFor, mealSlot })
    .onConflictDoUpdate({
      target: [mealPlanItems.userId, mealPlanItems.plannedFor, mealPlanItems.mealSlot],
      set: { recipeId },
    });

  return NextResponse.json({ ok: true });
}
