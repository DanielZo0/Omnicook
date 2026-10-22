import { z } from "zod";
import { plannerRoute } from "@/lib/planner/http";
import { analyzeRecipe } from "@/lib/nutrition/repository";
export const maxDuration = 60;
export async function POST(request: Request) {
  return plannerRoute(async (userId) => {
    const { recipeId, position } = z
      .object({ recipeId: z.string().uuid(),position:z.number().int().nonnegative().optional() })
      .parse(await request.json());
    return analyzeRecipe(userId, recipeId,undefined,position);
  });
}
