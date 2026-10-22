import { plannerRoute } from "@/lib/planner/http";
import { getPlannerWeek, savePreferences } from "@/lib/planner/repository";
import { preferencesSchema } from "@/lib/planner/schemas";
import { localToday } from "@/lib/planner/dates";
export async function GET() {
  return plannerRoute(async (userId) => ({
    preferences: (await getPlannerWeek(userId, localToday())).preferences,
  }));
}
export async function PUT(request: Request) {
  return plannerRoute(async (userId) => {
    const preferences = preferencesSchema.parse(await request.json());
    return {
      preferences: await savePreferences(
        userId,
        preferences,
        preferences.version,
      ),
    };
  });
}
