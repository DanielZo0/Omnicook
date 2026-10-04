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

// Instagram/Facebook/X (and similar) render an empty JS shell for logged-out
// scrapers — the actual caption only exists in an og:description/description
// <meta> attribute, which a plain tag-strip would discard along with the tag
// itself. Pull it out first so social-media imports have real content to work with.
function extractMetaDescription(html: string) {
  const match = html.match(/<meta[^>]+(?:property|name)=["'](?:og:description|description)["'][^>]*content=["']([\s\S]*?)["'][^>]*\/?>/i)
    ?? html.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]*(?:property|name)=["'](?:og:description|description)["'][^>]*\/?>/i);
  return match ? decodeEntities(match[1]).trim() : '';
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

  const videoId = extractYoutubeVideoId(trimmed);
  if (videoId) {
    const video = await fetchYoutubeDescription(videoId).catch(() => null);
    if (video) {
      const text = `${video.title}\n\n${video.description}`.slice(0, MAX_TEXT_CHARS);
      return { sourceUrl: trimmed, text };
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
      return { sourceUrl: trimmed, text: trimmed };
    }
    const html = await response.text();
    const metaDescription = extractMetaDescription(html);
    const bodyText = stripHtmlToText(html);
    const combined = metaDescription && !bodyText.includes(metaDescription.slice(0, 40))
      ? `${metaDescription}\n\n${bodyText}`
      : bodyText;
    const text = combined.slice(0, MAX_TEXT_CHARS);
    return { sourceUrl: trimmed, text: text || trimmed };
  } catch {
    return { sourceUrl: trimmed, text: trimmed };
  } finally {
    clearTimeout(timeout);
  }
}
