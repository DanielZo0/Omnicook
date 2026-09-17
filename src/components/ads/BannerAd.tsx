'use client';

import { useEffect, useId, useRef } from 'react';
import { adUnitPath, isAdsEnabled, loadGpt } from '@/lib/ads/gpt';

type Props = {
  unit: string;
  sizes: googletag.GeneralSize;
  height: number;
};

export function BannerAd({ unit, sizes, height }: Props) {
  const rawId = useId();
  const divId = `ad-slot-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const slotRef = useRef<googletag.Slot | null>(null);

  useEffect(() => {
    if (!isAdsEnabled() || !unit) return;
    let cancelled = false;

    loadGpt().then((googletag) => {
      if (cancelled) return;
      googletag.cmd.push(() => {
        const slot = googletag.defineSlot(adUnitPath(unit), sizes, divId);
        if (!slot) return;
        slot.addService(googletag.pubads());
        slotRef.current = slot;
        googletag.enableServices();
        googletag.display(divId);
      });
    });

    return () => {
      cancelled = true;
      if (slotRef.current && typeof window !== 'undefined' && window.googletag) {
        window.googletag.cmd.push(() => window.googletag.destroySlots([slotRef.current!]));
        slotRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unit]);

  if (!isAdsEnabled() || !unit) return null;

  return <div id={divId} style={{ width: '100%', minHeight: height, display: 'flex', alignItems: 'center', justifyContent: 'center' }} />;
}
