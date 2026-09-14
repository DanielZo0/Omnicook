import 'server-only';
import { isAuthConfigured, neonAuth } from './server';

/** Returns the signed-in user's id, or null if Neon Auth isn't configured or no one is signed in. */
export async function requireUserId(): Promise<string | null> {
  if (!isAuthConfigured()) return null;
  const { data } = await neonAuth().getSession();
  const id: unknown = data?.user?.id;
  return typeof id === 'string' ? id : null;
}
