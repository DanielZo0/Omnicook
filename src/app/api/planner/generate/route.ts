import { plannerRoute } from "@/lib/planner/http";
import { generationRequestSchema } from "@/lib/planner/schemas";
import { createGeneration } from "@/lib/planner/generation-store";
export const maxDuration = 60;
export async function POST(request: Request) {
  return plannerRoute(async (userId) => ({
    draft: await createGeneration(
      userId,
      generationRequestSchema.parse(await request.json()),
    ),
  }));
}
