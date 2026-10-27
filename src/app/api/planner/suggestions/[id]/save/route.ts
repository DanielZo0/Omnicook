import { z } from "zod";
import { plannerRoute } from "@/lib/planner/http";
import { saveSuggestionToCookbook } from "@/lib/suggestions/repository";
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return plannerRoute(async (userId) =>
    saveSuggestionToCookbook(
      userId,
      z
        .string()
        .uuid()
        .parse((await params).id),
    ),
  );
}
