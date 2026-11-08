import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import dotenv from "dotenv";
import sharp from "sharp";
import { Pool } from "@neondatabase/serverless";
const env = dotenv.parse(fs.readFileSync(".env.integration.local"));
Object.assign(process.env, env);
assert.equal(env.NEON_BRANCH_KIND, "integration");
assert.equal(
  new URL(env.DATABASE_URL).hostname,
  "ep-broad-fire-b470y3zq.c-6.us-east-2.aws.neon.tech",
);
assert.ok(env.NEON_AUTH_BASE_URL.includes("ep-broad-fire-b470y3zq."));
const sql = {
  query: async (text, args) => {
    const pool = new Pool({ connectionString: env.DATABASE_URL });
    pool.on("error", () => {});
    try {
      return (await pool.query(text, args)).rows;
    } finally {
      await pool.end();
    }
  },
};
const base = "http://localhost:3040",
  run = randomUUID(),
  password = `Social-test-${randomUUID()}!`,
  accounts = [];
let checks = 0,
  succeeded = false;
function client() {
  const cookies = new Map();
  return async (path, method = "GET", body) => {
    const r = await fetch(base + path, {
      method,
      headers: {
        Origin: base,
        "Content-Type": body instanceof Blob ? body.type : "application/json",
        Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; "),
      },
      body:
        body === undefined
          ? undefined
          : body instanceof Blob
            ? body
            : JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    });
    for (const raw of r.headers.getSetCookie()) {
      const part = raw.split(";")[0],
        i = part.indexOf("=");
      cookies.set(part.slice(0, i), part.slice(i + 1));
    }
    const contentType = r.headers.get("content-type");
    const text = await r.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { html: text };
    }
    return { status: r.status, data, contentType };
  };
}
async function account(label) {
  const request = client(),
    email = `social-${label}-${run}@example.com`;
  const s = await request("/api/auth/sign-up/email", "POST", {
    email,
    password,
    name: `Test ${label}`,
  });
  assert.equal(s.status, 200, `Signup failed: ${s.data.message || s.status}`);
  const id = s.data.user.id;
  accounts.push({ id, email, request });
  fs.writeFileSync(
    ".superpowers/sdd/2026-11-01-social-integration/http-accounts.json",
    JSON.stringify(accounts.map(({ id, email }) => ({ id, email }))),
  );
  await sql.query(
    "INSERT INTO seeded_users(user_id) VALUES($1) ON CONFLICT DO NOTHING",
    [id],
  );
  return { id, email, request };
}
async function call(a, operation, input = {}) {
  return a.request("/api/social", "POST", { operation, input });
}
async function ok(a, op, input) {
  const r = await call(a, op, input);
  assert.equal(r.status, 200, `${op}: ${r.data.message || r.status}`);
  return r.data;
}
async function check(name, fn) {
  await fn();
  checks++;
  console.log(`PASS ${name}`);
}
const draft = {
  title: "Test family rice",
  creator: "Family author",
  category: "Dinner",
  servings: 4,
  ingredients: [
    { position: 0, quantity: "200", unit: "g", name: "rice", aisle: "Pantry" },
  ],
  steps: [{ position: 0, instruction: "Cook for 15 minutes." }],
};
try {
  const anon = { request: client() },
    a = await account("a"),
    b = await account("b"),
    outsider = await account("outside");
  await check("anonymous social commands require authentication", async () => {
    assert.equal(
      (await call(anon, "createCookbook", { name: "No" })).status,
      401,
    );
  });
  await ok(a, "profile", {
    name: "Test family cook",
    bio: "Testing a shared kitchen.",
  });
  const group = (
    await ok(a, "createCookbook", { name: "Test private cookbook" })
  ).id;
  await check("outsider cannot enumerate members", async () => {
    assert.equal((await call(outsider, "cookbook", { id: group })).status, 403);
  });
  await check("member joins exactly once using an invitation", async () => {
    const inv = await ok(a, "invite", {
      id: group,
      email: null,
      role: "Member",
    });
    const token = inv.path.split("/").pop();
    const race = await Promise.all([
      call(b, "acceptInvite", { token }),
      call(outsider, "acceptInvite", { token }),
    ]);
    assert.deepEqual(race.map((x) => x.status).sort(), [200, 410]);
    if (race[0].status !== 200) {
      const next = await ok(a, "invite", {
        id: group,
        email: null,
        role: "Member",
      });
      await ok(b, "acceptInvite", { token: next.path.split("/").pop() });
    }
  });
  const created = await a.request("/api/recipes", "POST", {
    draft,
    sourceUrl: "https://example.com/recipe",
    collectionId: null,
  });
  assert.equal(created.status, 200);
  const recipe = created.data.recipe?.id || created.data.id;
  assert.ok(recipe);
  await check(
    "owner photo upload uses existing validated WebP storage",
    async () => {
      const image = await sharp({
        create: { width: 4, height: 4, channels: 3, background: "#f9d94e" },
      })
        .png()
        .toBuffer();
      assert.equal(
        (
          await a.request(
            `/api/recipes/${recipe}/photo`,
            "POST",
            new Blob([image], { type: "image/png" }),
          )
        ).status,
        200,
      );
    },
  );
  await ok(a, "destinations", {
    recipeId: recipe,
    discover: true,
    cookbookIds: [group],
  });
  await check(
    "private recipe endpoints remain owner-only after sharing",
    async () => {
      assert.equal(
        (await b.request(`/api/recipes/${recipe}`, "PATCH", { draft })).status,
        404,
      );
      assert.equal(
        (await b.request(`/api/recipes/${recipe}/photo`)).status,
        404,
      );
      const list = await b.request("/api/recipes");
      assert.equal(list.status, 200);
      assert.ok(!list.data.recipes.some((r) => r.id === recipe));
    },
  );
  await check(
    "shared photos reauthorize private and anonymous access",
    async () => {
      const path = (await ok(a, "sharing", { recipeId: recipe })).path,
        token = path.split("/").pop();
      const publicPhoto = await anon.request(`/api/shared/${token}/photo`);
      assert.equal(publicPhoto.status, 200);
      assert.equal(publicPhoto.contentType, "image/webp");
      const familyPhoto = await b.request(
        `/api/social/photo?recipeId=${recipe}&cookbookId=${group}`,
      );
      assert.equal(familyPhoto.status, 200);
      assert.equal(
        (
          await anon.request(
            `/api/social/photo?recipeId=${recipe}&cookbookId=${group}`,
          )
        ).status,
        401,
      );
      const dto = (await anon.request(`/api/shared/${token}`)).data;
      assert.notEqual(dto.author.id, a.id);
      assert.ok(!JSON.stringify(dto).includes(a.id));
    },
  );
  await check(
    "cooked photos are separate contributions with member and author checks",
    async () => {
      await ok(b, "cooked", { recipeId: recipe, cookbookId: group });
      const book = await ok(b, "cookbook", { id: group });
      const event = book.activity.find((x) => x.kind === "cooked" && x.is_mine);
      assert.ok(event);
      const image = await sharp({
        create: { width: 4, height: 4, channels: 3, background: "#28563d" },
      })
        .png()
        .toBuffer();
      const upload = () => new Blob([image], { type: "image/png" });
      const path = "/api/social/activity/" + event.id + "/photo";
      assert.equal((await a.request(path, "POST", upload())).status, 403);
      assert.equal((await b.request(path, "POST", upload())).status, 200);
      assert.equal((await a.request(path)).status, 200);
      assert.equal((await anon.request(path)).status, 401);
      await ok(b, "report", {
        kind: "activity",
        targetId: event.id,
        cookbookId: group,
        reason: "Other",
        details: "Test report",
      });
      const queue = await ok(a, "reports", { cookbookId: group });
      const report = queue.reports.find((x) => x.target_id === event.id);
      assert.ok(report);
      assert.equal(
        (await a.request("/api/social/reports/" + report.id + "/photo")).status,
        200,
      );
      await ok(a, "resolve", { id: report.id, action: "remove" });
      assert.equal((await a.request(path)).status, 404);
    },
  );
  const r = await ok(b, "recipe", { recipeId: recipe, cookbookId: group });
  await check(
    "editing original atomically marks ingredient alternatives stale",
    async () => {
      await ok(b, "alternative", {
        recipeId: recipe,
        cookbookId: group,
        ingredientId: r.ingredients[0].id,
        revision: r.revision,
        quantity: "200",
        unit: "g",
        name: "quinoa",
        note: "Rinse first",
      });
      assert.equal(
        (
          await a.request(`/api/recipes/${recipe}`, "PATCH", {
            draft: { ...draft, title: "Edited family rice" },
          })
        ).status,
        200,
      );
      assert.equal(
        (await ok(b, "recipe", { recipeId: recipe, cookbookId: group }))
          .alternatives.length,
        0,
      );
      assert.equal(
        (
          await sql.query(
            "SELECT stale FROM social_alternatives WHERE recipe_id=$1",
            [recipe],
          )
        )[0].stale,
        true,
      );
    },
  );
  await check(
    "member saves a copy and plans it with real quantities",
    async () => {
      const copy = await ok(b, "save", {
        recipeId: recipe,
        cookbookId: group,
        idempotencyKey: randomUUID(),
      });
      const planned = await b.request("/api/meal-plan", "POST", {
        recipeId: copy.id,
        plannedFor: "2026-11-09",
        mealSlot: "dinner",
      });
      assert.equal(planned.status, 200);
      const list = await b.request("/api/recipes");
      const row = list.data.recipes.find((r) => r.id === copy.id);
      assert.equal(row.ingredients[0].quantity, "200");
      assert.equal(row.ingredients[0].unit, "g");
      assert.equal(
        (
          await call(b, "destinations", {
            recipeId: copy.id,
            discover: true,
            cookbookIds: [],
          })
        ).status,
        403,
      );
    },
  );
  await check(
    "public snapshot changes only on explicit sharing save",
    async () => {
      const path = (await ok(a, "sharing", { recipeId: recipe })).path;
      const token = path.split("/").pop();
      assert.equal(
        (await anon.request("/api/shared/" + token)).data.title,
        "Test family rice",
      );
      await ok(a, "destinations", {
        recipeId: recipe,
        discover: true,
        cookbookIds: [group],
      });
      assert.equal(
        (await anon.request("/api/shared/" + token)).data.title,
        "Edited family rice",
      );
      await ok(a, "destinations", {
        recipeId: recipe,
        discover: false,
        cookbookIds: [group],
      });
      assert.equal((await anon.request("/api/shared/" + token)).status, 404);
      assert.equal(
        (await anon.request("/api/shared/" + token + "/photo")).status,
        404,
      );
    },
  );
  await check("non-moderators cannot read public reports", async () => {
    assert.equal((await call(b, "reports", {})).status, 403);
  });
  await check("block removes discover visibility", async () => {
    await ok(a, "destinations", {
      recipeId: recipe,
      discover: true,
      cookbookIds: [group],
    });
    await ok(b, "block", {
      userId: (await a.request("/api/social")).data.profile.public_id,
      enabled: true,
    });
    assert.ok(
      !(await ok(b, "feed", { tab: "discover", offset: 0 })).recipes.some(
        (r) => r.id === recipe,
      ),
    );
  });
  console.log(`${checks} HTTP integration checks passed.`);
  succeeded = true;
} catch (e) {
  console.error("HTTP test failure:", e.message);
  throw e;
} finally {
  if (succeeded && process.argv.includes("--keep")) {
    fs.writeFileSync(
      ".superpowers/sdd/2026-11-01-social-integration/ui-fixture.json",
      JSON.stringify({
        password,
        accounts: accounts.map(({ id, email }) => ({ id, email })),
      }),
    );
    console.log("Disposable UI fixtures recorded in ignored workspace.");
  } else {
    for (const a of accounts) {
      await sql.query("DELETE FROM social_cookbooks WHERE owner_id=$1", [a.id]);
      await sql.query("DELETE FROM meal_plan_items WHERE user_id=$1", [a.id]);
      await sql.query("DELETE FROM recipes WHERE user_id=$1", [a.id]);
      await sql.query("DELETE FROM collections WHERE user_id=$1", [a.id]);
      await sql.query("DELETE FROM seeded_users WHERE user_id=$1", [a.id]);
      for (const [table, col] of [
        ["social_profiles", "user_id"],
      ["social_identities","user_id"],
      ["planner_state","user_id"],
        ["social_reports", "reporter_id"],
        ["social_rate_limits", "actor_id"],
        ["social_blocks", "user_id"],
        ["social_follows", "follower_id"],
      ])
        await sql.query(`DELETE FROM ${table} WHERE ${col}=$1`, [a.id]);
      await sql.query('DELETE FROM neon_auth."user" WHERE id=$1 AND email=$2', [
        a.id,
        a.email,
      ]);
    }
    console.log("Temporary integration accounts and fixtures removed.");
  }
}
