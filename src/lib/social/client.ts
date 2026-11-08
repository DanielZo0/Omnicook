export type SocialIngredient = {
  id: string;
  position: number;
  quantity: string | null;
  unit: string | null;
  name: string;
  notes: string | null;
  aisle: string;
};
export type SharedRecipe = {
  isContributor?: boolean;
  attribution?: {
    title: string;
    author: { id: string; name: string };
    sourceId: string;
    sourceUrl: string | null;
    originalRecipeUrl: string | null;
  } | null;
  id: string;
  title: string;
  creator: string | null;
  author: { id: string; name: string };
  sourceUrl: string | null;
  originalRecipeUrl: string | null;
  category: string;
  prepMinutes: number | null;
  cookMinutes: number | null;
  servings: number | null;
  ingredients: SocialIngredient[];
  steps: { position: number; instruction: string }[];
  imageUrl: string | null;
  shareUrl: string | null;
  revision?: string;
  photoMetadata: {
    kind: string;
    credit: string | null;
    creditUrl: string | null;
    license: string | null;
    licenseUrl: string | null;
  } | null;
  likes?: number;
  liked?: boolean;
  alternatives?: {
    id: string;
    ingredient_id: string;
    author_id: string;
    canRemove?: boolean;
    quantity: string | null;
    unit: string | null;
    name: string;
    note: string;
    endorsed: boolean;
  }[];
};
export type CommunityState = {
  publicId: string;
  userId: string;
  isModerator: boolean;
  publicPublishingReady: boolean;
  profile: {
    public_id: string;
    display_name: string;
    bio: string;
    hidden: boolean;
  } | null;
  cookbooks: {
    id: string;
    name: string;
    owner_id: string;
    role: string;
    member_count: number;
  }[];
  blocks: { id: string }[];
  following: { id: string }[];
};
export async function socialApi<T = any>(
  operation?: string,
  input: unknown = {},
): Promise<T> {
  const r = await fetch("/api/social", {
    method: operation ? "POST" : "GET",
    headers: operation ? { "Content-Type": "application/json" } : undefined,
    body: operation ? JSON.stringify({ operation, input }) : undefined,
    cache: "no-store",
  });
  const body = await r.json();
  if (!r.ok) throw Error(body.message || "Please try again.");
  return body;
}
