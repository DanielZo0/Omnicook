import { readPublication } from "@/lib/social/service";
import { photoResponse } from "@/lib/social/photo-response";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  return photoResponse((await readPublication(token))?.photo || null);
}
