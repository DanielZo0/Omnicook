import type { NutritionEstimate, Nutrients } from "./types";
import { emptyNutrients, nutrientNames } from "./types";
import type { PlannerPreferences } from "../planner/types";
export type DaySummary = {
  nutrients: Nutrients;
  targetsMet: boolean;
  complete: boolean;
  messages: string[];
};
export function evaluateDay(
  entries: {
    servings: number;
    recipe?: { servings: number | null; nutrition: NutritionEstimate };
  }[],
  p: PlannerPreferences,
  fullDay: boolean,
): DaySummary {
  const nutrients = emptyNutrients();
  let complete = entries.length > 0;
  const messages: string[] = [];
  for (const name of nutrientNames) {
    let min = 0,
      max = 0,
      known = entries.length > 0;
    for (const entry of entries) {
      const r = entry.recipe,
        n = r?.nutrition.nutrients[name];
      if (!r?.servings || !n || r.nutrition.status !== "complete") {
        known = false;
        complete = false;
        continue;
      }
      min += (n.min * entry.servings) / r.servings;
      max += (n.max * entry.servings) / r.servings;
    }
    if (known) nutrients[name] = { min, max };
  }
  // Optional carbohydrate/fat gaps do not invalidate resolved energy/protein/fibre.
  complete =
    entries.length > 0 &&
    entries.every(
      (e) => e.recipe?.nutrition.status === "complete" && !!e.recipe.servings,
    ) &&
    ["kcal", "proteinG", "fibreG"].every(
      (k) => nutrients[k as keyof Nutrients] !== null,
    );
  const within =
    p.kcalTarget === null ||
    (!!nutrients.kcal &&
      nutrients.kcal.min >= p.kcalTarget * (1 - p.calorieTolerance) - 1e-8 &&
      nutrients.kcal.max <= p.kcalTarget * (1 + p.calorieTolerance) + 1e-8);
  const protein =
    p.proteinMinimumG === null ||
    (!!nutrients.proteinG && nutrients.proteinG.min >= p.proteinMinimumG);
  const fibre =
    p.fibreMinimumG === null ||
    (!!nutrients.fibreG && nutrients.fibreG.min >= p.fibreMinimumG);
  const hasTarget =
    p.kcalTarget !== null ||
    p.proteinMinimumG !== null ||
    p.fibreMinimumG !== null;
  if (!complete)
    messages.push("Some meals have incomplete nutrition estimates.");
  if (!fullDay) messages.push("Planned meals cover only part of the day.");
  if (!within) messages.push("Calories fall outside the selected range.");
  if (!protein) messages.push("Protein goal is not met.");
  if (!fibre) messages.push("Fibre goal is not met.");
  return {
    nutrients,
    complete,
    targetsMet: hasTarget && complete && fullDay && within && protein && fibre,
    messages,
  };
}
