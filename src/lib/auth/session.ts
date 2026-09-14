'use client';

import { useCallback, useEffect, useState } from 'react';
import { AUTH_CONFIGURED, authClient } from './client';

export { AUTH_CONFIGURED };

export type SessionUser = { id: string; email: string | null };

/** Exposes { user, loading, refresh }. Fetches the session once on mount via
 * the Better Auth client and re-fetches on demand (call refresh() after a
 * sign-in/out that happened without a full navigation). */
export function useSession() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(AUTH_CONFIGURED);

  const refresh = useCallback(async () => {
    if (!AUTH_CONFIGURED) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await authClient().getSession();
      setUser(data?.user ? { id: data.user.id, email: data.user.email ?? null } : null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { user, loading, refresh };
}
