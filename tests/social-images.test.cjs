require("./register-ts.cjs");
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { normalizeImageUrl } = require("../src/lib/image-url.ts");
test("only exact authorized social photo routes render", () => {
  const id = crypto.randomUUID(),
    token = "a".repeat(43);
  for (const url of [
    `/api/shared/${token}/photo`,
    `/api/social/photo?recipeId=${id}&cookbookId=${id}`,
  ])
    assert.equal(normalizeImageUrl(url), url);
  for (const url of [
    "/api/shared/short/photo",
    "//evil.example/photo",
    `/api/shared/${token}/photo?redirect=https://evil.example`,
    "/api/social/photo?recipeId=secret",
  ])
    assert.equal(normalizeImageUrl(url), null);
});
