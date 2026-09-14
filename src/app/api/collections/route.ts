import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db, isDbConfigured } from '@/lib/db/client';
import { collections } from '@/lib/db/schema';
import { requireUserId } from '@/lib/auth/require-user';

export async function GET() {
  if (!isDbConfigured()) {
    return NextResponse.json({ ok: false, message: 'The database is not configured yet.' }, { status: 503 });
  }
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ ok: false, message: 'Sign in required.' }, { status: 401 });

  const rows = await db().select({ id: collections.id, name: collections.name }).from(collections)
    .where(eq(collections.userId, userId)).orderBy(asc(collections.createdAt));
  return NextResponse.json({ ok: true, collections: rows });
}

const createRequestSchema = z.object({ name: z.string().trim().min(1).max(60) });

export async function POST(request: Request) {
  if (!isDbConfigured()) {
    return NextResponse.json({ ok: false, message: 'The database is not configured yet.' }, { status: 503 });
  }
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ ok: false, message: 'Sign in required.' }, { status: 401 });

  const parsed = createRequestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ ok: false, message: 'Give the collection a name.' }, { status: 400 });

  try {
    const [collection] = await db().insert(collections)
      .values({ userId, name: parsed.data.name })
      .returning({ id: collections.id, name: collections.name });
    return NextResponse.json({ ok: true, collection });
  } catch {
    return NextResponse.json({ ok: false, message: 'You already have a collection with that name.' }, { status: 409 });
  }
}
