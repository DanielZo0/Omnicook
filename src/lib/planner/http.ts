import "server-only";
import { requireUserId } from "../auth/require-user";
import { PlannerError } from "../db/planner-transaction";
import { ZodError } from "zod";
export async function plannerRoute(
  fn: (userId: string) => Promise<unknown>,
): Promise<Response> {
  const userId = await requireUserId();
  if (!userId)
    return Response.json(
      { ok: false, message: "Sign in required." },
      { status: 401 },
    );
  try {
    return Response.json({ ok: true, ...((await fn(userId)) as object) });
  } catch (e) {
    const status =
      e instanceof PlannerError ? e.status : e instanceof ZodError ? 400 : 503;
    return Response.json(
      {
        ok: false,
        message:
          e instanceof PlannerError
            ? e.message
            : e instanceof ZodError
              ? "Check the meal date, portions and settings."
              : "The planner could not complete this request. Please try again.",
      },
      { status },
    );
  }
}
