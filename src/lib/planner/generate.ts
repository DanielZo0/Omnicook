import type { GeneratedPlan, PlannerState, PlanEntry } from "./types";
import type { z } from "zod";
import { generationRequestSchema, slots } from "./schemas";
import { weekDates } from "./dates";
import { evaluateDay } from "../nutrition/targets";
import { eligibleRecipe, foodFeatures } from "./foods";
type Request = z.input<typeof generationRequestSchema>;
export function generatePlan(
  state: PlannerState,
  raw: Request,
  ownerKey: string,
): GeneratedPlan {
  const request = generationRequestSchema.parse(raw),
    days = request.day
      ? [request.day]
      : request.swap
        ? [request.swap.plannedFor]
        : weekDates(state.weekStart);
  if (days.some((d) => !weekDates(state.weekStart).includes(d)))
    throw Error("Choose a day in the selected week.");
  const selectedSlots = request.swap
    ? [request.swap.mealSlot]
    : state.preferences.enabledSlots;
  const eligible = state.recipes
    .filter(
      (r) =>
        !request.dismissed.includes(r.key) &&
        eligibleRecipe(r, state.preferences),
    )
    .sort((a, b) => a.key.localeCompare(b.key))
    .slice(0, 40);
  const score = (entries: PlanEntry[]) => {
    let n = 0;
    const p = state.preferences;
    for (const day of days) {
      const summary = evaluateDay(
          entries.filter((e) => e.plannedFor === day),
          p,
          false,
        ),
        v = summary.nutrients;
      if (p.kcalTarget)
        n += v.kcal
          ? Math.max(
              Math.abs(v.kcal.min / p.kcalTarget - 1),
              Math.abs(v.kcal.max / p.kcalTarget - 1),
            )
          : 10;
      if (p.proteinMinimumG)
        n += v.proteinG
          ? Math.max(0, 1 - v.proteinG.min / p.proteinMinimumG)
          : 10;
      if (p.fibreMinimumG)
        n += v.fibreG ? Math.max(0, 1 - v.fibreG.min / p.fibreMinimumG) : 10;
    }
    const counts = new Map<string, number>();
    for (const e of entries) {
      if (!e.recipe) continue;
      counts.set(e.recipe.key, (counts.get(e.recipe.key) || 0) + 1);
      if (e.recipe.source.kind === "suggestion") n += 0.002;
      n += Math.abs(e.servings - p.servings) * 0.0001;
    }
    n += [...counts.values()].reduce(
      (a, b) => a + Math.max(0, b - 1) * 0.01,
      0,
    );
    if (p.prioritizePlantVariety)
      n -=
        new Set(
          entries.flatMap((e) =>
            e.recipe ? foodFeatures(e.recipe).plantFoods : [],
          ),
        ).size * 0.001;
    if (p.includeFermentedOptions)
      n -=
        new Set(
          entries.flatMap((e) =>
            e.recipe ? foodFeatures(e.recipe).fermentedFoods : [],
          ),
        ).size * 0.001;
    return n;
  };
  let beam = [{ entries: [...state.entries], score: 0 }];
  for (const day of days)
    for (const mealSlot of selectedSlots) {
      const original = state.entries.find(
        (e) => e.plannedFor === day && e.mealSlot === mealSlot,
      );
      if (
        original &&
        !request.unlockedIds.includes(original.id) &&
        original.locked
      )
        continue;
      const candidates = eligible
        .filter((r) => !request.swap || r.key !== original?.recipe?.key)
        .filter(
          (r) =>
            r.category === "Other" ||
            r.category.toLowerCase() === mealSlot ||
            (mealSlot === "dinner" && r.category === "Lunch") ||
            (mealSlot === "snack" && r.category === "Dessert") ||
            (mealSlot === "lunch" && r.category === "Dinner"),
        );
        if (!candidates.length) {
          if(original?.recipe?.source.kind==='suggestion'&&request.dismissed.includes(original.recipe.key))beam=beam.map(b=>({...b,entries:b.entries.filter(e=>e.id!==original.id)}));
          continue;
        }
      const next = [];
      for (const partial of beam)
        for (const r of candidates)
          for (const servings of [
            ...new Set([0.5, 1, 1.5, 2, state.preferences.servings]),
          ]) {
            const entry: PlanEntry = {
              id: original?.id || crypto.randomUUID(),
              plannedFor: day,
              mealSlot,
              source:
                r.source.kind === "recipe"
                  ? { kind: "recipe", recipeId: r.source.recipeId }
                  : { kind: "suggestion", snapshotId: crypto.randomUUID() },
              recipe: r,
              servings,
              locked: true,
              version: (original?.version || 0) + 1,
            };
            const entries = [
              ...partial.entries.filter(
                (e) => !(e.plannedFor === day && e.mealSlot === mealSlot),
              ),
              entry,
            ];
            next.push({ entries, score: score(entries) });
          }
      beam = next.sort((a, b) => a.score - b.score).slice(0, 50);
    }
  const entries = beam[0].entries,
    daySummaries: GeneratedPlan["daySummaries"] = {},
    unmetGoals: string[] = [];
  for (const day of days) {
    const dayEntries = entries.filter((e) => e.plannedFor === day);
    const full = slots.every((s) => dayEntries.some((e) => e.mealSlot === s));
    daySummaries[day] = evaluateDay(dayEntries, state.preferences, full);
    if (selectedSlots.some((s) => !dayEntries.some((e) => e.mealSlot === s)))
      unmetGoals.push(`${day}: no eligible recipe for some selected meals.`);
    for (const message of daySummaries[day].messages)
      unmetGoals.push(`${day}: ${message}`);
  }
  return {
    id: crypto.randomUUID(),
    ownerKey,
    expiresAt: Date.now() + 30 * 60000,
    baseRevision: state.revision,
    preferenceVersion: state.preferences.version,
    recipeRevisions: Object.fromEntries(
      entries.flatMap((e) =>
        e.recipe?.source.kind === "recipe"
          ? [[e.recipe.key, e.recipe.revision]]
          : [],
      ),
    ),
    entries,
    daySummaries,
    unmetGoals,
  };
}
