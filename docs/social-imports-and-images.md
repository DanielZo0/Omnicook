# Social imports and recipe images

The importer reads public HTML with a 14-second source budget, a 2 MB page limit,
and at most five redirects per page. Every destination must resolve only to
public IP addresses; an Undici dispatcher pins the validated DNS answers during
the request. Private addresses, credentials in URLs, and nonstandard ports are
rejected. Browser image URLs are validated separately.

Extraction prefers a complete schema.org Recipe node (including nested
HowToSection/HowToStep instructions) before page prose. Instagram uses embedded
caption JSON or Open Graph descriptions. Pinterest resolves pin.it redirects
and follows source links, including `og:see_also`, to the original recipe page.
The original post/pin URL remains the saved attribution link. Tracking query
parameters are removed from social source URLs.

Blocked pages and social metadata without ingredient/method signals return a
422 with instructions to paste the full caption or original recipe link.
The model never receives a bare URL as a substitute for failed fetching. Pages
that require login are still not guaranteed to expose content, and text import
does not transcribe video/audio or perform OCR on screenshots. Model output is
validated against the existing recipe contract before review.
If the model omits required fields, one schema-guided repair uses the same
original source within a shared 40-second AI budget. An explicit insufficient
content response is not retried. A second invalid response still fails review.

Images prefer Recipe.image, then source og:image/twitter:image. Relative URLs
resolve against the page that supplied them. /api/import returns a source image
preview; saving automatically starts a server job after the response. Photo
selection is backend-only, with no generation or lookup choice in the UI:

1. Copy a usable source photo.
2. Search Wikimedia Commons, filter for known reusable licenses, and ask the
   configured Groq/NVIDIA model to select a close finished-dish match from its
   metadata. Candidate IDs must exist and confidence must be at least 0.9.
3. Generate an illustration from title, ingredients and method using NVIDIA
   FLUX.2 Klein 4B and the existing NVIDIA_API_KEY.
4. If all fail, keep the neutral placeholder and save the recipe normally.

Downloaded/uploaded images are decoded, EXIF-stripped, resized and re-encoded
as WebP (max 256 KB), stored in recipes.photo_data. recipes.photo_metadata stores
provenance, licensed-photo credits and job status. Photo bytes never appear in
vault JSON; /api/recipes/:id/photo checks ownership before serving with private
no-store caching. Source fetching validates/pins public DNS, checks redirects,
and caps download size at 4 MB. SVGs and disguised files are rejected.

The detail screen exposes Add my cooking photo (camera/gallery file selection).
Browser resizing keeps large camera photos within the upload limit. A user's
photo always wins, including when a provider job finishes after upload or an edit
races it. Unsupported HEIC decoding prompts exporting JPEG instead. Generated
photos are labelled AI illustration; lookup photos keep creator/license links
and are labelled Related photo, since they represent a similar dish.

Provider work runs via Next after with a 100-second total photo deadline and
120-second route maximum. DB job claims deduplicate work, recover interrupted
jobs after two minutes, and guard completion using token and updatedAt. Vault
reads backfill up to two jobs at a time. Failures retry after 24 hours, at most
three attempts; ready photos are reused. Only a change to title, ingredient names
or method invalidates a lookup/generated photo; servings and unchanged edits
keep it. Set RECIPE_PHOTOS_ENABLED=false to disable provider calls while keeping
uploads available. No object-storage account is needed at this stage; move bytes
to object storage if vault volume warrants it.

Run npm run db:recipe-images and npm run db:recipe-photos for idempotent additive
migrations. Apply both to a different deployment database before deploying.

Live provider verification on 2026-10-14: source copies, licensed bruschetta and
generated banana-oat pancakes succeeded. The older FLUX.1 Schnell endpoint timed
out/504 and SDXL returned404. The current FLUX.2 endpoint returned422 with its
documented mode/cfg_scale=0; the live accepted request omits mode and uses
cfg_scale=1. This schema has a regression test. NVIDIA202 queued responses are
polled through authenticated fixed-host NVCF status URLs within the same budget.

Validation:

- `npm test`: deterministic parser, redirect, source quality and image tests.
- `npm run test:isolation`: real temporary accounts; covers image persistence,
  omitted/null edits, unsafe URLs, private photo uploads, malformed/oversized files,
  unchanged/changed dishes and ownership boundaries; cleans up fixtures. Run with
  RECIPE_PHOTOS_ENABLED=false on the local server to avoid disposable provider jobs.
- `node scripts/check-live-imports.cjs <url> ...`: source and AI import summaries.
- `node --conditions=react-server scripts/backfill-demo-photos.cjs [--retry-failed]`: stores
  photos only for the existing demo account; optional retry still respects the attempt cap.
- `node scripts/refresh-demo-images.cjs [url ...]`: refreshes only the saved demo
  account's source images and optionally imports additional demo recipes. Uses
  credentials from ignored `.env.test-account.local`; never commit that file.

Live examples checked on 2026-10-14: Instagram reel DayYqvdPSaV and Pinterest pin
460493130670064803 (Lemon chickpea stew from Lazy Cat Kitchen). Provider failures
or schema failures remain explicit errors rather than saved invented recipes.
