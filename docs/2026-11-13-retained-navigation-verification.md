# Retained navigation verification — 2026-11-13

## Scope
Only visited Cookbook, Search and Community views remain mounted. The whitelist has three entries regardless of recipe count; Planner retains its existing single instance. Owner changes remount cached views and reject prior account data. Dynamic recipe routes are never cached.

Inactive views are inert and aria-hidden, with content-visibility:hidden and a display:none fallback. Focus moves to activated regions without scrolling. Recipe Back restores its origin and the actual triggering control. Community wake locks and cooking navigation state are active-view scoped. Photo polling pauses outside recipe screens.

## Evidence
- Three navigation helper tests were first run failing (missing implementation), then passing; full suite: 167 passing.
- Mobile browser at 393 × 852: search `pasta` survives recipe detail/Back; focus returns to its card. Cookbook scrollTop 578.444 survives detail/Back and Community round trip exactly.
- Visited cache contains only community/vault/search. Inactive wrappers have inert and aria-hidden=true; keyboard Tab stays outside inactive views.
- Weeknight collection stays selected on Search while Cookbook correctly shows All recipes / 4 recipes. Reviewer identified the original mismatch; browser retest confirmed the fix.
- No document horizontal overflow at mobile or 1440 × 1000 desktop.
- Screenshot: [mobile search return](../artifacts/2026-11-13-retained-navigation-mobile.png).
- Independent review: no remaining blockers. Planner also passes currentTarget explicitly for Safari return focus.
- Signed-in account switching and Safari fallback were checked in code/unit contracts, not with a live authenticated browser account or Safari device. Actual-phone acceptance remains useful.

## Guidance
Applied GoogleChrome/modern-web-guidance `faster-spa-view-transitions`, retrieved after CLI search using skill version 2026_11_09-5bcc021b. Its mandatory focus management, inactive inert state, bounded retention and unsupported-browser fallback are included. This retains DOM memory in exchange for avoiding remounts; no measured speedup or Core Web Vitals improvement is claimed. No content-visibility:auto, scrollend listener or speculative preloading was added.
`npm run build -- --webpack` completed successfully after the final review fixes, including TypeScript and static page generation.
