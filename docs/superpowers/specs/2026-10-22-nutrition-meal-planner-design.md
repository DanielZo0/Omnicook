# Nutrition-led meal planning

Date: 2026-10-22. Status: user agreed to the suggestion workflow; the complete design and defaults below are proposed for review. No implementation or production release yet.

## Intent and agreed direction

Make Omnicook useful for choosing meals across days and weeks against nutritional goals, with a particular interest in supporting general gut health. Preserve Sunny Kitchen styling and all existing cookbook/import/account behavior.

The user welcomed optional suggestions of real, sourced recipes when the saved cookbook cannot fill nutritional gaps. Search saved recipes first. Suggestions show their source, preparation time, estimated nutrition and reason; users can preview, dismiss, swap or add to a plan. Saving a suggested recipe to the cookbook is a separate action. Generation offers My recipes only or Include new suggestions.

This builds on the approved intentional-planning scope in `2026-10-18-ux-ui-fixes-design.md`, stage 2; its old blue-palette instructions are superseded by the deployed Sunny Kitchen design. The following implementation defaults are the designer's proposals, not individually confirmed user choices.

## Planner basics

- Searchable recipe picker replaces cycling. Select then explicitly confirm; Cancel writes nothing.
- Previous/next/this week, Monday–Sunday, with local calendar date arithmetic and visible date range.
- Breakfast, lunch, dinner and snack; one entry per date/slot, consistent with the existing unique key.
- Add/change/remove/open planned recipes; removal never deletes the cookbook recipe.
- Add to plan from recipe detail opens a date/slot chooser, with confirmation before replacing an occupied slot.
- Preview edits remain temporary and clearly labeled. Authenticated writes remain owner-scoped.

## Targets and preferences

Daily calorie target plus protein and fibre goals are optional, manually entered and editable. Carbohydrate/fat totals are informational in the first version. No default calorie deficit, body-weight prediction, medical diagnosis or automatic personal nutrient prescription. Without targets the planner can still generate for recipe variety and preferences.

Set meals to include, desired serving portions, dietary pattern, disliked ingredients, explicit allergens/exclusions and maximum preparation time. Initial scope is one adult's portions; household provisioning is separate. Store settings privately under the signed-in owner, available across devices; guest settings remain in memory. No birth date, body measurements, microbiome test or health-condition history required.

Treat exclusions as hard constraints and never silently relax them to fill a week. Unknown ingredients or unresolved compound ingredients cannot qualify a recipe as meeting an exclusion. The interface describes recipe filtering without guaranteeing absence of cross-contact or unlisted ingredients. Incompatible/uncertain recipes remain manually inspectable with explicit explanation.

## Nutrition estimates

Use USDA FoodData Central as the proposed nutrient source. Match ingredients to documented food records, retaining food IDs, raw/cooked state, nutrient units, gram conversions and provenance. Calculation is deterministic from ingredient amounts and recipe yield, not numbers invented by an LLM. An LLM may propose ingredient matches; ambiguous matches need user confirmation or remain unresolved.

Reuse a shared quantity parser for decimals, fractions and ranges. Only supported weight conversions and food-specific documented portion weights are allowed; never assume one cup weighs 240g for every food. Range quantities yield ranges; unknown quantities, oil absorption and unspecified yields remain visible uncertainties. Users can correct servings, quantities or matches, invalidating the affected estimate.

Known nutrition and complete nutrition are distinct. Show Estimate available, Partial estimate or Nutrition unavailable, with the reason and ingredient coverage. Missing values are unknown, not zero. Only recipes whose full required calorie/protein/fibre values and yield are resolved can be used to claim a day meets those targets. For bounded estimates, sum lower and upper bounds separately: the entire daily calorie range must fall within the selected tolerance, and lower protein/fibre bounds must meet their minimum goals. Rank uncertain candidates by their worst-case target deviation; a midpoint cannot establish target satisfaction. These conservative range rules are proposed designer defaults. Show incompleteness beside totals and disable target-met indicators when any included meal lacks required data. Recipes remain manually plannable regardless of coverage.

The USDA key is server-only; keep credentials out of client bundles and logs. Cache food records and recipe estimates with ingredient/yield fingerprints and estimator version. Missing key, provider outage or rate limit must leave manual planning usable and state why nutrition generation is unavailable.

## Gut-health preferences

Offer optional prioritisation of varied plant ingredients, fibre-containing recipes and fermented-food options the person enjoys. Show concrete explanations such as Includes lentils or Adds a different whole grain. Count distinct normalised plant foods in the selected week with an inspectable list; treat this as a descriptive variety measure, not a clinical target or score. Do not equate a fermented ingredient with verified live cultures or claim a meal changes the user's microbiome.

No universal optimal-microbiome score, supplement recommendations, automatic high-fibre prescription or restrictive low-FODMAP/medical diet. Fibre goals are user-entered; explain gradual changes and personal tolerance. Gut-oriented preferences never override exclusions or the user's nutrient targets.

## Generation and review

Generate a day or selected week as a draft. Prefer existing recipes; include enabled slots only. Lock occupied slots by default; users can unlock individual meals before generation. Existing locks, portions and recipes are preserved exactly. If locks make goals infeasible, explain the shortfall and offer edits without changing those meals.

Rank eligible candidates deterministically against target distance, preparation time, repetition and optional plant variety. Initial proposed tolerance is within 10% of the calorie target, with protein/fibre expressed as minimum goals. These are adjustable planning preferences, not a medical definition of adequate nutrition. Do not overfill calories solely to reach a minimum. Show closest available plans and unmet goals rather than claim success or silently invent dishes/amounts. No target is guaranteed when only part of the day's eating is planned; totals are labeled Planned meals, not actual intake.

Allow a selected meal to be swapped without regenerating the rest. Preview the revised day totals before accepting. Apply plan explicitly; closing/cancelling a generation preview does not write anything. Recheck ownership, recipe versions, availability, target/profile version and existing slot versions at application time. Conflicts preserve the current saved plan and ask the user to review a refreshed preview. Applying a week is atomic, so failures never save an unexplained half-plan. Disable repeated Apply while pending.

## New recipe suggestions

Use a server-side recipe-provider adapter and retain source title/URL, attribution, image licence/reference and provider recipe ID. Proposed first provider: TheMealDB, subject to production/commercial entitlement; its test key is development-only. Do not buy a subscription or enable it on production without user authorization and a valid production key. My recipes only remains fully available without a recipe-provider subscription. A curated permissively licensed catalogue can implement the same adapter later.

Retrieve candidates, validate complete measurable ingredients/method/yield, calculate nutrition through the same estimator, then rank. Provider nutrition claims alone do not establish a target match. Unknown yield or incomplete ingredients exclude a candidate from target-led auto-fill. Source availability or sufficient coverage is never guaranteed. No recipe generation from scratch and no unbounded website scraping. Builder chooses bounded query/result budgets and caching; provider terms and capacity must be checked before enabling an adapter.

Display New suggestion distinctly, with source and Why suggested. Dismiss suppresses that provider recipe for the current generation and offers another eligible candidate; lack of alternatives is explicit. Refresh need not persist dismissals. Attribution/source links remain available after planning or saving.

Adding to plan persists a private, immutable suggestion snapshot without creating a visible cookbook recipe. Store that snapshot and its nutrition alongside the plan entry using an additive migration: existing recipe-backed entries remain unchanged. Either recipe ID or snapshot reference is present, never both/neither. Save to cookbook explicitly creates an owner-scoped recipe and can relink that owner's plan entry without duplicate saves. Repeated add/save requests must be idempotent. Removal of a suggestion does not remove an explicitly saved recipe.

## Shopping and portions

Shopping uses all entries and slots in the selected week, including suggestion snapshots, using the person's explicitly planned portions. Show ingredient quantities and conservative unit-aware merging; do not treat an unknown amount as zero. Repeated occurrences contribute separately. This requires the shared quantity/aggregation part of the earlier shopping design. Persistent shopping checkmarks, custom items and household leftovers can remain separate work.

Recipe-detail 1x/2x/3x display controls do not silently alter plan portions. Planning has its own explicit portion setting, with clear relation to original recipe yield; nutrition and shopping derive from the same setting.

## Storage, scope and delivery

Add owner-scoped planner preferences, nutrient-record cache/recipe analysis, plan portion/lock/version metadata and suggestion snapshots. Preserve all existing recipes, photos, collections, accounts and meal entries. No destructive migrations; write integration tests only on a verified non-production database branch. Saved plans retain provenance/analysis version; recipe edits mark linked estimates for recalculation rather than silently retaining stale target badges.

Proposed delivery sequence:
1. Working manual planner: weeks/slots/picker/remove/detail action and owner isolation.
2. Shared quantities, explicit portions, nutrition estimates/coverage and target/preferences setup.
3. Saved-cookbook generation, locks, preview/apply/conflicts and shopping from the selected week.
4. Optional sourced suggestions, private snapshots, attribution and explicit cookbook saving, after source entitlement is configured.

Account/profile and cookbook changes reset private in-memory analysis/generation state. Cancel or an identity change prevents stale requests from applying. Provider calls use server credentials, bounded timeouts and per-owner request budgets. External recipe text is untrusted input, never instructions for tools or database writes.

## Acceptance and limits

- Tests cover dates/timezones, four slots, cross-owner writes/deletes, cancellation and replacement confirmation.
- Nutrition fixtures cover raw/cooked matches, portion units, fractions/ranges, unknown yields/ingredients, stale estimates and absent providers; missing data never produces a complete target badge.
- Generation tests cover impossible goals, locked meals, partial days, exclusions/unknown allergens, repeat constraints, single-meal swap, account switching, atomic application, version conflicts and retry/idempotency.
- Suggested meals survive reload without appearing in the cookbook; Save to cookbook is explicit/idempotent and retains attribution. Shopping includes each occurrence at its planned portions.
- Browser review covers phone/tablet, keyboard, loading/error/empty states, focus restoration and Sunny Kitchen styling. Real iPhone/PWA acceptance remains separate.
- No paid services, keys, production migrations or deployment as part of design work. Review this design before the detailed implementation plan and coding.

## Sources consulted

- USDA FoodData Central API: https://fdc.nal.usda.gov/api-guide/ and https://fdc.nal.usda.gov/faq/ (nutrient lookup, API-key requirement, provenance).
- TheMealDB: https://www.themealdb.com/faq.php and https://themealdb.com/terms_of_use.php (production/commercial access and attribution).
- NIDDK: https://www.niddk.nih.gov/health-information/digestive-diseases/constipation/eating-diet-nutrition (gradual fibre changes).
- Stanford fermented-food trial report: https://med.stanford.edu/news/all-news/2021/07/fermented-food-diet-increases-microbiome-diversity-lowers-inflammation (limited general-health evidence, not personal optimisation).
- AGA IBS diet expert review: https://pubmed.ncbi.nlm.nih.gov/35337654/ (individualised specialist dietary interventions).
