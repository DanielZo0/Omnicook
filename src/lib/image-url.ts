import { z } from 'zod';

export function normalizeImageUrl(value: unknown, base?: string): string | null {
  if (typeof value !== 'string' || !value.trim() || value.length > 4096) return null;
  if (/^\/api\/recipes\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/photo(?:\?v=\d+)?$/i.test(value)) return value;
  try {
    const url = new URL(value.trim(), base);
    const host = url.hostname.toLowerCase();
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    if (!host.includes('.') || host.includes(':') || /(?:^|\.)(?:localhost|local|internal)$/.test(host)) return null;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      const [a, b] = host.split('.').map(Number);
      if (a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)) return null;
    }
    return url.href;
  } catch { return null; }
}

export const imageUrlSchema = z.string().max(4096).refine(value => /^https?:\/\//i.test(value) && normalizeImageUrl(value) !== null, 'Use a public http or https image URL.').nullable();
