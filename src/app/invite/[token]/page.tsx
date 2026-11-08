import { InviteAccept } from "@/components/social/InviteAccept";
export const metadata = {
  title: "Cookbook invitation · Omnicook",
  robots: { index: false, follow: false },
};
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return (
    <main className="social-standalone">
      <a className="wordmark" href="/">
        omnicook.
      </a>
      {/^[-\w]{43}$/.test(token) ? (
        <InviteAccept token={token} />
      ) : (
        <h1>This invitation is invalid</h1>
      )}
    </main>
  );
}
