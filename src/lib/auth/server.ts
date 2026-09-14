import 'server-only';
import { createNeonAuth } from '@neondatabase/auth/next/server';

export function isAuthConfigured() {
  return Boolean(process.env.NEON_AUTH_BASE_URL && process.env.NEON_AUTH_COOKIE_SECRET);
}

// The Better Auth-generated instance has an extremely deep/recursive type that
// crashes Next's route-handler type-checker (`Maximum call stack size exceeded`
// in tsc) if it's ever inferred instead of erased. `any` here is deliberate.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cached: any;

/** Server-only: throws if Neon Auth isn't configured — always guard with isAuthConfigured() first. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function neonAuth(): any {
  if (!isAuthConfigured()) {
    throw new Error('Neon Auth is not configured. Set NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET.');
  }
  cached ??= createNeonAuth({
    baseUrl: process.env.NEON_AUTH_BASE_URL!,
    cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET! },
  });
  return cached;
}
