const GPT_SCRIPT_SRC = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js';

export const GAM_NETWORK_CODE = process.env.NEXT_PUBLIC_GAM_NETWORK_CODE ?? '';
export const GAM_BANNER_TABBAR_UNIT = process.env.NEXT_PUBLIC_GAM_BANNER_TABBAR_UNIT ?? '';
export const GAM_BANNER_DETAIL_UNIT = process.env.NEXT_PUBLIC_GAM_BANNER_DETAIL_UNIT ?? '';
export const GAM_INTERSTITIAL_UNIT = process.env.NEXT_PUBLIC_GAM_INTERSTITIAL_UNIT ?? '';
export const GAM_INTERSTITIAL_EVERY_N = Math.max(1, Number(process.env.NEXT_PUBLIC_GAM_INTERSTITIAL_EVERY_N) || 6);

export function isAdsEnabled(): boolean {
  return GAM_NETWORK_CODE.trim().length > 0;
}

export function adUnitPath(unit: string): string {
  return `/${GAM_NETWORK_CODE}/${unit}`;
}

/** Injects the Google Publisher Tag script once and resolves when googletag.cmd is ready. */
export function loadGpt(): Promise<typeof window.googletag> {
  if (typeof window === 'undefined') return Promise.reject(new Error('loadGpt() must run in the browser'));

  window.googletag = window.googletag || ({ cmd: [] } as unknown as typeof window.googletag);

  return new Promise((resolve) => {
    if (document.querySelector(`script[src="${GPT_SCRIPT_SRC}"]`)) {
      window.googletag.cmd.push(() => resolve(window.googletag));
      return;
    }
    const script = document.createElement('script');
    script.async = true;
    script.src = GPT_SCRIPT_SRC;
    document.head.appendChild(script);
    window.googletag.cmd.push(() => resolve(window.googletag));
  });
}
