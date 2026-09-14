import { ExtractionProviderError } from '@/lib/extraction/errors';

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const REQUEST_TIMEOUT_MS = 15_000;

async function askGroq(systemPrompt: string, question: string): Promise<string> {
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
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question },
        ],
      }),
    });
  } catch {
    throw new ExtractionProviderError('Could not reach Groq.');
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) throw new ExtractionProviderError(`Groq request failed (${response.status}).`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new ExtractionProviderError('Groq returned an empty response.');
  return content;
}

const NVIDIA_ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions';

async function askNvidia(systemPrompt: string, question: string): Promise<string> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new ExtractionProviderError('NVIDIA is not configured.');
  const model = process.env.NVIDIA_MODEL || 'nvidia/nemotron-3.5-lightning-30b-a3b';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(NVIDIA_ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question },
        ],
      }),
    });
  } catch {
    throw new ExtractionProviderError('Could not reach NVIDIA.');
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) throw new ExtractionProviderError(`NVIDIA request failed (${response.status}).`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new ExtractionProviderError('NVIDIA returned an empty response.');
  return content;
}

const XAI_ENDPOINT = 'https://api.x.ai/v1/chat/completions';

async function askXai(systemPrompt: string, question: string): Promise<string> {
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
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question },
        ],
      }),
    });
  } catch {
    throw new ExtractionProviderError('Could not reach xAI.');
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 403) throw new ExtractionProviderError('xAI rejected the request — check that the team has credits at console.x.ai.');
  if (!response.ok) throw new ExtractionProviderError(`xAI request failed (${response.status}).`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new ExtractionProviderError('xAI returned an empty response.');
  return content;
}

async function askGemini(systemPrompt: string, question: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new ExtractionProviderError('Gemini is not configured.');
  const { GoogleGenAI } = await import('@google/genai');
  const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const client = new GoogleGenAI({ apiKey });

  let text: string | undefined;
  try {
    const result = await client.models.generateContent({
      model,
      contents: question,
      config: { systemInstruction: systemPrompt, temperature: 0.4 },
    });
    text = result.text;
  } catch {
    throw new ExtractionProviderError('Could not reach Gemini.');
  }
  if (!text) throw new ExtractionProviderError('Gemini returned an empty response.');
  return text;
}

export type ChefAsk = (systemPrompt: string, question: string) => Promise<string>;

export function selectChefProvider(): ChefAsk | null {
  if (process.env.GROQ_API_KEY) return askGroq;
  if (process.env.NVIDIA_API_KEY) return askNvidia;
  if (process.env.XAI_API_KEY) return askXai;
  if (process.env.GEMINI_API_KEY) return askGemini;
  return null;
}
