# Omnicook Social Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the approved family-first social experience while preserving every real Omnicook workflow.

**Architecture:** Extend the existing application rather than ship the prototype as its replacement. Keep private recipe APIs owner-only, add separately authorized family/public projections, snapshot copies with immutable provenance and independently revocable share assets. Reuse original structured recipe, photo, import and planner modules.

**Tech Stack:** Next.js 16.4.2, React 19.2, TypeScript, Drizzle, Neon Postgres/Auth, existing node:test and browser/integration tooling.

**Spec:** `docs/superpowers/specs/2026-11-01-social-integration-design.md`.

## Global Constraints

- Retain the current Next.js 16.4.2 / React 19.2 / Drizzle / Neon stack and Sunny Kitchen branding. No dependency or model/provider upgrades are part of this feature.
- Existing recipes remain private until their owner explicitly shares them. Existing personal collections and planner references remain intact.
- Keep positive reactions separate from cooked activity; no public free-text comment threads.
- Saved copies remain snapshots; accepting original updates is deferred. Private-derived recipes cannot be publicly redistributed without source-owner permission.
- Use a separate Neon development branch for additive migrations and real two-account/anonymous integration tests; do not apply migrations to production or change production auth/environment/provider settings.
- Release/push/merge/production migration remains a separate deployment step after review.
- Preview fixtures, numeric IDs, ingredient-string parsing and UI-only authorization must not enter production code.
- Mobile kitchen controls: at least 44 × 44 CSS pixel targets, 48-pixel ingredient rows, 56-pixel primary cooking actions and 8-pixel action spacing; body/ingredient text at least 16 pixels, instructions 17 pixels and active cooking steps 28 pixels.

## Review Focus

- A delayed response after account switching cannot repopulate the previous person's family recipes or draft (Tasks 2, 8).
- Revoking an original/share or removing membership revokes both JSON and image access without deleting recipient-owned copies (Tasks 3–5).
- Changing ingredient order or replacing an ingredient cannot attach a prior alternative to the wrong ingredient (Task 4).
- Concurrent administrator removal, invite replay, duplicate copy and reaction requests cannot break invariants (Tasks 2, 4, 7).
- Original malformed/incomplete/ratio imports and unavailable nutrition providers retain their established recovery flows (Tasks 1, 8, 9).

## File and interface map

Keep `src/app/page.tsx`, existing import/editor/photo/planner/API paths as the integration baseline. New domain files live under `src/lib/social/`, UI under `src/components/social/`, authenticated routes under `src/app/api/social/`, anonymous views under `src/app/shared/[token]/`, operator UI under `src/app/moderation/`. Use additive social schema in `src/lib/db/social-schema.ts`, re-exported from existing schema, and a guarded migration in `scripts/migrate-social.mjs`.

`SocialActor` is `{ userId: string; verifiedEmail: string | null; isModerator: boolean }`, derived only server-side. `Audience` is `{kind:'owner'} | {kind:'family'; cookbookId:string} | {kind:'publication'; publicationId:string}`; each request reauthorizes it. `RecipeSnapshot` retains the existing recipe draft fields, safe source links, original attribution and sanitized photo reference. `SharedRecipeView` combines snapshot, immutable provenance, permitted actions and only audience-authorized alternatives; public serializers never accept group data. Social IDs are UUIDs; raw share/invite tokens are opaque 32-byte random values stored as SHA-256 hashes.

### Task 1: Establish production baseline and preservation regressions

**Files:** existing app/import/editor/photo/planner/auth tests; new `docs/social-preservation-checklist.md`, `tests/social-preservation.test.cjs`.

**Interfaces:** consumes current main and the spec preservation table; produces an isolated baseline checkout, baseline verification evidence and an acceptance checklist for Task 9.

- [ ] Refresh origin/main; inspect native attached worktrees and use a new isolated checkout based on main. Compare pre-existing local app/branding changes against main; preserve the old checkout unchanged.
- [ ] Copy only approved preview/design/plan reference documents into the implementation checkout. Do not copy `.env` or `.neon` implicitly; verify any chosen dev connection target explicitly without logging values.
- [ ] Run baseline `npm test`, `npx tsc --noEmit`, `npm run build -- --webpack`; record exact results and pre-existing failures before modifications.
- [ ] Add a failing regression describing the new four-area navigation while retaining original import, account, layouts, collections, shopping and editor guards; keep existing behaviour assertions from the spec checklist.
- [ ] Record baseline and test command in the execution ledger; commit the preservation contract separately from product code.

### Task 2: Add social schema, actor policy and family membership

**Files:** create `src/lib/db/social-schema.ts`, `src/lib/social/{types,actor,policy,schemas,limits,groups}.ts`, `src/app/api/social/cookbooks/route.ts`, `src/app/api/social/cookbooks/[id]/route.ts`, `src/app/api/social/cookbooks/[id]/members/route.ts`, `src/app/api/social/cookbooks/[id]/invitations/route.ts`, `src/app/api/social/invitations/accept/route.ts`, `scripts/migrate-social.mjs`, `tests/social-membership.test.cjs`.

**Interfaces:** produces `requireSocialActor(): Promise<SocialActor|null>`, `listCookbooks(actor)`, `createCookbook(actor,name)`, `authorizeCookbook(actor,id,requiredRole)`, invitation create/accept/revoke and member role/remove services. Use structured `{ok,...}` and HTTP 400/401/403-or-404/409/429/503 responses consistent with existing APIs.

- [ ] Write and run failing tests: outsider cannot enumerate group/members; client userId/role is ignored; contributor cannot invite/remove; expired/replayed/revoked/wrong-recipient token rejected; final-admin removal is blocked under two concurrent requests.
- [ ] Provision an isolated Neon development branch with verified target, using existing connection conventions; add idempotent migration for profiles, cookbooks, memberships, invitations, family grants, publications/photo assets, provenance, alternatives, follows/reactions/cooked events, reports/actions/blocks and rate buckets. Use foreign keys, uniqueness and required indexes.
- [ ] Implement atomic membership/invite mutations. If existing HTTP-only Drizzle cannot express the required transaction, choose a supported transaction transport or single atomic SQL service, record it and prove the race tests; do not scatter authorization-before-write checks.
- [ ] Implement validated request bounds and server-only moderator configuration. Guard new routes behind `SOCIAL_ENABLED`; absence/unavailable schema must not affect existing private APIs.
- [ ] Run membership integration/unit tests to green and verify repeated migration is safe. Commit schema and family access primitives.

### Task 3: Share contributor originals with private cookbooks

**Files:** `src/lib/social/{recipe-view,sharing,photos}.ts`, `src/app/api/social/cookbooks/[id]/recipes/route.ts`, `src/app/api/social/recipes/[id]/route.ts`, `src/app/api/social/recipes/[id]/photo/route.ts`, `tests/social-sharing.test.cjs`.

**Interfaces:** consumes actor/membership services; produces `shareWithFamily(actor,recipeId,cookbookId)`, `revokeFamilyShare(...)`, `readSharedRecipe(actor,id,audience): Promise<SharedRecipeView>`, authorized social photo responses. Private recipe CRUD/photo ownership contracts stay unchanged.

- [ ] Write failing tests for contributor-only sharing, recipient cannot reshare the original into another group, deleted grant/membership revokes recipe and photo, private owner URL remains forbidden to a member and public projections exclude all private fields.
- [ ] Implement family grants with original ownership checked atomically; administrators may remove a grant only from their group. Family access reads structured live originals through the separate authorized service.
- [ ] Implement safe photo projections/routes retaining licence and AI/source labels, with private no-store cache policy and no private URL leakage. Test copied source/licensed/generated/user photos and neutral fallback.
- [ ] Verify two-account and anonymous reads/writes and revocation; commit family sharing.

### Task 4: Independent saved/adapted copies and ingredient alternatives

**Files:** `src/lib/social/{copies,alternatives,provenance}.ts`, `src/app/api/social/recipes/[id]/copies/route.ts`, `src/app/api/social/cookbooks/[id]/alternatives/route.ts`, `src/app/api/social/alternatives/[id]/route.ts`, existing `src/app/api/recipes/[id]/route.ts` mutation boundary, `tests/social-copies.test.cjs`, `tests/social-alternatives.test.cjs`.

**Interfaces:** `saveSharedCopy(actor,source,audience,idempotencyKey,substitution?)` creates a recipient-owned recipe with all original structured metadata/photo data and immutable provenance; it returns its real recipe UUID. Alternative services consume cookbook/recipe/ingredient IDs and revision; endorsement records original-author identity.

- [ ] Write failing tests for independent ownership, idempotent duplicate save, retained root/source/photo provenance, original changes/deletion not modifying a copy, private-derived public/unlisted/cross-group redistribution denial, exact selected-ingredient substitution and stale ingredient reorder/replacement through the existing PATCH endpoint.
- [ ] Implement copy/substitution atomically with existing recipe tables and planner-compatible structured ingredients, preserving notes, quantity/unit, aisle and yield. Never use preview text parsing.
- [ ] Implement bounded alternative create/delete/endorse permissions and ingredient/revision anchoring. In the existing recipe mutation transaction, mark alternatives stale before ingredient rows are deleted/recreated; do not cascade-delete historical alternative/provenance records. Only authorized family responses include them; original-author endorsement does not change the original ingredient.
- [ ] Run tests and a real two-person copy→edit→plan→shopping scenario to green; commit copies/alternatives.

### Task 5: Revocable anonymous share links and publication snapshots

**Files:** `src/lib/social/{publications,public-view,tokens}.ts`, `src/app/api/social/recipes/[id]/publication/route.ts`, `src/app/api/shared/[token]/route.ts`, `src/app/api/shared/[token]/photo/route.ts`, `src/app/shared/[token]/page.tsx`, `src/components/social/SharedRecipe.tsx`, `tests/social-publication.test.cjs`.

**Interfaces:** produces explicit owner-only publish/refresh/unpublish/rotate operations and `readPublication(token): Promise<PublicRecipeView|null>`. Reuses recipe/provenance projections; never weakens `/api/recipes`.

- [ ] Write failing tests for anonymous readable approved snapshots, no group/email/private-note/job metadata fields, unlisted omission from discovery, token rotation and simultaneous JSON/photo revocation, original deletion revoking all original grants/publications/photos while preserving saved copies, contributor removal revoking live group grants and private-derived redistribution denial.
- [ ] Implement hashed random tokens, explicit snapshot refresh, correct source/credit labels, noindex/referrer/no-store policies and a neutral unavailable page for invalid/revoked tokens.
- [ ] Require deliberate publication rights/audience confirmation; imported recipe attribution survives every view. Link preview metadata uses only approved snapshot fields and authorized assets.
- [ ] Run permissions and metadata/browser tests to green; commit anonymous sharing.

### Task 6: Reports, blocking, administration and public moderation

**Files:** `src/lib/social/moderation.ts`, `src/app/api/social/{reports,blocks}/route.ts`, `src/app/api/social/moderation/route.ts`, `src/app/moderation/page.tsx`, `src/components/social/ModerationQueue.tsx`, `tests/social-moderation.test.cjs`.

**Interfaces:** stores target-specific reports and auditable moderation actions; `canPublishPublicly` requires enabled moderation capability; `isBlocked(actor,target)` filters signed-in discovery/activity and rejects blocked interactions without claiming anonymous invisibility.

- [ ] Write failing tests for target-specific private report access, reporter identity protection, operator-only public queue, no client moderator escalation, persisted future-account blocking, atomic rate caps and failed report submission retry UI.
- [ ] Implement server-configured moderator user IDs, quarantine/removal and group-specific admin removal. No public free-text comments; validate/escape all other text and reuse photo validation.
- [ ] Apply limits from spec: 20 invitations/day, 10 reports/day, 30 other writes/minute per actor; bounded lists of 20 and 8 MB photo cap. Store only invite/share token hashes. Test simultaneous limit consumption.
- [ ] Ensure public submission fails closed if moderation is unconfigured while private cookbook use still works; commit moderation before enabling public publishing.

### Task 7: Public discovery, profiles, reactions, following and cooked activity

**Files:** `src/lib/social/discovery.ts`, `src/app/api/social/{discovery,profiles,reactions,follows,cooked}/route.ts`, `tests/social-discovery.test.cjs`.

**Interfaces:** cursor-paginated `listDiscovery(actor?,cursor,filters)` returns published allowlisted snapshots only; mutations use actor-derived identity, unique follow/reaction keys and separately authorized cooked events/photos.

- [ ] Write failing tests for private/unlisted/quarantined exclusion; deterministic chronological cursor pagination; cuisine/ingredient/time filters; idempotent reactions/follows; own/unfollow/block edge cases; cooked photos cannot replace original photos.
- [ ] Implement opt-in public profiles without email or private recipe enumeration; author names come from stable profile attribution rather than client-supplied identity.
- [ ] Implement positive reactions, following and explicit-audience cooked activity. Enforce blocking, moderation and rate limits at the service boundary.
- [ ] Run tests to green; commit public discovery/interactions.

### Task 8: Integrate approved UI into real Omnicook

**Files:** modify existing `src/app/page.tsx`, `src/app/styles.css`, `src/components/KitchenIcon.tsx`, API/mobile adapter types only where necessary; create `src/lib/social/client.ts`, `src/components/social/{Family,Discover,ShareDialog,Alternatives,Profile,ReportDialog}.tsx` and scoped styles.

**Interfaces:** social components receive real owner identity/recipe UUIDs and callbacks for `refreshVault`, `openRecipe`, structured draft/edit and plan navigation. All new asynchronous results carry account/request stamps. Original import/review/cooking/account/planner services remain authoritative.

- [ ] Write failing navigation/ownership regressions against original component contracts: source filters, three layouts, personal collections, delete/photo controls, import recovery/ratios and signed-in planner remain reachable.
- [ ] Add My cookbook/Family/Discover/Plan navigation, prominent Add recipe, labelled shopping subview and avatar account access using the existing guarded navigation mechanism and safe-area shell.
- [ ] Wire real family/discovery/sharing/alternative/report/profile UI to new APIs; preserve honest errors and retries. Use full recipe metadata and photo credits in saved/shared/detail/cooking views.
- [ ] Wire save/adapt to real owned recipe UUIDs, then use the original editor/planner/sous-chef paths. Retain original ads, photo preparation/background status and account-scoped drafts. Never silently fall back to fixtures for a signed-in failure.
- [ ] Implement mobile kitchen comfort from the spec: pinned bottom primary controls with safe-area/keyboard clearance, generous full-row ingredient/checklist targets, larger recipe/step text and optional scoped Screen Wake Lock with release/unavailable handling. Retain the real cooking ingredients and sous-chef; keep destructive/social actions out of the primary cooking rail.
- [ ] Verify owner switching during in-flight family/discovery/copy responses cannot leak or attach data to the next account. Test inaccessible-source/copy attribution and dirty-editor leave guards.
- [ ] Run relevant tests/types/browser flows to green; commit the real UI integration.

### Task 9: Whole-app preservation, privacy and release readiness

**Files:** `scripts/social-integration.mjs`, `tests/social-preservation.test.cjs`, `docs/social-preservation-checklist.md`, isolated evidence artifacts; repair only implementation files implicated by reproduced failures.

**Interfaces:** consumes all prior tasks; produces an independently reviewable branch, migration/rollback instructions and evidence matched to every preservation row.

- [ ] Run `npm test`, `npx tsc --noEmit`, `npm run build -- --webpack`; preserve known production import fixes and provider gates.
- [ ] Run real isolated-DB two-account/anonymous integration cases from Review Focus plus migration idempotency/data-preservation checks; clean only explicitly created fixtures in that isolated branch.
- [ ] Browser-check original sign-in/session switching, import/caption/error/report/recovery/ratio/editor/collection/photo/sous-chef/cooking/plan/shopping/account routes and new family/public/moderation flows at phone/tablet/desktop widths. Distinguish actual live checks, intercepted responses and source-only review.
- [ ] Measure mobile tap targets and action gaps; verify fixed rails leave the final ingredient/step visible, exit remains reachable and checked ingredients persist between steps. Check long content, enlarged text, portrait/landscape, keyboard and safe areas; verify Screen Wake Lock unavailable/release/exit paths and record actual kitchen-device acceptance separately.
- [ ] Dispatch fresh whole-branch reviewer with design, plan, preservation matrix, base/head and test evidence; reproduce/fix Critical/Important findings and rerun affected checks.
- [ ] Update the ledger, preservation checklist and DevWiki/log. Leave production configuration/database/deployment unchanged; present review results, remaining real-device checks and deployment prerequisites.

## Self-review and execution handoff

Coverage checked against the full preservation table and each social requirement; privacy, revocation and moderation precede public UI activation. Cross-task interfaces explicitly preserve existing ownership and structured recipe/photo contracts. No fixture-only flow counts as production completion. Implementation method and this concrete plan require review at the planning handoff before product-code execution.
