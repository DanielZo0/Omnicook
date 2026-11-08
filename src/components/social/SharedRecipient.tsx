"use client";
import { SharedRecipeView } from "./SharedRecipeView";
import type { SharedRecipe } from "@/lib/social/client";
export function SharedRecipient({
  recipe,
  userId,
}: {
  recipe: SharedRecipe;
  userId?: string;
}) {
  return (
    <SharedRecipeView
      recipe={recipe}
      userId={userId}
      anonymous={!userId}
      onSaved={
        userId ? (id) => window.location.assign(`/?recipe=${id}`) : undefined
      }
      onAuthor={(id) =>
        window.location.assign(`/cooks/${encodeURIComponent(id)}`)
      }
    />
  );
}
