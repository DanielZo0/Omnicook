export type InstagramCarousel = { shortcode: string; slides: readonly (string | null)[] };

export type CarouselImage = {
  bytes: Uint8Array;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
};
export type CarouselTranscript = { text: string; preparationLines: string[]; bakeLine: string | null };
export type CarouselTranscriber = (image: CarouselImage, timeoutMs: number) => Promise<CarouselTranscript>;

export function instagramPostShortcode(url: URL): string | null {
  if (!/(?:^|\.)instagram\.com$/i.test(url.hostname)) return null;
  return url.pathname.match(/^\/p\/([\w-]+)\/?$/)?.[1] ?? null;
}

export function isInstagramImageUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 4096) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port
      && /(?:^|\.)(?:cdninstagram\.com|fbcdn\.net)$/i.test(url.hostname);
  } catch {
    return false;
  }
}

export function parseInstagramCarousel(
  shortcode: string,
  objects: Record<string, unknown>[],
): InstagramCarousel | null {
  const media = objects.find(object => (object.code === shortcode || object.shortcode === shortcode)
    && Array.isArray(object.carousel_media) && object.carousel_media.length > 0);
  if (!media || !Array.isArray(media.carousel_media)) return null;
  const slides = media.carousel_media.map(child => {
    if (child?.media_type !== 1 || !Array.isArray(child.image_versions2?.candidates)) return null;
    return child.image_versions2.candidates.map((candidate: { url?: unknown } | null) => candidate?.url)
      .find(isInstagramImageUrl) ?? null;
  });
  return { shortcode, slides };
}

export function selectCarouselSlide(input: URL, carousel: InstagramCarousel) {
  if (instagramPostShortcode(input) !== carousel.shortcode) return null;
  const [value, ...duplicates] = input.searchParams.getAll('img_index');
  if (duplicates.length || !value || !/^[1-9]\d*$/.test(value)) return null;
  const index = Number(value);
  const url = carousel.slides[index - 1];
  if (!url) return null;
  const sourceUrl = new URL(input.pathname, input.origin);
  sourceUrl.searchParams.set('img_index', value);
  return { index, url, sourceUrl: sourceUrl.href };
}
