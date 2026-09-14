import { extractWithGroq } from './groq';
import { extractWithNvidia } from './nvidia';
import { extractWithXai } from './xai';
import { extractWithGemini } from './gemini';

export type ExtractionProvider = {
  name: 'groq' | 'nvidia' | 'xai' | 'gemini';
  extract: (sourceUrl: string | null, text: string) => Promise<unknown>;
};

/**
 * Groq's free tier is preferred since it works from a deployed server with
 * no paid credentials. NVIDIA (build.nvidia.com, also free-tier) and xAI are
 * fallbacks, then Gemini last. Returns null when none are configured, so the
 * route stays fail-closed.
 */
export function selectExtractionProvider(): ExtractionProvider | null {
  if (process.env.GROQ_API_KEY) return { name: 'groq', extract: extractWithGroq };
  if (process.env.NVIDIA_API_KEY) return { name: 'nvidia', extract: extractWithNvidia };
  if (process.env.XAI_API_KEY) return { name: 'xai', extract: extractWithXai };
  if (process.env.GEMINI_API_KEY) return { name: 'gemini', extract: extractWithGemini };
  return null;
}
