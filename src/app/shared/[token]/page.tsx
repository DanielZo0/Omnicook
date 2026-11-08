import { readPublication } from "@/lib/social/service";
import { SharedRecipient } from "@/components/social/SharedRecipient";
import { socialActor } from "@/lib/social/actor";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Shared recipe · Omnicook",
  robots: { index: false, follow: false },
};
export default async function SharedPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const publication = await readPublication(token);
  const actor = await socialActor();
  return (
    <main className="social-standalone">
      <a className="wordmark" href="/">
        omnicook.
      </a>
      {publication ? (
        <SharedRecipient recipe={publication.dto} userId={actor?.userId} />
      ) : (
        <section>
          <h1>This recipe is no longer shared</h1>
          <p>The contributor may have made it private or removed it.</p>
          <a href="/">Back to Omnicook</a>
        </section>
      )}
    </main>
  );
}
