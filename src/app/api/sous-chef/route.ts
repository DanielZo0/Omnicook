import { NextResponse } from 'next/server';
import { z } from 'zod';
import { selectChefProvider } from '@/lib/chef/provider';
import { ExtractionProviderError } from '@/lib/extraction/errors';

const requestSchema = z.object({
  question: z.string().trim().min(1).max(500),
  recipeTitle: z.string().max(180).optional(),
  ingredients: z.array(z.string()).max(60).optional(),
  steps: z.array(z.string()).max(60).optional(),
});

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: 'Ask a question first.' }, { status: 400 });
  }

  const ask = selectChefProvider();
  if (!ask) {
    return NextResponse.json({
      ok: false,
      message: 'The AI sous-chef needs GROQ_API_KEY or GEMINI_API_KEY configured.',
    }, { status: 503 });
  }

  const { question, recipeTitle, ingredients, steps } = parsed.data;
  const context = recipeTitle
    ? `Recipe: ${recipeTitle}\nIngredients: ${(ingredients ?? []).join(', ')}\nMethod: ${(steps ?? []).join(' ')}`
    : 'No specific recipe is open right now.';
  const systemPrompt = `You are Omnicook's AI sous-chef. Answer the home cook's question in 2-3 short, practical sentences, using the recipe context below when relevant.\n\n${context}`;

  try {
    const answer = await ask(systemPrompt, question);
    return NextResponse.json({ ok: true, answer: answer.trim() });
  } catch (error) {
    const message = error instanceof ExtractionProviderError ? error.message : 'The sous-chef could not respond right now.';
    return NextResponse.json({ ok: false, message }, { status: 502 });
  }
}
