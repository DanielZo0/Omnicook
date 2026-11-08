# Omnicook social integration and functionality preservation

## Intent and authorization

The user approved the combined preview and asked to proceed while preserving every existing Omnicook capability. Family/friends sharing is the centre: invite-only cookbooks, contributor-owned recipes, independent attributed copies, ingredient alternatives and a separate public discovery area. This document turns that approved interaction direction into a production implementation contract. The preview is visual reference only, never a replacement implementation or data model.

## Baseline and integration approach

The existing checkout is on `codex/nutrition-meal-planner` at `7dc0610`, with pre-existing local branding/application changes and untracked preview work. Refreshed `origin/main` is `7b69a2d`; it contains subsequently released Facebook import, branding and ingredient-exclusion fixes absent from the old branch. Start implementation from refreshed main in an isolated checkout. Preserve this original checkout and its local changes; compare every relevant local source change with main before bringing it over.

Keep the original entry point, authentication, import/editor/detail/cooking/account behaviour and existing API contracts. Add social modules and navigation to that real application. Do not replace it with `social-preview/page.tsx`, copy its numeric identifiers or reparse its string ingredients. Use the existing structured recipe/adapters and planner with the real session owner.

Retain the current Next.js 16.4.2 / React 19.2 / Drizzle / Neon stack and Sunny Kitchen branding. No dependency or model/provider upgrades are part of this feature. The production platform remains Vercel; no hosting migration.

## Preservation contract

| Existing capability | Preview gap | Required production integration |
|---|---|---|
| Session-aware startup, onboarding, Google/email auth and owner switching | Fictional Daniel profile | Retain `src/lib/auth`, login and startup/session guards; reset all social requests/state on identity change |
| Private vault loading and starter recipes | Static fixtures | Keep real vault APIs, account isolation, loading/error/empty states and seeding |
| Link and full-caption imports, supported social/web readers | Any valid URL produces chickpea fixture | Preserve `/api/import`, original providers and readers; retain Facebook released fixes |
| Incomplete recipe recovery and original recipe discovery | Simplified review | Preserve incomplete save gate, source/full-recipe links, replacement confirmation and original-link recovery |
| Ratio-formula selection | Absent | Keep formula choice, quantity fidelity and edited-alternative protection |
| Draft persistence/recovery | Refresh loses everything | Retain account-scoped expiry, guest recovery, unsaved-leave/discard guards and stale-response checks |
| Structured recipe editing/deletion | Text-only editing, no delete | Retain creator/category, prep/cook/yield, quantity/unit/notes/aisle/positions, collection, source links, delete confirmation |
| Personal collections | Hardcoded filters | Keep real personal collections and inline creation; shared cookbooks are separate entities |
| Ingredient/creator/source search and grid/feed/editorial layouts | Narrower search and one layout | Preserve original search/filter behaviour and all three layouts |
| Persisted photos and provenance | Repeated stock/browser-only images | Retain source/licensed/generated/uploaded bytes, photo jobs/retries, HEIC preparation, owner access and licence/AI labels |
| Serving scaling and cooking ingredients | Step-only cooking view | Keep existing scaling and ingredients-at-hand during cooking |
| Real contextual AI sous-chef in detail/cooking | Static sample tip | Keep existing request/context/errors and provider configuration; family alternatives are a separate feature |
| Weekly planner/picker/generation/apply | Guest mode only | Keep signed-in persistence, source snapshots, locked meals, revisions/idempotency, preference and week navigation |
| Nutrition/suggestion provider capabilities | Disabled guest capabilities | Retain actual capability gating and unknown-nutrition semantics; provision no providers/keys |
| Quantity-aware shopping and checked state | Reused guest planner | Use existing structured adapters and shopping builder, preserving yields, units, aisles and unmeasured quantities |
| Account information and existing controls | Social profile only | Keep existing account/collection/stat displays; do not promise password recovery, notifications or other controls that do not currently exist |
| Banner/interstitial advertising | Absent | Keep existing units, configuration and guarded navigation; no ad frequency/provider changes |
| PWA/installed-device shell | Separate scrolling page | Preserve manifest/icons, startup/resume, safe areas, keyboard/camera layouts and phone/tablet/desktop behaviour; no new offline claim |

Independent source review found all of the above. Runtime regression evidence is required during execution; this audit alone is not a passing test result.

## Application navigation

My cookbook remains the home screen, with Family, Discover and Plan beside it. Add recipe stays prominent in the cookbook and desktop sidebar, and remains easy to reach on a phone. Shopping remains a directly labelled subview within Plan; My kitchen/account remains available from the avatar. Original source filters, personal collection navigation and view-layout controls remain present.

Preserve the original central yellow Add recipe action in mobile navigation: Cookbook, Family, Add recipe, Discover, Plan. Keep yellow as a prominent functional accent in the cookbook feature panel, selected filters/planner tabs and primary planning/cooking actions, balanced with green. Five navigation targets must fit a 320-pixel viewport without overflow and remain at least 44 × 44 pixels. Focused cooking retains its dedicated action rail instead of ordinary navigation.

Use the preview's layout/styling direction while reusing real production components. Preserve unsaved-editor guards when navigating to social views. Anonymous shared recipe routes do not mount the authenticated app shell or fetch a vault. Social views distinguish loading, unavailable service, empty content and access revoked; no fixture fallback in signed-in production.

## Mobile and kitchen comfort (user addition)

Keep the planner header compact: a segmented menu/shopping switch, title with adjacent preferences, and a single-row week navigator. For the current week show today through Sunday by default, with an accessible Show earlier days control. Other weeks remain seven days. This is a view filter, not deletion: retain earlier saved meals and complete shopping totals. Preserve Monday-anchored storage/generation; explicitly label full-week generation when some cards are hidden. The preview opts into this behaviour; integrate it into the real app only during the planned UI task.

Recipe viewing/cooking must work comfortably with the phone on a counter and with imprecise taps. Use at least 44 × 44 CSS pixel targets for mobile controls, 48-pixel ingredient/checklist rows and 56-pixel primary cooking actions, with at least 8 pixels between adjacent actions. Use at least 16-pixel ingredient/body text, 17-pixel recipe instructions and 28-pixel active cooking-step text with generous line height. Maintain strong foreground/background contrast and avoid relying on colour alone.

Keep Start cooking and Add to plan within bottom-thumb reach on mobile recipe views; pin Previous/Next/Finish actions in cooking mode. Reserve scroll padding and safe-area insets so fixed controls never cover the last ingredient/step, the home indicator or on-screen keyboard. Suppress ordinary bottom navigation during focused cooking, retaining a clearly labelled 48-pixel exit/back control. Retain scaled ingredients at hand, with full-row tappable checkboxes and persistent checked state while advancing steps. Keep destructive, report and publishing actions separate from cooking controls; do not introduce swipe-only gestures.

Offer an optional Keep screen awake control only during cooking. Use browser Screen Wake Lock when supported, show a clear unavailable/released state, and release it when leaving the cooking view or hiding/backgrounding the document. Never claim guaranteed wakefulness on unsupported devices or change OS settings. Verify portrait and landscape, long ingredient/step text, enlarged text, 320/393/820 widths, keyboard and installed-PWA safe areas. Actual counter-use acceptance on the user's phone remains a required device check.

## Data and ownership

Introduce additive social tables; do not rename/delete existing business columns or rewrite existing recipe ownership. Existing recipes remain private until their owner explicitly shares them. Existing personal collections and planner references remain intact.

Separate these concepts:

- **Private recipe:** the existing owner-controlled `recipes` record and structured children.
- **Family grant:** the owner grants a particular cookbook access to the original. Owners can revoke it. Cookbook administrators can remove the grant from that group, but cannot rewrite the original.
- **Publication:** an explicitly approved snapshot for unlisted-link or public discovery access. Publishing does not expose the private recipe endpoint. Subsequent private edits do not silently change public content; the owner explicitly refreshes the publication.
- **Saved/adapted copy:** a separate recipient-owned recipe, copying structured recipe/photo data and carrying immutable provenance. Subsequent edits or deletion of the source do not overwrite/delete a saved copy. Updating from an original is deferred; no automatic merging.
- **Provenance:** immutable contributor/publication/source identity and original source/credit fields, separate from editable recipe notes. Preserve the root attribution across repeated adaptations. If a private source becomes inaccessible, its title may remain credited on an existing private copy, but its link must not disclose inaccessible content.

Saving a family recipe does not grant permission to publish the original or leak its private group content. Only the original contributor shares the original into another group. Private-derived copies/adaptations cannot be shared into a different family group or published/unlisted unless the root contributor explicitly permits redistribution. Permission-grant UI is deferred; the initial release denies those redistribution operations. Publicly accessible recipes can be independently saved/adapted with attribution.

Deleting an original revokes its family grants, publications, share tokens and social-photo access atomically. Recipient-owned copies and their independent photo bytes/provenance survive; provenance is not cascade-deleted with the original. Removing a contributor from a family group revokes that contributor's live original grants in that group, without deleting originals or other members' already saved private copies.

## Family membership and alternatives

Cookbooks have administrators and contributors; creators begin as administrators. Invitations use cryptographically random single-use tokens, storing only hashes, with seven-day expiry. Invitation links require sign-in to accept. Support optional recipient-email binding using the authenticated verified account email, never a client-supplied identity. Invitations are copyable links; automatic email sending is not included. Revocation and member removal take effect on the next request. Prevent removing/demoting the last administrator atomically.

Store alternatives against cookbook ID, original recipe ID, ingredient ID and ingredient revision/fingerprint. Replacement ingredient (maximum 120 characters), optional quantity/unit, optional cooking note (240 characters), contributor identity, timestamps and explicit original-author endorsement are distinct fields. Editing/removing a referenced ingredient marks its old alternatives stale rather than attaching them to another ingredient. Existing recipe PATCH deletes/recreates ingredient rows on every draft save: integrate that mutation boundary and atomically mark old alternatives stale before replacement rather than silently cascading or rebinding them. Alternatives are suggestions, not allergen/nutrition guarantees.

Alternatives appear beside an ingredient, collapsed by default with an expand control. Only a family-authorized DTO includes them. Using an alternative creates/updates the reader's own copy with its structured substitution and retained attribution; it never edits the original. Suggestion authors may remove their own suggestion; original recipe contributors and group administrators may remove group suggestions. Only the original contributor endorses one.

## Sharing, discovery and public photos

Private, family access, unlisted links and public publishing are explicit controls. Family grants and publication are independent: a contributor may keep family access while publishing an intentional snapshot. Never infer audience from current navigation or client state. Links use opaque tokens with owner-controlled revocation and rotation; anonymous readers can read without registering. Private/unlisted content is excluded from public search/sitemaps. Unlisted pages use noindex and a restrictive referrer policy.

Public/unlisted serializers allowlist recipe fields, source attribution, intended contributor display identity and intentionally shared photo assets. They exclude email, account IDs, group names/membership, private alternatives/notes, draft data, provider job metadata and private storage URLs. Keep original owner-only photo routes unchanged. Serve an independently authorized share-photo route; unpublishing/revoking access must also revoke its photo access. Avoid persistent public caches for revocable content. Preserve licence/AI photo labels and use a neutral fallback when a photo cannot be safely shared.

Discovery is chronological published recipes, with cuisine/ingredient/time search, following and simple positive reactions. Public profiles contain opt-in display name/bio and published recipes, never account email or an entire private cookbook. Keep positive reactions separate from cooked activity; no public free-text comment threads. A cooked photo is a separately authorized contribution, never permission to overwrite someone else's recipe photo.

## Abuse and moderation

All free text is bounded and escaped, including recipe/profile/cookbook names, descriptions and private suggestion notes. No user HTML, executable markup or arbitrary public uploads. Reuse photo validation/EXIF stripping for social photos. Reporting targets the actual recipe/publication/suggestion/profile/photo, with distinct reasons and a 500-character optional explanation.

Private reports are visible only to appropriate group administrators and service operators; public reports go to operators. Add a protected operator moderation queue using explicit server-configured moderator user IDs, not a client flag. Record actions and allow removal/quarantine. A report acknowledgement must mean a report is actually stored; failure must remain visible/retryable. Blocking persists against an account, not current recipe IDs, and filters its future discovery/activity/reactions. Direct public links remain readable by anonymous visitors; explain that blocking controls signed-in interactions rather than claiming to erase public content from the internet.

Authenticated write limits: invitations 20/day/actor, reports 10/day/actor, other social writes 30/minute/actor, enforced server-side and atomically with bounded payload/list sizes (20 items/page; 8 MB photo cap). Public discovery/publication require the moderation capability to be configured; fail closed for new public submissions when it is unavailable. Preserve private vault access when social services are disabled or unavailable.

## Delivery and verification

Implement in an isolated branch/check-out based on refreshed main. Use a separate Neon development branch for additive migrations and real two-account/anonymous integration tests; do not apply migrations to production or change production auth/environment/provider settings. Check migration idempotency and exact preservation of existing business data on the isolated clone. Release/push/merge/production migration remains a separate deployment step after review.

Deliver working original workflows plus family sharing, independent copies/alternatives, anonymous links, public discovery/interactions and moderation. Keep independently reviewable commits. Validate current regression suite, TypeScript, Webpack production build, meaningful real DB permission tests and phone/tablet/desktop browser flows. Verify anonymous/public DTOs and photos, removed membership, invitation replay, ID spoofing, block persistence, source deletion, stale ingredient references, account switching and concurrent final-admin removal.

## Defaults supplied by the implementer

Saved copies remain snapshots; accepting original updates is deferred. Private-derived recipes cannot be redistributed to new groups/publicly/unlisted without root-owner permission; the initial release denies that operation. Deleting an original revokes shares but retains independent copies. Family originals stay live to their authorised groups; public snapshots update only explicitly. Invite-link delivery avoids adding an email provider. No automatic cuisine/allergen inference, provider provisioning, direct messages, open public comments or cookbook export in this release. These are implementation defaults included in this handoff; they need no separate product questionnaire.
