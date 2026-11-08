import { readPublication } from "@/lib/social/service";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const r = await readPublication(token);
  return Response.json(
    r?.dto || { message: "This recipe is no longer shared." },
    { status: r ? 200 : 404, headers: { "Cache-Control": "no-store" } },
  );
}
