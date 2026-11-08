require("./register-ts.cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
let p;
try {
  p = require("../src/lib/social/policy.ts");
} catch {}
test("social tokens use high-entropy values and one-way lookup hashes", () => {
  const token = p?.newToken?.();
  assert.match(token || "", /^[A-Za-z0-9_-]{43}$/);
  assert.equal(p?.hashToken?.(token).length, 64);
  assert.notEqual(p?.newToken?.(), token);
});
test("public recipe projection excludes private fields and photo job metadata", () => {
  const result = p?.publicRecipe?.(
    {
      id: "r",
      title: "Soup",
      ownerId: "private-owner",
      email: "private@example.com",
      groupNames: ["Secret group"],
      photoData: "secret-base64",
      photoMetadata: {
        kind: "source",
        status: "ready",
        credit: "Cook",
        token: "private-job",
      },
      ingredients: [
        {
          id: "i",
          position: 0,
          name: "Carrot",
          quantity: "2",
          unit: null,
          notes: null,
          aisle: "Produce",
        },
      ],
      steps: [{ position: 0, instruction: "Cook." }],
      category: "Dinner",
    },
    "token",
    { id: "u", name: "Cook" },
  );
  assert.equal(result?.title, "Soup");
  for (const key of ["email", "ownerId", "groupNames", "photoData"])
    assert.equal(Object.hasOwn(result || {}, key), false);
  assert.equal(result?.photoMetadata?.token, undefined);
  assert.equal(result?.ingredients?.[0]?.id, "i");
});
test("private-derived recipe copies cannot expand audience beyond their source cookbook", () => {
  assert.equal(
    p?.canRedistribute?.(
      { restricted: true, sourceCookbookId: "a", rootOwnerId: "owner" },
      "recipient",
      { discover: true, cookbookIds: ["a"] },
    ),
    false,
  );
  assert.equal(
    p?.canRedistribute?.(
      { restricted: true, sourceCookbookId: "a", rootOwnerId: "owner" },
      "recipient",
      { discover: false, cookbookIds: ["b"] },
    ),
    false,
  );
  assert.equal(
    p?.canRedistribute?.(
      { restricted: true, sourceCookbookId: "a", rootOwnerId: "owner" },
      "recipient",
      { discover: false, cookbookIds: ["a"] },
    ),
    true,
  );
  assert.equal(
    p?.canRedistribute?.(
      { restricted: true, sourceCookbookId: "a", rootOwnerId: "owner" },
      "owner",
      { discover: true, cookbookIds: ["b"] },
    ),
    true,
  );
});
test("destination input cannot smuggle unknown visibility fields or invalid identifiers", () => {
  assert.equal(
    p?.destinationsSchema?.safeParse({
      discover: true,
      cookbookIds: ["not-uuid"],
    }).success,
    false,
  );
  assert.equal(
    p?.destinationsSchema?.safeParse({
      discover: false,
      cookbookIds: [],
      userId: "other",
    }).success,
    false,
  );
  assert.equal(
    p?.destinationsSchema?.safeParse({ discover: false, cookbookIds: [] })
      .success,
    true,
  );
});
test("unsafe source URLs and operational photo metadata are not public", () => {
  const result = p?.publicRecipe?.(
    {
      id: "r",
      title: "Soup",
      sourceUrl: "javascript:alert(1)",
      originalRecipeUrl: "https://cook.example/soup",
      photoMetadata: {
        kind: "generated",
        status: "ready",
        attempts: 5,
        creditUrl: "javascript:alert(2)",
      },
      ingredients: [],
      steps: [],
    },
    "token",
    { id: "u", name: "Cook" },
  );
  assert.equal(result?.sourceUrl, null);
  assert.equal(result?.originalRecipeUrl, "https://cook.example/soup");
  assert.equal(result?.photoMetadata?.creditUrl, null);
  assert.equal(result?.photoMetadata?.attempts, undefined);
});
