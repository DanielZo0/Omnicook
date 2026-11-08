import { socialActor } from "@/lib/social/actor";
import { activityPhoto } from "@/lib/social/service";
import { photoResponse } from "@/lib/social/photo-response";
import { uuid } from "@/lib/social/commands";
import { normalizePhoto, MAX_PHOTO_INPUT } from "@/lib/photos/normalize";
import { readBounded } from "@/lib/photos/network";
import { PlannerError } from "@/lib/db/planner-transaction";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, { params }: Context) {
  try {
    const a = await socialActor();
    if (!a) return new Response(null, { status: 401 });
    const { id } = await params;
    return photoResponse(await activityPhoto(a, uuid.parse(id)));
  } catch {
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
export async function POST(request: Request, { params }: Context) {
  const a = await socialActor();
  if (!a)
    return Response.json({ message: "Sign in required." }, { status: 401 });
  const origin = request.headers.get("origin");
  if (
    origin &&
    new URL(origin).host !==
      (request.headers.get("host") || new URL(request.url).host)
  )
    return Response.json({ message: "Upload from Omnicook." }, { status: 403 });
  try {
    const { id } = await params;
    uuid.parse(id);
    const body = await readBounded(
      new Response(request.body, { headers: request.headers }),
      MAX_PHOTO_INPUT,
    );
    const image = await normalizePhoto(body);
    await activityPhoto(a, id, image.toString("base64"));
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json(
      {
        message:
          e instanceof PlannerError
            ? e.message
            : "Could not upload photo. Choose a JPEG, PNG, WebP or AVIF under 4 MB.",
      },
      { status: e instanceof PlannerError ? e.status : 400 },
    );
  }
}
