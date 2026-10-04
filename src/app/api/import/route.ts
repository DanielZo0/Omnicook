import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recipeSchema } from '@/lib/recipe-schema';
import { resolveSource } from '@/lib/extraction/fetch-source';
import { selectExtractionProvider } from '@/lib/extraction/provider';
import { ExtractionProviderError } from '@/lib/extraction/errors';

const importRequestSchema = z.object({
  source: z.string().trim().min(4).max(20_000),
});

// NVIDIA's free-tier endpoint can take up to ~40s on a real web page; ask
// Vercel for headroom beyond its default function timeout.
export const maxDuration = 45;

export async function POST(request: Request) {
  const parsed = importRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: 'Paste a recipe URL or caption first.' }, { status: 400 });
  }

  const provider = selectExtractionProvider();
  if (!provider) {
    return NextResponse.json({
      ok: false,
      message: 'AI import is not configured yet. Add GROQ_API_KEY (or GEMINI_API_KEY) in the server environment to enable it.',
    }, { status: 503 });
  }

  const { sourceUrl, text } = await resolveSource(parsed.data.source);

  let raw: unknown;
  try {
    raw = await provider.extract(sourceUrl, text);
  } catch (error) {
    const message = error instanceof ExtractionProviderError
      ? error.message
      : 'The extraction provider failed unexpectedly.';
    return NextResponse.json({ ok: false, message }, { status: 502 });
  }

  const draft = recipeSchema.safeParse(raw);
  if (!draft.success) {
    return NextResponse.json({
      ok: false,
      message: 'The extracted recipe was incomplete or malformed. Try pasting the full caption instead of just a link.',
      issues: draft.error.issues.map((issue) => issue.message),
    }, { status: 422 });
  }

  return NextResponse.json({ ok: true, draft: draft.data, sourceUrl });
}
