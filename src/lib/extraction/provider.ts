import { extractWithGroq } from './groq';
import { extractWithNvidia } from './nvidia';
import { extractWithXai } from './xai';
import { extractWithGemini } from './gemini';
import { recipeSchema } from '../recipe-schema';
import type { ExtractionOptions } from './prompt';

export type ExtractionProvider = {
  name: 'groq' | 'nvidia' | 'xai' | 'gemini';
  extract: (sourceUrl: string | null, text: string, options?: ExtractionOptions) => Promise<unknown>;
};

function withValidationRepair(provider: ExtractionProvider): ExtractionProvider {
  return {...provider, extract: async (sourceUrl, text, options) => {
    // A 40-second total AI budget plus the 14-second source budget fits the
    // route's 60-second limit. Never start an unbounded retry.
    const deadline = Date.now() + Math.min(40000, options?.timeoutMs ?? 40000);
    const raw = await provider.extract(sourceUrl, text, {...options, timeoutMs: Math.max(1, deadline - Date.now())});
    const parsed = recipeSchema.safeParse(raw);
    const refused = raw && typeof raw === 'object' && 'error' in raw;
    const remaining = deadline - Date.now();
    if (parsed.success || refused || remaining < 5000) return raw;
    const validationFeedback = parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    return provider.extract(sourceUrl, text, {timeoutMs: remaining, validationFeedback});
  }};
}

/**
 * Groq's free tier is preferred since it works from a deployed server with
 * no paid credentials. NVIDIA (build.nvidia.com, also free-tier) and xAI are
 * fallbacks, then Gemini last. Returns null when none are configured, so the
 * route stays fail-closed.
 */
export function selectExtractionProvider(): ExtractionProvider | null {
  if (process.env.GROQ_API_KEY) return withValidationRepair({ name: 'groq', extract: extractWithGroq });
  if (process.env.NVIDIA_API_KEY) return withValidationRepair({ name: 'nvidia', extract: extractWithNvidia });
  if (process.env.XAI_API_KEY) return withValidationRepair({ name: 'xai', extract: extractWithXai });
  if (process.env.GEMINI_API_KEY) return withValidationRepair({ name: 'gemini', extract: extractWithGemini });
  return null;
}
