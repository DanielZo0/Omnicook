"use client";
import { useState } from "react";
import type { MealSlot, PlannableRecipe } from "@/lib/planner/types";
import { slots } from "@/lib/planner/schemas";
import { PlannerDialog } from "./PlannerDialog";
import { RecipeImage } from "../RecipeImage";
import { dateLabel } from "@/lib/planner/dates";
export function RecipePicker({
  recipes,
  date,
  slot,
  initialKey,
  currentTitle,
  pending,
  onClose,
  onSave,
  onDateChange,
  onSlotChange,
}: {
  recipes: PlannableRecipe[];
  date: string;
  slot: MealSlot;
  initialKey?: string;
  currentTitle?: string;
  pending: boolean;
  onClose: () => void;
  onSave: (recipe: PlannableRecipe, servings: number) => void;
  onDateChange: (date: string) => void;
  onSlotChange: (slot: MealSlot) => void;
}) {
  const [query, setQuery] = useState(""),
    [selected, setSelected] = useState(initialKey || ""),
    [servings, setServings] = useState(1),
    [preview, setPreview] = useState(false);
  const recipe = recipes.find((r) => r.key === selected);
  return (
    <PlannerDialog title="Choose a recipe" onClose={onClose}>
      <div className="planner-form-row">
        <label>
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
          />
        </label>
        <label>
          Meal
          <select
            value={slot}
            onChange={(e) => onSlotChange(e.target.value as MealSlot)}
          >
            {slots.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="planner-muted">
        {dateLabel(date, { weekday: "long", month: "short", day: "numeric" })}
        {currentTitle ? ` · Replaces ${currentTitle}` : ""}
      </p>
      <label className="planner-field">
        Search your cookbook
        <input
          autoFocus
          type="search"
          value={query}
          placeholder="Recipe, ingredient or creator"
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="planner-picker-list">
        {recipes
          .filter((r) =>
            (r.title + " " + r.ingredients.map((i) => i.name).join(" "))
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
          .map((r) => (
            <button
              key={r.key}
              className={`planner-recipe-choice ${selected === r.key ? "is-selected" : ""}`}
              onClick={() => {
                setSelected(r.key);
                setPreview(false);
              }}
            >
              <RecipeImage src={r.imageUrl || undefined} alt="" />
              <span>
                <b>{r.title}</b>
                <small>
                  {r.prepMinutes !== null && r.cookMinutes !== null
                    ? `${r.prepMinutes + r.cookMinutes} min`
                    : "Time not set"}{" "}
                  ·{" "}
                  {r.nutrition.status === "complete"
                    ? "Nutrition estimated"
                    : "Nutrition needs review"}
                </small>
              </span>
              <span aria-hidden="true">{selected === r.key ? "✓" : "+"}</span>
            </button>
          ))}
      </div>
      {!recipes.length && (
        <p>No saved recipes yet. Add a recipe to your cookbook first.</p>
      )}
      {recipe && (
        <>
          <label className="planner-field">
            Servings for you
            <input
              type="number"
              min="0.1"
              max="20"
              step="0.1"
              value={servings}
              onChange={(e) => setServings(Number(e.target.value))}
            />
          </label>
          <button
            className="planner-text-button"
            onClick={() => setPreview(!preview)}
          >
            {preview ? "Hide recipe" : "Preview ingredients and method"}
          </button>
          {preview && (
            <section className="planner-recipe-preview">
              <h3>{recipe.title}</h3>
              <ul>
                {recipe.ingredients.map((i) => (
                  <li key={i.position}>
                    {[i.quantity, i.unit, i.name, i.notes]
                      .filter(Boolean)
                      .join(" ")}
                  </li>
                ))}
              </ul>
              <ol>
                {recipe.steps.map((s) => (
                  <li key={s.position}>{s.instruction}</li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}
      <footer>
        <button className="outline-button" onClick={onClose} disabled={pending}>
          Cancel
        </button>
        <button
          className="primary-button"
          disabled={
            pending || !recipe || servings <= 0 || servings > 20 || !date
          }
          onClick={() => recipe && onSave(recipe, servings)}
        >
          {pending ? "Saving…" : currentTitle ? "Replace meal" : "Add to plan"}
        </button>
      </footer>
    </PlannerDialog>
  );
}
