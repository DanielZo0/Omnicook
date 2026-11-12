'use client';
import type { ReactNode } from 'react';

/** Shared navigation control for recipe, import, cooking and profile screens. */
export function PreviewBack({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button type="button" className="sp-back" onClick={onClick}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6"/></svg><span>{children}</span></button>;
}
