# Retained navigation and return context

User approved necessary code changes following the additional modern-web-guidance recommendations. Implement the fixed-view cache and return-context corrections; leave measured-only optimizations and scrollend listeners out.

- Cache only visited Cookbook, Search and Community; Planner is already retained. Never retain dynamic recipe-detail routes. Fixed maximum is three new views; no unbounded route cache or LRU dependency.
- Cache keys include account owner. Destroy old view instances immediately on account changes; clear filters/query/return-focus state and prevent old account recipe data from being rendered while a new vault loads.
- Retained inactive wrappers use inert, aria-hidden, content-visibility:hidden and absolute placement; unsupported browsers use display:none. Focus active view regions with preventScroll and restore the actual triggering recipe control on return.
- Preserve native scroll offsets and collection/search filters when opening and returning from a recipe. Return to Search/Planner/Community when that was the origin, not always Cookbook. Existing import-draft guards stay in place.
- Preserve Community tabs/member context; explicit My feed navigation still opens the own profile. Pause photo polling when no visible recipe screen needs it. Inactive Community cooking must not hold a wake lock or hide global navigation.
- Regression tests: fixed cache size after many detail visits; account isolation; return-screen normalization; browser verifies DOM retention, list scroll/filter/trigger focus, inactive keyboard isolation and narrow/desktop layout. Run full unit suite and build, independent review, then release via PR and verify real production /.

Skill consulted before implementation: faster-spa-view-transitions. Mandatory focus transfer, inert inactive views, bounded memory and display:none fallback are included. No speculative speedup claim.
