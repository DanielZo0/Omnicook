import { z } from "zod";
import { plannerRoute } from "@/lib/planner/http";
import { applyGeneration } from "@/lib/planner/generation-store";
export async function POST(request: Request) {
  return plannerRoute(async (userId) => {
    const { generationId, idempotencyKey } = z
      .object({
        generationId: z.string().uuid(),
        idempotencyKey: z.string().uuid(),
      })
      .strict()
      .parse(await request.json());
    return {
      state: await applyGeneration(userId, generationId, idempotencyKey),
    };
  });
}
