import { EXTRACTION_SYSTEM_PROMPT, buildExtractionUserPrompt } from './prompt';
import { ExtractionProviderError } from './errors';

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 20_000;

export async function extractWithGroq(sourceUrl: string | null, text: string): Promise<unknown> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new ExtractionProviderError('Groq is not configured.');

  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
          { role: 'user', content: buildExtractionUserPrompt(sourceUrl, text) },
        ],
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ExtractionProviderError('Groq did not respond in time.');
    }
    throw new ExtractionProviderError('Could not reach Groq.');
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 429) {
    throw new ExtractionProviderError('Groq rate limit reached. Try again shortly.');
  }
  if (!response.ok) {
    throw new ExtractionProviderError(`Groq request failed (${response.status}).`);
  }

  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new ExtractionProviderError('Groq returned an empty response.');

  try {
    return JSON.parse(content);
  } catch {
    throw new ExtractionProviderError('Groq returned malformed JSON.');
  }
}
