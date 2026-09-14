import { EXTRACTION_SYSTEM_PROMPT, buildExtractionUserPrompt } from './prompt';
import { ExtractionProviderError } from './errors';

const NVIDIA_ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 20_000;

export async function extractWithNvidia(sourceUrl: string | null, text: string): Promise<unknown> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new ExtractionProviderError('NVIDIA is not configured.');

  // nemotron-3-super-120b-a12b (an earlier default) is deprecated 2026-10-02;
  // meta/llama-3.3-70b-instruct (a later default) doesn't actually exist in the
  // current catalog at all. nemotron-3.5-lightning-30b-a3b is live, Free-Endpoint,
  // and its model page confirms Structured Output: Supported.
  const model = process.env.NVIDIA_MODEL || 'nvidia/nemotron-3.5-lightning-30b-a3b';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(NVIDIA_ENDPOINT, {
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
        // This model reasons at length by default (100+ tokens even for a
        // trivial prompt), which blew past every timeout tried. Disabling it
        // dropped a real extraction call from 55s+ (timing out) to under 2s.
        chat_template_kwargs: { enable_thinking: false },
        messages: [
          { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
          { role: 'user', content: buildExtractionUserPrompt(sourceUrl, text) },
        ],
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ExtractionProviderError('NVIDIA did not respond in time.');
    }
    throw new ExtractionProviderError('Could not reach NVIDIA.');
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 429) {
    throw new ExtractionProviderError('NVIDIA rate limit reached. Try again shortly.');
  }
  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw new ExtractionProviderError(`NVIDIA request failed (${response.status}): ${bodyText.slice(0, 500)}`);
  }

  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new ExtractionProviderError('NVIDIA returned an empty response.');

  // This model supports reasoning mode; even with response_format set, strip a
  // leading <think>...</think> trace or markdown code fence defensively.
  const stripped = content.trim()
    .replace(/^<think>[\s\S]*?<\/think>\s*/i, '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '');

  try {
    return JSON.parse(stripped);
  } catch {
    throw new ExtractionProviderError('NVIDIA returned malformed JSON.');
  }
}
