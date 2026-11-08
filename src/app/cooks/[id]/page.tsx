import { readPublicProfile } from "@/lib/social/service";
import { RecipeImage } from "@/components/RecipeImage";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Cook profile · Omnicook",
  robots: { index: false, follow: false },
};
export default async function CookPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ offset?: string }>;
}) {
  const { id } = await params;
  const { offset: raw } = await searchParams;
  const offset = Math.max(0, Math.min(10000, Number(raw) || 0));
  const profile = await readPublicProfile(id, Math.floor(offset));
  return (
    <main className="social-standalone community-screen">
      <a className="wordmark" href="/">
        omnicook.
      </a>
      {profile ? (
        <>
          <header className="public-profile">
            <div className="profile-avatar">{profile.name.slice(0, 1)}</div>
            <div>
              <p className="social-eyebrow">Public kitchen</p>
              <h1>{profile.name}</h1>
              <p>{profile.bio}</p>
              <small>Recipes shared publicly to Discover.</small>
            </div>
          </header>
          <div className="community-cards">
            {profile.recipes.map((r) => (
              <article key={r.id}>
                <a href={r.shareUrl || "#"}>
                  <div className="community-card-photo">
                    <RecipeImage src={r.imageUrl || undefined} alt={r.title} />
                  </div>
                  <h3>{r.title}</h3>
                </a>
                <p>{r.category}</p>
              </article>
            ))}
          </div>
          {!profile.recipes.length && <p>No public recipes yet.</p>}
          <div className="social-inline">
            {offset > 0 && (
              <a
                href={`/cooks/${encodeURIComponent(id)}?offset=${Math.max(0, offset - 20)}`}
              >
                Previous recipes
              </a>
            )}
            {profile.hasMore && (
              <a
                href={`/cooks/${encodeURIComponent(id)}?offset=${offset + 20}`}
              >
                More recipes
              </a>
            )}
          </div>
        </>
      ) : (
        <h1>This cook profile is unavailable</h1>
      )}
    </main>
  );
}
