import { socialActor } from "@/lib/social/actor";
import { socialCommand, socialState } from "@/lib/social/service";
import { PlannerError } from "@/lib/db/planner-transaction";
import { readBounded } from "@/lib/photos/network";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
const headers = { "Cache-Control": "private, no-store" };
async function respond(run: () => Promise<unknown>) {
  try {
    return Response.json(await run(), { headers });
  } catch (e) {
    const status = e instanceof PlannerError ? e.status : 500;
    return Response.json(
      {
        message:
          status === 500
            ? "Community could not be loaded. Please try again."
            : (e as Error).message,
      },
      { status, headers },
    );
  }
}
export async function GET() {
  return respond(async () => {
    const actor = await socialActor();
    if (!actor) throw new PlannerError("Sign in required.", 401);
    return socialState(actor);
  });
}
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    return Response.json(
      { message: "Invalid request origin." },
      { status: 403, headers },
    );
  if (Number(request.headers.get("content-length") || 0) > 20000)
    return Response.json(
      { message: "Request too large." },
      { status: 413, headers },
    );
  return respond(async () => {
    const actor = await socialActor();
    if (!actor) throw new PlannerError("Sign in required.", 401);
    let text: string;
    try {
      text = (
        await readBounded(
          new Response(request.body, { headers: request.headers }),
          20000,
        )
      ).toString("utf8");
    } catch {
      throw new PlannerError("Request too large or empty.", 413);
    }
    let body;
    try {
      body = JSON.parse(text);
      if (
        !body ||
        typeof body !== "object" ||
        Array.isArray(body) ||
        typeof body.operation !== "string" ||
        Object.keys(body).some((k) => !["operation", "input"].includes(k))
      )
        throw Error("Invalid envelope");
    } catch {
      throw new PlannerError("Invalid request.", 400);
    }
    return socialCommand(actor, body.operation, body.input);
  });
}
