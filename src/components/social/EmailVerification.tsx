"use client";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth/client";
export function EmailVerification({ email }: { email: string | null }) {
  const [verified, setVerified] = useState<boolean | null>(null),
    [sent, setSent] = useState(false),
    [code, setCode] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    let live = true;
    authClient()
      .getSession()
      .then(({ data }: { data: any }) => {
        if (live) setVerified(data?.user?.emailVerified === true);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [email]);
  if (!email || verified === null || verified) return null;
  async function send() {
    setBusy(true);
    setMessage("");
    try {
      const { error } = await authClient().emailOtp.sendVerificationOtp({
        email,
        type: "email-verification",
      });
      if (error)
        throw Error(error.message || "Could not send verification code.");
      setSent(true);
      setMessage("Check your email for a verification code.");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="email-verification">
      <h2>Verify your email</h2>
      <p>
        Confirm your address for email-bound cookbook invitations and moderation
        access.
      </p>
      <button className="outline-button" disabled={busy} onClick={send}>
        {busy
          ? "Please wait…"
          : sent
            ? "Send a new code"
            : "Send verification code"}
      </button>
      {sent && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setMessage("");
            try {
              const { error } = await authClient().emailOtp.verifyEmail({
                email,
                otp: code,
              });
              if (error)
                throw Error(error.message || "Could not verify this code.");
              setVerified(true);
              window.location.reload();
            } catch (e) {
              setMessage((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Verification code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoComplete="one-time-code"
              inputMode="numeric"
              required
              maxLength={12}
            />
          </label>
          <button className="primary-button" disabled={busy}>
            Verify email
          </button>
        </form>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
