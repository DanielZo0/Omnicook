# Real cookbook UI integration

User approved applying the reviewed preview changes to the real data-backed app and releasing them (13 November 2026). The previous release exposed only /social-preview; this release must visibly change the actual / route.

- [ ] Replace the oversized mobile yellow masthead with a compact brand/account bar, Your recipe universe heading and Add recipe action; use a horizontal yellow feature card at phone and desktop sizes, driven by actual saved recipes. Preserve search, collections, filters, layout choices and bottom navigation. Use Shopping consistently.
- [ ] Use shared quantity parsing/scaling for range/fraction amounts including em dashes. Preserve structured saved ingredients through planning. Display unknown yield honestly instead of claiming a default serving. Add optional editable preparation/cooking times and clearly labelled base servings; preserve existing drafts and null metadata.
- [ ] Preserve existing production sharing/privacy and ingredient-before-method behavior. Avoid copying demo fixtures into /. Keep default real planner notices and server authorization; make picker warnings reflect actual capabilities and refresh the data-backed planner after cookbook edits without changing saved meal snapshots.
- [ ] Add behavior tests for real adapters/scaling/unknown metadata; run tests and build, verify / using browser at 320/393/820/1366, review diff, merge via PR and verify Vercel production. No schema migrations or existing recipe writes needed for this UI rollout.
- [ ] Afterwards, record independent baseline mobile performance recommendations before reading the user-provided GoogleChrome/modern-web-guidance rules; compare side by side with exact rule citations and mandatory/discrepancy flags. Recommendations only, no unrequested performance implementation.


## UI verification
- Actual / route uses compact cream header, Your recipe universe heading, Add recipe, horizontal yellow feature and Shopping label. Existing real API-driven recipes, collections/search/filters/layouts retained.
- Six regression tests RED→GREEN: saved em-dash/fraction quantities across actual adapters/planner, honest unknown yield, entered base yield, neutral source labels, explicit zero time, and background catalogue refresh deferral while planner mutations are pending.
- Complete suite 164/164; final production Webpack/TypeScript build passes. Independent review race fixed; zero/unknown metadata aligned. No schema or database changes.
- Browser root smoke: 320/393/820/1366 widths have no document overflow and horizontal feature layout; cooking retains 2x ingredients and four-serving plan produces 400g spaghetti/240ml cream/90g parmesan. Signed-out controls verified; private user-account writes intentionally not used for visual smoke. Existing ingredient-before-method/privacy enforcement remains intact.
- Actual phone/PWA acceptance remains with user. No fallback to /social-preview.
