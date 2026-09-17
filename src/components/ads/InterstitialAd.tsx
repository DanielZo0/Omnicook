'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { adUnitPath, GAM_INTERSTITIAL_UNIT, isAdsEnabled, loadGpt } from '@/lib/ads/gpt';

const CLOSE_DELAY_MS = 3000;

type Props = {
  open: boolean;
  onClose: () => void;
};

export function InterstitialAd({ open, onClose }: Props) {
  const rawId = useId();
  const divId = `ad-slot-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const slotRef = useRef<googletag.Slot | null>(null);
  const [canClose, setCanClose] = useState(false);

  useEffect(() => {
    if (!open) { setCanClose(false); return; }
    if (!isAdsEnabled() || !GAM_INTERSTITIAL_UNIT) { onClose(); return; }

    let cancelled = false;
    loadGpt().then((googletag) => {
      if (cancelled) return;
      googletag.cmd.push(() => {
        const slot = googletag.defineSlot(adUnitPath(GAM_INTERSTITIAL_UNIT), [[300, 250], [320, 480]], divId);
        if (!slot) return;
        slot.addService(googletag.pubads());
        slotRef.current = slot;
        googletag.enableServices();
        googletag.display(divId);
      });
    });

    const timer = setTimeout(() => setCanClose(true), CLOSE_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (slotRef.current && typeof window !== 'undefined' && window.googletag) {
        window.googletag.cmd.push(() => window.googletag.destroySlots([slotRef.current!]));
        slotRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#1c241dee', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
    <div id={divId} style={{ width: 320, minHeight: 250, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fffdf8' }} />
    <button
      onClick={canClose ? onClose : undefined}
      disabled={!canClose}
      style={{ padding: '10px 20px', border: '1px solid #ffffff55', borderRadius: 20, background: 'transparent', color: '#fffdf8', fontSize: 13, fontWeight: 700, opacity: canClose ? 1 : 0.5 }}
    >
      {canClose ? 'Skip ad ✕' : 'Ad closes shortly…'}
    </button>
  </div>;
}
