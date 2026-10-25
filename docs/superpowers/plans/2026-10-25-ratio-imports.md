# Ratio-based Recipe Imports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans for recommended native execution, or superpowers:subagent-driven-development if selected. Steps use checkbox syntax for tracking.

**Goal:** Reliably import source-backed ingredient ratios, preserve alternative formulas, and retain the missing-method save boundary.

**Architecture:** Extend the import-only extraction contract with bounded formula alternatives and verify explicit ratio evidence before accepting provider output. Project one user-selected formula into the existing editable/saved recipe shape; persist choices through the existing owner-scoped device recovery.

**Tech Stack:** Existing Next.js/React/TypeScript, Zod, node:test CommonJS harness and current extraction providers. No dependency, database or provider changes.

**Spec:** ../specs/2026-10-25-ratio-import-review.md

**Status:** Proposed plan; product code not started. Native execution recommended because five tasks share extraction/review interfaces. No implementation or release is part of this planning request.

## Global constraints

- Preserve source quantities as strings; use `part` for explicit parts. Never choose a weight/volume basis, absolute batch size, yield or missing preparation method.
- Separate mutually exclusive formulas. No default selection and no combined ingredient list.
- One repair maximum per provider extraction, shared across all repair causes. Preserve existing 54-second overall, 18-second cumulative source and 36-second cumulative AI budgets.
- Keep saved recipe/API/database contracts unchanged. Import and recovery metadata must be stripped before saving.
- Preserve owner isolation, expiry, stale-response guards and dirty-edit protection. Never save incomplete methods without the existing explicit completion confirmation and valid nonblank steps.
- Read applicable `node_modules/next/dist/docs/` guides before implementation. Current branch contains nutrition-planner work; use the worktree workflow at execution and do not reset/commit unrelated files.

## Review focus

1. A schema-valid model response drops quantities or merges alternatives: reject or repair (Tasks 1–3).
2. Marketing counts, aspect ratios, product percentages and source instructions masquerade as recipe data: no false recovery or invented ingredients (Tasks 1–2).
3. Formula choice/switch/recovery crosses accounts or overwrites edits: retain isolation and confirmation (Tasks 4–5).
4. Parts-only ingredients reach matching, shopping or nutrition paths as absolute quantities: preserve units and fail comparison/estimation conservatively (Tasks 3 and 5).
5. Existing complete recipes and v1 recovered drafts lack new metadata: retain current behavior (Tasks 1 and 4).

## Reproduction fixture

Use a synthetic caption preserving the observed clause shape:

```text
Ganache alternatives for piping:
Dark chocolate: 1 part chocolate : 1 part heavy cream
Milk chocolate: 1.5 parts chocolate : 1 part heavy cream
White chocolate: 2 parts chocolate : 1 part heavy cream
Tested chocolates: dark 58%, milk 40%, white 34%; cream 36%.
```

This is equivalent test data, not a transcription. Full observed source remains linked in the review. The parser associates each label with its two ingredient rows; source percentages remain notes when unambiguous. Unsupported attribution is ambiguous, not invented. The one-repair maximum applies **per extracted document**, while all document extractions share the existing import budget; this matches the current provider wrapper.

## File map and contracts

Modify `src/lib/extraction/import-schema.ts`, `prompt.ts`, `provider.ts`, `import-recipe.ts`; create `src/lib/extraction/ratio-evidence.ts`. Modify `src/lib/recipes/import-review.ts`, `draft-storage.ts`, `src/components/recipes/RecipeEditor.tsx` and `src/app/page.tsx`.

Tests live in existing `tests/import-schema.test.cjs`, `provider.test.cjs`, `import-flow.test.cjs`, `import-review.test.cjs`, `draft-storage.test.cjs`, `recipe-match.test.cjs`, `import-source-regressions.test.cjs`, plus new `tests/ratio-evidence.test.cjs`. Use synthetic equivalent captions, with URL/verified ratios in the review; avoid copying the full creator caption into fixtures.

Import-only contract:

- Export `FormulaAlternative = {id:string;label:string;ingredients:EditableRecipeDraft['ingredients']}` and `formulaAlternativeSchema` from `import-schema.ts`. IDs: 1–64 characters matching `[a-z0-9-]+`; labels: trimmed 1–120; 1–150 valid ingredient rows. `alternatives` optional on `ImportExtraction`, 2–8 entries, unique IDs/labels. No nesting. Existing top-level ingredients may be empty only with valid alternatives; must be empty when alternatives exist. Each row retains source variant in notes. A single formula stays in top-level ingredients.
- Multi-formula responses must have `completeness:'incomplete'`, `missingFields:['instructions']`, and `steps:[]` for this no-method case. General multi-recipe methods are outside this feature: reject ambiguous shared-method attribution rather than attaching it to every variant.
- Add optional `alternatives:FormulaAlternative[]` and `selectedAlternativeId:string|null` and `alternativeBaseTitle?:string` to `ImportCandidate` and review state. Initial multi-formula candidate has `draft.ingredients:[]`, no selected ID, status incomplete. `draft` remains an `EditableRecipeDraft`, not a saveable `RecipeDraft`.
- Export `RatioEvidence = {kind:'none'|'ambiguous'|'formulas';formulas:{label:string;ingredients:{name:string;quantity:string;unit:'part';notes:string|null}[]}[]}` and `inspectRatioEvidence(text:string):RatioEvidence`; export `ratioFidelityIssues(evidence:RatioEvidence,extraction:ImportExtraction):string[]` from `ratio-evidence.ts`. No network/provider calls. Limit parsing to 10,000 source characters, 8 formulas and 150 ingredients per formula. Match explicit named clauses containing two quantities with part/parts/parte/parti and a colon separator. Accept decimal dot/comma and simple fractions; preserve source number strings. Do not infer a bare `16:9` formula.
- Export `chooseAlternative(result:ImportCandidate,id:string):ImportCandidate` from `import-review.ts`: validate ID, copy only selected source rows with zero-based positions, set title to `<base title> — <label>` bounded to 180 characters, reset completion separately in UI. Store immutable base title in review metadata as `alternativeBaseTitle` so switches do not append labels repeatedly. Unknown ID throws without mutation. Never mutate alternatives.

### Task 1: Define ratio evidence and the import-only formula contract

**Files:** import-schema.ts; new ratio-evidence.ts; import-schema.test.cjs; new ratio-evidence.test.cjs.

**Interfaces:** Produce the schemas/types/functions above. Legacy extraction with no alternatives remains valid.

- [ ] Write failing tests: dark/milk/white clauses produce three formulas with pairs `['1','1']`, `['1.5','1']`, `['2','1']`; decimal comma and simple fraction remain source strings; one formula is recognized; no numbers are synthesized. Verify no evidence for engagement counts/16:9/percentage-only captions and ambiguity for unnamed or conflicting ratios.
- [ ] Test schema: valid alternatives with empty top-level ingredients; reject duplicate IDs/labels, empty variants, >8 variants and combined top-level ingredients; normal complete and incomplete objects retain current results. Test fidelity rejects null quantities, missing alternatives, merged alternatives and changed ratios, while allowing equivalent harmless name case/whitespace and source numeric decimal/fraction equivalents. Qualifiers such as cocoa percentage must remain source-backed notes.
- [ ] Run `node --test tests/ratio-evidence.test.cjs tests/import-schema.test.cjs`; confirm meaningful failures before implementation.
- [ ] Implement bounded evidence parsing and semantic comparison. Compare normalized ingredient identity, quantities and source-backed qualifiers per label; map singular/plural part aliases, not parts to mass/volume. Mark unsupported clauses ambiguous. Do not hardcode ganache or silently broaden into a food-name dictionary.
- [ ] Re-run the focused command; expect zero failures. Commit only Task 1 files: `feat: define source-backed ratio import formulas`.

### Task 2: Repair false refusals and valid-looking ratio loss within one budget

**Files:** prompt.ts, provider.ts; provider.test.cjs and provider-contracts.test.cjs.

**Interfaces:** Consume `inspectRatioEvidence`, `ratioFidelityIssues` and extended `importExtractionSchema`. Preserve `ExtractionProvider.extract` signature.

- [ ] Write failing mocked-provider tests: a clear two-ingredient parts formula followed by refusal is retried once; a schema-valid response with null quantities gets one fidelity repair; all three alternatives survive the corrected response. A second bad response remains a failure, never a third request. Existing measured-ingredient retry remains compatible.
- [ ] Add negative tests for marketing, aspect ratios, percentage-only text and injected instructions. Explicit non-recipe refusals remain single calls. Test insufficient remaining time starts no repair and a delayed body still times out. Verify import prompt changes apply through all current provider helpers without changing normal recipe mode.
- [ ] Run `node --test tests/provider.test.cjs tests/provider-contracts.test.cjs`; verify new cases fail for the intended behavior.
- [ ] Extend import prompt with ratio/alternatives shape, part semantics, qualifier preservation and missing-method rules. Generate source-specific feedback for loss/refusal; route all reasons through the existing single repair path. Run fidelity on the returned repaired result too; throw `SourceReadError` or a dedicated source-content error surfaced as 422 with “Ingredient ratios could not be preserved reliably. Paste the full caption or enter the formula manually.” Do not expose schema internals.
- [ ] Run focused tests; expect zero failures and call counts pinned at 1 or 2. Commit `fix: preserve ratio formulas during extraction repair`.

### Task 3: Carry alternatives through the real import orchestration

**Files:** import-recipe.ts, import-review.ts; import-flow.test.cjs, import-review.test.cjs, import-source-regressions.test.cjs, recipe-match.test.cjs.

**Interfaces:** Extend `ImportCandidate` and implement `chooseAlternative` above; retain original source/image links. `ImportExtraction` alternatives are import metadata, never spread into saved draft fields.

- [ ] Write failing end-to-end mocked tests using actual `readSource` plus provider wrapper: tracked/canonical URLs expose requested-caption evidence; initial result has exactly three alternatives and no selected ingredients; selecting milk yields exactly 1.5 part milk chocolate + 1 part cream with source labels/qualifiers. Each other selection yields its own pair; unknown IDs do not mutate data.
- [ ] Test no automatic original discovery for unresolved alternatives, no merging from related posts, unchanged ordinary discovery, and conservative rejection of parts-to-grams matching. Manual matching after choice must use only the chosen draft and retain alternative context on failure. Ambiguous multi-method output returns a clear source-content error.
- [ ] Run `node --test tests/import-flow.test.cjs tests/import-review.test.cjs tests/import-source-regressions.test.cjs tests/recipe-match.test.cjs`; verify red cases.
- [ ] Explicitly project draft fields in `importRecipe` rather than spreading formula metadata; propagate alternatives and base title. Implement choice as pure validated copying. Return existing incomplete-method messaging after choice. In `page.tsx` manual resolve must omit alternative metadata from captionDraft and preserve the prior alternative state until the existing replacement confirmation succeeds; then clear old alternatives for the accepted website recipe.
- [ ] Re-run focused tests; expect zero failures. Commit `feat: retain formula alternatives in recipe import review`.

### Task 4: Add deliberate formula selection and recover it safely

**Files:** RecipeEditor.tsx, page.tsx, import-review.ts, draft-storage.ts; import-review.test.cjs, draft-storage.test.cjs.

**Interfaces:** Add optional formula-selection metadata to current stored v1 schema with defaults `alternatives:undefined`, `selectedAlternativeId:null`, `alternativeBaseTitle:undefined`; retain the existing owner keys and TTLs. Validate selected ID belongs to alternatives. Legacy v1 data needs no migration. Add a context-aware save helper in import-review.ts that composes `canSaveDraft` with selected-ID validation when alternatives exist; use it consistently for persistence classification, Save rendering and saveReview handler.

- [ ] Write failing tests for unresolved selection blocking save even if manually populated; selected valid complete draft passing only with existing completion confirmation; ID mismatch failing; recovered alternatives retaining exact strings/notes/choice/base title; legacy draft recovery; invalid or oversized metadata, wrong owner, expired data and storage denial.
- [ ] Run `node --test tests/import-review.test.cjs tests/draft-storage.test.cjs`; verify intended failures.
- [ ] Render a labelled radio group or native select before ingredients; use exact spec copy. Hide the ingredient editor until selection, retain original-link input only after choice. Title/quantities/notes remain visible for review, including variant qualifiers currently not displayed by the editor. Confirm switching only when edited, reset completion on switch, preserve alternatives until save/discard, and reset them on a new unrelated import. Keep late responses subject to current request/owner/revision checks. Preserve selection during original-link failures; reset it only on explicit accepted replacement.
- [ ] Use shared choice transitions to test switch-cancel preserves all edits and confirmation, switch-confirm resets ingredients/title/completion, and owner change clears this review state. Include choices/base title in every storage/read/recover path; existing clear-on-save/discard behavior remains.
- [ ] Re-run focused tests; inspect actual browser at 393px and 820px: accessible choice, no combined rows, visible notes, switch/cancel, reload recovery, blank-method Save disabled, completed/confirmed Save enabled, and new-account isolation. Use mocked import responses or isolated fixtures, without production writes.
- [ ] Commit `feat: review and recover a chosen recipe formula`.

### Task 5: Verify integration and document limits

**Files:** Existing tests where integration gaps emerge; review/plan checklist and project documentation. No unrelated refactor.

- [ ] Run `npm test`, `npx tsc --noEmit`, and `npm run build -- --webpack`; require zero test/type failures and build exit 0. If the changed base adds failures, investigate and record them rather than attributing all to this task.
- [ ] Confirm existing shopping/nutrition quantity parsers preserve/reject part units without converting to absolute mass or giving plausible calorie estimates. Add a focused regression only if current code can misinterpret these selected ingredients. No nutrient-source or planner redesign.
- [ ] With existing configured credentials, perform up to three read-only import attempts total on the canonical reel, with no saved recipe: each succeeds with exact alternatives or returns the explicit fidelity error; none may silently pass dropped ratios or invented steps. Record source-read/model/fidelity outcomes separately. Live model availability is supplementary; mocked deterministic regressions remain required.
- [ ] Recheck manual selected-formula original-link flow, ordinary complete recipes and old recovered drafts in browser. Confirm no DB migrations, changed credentials/provider selection or production writes occurred.
- [ ] Review final diff against all acceptance requirements, update DevWiki and commit its session log per standing instructions. Do not push, merge or deploy under this plan-only authorization.

## Self-review and execution handoff

Coverage checked: refusal, semantic loss, alternative choice, recovery, legacy data, conservative original matching, units, false positives, budgets and save boundary map to Tasks 1–5. New fields are import/review-only; no missing persisted recipe variant schema. The manually chosen formula remains one standard recipe on save. Detailed builder/reviewer findings should be resolved before implementation.

Recommended execution: native, in an isolated worktree, with a final independent code review under the applicable review skill. The user must review the proposed selector/save-one-formula behavior and choose execution approach before product implementation. This handoff does not block saving/installing the separately requested reusable workflow skill.
