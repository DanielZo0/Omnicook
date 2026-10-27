"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { MobileRecipe } from "@/lib/mobile/demo-data";
import type {
  GeneratedPlan,
  MealSlot,
  PlanEntry,
  PlannableRecipe,
  PlannerPreferences,
  PlannerState,
} from "@/lib/planner/types";
import { defaultPreferences, slots } from "@/lib/planner/schemas";
import {
  addDays,
  dateLabel,
  localToday,
  shiftWeek,
  weekDates,
} from "@/lib/planner/dates";
import { mobileToPlannable } from "@/lib/planner/mobile";
import { generatePlan } from "@/lib/planner/generate";
import { plannerClient, type AnalysisReview } from "@/lib/planner/client";
import { responseIsCurrent } from "@/lib/planner/ui-state";
import { evaluateDay } from "@/lib/nutrition/targets";
import { buildShoppingList } from "@/lib/shopping/build-list";
import { foodFeatures } from "@/lib/planner/foods";
import { RecipeImage } from "../RecipeImage";
import { KitchenIcon } from "../KitchenIcon";
import { ConfirmDialog } from "../ConfirmDialog";
import { RecipePicker } from "./RecipePicker";
import { PlannerSettings } from "./PlannerSettings";
import { PlannerDialog } from "./PlannerDialog";
import { GenerationPreview } from "./GenerationPreview";
import { NutritionSummary } from "./NutritionSummary";
type Props = {
  ownerKey: string;
  signedIn: boolean;
  recipes: MobileRecipe[];
  mode: "planner" | "shopping";
  initialRecipeId: string | null;
  onConsumeRecipe: () => void;
  onOpenRecipe: (id: string) => void;
  onMode: (mode: "planner" | "shopping") => void;
  onCookbookChanged: () => void;
};
export function Planner({
  ownerKey,
  signedIn,
  recipes,
  mode,
  initialRecipeId,
  onConsumeRecipe,
  onOpenRecipe,
  onMode,
  onCookbookChanged,
}: Props) {
  const [week, setWeek] = useState(() => weekDates(localToday())[0]),
    [slot, setSlot] = useState<MealSlot>("dinner"),
    [state, setState] = useState<PlannerState | null>(null),
    [pending, setPending] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const [picker, setPicker] = useState<{
      date: string;
      slot: MealSlot;
      key?: string;
    } | null>(null),
    [settings, setSettings] = useState(false),
    [remove, setRemove] = useState<PlanEntry | null>(null),
    [draft, setDraft] = useState<GeneratedPlan | null>(null),
    [unlocked, setUnlocked] = useState<string[]>([]),
    [sourceMode, setSourceMode] = useState<"saved" | "suggestions">("saved"),
    [detail, setDetail] = useState<PlanEntry | null>(null),
    [analysis, setAnalysis] = useState<{
      recipe: PlannableRecipe;
      review: AnalysisReview;
    } | null>(null),
    [analysisChoice, setAnalysisChoice] = useState(""),
    [reviewRecipe, setReviewRecipe] = useState(""),
    [checked, setChecked] = useState<Record<string, boolean>>({});
  const alive = useRef(true),
    stamp = useRef({ owner: ownerKey, request: 0 }),
    guestEntries = useRef<PlanEntry[]>([]),
    guestPrefs = useRef(defaultPreferences()),
    applyKey = useRef(crypto.randomUUID());
  stamp.current.owner = ownerKey;
  const mobileRecipes = useMemo(
    () => recipes.map(mobileToPlannable),
    [recipes],
  );
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      stamp.current.request++;
    };
  }, []);
  async function perform<T>(
    action: () => Promise<T>,
    accept: (result: T) => void,
  ) {
    const start = { owner: ownerKey, request: ++stamp.current.request };
    setPending(true);
    setError("");
    try {
      const result = await action();
      if (alive.current && responseIsCurrent(start, stamp.current))
        accept(result);
    } catch (e) {
      if (alive.current && responseIsCurrent(start, stamp.current))
        setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      if (alive.current && responseIsCurrent(start, stamp.current)) {
        setPending(false);
        setLoading(false);
      }
    }
  }
  function guestState(): PlannerState {
    return {
      weekStart: week,
      revision: state?.revision || 0,
      entries: guestEntries.current.filter((e) =>
        weekDates(week).includes(e.plannedFor),
      ),
      preferences: guestPrefs.current,
      recipes: mobileRecipes,
      capabilities: { nutrition: false, suggestions: false },
    };
  }
  function load() {
    if (signedIn) {
      setLoading(true);
      void perform(
        () => plannerClient.load(week),
        (r) => setState(r.state),
      );
    } else {
      setState(guestState());
      setLoading(false);
    }
  }
  useEffect(() => {
    setDraft(null);
    setUnlocked([]);
    setChecked({});
    load();
  }, [week, ownerKey, signedIn]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (initialRecipeId && state) {
      setPicker({
        date: weekDates(week).includes(localToday()) ? localToday() : week,
        slot,
        key: initialRecipeId,
      });
      onConsumeRecipe();
    }
  }, [initialRecipeId, state]); // eslint-disable-line react-hooks/exhaustive-deps
  const dates = weekDates(week),
    entries = state?.entries || [],
    activeRecipes = state?.recipes || mobileRecipes;
  const shopping = useMemo(() => buildShoppingList(entries), [entries]);
  const plantFoods = [
    ...new Set(
      entries.flatMap((e) =>
        e.recipe ? foodFeatures(e.recipe).plantFoods : [],
      ),
    ),
  ];
  const currentPickerEntry = picker
    ? entries.find(
        (e) => e.plannedFor === picker.date && e.mealSlot === picker.slot,
      )
    : null;
  function guestUpdate(next: PlanEntry[]) {
    guestEntries.current = [
      ...guestEntries.current.filter((e) => !dates.includes(e.plannedFor)),
      ...next,
    ];
    setState((s) =>
      s ? { ...s, entries: next, revision: s.revision + 1 } : s,
    );
  }
  function put(recipe: PlannableRecipe, servings: number) {
    if (!picker || !state) return;
    const p = picker;
    if (signedIn) {
      if (recipe.source.kind !== "recipe") return;
      void perform(
        () =>
          plannerClient.put({
            recipeId: recipe.key,
            plannedFor: p.date,
            mealSlot: p.slot,
            servings,
            locked: true,
            expectedRevision: state.revision,
          }),
        (r) => {
          if (r.state.weekStart !== week) setWeek(r.state.weekStart);
          setState(r.state);
          setPicker(null);
          setUnlocked([]);
        },
      );
    } else {
      const entry: PlanEntry = {
        id: currentPickerEntry?.id || crypto.randomUUID(),
        plannedFor: p.date,
        mealSlot: p.slot,
        source: { kind: "recipe", recipeId: recipe.key },
        recipe,
        servings,
        locked: true,
        version: (currentPickerEntry?.version || 0) + 1,
      };
      guestEntries.current = guestEntries.current.filter(
        (e) => !(e.plannedFor === p.date && e.mealSlot === p.slot),
      );
      guestEntries.current.push(entry);
      setPicker(null);
      if (!dates.includes(p.date)) setWeek(weekDates(p.date)[0]);
      else setState({ ...guestState(), revision: state.revision + 1 });
    }
  }
  function removeMeal() {
    if (!remove || !state) return;
    if (signedIn)
      void perform(
        () =>
          plannerClient
            .remove(remove.id, state.revision)
            .then(() => plannerClient.load(week)),
        (r) => {
          setState(r.state);
          setRemove(null);
        },
      );
    else {
      guestUpdate(entries.filter((e) => e.id !== remove.id));
      setRemove(null);
    }
  }
  function savePreferences(p: PlannerPreferences) {
    if (signedIn)
      void perform(
        () => plannerClient.preferences(p).then(() => plannerClient.load(week)),
        (r) => {
          setState(r.state);
          setSettings(false);
        },
      );
    else {
      guestPrefs.current = { ...p, version: p.version + 1 };
      setState((s) => (s ? { ...s, preferences: guestPrefs.current } : s));
      setSettings(false);
    }
    setDraft(null);
  }
  function generate(day?: string, swap?: PlanEntry) {
    if (!state) return;
    const input = {
      weekStart: week,
      day,
      sourceMode,
      unlockedIds: swap ? [...unlocked, swap.id] : unlocked,
      ...(swap
        ? {
            swap: { plannedFor: swap.plannedFor, mealSlot: swap.mealSlot },
            ...(draft ? { baseGenerationId: draft.id } : {}),
          }
        : {}),
      dismissed: swap?.recipe ? [swap.recipe.key] : [],
    };
    if (signedIn)
      void perform(
        () => plannerClient.generate(input),
        (r) => {
          setDraft(r.draft);
          applyKey.current = crypto.randomUUID();
        },
      );
    else {
      try {
        const base =
          draft && swap ? { ...state, entries: draft.entries } : state;
        const generated = generatePlan(base, input, ownerKey);
        setDraft(generated);
        applyKey.current = crypto.randomUUID();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not generate.");
      }
    }
  }
  function apply() {
    if (!draft) return;
    if (signedIn)
      void perform(
        () => plannerClient.apply(draft.id, applyKey.current),
        (r) => {
          setState(r.state);
          setDraft(null);
          setUnlocked([]);
        },
      );
    else {
      guestUpdate(draft.entries);
      setDraft(null);
      setUnlocked([]);
    }
  }
  function analyze(recipe: PlannableRecipe) {
    setDetail(null);
    setReviewRecipe(recipe.key);
    void perform(
      () => plannerClient.analyze(recipe.key),
      (review) => {
        setAnalysis({ recipe, review });
        setAnalysisChoice("");
        load();
      },
    );
  }
  function confirmMatch() {
    if (!analysis || !analysisChoice) return;
    const [position, index] = analysisChoice.split(":").map(Number),
      group = analysis.review.candidates.find(
        (c) => c.ingredient.position === position,
      ),
      candidate = group?.candidates[index];
    if (!candidate) return;
    void perform(
      () =>
        plannerClient.match(
          analysis.recipe.key,
          position,
          candidate.ref,
          analysis.review.estimate.fingerprint,
        ),
      (review) => {
        setAnalysis({ ...analysis, review });
        setAnalysisChoice("");
        load();
      },
    );
  }
  return (
    <div className="utility-screen planner-screen planner-workspace app-scroll">
      <header className="utility-heading">
        <div className="planner-title-line">
          <div>
            <h1>
              {mode === "shopping" ? "Your shopping list" : "Your weekly menu"}
            </h1>
            <p>
              {mode === "shopping"
                ? "Every planned meal, with quantities."
                : "A little planning. More time around the table."}
            </p>
          </div>
          <button
            className="outline-button"
            disabled={!state || pending}
            onClick={() => setSettings(true)}
          >
            <KitchenIcon name="user" size={16} />
            Preferences
          </button>
        </div>
      </header>
      <div className="planner-week-control">
        <button
          className="planner-icon-button"
          aria-label="Previous week"
          disabled={pending}
          onClick={() => setWeek(shiftWeek(week, -1))}
        >
          ‹
        </button>
        <div>
          <strong>
            {dateLabel(week)} –{" "}
            {dateLabel(addDays(week, 6), {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </strong>
          <button
            className="planner-text-button"
            disabled={pending}
            onClick={() => setWeek(weekDates(localToday())[0])}
          >
            This week
          </button>
        </div>
        <button
          className="planner-icon-button"
          aria-label="Next week"
          disabled={pending}
          onClick={() => setWeek(shiftWeek(week, 1))}
        >
          ›
        </button>
      </div>
      {!signedIn && (
        <p className="planner-notice">
          Preview only. Changes are temporary.{" "}
          <a href="/login">Sign in to save your plan</a>.
        </p>
      )}
      {error && (
        <div role="alert" className="planner-error">
          <p>{error}</p>
          <button className="outline-button" onClick={load} disabled={pending}>
            Refresh plan
          </button>
        </div>
      )}
      {loading && <p role="status">Loading your plan…</p>}
      {state && mode === "planner" && (
        <>
          <div className="planner-generate-panel">
            <div>
              <h2>Make room for good food</h2>
              <p>
                Fill a day or week from your recipes. Existing meals stay locked
                unless you unlock them.
              </p>
            </div>
            <div className="planner-generation-actions">
              <label>
                Recipe sources
                <select
                  value={sourceMode}
                  disabled={pending}
                  onChange={(e) =>
                    setSourceMode(e.target.value as "saved" | "suggestions")
                  }
                >
                  <option value="saved">My recipes only</option>
                  <option value="suggestions">Include new suggestions</option>
                </select>
              </label>
              <button
                className="primary-button"
                disabled={pending || loading}
                onClick={() => generate()}
              >
                {pending ? "Working…" : "Generate week"}
              </button>
            </div>
            {sourceMode === "suggestions" &&
              !state.capabilities.suggestions && (
                <p className="planner-muted">
                  New sources are not configured yet. Your cookbook remains
                  available.
                </p>
              )}
          </div>
          <div className="planner-slots" role="group" aria-label="Meal slot">
            {slots.map((s) => (
              <button
                key={s}
                aria-pressed={slot === s}
                onClick={() => setSlot(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="planner-days">
            {dates.map((date) => {
              const entry = entries.find(
                (e) => e.plannedFor === date && e.mealSlot === slot,
              );
              return (
                <article
                  className={`planner-day ${date === localToday() ? "is-today" : ""}`}
                  key={date}
                >
                  <div className="planner-day-heading">
                    <h2>
                      {dateLabel(date, {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </h2>
                    <button
                      className="planner-text-button"
                      disabled={pending}
                      onClick={() => generate(date)}
                    >
                      Fill day
                    </button>
                  </div>
                  {entry ? (
                    <>
                      <button
                        className="planner-meal"
                        onClick={() => {
                          if (entry.source.kind === "recipe")
                            onOpenRecipe(entry.source.recipeId);
                          else setDetail(entry);
                        }}
                      >
                        {entry.recipe?.imageUrl && (
                          <RecipeImage src={entry.recipe.imageUrl} alt="" />
                        )}
                        <strong>
                          {entry.recipe?.title || "Recipe unavailable"}
                        </strong>
                      </button>
                      <p className="planner-muted">
                        {entry.servings} serving
                        {entry.servings === 1 ? "" : "s"}
                        {entry.source.kind === "suggestion"
                          ? " · New suggestion"
                          : ""}
                      </p>
                      <div className="planner-meal-actions">
                        <button
                          className="planner-text-button"
                          disabled={pending}
                          onClick={() =>
                            setPicker({ date, slot, key: entry.recipe?.key })
                          }
                        >
                          Change
                        </button>
                        <button
                          className="planner-text-button"
                          disabled={pending}
                          onClick={() => setRemove(entry)}
                        >
                          Remove
                        </button>
                        <button
                          className="planner-text-button"
                          aria-pressed={!unlocked.includes(entry.id)}
                          disabled={pending}
                          onClick={() =>
                            setUnlocked((u) =>
                              u.includes(entry.id)
                                ? u.filter((x) => x !== entry.id)
                                : [...u, entry.id],
                            )
                          }
                        >
                          {unlocked.includes(entry.id) ? "Unlocked" : "Locked"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      className="planner-empty-slot"
                      disabled={pending}
                      onClick={() => setPicker({ date, slot })}
                    >
                      <KitchenIcon name="plus" />
                      Choose {slot}
                    </button>
                  )}
                  <NutritionSummary
                    summary={evaluateDay(
                      entries.filter((e) => e.plannedFor === date),
                      state.preferences,
                      slots.every((s) =>
                        entries.some(
                          (e) => e.plannedFor === date && e.mealSlot === s,
                        ),
                      ),
                    )}
                  />
                </article>
              );
            })}
          </div>
          <div className="planner-week-footer">
            <div>
              <b>{plantFoods.length} different plant foods planned</b>
              <details>
                <summary>See food variety</summary>
                <p>
                  {plantFoods.join(", ") ||
                    "Add meals to see recognised plant ingredients."}
                </p>
              </details>
            </div>
            <button
              className="primary-button"
              onClick={() => onMode("shopping")}
            >
              Shopping list · {shopping.length}
            </button>
          </div>
          <section className="planner-nutrition-review">
            <h2>Recipe nutrition</h2>
            <p className="planner-muted">
              Match ingredients to food records to calculate estimates.
              Raw/cooked state, quantity and yield matter.
            </p>
            {!state.capabilities.nutrition && (
              <p className="planner-notice">
                Nutrition lookup is not configured yet. You can still choose
                meals and generate a menu without nutrient targets.
              </p>
            )}
            <label className="planner-field">
              Recipe to review
              <select
                value={reviewRecipe}
                onChange={(e) => setReviewRecipe(e.target.value)}
              >
                <option value="">Choose a recipe</option>
                {activeRecipes
                  .filter((r) => r.source.kind === "recipe")
                  .map((r) => (
                    <option key={r.key} value={r.key}>
                      {r.title} · {r.nutrition.status}
                    </option>
                  ))}
              </select>
            </label>
            <button
              className="outline-button"
              disabled={
                pending ||
                !reviewRecipe ||
                !signedIn ||
                !state.capabilities.nutrition
              }
              onClick={() => {
                const recipe = activeRecipes.find(
                  (r) => r.key === reviewRecipe,
                );
                if (recipe) analyze(recipe);
              }}
            >
              Review ingredient matches
            </button>
          </section>
        </>
      )}
      {state && mode === "shopping" && (
        <>
          <button
            className="planner-text-button"
            onClick={() => onMode("planner")}
          >
            ‹ Back to weekly menu
          </button>
          {!shopping.length && (
            <div className="cookbook-empty">
              <h2>Your list starts with a plan</h2>
              <p>
                Choose meals for this week to gather their ingredients here.
              </p>
              <button
                className="primary-button"
                onClick={() => onMode("planner")}
              >
                Plan meals
              </button>
            </div>
          )}
          {shopping.map((row, i) => (
            <div className="planner-shopping-row" key={row.name}>
              <label>
                <input
                  type="checkbox"
                  checked={!!checked[row.name]}
                  onChange={(e) =>
                    setChecked({ ...checked, [row.name]: e.target.checked })
                  }
                />
                <span className={checked[row.name] ? "is-checked" : ""}>
                  <b>{row.name}</b>
                  <span>
                    {row.amounts
                      .map((a) =>
                        [
                          a.quantity || "Amount not specified",
                          a.unit,
                          a.notes,
                          a.unknownYield ? "(full recipe; yield unknown)" : "",
                        ]
                          .filter(Boolean)
                          .join(" "),
                      )
                      .join(" + ")}
                  </span>
                </span>
              </label>
              <details>
                <summary>
                  From {row.contributions.length} planned occurrence
                  {row.contributions.length === 1 ? "" : "s"}
                </summary>
                <p>
                  {row.contributions.map((c, j) => (
                    <span key={j}>
                      {c.recipeTitle}
                      {j < row.contributions.length - 1 ? ", " : ""}
                    </span>
                  ))}
                </p>
              </details>
            </div>
          ))}
        </>
      )}
      {picker && (
        <RecipePicker
          recipes={activeRecipes.filter((r) => r.source.kind === "recipe")}
          date={picker.date}
          slot={picker.slot}
          initialKey={picker.key}
          currentTitle={currentPickerEntry?.recipe?.title}
          pending={pending}
          onClose={() => !pending && setPicker(null)}
          onSave={put}
          onDateChange={(date) => date && setPicker({ ...picker, date })}
          onSlotChange={(s) => setPicker({ ...picker, slot: s })}
        />
      )}
      {settings && state && (
        <PlannerSettings
          preferences={state.preferences}
          pending={pending}
          onClose={() => !pending && setSettings(false)}
          onSave={savePreferences}
        />
      )}
      {remove && (
        <ConfirmDialog
          title="Remove this meal?"
          confirmLabel={pending ? "Removing…" : "Remove meal"}
          onCancel={() => !pending && setRemove(null)}
          onConfirm={() => !pending && removeMeal()}
        >
          <p>
            {remove.recipe?.title} will be removed from this plan. Your cookbook
            recipe stays saved.
          </p>
        </ConfirmDialog>
      )}
      {draft && (
        <GenerationPreview
          draft={draft}
          pending={pending}
          onClose={() => !pending && setDraft(null)}
          onApply={apply}
          onSwap={(e) => generate(undefined, e)}
        />
      )}
      {detail && (
        <PlannerDialog
          title={detail.recipe?.title || "Planned recipe"}
          onClose={() => setDetail(null)}
        >
          {detail.recipe?.source.kind === "suggestion" && (
            <p>
              <a
                href={detail.recipe.source.ref.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {detail.recipe.source.ref.attribution}
              </a>
            </p>
          )}
          <ul>
            {detail.recipe?.ingredients.map((i) => (
              <li key={i.position}>
                {[i.quantity, i.unit, i.name].filter(Boolean).join(" ")}
              </li>
            ))}
          </ul>
          <ol>
            {detail.recipe?.steps.map((s) => (
              <li key={s.position}>{s.instruction}</li>
            ))}
          </ol>
          {signedIn && detail.source.kind === "suggestion" && (
            <button
              className="primary-button"
              disabled={pending}
              onClick={() => {
                if (detail.source.kind === "suggestion") {
                  const snapshotId = detail.source.snapshotId;
                  void perform(
                    () => plannerClient.saveSuggestion(snapshotId),
                    () => {
                      setDetail(null);
                      onCookbookChanged();
                      load();
                    },
                  );
                }
              }}
            >
              Save to cookbook
            </button>
          )}
        </PlannerDialog>
      )}
      {analysis && (
        <PlannerDialog
          title={`Nutrition: ${analysis.recipe.title}`}
          onClose={() => !pending && setAnalysis(null)}
        >
          <p>
            Confirm the matching food and preparation for each ingredient.
            Estimates use the recipe's stated quantities and yield.
          </p>
          <p className="planner-muted">
            {analysis.recipe.servings
              ? `Recipe yield: ${analysis.recipe.servings} servings`
              : "Yield is unknown. Edit the recipe to set servings."}
          </p>
          <details><summary>Nutrition data sources</summary><ul>{analysis.review.estimate.sources.map((source,i)=><li key={i}><a href={source.sourceUrl} target="_blank" rel="noopener noreferrer">{source.attribution} · food {source.externalId}</a></li>)}</ul><p className="planner-muted">Estimates retain source identity and analysis version. Switching a source does not discard earlier records.</p></details>
          <ul>
            {analysis.review.estimate.missing.map((message, i) => (
              <li key={i}>{message}</li>
            ))}
          </ul>
          <label className="planner-field">Review or change an ingredient match<select defaultValue="" disabled={pending} onChange={e=>{if(e.target.value==='')return;const position=Number(e.target.value);void perform(()=>plannerClient.analyze(analysis.recipe.key,position),review=>{setAnalysis({...analysis,review});setAnalysisChoice('');load();});}}><option value="">Choose an ingredient</option>{analysis.recipe.ingredients.map(i=><option key={i.position} value={i.position}>{i.name}</option>)}</select></label>
          {analysis.review.candidates.map((group) => (
            <label className="planner-field" key={group.ingredient.position}>
              {group.ingredient.name}
              <select
                value={
                  analysisChoice.startsWith(`${group.ingredient.position}:`)
                    ? analysisChoice
                    : ""
                }
                onChange={(e) => setAnalysisChoice(e.target.value)}
              >
                <option value="">Choose the exact food / preparation</option>
                {group.candidates.map((c, i) => (
                  <option
                    key={c.ref.externalId}
                    value={`${group.ingredient.position}:${i}`}
                  >
                    {c.name} ({c.state})
                  </option>
                ))}
              </select>
              {!group.candidates.length && (
                <small>
                  No matching records returned. Leave unresolved or correct the
                  recipe.
                </small>
              )}
            </label>
          ))}
          <button
            className="primary-button"
            disabled={pending || !analysisChoice}
            onClick={confirmMatch}
          >
            {pending ? "Calculating…" : "Confirm food match"}
          </button>
        </PlannerDialog>
      )}
    </div>
  );
}
