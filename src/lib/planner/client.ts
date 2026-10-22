"use client";
import type {
  PlannerState,
  PlanEntry,
  PlannerPreferences,
  GeneratedPlan,
  MealSlot,
} from "./types";
import type {
  FoodCandidate,
  NutritionEstimate,
  SourceRef,
} from "../nutrition/types";
export async function plannerApi<T>(
  url: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok || data.ok === false)
    throw Error(data.message || "Could not update your plan.");
  return data;
}
export const plannerClient = {
  load: (week: string) =>
    plannerApi<{ state: PlannerState }>(`/api/meal-plan?week=${week}`),
  put: (input: {
    recipeId: string;
    plannedFor: string;
    mealSlot: MealSlot;
    servings: number;
    locked: boolean;
    expectedRevision: number;
  }) => plannerApi<{ state: PlannerState }>("/api/meal-plan", input),
  remove: (id: string, expectedRevision: number) =>
    plannerApi("/api/meal-plan", { id, expectedRevision }, "DELETE"),
  preferences: (preferences: PlannerPreferences) =>
    plannerApi<{ preferences: PlannerPreferences }>(
      "/api/planner/preferences",
      preferences,
      "PUT",
    ),
  generate: (input: unknown) =>
    plannerApi<{ draft: GeneratedPlan }>("/api/planner/generate", input),
  apply: (generationId: string, idempotencyKey: string) =>
    plannerApi<{ state: PlannerState }>("/api/planner/apply", {
      generationId,
      idempotencyKey,
    }),
  analyze: (recipeId: string, position?:number) =>
    plannerApi<AnalysisReview>("/api/nutrition/analyze", { recipeId,position }),
  match: (
    recipeId: string,
    position: number,
    foodRef: SourceRef,
    expectedFingerprint: string,
  ) =>
    plannerApi<AnalysisReview>("/api/nutrition/matches", {
      recipeId,
      position,
      foodRef,
      expectedFingerprint,
    }),
  saveSuggestion: (id: string) =>
    plannerApi<{ recipeId: string }>(`/api/planner/suggestions/${id}/save`, {}),
};
export type AnalysisReview = {
  estimate: NutritionEstimate;
  candidates: {
    ingredient: { position: number; name: string };
    candidates: FoodCandidate[];
    message?: string;
  }[];
  remaining: number;
};
