"use client";
import { useState } from "react";
import type { PlannerPreferences } from "@/lib/planner/types";
import { preferencesSchema, slots } from "@/lib/planner/schemas";
import { PlannerDialog } from "./PlannerDialog";
export function PlannerSettings({
  preferences,
  pending,
  onClose,
  onSave,
}: {
  preferences: PlannerPreferences;
  pending: boolean;
  onClose: () => void;
  onSave: (p: PlannerPreferences) => void;
}) {
  const [p, setP] = useState(preferences),
    [error, setError] = useState(""),
    [excluded, setExcluded] = useState(
      preferences.excludedIngredients.join(", "),
    ),
    [disliked, setDisliked] = useState(
      preferences.dislikedIngredients.join(", "),
    );
  const number = (
    key:
      | "kcalTarget"
      | "proteinMinimumG"
      | "fibreMinimumG"
      | "maxPreparationMinutes",
    label: string,
  ) => (
    <label className="planner-field">
      {label}
      <input
        type="number"
        min="1"
        value={p[key] ?? ""}
        placeholder="Optional"
        onChange={(e) =>
          setP({
            ...p,
            [key]: e.target.value === "" ? null : Number(e.target.value),
          })
        }
      />
    </label>
  );
  return (
    <PlannerDialog title="Your planning preferences" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const result = preferencesSchema.safeParse({
            ...p,
            excludedIngredients: excluded
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean),
            dislikedIngredients: disliked
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean),
          });
          if (!result.success) {
            setError("Check the targets, portions and selected meals.");
            return;
          }
          onSave(result.data);
        }}
      >
        <p className="planner-muted">
          Set your own targets, or leave them blank to plan for variety. Targets
          describe planned meals, not measured intake.
        </p>
        <div className="planner-form-row">
          {number("kcalTarget", "Daily calories (kcal)")}
          {number("proteinMinimumG", "Minimum protein (g)")}
          {number("fibreMinimumG", "Minimum fibre (g)")}
          <label className="planner-field">
            Calorie tolerance (%)
            <input
              type="number"
              min="1"
              max="99"
              value={Math.round(p.calorieTolerance * 100)}
              onChange={(e) =>
                setP({ ...p, calorieTolerance: Number(e.target.value) / 100 })
              }
            />
          </label>
        </div>
        <fieldset>
          <legend>Meals to plan</legend>
          <div className="planner-checks">
            {slots.map((s) => (
              <label key={s}>
                <input
                  type="checkbox"
                  checked={p.enabledSlots.includes(s)}
                  onChange={(e) =>
                    setP({
                      ...p,
                      enabledSlots: e.target.checked
                        ? [...p.enabledSlots, s]
                        : p.enabledSlots.filter((x) => x !== s),
                    })
                  }
                />
                {s}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="planner-form-row">
          <label className="planner-field">
            Usual servings for you
            <input
              type="number"
              min="0.1"
              max="20"
              step="0.1"
              value={p.servings}
              onChange={(e) => setP({ ...p, servings: Number(e.target.value) })}
            />
          </label>
          {number(
            "maxPreparationMinutes",
            "Maximum total prep + cook time (min)",
          )}
        </div>
        <label className="planner-field">
          Dietary preference
          <select
            value={p.dietaryPattern || ""}
            onChange={(e) =>
              setP({
                ...p,
                dietaryPattern:
                  (e.target.value as PlannerPreferences["dietaryPattern"]) ||
                  null,
              })
            }
          >
            <option value="">No preference</option>
            <option value="vegetarian">Vegetarian</option>
            <option value="vegan">Vegan</option>
          </select>
        </label>
        <label className="planner-field">
          Exclude ingredients / allergens
          <textarea
            value={excluded}
            onChange={(e) => setExcluded(e.target.value)}
            placeholder="Separate with commas, e.g. milk, peanuts"
          />
        </label>
        <p className="planner-muted">
          Recipes with unknown ingredients are excluded from automatic
          suggestions when restrictions are set. Always check labels and
          cross-contact information.
        </p>
        <label className="planner-field">
          Ingredients you dislike
          <textarea
            value={disliked}
            onChange={(e) => setDisliked(e.target.value)}
          />
        </label>
        <fieldset>
          <legend>Food variety</legend>
          <label className="planner-checkbox">
            <input
              type="checkbox"
              checked={p.prioritizePlantVariety}
              onChange={(e) =>
                setP({ ...p, prioritizePlantVariety: e.target.checked })
              }
            />
            Prioritise a variety of plant foods
          </label>
          <label className="planner-checkbox">
            <input
              type="checkbox"
              checked={p.includeFermentedOptions}
              onChange={(e) =>
                setP({ ...p, includeFermentedOptions: e.target.checked })
              }
            />
            Include fermented-food options
          </label>
          <p className="planner-muted">
            These are food preferences, not a microbiome score. Change fibre
            gradually according to your tolerance.
          </p>
        </fieldset>
        {error && <p role="alert">{error}</p>}
        <footer>
          <button
            type="button"
            className="outline-button"
            onClick={onClose}
            disabled={pending}
          >
            Cancel
          </button>
          <button className="primary-button" disabled={pending}>
            {pending ? "Saving…" : "Save preferences"}
          </button>
        </footer>
      </form>
    </PlannerDialog>
  );
}
