"use client";
import { useEffect, useRef, useState } from "react";
export function KitchenAwake() {
  const [enabled, setEnabled] = useState(false),
    [message, setMessage] = useState("");
  const sentinel = useRef<WakeLockSentinel | null>(null);
  useEffect(() => {
    let live = true;
    async function request() {
      if (!enabled || document.visibilityState !== "visible") return;
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (!live) {
          await lock.release();
          return;
        }
        sentinel.current = lock;
      } catch {
        setEnabled(false);
        setMessage("Screen awake is unavailable.");
      }
    }
    request();
    document.addEventListener("visibilitychange", request);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", request);
      sentinel.current?.release();
      sentinel.current = null;
    };
  }, [enabled]);
  return (
    <div className="kitchen-awake">
      <label>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Keep screen awake while cooking
      </label>
      {message && <small role="status">{message}</small>}
    </div>
  );
}
