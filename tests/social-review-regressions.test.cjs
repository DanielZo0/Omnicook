require("./register-ts.cjs");
const { test } = require("node:test"),
  assert = require("node:assert/strict");
const { commands } = require("../src/lib/social/commands.ts");
test("saved alternatives and family pagination have explicit bounded contracts", () => {
  assert.ok(commands.removeAlternative, "scoped alternative removal exists");
  assert.ok(
    commands.save.safeParse({
      recipeId: crypto.randomUUID(),
      idempotencyKey: crypto.randomUUID(),
      alternativeId: crypto.randomUUID(),
    }).success,
  );
  assert.ok(
    commands.cookbook.safeParse({ id: crypto.randomUUID(), offset: 20 })
      .success,
  );
  assert.equal(
    commands.cookbook.safeParse({ id: crypto.randomUUID(), offset: -1 })
      .success,
    false,
  );
});
test("Discover search and time filters are bounded", () => {
  assert.ok(
    commands.feed.safeParse({
      tab: "discover",
      query: "rice",
      cuisine: "Italian",
      maxMinutes: 30,
    }).success,
  );
  assert.equal(
    commands.feed.safeParse({ tab: "discover", query: "a".repeat(121) })
      .success,
    false,
  );
  assert.equal(
    commands.feed.safeParse({ tab: "discover", maxMinutes: 0 }).success,
    false,
  );
});
