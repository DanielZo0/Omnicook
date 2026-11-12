# Combined Omnicook preview

Open `/social-preview` with the Next.js development server. The combined preview starts in My cookbook, with Family table, Discover and Plan navigation. This is a disposable frontend prototype using in-memory fixtures, separate from the existing app entry point. It performs no application API requests, authentication operations, database writes, emails or real publishing. Refresh resets everything. Food photographs are illustrative remote Unsplash images.

## Try these flows

- Add a recipe → enter any sample HTTPS recipe link → Preview import → edit the fixture → save privately → share with family or add to the meal plan. The link is not fetched. Manual entry is also available.
- Open a recipe → change servings, start cooking and move through the method; cooking help is a clearly labelled sample.
- Plan → choose meals or generate a menu, then open the quantity-aware shopping list. This reuses the original Planner component with signedIn=false and in-memory sample recipe adapters. Its existing account/API path is not used.
- Family table → See the alternative → compare collapsed alternatives and Always show alternatives.
- Suggest an alternative → enter replacement, quantity and optional bounded cooking note. Alternatives stay beside the ingredient.
- Use in my copy → creates a separately owned adaptation with contributor attribution and a link to the original.
- Share your recipe → compare Private, Family cookbook, Anyone with the link and Published. The link option opens a recipient-view demonstration without family suggestions. No real share link is issued.
- Shared cookbooks → create a sample cookbook, open it, invite someone or manage members. New cookbooks reuse fixtures to demonstrate layout; group isolation is not implemented.
- Discover → filter cuisine, follow a cook, switch to Following, like or save a recipe.
- My cookbook → reopen an adaptation, edit its title/note, or mark a recipe as cooked with an optional browser-only photo preview.
- Report a recipe/suggestion or block a cook → content is hidden locally. Reports are not submitted anywhere.

## Agreed direction

Family/friend sharing and private shared cookbooks come first; public discovery is a separate opt-in. Contributors control originals. Other members save, adapt and suggest ingredient alternatives rather than requesting changes to originals. Alternatives show author attribution and optional contributor endorsement. No public free-text comment threads. Private suggestion notes are structured and limited to 240 characters.

## Prototype boundaries and decisions still needed

- This demonstrates screens and interaction choices, not authorization or moderation enforcement. Backend permission checks, moderation queues, rate limits, membership/invite security and public content policy remain future work.
- Whether saved copies can accept subsequent original updates is undecided; this preview creates independent in-memory adaptations.
- Cookbook export, persisted cooking-photo submissions, provider-backed search, real extraction/AI, notifications, genuine anonymous recipe URLs and production publication are outside this prototype.
- Do not ship the prototype's fixtures or UI-only permissions as production features. No production deployment is authorized by this preview request.

## Verification

TypeScript passed. Browser checks exercised private suggestion creation, attributed adaptation and reopening its retained substitution, unchanged original, link-recipient exclusion of private alternatives, cuisine/following filters, cookbook creation, contributor edit visibility and cooked confirmation. Family-table document widths were checked at 320, 393, 820 and 1366 CSS pixels with no horizontal overflow. Browser error log was empty at completion. Screenshots are in `artifacts/social-family-desktop.png`, `artifacts/social-family-phone.png` and `artifacts/social-alternatives-desktop.png`.


## Combined preview verification (2026-11-01)

TypeScript passed. Browser walkthrough: sample import/review/save → private family sharing → recipe-to-plan picker → planned meal → six quantity-scaled shopping rows. Shopping checks and planned entries survive navigation. Cooking steps finish into the cooked-photo prompt, and servings scale from 300 g orzo at four to 375 g at five. Weekly planner and shopping views have no document overflow at 320/393/820/1366 CSS pixel viewport sizes. Original app entry point, original planner source, authentication and API routes remain unchanged by this prototype.

## Planner layout refinement (2026-11-03)

Compact mode tabs, inline mobile preferences, a single-row week selector and an expandable earlier-days row replace the tall planner header. The shared Planner now has an optional `compactCurrentWeek` prop (default false), enabled only in this preview. Current-week cards/range start at the browser's local today; Show earlier days restores all seven. Other weeks stay complete. Stored entries, the Monday week anchor, full-week generation and shopping totals are unchanged; the generation button explicitly says Generate full week when earlier cards are hidden. Eleven focused date/planner-generation/request-guard/shopping tests and TypeScript pass; browser verified 6→7→next-week 7→this-week 6 and no overflow at 320/393/820 widths.

### Community feed and profiles — 4 November 2026

Discover now uses a public recipe timeline, with Everyone/Following, cook/date headers and the existing like/save/share actions. Names and avatars open a full cook profile. The account avatar opens My kitchen, with Published recipes and a separate Family shares overview; private saved recipes remain in My cookbook. The five mobile actions and central yellow Add recipe stay in place.

The orzo fixture starts as Published to demonstrate the owner's profile. Sharing changes update the feed/profile/family lists within the session. Profiles display published recipes only for visitors, including when opened from a family recipe; family shares are only shown in the current user's overview. These are presentation boundaries, not server authorization. No public comments or actual publication, follow, report, link, database or account writes were added.

### Unified Community preview — 6 November 2026

Community is now one primary navigation destination with Family / Discover / My shares sections. Family includes an explicit private cookbook selector. My shares lists only owned shared recipes, filters Public / Family only / Link only, and opens the sharing controls or public profile. Public profiles now display published recipes only; the private management overview lives in Community. Bottom navigation is Cookbook / Community / central yellow Add recipe / Plan / Shopping. Shopping is a shortcut to the existing mounted planner shopping mode; no new shopping implementation or persistence changes.

### My feed destination labels — 6 November 2026

Renamed My shares to My feed. Tiles show Discover · Public, the selected shared cookbook name · Private, or Link only. A per-recipe in-memory cookbook mapping retains the chosen destination when switching groups or reopening sharing. The preview still models one audience/destination per recipe, not simultaneous publication into multiple cookbooks. TypeScript and browser public/named-cookbook labels verified.

### Multiple sharing destinations — 6 November 2026

Supersedes the single-audience preview limitation above. The sharing dialog now lists Discover plus every fixture cookbook membership as independent checkboxes. Existing destinations are checked on open; new recipes start with none. Save applies the complete selection; cancel discards edits; an empty selection keeps the recipe private. Family views filter by the selected cookbook, public discovery/profiles require Discover, and My feed shows one badge per destination. Only contributors can change original destinations. The share-link recipient layout remains a separate preview action and creates no access grant. No backend or real publication writes.

### My feed is the public profile — 6 November 2026

My feed now renders the current user’s public kitchen/profile directly, with Community tabs retained and only Discover-published recipes listed. Removed the private sharing overview, audience filters, destination badges there and the duplicate Manage sharing button. Family-only recipes remain in their groups and Cookbook. Existing recipe share icons still open the multi-destination selector; public profile context hides family ingredient alternatives. Browser verified own profile navigation, no Manage sharing button, sharing access and family-only recipe omission.

### UX cleanup preview — 7 November 2026

Implemented in the disposable frontend preview:
- Import/manual drafts stay mounted across navigation and can be explicitly discarded. Recipe edit dialogs guard unsaved dismissal.
- Cooking preserves the originating view; finishing prompts for an explicit audience (Only me by default). Photos are kept per recipe, and saved family updates appear only in their chosen cookbook activity.
- Other cooks’ public recipes have a separate demo-link/recipient path. Destination checkboxes remain contributor-controlled; no actual publication/access grants are created. Fixed sample links use `?sampleRecipe=3/4/5` locally; newly entered recipes offer a recipient layout rather than a real persistent link.
- Family has a compact yellow selector/header, Recipes/Activity tabs, Create cookbook, People & access, per-cookbook members/invitations/roles, last-admin/owner departure guard, ownership transfer, rename and archive/leave controls. Resend/revoke are local previews, never email operations. Member removal drops their contributions from that cookbook's fixture view, without deleting originals.
- Ingredient alternatives are keyed by cookbook + recipe + exact ingredient text. Existing examples still target the cream ingredient; arbitrary ingredient selection and server revision safety remain production work. Suggestion reports hide only that suggestion; cookbook reports have a small admin review list.
- Recipe edit/adapt/report actions live under More options. Owned recipes cannot be unsaved. Owner-only Cookbook chips list destinations; public profiles omit cookbook names.
- Avatar opens account tools: public profile, name/bio editing, following and reversible block management. My feed remains the public profile; its single tab became a heading.
- Preview-only CSS removes local Plan/Shopping switching duplicates and collapses unavailable nutrition behind an expandable explanation. Original Planner source was not changed in this pass. Generation still explicitly targets a full week; remaining-days generation is not implemented.

Verification: TypeScript passes; 11 focused planner/date/generation/shopping tests pass. Browser confirmed retained draft after navigation, edit discard prompt, Discover→cooking→Discover with Published label and private default, public share link action, distinct group memberships/invites, last-admin guard, fresh cookbook empty state/new share destination, group-scoped alternatives and targeted suggestion reporting. No document overflow at320 and1366 viewport requests (actual innerWidth320/1367); final Family preview is open. All fixtures reset on refresh; real auth/extraction/AI, invites, moderation enforcement, DB persistence and deployment remain outside this preview.

### Control consistency — 7 November 2026

More options now uses a native block disclosure with a single column of icon/text action rows, replacing the flex-root details that placed its summary and actions side by side. Collapsed actions remain hidden. Rows use14px text, consistent18px line icons,48px targets and no link underlines. New shared PreviewBack control provides the same chevron,14px type,44px target, spacing and focus treatment across recipe, import, cooking and profile screens. Browser verified open/closed behaviour, matching dimensions and no document overflow at320px. TypeScript passes. Presentation only; no backend or production changes.

### UI audit corrections — 12 November 2026

The eight findings in docs/2026-11-11-local-ui-ux-review.md are implemented in this disposable preview. New manual recipes require base servings, with optional time/cuisine. Detail/cooking/shopping share quantity handling; edited metadata is available to new planner picks without resetting planned meals. Public saved provenance, contextual header audience, Shopping breadcrumb, mobile ingredient order and prototype notice/nutrition copy are corrected. All changes remain local; no real sharing, account/database writes or deployment was added. Full verification is recorded in the review document.
