# Local UI/UX review — 11 November 2026

Scope: current uncommitted `/social-preview` workspace served locally. This is a disposable prototype, not a production acceptance test. Covered Cookbook, Community/Family/Discover/My feed, account menu, manual recipe entry, detail, cooking completion, meal selection and Shopping. Responsive spot checks used 320, 393, 820 and 1366px viewport overrides; not every flow was repeated at every size. No product code changed.

## Confirmed findings

1. **High: Shopping loses ingredient ranges.** Create a manual recipe with `2-3 tomatoes` and `100 g rice`. At eight servings, detail correctly displays `4–6 tomatoes` and `200 g rice`. Add to a plan with eight servings: Shopping shows `2-3 tomatoes — Amount not specified`, while rice correctly shows 200 g. Cause: the limited ingredient parser at `src/app/social-preview/page.tsx:131` leaves the range inside the name with no amount; detail uses a different scaling path. Use a shared structured quantity representation through detail, cooking and planning.

2. **Medium: Public recipes are mislabelled as family recipes.** Discover → A bowl of sunshine → Add to meal plan → confirm → Cookbook. The public recipe now says `Saved from family`. The planning action automatically saves it without a separate save confirmation. Cause: `page.tsx:173` defaults all non-owned recipes without a source to that family label; `:192` auto-saves before planning. Retain accurate provenance or use a neutral Saved recipe label; explain automatic saving.

3. **Medium: New recipes acquire invented metadata.** Manual entry asks for title, ingredients and method, but the saved recipe asserts 20 minutes, Mediterranean cuisine and a four-serving base yield. Cause: `src/app/social-preview/CombinedFlows.tsx:27` hard-codes cuisine/time; `page.tsx:131`, `:144`, `:193` assume four servings. Collect duration/base yield and allow unknown cuisine. The base yield directly affects shopping quantities.

4. **Medium: Mobile ingredients follow the full method.** At 393px, open A bowl of sunshine and scroll below the photo/actions. The method and attribution appear before Ingredients and serving controls. Cause: `page.tsx:192–193` stacks the first grid child (photo/actions/method/attribution) ahead of the ingredient aside. Put quantities/servings before the method on phones or add clear Ingredients/Method jump controls.

5. **Low: Privacy slogan contradicts public context.** Discover, My feed and public recipe detail retain `Private until you share` in the header beside content labelled Public/Published recipe. The slogan is independent of audience/view. Use context-aware audience copy or scope the wording clearly to private drafts/collections. No access-control failure was demonstrated.

6. **Low: Shopping breadcrumb says Plan.** On desktop, Shopping is highlighted and the heading says Your shopping list, while the breadcrumb says Your kitchen / Plan. Cause: `page.tsx:139` maps Shopping to the Plan view with separate shopping mode, which the breadcrumb ignores. Derive all destination labels from view and mode consistently.

7. **Low: Unavailable nutrition becomes a repeated review warning.** Plan collapses Nutrition estimates (unavailable in this preview), but the meal picker labels every row Nutrition needs review. There is no review action in this prototype. Cause: `src/components/planner/RecipePicker.tsx:99` reuses the normal fallback. Use one availability note in the preview; retain genuine review warnings in the real app.

8. **Low: Preview notice has duplicate punctuation.** Plan/Shopping show `Preview only. Changes are temporary. .`. `src/components/planner/Planner.tsx:432–433` renders a sentence, sign-in link and final period; `combined-preview.css` hides only the link. Render an intentional preview sentence instead of hiding part of it with CSS.

## Checks that worked

- Manual-entry title/ingredients/method survived navigating to Community and back.
- A public recipe retained Published recipe and Back to Discover after cooking completion was cancelled.
- Cooking completion defaulted to Only me and explicitly stated nothing posts until saved.
- Scaling from four to five servings carried scaled ingredients into cooking mode.
- Range scaling within detail works: 2-3 at double yield becomes 4–6. The failure is the shopping handoff.
- Shopping checkmarks survived navigation to Plan and back.
- Empty Friends cookbook → Explore recipes opened Discover.
- Sharing modal had a dialog role and initial focus on its close control.
- Sampled narrow-screen DOM width checks showed no document horizontal overflow. Filter rows intentionally scroll horizontally.
- Captured browser warning/error log was empty at the end of the walkthrough.

## Handoff and limits

Prioritise 1–3 because they affect quantity accuracy and trust. No real extraction, authentication, persistence, email invitations, backend permissions, production publication, camera capture or installed iPhone/PWA acceptance was tested. Mocked operations are not treated as broken production features. Browser overrides were cleared; temporary recipes/plans were removed by refreshing the disposable preview. Local dev remains running.

## Implemented and verified — 12 November 2026

All eight findings above are addressed in the local preview. Quantity parsing/scaling now shares a structured path across detail, cooking and Shopping, including fractions and hyphen/en-dash/em-dash ranges. Manual drafts require base servings; time/cuisine are optional, and recipe editing preserves and updates these values. The already-mounted preview planner uses the latest recipe catalogue for new picks/generation; existing planned snapshots change when explicitly replaced. The featured card reads current recipe metadata.

Public saves have an accurate Discover label and planning explains its automatic save. Header privacy copy follows the audience, Shopping has its own breadcrumb, ingredients precede the method when columns stack, and prototype notice/nutrition wording is explicit through opt-in props. Shared Planner defaults retain their existing sign-in link and nutrition-review warnings.

Verification: five adapter/provenance/cross-surface regression tests (RED→GREEN); complete suite 122/122; TypeScript passed. Browser verified blank metadata, retained manual draft/base yield, four→eight-serving em-dash range (4–6 tomatoes / 200 g rice / 1 tsp salt), two→four-serving custom yield, edited time/yield reaching a mounted picker and replacement Shopping, cooking ingredients, Discover provenance and auto-save notice, contextual public/private header, clean notice, one picker availability note and corrected desktop breadcrumb. At sampled 320/393/820/1366 widths, ingredients precede method on stacked layouts and sit alongside detail on desktop; no document horizontal overflow was observed. Captured browser warning/error log was empty. Independent review identified the em-dash and stale planner-catalogue gaps; both were corrected and retested. Device/PWA and production integration remain outside this local prototype task.

Production compilation check: npm run build -- --webpack completed successfully (including TypeScript, static page generation and build traces).
