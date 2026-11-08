require("./register-ts.cjs");
const { test } = require("node:test"),
  assert = require("node:assert/strict"),
  Module = require("module");
test("transaction closes its pool even when connecting fails", async () => {
  let ended = false;
  const old = Module._load;
  Module._load = function (id, ...rest) {
    if (id === "server-only") return {};
    if (id === "@neondatabase/serverless")
      return {
        Pool: class {
          on() {}
          async connect() {
            throw Error("offline");
          }
          async end() {
            ended = true;
          }
        },
      };
    return old.call(this, id, ...rest);
  };
  try {
    delete require.cache[
      require.resolve("../src/lib/db/planner-transaction.ts")
    ];
    const {
      withPlannerTransaction,
    } = require("../src/lib/db/planner-transaction.ts");
    await assert.rejects(
      () => withPlannerTransaction("owner", () => null),
      /offline/,
    );
    assert.equal(ended, true);
  } finally {
    Module._load = old;
  }
});
