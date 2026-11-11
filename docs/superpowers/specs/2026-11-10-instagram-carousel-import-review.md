# Instagram carousel import review

## Report

- [Reported URL, slide 5](https://www.instagram.com/p/DfGpRKSCCKR/?img_index=5&psln=M3J1amlsYTBsbHB0)
- [Canonical post](https://www.instagram.com/p/DfGpRKSCCKR/) and [slide-specific source](https://www.instagram.com/p/DfGpRKSCCKR/?img_index=5)
- Error reported and reproduced verbatim: “This post cannot be read. Paste its full caption or original recipe link.”
- User note: none.

## Reproduction and cause

On 2026-11-10, both the tracked and canonical URLs returned HTTP 422 from the live Omnicook `POST /api/import` with the reported message. The equivalent local `importRecipe` calls used the actual fetch and parser with a provider spy. Instagram returned HTTP 200 HTML with no redirect for both URLs, and neither call reached the provider. The initial restricted-shell DNS failure was environmental. An approved network probe reached both hosts.

`readSource` in `src/lib/extraction/fetch-source.ts` uses `structuredText` or, for Instagram, `caption || description`. Both requests produced no structured recipe, a 48-character caption inviting comments, and an 83-character description that repeats the caption with creator/date metadata. The caption wins and fails the 60-character social-text gate. Passing the longer description or stripping the query would still leave the recipe in the image.

`parseSourcePage` already identifies matching Instagram objects by shortcode but exposes only a single general image and no ordered carousel images. The public payload contained a matching object for `DfGpRKSCCKR` with seven `carousel_media` image children. All seven were inspected. Slides 2–6 show five distinct recipes. Slides 1 and 7 are a cover and promotion. The recipe text for this report is in the pixels of slide 5.

`importRecipe` awaits `readSource` before provider extraction, schema checks, or original-link discovery. `src/app/api/import/route.ts` returns the source error as HTTP 422, and `src/app/page.tsx` displays the message and retains the attempted URL in the failed-link report. The observed failure is at source acquisition. This review did not exercise a live model for this post or save a recipe. The existing focused suite passed 26 tests.

## Slide 5 evidence

| Source field | Value |
|---|---|
| Dish | Torta Margherita |
| Creator | @lorenpastry |
| Ingredients | 150 g farina, 150 g fecola di patate, 200 g zucchero, 150 g burro fuso, 4 uova grandi, 8 g lievito chimico |
| Bake | 180 degrees for 35 or 40 minutes. The Italian baking context suggests Celsius. |
| Preparation and yield | The slide gives a bake instruction. It supplies no mixing or other preparation steps, pan dimensions, or servings. |

Slide 4 is Torta di mele. Slide 6 is Torta bicolore marmorizzata. Their quantities and methods belong to separate recipes. The carousel should never enter the formula-alternative workflow as a single dish. [Selected slide](https://www.instagram.com/p/DfGpRKSCCKR/?img_index=5)

## Proposed behavior

- Keep existing caption and structured-recipe imports. When that path would reject an Instagram carousel for lack of text, use a valid one-based `img_index` to read only the selected image. For a known carousel with missing, invalid, or out-of-range selection, ask the user for the numbered slide link or to paste the text from the slide. The canonical URL needs an explicit selection in this case.
- Transcribe the selected public image and use the existing recipe review flow. Keep the source URL with the slide number. Keep the raw shared URL for failure reports. Preserve the Italian ingredient names, quantities, qualifiers and both stated baking times. The step list should contain only the bake instruction and the draft should be marked incomplete with `missingFields: ['instructions']`. Leave servings, prep minutes and the single-value cook-minute field empty.
- Try one image and one OCR call within the current import budget. If the image or transcription is unavailable, offer the slide text or an original recipe link. Keep text-only imports working without OCR credentials. Implementation uses an opt-in Groq vision adapter and a separately configured model because production has Groq credentials and no Gemini key. A read-only live check using qwen/qwen3.8-27b recovered all six ingredients and both baking times in 6.2 seconds. [Groq vision input](https://console.groq.com/docs/vision)
- Restrict the image fetch to media attached to the matched post on a public Instagram CDN. Avoid storing image bytes or logging signed CDN URLs. Keep the existing review and save rules. This scope covers indexed public still images whose text path failed the source gate. Unindexed selection UI, broad image uploads, OCR for reels, and long non-recipe captions that pass the gate are separate work.

## Acceptance

1. The tracked URL reaches review with Torta Margherita, the six exact ingredient quantities and units above, one bake instruction containing 180 and both 35 and 40, and an incomplete-method warning. Its source opens slide 5.
2. No neighboring ingredient, preparation step, yield, or model-inferred recipe is added. No recipe is saved during import.
3. The canonical link with the same carousel payload requests a numbered slide. Selecting an invalid, non-image, or unavailable slide, or failing OCR, provides a recovery message with no unrelated draft.
4. Existing caption, recipe-page, Pinterest, Facebook, YouTube, and ratio-import behavior remains covered. Fixture-based tests run without network access, and a preview smoke checks the real post before enabling the fallback.
