import { z } from "zod";
import { plannerRoute } from "@/lib/planner/http";
import { analyzeRecipe } from "@/lib/nutrition/repository";
import { sourceRefSchema } from "@/lib/nutrition/types";
export const maxDuration = 60;
export async function POST(request: Request) {
  return plannerRoute(async (userId) => {
    const input = z
      .object({
        recipeId: z.string().uuid(),
        position: z.number().int().nonnegative(),
        foodRef: sourceRefSchema,
        expectedFingerprint: z.string().max(60000),
      })
      .parse(await request.json());
    return analyzeRecipe(userId, input.recipeId, input);
  });
}
