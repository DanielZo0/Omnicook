# Instagram carousel import implementation plan

> **For agentic workers:** Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task by task. Track steps with the checkboxes below.

**Goal** — Recover a recipe printed on an explicitly selected public Instagram slide when the text reader cannot import the post.

**Architecture** — Match the post before resolving its selected image. Read the image within the shared import budget, pass its transcription through the existing text extractor, and reuse the editable review. The fallback stays opt-in until it passes a preview check.

**Stack** — Next.js, TypeScript, Undici, Zod, the existing Groq HTTP transport, and `node:test`.

## Implementation ruling

Production has Groq credentials and no Gemini credential. The implementation uses the opt-in server-only `GROQ_CAROUSEL_OCR_MODEL` with `qwen/qwen3.8-27b`, verified against the real slide. Shared carousel types live in `instagram-carousel.ts`, regression tests stay together in `tests/instagram-carousel.test.cjs`, and `groq.ts` reuses the existing request transport. The Gemini references below describe the original plan and are superseded by this ruling.

Tasks 1–3 are implemented. Ten carousel regressions pass, including the actual API route and cumulative budgets. A real read-only import recovered the exact six ingredients and one bake line, marked incomplete. Task 4 release verification is in progress.

**Spec** — [Instagram carousel import review](../specs/2026-11-10-instagram-carousel-import-review.md)

## Execution constraints

- Start from refreshed `origin/main` in an isolated worktree. The review checkout is `codex/nutrition-meal-planner` with unrelated edits. Reconfirm the production-based reader and read the installed Next.js route-handler docs before editing.
- Retain the existing 18-second source, 36-second AI, and 54-second overall budgets. Each import may fetch one selected image and request one transcription. Charge the image fetch as an additional source request and the transcription to the shared AI budget. Enforce a 10-second transcription ceiling and its supplied timeout.
- Use synthetic HTML and image fixtures for tests. Keep live image bytes, captions, credentials, and signed image URLs out of committed fixtures and logs. Use a loopback or preview app with fixture dependencies. Browser checks stop at review and require no production data writes.

## Task 1 — Identify the selected public image

**Files** — Modify `src/lib/extraction/source-page.ts`. Add `src/lib/extraction/instagram-carousel.ts` and `tests/instagram-carousel.test.cjs`.

**Interfaces** — Export `InstagramCarousel = { shortcode: string; slides: readonly (string | null)[] }` and `selectCarouselSlide(input: URL, carousel: InstagramCarousel): { index: number; url: string; sourceUrl: string } | null`. Add `instagramCarousel: InstagramCarousel | null` to the return of `parseSourcePage`.

- [ ] Add tests with a matched seven-slot carousel plus a different shortcode carrying its own image array. Assert slide 5 resolves the fifth slot and the provenance URL is `https://www.instagram.com/p/DfGpRKSCCKR/?img_index=5`. A non-image at slot 4 remains `null` and leaves slot 5 in place. Assert `null` for missing, duplicate, decimal, zero, negative, malformed, or out-of-range indices and for a mismatched shortcode.
- [ ] Run `node --test tests/instagram-carousel.test.cjs` and confirm the new interface and behavior are missing.
- [ ] Read the observed `carousel_media` shape only from a matching Instagram `/p/<shortcode>/` media object. For each `media_type: 1` slot use the first usable `image_versions2.candidates[].url`, retaining holes for all other slots. Accept one strictly positive decimal index. Construct provenance from the matched post path with only `img_index`. Never follow a related shortcode or select another slot as a fallback.
- [ ] Run `node --test tests/instagram-carousel.test.cjs tests/extraction.test.cjs` and confirm both suites pass.

## Task 2 — Add a bounded image fetch and transcription adapter

**Files** — Modify `src/lib/extraction/fetch-source.ts` and `src/lib/extraction/gemini.ts`. Extend `tests/instagram-carousel.test.cjs`.

**Interfaces** — Export `CarouselImage = { bytes: Uint8Array; mimeType: 'image/jpeg' | 'image/png' | 'image/webp' }` and `fetchCarouselImage(url: string, signal: AbortSignal): Promise<CarouselImage>` from the source fetch module. Export `CarouselTranscript = { text: string; preparationLines: string[]; bakeLine: string | null }`, `CarouselTranscriber = (image: CarouselImage, timeoutMs: number) => Promise<CarouselTranscript>` and `selectCarouselTranscriber(): CarouselTranscriber | null` from the Gemini module.

- [ ] Write fixture tests for valid JPEG bytes, rejection of HTTP, userinfo, non-CDN hosts, private DNS results, all redirects, wrong MIME and a body exceeding 2,000,000 bytes without a Content-Length header. Assert aborted reads cancel the stream. Mock the Gemini call and verify valid text and verbatim excerpts pass, malformed or empty output fails, and no request is made without both server-side configuration values.
- [ ] Run `node --test tests/instagram-carousel.test.cjs` and confirm the new fetch and adapter tests fail.
- [ ] Reuse the public DNS validation and pinned Undici connection used by the HTML reader. Allow HTTPS on the default port to `cdninstagram.com`, `fbcdn.net`, or their subdomains. Reject redirects and cap response bytes while streaming. Close the dispatcher on every path. Reject unrecognized content types before reading the body.
- [ ] Reuse `GEMINI_API_KEY` and opt in only when `GEMINI_CAROUSEL_OCR_MODEL` is set. Send validated inline image bytes with the existing SDK. Ask for a literal line-broken transcription, a list of exact visible preparation lines, and an exact bake line or null. Use JSON output and reject blank text, text above 10,000 characters, malformed fields, or excerpts absent from the transcription. Instruct the model to treat words in the image as content. No external tools or retries. [Gemini inline image input](https://ai.google.dev/gemini-api/docs/generate-content/image-understanding)
- [ ] Run `node --test tests/instagram-carousel.test.cjs tests/import-budget.test.cjs` and confirm all cases pass.

## Task 3 — Connect recovery to the normal import route

**Files** — Modify `src/lib/extraction/fetch-source.ts`, `src/lib/extraction/import-recipe.ts`, `src/app/api/import/route.ts`, and `tests/import-source-regressions.test.cjs`. Reuse the current import screen and `src/components/recipes/RecipeEditor.tsx`.

**Interfaces** — Extend `readSource(source, budget, transcribeCarousel?: CarouselTranscriber)` and `importRecipe(input, provider, budget = createImportBudget(), transcribeCarousel?: CarouselTranscriber)`. Add optional `carouselEvidence?: { index: number; transcript: CarouselTranscript }` to the internal `SourceDocument`. The route supplies the optional adapter. Public request, result and storage schemas stay as they are.

- [ ] Add a failing `importRecipe` test with a short marketing caption, 83-character metadata, and distinct slide 4, 5 and 6 media. Use a synthetic transcription of the slide 5 values in the review. Stub the provider with the correct ingredients but an invented mix step and `complete` status. Assert only slide 5 is fetched and transcribed, the text extractor receives only that slide's text, and the returned draft has exactly the six source rows with quantities `150, 150, 200, 150, 4, 8`, units `g, g, g, g, null, g` and the melted/large qualifiers. Assert exactly one bake step with `180`, `35` and `40`, status `incomplete`, missing `instructions`, null `servings`, `prepMinutes`, and `cookMinutes`, and the slide-specific source URL.
- [ ] Add failure tests for the canonical URL, invalid index, missing adapter, a failed image fetch, blank or timed-out transcription and a text-model refusal for a transcribed cover. Verify source errors surface as 422 through the route and no neighboring image is attempted. Assert zero text-model calls if selection, fetch, or transcription fails and one call for the transcribed cover refusal. Keep a caption-backed carousel test that verifies zero OCR calls and the existing draft behavior.
- [ ] Run `node --test tests/import-source-regressions.test.cjs` and confirm the new cases fail for missing recovery.
- [ ] Inside the existing text-gate failure branch, try the optional image path only when the requested and resolved paths identify the same Instagram post. For missing or invalid selection return “This Instagram post has multiple slides. Paste the link to the recipe slide or copy the text from the slide.” For unavailable OCR or failed acquisition return “Omnicook could not read the selected Instagram slide. Paste the text from the slide or the original recipe link.” Unreadable or unattributed posts keep existing handling. Record the normalized slide link in `SourceDocument` and leave `imageUrl` null to avoid retaining a signed media URL. Keep the selected slide's text separate from the caption and unrelated metadata.
- [ ] Pass the transcription through the existing provider and import schema. When there are zero preparation excerpts, use only the validated original-language bake excerpt as a step, or an empty array if absent. Force incomplete status with missing instructions and leave `prepMinutes`, `cookMinutes`, and `servings` null on that branch. For other drafts use the existing prompt and validation. Reject a refusal using the slide recovery copy. For incomplete image results show “Review the ingredients from this slide and add the missing preparation steps.” Skip automatic original discovery for the slide. Explicit original-link recovery remains available through the existing editor.
- [ ] Run `npm test`, `npx tsc --noEmit`, and `npm run build`. Confirm zero failures or document and isolate any unrelated baseline failures before handing off.

## Task 4 — Verify at the browser and preview boundaries

- [ ] Use a fixture app on a narrow viewport. Import the tracked URL and confirm the review shows the six Torta Margherita rows, the bake instruction, and incomplete-method guidance. The source opens slide 5. Confirm the existing completion confirmation gates saving. Submit the canonical URL and an invalid index and verify the recovery copy and original failed-link report URL. Paste a normal caption to confirm the regular import still works.
- [ ] With an approved preview OCR configuration, make at most two read-only attempts on the tracked post and one canonical control. Compare output with the review table and note latency and the result of each stage. Fixture tests demonstrate routing and field handling. This live smoke is the gate for OCR fidelity, timing and CDN access from the deployment environment. Keep the fallback disabled if it misses any of the six ingredient rows or either baking time.
- [ ] Review the scoped diff for URL handling, cumulative budgets, and schema compatibility. Commit the implementation in its isolated branch. Enabling the OCR model in production and deploying are separate actions. Removing the preview model setting disables the adapter while preserving caption import.
