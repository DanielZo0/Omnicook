# Social import validation — 2026-10-22

Branch: codex/social-incomplete-imports. No push, production migration or deployment performed.

## Verified

- Final production Webpack build and subsequent TypeScript no-emit check both exit 0.
- Production-build HTTP verification: home 200, anonymous recipes 401, real reel import 200/complete with 11 ingredients, 21 steps and both source URLs; no recipe saved.
- 81 node:test regressions pass, including partial extraction, cumulative budgets, origin/redirect restrictions, multiple originals, section-aware exact quantity matching, Pinterest destinations, device draft isolation/expiry, explicit completion and non-destructive recovery dismissal.
- Final live read-only import of the reported Instagram reel produced 11 ingredients, 20 steps and https://www.tuorlorosso.it/nascondini-fatti-in-casa/ as the verified original. Model step segmentation can vary between runs.
- 14 integration assertions invoke actual recipe HTTP handlers and real SQL on a schema-only Neon branch. They cover both URLs through save/load/edit, omitted versus cleared provenance, cross-owner denial, incomplete payload rejection, legacy null defaults, and retention of uploaded-photo bytes. Authentication identity is stubbed in this harness; these are not interactive sign-in checks. Temporary recipes/seed markers were removed.
- Nullable original_recipe_url migration applied only to integration-social-imports-2026-10-22 (br-cool-forest-b412xhps). Branch endpoint independently verified before use; credentials remain in ignored .env.integration.local. Branch retained for pending UI acceptance.

## Review fixes

A fresh independent reviewer found five issues, all covered by failing regressions before fixes: Pinterest destination following; duplicated ingredient names in distinct sections; first-explicit-link selection; empty editor after an identity change; Escape deleting recovery data. An additional exact-decimal regression rejects near-but-different quantities.

A real provider retest exposed erroneous refusal of an ingredients-only caption despite 11 exposed ingredients. A standalone import prompt now explicitly accepts partial recipes, preserves source section headings and avoids duplicated caption/description text. One repair within the shared AI budget is allowed only for import-mode refusals with multiple measured source entries. Original recipe-mode/no-ingredient refusals stay fail-closed.

## Remaining acceptance

The browser bridge repeatedly timed out before local navigation, leaving blank tabs; no browser flow, viewport or actual Safari/PWA acceptance is claimed. Unit/API checks and production build do not substitute for those checks.

Deferred minor: the URL currently typed in the original-recipe lookup field is component-local and is not restored on refresh. Recipe edits, known source links and the recoverable draft are stored.

Production needs the additive provenance column before this code is released. The integration-only migration script deliberately refuses implicit/default targets; a production rollout requires a separately authorized, explicit migration/deployment procedure.

## Release preparation — 2026-10-22

Deployment authorized by the user. The nullable provenance column was applied to the independently verified production main branch after creating no-compute recovery branch br-mute-math-b44cb4a8. Before/after business-data hashes match: 75 recipes, 785 ingredients, 587 steps, five collections, two meal plans, four seed markers and 27 stored photos. Existing-account identity, nine exact recipe IDs, collections/plans and owner-photo 200 versus anonymous401 verified.

Fresh dependency install exposed advisories published on 2026-10-22: https://github.com/advisories/GHSA-2464-fhr4-w9xw and https://github.com/advisories/GHSA-p3m5-59mp-jv5r . Updated only Next.js 16.3.8→16.4.2 and sharp 0.35.4→0.35.5 plus their platform packages/libvips. All 81 regressions and the production build pass after the update; audit now reports zero critical, one high and four moderate findings. No forced audit upgrades. Final deployment verification is recorded separately in DevWiki.
