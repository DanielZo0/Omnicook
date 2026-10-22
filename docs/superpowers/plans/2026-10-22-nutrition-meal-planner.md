# Nutrition-led Meal Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking. Recommended here: native execution in the current chat with one independent final review.

**Goal:** Deliver usable week/meal planning, reliable nutrition estimates and optional sourced suggestions while allowing future source replacement.

**Architecture:** Separate manual-planning, nutrition, generation and suggestion modules behind provider-neutral contracts. Keep the existing HTTP database client for ordinary reads; use request-scoped Neon Pool transactions for conditional atomic planner writes. Deliver stages in dependency order, each usable without later providers.

**Tech Stack:** Existing Next.js 16.4.2, React 19, TypeScript, Zod, Drizzle/Postgres, Neon Auth and @neondatabase/serverless. No new UI library.

**Spec:** `docs/superpowers/specs/2026-10-22-nutrition-meal-planner-design.md` (approved 2026-10-22, including replaceable-source requirement).

## Global Constraints

- Preserve Sunny Kitchen styling and all existing cookbook/import/account behavior.
- Four slots, one entry per owner/calendar date/slot; Monday–Sunday local calendar dates.
- Existing occupied entries are locked by default for generation. Apply is explicit, atomic, owner-scoped and version checked.
- Calories: configurable tolerance initially 10%; protein/fibre: optional minimums. Whole calorie range and lower protein/fibre bounds determine satisfaction; unknown is never zero.
- No automatic nutrient prescription, calorie deficit, medical diet, microbiome score or generated recipes.
- Source adapters, credentials and selection are server-side. References/cache keys include provider ID, external ID and normalisation version.
- Historical plans retain provenance/estimates; switching sources does not silently rewrite stored records. Respect provider retention/attribution terms.
- USDA API key and commercial recipe-provider entitlement are release gates, not authorization to purchase/provision services.
- Non-production branch only for integration writes. No destructive migration or production release without separate authorization.

## Review Focus

1. Recipe edits/deletions during preview must produce conflict or invalidation, never apply stale nutrition (tasks 3/5).
2. Concurrent planner clients and retried Apply requests must not overwrite silently or duplicate snapshots (tasks 1/5/7).
3. Same external IDs from different providers cannot collide or expose another owner's private record (tasks 2/7).
4. Ranges, unknown quantities and partial-day planning cannot show misleading target success (tasks 2/3/5).
5. Identity switch while picker/generation/save is pending must clear private data and reject stale responses (tasks 4/6/8).

## Files and staged boundaries

- `src/lib/planner/{types,dates,schemas,repository,generate,generation-store}.ts`: neutral plan contracts, validated dates, transactions and deterministic draft generation.
- `src/lib/db/planner-transaction.ts`, `src/lib/db/schema.ts`, `scripts/migrate-nutrition-planner.mjs`: request-scoped transactions and additive schema.
- `src/lib/nutrition/{types,quantity,estimate,targets,repository}.ts`, `src/lib/nutrition/providers/{registry,usda}.ts`: normalized food/analysis data and replaceable nutrient providers.
- `src/lib/suggestions/{types,repository,service}.ts`, `src/lib/suggestions/providers/{registry,themealdb}.ts`: optional real-recipe discovery, normalized snapshots and explicit saving.
- `src/lib/shopping/build-list.ts`: selected-week structured shopping, including suggestions and portions.
- `src/app/api/meal-plan/route.ts`, `src/app/api/planner/{preferences,generate,apply}/route.ts`, `src/app/api/nutrition/{analyze,matches}/route.ts`, `src/app/api/planner/suggestions/[id]/save/route.ts`: owner-checked boundaries.
- `src/components/planner/{Planner,RecipePicker,PlanRecipeDialog,PlannerSettings,NutritionSummary,GenerationPreview,SuggestionCard}.tsx`: focused UI. `src/app/page.tsx` coordinates screen/detail entry only.
- `src/lib/api/client.ts`, `src/lib/mobile/{adapters,demo-data}.ts`, `src/app/styles.css`: preserve raw ingredient/yield data, client helpers and Sunny Kitchen integration.
- Tests stay in existing `tests/*.test.cjs` using `register-ts.cjs`; integration runner in `scripts/check-nutrition-planner.mjs`.

## Shared interface decisions

Define these in task 1/2 before consumers. Use Zod schemas as runtime validators and infer TS types; don't duplicate validators in UI.

`MealSlot = 'breakfast'|'lunch'|'dinner'|'snack'`; `CalendarDate` is a real validated YYYY-MM-DD date. `SourceRef = {providerId, externalId, normalizationVersion, retrievedAt, sourceUrl, attribution}`. `Range = {min:number,max:number}` with finite nonnegative ordered bounds.

`NutritionEstimate = {status:'complete'|'partial'|'unavailable', nutrients:{kcal:Range|null,proteinG:Range|null,fibreG:Range|null,carbohydrateG:Range|null,fatG:Range|null}, missing:string[], fingerprint:string, estimatorVersion:string, sources:SourceRef[]}`. Values are per recipe batch; derive a person's portion by dividing by known positive yield and multiplying explicit planned servings.

`PlannableRecipe = {key,title,ingredients:StructuredIngredient[],steps,servings:number|null,prepMinutes:number|null,cookMinutes:number|null,category,source,revision,nutrition,plantFoods:string[],fermentedFoods:string[],exclusionStatus:'eligible'|'excluded'|'unknown'}`. `source` discriminates cookbook ID from provider snapshot; never use an external ID as a cookbook UUID. `StructuredIngredient` retains quantity/unit/name/notes/aisle separately.

`PlanEntry = {id,plannedFor,mealSlot,source:{kind:'recipe',recipeId}|{kind:'suggestion',snapshotId},servings:number,locked:boolean,version:number}`. Unknown original recipe yield stays unknown; `servings` defaults to 1 person's serving, never converts an unknown yield into known nutrition.

`PlannerPreferences = {version:number,kcalTarget:number|null,calorieTolerance:number,proteinMinimumG:number|null,fibreMinimumG:number|null,enabledSlots:MealSlot[],servings:number,dietaryPattern:string|null,excludedIngredients:string[],dislikedIngredients:string[],maxPreparationMinutes:number|null,prioritizePlantVariety:boolean,includeFermentedOptions:boolean}`. Validate finite positive targets/servings/time, tolerance in (0,1), bounded arrays/text and at least one enabled slot.

`PlannerState = {weekStart,revision,entries,preferences,recipes}`. `GeneratedPlan = {id,ownerKey,expiresAt,baseRevision,preferenceVersion,recipeRevisions,entries,daySummaries,unmetGoals}`. Persist server draft with 30-minute TTL; guest generation stays in memory. API Apply accepts generation ID plus idempotency key, never trusted client-provided nutrient data.

## Task 1: Owner-safe manual planner storage and API

**Files:** Create planner types/dates/schemas/repository, planner-transaction helper and migration; modify DB schema, meal-plan route and API client; create `tests/planner-dates.test.cjs`, `tests/planner-api.test.cjs` and integration runner.

**Interfaces:** `weekDates(date:CalendarDate):CalendarDate[]`, `shiftWeek(start:CalendarDate,offset:number):CalendarDate`; `getPlannerWeek(ownerId,start):Promise<PlannerState>`; `putPlanEntry(ownerId,input,expectedRevision):Promise<PlannerState>`; `removePlanEntry(ownerId,id,expectedRevision):Promise<PlannerState>`.

- [ ] Write failing tests for valid/invalid leap dates, Sunday/Monday/month/year rollover and east/west UTC date stability. Run `node --test tests/planner-dates.test.cjs`; require failure on missing helpers.
- [ ] Implement date helpers without local-midnight `toISOString()` conversion; rerun date tests until green.
- [ ] Write route/integration assertions: foreign recipe/entry rejected, invalid date400, anonymous401, expected revision conflict409, failed write retains state, retried removal cannot delete a replacement. Run tests to observe failure.
- [ ] Add owner state and plan versions/portions/lock metadata. Backfill existing owner state and default servings1/lockedtrue/version1; preserve all existing rows. Every mutation increments owner revision under a row lock, including existing POST callers. Preferences, generation and snapshot tables arrive in tasks3/5/7 respectively; task1 uses the validated default preference object.
- [ ] Keep ordinary reads on current HTTP client. Implement `withPlannerTransaction<T>(fn):Promise<T>` with a request-scoped Neon Pool/client, BEGIN/COMMIT, rollback on any failure and release/end in finally. Never assume neon-http supports interactive transactions. Recheck recipe ownership within transaction; serialize edits through the owner state row.
- [ ] Preserve existing API compatibility while adding selected-week reads, revisioned writes and owner-scoped DELETE. Client calls expose typed conflicts. Run unit tests and integration runner only after verifying branch identity and applying migration there; compare pre/post fixture-free legacy counts/hashes.
- [ ] Commit only the task's specific files: `feat: add intentional owner-scoped meal planning`.

## Task 2: Shared quantities and provider-neutral nutrition contracts

**Files:** Create nutrition types/quantity and provider registry, suggestion types/registry, `tests/quantities.test.cjs`, `tests/provider-contracts.test.cjs`; modify mobile adapters/types to retain structured ingredients and nullable yield.

**Interfaces:** `parseQuantity(value:string|null):Range|null`; `scaleQuantity(value:string|null,factor:number):string|null`; `NutrientProvider {id,normalizationVersion,search(query,signal):Promise<FoodCandidate[]>,getFood(id,signal):Promise<FoodRecord>}`; `RecipeSuggestionProvider {id,normalizationVersion,search(query,signal):Promise<SourcedRecipe[]>}`. FoodRecord has SourceRef, explicit food state, nutrients per100g and documented food-specific portion weights. SourcedRecipe retains complete source/attribution/licence, structured ingredients, steps and nullable yield.

- [ ] Write failing quantity tests: 2×`2–3`→`4–6`, `1/2`→`1`, `1 1/2`→`3`, `½`→`1`; preserve `to taste`, malformed strings and original text at1×; no positive tiny amount rounds to0. Run `node --test tests/quantities.test.cjs` and observe failure.
- [ ] Implement exact or high-precision parsing/ranges/scaling; don't alter the extraction matcher's existing rational rules. Use the helper for detail/cooking scaling as well as later shopping.
- [ ] Write failing adapter contract tests with two fixture providers sharing external ID123: normalized output valid, keys distinct, source swapping leaves consumer shape unchanged, no server key accepted from UI, unsafe URLs rejected.
- [ ] Implement server-only allowlisted registries selected by environment configuration, with separate NUTRIENT_PROVIDER / RECIPE_SUGGESTION_PROVIDER IDs and per-provider secrets. Unknown/disabled provider returns typed unavailable. Store/cache by provider+externalId+normalizationVersion; public catalogue cache must not contain private user text.
- [ ] Run both focused test files and the full existing suite; commit `feat: add source-neutral nutrition and recipe contracts`.

## Task 3: Provenance-backed estimates, targets and preferences

**Files:** Create nutrition estimate/targets/repository, USDA adapter, nutrition analyze/matches routes, planner preferences route and tests `nutrition-estimates`, `nutrition-targets`, `nutrition-providers`.

**Interfaces:** `estimateRecipe(recipe,confirmedMatches):NutritionEstimate`; `evaluateDay(entries,preferences):DaySummary`; `analyzeRecipe(ownerId,recipeId):Promise<NutritionEstimate>`; `confirmFoodMatch(ownerId,recipeId,ingredientPosition,foodRef,expectedFingerprint)`; owner-scoped preferences GET/PUT with expected version.

- [ ] Write failing numeric fixtures: 200g of100kcal/100g=200kcal batch; known yield4 and planned servings1=50kcal; unknown yield or ingredient quantity gives partial/unavailable, never zero. Raw/cooked mismatch and generic cup-to-gram conversion rejected; documented food-specific portion accepted.
- [ ] Add target fixtures: target2000±10% allows[1800,2200], rejects[1799,2200]; protein goal60 rejects lower bound59 even if midpoint exceeds60; missing value or partially planned day cannot show full-day goal met. No targets still allows variety-only generation.
- [ ] Add provider fixtures: timeout/429/missing key retain manual planning; ambiguous food matches require explicit choice; ingredient/serving edit invalidates fingerprint; switching providers or normalisation version separates caches and leaves historical snapshots unchanged. Run focused tests and observe missing implementations fail.
- [ ] Implement USDA through normalized contract only, bounded requests/timeouts and per-owner budgets. Default prefer documented generic food records over unrelated branded products. No LLM-made nutrient values or inferred portion weights; optional matching intelligence can be added later behind an explicit matcher.
- [ ] Persist private confirmed ingredient matches/analyses, immutable analysis history and owner preferences via additive schema. Mutation increments relevant versions; stale match confirmations409. Recipe edits/deletions invalidate linked active analyses/generations without deleting historical provenance.
- [ ] Run focused tests, non-production owner-isolation integration tests and full suite; commit `feat: estimate recipe nutrition with explicit coverage`.

## Task 4: Manual planner and settings UI

**Files:** Create Planner, RecipePicker, PlanRecipeDialog, PlannerSettings and NutritionSummary; modify page coordinator, API client, styles; create `tests/planner-ui-state.test.cjs` for pure state transitions.

**Interfaces:** Planner receives `PlannerState`, owner/session identity and typed save/remove callbacks; dialogs return explicit confirmed payloads or cancellation. UI uses task1 dates and task3 estimates, with no provider-specific fields.

- [ ] Write failing state tests for cancel=no write, explicit add/change, occupied-slot replace confirmation, removal confirmation, server conflict retaining prior state, guest in-memory namespace and identity-switch cancellation.
- [ ] Replace `cycleDay`, fixed currentWeek and day-name keyed demo plan. Add dates, week navigation/This week, four-slot selector, picker search/preview/confirm, remove/open, date-slot action from recipe detail. Persist per-entry portions/locks; keep detail display multipliers independent.
- [ ] Add settings with optional calorie/protein/fibre targets and preferences. Show planned-meal estimates, missing data, coverage reasons, confirm/correct match action and inspectable weekly plant-food variety. Keep general gut-health explanations factual; no clinical scores or forced target defaults.
- [ ] Reset planner/picker/settings and pending-response tokens on owner identity change, even when signedIn remains true. Use account-keyed fetch state rather than only a signedIn boolean effect.
- [ ] Run state tests and browser walkthrough on integration branch at320/393/768/820/1024/1366, checking focus restoration, keyboard/Escape and long titles; commit `feat: build usable weekly menu and nutrition settings`.

## Task 5: Deterministic cookbook generation and atomic Apply

**Files:** Create generate/generation-store, planner generate/apply routes, `tests/planner-generation.test.cjs`, `tests/planner-apply.test.cjs`; extend repository, `src/app/api/recipes/[id]/route.ts` and integration runner.

**Interfaces:** `generatePlan(state:PlannerState,request:GenerationRequest):GeneratedPlan`; request identifies day/week, enabled slots, explicitly unlocked entries, source mode and optional single swap target. `applyGeneration(ownerId,generationId,idempotencyKey):Promise<PlannerState>`.

- [ ] Write failing fixtures: hard exclusions/unknown compound ingredients never auto-qualify; max total prep+cook time enforced, unknown time excluded when a limit is set; locked entries preserved exactly; impossible goals/empty cookbook/partial-day targets explained; deterministic tie-breaks; swap changes only one slot; incomplete nutrition cannot claim target fit.
- [ ] Implement bounded deterministic search (beam width50, max40 eligible candidates per slot, stable ID ordering) with worst-case calorie deviation and minimum-goal deficits before variety/repetition preferences. Initial portions candidates are0.5/1/1.5/2 servings unless user explicitly fixes portions. Never change locked portions. Empty eligible slots remain unfilled with reasons; no silent constraint relaxation.
- [ ] Store immutable preview with owner/TTL/revision/preferences/recipe fingerprints, computed summaries and sources. Reject client-injected nutrient totals or cross-owner generation IDs.
- [ ] Write failing transaction assertions for expired preview, changed owner/profile/recipe/slot, deleted recipe, doubled Apply, concurrent writers and injected mid-batch failure: no half-plan survives, duplicates return the original outcome, conflicting requests409.
- [ ] Implement Apply under owner-row lock with checks and all writes in the same transaction, owner-scoped idempotency record keyed to generation ID and request digest. A reused key with a different generation409. Recipe mutations must participate in the version/lock protocol, not merely update a timestamp after validation. Rollback snapshots and entries together.
- [ ] Run generation tests and integration assertions against isolated branch; commit `feat: generate and atomically apply nutrition-led plans`.

## Task 6: Generation preview and quantity-aware shopping

**Files:** Create GenerationPreview, shopping build-list, `tests/shopping-builder.test.cjs`, `tests/planner-preview.test.cjs`; integrate Planner and existing shopping screen.

**Interfaces:** `buildShoppingList(entries:ResolvedPlanEntry[]):ShoppingRow[]`, where each entry exposes structured ingredients, nullable original yield and explicit planned servings. Preview displays immutable draft; accept applies task5; dismiss writes nothing.

- [ ] Write failing shopping tests: repeated recipe occurrences multiply; 200g+200g flour=400g; g/grams aliases merge; 200g+1cup remain separate; different notes remain visible; null/unknown yields show unscaled full-recipe contributions with explanation rather than invented per-person quantities. Include all slots in selected week.
- [ ] Implement ingredient-name whitespace/case normalization, conservative unit aliases and range-aware contributions. Retain source meal references. Use the same portion calculation as nutrition; unknown yield has no misleading scaled total.
- [ ] Write preview tests for Cancel=no writes, unchanged locked meals, disabled repeated Apply, conflict/retry and stale response after account switch. Implement day/week Generate, source-mode choice, lock/unlock, per-meal swap, updated summaries, unmet goals and explicit Apply.
- [ ] Browser-test empty/provider-disabled states and week/slot switching. Preserve pending/failed UI without pretending success; commit `feat: review generated plans and build weekly shopping quantities`.

## Task 7: Replaceable sourced suggestions and private plan snapshots

**Files:** Implement TheMealDB adapter, suggestion service/repository/save route and SuggestionCard; extend plan schema/repository/generator/shopping; create `tests/suggestions.test.cjs`, `tests/suggestion-save.test.cjs`.

**Interfaces:** `findSuggestions(ownerId,query,preferences):Promise<PlannableRecipe[]>`; `saveSuggestionToCookbook(ownerId,snapshotId,idempotencyKey):Promise<{recipeId:string}>`. Source metadata remains SourceRef/provider neutral throughout UI/planner.

- [ ] Write failing fixtures for provider missing/disabled, malformed/incomplete recipe, unknown yield, missing licence/attribution, exclusions and disallowed source URLs. Unsupported recipes can be previewed but cannot count as meeting nutrition targets. Provider outage returns existing cookbook alternatives and explicit explanation.
- [ ] Implement bounded provider adapter (max2 queries/30 normalized candidates per generation, shared15s discovery deadline), source-only caching, normalization/validation and task3 nutrition before ranking. Respect per-provider entitlement/configuration; never use development test keys in production. TheMealDB may lack yield data: leave such recipes ineligible for target-led auto-fill instead of guessing servings.
- [ ] Extend additive schema with nullable recipe FK and snapshot FK plus exactly-one check. Snapshot is owner-scoped/immutable, retains ingredients/method/yield/estimate/source/attribution/image rights, and is created atomically with Apply. Keep original recipe-backed rows unchanged and retain delete-recipe behavior for those entries.
- [ ] Test reload after plan-only save does not add a cookbook recipe; explicit Save creates exactly one and retains provenance, source-disabled historical plans still render, and foreign snapshots404. Repeated apply/save uses DB uniqueness/idempotency, not only UI disabling. Optional relink and recipe creation are one transaction.
- [ ] Test switching to a fixture second recipe provider with the same external IDs needs no planner/UI change; source retention restrictions must be satisfied before enabling that provider. Browser-check attribution/dismiss/swap/add/save and suggestion shopping contributions.
- [ ] Run unit+isolated integration suite; commit `feat: add sourced meal suggestions without automatic cookbook saves`.

## Task 8: Integrated verification and handoff

**Files:** Extend integration runner and `.env.example` (key names/placeholders only); create `docs/testing/2026-10-22-nutrition-planner.md` with actual results and unmet gates.

- [ ] Run `npm test`, `npx tsc --noEmit`, `npm run build -- --webpack`; require all pass. Run two-account route/SQL checks against verified disposable branch and remove only its fixtures. Verify legacy rows/photos/collections preserved.
- [ ] Walk through manual→generate→preview→apply→shopping, detail→plan, suggested plan→reload→explicit save, recipe edits and concurrent Apply. Switch between two identities while each async action is pending and confirm no private state leaks.
- [ ] Verify keyboard/dialog focus, narrow/landscape phone, tablet/sidebar, provider absence, full nutrition coverage versus unknowns, language/units/raw-cooked variants and long recipe names. No source credentials in client bundles or logs.
- [ ] Check source adapters can be disabled/swapped independently, historical provenance still renders, versioned re-analysis is explicit, and no account permissions or provider settings changed outside this scope.
- [ ] Request one independent whole-change review; fix substantive findings with failing→passing regressions. Record actual iPhone/PWA and external-provider gates honestly; lack of keys must not be described as live integration acceptance.
- [ ] Update DevWiki status/next/decisions/open threads/log and commit vault. Leave application ready for review; push/merge/deploy or production migrations only when separately requested.

## Plan self-review / execution notes

Checked spec coverage, contracts, named helpers/files and staged dependencies. Provider replacement explicitly covers normalized contracts, reference/cache collisions, credentials, persisted provenance and versioned re-analysis. Target ranges, partial days, unknown yields and source entitlements have owning tests. No implementation performed.

Existing database client is neon-http; interactive writes need the separate request-scoped Pool helper rather than an unsupported ORM transaction call. Reference: https://github.com/neondatabase/serverless/blob/main/README.md (verify runtime/WebSocket support at execution time). No paid source or production migration is implied by plan approval.
