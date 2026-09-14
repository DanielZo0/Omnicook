import { GoogleGenAI } from '@google/genai';
import { EXTRACTION_SYSTEM_PROMPT, buildExtractionUserPrompt } from './prompt';
import { ExtractionProviderError } from './errors';

export async function extractWithGemini(sourceUrl: string | null, text: string): Promise<unknown> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new ExtractionProviderError('Gemini is not configured.');

  const model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
  const client = new GoogleGenAI({ apiKey });

  let content: string | undefined;
  try {
    const result = await client.models.generateContent({
      model,
      contents: buildExtractionUserPrompt(sourceUrl, text),
      config: {
        systemInstruction: EXTRACTION_SYSTEM_PROMPT,
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });
    content = result.text;
  } catch {
    throw new ExtractionProviderError('Could not reach Gemini.');
  }

  if (!content) throw new ExtractionProviderError('Gemini returned an empty response.');

  try {
    return JSON.parse(content);
  } catch {
    throw new ExtractionProviderError('Gemini returned malformed JSON.');
  }
}
