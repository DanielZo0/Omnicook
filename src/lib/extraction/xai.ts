import { EXTRACTION_SYSTEM_PROMPT, buildExtractionUserPrompt } from './prompt';
import { ExtractionProviderError } from './errors';

const XAI_ENDPOINT = 'https://api.x.ai/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 20_000;

export async function extractWithXai(sourceUrl: string | null, text: string): Promise<unknown> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new ExtractionProviderError('xAI is not configured.');

  const model = process.env.XAI_MODEL || 'grok-4';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(XAI_ENDPOINT, {
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
      throw new ExtractionProviderError('xAI did not respond in time.');
    }
    throw new ExtractionProviderError('Could not reach xAI.');
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 429) {
    throw new ExtractionProviderError('xAI rate limit reached. Try again shortly.');
  }
  if (response.status === 403) {
    throw new ExtractionProviderError('xAI rejected the request — check that the team has credits at console.x.ai.');
  }
  if (!response.ok) {
    throw new ExtractionProviderError(`xAI request failed (${response.status}).`);
  }

  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new ExtractionProviderError('xAI returned an empty response.');

  try {
    return JSON.parse(content);
  } catch {
    throw new ExtractionProviderError('xAI returned malformed JSON.');
  }
}
