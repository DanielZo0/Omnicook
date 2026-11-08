require("./register-ts.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { parseCommand } = require("../src/lib/social/commands.ts");
test("social commands reject extra fields and ambiguous roles", () => {
  assert.throws(() =>
    parseCommand("createCookbook", { name: "Family", ownerId: "someone-else" }),
  );
  assert.throws(() =>
    parseCommand("invite", {
      id: crypto.randomUUID(),
      email: null,
      role: "Owner",
    }),
  );
  assert.throws(() =>
    parseCommand("resolve", {
      id: crypto.randomUUID(),
      action: "delete everything",
    }),
  );
  assert.throws(() => parseCommand("sql", { query: "select * from recipes" }));
});
test("bounded community inputs and cookbook IDs", () => {
  assert.throws(() =>
    parseCommand("profile", { name: "Cook", bio: "x".repeat(241) }),
  );
  assert.throws(() => parseCommand("feed", { tab: "discover", offset: -1 }));
  assert.throws(() =>
    parseCommand("destinations", {
      recipeId: crypto.randomUUID(),
      discover: true,
      cookbookIds: ["private-name"],
    }),
  );
  assert.equal(
    parseCommand("createCookbook", { name: "  Family  " }).name,
    "Family",
  );
});
