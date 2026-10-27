import { plannerRoute } from "@/lib/planner/http";
import {
  getPlannerWeek,
  putPlanEntry,
  removePlanEntry,
} from "@/lib/planner/repository";
import {
  entryRequestSchema,
  deleteRequestSchema,
  dateSchema,
} from "@/lib/planner/schemas";
import { localToday } from "@/lib/planner/dates";
export async function GET(request: Request) {
  return plannerRoute(async (userId) => {
    const state = await getPlannerWeek(
      userId,
      dateSchema.parse(
        new URL(request.url).searchParams.get("week") || localToday(),
      ),
    );
    return {
      state,
      items: state.entries.map((e) => ({
        id: e.id,
        recipeId: e.source.kind === "recipe" ? e.source.recipeId : null,
        recipeTitle: e.recipe?.title || "Recipe unavailable",
        plannedFor: e.plannedFor,
        mealSlot: e.mealSlot,
      })),
    };
  });
}
export async function POST(request: Request) {
  return plannerRoute(async (userId) => ({
    state: await putPlanEntry(
      userId,
      entryRequestSchema.parse(await request.json()),
    ),
  }));
}
export async function DELETE(request: Request) {
  return plannerRoute(async (userId) => {
    const input = deleteRequestSchema.parse(await request.json());
    await removePlanEntry(userId, input.id, input.expectedRevision);
    return {};
  });
}
