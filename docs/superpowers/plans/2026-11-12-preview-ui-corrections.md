# Preview UI corrections implementation plan

> Use superpowers:executing-plans to implement task-by-task.

**Goal:** Resolve the eight confirmed issues in the local combined preview.
**Architecture:** Keep prototype data in memory. Introduce a small pure recipe adapter using existing quantity parsing/scaling, with explicit base yield and nullable duration. Shared Planner changes use default-preserving optional presentation props.
**Tech Stack:** Existing Next.js/React/TypeScript and node:test.
**Spec:** docs/2026-11-11-local-ui-ux-review.md (user approved implementation 2026-11-12).

## Constraints
- Preserve existing uncommitted work; edit in place. No production deployment, auth/database changes or dependency additions.
- Manual base yield is required (1–100 whole servings); duration optional (1–1440 minutes), cuisine optional. Blank time displays Time not set.
- Existing sample recipes explicitly have a four-serving base. Adaptations preserve metadata.
- Keep actual app sign-in notices and nutrition review warnings as defaults; opt into prototype copy from /social-preview.

## Tasks
1. [x] Add regression tests for a pure preview adapter: ranges/fractions/decimals/unquantified ingredients, custom yield, unknown time and source labels. Run RED, implement and run GREEN through mobileToPlannable and buildShoppingList.
2. [x] Wire adapter and explicit metadata into draft save/edit, detail, cooking and cards. Require base yield, preserve drafts, label public saves accurately, and notify on automatic save for planning.
3. [x] Put ingredients before method in phone reading order while retaining desktop columns; make header audience contextual and Shopping breadcrumb accurate. Add intentional prototype notice and one nutrition availability note in picker with default shared behavior preserved.
4. [x] Run full node tests and TypeScript. Browser verify manual save/draft retention, eight-serving range and non-four base yields through detail/cooking/shopping, public provenance, privacy, phone ingredient order, Shopping breadcrumb and picker copy. Spot check 320/393/820/1366 widths. Review final diff and update documentation/DevWiki.

## Review focus
- Fraction/range amounts must not be silently treated as unquantified.
- Unknown time must not become zero or 20 minutes in the planner.
- Base yield must propagate through saved/adapted/edited recipes and cooking.
- Public card labels must stay correct when opened from Cookbook.
- Shared Planner must keep its existing default behavior outside this preview.


## Verification and review record
- Five regression tests RED→GREEN; complete suite 122/122. TypeScript passed.
- Independent review: fixed em-dash divergence using the same parser/scaler; fixed stale mounted preview catalogue for picks/generation. Updated featured recipe metadata as part of metadata consistency. No deferred findings in the reviewed scope.
- Browser confirmed fresh eight-serving range quantities and edited two-serving base yield without reloading, retained draft fields, cooking quantities, provenance/auto-save notice, all copy corrections and responsive DOM order/width at 320/393/820/1366.
- Ruling: existing planned meal snapshots remain unchanged until explicitly replaced, so editing a recipe cannot silently alter a locked plan. New selections and generations use the latest catalogue.
- Product changes remain uncommitted alongside the user's existing prototype work. No production deploy.
