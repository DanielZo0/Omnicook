'use client';

import { createAuthClient } from '@neondatabase/neon-js/auth';

/** Baked in at build time from NEXT_PUBLIC_NEON_AUTH_BASE_URL — constant for a given deployment. */
export const AUTH_CONFIGURED = Boolean(process.env.NEXT_PUBLIC_NEON_AUTH_BASE_URL);

// Same rationale as src/lib/auth/server.ts: the Better Auth client's type is
// deep enough to crash tsc if inferred. `any` here is deliberate.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cached: any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function authClient(): any {
  // Talk to our own same-origin proxy (src/app/api/auth/[...path]/route.ts),
  // not NEON_AUTH_BASE_URL directly — that's a different origin, so cookies
  // set there would never reach this app's domain.
  cached ??= createAuthClient(`${window.location.origin}/api/auth`);
  return cached;
}
