# Omnicook — project status

Last updated: 2026-10-18 (iPhone/iPad redesign; older verification and deployment notes below remain historical)

## iPhone and iPad redesign — 2026-10-18

- First live design pass uses a porcelain/blue palette, Manrope interface type and Lora
  recipe titles, custom SVG navigation icons, larger recipe photography, and grid/list/editorial views.
- iPhone has bottom navigation, safe-area-aware spacing and reachable cooking actions.
  iPad widths from 800px have a persistent sidebar; recipe detail places ingredients beside
  the method, cooking mode keeps all ingredients alongside the current step, and the weekly
  planner uses multiple columns. Smaller tablets use the phone navigation with more gallery columns.
- Import uses one labelled link-or-caption field and a manual-recipe action. Existing API,
  auth, recipe ownership and photo upload flows remain connected. No new provider requests
  or persistent test data were created for this redesign.
- Titles now sit below recipe photography; serving controls wrap on narrow tablet columns.
  Cooking mode has a real question input and no longer claims an unimplemented screen wake lock.
- Home-screen PNG icons (180/192/512px) and manifest/browser theme match the redesign.
- Browser checks cover 320, 393, 768, 820, 1024 and 1366px widths, grid/list/editorial,
  search, recipe opening, serving controls, next cooking step, import/manual editor and planner.
  Regression suite: 39/39 pass. Production Webpack build and TypeScript pass.
  Actual iPhone/iPad Safari, keyboard/camera and installed-PWA testing remain pending.
- Code review found the smaller-tablet feed layout override; fixed and browser-verified.
  Editor textarea has a minimum-width guard; 320px editor showed no overflow.
- Browser review also noticed an older scaling bug: 2-3 becomes 4-3 at 2x. Range parsing
  is outside this visual pass and remains a follow-up.
- Release verified for GitHub merge and Vercel rollout; current deployment state is recorded in DevWiki.
- Before rollout, a no-compute Neon recovery branch `pre-deploy-2026-10-18-redesign` was created.
  Read-only integrity checks cover all 70 existing recipes, their 743 ingredients/557 steps,
  five collections, one meal-plan entry, four accounts and 18 stored photos.
  All 36 account-isolation/upload checks passed and temporary fixtures were removed.
  Production sign-in confirmed the same persistent demo account and recipe IDs as the existing DB.

## Automatic recipe photos — 2026-10-16

- Photo choice is automatic on the server: copy a source photo, select a close licensed
  Wikimedia match using the configured model, then generate with NVIDIA FLUX.2 Klein.
  No generation/lookup choices or URL fields are exposed in the review flow.
- Source/lookup/generated photos are normalized to small WebP files and persisted in Neon.
  The additive photo_data/photo_metadata migration is applied to the configured DB.
  Images are served only after recipe-owner authentication; vault JSON excludes image bytes.
- Add my cooking photo lets users replace the illustration with their actual dish.
  Uploads strip EXIF, validate decoded formats, and remain protected from late automatic jobs
  and concurrent edits. Generated and related images have appropriate labels/credits.
- Automatic jobs run after saving, have a 100-second budget, recover interrupted claims,
  and retry failures after 24 hours up to three attempts. Unchanged edits reuse photos.
- Real source copies, licensed bruschetta lookup and generated banana-oat pancakes verified.
  Eight of the nine demo recipes have persisted photos; one remains on a safe placeholder
  after provider failures. Core saving succeeds regardless of photo-provider availability.
- All 39 regression tests, 36 real-account HTTP checks and the production build pass. Temporary accounts and
  fixtures were removed. Reviewer found no remaining Important issue. Deployment pending.
- The older NVIDIA FLUX.1 endpoint timed out; FLUX.2 Klein was verified live using cfg_scale=1
  and no mode field, which differs from the published API defaults. Regression covers this.

## Account isolation verification — 2026-10-14

- Local browser auth was blocked by Neon's trusted origins: Google sign-in returned
  `INVALID_CALLBACKURL` (403). Added the exact local origin `http://127.0.0.1:3018`
  to the existing branch configuration. Sign-in now returns a redirect (200), and
  Google's sign-in page loads without `redirect_uri_mismatch` or `invalid_client`.
  Completing Google account sign-in still needs browser verification by the user.

- Two real temporary Neon Auth accounts exercised the local API against the configured
  Neon database. `npm run test:isolation` passes 28 checks, including anonymous access,
  both directions of cross-account access, and allowed owner operations.
- Fixed missing collection ownership checks in recipe creation/editing and missing recipe
  ownership checks in meal-plan writes. Meal-plan reads now also require recipe ownership,
  hiding any older cross-account links that could expose another account's recipe title.
- Temporary auth accounts, sessions, and business fixtures were removed after testing.
- These fixes are local and have not been deployed. See `docs/account-isolation-testing.md`
  for reproduction and cleanup details. Mobile/browser session switching was not tested.

## Social imports and source photos — 2026-10-14

- Instagram metadata/embedded captions are scoped to the requested post. Pinterest follows
  the requested pin's original recipe link and prefers complete structured Recipe data.
  Blocked or incomplete social content asks for the full caption or original recipe link.
- Source fetching has public-address validation, pinned DNS, redirect/size limits and a
  14-second deadline. AI extraction has a shared 40-second budget covering response bodies,
  one schema-guided repair, explicit insufficient-content refusal, and truncation detection.
- Saved recipes persist their source image URL; review/edit supports replacing or clearing
  it. Missing, unsafe or broken images show a neutral plate illustration. Random stock
  photos are removed. The additive image_url migration has been applied to the configured DB.
- Persistent demo vault has nine recipes, including a real Pinterest import, and six source
  photos. Live Instagram extraction returned 26 ingredients and 16 steps; Pinterest returned
  a complete lemon chickpea stew. Groq is the verified local active provider, superseding
  older notes claiming its key is unset. Larger output allowance fixes its observed cutoff.
- All 26 regression tests, 28 real-account API checks and the production build pass. Browser photo review passed
  before the server restart; final browser automation reconnection is blocked by its error-page
  URL policy, while local HTTP/API checks succeed. These code changes are not deployed.
- Next.js patched from 16.3.4 to 16.3.8. Six audit findings remain (four moderate, two high).
  Remote social photos may expire; durable media storage remains future work.
- See docs/social-imports-and-images.md for implementation and verification details.

## Product direction

Omnicook is a browser application for importing social-media and food-blog recipes, organising a private recipe vault, scaling ingredients while cooking, planning meals, and generating grocery lists.

## Completed

- Created the visual browser prototype and published the initial app to GitHub.
- Added recipe search, platform/category filters, import UI, cooking checklist, serving scaling, meal planner, and grocery-list logic in the prototype.
- Added a Progressive Web App manifest and service worker for installable/offline app-shell support.
- Created a Next.js application foundation for the live version.
- Defined a shared Zod recipe contract for AI extraction and persistence (`src/lib/recipe-schema.ts`).
- Added `.env.example` and `.gitignore` rules so local credentials cannot be committed.
- Built a pluggable extraction provider (`src/lib/extraction/`): Groq's free-tier API is
  the primary provider, Gemini is a fallback if only `GEMINI_API_KEY` is set, and the
  route stays fail-closed with no provider configured — no key can leak into client code.
- `POST /api/import` fetches/strips URL sources, calls the selected provider, validates
  the JSON against `recipeSchema`, and returns an unsaved draft for the user to review.
- Replaced the desktop prototype UI with the full 11-screen mobile app imported from the
  Claude Design canvas (`Omnicook Mobile.dc.html`): onboarding, vault (grid/feed/editorial
  layouts), search, import (share-sheet placeholder + paste + manual entry), extraction
  progress, review, recipe detail with serving scaling, cook mode, weekly planner, grocery
  list, and profile. The canvas's fake iOS device-frame chrome was intentionally dropped —
  the app now renders full-viewport and relies on the real mobile browser/PWA chrome.
  Styling is ported near-verbatim from the design via a small `s()` CSS-string-to-style-object
  helper (`src/lib/mobile/style.ts`) rather than a utility CSS framework.
- Added a real AI sous-chef: `POST /api/sous-chef` (`src/lib/chef/provider.ts`, same
  Groq-then-Gemini fallback pattern as extraction) answers cooking questions grounded in
  the open recipe's ingredients/steps. Wired into both the recipe detail and cook-mode screens.
- Wired the PWA manifest for real "Add to Home Screen" support: `public/manifest.webmanifest`
  (start_url `/`) is linked from `layout.tsx` along with `apple-mobile-web-app` meta and
  Google Fonts (DM Sans + Playfair Display). Service worker registration is still out of
  scope — see In progress.
- Recipe collections and grocery aisles are real, schema-backed data rather than client-side
  guesses: every recipe can belong to one collection, and every ingredient has a real
  `Produce` / `Dairy & chilled` / `Pantry` aisle that the extraction prompt asks the AI to
  classify and the review screen lets the user correct.
- **Migrated the backend from Supabase to Neon + Drizzle ORM.**
  Neon has no client-safe SDK with Supabase-style Row Level Security, so the architecture
  changed shape, not just the connection string:
  - `src/lib/db/schema.ts` — Drizzle schema (source of truth for the database), covering
    `recipes`, `recipe_ingredients`, `recipe_steps`, `meal_plan_items`, and `collections`.
    `drizzle.config.ts` + `npm run db:push` replace the old hand-written `.sql` migrations.
  - `src/lib/db/client.ts` — server-only Neon connection (`DATABASE_URL`), via
    `@neondatabase/serverless` + `drizzle-orm/neon-http`. This can never be imported from a
    client component (`import 'server-only'` enforces it at build time).
  - All database access now happens in server API routes — `POST/GET /api/recipes`,
    `/api/collections`, `/api/meal-plan` — which check the signed-in user server-side and
    filter every query by `user_id` in application code (Neon's equivalent of what RLS did
    on Supabase, since there's no anon-key-plus-RLS model here).
  - `src/lib/api/client.ts` — browser-side fetch wrappers with the **same function names and
    shapes** the old `src/lib/supabase/queries.ts` had (`listRecipes`, `createRecipeFromDraft`,
    `listCollections`, `createCollection`, `listMealPlanItems`, `upsertMealPlanItem`), so
    `src/app/page.tsx` needed only an import swap, not a rewrite of its data logic.
  - Removed `@supabase/supabase-js`, `src/lib/supabase/`, and the `supabase/migrations/`
    folder entirely (that SQL used Supabase-specific `auth.uid()` RLS syntax that doesn't
    apply here).
- **Provisioned a real Neon Postgres project via Claimable Neon**, then **claimed it into the
  user's real Neon account**:
  - Project id `hidden-field-76935519`, branch `br-ancient-bread-b4vkdco6`, region `us-east-2`.
  - `drizzle.config.ts` loads `.env.local` itself (via `dotenv`, since `drizzle-kit` does not
    read Next's env files) and points migrations at `DATABASE_URL_UNPOOLED` specifically —
    Neon's pooled/PgBouncer connection doesn't support the session-level operations
    `drizzle-kit push` needs.
  - `npm run db:push` has been run against the real, claimed project: all five tables
    (`recipes`, `recipe_ingredients`, `recipe_steps`, `meal_plan_items`, `collections`) exist,
    confirmed with `neon inspect db table-sizes`.
- **Auth is Neon Auth on the Better Auth provider** (`npx neon neon-auth enable`) — not Stack
  Auth, which was the initial (incorrect) assumption; Neon changed its default auth product
  since then. Real packages: `@neondatabase/auth` (server) and `@neondatabase/neon-js` (client,
  `/auth` subpath). Key files:
  - `src/lib/auth/server.ts` — `createNeonAuth({baseUrl, cookies:{secret}})`, server-only.
  - `src/app/api/auth/[...path]/route.ts` — proxies `auth.handler()` for both `GET`/`POST`,
    **forwarding Next's route `{ params }` context** — the handler destructures `params`
    internally and throws a 500 if it's dropped, which is exactly what happened on the first
    pass (see the debugging note below).
  - `src/lib/auth/client.ts` — the browser auth client points at **this app's own
    `/api/auth` proxy** (`${window.location.origin}/api/auth`), not `NEON_AUTH_BASE_URL`
    directly. Calling the client straight at Neon's hosted auth domain is cross-origin from
    the app, so the session cookie never reaches the app's own domain — the whole point of
    the `/api/auth` proxy is to make it a same-origin, first-party cookie.
  - `src/lib/auth/session.ts` — client `useSession()` hook, same `{user, loading}` shape the
    old Supabase/Stack Auth hooks had.
  - `src/app/login/page.tsx` — email+password sign-in/sign-up form, plus a "Continue with
    Google" button. (The originally-planned passwordless email-OTP flow isn't available on
    this managed product without configuring an extra plugin — the CLI's `neon neon-auth
    config` only exposes `email-password`, `email-provider`, `organization`, `webhook`, not
    an OTP/magic-link plugin — so email+password is what's actually wired up.)
  - `layout.tsx` no longer needs any provider wrapper for this SDK (cookie/API based, not
    React-context based like Stack Auth was).
  - **Debugging notes, since this beta SDK's docs are sparse**: (1) `createNeonAuth`'s
    generated type is deep enough to crash `tsc` (`Maximum call stack size exceeded`) if ever
    inferred instead of erased — both `src/lib/auth/server.ts` and `client.ts` hold the
    instance behind a deliberate `any`-typed accessor to stop that. (2) `createAuthClient()`'s
    return value has **no `.auth.` namespace** — call `.getSession()`, `.signIn.email()` etc.
    directly on it, not `.auth.getSession()`. (3) `createAuthClient(url)` needs an absolute
    URL — a bare relative path throws inside the SDK's own `new URL()` call.
  - **Verified live, signed in as a real user** (email+password): sign-up, sign-in, session
    persistence across page loads, and saving a real recipe through `POST /api/recipes` as
    that signed-in user, which then appeared correctly in the vault. This is genuinely
    working end-to-end now, not just demo-mode-still-renders — a step further than any other
    provider integration this project has had.
  - **Google sign-in is enabled but currently broken on Neon's side**: `neon neon-auth
    oauth-provider add --provider-id google` turned on Neon's shared dev Google OAuth app,
    but its callback redirect URI
    (`https://neonauth.c-6.us-east-2.aws.neon.tech/auth/oauth/callback/google`) is not
    registered in Neon's own Google Cloud project, so Google rejects it with
    `Error 400: redirect_uri_mismatch`. This is not fixable from this codebase — it needs
    either Neon to fix their shared app, or registering a real Google OAuth client of your
    own via `--oauth-client-id`/`--oauth-client-secret` on the same command.
  - A test account (`danzammit1@gmail.com`) and one test recipe ("Test Neon Recipe") exist in
    the claimed Neon database from this verification pass — harmless, but real; delete via the
    app or `neon-auth user` CLI commands if you'd rather start clean.
- **Tested the `GROQ_API_KEY` value directly against xAI's API** (its `xai-...` prefix was
  the tell) — it authenticates fine, but that xAI team has zero credits/licenses, so every
  request 403s until it's funded at console.x.ai. Moved it to its own `XAI_API_KEY` var and
  added `src/lib/extraction/xai.ts` (+ the sous-chef equivalent in `src/lib/chef/provider.ts`)
  as a real fallback provider, so it activates automatically the moment that account is funded.
- **Added NVIDIA build.nvidia.com as another free-tier fallback provider**
  (`src/lib/extraction/nvidia.ts` + sous-chef equivalent), using their OpenAI-compatible
  endpoint (`https://integrate.api.nvidia.com/v1/chat/completions`). Provider priority is now
  Groq → NVIDIA → xAI → Gemini, tried in that order.
  - Went through two wrong model choices before landing on a verified-live one — worth
    recording since the API reference docs (`docs.api.nvidia.com`) turned out to lag well
    behind the actual catalog on build.nvidia.com: (1) `nvidia/nemotron-3-super-120b-a12b`
    explicitly supports structured JSON output but is deprecated 2026-10-02. (2)
    `meta/llama-3.3-70b-instruct`, suggested by the reference docs as a replacement, **does
    not exist in the live catalog at all** — searching build.nvidia.com for "llama" turned up
    only vision (`llama-3.2-*-vision-instruct`) and safety/guard variants, no general-purpose
    Llama chat model. Confirmed by actually driving the live site (Claude Browser), not by
    fetching docs pages, after the model-not-found mismatch happened twice.
  - **Current default: `nvidia/nemotron-3.5-lightning-30b-a3b`** — confirmed live on its own
    model page: Free Endpoint available, not deprecated, and "Structured Output: Supported".
  - **NVIDIA extraction is now fully working end-to-end, live in production**, after fixing
    two real bugs found while testing with a real key:
    1. **The actual bug behind the earlier "404 page not found" errors** (previously
       misdiagnosed as a local proxy/environment issue — it wasn't): `NVIDIA_MODEL` in
       `.env.local` had accidentally been set to a second API key value instead of a model
       name. NVIDIA's gateway was routing to a nonexistent "model" named `nvapi-...` and
       returning a Go-style 404. Fixed by correcting the value back to
       `nvidia/nemotron-3.5-lightning-30b-a3b`.
    2. This model reasons at length by default — 100+ tokens even on a trivial one-word
       prompt — which blew through every timeout tried, up to 55s with `maxDuration: 60`
       set on the Vercel function. Fixed by setting `chat_template_kwargs: {enable_thinking:
       false}` in the request body (both `src/lib/extraction/nvidia.ts` and the sous-chef
       equivalent), which dropped a real extraction call from timing out to ~8-17s. The
       earlier defensive `<think>...</think>`-stripping in the response parser is kept as a
       cheap safety net but is no longer load-bearing.
  - **Verified live against the deployed production app**: pasted a real caption through the
    actual `/login` → import → review → save flow at https://omnicook-seven.vercel.app,
    watched the review screen populate with 5 correctly-typed ingredients (right `aisle` enum
    values) and 4 steps in ~8 seconds, saved it, and confirmed it persisted in the vault.
- **Deployed to production on Vercel**, connected to a new GitHub repo:
  - Merged this rebuild into the pre-existing `DanielZo0/Omnicook` GitHub repo (public; had
    two commits from the very first prototype) rather than creating a duplicate — one
    `index.html` merge conflict, resolved by keeping this session's version.
  - Live at **https://omnicook-seven.vercel.app** (Vercel project `danielzo0s-projects/omnicook`,
    linked via CLI since GitHub auto-connect failed — deploys are manual via `vercel deploy
    --prod` until that's fixed in the Vercel dashboard, not via git push).
  - All required env vars are set on Vercel's Production environment: `DATABASE_URL`,
    `NEXT_PUBLIC_NEON_AUTH_BASE_URL`, `NEON_AUTH_BASE_URL`, `NVIDIA_API_KEY`, `NVIDIA_MODEL`,
    `XAI_API_KEY`, `XAI_MODEL`. **`NEON_AUTH_COOKIE_SECRET` on Vercel is a freshly generated
    value, deliberately different from the one in local `.env.local`** — sessions from one
    environment won't validate against the other, which is intentional.
  - Registered the production domain with Neon Auth's trusted-domains list
    (`neon neon-auth domain add https://omnicook-seven.vercel.app`) — skipping this causes an
    "invalid domain" sign-in failure on the deployed site specifically.

## In progress

- Google sign-in is wired up in the UI but blocked by the Neon-side OAuth misconfiguration
  described above — needs either a Neon fix or your own Google OAuth client.
- Groq and Gemini keys are still unset (NVIDIA and xAI are the only providers with real
  working/valid keys right now, and NVIDIA is confirmed working end-to-end in production).
- Recipe media is now persisted as bounded WebP bytes in Neon. Move bytes to object storage
  if vault volume warrants it; no additional storage account is needed for the current app.
- Service worker registration/offline caching for the Next.js app (the old static-prototype
  `service-worker.js`/root `manifest.webmanifest` at the repo root are leftovers from the
  pre-Next.js prototype and are not wired into the live app — `public/manifest.webmanifest`
  is the one actually served now).
- "Scan a photo" (image OCR import) is a disabled placeholder — out of scope this session.
- A recipe can only belong to one collection (a simple `collection_id` FK, not a many-to-many
  join) — reassigning/removing a recipe's collection after saving isn't exposed in the UI yet
  (only settable at save time on the review screen).

## Not yet connected

Everything required for a working app is live: Neon Postgres, Neon Auth, NVIDIA extraction,
and the Vercel production deployment. Only Groq, Gemini, and a real Google OAuth client
remain unconnected, and none of those block core functionality.

## Required credentials

| Variable | Owner | Where it belongs | Status |
|---|---|---|---|
| `DATABASE_URL` / `DATABASE_URL_UNPOOLED` | Neon Postgres | Vercel server env + `.env.local` | ✅ live, claimed |
| `NEXT_PUBLIC_NEON_AUTH_BASE_URL` | Neon Auth | Vercel + `.env.local` | ✅ live |
| `NEON_AUTH_BASE_URL` | Neon Auth | Vercel server environment only | ✅ live |
| `NEON_AUTH_COOKIE_SECRET` | generated locally | Vercel server environment only | ✅ set (different value on Vercel vs. local, deliberately) |
| `NVIDIA_API_KEY` / `NVIDIA_MODEL` | build.nvidia.com (free tier) | Vercel server environment only | ✅ live, verified working end-to-end |
| `XAI_API_KEY` | console.x.ai | Vercel server environment only | ⚠️ set and valid, but the xAI team has no credits — 403s until funded |
| `GROQ_API_KEY` | console.groq.com (free tier) | Vercel server environment only | ❌ unset (not needed — NVIDIA is working) |
| `GEMINI_API_KEY` | Google AI Studio / Google Cloud (optional fallback) | Vercel server environment only | ❌ unset |

## Next-stage execution checklist

1. Fix Google sign-in: either wait on/report Neon's shared-app OAuth misconfiguration, or
   register your own Google OAuth client and run `neon neon-auth oauth-provider update
   --provider-id google --oauth-client-id <id> --oauth-client-secret <secret>`.
2. Connect the Vercel project to GitHub for automatic deploy-on-push (the CLI's auto-connect
   failed during setup) — currently every change needs a manual `vercel deploy --prod` after
   `git push`. Check the Vercel dashboard → Project → Settings → Git.
3. Smoke-test the AI sous-chef on the recipe detail and cook-mode screens (uses the same
   NVIDIA key/fix, but hasn't been exercised specifically).
4. Deploy the locally verified ownership fixes, then recheck account isolation on the
   deployed version. The local two-account API suite passed on 2026-10-14.
5. On an actual iPhone/Android browser, use "Add to Home Screen" and confirm the manifest
   icon/name/standalone display work as expected.
6. Decide what to do with the test account/recipes created during verification (`danzammit1@
   gmail.com` — "Test Neon Recipe" and one real gochujang-pasta extraction, both in the
   claimed production database).
7. Optionally set `GROQ_API_KEY` or `GEMINI_API_KEY` for provider redundancy — not required
   today since NVIDIA is confirmed working, but nice to have a second option.

## Validation still pending

The core product loop is now genuinely verified live in production, not just locally:
sign-up, sign-in, session persistence, real AI extraction (NVIDIA, ~8-17s per call), the
review screen, saving a recipe, and it persisting in the vault — all confirmed against
https://omnicook-seven.vercel.app with real HTTP requests. Not yet exercised: the AI
   sous-chef specifically and Google sign-in (historically blocked by the Neon-side OAuth
   bug above). Two-account isolation is now verified locally; deployed fixes remain pending.
