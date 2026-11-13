'use client';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
export function RetainedView({ name, label, active, children }: {
  name: string; label: string; active: boolean; children: ReactNode;
}) {
  const region = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    if (active) region.current?.focus({ preventScroll: true });
  }, [active]);
  return <section ref={region} data-retained-view={name} aria-label={label}
    tabIndex={-1} inert={!active} aria-hidden={!active}
    className={`retained-view${active ? '' : ' is-inactive'}`}>{children}</section>;
}
