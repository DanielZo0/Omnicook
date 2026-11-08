import { socialActor } from "@/lib/social/actor";
import { reportedPhoto } from "@/lib/social/service";
import { photoResponse } from "@/lib/social/photo-response";
import { uuid } from "@/lib/social/commands";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const a = await socialActor();
    if (!a) return new Response(null, { status: 401 });
    const { id } = await params;
    return photoResponse(await reportedPhoto(a, uuid.parse(id)));
  } catch {
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
