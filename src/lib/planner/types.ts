import type { z } from "zod";
import type { preferencesSchema, slots } from "./schemas";
import type { NutritionEstimate, SourceRef } from "../nutrition/types";
export type MealSlot = (typeof slots)[number];
export type PlannerPreferences = z.infer<typeof preferencesSchema>;
export type StructuredIngredient = {
  position: number;
  quantity: string | null;
  unit: string | null;
  name: string;
  notes: string | null;
  aisle: "Produce" | "Dairy & chilled" | "Pantry";
};
export type PlannableRecipe = {
  key: string;
  title: string;
  ingredients: StructuredIngredient[];
  steps: { position: number; instruction: string }[];
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  category: string;
  imageUrl: string | null;
  imageLicence?: string;
  source:
    | { kind: "recipe"; recipeId: string }
    | { kind: "suggestion"; ref: SourceRef };
  revision: string;
  nutrition: NutritionEstimate;
  plantFoods: string[];
  fermentedFoods: string[];
  exclusionStatus: "eligible" | "excluded" | "unknown";
};
export type PlanEntry = {
  id: string;
  plannedFor: string;
  mealSlot: MealSlot;
  source:
    | { kind: "recipe"; recipeId: string }
    | { kind: "suggestion"; snapshotId: string };
  servings: number;
  locked: boolean;
  version: number;
  recipe?: PlannableRecipe;
};
export type PlannerState = {
  weekStart: string;
  revision: number;
  entries: PlanEntry[];
  preferences: PlannerPreferences;
  recipes: PlannableRecipe[];
  capabilities: { nutrition: boolean; suggestions: boolean };
};
export type GeneratedPlan = {
  id: string;
  ownerKey: string;
  expiresAt: number;
  baseRevision: number;
  preferenceVersion: number;
  recipeRevisions: Record<string, string>;
  entries: PlanEntry[];
  daySummaries: Record<string, import("../nutrition/targets").DaySummary>;
  unmetGoals: string[];
};
