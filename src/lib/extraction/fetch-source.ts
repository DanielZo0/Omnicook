import { extractYoutubeVideoId, fetchYoutubeDescription } from './youtube';

const FETCH_TIMEOUT_MS = 8_000;
// Trimmed down from 20,000: real blog pages are mostly nav/ads/comments once
// tags are stripped, and a smaller prompt is both faster and more focused for
// the extraction model.
const MAX_TEXT_CHARS = 10_000;

function looksLikeUrl(source: string) {
  try {
    const url = new URL(source);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function decodeEntities(text: string) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

// Instagram/Facebook/X/Pinterest (and similar) render an empty JS shell for
// logged-out scrapers — the actual content only exists in og: <meta> attributes,
// which a plain tag-strip would discard. Pull both title and description out
// first so social-media imports (including pin.it short links) have real content.
function extractMetaTags(html: string): { title: string; description: string; image: string } {
  const findContent = (pattern: RegExp) => {
    const m = html.match(pattern);
    return m ? decodeEntities(m[1]).trim() : '';
  };
  const title =
    findContent(/<meta[^>]+property=["']og:title["'][^>]*content=["']([\s\S]*?)["'][^>]*\/?>/i) ||
    findContent(/<meta[^>]+content=["']([\s\S]*?)["'][^>]*property=["']og:title["'][^>]*\/?>/i) ||
    findContent(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const description =
    findContent(/<meta[^>]+(?:property|name)=["'](?:og:description|description)["'][^>]*content=["']([\s\S]*?)["'][^>]*\/?>/i) ||
    findContent(/<meta[^>]+content=["']([\s\S]*?)["'][^>]*(?:property|name)=["'](?:og:description|description)["'][^>]*\/?>/i);
  const image =
    findContent(/<meta[^>]+property=["']og:image["'][^>]*content=["']([\s\S]*?)["'][^>]*\/?>/i) ||
    findContent(/<meta[^>]+content=["']([\s\S]*?)["'][^>]*property=["']og:image["'][^>]*\/?>/i);
  return { title, description, image };
}

function stripHtmlToText(html: string) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<[^>]+>/g, ' '),
  ).replace(/\s+/g, ' ').trim();
}

export type ExtractedSource = {
  sourceUrl: string | null;
  imageUrl: string | null;
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
    return { sourceUrl: null, imageUrl: null, text: trimmed.slice(0, MAX_TEXT_CHARS) };
  }

  const videoId = extractYoutubeVideoId(trimmed);
  if (videoId) {
    const video = await fetchYoutubeDescription(videoId).catch(() => null);
    if (video) {
      const text = `${video.title}\n\n${video.description}`.slice(0, MAX_TEXT_CHARS);
      return { sourceUrl: trimmed, imageUrl: null, text };
    }
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
      return { sourceUrl: trimmed, imageUrl: null, text: trimmed };
    }
    const html = await response.text();
    const { title, description, image } = extractMetaTags(html);
    const bodyText = stripHtmlToText(html);
    // Build a meta prefix from og:title + og:description; for JS-rendered pages
    // (Pinterest, Instagram, etc.) this is often the only meaningful content.
    const metaPrefix = [title, description].filter(Boolean).join('\n\n');
    const combined = metaPrefix && !bodyText.includes(metaPrefix.slice(0, 40))
      ? `${metaPrefix}\n\n${bodyText}`
      : bodyText || metaPrefix;
    const text = combined.slice(0, MAX_TEXT_CHARS);
    const imageUrl = image || null;
    return { sourceUrl: trimmed, imageUrl, text: text || trimmed };
  } catch {
    return { sourceUrl: trimmed, imageUrl: null, text: trimmed };
  } finally {
    clearTimeout(timeout);
  }
}
