const FETCH_TIMEOUT_MS = 8_000;
const MAX_TEXT_CHARS = 20_000;

function looksLikeUrl(source: string) {
  try {
    const url = new URL(source);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function stripHtmlToText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type ExtractedSource = {
  sourceUrl: string | null;
  text: string;
};

/**
 * Resolves the pasted `source` into extraction-ready text. A URL is fetched
 * and reduced to readable text; plain text (a pasted caption) passes through
 * unchanged. Fetch failures fall back to using the raw source string so the
 * model still has something to work with, since many platforms block
 * unauthenticated scraping.
 */
export async function resolveSource(source: string): Promise<ExtractedSource> {
  const trimmed = source.trim();
  if (!looksLikeUrl(trimmed)) {
    return { sourceUrl: null, text: trimmed.slice(0, MAX_TEXT_CHARS) };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(trimmed, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; OmnicookBot/0.1)' },
    });
    const contentType = response.headers.get('content-type') ?? '';
    if (!response.ok || !contentType.includes('text/html')) {
      return { sourceUrl: trimmed, text: trimmed };
    }
    const html = await response.text();
    const text = stripHtmlToText(html).slice(0, MAX_TEXT_CHARS);
    return { sourceUrl: trimmed, text: text || trimmed };
  } catch {
    return { sourceUrl: trimmed, text: trimmed };
  } finally {
    clearTimeout(timeout);
  }
}
