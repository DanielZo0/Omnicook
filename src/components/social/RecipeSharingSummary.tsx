"use client";
import { useEffect, useState } from "react";
import { socialApi, type CommunityState } from "@/lib/social/client";
export function RecipeSharingSummary({ recipeId }: { recipeId: string }) {
  const [summary, setSummary] = useState<any>(null);
  useEffect(() => {
    let live = true;
    Promise.all([
      socialApi<CommunityState>(),
      socialApi("sharing", { recipeId }),
    ])
      .then(([s, d]) => {
        if (live)
          setSummary({
            ...d,
            names: s.cookbooks
              .filter((b) => d.cookbookIds.includes(b.id))
              .map((b) => b.name),
          });
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [recipeId]);
  if (!summary) return null;
  return (
    <div className="recipe-sharing-summary">
      {summary.attribution && (
        <p>
          Adapted from <b>{summary.attribution.title}</b> by{" "}
          {summary.attribution.author.name}. Your changes belong to this copy.
        </p>
      )}
      <div>
        {summary.discover && <span>Public · Discover</span>}
        {summary.names.map((name: string) => (
          <span key={name}>Private · {name}</span>
        ))}
        {!summary.discover && !summary.names.length && (
          <span>Private to you</span>
        )}
      </div>
    </div>
  );
}
