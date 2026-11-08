require("./register-ts.cjs");
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { photoResponse } = require("../src/lib/social/photo-response.ts");
test("shared photos use the original normalized WebP storage format", async () => {
  const r = photoResponse(Buffer.from("RIFFtestWEBPbytes").toString("base64"));
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "image/webp");
  assert.equal(await r.text(), "RIFFtestWEBPbytes");
  assert.match(r.headers.get("cache-control"), /no-store/);
  assert.equal(photoResponse(null).status, 404);
  assert.equal(photoResponse("data:image/svg+xml;base64,abcd").status, 404);
});
