const YOUTUBE_ID_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtube\.com\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
];

export function extractYoutubeVideoId(url: string): string | null {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }
  if (!/(?:^|\.)youtube\.com$/.test(host) && !/(?:^|\.)youtu\.be$/.test(host)) return null;

  for (const pattern of YOUTUBE_ID_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/**
 * YouTube renders its video description via client-side JS — a plain HTML
 * fetch only ever sees a short, often-promotional <meta name="description">
 * snippet, never the full text with the actual recipe. The Data API's
 * videos.list returns the real description directly.
 */
export async function fetchYoutubeDescription(videoId: string): Promise<{ title: string; description: string } | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return null;

  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${apiKey}`;
  const response = await fetch(url);
  if (!response.ok) return null;

  const data = await response.json() as {
    items?: Array<{ snippet?: { title?: string; description?: string; channelTitle?: string } }>;
  };
  const snippet = data.items?.[0]?.snippet;
  if (!snippet?.description) return null;

  const title = snippet.channelTitle ? `${snippet.title} — ${snippet.channelTitle}` : (snippet.title ?? '');
  return { title, description: snippet.description };
}
