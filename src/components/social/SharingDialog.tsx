"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { socialApi, type CommunityState } from "@/lib/social/client";
export function SocialDialog({
  title,
  onClose,
  children,
  notice,
}: {
  title: string;
  notice?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => {
      ref.current?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="social-dialog"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-label={title}
    >
      <header>
        <h2>{title}</h2>
        <button aria-label="Close" onClick={onClose}>
          ×
        </button>
      </header>
      {notice && <p role="alert">{notice}</p>}
      {children}
    </dialog>
  );
}
export function SharingDialog({
  recipeId,
  title,
  onClose,
}: {
  recipeId: string;
  title: string;
  onClose: () => void;
}) {
  const [state, setState] = useState<CommunityState | null>(null),
    [selected, setSelected] = useState<string[]>([]),
    [discover, setDiscover] = useState(false),
    [cuisine, setCuisine] = useState(""),
    [path, setPath] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(""),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    let live = true;
    Promise.all([
      socialApi<CommunityState>(),
      socialApi("sharing", { recipeId }),
    ])
      .then(([s, d]) => {
        if (live) {
          setState(s);
          setSelected(d.cookbookIds);
          setDiscover(d.discover);
          setCuisine(d.cuisine || "");
          setPath(d.path);
          setLoaded(true);
        }
      })
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [recipeId]);
  async function save() {
    setBusy(true);
    setError("");
    try {
      await socialApi("destinations", {
        recipeId,
        discover,
        cookbookIds: selected,
        cuisine,
      });
      const d = await socialApi("sharing", { recipeId });
      setPath(d.path);
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <SocialDialog title="Share something good" onClose={onClose}>
      <p>{title}</p>
      <p>
        Choose where this recipe belongs. Unselect every destination to keep it
        private.
      </p>
      {error && <p role="alert">{error}</p>}
      {!loaded && !error && <p role="status">Loading your cookbooks…</p>}
      {loaded && (
        <>
          <label className="destination">
            <input
              type="checkbox"
              checked={discover}
              disabled={!state?.publicPublishingReady && !discover}
              onChange={(e) => {
                setDiscover(e.target.checked);
                setSaved(false);
              }}
            />
            <span>
              <b>Discover</b>
              <small>
                Public, on your profile and readable by anyone with the link.
              </small>
            </span>
          </label>
          {!state?.publicPublishingReady && (
            <p>
              Public sharing is being set up. You can share privately with your
              cookbooks.
            </p>
          )}
          {discover && (
            <label>
              Cuisine (optional)
              <input
                value={cuisine}
                maxLength={60}
                placeholder="e.g. Italian"
                onChange={(e) => {
                  setCuisine(e.target.value);
                  setSaved(false);
                }}
              />
            </label>
          )}
          {state?.cookbooks.map((g) => (
            <label className="destination" key={g.id}>
              <input
                type="checkbox"
                checked={selected.includes(g.id)}
                onChange={(e) => {
                  setSelected(
                    e.target.checked
                      ? [...selected, g.id]
                      : selected.filter((x) => x !== g.id),
                  );
                  setSaved(false);
                }}
              />
              <span>
                <b>{g.name}</b>
                <small>Only members of this shared cookbook.</small>
              </span>
            </label>
          ))}
          {state?.cookbooks.length === 0 && (
            <p>Create or join a shared cookbook in Community → Family.</p>
          )}
          <button className="primary-button" disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Save sharing"}
          </button>
          {saved && <p role="status">Sharing saved.</p>}
          {path && (
            <div className="social-link">
              <label>
                Public recipe link
                <input
                  readOnly
                  value={
                    typeof window === "undefined"
                      ? path
                      : window.location.origin + path
                  }
                />
              </label>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      window.location.origin + path,
                    );
                    setSaved(true);
                  } catch {
                    setError("Select and copy the link above.");
                  }
                }}
              >
                Copy link
              </button>
            </div>
          )}
        </>
      )}
    </SocialDialog>
  );
}
