# Social recipes with missing instructions

Date: 2026-10-20
State: detailed design for review; the user approved the high-level flow, not these implementation defaults.

## Intent

Import recipes such as Instagram reel DepF_tWsXH7 without inventing missing instructions. The reel exposes ingredients and refers to the creator website; its matching full recipe is https://www.tuorlorosso.it/nascondini-fatti-in-casa/.

## User-approved behavior

- Read the requested post, then try the creator's original recipe when instructions are missing.
- Confirm dish identity and ingredient quantities before using a discovered recipe.
- Keep both source links for attribution.
- If no confident match exists, retain an incomplete draft, explain what is missing, and allow the user to supply a recipe link or steps.
- Never invent a method. Video transcription is outside this change.

## Proposed implementation defaults (builder decisions)

### Source discovery and matching

Only inspect the requested post's caption/metadata. Ignore recommendations and comments. Prefer explicit recipe links; a homepage alone starts a bounded search of that creator website. Do not search the wider web or infer ownership from similar usernames.

Allow public HTTP(S) destinations through the existing DNS pinning, private-address rejection, redirect, response-size and abort checks. Extend the shared source budget from 14 to 18 seconds, reduce the shared AI budget from 40 to 36 seconds, and keep the route at 60 seconds. The source budget is cumulative time spent fetching/reading sources, not a timer left running during AI calls. All partial analysis, candidate comparisons, final extraction and repair share the same 36-second AI allowance; requests never reset that allowance. A 54-second overall work deadline also bounds both phases. A failed search falls back to the caption without losing it.

Maximum additional HTML requests: five total (including redirects). Fetch an explicit recipe URL first; otherwise fetch the named homepage, discover its advertised same-origin GET search form if available, and submit the dish name through its search field. Fetch at most three recipe candidates from returned links. If no supported search form exists, consider recipe links on the homepage. Do not guess WordPress endpoints. Revalidate every redirect; search stays on the creator origin, allowing only its www/non-www canonical equivalent. Stop at the budget.

Extract a dish name and ingredients from source text through the existing configured model with a separate partial-import contract. Source content cannot issue browsing instructions or select arbitrary URLs. No new provider or search subscription.

Compare normalized dish-name tokens and ingredients in the original language. Automatic selection requires the dish name, at least three ingredient names and their quantities to agree, at least 80% coverage of the caption's quantified ingredients, no conflicting overlapping quantities, and actual instructions on the candidate. Normalize decimal commas, fractions and equivalent g/kg or ml/l units. Do not equate count and weight, infer batch scaling, or translate units by guessing. Below-threshold, ambiguous, unparseable or multiple matching candidates remain incomplete. Unknown extra website ingredients do not erase caption ingredients silently; the complete source is shown for review.

Complete captions in any language must not be rejected solely because they lack English cooking verbs. Use the extraction contract to decide completeness; lexical checks may guide discovery but cannot conclusively reject non-English content. Structured Recipe data remains preferred.

### Partial drafts and extraction

Keep the persisted recipe schema's requirement for ingredients and nonempty steps. Introduce a separate import result with status complete or incomplete and missingFields. Incomplete imports require a usable title and at least one source-backed ingredient; steps may be empty. Preserve known method steps if present, but mark an unfinished method incomplete. Provider repair validates against the requested complete/partial contract and never asks the model to fill missing source facts.

The review screen shows: "Ingredients found. Instructions are missing." when appropriate. Allow editing existing fields, adding steps and entering the original recipe URL. Label the primary action "Save recipe" and disable it until the complete recipe schema passes. Do not offer planning/cooking/shopping integration for incomplete drafts.

Retain one recoverable import draft on this device, scoped to the signed-in account or a separate guest namespace. Refresh restores it; sign-out/account switching never exposes another account's draft. A guest draft transfers only after an explicit recovery choice on sign-in. Unavailable storage retains the draft in memory and explains that it cannot survive closing the page. Starting another import or leaving a dirty draft asks before replacement. Explicit discard and successful save clear that draft. This shares the persistence abstraction with the approved UX/UI plan rather than creating competing keys.

When the user supplies an original URL, keep the caption draft until the new result is accepted. Automatically merge only if the same matching rules pass; otherwise show that the supplied page differs and require explicit replacement. Failed requests retain all edits.

### Provenance

Keep sourceUrl as the original social URL for backward compatibility. Add nullable originalRecipeUrl to saved recipes, API contracts and client models through an additive migration; existing records remain null. Review and detail display "Original post" and "Full recipe" when both exist. Copy the verified recipe's image through the existing photo workflow. Existing ownership and safe URL validation apply to both fields; links use safe external-link attributes.

Incomplete drafts keep both links in device storage but never become database recipes. Do not write source content or diagnostics to a public log. Do not apply a migration or write test fixtures to production; integration verification uses an isolated database branch.

## Acceptance checks

- Real reported reel discovers the matching creator page, preserving matching ingredients, instructions and both links.
- Complete Italian caption imports without an English verb requirement.
- Ingredients-only caption without a creator link opens an incomplete review with its quantities intact.
- Near-match, different yield/quantities, conflicting ingredients, unrelated recommendations and ambiguous matches do not auto-complete.
- Timeout, blocked destination, unsupported search and malformed model response retain known draft content and explain the outcome.
- SSRF, redirect, byte and shared deadline controls cover every discovery request.
- Incomplete drafts survive refresh, cannot be saved as recipes, and stay isolated across guest/account transitions.
- Existing complete web/social imports, recipe edits and photo provenance remain intact.
- Both source links survive save/load/edit; legacy records require no backfill.

## Scope boundary

No video/audio transcription, broad web search, new paid service, production migration, deployment or unrelated UX/UI work. The previously approved nine-task UX/UI plan is still separate; coordinate its draft persistence and editor navigation interfaces.
