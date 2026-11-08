import {
  createHash,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { z } from "zod";
import { safeSourceLink } from "../recipes/source-links";
export type Destinations = { discover: boolean; cookbookIds: string[] };
export const destinationsSchema = z
  .object({
    discover: z.boolean(),
    cookbookIds: z.array(z.string().uuid()).max(50),
  })
  .strict();
export function newToken() {
  return randomBytes(32).toString("base64url");
}
export function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
function key() {
  const secret =
    process.env.SOCIAL_TOKEN_SECRET || process.env.NEON_AUTH_COOKIE_SECRET;
  if (!secret) throw Error("Sharing encryption is not configured.");
  return createHash("sha256").update(secret).digest();
}
export function sealToken(value: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key(), iv);
  return [
    iv.toString("base64url"),
    Buffer.concat([cipher.update(value, "utf8"), cipher.final()]).toString(
      "base64url",
    ),
    cipher.getAuthTag().toString("base64url"),
  ].join(".");
}
export function openToken(value: string) {
  const [iv, text, tag] = value.split(".");
  const d = createDecipheriv(
    "aes-256-gcm",
    key(),
    Buffer.from(iv, "base64url"),
  );
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    d.update(Buffer.from(text, "base64url")),
    d.final(),
  ]).toString("utf8");
}
export function canRedistribute(
  copy: {
    restricted: boolean;
    sourceCookbookId: string | null;
    rootOwnerId: string;
  } | null,
  actorId: string,
  destinations: Destinations,
) {
  return (
    !copy?.restricted ||
    copy.rootOwnerId === actorId ||
    (!destinations.discover &&
      destinations.cookbookIds.every((id) => id === copy.sourceCookbookId))
  );
}
// SQL rows are internal; this explicit allowlist is the public/private boundary.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function publicRecipe(
  r: Record<string, any>,
  token: string,
  author: { id: string; name: string },
) {
  const metadata = r.photoMetadata || r.photo_metadata;
  return {
    attribution: r.attribution
      ? {
          title: r.attribution.title,
          author: {
            id: r.attribution.author?.id,
            name: r.attribution.author?.name,
          },
          sourceId: r.attribution.sourceId,
          sourceUrl: safeSourceLink(r.attribution.sourceUrl),
          originalRecipeUrl: safeSourceLink(r.attribution.originalRecipeUrl),
        }
      : null,
    id: r.id,
    title: r.title,
    creator: r.creator || null,
    author,
    sourceUrl: safeSourceLink(r.sourceUrl ?? r.source_url),
    originalRecipeUrl: safeSourceLink(
      r.originalRecipeUrl ?? r.original_recipe_url,
    ),
    category: r.category || "Other",
    cuisine: r.cuisine || null,
    prepMinutes: r.prepMinutes ?? r.prep_minutes ?? null,
    cookMinutes: r.cookMinutes ?? r.cook_minutes ?? null,
    servings: r.servings == null ? null : Number(r.servings),
    ingredients: (r.ingredients || []).map((i: Record<string, unknown>) => ({
      id: i.id,
      position: i.position,
      quantity: i.quantity ?? null,
      unit: i.unit ?? null,
      name: i.name,
      notes: i.notes ?? null,
      aisle: i.aisle || "Pantry",
    })),
    steps: (r.steps || []).map((i: Record<string, unknown>) => ({
      position: i.position,
      instruction: i.instruction,
    })),
    imageUrl:
      r.photoData || r.photo_data
        ? `/api/shared/${token}/photo`
        : safeSourceLink(r.imageUrl ?? r.image_url),
    photoMetadata: metadata
      ? {
          kind: metadata.kind,
          status: "ready",
          credit: metadata.credit || null,
          creditUrl: safeSourceLink(metadata.creditUrl),
          license: metadata.license || null,
          licenseUrl: safeSourceLink(metadata.licenseUrl),
        }
      : null,
    shareUrl: `/shared/${token}`,
  };
}
export function socialEnabled() {
  return process.env.SOCIAL_ENABLED === "true";
}
