"use client";
import { useState } from "react";
import { RecipeImage } from "../RecipeImage";
export function ActivityPhoto({
  id,
  hasPhoto,
  isMine,
  onSaved,
}: {
  id: string;
  hasPhoto: boolean;
  isMine: boolean;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div>
      {hasPhoto && (
        <RecipeImage
          className="activity-photo"
          src={`/api/social/activity/${id}/photo`}
          alt="Cooked dish shared with this cookbook"
        />
      )}
      {isMine && (
        <label className="activity-photo-upload">
          {busy
            ? "Saving…"
            : hasPhoto
              ? "Replace my cooking photo"
              : "Add my cooking photo"}
          <input
            type="file"
            accept="image/*"
            disabled={busy}
            onChange={async (e) => {
              const file = e.currentTarget.files?.[0];
              e.currentTarget.value = "";
              if (!file) return;
              setBusy(true);
              setError("");
              try {
                const r = await fetch(`/api/social/activity/${id}/photo`, {
                  method: "POST",
                  headers: { "Content-Type": file.type },
                  body: file,
                });
                const body = await r.json();
                if (!r.ok) throw Error(body.message);
                onSaved();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        </label>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
