'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AUTH_CONFIGURED, authClient } from './client';

export { AUTH_CONFIGURED };

export type SessionUser = { id: string; email: string | null };

/** Recheck on foreground return: installed apps can resume after OAuth without remounting. */
export function useSession() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(AUTH_CONFIGURED);
  const checking = useRef(false);

  const refresh = useCallback(async (background = false) => {
    if (!AUTH_CONFIGURED) { setLoading(false); return; }
    if (checking.current) return;
    checking.current = true;
    if (!background) setLoading(true);
    try {
      const { data, error } = await authClient().getSession();
      if (error) {
        if (error.status === 401 || error.status === 403) { setUser(null); return; }
        throw error;
      }
      setUser(data?.user ? { id: data.user.id, email: data.user.email ?? null } : null);
    } catch {
      if (!background) setUser(null);
    } finally {
      checking.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    function resume() {
      if (document.visibilityState === 'visible') void refresh(true);
    }
    window.addEventListener('pageshow', resume);
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      window.removeEventListener('pageshow', resume);
      window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', resume);
    };
  }, [refresh]);

  return { user, loading, refresh };
}
