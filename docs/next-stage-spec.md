# Omnicook next-stage specification

## Scope and sequence

This stage hardens the live MVP, then adds images, multi-collection organisation, and photo/OCR import. Deliver in this order:

1. Tenant isolation and authorization.
2. QA, AI abuse controls, monitoring, and automatic deployment.
3. Multi-collection migration.
4. Private image storage.
5. Photo/OCR import using the shared upload lifecycle.

Recipe text is the source of truth; images and OCR drafts must never prevent reading or cooking a saved recipe.

## 1. Tenant isolation and authorization

### Current gap

Authorization is enforced in app code rather than database RLS. `POST /api/meal-plan` currently accepts a valid recipe UUID without checking it belongs to the signed-in user. Recipe create/update also need to validate collection ownership.

### Requirements

* Add server-only `requireOwnedRecipe(userId, recipeId)` and `requireOwnedCollection(userId, collectionId)` helpers. They return generic 404 results and never reveal another user's ownership.
* Verify recipe ownership before every meal-plan upsert. Verify collection ownership before recipe create/update. Scope mutations themselves by both resource ID and `user_id`.
* Future media and join-table routes authenticate first, then resolve their parent through the caller's `user_id`; foreign keys provide structural integrity, not authorization.

### Acceptance suite

Using separate accounts A and B, prove B cannot list, read, mutate, delete, associate, upload to, or receive an image URL for A's records. Cross-user IDs return 404 with no partial writes. Automate the suite using two cookie jars on a disposable Neon branch; require one real auth/database run before release.

## 2. QA and operational readiness

### Release gate

Smoke-test sign-up/session restore; caption and URL import through save/edit/delete; sous-chef in detail and cook mode; meal-plan/grocery flow; iOS or Android Add-to-Home-Screen; and the isolation suite. Add `test` and `test:integration` scripts. Production promotion requires a passing build, route tests, integration/isolation test, and smoke checklist.

### AI protection and observability

`POST /api/sous-chef` must require authentication, receive a recipe ID, validate ownership, and load recipe context server-side rather than trust supplied context. Apply durable shared rate limits, not in-memory state:

| Endpoint | Initial limit |
| --- | ---: |
| `/api/import` | 10 requests/hour/user |
| `/api/sous-chef` | 30 requests/hour/user |
| photo import | 5 requests/hour/user |

Return 429 with retry guidance. Log provider, latency, outcome class, and request size only—never captions, recipe content, email, secrets, or full model output.

Add error monitoring with source maps/release IDs and alerts for elevated 5xx/429, failed imports, slow import p95, and auth-callback failures. Add an unauthenticated health endpoint containing liveness, build SHA, and database-configured status only. Connect Vercel to GitHub so default-branch merges deploy automatically. Keep Google OAuth unavailable until a real client or Neon fix exists; do not enable GAM until consent management runs before GPT.

## 3. Multi-collection recipes

### Behavior

A recipe may be in zero or many collections. Removing an association deletes neither record; deleting a collection removes only its associations.

### Data/API migration

Replace `recipes.collection_id` with:

```text
recipe_collections
  recipe_id UUID FK recipes(id) ON DELETE CASCADE
  collection_id UUID FK collections(id) ON DELETE CASCADE
  created_at timestamp
  PRIMARY KEY (recipe_id, collection_id)
```

Create the table, backfill all non-null current assignments, deploy join-table reads while retaining the old column for rollback, switch writes, validate counts, then remove the old column. Responses expose `collections: Array<{ id, name }>`; create/update accepts at most 20 unique `collectionIds`, validates all before a transactional replacement, and returns generic 404 with no partial writes for inaccessible IDs.

Replace single-select review chips with multi-select chips. Detail shows assigned chips and an Organise action.

## 4. Private recipe image storage

### Behavior

One primary photo per recipe in v1. Review/edit permits JPEG, PNG, WebP, HEIC, or HEIF up to 10 MB, plus replace/remove. Cards/detail use the photo or the existing placeholder. Image failure does not block recipe text save.

### Architecture

Use a private Neon Object Storage `recipe-images` bucket. The project is in the required `us-east-2` region. Declare it in `neon.ts`, provision through Neon configuration, and use an S3-compatible SDK. Store immutable keys, not permanent URLs:

```text
recipes/<user-id>/<recipe-id>/<uuid>.<extension>
```

Create `recipe_images`: UUID ID, recipe FK/cascade, user ID, unique object key, content type, byte size, optional dimensions, `is_primary`, and created time. Upload a replacement first, commit the reference second, then delete the old object asynchronously after retention.

### API and criteria

* `POST /api/recipes/:id/images/upload-url`: owned recipe + metadata validation; returns short-lived signed URL and upload token/key.
* `POST /api/recipes/:id/images`: verifies token/object metadata and sets primary image.
* `DELETE /api/recipes/:id/images/:imageId`: ownership check, record removal, scheduled deletion.
* Recipe responses include `primaryImage: { id, url, width, height } | null`; signed display URLs refresh with normal recipe reads.

The browser uploads directly to a signed private URL. Another user cannot obtain upload/read URLs; expired URLs refresh; deletion eventually removes the object.

## 5. Photo/OCR import

Signed-in users photograph or choose one printed recipe card, cookbook page, or screenshot (typed English, up to 10 MB). The result is an editable draft in the existing review screen. The source image is temporary unless the user explicitly keeps it on save.

1. Client validates file and uploads to a temporary private signed URL.
2. Server verifies ownership and invokes a vision-capable `OcrProvider`.
3. OCR text is converted to the existing structured schema, or a vision provider returns it directly.
4. Validate with `recipeSchema`; incomplete output goes to review/manual entry.
5. Delete temporary data after completion, cancellation/failure, or a short TTL.

Choose the provider after benchmarking 10–20 representative images for image support, JSON reliability, latency, cost, and EU data processing. Do not assume the current NVIDIA text provider accepts images. Target 45 seconds; otherwise create an asynchronous job and poll the existing progress screen.

APIs: `POST /api/import/photo/upload-url`, `POST /api/import/photo`, and authenticated `GET /api/import/photo/:jobId` (`queued`, `processing`, `ready`, `failed`, `expired`). Never accept arbitrary external URLs/base64. Enable scanning only after sign-in; offer camera/file picker and retake/crop; disclose temporary retention; highlight uncertain fields. Treat OCR text as untrusted.

## Phase exits and decisions

| Phase | Exit condition |
| --- | --- |
| 0: authorization | Two-account isolation suite green |
| 1: operations | Monitoring/alerts live; AI authenticated/rate-limited; automatic deploy works |
| 2: collections | Backfill and multi-collection tests green |
| 3: images | Private upload/display/delete lifecycle green |
| 4: OCR | Scan-to-review works and temporary files clean up |

Before implementation select an error-monitoring/rate-limit provider (or a database-backed first pass), provision the private Neon bucket, select OCR after the benchmark, confirm opt-in source-photo retention (recommended), and choose own Google OAuth credentials or wait for Neon’s shared-app fix.
