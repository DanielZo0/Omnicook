"use client";
import { useEffect, useRef, useState } from "react";
import {
  type SharedRecipe,
  type SocialIngredient,
  socialApi,
} from "@/lib/social/client";
import { scaleAmount } from "@/lib/mobile/demo-data";
import { RecipeImage } from "../RecipeImage";
import { SocialDialog } from "./SharingDialog";
export function SharedRecipeView({
  recipe: r,
  cookbookId,
  userId,
  onBack,
  onSaved,
  onRefresh,
  onAuthor,
  onCookingChange,
  anonymous = false,
}: {
  recipe: SharedRecipe;
  cookbookId?: string;
  userId?: string;
  onBack?: () => void;
  onSaved?: (id: string) => void;
  onRefresh?: () => void;
  onAuthor?: (id: string) => void;
  onCookingChange?: (active: boolean) => void;
  anonymous?: boolean;
}) {
  const [checked, setChecked] = useState<string[]>([]),
    [scale, setScale] = useState(1),
    [step, setStep] = useState<number | null>(null),
    [awake, setAwake] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [suggest, setSuggest] = useState<SocialIngredient | null>(null),
    [report, setReport] = useState(false);
  useEffect(() => {
    onCookingChange?.(step !== null);
    if (step !== null)
      document
        .getElementById("active-cooking-step")
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    return () => onCookingChange?.(false);
  }, [step, onCookingChange]);
  const wake = useRef<WakeLockSentinel | null>(null),
    key = useRef(crypto.randomUUID()),
    alternativeKeys = useRef<Record<string, string>>({});
  useEffect(() => {
    let live = true;
    async function request() {
      if (!awake || document.visibilityState !== "visible") return;
      try {
        const lock = await navigator.wakeLock.request("screen");
        if (!live) {
          await lock.release();
          return;
        }
        wake.current = lock;
        lock.addEventListener("release", () => {
          wake.current = null;
        });
      } catch {
        setMessage("Screen awake is unavailable on this device.");
        setAwake(false);
      }
    }
    request();
    document.addEventListener("visibilitychange", request);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", request);
      wake.current?.release();
      wake.current = null;
    };
  }, [awake]);
  async function save(alternativeId?: string) {
    setBusy(true);
    try {
      const result = await socialApi("save", {
        recipeId: r.id,
        cookbookId,
        alternativeId,
        idempotencyKey: alternativeId
          ? (alternativeKeys.current[alternativeId] ??= crypto.randomUUID())
          : key.current,
      });
      onSaved?.(result.id);
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function action(operation: string, input: unknown) {
    setBusy(true);
    try {
      await socialApi(operation, input);
      setMessage("Saved.");
      Promise.resolve(onRefresh?.()).catch(() => {});
      return true;
    } catch (e) {
      setMessage((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="shared-recipe">
      <div className="social-back-row">
        {onBack ? (
          <button className="social-back" onClick={onBack}>
            ‹ Back
          </button>
        ) : (
          <a href="/">‹ My cookbook</a>
        )}
        {r.shareUrl && <a href={r.shareUrl}>Public link ↗</a>}
      </div>
      <div className="social-recipe-hero">
        <RecipeImage src={r.imageUrl || undefined} alt={r.title} />
      </div>
      <header>
        <p>{cookbookId ? "Shared cookbook" : "From the community"}</p>
        <h1>{r.title}</h1>
        <button
          className="author-button"
          onClick={() => onAuthor?.(r.author.id)}
          disabled={!onAuthor || !r.author.id}
        >
          From {r.author.name}’s kitchen
        </button>
        {r.attribution && (
          <p>
            Adapted from {r.attribution.title} by {r.attribution.author.name}
          </p>
        )}
        <p>
          {(r.prepMinutes || 0) + (r.cookMinutes || 0)} min · Serves{" "}
          {(r.servings || 1) * scale}
        </p>
        {r.creator && <p>Recipe credit: {r.creator}</p>}
        {r.photoMetadata?.kind === "generated" && (
          <small>AI illustration</small>
        )}
        {r.photoMetadata?.credit && (
          <small>
            Photo:{" "}
            {r.photoMetadata.creditUrl ? (
              <a
                href={r.photoMetadata.creditUrl}
                target="_blank"
                rel="noreferrer"
              >
                {r.photoMetadata.credit}
              </a>
            ) : (
              r.photoMetadata.credit
            )}
            {r.photoMetadata.licenseUrl && (
              <>
                {" "}
                ·{" "}
                <a
                  href={r.photoMetadata.licenseUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {r.photoMetadata.license || "Licence"}
                </a>
              </>
            )}
          </small>
        )}
        {r.sourceUrl && (
          <p>
            <a href={r.sourceUrl} target="_blank" rel="noreferrer">
              Original source ↗
            </a>
          </p>
        )}
        {r.originalRecipeUrl && r.originalRecipeUrl !== r.sourceUrl && (
          <p>
            <a href={r.originalRecipeUrl} target="_blank" rel="noreferrer">
              Full original recipe ↗
            </a>
          </p>
        )}
      </header>
      {message && (
        <p role="status" className="social-notice">
          {message}
        </p>
      )}
      <div className="social-recipe-columns">
        <section>
          <div className="social-inline">
            <h2>Ingredients</h2>
            <select
              aria-label="Recipe multiplier"
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
            >
              {[1, 2, 3].map((n) => (
                <option key={n} value={n}>
                  {n}×
                </option>
              ))}
            </select>
          </div>
          <small>Tick ingredients as you go.</small>
          {r.ingredients.map((i) => (
            <div className="social-ingredient" key={i.id}>
              <label>
                <input
                  type="checkbox"
                  checked={checked.includes(i.id)}
                  onChange={(e) =>
                    setChecked(
                      e.target.checked
                        ? [...checked, i.id]
                        : checked.filter((x) => x !== i.id),
                    )
                  }
                />
                <span className={checked.includes(i.id) ? "is-checked" : ""}>
                  <b>
                    {scaleAmount(
                      [i.quantity, i.unit].filter(Boolean).join(" "),
                      scale,
                    )}
                  </b>{" "}
                  {i.name}
                  {i.notes && <small>{i.notes}</small>}
                </span>
              </label>
              {cookbookId && (
                <details>
                  <summary>
                    Alternatives
                    {r.alternatives?.filter((a) => a.ingredient_id === i.id)
                      .length
                      ? ` (${r.alternatives.filter((a) => a.ingredient_id === i.id).length})`
                      : ""}
                  </summary>
                  {r.alternatives
                    ?.filter((a) => a.ingredient_id === i.id)
                    .map((a) => (
                      <div className="alternative" key={a.id}>
                        <b>
                          {[a.quantity, a.unit, a.name]
                            .filter(Boolean)
                            .join(" ")}
                        </b>
                        {a.endorsed && <small>Contributor’s pick</small>}
                        <p>{a.note}</p>
                        {r.isContributor && (
                          <button
                            disabled={busy}
                            onClick={() =>
                              action("endorse", {
                                id: a.id,
                                cookbookId,
                                enabled: !a.endorsed,
                              })
                            }
                          >
                            {a.endorsed ? "Remove endorsement" : "Endorse"}
                          </button>
                        )}
                        <button disabled={busy} onClick={() => save(a.id)}>
                          Use in my own copy
                        </button>
                        {a.canRemove && (
                          <button
                            disabled={busy}
                            onClick={() =>
                              action("removeAlternative", {
                                id: a.id,
                                cookbookId,
                              })
                            }
                          >
                            Remove alternative
                          </button>
                        )}
                        <button
                          disabled={busy}
                          onClick={() =>
                            action("report", {
                              kind: "alternative",
                              targetId: a.id,
                              cookbookId,
                              reason: "Abuse",
                              details: "",
                            })
                          }
                        >
                          Report alternative
                        </button>
                      </div>
                    ))}
                  <button onClick={() => setSuggest(i)}>
                    Suggest an alternative
                  </button>
                </details>
              )}
            </div>
          ))}
        </section>
        <section>
          <h2>Method</h2>
          {r.steps.map((s, index) => (
            <div
              key={s.position}
              id={step === index ? "active-cooking-step" : undefined}
              className={`social-step ${step === index ? "is-current" : ""}`}
              hidden={step !== null && step !== index}
            >
              <b>{index + 1}</b>
              <p>{s.instruction}</p>
            </div>
          ))}
        </section>
      </div>
      <details className="social-options">
        <summary>More options</summary>
        {!anonymous && (
          <>
            <button disabled={busy} onClick={() => setReport(true)}>
              Report recipe
            </button>
            {r.author.id !== userId && (
              <button
                disabled={busy}
                onClick={() =>
                  action("block", { userId: r.author.id, enabled: true })
                }
              >
                Block this cook
              </button>
            )}
          </>
        )}
      </details>
      <div className="social-cook-bar">
        {step === null ? (
          <button className="primary-button" onClick={() => setStep(0)}>
            Start cooking
          </button>
        ) : (
          <>
            <button
              disabled={step === 0}
              onClick={() => setStep((n) => Math.max(0, (n || 0) - 1))}
            >
              Previous
            </button>
            <span>
              Step {step + 1}/{r.steps.length}
            </span>
            <button
              className="primary-button"
              onClick={() => {
                if (step < r.steps.length - 1) setStep(step + 1);
                else {
                  setStep(null);
                  if (cookbookId && !anonymous)
                    action("cooked", { recipeId: r.id, cookbookId });
                  else setMessage("Enjoy your meal!");
                }
              }}
            >
              {step === r.steps.length - 1 ? "Finished" : "Next step"}
            </button>
          </>
        )}
        {step === null && !anonymous && onSaved && (
          <button disabled={busy} onClick={() => save()}>
            Save my own copy
          </button>
        )}
        {anonymous && (
          <a href={`/login?next=${encodeURIComponent(r.shareUrl || "/")}`}>
            Sign in to save a copy
          </a>
        )}
        {typeof navigator !== "undefined" && "wakeLock" in navigator && (
          <label>
            <input
              type="checkbox"
              checked={awake}
              onChange={(e) => setAwake(e.target.checked)}
            />
            Keep screen awake
          </label>
        )}
      </div>
      {suggest && (
        <SocialDialog
          title={`Alternative for ${suggest.name}`}
          onClose={() => setSuggest(null)}
        >
          {message && <p role="status">{message}</p>}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const saved = await action("alternative", {
                recipeId: r.id,
                cookbookId,
                ingredientId: suggest.id,
                revision: r.revision,
                quantity: String(f.get("quantity") || "") || null,
                unit: String(f.get("unit") || "") || null,
                name: String(f.get("name")),
                note: String(f.get("note") || ""),
              });
              if (saved) setSuggest(null);
            }}
          >
            <label>
              Ingredient
              <input name="name" required maxLength={160} />
            </label>
            <div className="social-inline">
              <label>
                Quantity
                <input name="quantity" maxLength={80} />
              </label>
              <label>
                Unit
                <input name="unit" maxLength={60} />
              </label>
            </div>
            <label>
              Note
              <textarea name="note" maxLength={240} />
            </label>
            <p>
              Your suggestion sits beside the original ingredient, visible only
              in this cookbook.
            </p>
            <button className="primary-button" disabled={busy}>
              Add alternative
            </button>
          </form>
        </SocialDialog>
      )}
      {report && (
        <SocialDialog title="Report recipe" onClose={() => setReport(false)}>
          {message && <p role="status">{message}</p>}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const saved = await action("report", {
                kind: "recipe",
                targetId: r.id,
                cookbookId,
                reason: f.get("reason"),
                details: f.get("details"),
              });
              if (saved) setReport(false);
            }}
          >
            <label>
              Reason
              <select name="reason">
                {["Abuse", "Unsafe content", "Spam", "Copyright", "Other"].map(
                  (x) => (
                    <option key={x}>{x}</option>
                  ),
                )}
              </select>
            </label>
            <label>
              Details (optional)
              <textarea name="details" maxLength={240} />
            </label>
            <button className="primary-button" disabled={busy}>
              Send report
            </button>
          </form>
        </SocialDialog>
      )}
    </article>
  );
}
