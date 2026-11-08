import { socialActor } from "@/lib/social/actor";
import { readFamilyPhoto } from "@/lib/social/service";
import { uuid } from "@/lib/social/commands";
import { photoResponse } from "@/lib/social/photo-response";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const a = await socialActor();
    if (!a) return new Response(null, { status: 401 });
    const q = new URL(request.url).searchParams;
    const recipeId = uuid.parse(q.get("recipeId")),
      group = uuid.parse(q.get("cookbookId"));
    return photoResponse(await readFamilyPhoto(a, recipeId, group));
  } catch {
    return new Response(null, {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
