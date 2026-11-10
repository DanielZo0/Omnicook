'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { authClient, AUTH_CONFIGURED } from '@/lib/auth/client';
import { useSession } from '@/lib/auth/session';
import { oauthErrorMessage } from '@/lib/auth/oauth-error';
import {returnPath} from '@/lib/auth/return-path';
import { s } from '@/lib/mobile/style';

const inputStyle = s('padding:14px 15px;border:1px solid var(--line);border-radius:14px;background:var(--surface);font-size:14px;box-sizing:border-box');
const actionStyle = s('padding:15px;border:0;border-radius:15px;background:var(--green);color:#fff;font-weight:700;font-size:14.5px');
const linkStyle = s('margin-top:10px;padding:10px;border:0;background:transparent;color:var(--muted);font-size:12.5px;font-weight:600');

export default function LoginPage() {
  const { user, loading: sessionLoading, refresh } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<'sign-in' | 'sign-up' | 'verify-email'>('sign-in');
  const verificationEmail = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMessage(oauthErrorMessage(new URLSearchParams(window.location.search).get('error')));
  }, []);

  useEffect(() => {
    if (!sessionLoading && user) window.location.replace(returnPath(new URLSearchParams(window.location.search).get('next')));
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
      window.location.replace(returnPath(new URLSearchParams(window.location.search).get('next')));
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
      const next = returnPath(new URLSearchParams(window.location.search).get('next'));
      const failure = new URL('/login', window.location.origin);
      if (next !== '/') failure.searchParams.set('next', next);
      const { error } = await authClient().signIn.social({
        provider: 'google',
        callbackURL: new URL(next, window.location.origin).href,
        errorCallbackURL: failure.href,
      });
      if (error) { setMessage(error.message ?? 'Could not start Google sign-in.'); setLoading(false); }
      // On success this redirects the browser to Google, so no further state change here.
    } catch {
      setMessage('Could not start Google sign-in.');
      setLoading(false);
    }
  }

  async function requestVerificationCode() {
    if (!AUTH_CONFIGURED || loading || !verificationEmail.current?.reportValidity()) return;
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await authClient().emailOtp.sendVerificationOtp({
        email: email.trim(),
        type: 'email-verification',
      });
      setMessage(error
        ? 'Could not request a code. Please wait a moment and try again.'
        : 'If this address has an Omnicook account, a code will arrive by email. Use the most recent code.');
      if (!error) setCode('');
    } catch {
      setMessage('Could not request a code. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  async function verifyEmail(event: FormEvent) {
    event.preventDefault();
    if (!AUTH_CONFIGURED || loading) return;
    setLoading(true);
    setMessage(null);
    try {
      const { error } = await authClient().emailOtp.verifyEmail({ email: email.trim(), otp: code.trim() });
      if (error) {
        setMessage('That code could not be verified. Check the email address and code, or request a new code.');
        return;
      }
      setCode('');
      setMode('sign-in');
      setMessage('Email verified. Try Continue with Google again, or sign in with your password.');
      void refresh();
    } catch {
      setMessage('Could not verify the code. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return <main className="login-screen">
    <div className="login-brand"><img src="/omnicook-mark.svg" width={46} height={46} alt="" /><span>omnicook.</span></div>
    <p className="login-intro">Private recipe vault</p>
    <h1>{mode === 'verify-email' ? 'Verify your email.' : mode === 'sign-in' ? 'Sign in to Omnicook.' : 'Create your account.'}</h1>

    {!AUTH_CONFIGURED && <p style={s('font-size:13px;color:var(--muted);text-align:center')}>Sign-in isn&apos;t configured for this deployment yet.</p>}

    {AUTH_CONFIGURED && mode === 'verify-email' && <>
      <form onSubmit={verifyEmail} style={s('display:flex;flex-direction:column;gap:10px')}>
        <label htmlFor="verification-email">Omnicook email address</label>
        <input id="verification-email" ref={verificationEmail} type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setCode(''); }} required disabled={loading} style={inputStyle} />
        <label htmlFor="verification-code">Verification code</label>
        <input id="verification-code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{4,12}" maxLength={12} required disabled={loading} style={inputStyle} />
        <button type="submit" disabled={loading} style={actionStyle}>{loading ? 'Please wait…' : 'Verify email'}</button>
        <button type="button" disabled={loading} onClick={requestVerificationCode} style={linkStyle}>Email me a new code</button>
      </form>
      <button type="button" disabled={loading} onClick={() => { setMode('sign-in'); setCode(''); setMessage(null); }} style={linkStyle}>Back to sign in</button>
    </>}

    {AUTH_CONFIGURED && mode !== 'verify-email' && <>
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
      <button type="button" onClick={() => { setMode('verify-email'); setPassword(''); setMessage(null); }} disabled={loading} style={linkStyle}>Enter an email verification code</button>
    </>}

    {message && <p role="status" style={s('margin-top:14px;font-size:12.5px;color:var(--muted);text-align:center')}>{message}</p>}
  </main>;
}
