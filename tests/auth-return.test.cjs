require("./register-ts.cjs");
const { test } = require("node:test"),
  assert = require("node:assert/strict");
let safe;
try {
  safe = require("../src/lib/auth/return-path.ts").returnPath;
} catch {}
test("sign in only returns to known local invitation and recipe pages", () => {
  assert.equal(typeof safe, "function");
  const token = "a".repeat(43);
  assert.equal(safe(`/invite/${token}`), `/invite/${token}`);
  assert.equal(safe(`/shared/${token}`), `/shared/${token}`);
  for (const x of [
    "//evil.example",
    "https://evil.example",
    "/api/social",
    "/\\evil.example",
    "/invite/short",
  ])
    assert.equal(safe(x), "/");
});
