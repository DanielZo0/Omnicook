'use client';

import { useRef, useState } from 'react';
import { GAM_INTERSTITIAL_EVERY_N, isAdsEnabled } from '@/lib/ads/gpt';

export function useInterstitial() {
  const countRef = useRef(0);
  const pendingRef = useRef<(() => void) | null>(null);
  const [open, setOpen] = useState(false);

  function guardNavigate(next: () => void) {
    if (!isAdsEnabled()) { next(); return; }
    countRef.current += 1;
    if (countRef.current % GAM_INTERSTITIAL_EVERY_N === 0) {
      pendingRef.current = next;
      setOpen(true);
    } else {
      next();
    }
  }

  function closeInterstitial() {
    setOpen(false);
    const next = pendingRef.current;
    pendingRef.current = null;
    if (next) next();
  }

  return { interstitialOpen: open, guardNavigate, closeInterstitial };
}
