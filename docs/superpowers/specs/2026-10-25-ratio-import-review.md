# Ratio-based Instagram import review and proposed design

Date: 2026-10-25. Scope: review and planning. Product implementation and release remain separate actions.

## Verified review

Reported URL: https://www.instagram.com/reel/DbjTvK6p8fB/?psln=MW4za2w2b2dycmJ2ZA==

Canonical URL: https://www.instagram.com/reel/DbjTvK6p8fB/

Reported error: “No usable recipe ingredients were found. Paste the full caption or original recipe link.” No user note.

Actual `readSource` retrieves the full caption from both URLs. Three chocolate-to-heavy-cream formulas appear: dark 1:1, milk 1.5:1, white 2:1. No written method or creator-site recipe link appears in that caption. Video/audio were not inspected.

The configured local Groq provider refused through `importRecipe` twice. Tracing showed `insufficient_recipe_content`, followed by `importExtractionSchema` failure mapped to the reported generic ingredients error. Another run produced a valid incomplete draft with chocolate and heavy cream, both quantities null, losing all ratios and variants. Model variability does not establish a reliable import.

`withValidationRepair` only repairs explicit import refusals when at least three measured matches use g/kg/ml/cup/tbsp/tsp. Parts are excluded. Schema validity alone cannot detect lost ratios. Existing incomplete-import UI, account-scoped recovery and conservative original-link matching already work and should be extended.

## Proposed behavior

Explicit ingredient ratios are usable partial recipe content. Preserve quantities as strings with unit `part`. Never assume grams, millilitres, weight/volume basis, yield or cooking instructions. Preserve source variant labels and relevant qualifiers in ingredient notes. Product percentages are qualifiers, not extra ingredient quantities.

Multiple mutually exclusive formulas appear as an explicit choice before the ingredient editor: “These are alternative formulas. Choose one to edit.” Nothing is selected automatically. Choosing Milk chocolate produces exactly 1.5 part milk chocolate and 1 part heavy cream. Other formulas remain in recoverable review state, outside the selected recipe ingredient list. Single formulas use the normal editor without a selector.

Switching after edits requires confirmation. Cancelling preserves edits. Confirming replaces the edited draft from the chosen source formula and clears completion confirmation. Saving creates one variant-specific recipe only after selection and the existing method/completion requirements pass. Unselected formulas remain recoverable until save/discard; they are not separately saved recipes. The source link remains on the selected saved recipe.

Missing instructions mean incomplete status and empty steps when no method exists. Never generate a ganache method from general knowledge. Ordinary complete recipes remain unchanged; genuinely missing ingredients still fail closed. A schema-valid output dropping or merging explicit formulas must not silently pass.

## Planner choices and constraints

- Add bounded import-only formula metadata and recoverable selection state. Keep the existing saved recipe/database shape; no migration or additional provider.
- Use conservative deterministic evidence for clearly written ratio clauses. Ambiguous ingredient identities or ratio syntax remain unresolved instead of guessed.
- Share one provider repair maximum among refusal, structural validation and ratio-fidelity failures, within the existing AI/overall budgets. No nested retry loop.
- Do not automatically discover/replace a multi-formula source with a single website recipe. First select a formula; subsequent manual original-link matching uses the selected draft and the existing conservative matcher. Parts must not equal absolute quantities automatically.
- Reuse owner scoping, stale-response guards, dirty-state dialogs and incomplete-save gating. Preserve legacy device drafts.
- Do not treat engagement counts, aspect ratios or product percentages as ingredient formulas. Treat all source text as untrusted.
- No video transcription, broad creator search, batch calculator, nutrition estimation from parts, production data writes or deployment in this scope.

## Acceptance and handoff

The reported caption yields three distinct choices preserving 1/1, 1.5/1 and 2/1, no invented method, and no save before selection/completion. False refusal and valid-looking ratio loss trigger at most one bounded repair; repeated failure gives an honest extraction error without losing an existing draft. Normal complete imports and legacy recovery stay compatible.

These are proposed implementation defaults, not previously approved UI details. Review this design and the linked plan before product implementation. At execution, isolate from the current nutrition-planner branch and unrelated untracked files; reread actual code and applicable bundled Next.js docs.
