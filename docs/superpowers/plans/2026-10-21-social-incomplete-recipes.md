# Incomplete Social Recipe Imports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for native execution, or superpowers:subagent-driven-development if the user selects delegation. Steps use checkbox syntax for tracking. Implementation completed locally on 2026-10-22; browser acceptance remains blocked. See docs/testing/2026-10-22-social-imports.md.

**Goal:** Recover matching full recipes from creator websites and retain honest, recoverable incomplete imports when instructions are unavailable.

**Architecture:** Separate editable drafts from saveable recipes and add a budgeted import orchestrator over the existing safe source reader and configured AI providers. Discovery only visits creator-linked sites, matching is conservative, and the existing editor receives complete or incomplete results. Extend the owner-scoped recipe API with nullable original-recipe provenance.

**Tech Stack:** Next.js 16.3.8 App Router, React 19, TypeScript, Zod, Drizzle/Neon, existing four extraction providers, node:test. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-10-20-social-incomplete-recipes-design.md` (approved 2026-10-21).

## Global Constraints

- No invented ingredients/instructions, transcription, broad web search, new paid services or production changes.
- Preserve requested-post scoping, public DNS validation/pinning, redirect and 2,000,000-byte limits. Maximum five additional HTML requests including redirects, maximum three candidate recipe pages.
- Shared limits: cumulative source work 18,000 ms; cumulative AI work 36,000 ms; overall work deadline 54,000 ms; route maxDuration 60 seconds. Provider repair consumes the same AI allowance.
- Automatic matching: same dish name, at least three quantified ingredient-name matches, at least 80% coverage of the caption's quantified ingredients, no conflicting overlapping quantities, actual complete method, exactly one confident candidate. Do not assume scaled yields or count/weight equivalence.
- Source URL remains the submitted social post; nullable originalRecipeUrl records the verified website recipe. Keep both through save/load/edit.
- Incomplete drafts remain device-local and cannot become saved recipes. No migrations or fixture writes against production. Integration writes require a verified isolated database branch.
- Read relevant installed Next.js guides under `node_modules/next/dist/docs/` before product edits; honor the project's AGENTS.md.
- Existing complete imports, manual editing, photo jobs and account isolation must retain their behavior.

## Review Focus

1. Italian complete method with no English cooking verbs; do not reject using lexical heuristics (Tasks 1/3).
2. Ambiguous duplicate candidates, ingredient quantity conflicts and unknown units; do not silently select the first (Tasks 2/3).
3. Redirects, slow response bodies and repairs consume the same limits; preserve the caption on exhausted discovery (Tasks 2/3).
4. Account changes or new edits while an import is pending; stale responses cannot replace another account's/current draft (Tasks 4/5).
5. Legacy records and partial PATCH payloads retain provenance and user-uploaded photos (Task 6).

## File map and dependency order

1. Import data contract and provider modes: `src/lib/extraction/import-schema.ts`, `prompt.ts`, `provider.ts`, `groq.ts`, `nvidia.ts`, `xai.ts`, `gemini.ts`.
2. Safe network budgets, discovery and matching: `src/lib/extraction/import-budget.ts`, `fetch-source.ts`, `source-page.ts`, `discover-original.ts`, `match-recipe.ts`.
3. Import orchestration/API: `src/lib/extraction/import-recipe.ts`, `src/app/api/import/route.ts`.
4. Shared draft recovery: `src/lib/recipes/draft-storage.ts`, `src/components/recipes/DraftRecovery.tsx`, `src/components/ConfirmDialog.tsx`.
5. Editor flow: `src/components/recipes/RecipeEditor.tsx`, `src/app/page.tsx`, `src/app/styles.css` only as necessary.
6. Persisted provenance: `src/lib/db/schema.ts`, `src/lib/photos/service.ts`, recipe routes, API client, mobile types/adapters and migration script.

Tasks execute in that order except Task 6 can precede Task 5 if needed for the save interface. Each task gets a focused failing-test cycle and its own commit. All files named Create below are currently absent; preserve unrelated untracked scripts/docs.

## Task 1: Separate partial extraction from recipe persistence

**Files:** Create `src/lib/extraction/import-schema.ts`, `tests/import-schema.test.cjs`; modify `src/lib/extraction/{prompt,provider,groq,nvidia,xai,gemini}.ts`, `tests/provider.test.cjs`. Keep `src/lib/recipe-schema.ts`'s complete-recipe validation strict.

**Interfaces:** Export `editableRecipeSchema` with RecipeDraft's field types but steps allowed empty and empty editor title/ingredient placeholders allowed. Export `EditableRecipeDraft` as its inferred type. Export `importExtractionSchema` requiring a nonblank title and at least one named ingredient, plus `completeness:'complete'|'incomplete'` and `missingFields:('ingredients'|'instructions')[]`; complete results must pass recipeSchema, incomplete results must identify missing source content. Export `ImportExtraction`. Introduce optional `ExtractionOptions.mode:'recipe'|'import'`, default recipe, and `systemPromptFor(mode)`; existing provider.extract signature remains compatible. Import mode allows source-backed partial output and explicitly requires incomplete status for a visibly unfinished method. Never fabricate a placeholder step.

Example required assertion (use it inside a named node:test case):

```js
const partial = {title:"Nascondini",ingredients:[{position:0,name:"farina",quantity:"350",unit:"g"}],steps:[]};
assert.equal(recipeSchema.safeParse(partial).success, false);
assert.equal(importExtractionSchema.safeParse({...partial,completeness:"incomplete",missingFields:["instructions"]}).success, true);
assert.equal(importExtractionSchema.safeParse({...partial,completeness:"complete",missingFields:[]}).success, false);
```

- [x] Write tests asserting empty steps pass editable/import-incomplete validation but fail recipeSchema; blank title/ingredient-only noise fails import validation; complete status with no steps fails; unfinished source cannot be reported complete in provider fixtures; a complete Italian recipe passes with no English verbs.
- [x] Run `node --test tests/import-schema.test.cjs tests/provider.test.cjs`; observe the new failures.
- [x] Implement schemas, mode-specific prompts and validation repair. Thread mode through all providers and preserve it on repair. Keep refusal objects distinct from recoverable partial recipes. Normalize explicit refusal/empty output into a typed no-content result at the orchestrator boundary, never into a fabricated draft.
- [x] Re-run focused tests. Add per-provider request assertions for correct prompt mode; existing recipe callers retain their original prompt/validation. Verify body timeout and token-cutoff tests remain passing.
- [x] Commit `feat: extract source-backed incomplete recipe drafts`.

## Task 2: Bound creator-site discovery and match actual recipes

**Files:** Create `src/lib/extraction/{import-budget,discover-original,match-recipe}.ts`, `tests/{import-budget,original-discovery,recipe-match}.test.cjs`; modify `fetch-source.ts`, `source-page.ts`, `tests/extraction.test.cjs`.

**Interfaces:** `createImportBudget(now?:()=>number)` returns `ImportBudget` with `runSource<T>(work:(signal:AbortSignal)=>Promise<T>):Promise<T>`, `runAI<T>(work:(remainingMs:number)=>Promise<T>):Promise<T>`, `takeAdditionalRequest():void`, and `remainingOverallMs():number`. Enforce the exact global limits and settle/cancel timers in finally. Export `readSource(source:string,budget:ImportBudget):Promise<SourceDocument>` where `SourceDocument={sourceUrl:string|null;imageUrl:string|null;text:string;page:ReturnType<typeof parseSourcePage>|null}`. Keep resolveSource's public compatibility until Task 3 migrates its caller. Social readSource accepts meaningful requested-post text without requiring English recipe words; empty/login shells still fail.

`parseSourcePage` additionally returns `links:{url:string;text:string}[]` and `searchForms:{action:string;queryName:string;hidden:Record<string,string>}[]` from bounded HTML inspection. A supported form uses GET, a named search input (type=search or name=s/q/search), safe same-origin action and public HTTP(S). Ignore password/file inputs, POST forms and script actions. Existing caption and structured data scoping is unchanged.

`discoverOriginal(source:SourceDocument,dishName:string,budget:ImportBudget):Promise<SourceDocument[]>` enumerates at most three candidates on explicitly caption-linked creator origins. Extract links from caption text, including bare www hostnames; never ask the model for a URL. Prefer explicit dish links, otherwise homepage then its advertised search form. A link cannot broaden creator origin except www canonicalization. Redirects consume the five additional request limit, including failed responses. Only candidate pages with useful content are returned; errors remain diagnostic reasons, not destructive replacements.

`matchRecipe(caption:ImportExtraction,candidate:ImportExtraction):{matches:boolean;reason:string}` is pure. Normalize Unicode/case/diacritics, punctuation/whitespace and compare full dish-name token sets; generic recipe modifiers may be stripped only from this initial exact set: Italian 'fatti in casa', 'fatte in casa', 'ricetta', 'ricette', 'come fare'; English 'homemade', 'recipe', 'recipes', 'how to make'. Strip whole phrases, never arbitrary tokens. Empty resulting names never match. Ingredients match normalized names conservatively, with section notes retained to disambiguate repeated ingredients. Parse exact decimal/fraction quantities, comma decimals, common fraction glyphs and explicit g/kg/ml/l aliases. Count equals count only; unknown units can match only identical normalized unit text and parsed quantity. Conflicting comparable quantities veto. Unparseable quantified entries count against coverage; don't remove them from the denominator. Fraction comparison uses exact rational values. Duplicate ingredient sections require one-to-one matching rather than reusing one candidate ingredient. Yield mismatch vetoes if both yields are numeric and explicit; unparseable yield ranges are retained as source text rather than made into a number.

Required budget regression:

```js
let now = 0;
const budget = createImportBudget(() => now);
await budget.runSource(async () => { now += 17999; return "caption"; });
now += 1;
await assert.rejects(budget.runSource(async () => "too late"));
```

- [x] Write fixture tests for reported-caption creator URL, homepage advertised search, absent search fallback, unsupported POST/search destination, malicious link/redirect, duplicate candidates, 350g=0.35kg, 1/2=0.5, decimal comma, unknown unit, count/weight refusal, 80% boundary, duplicate milk in separate sections, two versus three quantified matches and conflicting quantities/yield.
- [x] Add fake-clock/slow-body tests proving source/AI time is cumulative, repair receives remaining allowance, a sixth extra request never starts, and overall timeout aborts outstanding work. Initial social request redirects retain the existing five-redirect bound; additional discovery uses its shared five-request counter.
- [x] Run `node --test tests/import-budget.test.cjs tests/original-discovery.test.cjs tests/recipe-match.test.cjs tests/extraction.test.cjs`; confirm new failures.
- [x] Implement helpers through the existing pinned safe fetcher; no second unrestricted fetch path. Candidate deduplication uses canonical final URL. Retain all candidates until uniqueness is known; if the budget prevents evaluation of another viable candidate, remain incomplete rather than claiming uniqueness.
- [x] Re-run focused tests and commit `feat: discover and conservatively match creator recipes`.

## Task 3: Orchestrate complete and incomplete imports

**Files:** Create `src/lib/extraction/import-recipe.ts`, `tests/import-flow.test.cjs`; modify `src/app/api/import/route.ts`, `src/lib/extraction/provider.ts`.

**Interfaces:** Export `ImportResult={ok:true;status:'complete'|'incomplete';draft:EditableRecipeDraft;missingFields:('ingredients'|'instructions')[];sourceUrl:string|null;originalRecipeUrl:string|null;imageUrl:string|null;message?:string}`. Export `importRecipe(input:{source:string;captionDraft?:ImportExtraction;originalRecipeUrl?:string},provider:ExtractionProvider,budget?:ImportBudget):Promise<ImportResult>`. Add discriminated no-content and provider-error failure responses, preserving existing route status codes (400 input, 422 no useful recipe, 502 provider failure, 503 unconfigured). Valid incomplete results return HTTP 200 and ok:true, never masquerade as an error report.

Automatic flow: read requested source, analyze in import mode within runAI, return if complete, otherwise discover and analyze candidates under the same budget, select exactly one complete matching candidate. Preserve original social URL, accepted website final URL and website image. Use candidate's full source-backed recipe; show a message when candidate adds ingredients beyond caption. If no unique match, return the original partial draft with reason. Do not spend another model call after the AI allowance is exhausted. If no validated partial draft exists after provider failure, use an actionable error; client retains its previous editable draft.

Manual original-link flow: client submits source plus captionDraft and originalRecipeUrl; validate every nested field, bound text and re-read supplied URL safely. Treat this endpoint as public untrusted input; captionDraft only governs matching, never network destinations. A mismatch returns an incomplete result with `replacementCandidate?:ImportCandidate`, where `ImportCandidate=Omit<ImportResult,'replacementCandidate'>` for explicit client confirmation. Do not automatically combine quantities from different recipes.

- [x] Add orchestrator tests using injected provider and mocked safe fetch: reported Instagram-to-creator fixture completes with both links and exact quantities; Italian caption completes directly; ingredients-only stays partial; unmatched/ambiguous/unreadable/budget-exhausted discovery retains original ingredients/known steps. Verify a supplied mismatch is only a replacement candidate and a failed manual URL leaves the existing draft available.
- [x] Run `node --test tests/import-flow.test.cjs`; confirm failure, implement route/orchestrator, then run all extraction/provider tests.
- [x] Verify route still exports maxDuration=60; no database writes, provider selection changes or logging of recipe text. Commit `feat: return recoverable partial social imports`.

## Task 4: Recover incomplete drafts safely across refresh and identity changes

**Files:** Create `src/lib/recipes/draft-storage.ts`, `tests/draft-storage.test.cjs`, `src/components/recipes/DraftRecovery.tsx`, `src/components/ConfirmDialog.tsx`.

**Interfaces:** Share the older UX plan's `StoragePort`, `DraftOwner={kind:'guest'}|{kind:'user';userId:string}`, `readDraft(storage,owner,now)`, `writeDraft(storage,value)`, `clearDraft(storage,owner)`. Keys remain `omnicook:draft:v1:guest` / `omnicook:draft:v1:user:<userId>`. StoredDraft keeps version=1, owner, updatedAt/expiresAt, editable draft, sourceUrl/imageUrl, editRecipeId/collectionId and sourceText; add originalRecipeUrl, importStatus and missingFields with backward-compatible defaults. Expiry exactly 24 hours for guests, seven days for accounts. Validate editable rather than complete schema; existing manually blank drafts remain recoverable. API payloads still use strict recipeSchema.

Compatibility note: the older UX plan is unimplemented. Its blanket prohibition on persisting draft text conflicts with its own StoredDraft/sourceText and the approved recovery behavior; for this feature, consented device-local recipe/source text is explicitly allowed, while credentials/auth tokens/email remain forbidden. Do not edit or implement unrelated UX tasks. If that older plan is executed later, reuse this helper and these extended interfaces.

Required isolation assertion after writing a valid guest draft:

```js
assert.equal(readDraft(storage, {kind:"user",userId:"account-b"}, now), null);
assert.equal(readDraft(storage, {kind:"guest"}, now + 24*60*60*1000), null);
```

The case constructs storage with a Map-backed getItem/setItem/removeItem and writes updatedAt=now, expiresAt=now+24 hours; use a validated partial import from Task 1.

- [x] Write in-memory tests for incomplete steps, expired drafts at exact boundaries, corrupt JSON/version/owner, B cannot read A, guest recovery is explicit, unavailable storage returns `{ok:false;reason:'unavailable'}`, legacy stored payload defaults, and clear only removes its owner's entry. readDraft returns null for invalid data, writeDraft never throws, clearDraft returns boolean.
- [x] Run `node --test tests/draft-storage.test.cjs`; confirm failure, implement helper plus accessible recovery/confirmation components. Offer Keep editing / Discard and Continue this recipe; do not auto-bind guest data to an account or auto-save.
- [x] Verify focused tests and commit `feat: retain account-scoped incomplete import drafts`.

## Task 5: Review and complete partial recipes in the editor

**Files:** Create `src/components/recipes/RecipeEditor.tsx`, `src/lib/recipes/import-review.ts`, `tests/import-review.test.cjs`; modify `src/app/page.tsx` and narrowly scoped styles if necessary.

**Interfaces:** Extract the existing editor preserving its controls. Props: `value:EditableRecipeDraft`, `onChange(value)`, `onSave()`, `onDiscard()`, `saving:boolean`, `importResult:ImportResult|null`, `onResolveOriginal(url:string)`. `canSaveDraft(value):boolean` uses recipeSchema.safeParse, not merely nonempty steps. `ImportRequestStamp={ownerKey:string;revision:number;requestId:number}` and `shouldApplyImport(start:ImportRequestStamp,current:ImportRequestStamp):boolean` rejects stale async results on identity/revision/request changes. Track revision after every edit, discard and recovery. Existing recipe edits retain editRecipeId and source provenance.

Required stale-result regression:

```js
const start = {ownerKey:"user:a",revision:1,requestId:2};
assert.equal(shouldApplyImport(start,{...start,revision:2}), false);
assert.equal(shouldApplyImport(start,{...start,ownerKey:"user:b"}), false);
assert.equal(shouldApplyImport(start,start), true);
```

- [x] Write tests asserting incomplete recipe Save disabled, manual steps enable Save only when all fields pass strict validation, empty instructions do not count, stale request/new edits/account switches preserve current state, mismatching candidate requires explicit replacement, and failure retains all edits/links. Run `node --test tests/import-review.test.cjs` and observe failure.
- [x] Implement helper and editor. Missing method copy is exactly "Ingredients found. Instructions are missing." Show both attribution links and original URL input; primary label "Save recipe". Keep candidate previews separate until accepted; matching auto-completion must not overwrite edits made since request start.
- [x] Wire autosave/recovery through Task 4 after session resolves. Unavailable storage visibly says the draft cannot survive closing the page; keep it in memory. Dirty navigation/new import asks before replacement; refresh/close flushes storage synchronously and uses beforeunload only when dirty. Recoverable drafts do not appear in vault/planner/shopping/cooking. Explicit discard and confirmed successful save clear storage; failed save never clears it. Guest binding clears stale recipe/collection IDs and requires explicit choice.
- [ ] Browser-check 393px and 820px layouts: partial import, adding steps, original URL success/failure/mismatch, refresh recovery, discard confirmation, unavailable storage, delayed request versus edits, and account switches. Screen reader labels and focus restoration must work. Check complete/manual edits and existing failed-link reports still work.
- [x] Run focused tests and existing auth/import-report regressions; commit `feat: review and finish incomplete recipe imports`.

## Task 6: Persist dual source links and verify the full flow

**Files:** Modify `src/lib/db/schema.ts`, `src/lib/photos/service.ts` (recipeSummaryColumns), `src/app/api/recipes/route.ts`, `src/app/api/recipes/[id]/route.ts`, `src/lib/api/client.ts`, `src/lib/mobile/{adapters,demo-data}.ts`, `src/app/page.tsx`; create `src/lib/recipes/source-links.ts`, `scripts/migrate-recipe-provenance.mjs`, `tests/source-links.test.cjs`, `scripts/check-import-provenance.mjs`. Add package script `db:recipe-provenance`.

**Interfaces:** Add nullable recipes.originalRecipeUrl -> SQL original_recipe_url text. Add optional nullable originalRecipeUrl to client models (legacy default null), POST defaults null and PATCH omitted means retain, explicit null means clear. Extend createRecipeFromDraft with a fifth optional originalRecipeUrl argument default null; extend updateRecipe updates with this optional field. `sourceLinksSchema` validates nullable credential-free public HTTP(S) links with bounded length and rejects unsafe schemes; links render only after validation. Network fetching still requires public DNS pinning; saving an attribution does not itself fetch it. Show "Original post" and "Full recipe" when both links exist; retain existing source label for single-link legacy/manual recipes.

- [x] Write tests for both-link serialization and mobile adaptation, omitted PATCH retention versus explicit clearing, unsafe URL rejection, legacy null defaults and recipeSummaryColumns coverage. Run `node --test tests/source-links.test.cjs`; confirm failure.
- [x] Implement additive idempotent migration following existing script style, but require explicit target environment file and expected non-production branch/host confirmation for local checks. Never run it against the default .env.local implicitly. Add no destructive SQL/backfill. Apply only after independently verifying the integration branch via Neon tooling; use neon skill at execution time.
- [x] Implement API/model/UI changes; preserve owner WHERE clauses and uploaded-photo completion guards. Source photo copy uses the selected recipe image, not its social thumbnail; provenance-only PATCH does not trigger photo invalidation.
- [x] Run focused tests and isolated HTTP checks: create/read/edit retains both links; omitted/cleared link semantics; cross-account update fails; incomplete payload rejected; existing photos survive provenance edits. Clean temporary fixtures. Do not use current scripts/account-isolation.mjs blindly if its default target is production.
- [x] Run `npm test`, `npx tsc --noEmit`, `npx next build --webpack`. Success requires exit code 0 for all; document any real external provider/device limitations. Read installed Next build docs first; escalate sandbox filesystem errors only when needed.
- [x] Perform a read-only live import of the reported reel through the local route and verify match title, ingredient quantities, full method, both links and image. If creator markup no longer supports the advertised search, incomplete fallback is correct but record the real-reel acceptance as unresolved, not passed. No recipe save or production write is needed for this check.
- [x] Request whole-change review after checks, fix actionable defects, then commit `feat: preserve original recipe provenance`. Leave production migration, deployment and actual-device acceptance for a separately authorized release.

## Self-review and handoff

All design sections map to Tasks 1-6; the five Review Focus cases have explicit tests above. The common import draft and provider option names are shared across tasks. Budget tests cover intermediate partial-analysis and candidate calls, not just the last provider request. Existing UX plan remains separate with only its draft helper interface extended here.

Recommended execution: native in this chat, because the six tasks share import contracts, cumulative budgets and editor state. One whole-change review follows focused tests and build. Implementation and integration-branch migration now verified locally; production remains unchanged. The original recommendation above records the planning handoff, which the user approved for native execution.

Execution note: all code and automated checks implemented; the browser checklist is explicitly pending. URL input persistence is a deferred minor. Task 6 integration uses actual HTTP handlers with isolated SQL and a stubbed authenticated identity to avoid production authentication writes. Final production build result is recorded in the session validation log.
