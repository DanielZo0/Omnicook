'use client';

import { useState, type ImgHTMLAttributes } from 'react';
import { normalizeImageUrl } from '@/lib/image-url';

export function RecipeImage({src, alt = '', ...props}: ImgHTMLAttributes<HTMLImageElement>) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const safeSource = normalizeImageUrl(src);
  const fallback = !safeSource || failedSource === src;
  return <img {...props} src={fallback ? '/recipe-placeholder.svg' : safeSource!}
    alt={fallback ? 'Recipe photo not available' : alt} referrerPolicy="no-referrer"
    onError={() => { if (typeof src === 'string' && !fallback) setFailedSource(src); }} />;
}
