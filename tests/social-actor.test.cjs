require("./register-ts.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
let actorPolicy;
try {
  actorPolicy = require("../src/lib/social/actor-policy.ts");
} catch {}
test("moderator access requires a verified exact email match", () => {
  assert.ok(actorPolicy, "actor policy exists");
  const f = actorPolicy.moderatorFor;
  assert.equal(
    f(
      { id: "a", email: "mod@example.com", emailVerified: false },
      "mod@example.com",
    ),
    false,
  );
  assert.equal(
    f(
      { id: "a", email: "mod@example.com.attacker", emailVerified: true },
      "mod@example.com",
    ),
    false,
  );
  assert.equal(
    f(
      { id: "a", email: "MOD@example.com", emailVerified: true },
      "mod@example.com",
    ),
    true,
  );
  assert.equal(
    f({ id: "a", email: "mod@example.com", emailVerified: true }, ""),
    false,
  );
});
