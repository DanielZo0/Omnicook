import type { CSSProperties, ReactNode } from 'react';

export type KitchenIconName = 'book' | 'calendar' | 'basket' | 'user' | 'search' | 'plus' | 'arrow' | 'clock' | 'grid' | 'list' | 'spark' | 'chevron' | 'leaf' | 'edit' | 'trash';
const paths: Record<KitchenIconName, ReactNode> = {
  edit: <><path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14v6Z" /></>,
  trash: <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" /></>,
  book: <><path d="M12 5c-3-2-6-2-9-1v15c3-1 6-1 9 1 3-2 6-2 9-1V4c-3-1-6-1-9 1Z" /><path d="M12 5v15M6 8h3M6 12h3M15 8h3M15 12h3" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M7 3v4m10-4v4M3 11h18m-13 4h1m6 0h1m-8 3h1" /></>,
  basket: <><path d="m3 9 2 11h14l2-11H3Zm4 0 4-6m6 6-4-6M9 13v3m6-3v3" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  grid: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
  list: <><path d="M10 6h10M10 12h10M10 18h10M4 6h1M4 12h1M4 18h1" /></>,
  spark: <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" />,
  chevron: <path d="m9 5 7 7-7 7" />,
  leaf: <><path d="M20 4C6 2 2 9 6 15s15 1 14-11Z" /><path d="M4 21 15 10" /></>,
};
export function KitchenIcon({ name, size = 22, style }: { name: KitchenIconName; size?: number; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, ...style }}>{paths[name]}</svg>;
}
