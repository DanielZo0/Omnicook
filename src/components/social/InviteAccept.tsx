"use client";
import { useState } from "react";
import { useSession } from "@/lib/auth/session";
import { socialApi } from "@/lib/social/client";
export function InviteAccept({ token }: { token: string }) {
  const { user, loading } = useSession();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [joined, setJoined] = useState(false);
  return (
    <section>
      <h1>A seat at the family table</h1>
      <p>
        This invitation joins a private shared cookbook. Invitations can be used
        once and expire after seven days.
      </p>
      {loading ? (
        <p>Checking your account…</p>
      ) : user ? (
        <>
          <button
            className="primary-button"
            disabled={busy || joined}
            onClick={async () => {
              setBusy(true);
              try {
                await socialApi("acceptInvite", { token });
                setJoined(true);
                setMessage(
                  "You’ve joined the cookbook. Open Community → Family to find it.",
                );
              } catch (e) {
                setMessage((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            {joined ? "Cookbook joined" : busy ? "Joining…" : "Join cookbook"}
          </button>
          <p role="status">{message}</p>
          {joined && <a href="/">Open Omnicook</a>}
        </>
      ) : (
        <>
          <a
            className="primary-button"
            href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}
          >
            Sign in to join
          </a>
          <p>Keep this link to return after signing in.</p>
        </>
      )}
    </section>
  );
}
