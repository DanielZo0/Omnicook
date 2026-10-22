'use client';

import { FormEvent, useEffect, useState } from 'react';
import { authClient, AUTH_CONFIGURED } from '@/lib/auth/client';
import { useSession } from '@/lib/auth/session';
import { s } from '@/lib/mobile/style';
import { KitchenIcon } from '@/components/KitchenIcon';

export default function LoginPage() {
  const { user, loading: sessionLoading } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sessionLoading && user) window.location.replace('/');
  }, [sessionLoading, user]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!AUTH_CONFIGURED || loading) return;
    setLoading(true);
    setMessage(null);
    try {
      const { error } = mode === 'sign-in'
        ? await authClient().signIn.email({ email, password })
        : await authClient().signUp.email({ email, password, name: name || email });
      if (error) { setMessage(error.message ?? 'That did not work.'); return; }
      window.location.replace('/');
    } catch {
      setMessage('Something went wrong. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function signInWithGoogle() {
    if (!AUTH_CONFIGURED || loading) return;
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await authClient().signIn.social({ provider: 'google', callbackURL: `${window.location.origin}/` });
      if (error) { setMessage(error.message ?? 'Could not start Google sign-in.'); setLoading(false); }
      // On success this redirects the browser to Google, so no further state change here.
    } catch {
      setMessage('Could not start Google sign-in.');
      setLoading(false);
    }
  }

  return <main className="login-screen">
    <div className="login-brand"><KitchenIcon name="book" size={28} />omnicook<span aria-hidden="true">✿</span></div>
    <p className="login-intro">Private recipe vault</p>
    <h1>{mode === 'sign-in' ? 'Sign in to Omnicook.' : 'Create your account.'}</h1>

    {!AUTH_CONFIGURED && <p style={s('font-size:13px;color:var(--muted);text-align:center')}>Sign-in isn&apos;t configured for this deployment yet.</p>}

    {AUTH_CONFIGURED && <>
      <button onClick={signInWithGoogle} disabled={loading} style={s('padding:14px;border:1px solid var(--line);border-radius:14px;background:var(--surface);color:var(--ink);font-weight:700;font-size:14px;margin-bottom:14px')}>Continue with Google</button>
      <div style={s('display:flex;align-items:center;gap:10px;margin-bottom:14px;color:var(--muted);font-size:11.5px')}>
        <span style={s('flex:1;height:1px;background:var(--line)')} />or<span style={s('flex:1;height:1px;background:var(--line)')} />
      </div>
      <form onSubmit={submit} style={s('display:flex;flex-direction:column;gap:10px')}>
        {mode === 'sign-up' && <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" aria-label="Name" disabled={loading} style={s('padding:14px 15px;border:1px solid var(--line);border-radius:14px;background:var(--surface);font-size:14px;box-sizing:border-box')} />}
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email address" required disabled={loading} style={s('padding:14px 15px;border:1px solid var(--line);border-radius:14px;background:var(--surface);font-size:14px;box-sizing:border-box')} />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" aria-label="Password" required minLength={8} disabled={loading} style={s('padding:14px 15px;border:1px solid var(--line);border-radius:14px;background:var(--surface);font-size:14px;box-sizing:border-box')} />
        <button type="submit" disabled={loading} style={s('padding:15px;border:0;border-radius:14px;background:var(--green);color:#fff;font-weight:700;font-size:14.5px')}>{loading ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}</button>
      </form>
      <button type="button" onClick={() => { setMode(mode === 'sign-in' ? 'sign-up' : 'sign-in'); setMessage(null); }} disabled={loading} style={s('margin-top:10px;padding:10px;border:0;background:transparent;color:var(--muted);font-size:12.5px;font-weight:600')}>{mode === 'sign-in' ? "Don't have an account? Create one" : 'Already have an account? Sign in'}</button>
    </>}

    {message && <p role="status" style={s('margin-top:14px;font-size:12.5px;color:var(--muted);text-align:center')}>{message}</p>}
  </main>;
}
