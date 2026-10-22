"use client";
import type { GeneratedPlan, PlanEntry } from "@/lib/planner/types";
import { dateLabel } from "@/lib/planner/dates";
import { PlannerDialog } from "./PlannerDialog";
import { NutritionSummary } from "./NutritionSummary";
import { SuggestionCard } from './SuggestionCard';
export function GenerationPreview({
  draft,
  pending,
  onClose,
  onApply,
  onSwap,
}: {
  draft: GeneratedPlan;
  pending: boolean;
  onClose: () => void;
  onApply: () => void;
  onSwap: (entry: PlanEntry) => void;
}) {
  return (
    <PlannerDialog title="Review your menu" onClose={onClose}>
      <p className="planner-muted">
        Your saved plan changes only when you choose Apply. Existing meals stay
        locked unless you chose to unlock them.
      </p>
      {Object.entries(draft.daySummaries).map(([date, summary]) => (
        <section className="planner-preview-day" key={date}>
          <h3>
            {dateLabel(date, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </h3>
          {draft.entries
            .filter((e) => e.plannedFor === date)
            .map((e) => (
              <div key={e.id} className="planner-preview-meal">
                <div>
                  <span className="planner-muted">
                    {e.mealSlot} · {e.servings} serving
                    {e.servings === 1 ? "" : "s"}
                  </span>
                  {e.recipe?.source.kind==='suggestion'?<SuggestionCard recipe={e.recipe} servings={e.servings}/>:<strong>{e.recipe?.title || "Recipe unavailable"}</strong>}
                  {e.recipe?.source.kind === "suggestion" && (
                    <small>
                      New suggestion ·{" "}
                      <a
                        href={e.recipe.source.ref.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {e.recipe.source.ref.attribution}
                      </a>
                    </small>
                  )}
                </div>
                <button
                  className="outline-button"
                  disabled={pending}
                  onClick={() => onSwap(e)}
                >
                  {e.recipe?.source.kind==='suggestion'?'Dismiss / replace':'Swap'}
                </button>
              </div>
            ))}
          <NutritionSummary summary={summary} />
        </section>
      ))}
      {draft.unmetGoals.length > 0 && (
        <details className="planner-notes" open>
          <summary>What to review</summary>
          <ul>
            {[...new Set(draft.unmetGoals)].map((x, i) => (
              <li key={i}>{x}</li>
            ))}
          </ul>
        </details>
      )}
      <footer>
        <button className="outline-button" disabled={pending} onClick={onClose}>
          Cancel
        </button>
        <button
          className="primary-button"
          disabled={pending || !Object.keys(draft.daySummaries).length}
          onClick={onApply}
        >
          {pending ? "Applying…" : "Apply plan"}
        </button>
      </footer>
    </PlannerDialog>
  );
}
