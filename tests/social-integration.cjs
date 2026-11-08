require("./register-ts.cjs");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { randomUUID } = require("node:crypto");
Object.assign(
  process.env,
  require("dotenv").parse(fs.readFileSync(".env.integration.local")),
);
assert.equal(process.env.NEON_BRANCH_KIND, "integration");
assert.equal(
  new URL(process.env.DATABASE_URL).hostname,
  "ep-broad-fire-b470y3zq.c-6.us-east-2.aws.neon.tech",
);
const { Pool } = require("@neondatabase/serverless");
const sql = {
  query: async (text, args) => {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 10000,
    });
    pool.on("error", () => {});
    try {
      return (await pool.query(text, args)).rows;
    } finally {
      await pool.end();
    }
  },
};
const {
  socialCommand: call,
  socialState,
  readPublication,
} = require("../src/lib/social/service.ts");
const run = randomUUID(),
  owner = {
    userId: `social-owner-${run}`,
    verifiedEmail: null,
    isModerator: false,
  },
  friend = {
    userId: `social-friend-${run}`,
    verifiedEmail: null,
    isModerator: false,
  },
  stranger = {
    userId: `social-other-${run}`,
    verifiedEmail: null,
    isModerator: false,
  },
  mod = {
    userId: `social-mod-${run}`,
    verifiedEmail: "mod@example.com",
    isModerator: true,
  };
let count = 0;
async function check(name, fn) {
  await fn();
  count++;
  console.log(`PASS ${name}`);
}
const act = (a, op, input) => call(a, op, input);
let recipe, group, token, copyId;
(async () => {
  try {
    recipe = (
      await sql.query(
        `INSERT INTO recipes(user_id,title,category,servings,photo_data,photo_metadata) VALUES($1,'Family test','Dinner',4,'data:image/png;base64,aGVsbG8=', '{"kind":"user","status":"ready","token":"must-not-leak"}') RETURNING id`,
        [owner.userId],
      )
    )[0].id;
    await sql.query(
      "INSERT INTO recipe_ingredients(recipe_id,position,quantity,unit,name,aisle) VALUES($1,0,'200','g','rice','Pantry')",
      [recipe],
    );
    await sql.query(
      "INSERT INTO recipe_steps(recipe_id,position,instruction) VALUES($1,0,'Cook the rice.')",
      [recipe],
    );
    await check("owner profile and cookbook creation", async () => {
      await act(owner, "profile", { name: "Owner", bio: "Family cook" });
      group = (await act(owner, "createCookbook", { name: "Family test" })).id;
      assert.equal((await socialState(owner)).cookbooks.length, 1);
    });
    await check("stranger cannot enumerate family", async () => {
      await assert.rejects(() => act(stranger, "cookbook", { id: group }));
    });
    await check("verified email-bound invite cannot be stolen", async () => {
      const i = await act(owner, "invite", {
        id: group,
        email: "friend@example.com",
        role: "Member",
      });
      token = i.path.split("/").pop();
      await assert.rejects(() => act(friend, "acceptInvite", { token }));
      friend.verifiedEmail = "friend@example.com";
      await act(friend, "acceptInvite", { token });
      await assert.rejects(() => act(stranger, "acceptInvite", { token }));
    });
    await check("revoked and expired invitation links cannot be used",async()=>{const revoked=await act(owner,'invite',{id:group,email:null,role:'Member'});await act(owner,'revokeInvite',{id:group,inviteId:revoked.id});await assert.rejects(()=>act(stranger,'acceptInvite',{token:revoked.path.split('/').pop()}),e=>e.status===410);const expired=await act(owner,'invite',{id:group,email:null,role:'Member'});await sql.query("UPDATE social_invites SET expires_at=now()-interval '1 second' WHERE id=$1",[expired.id]);await assert.rejects(()=>act(stranger,'acceptInvite',{token:expired.path.split('/').pop()}),e=>e.status===410);});
    await check(
      "contributor shares structured original only to selected cookbook",
      async () => {
        await act(owner, "destinations", {
          recipeId: recipe,
          discover: false,
          cookbookIds: [group],
        });
        const b = await act(friend, "cookbook", { id: group });
        assert.equal(b.recipes[0].ingredients[0].quantity, "200");
        assert.ok(b.recipes[0].imageUrl.startsWith("/api/social/photo"));
        assert.ok(!JSON.stringify(b).includes("must-not-leak"));
        await assert.rejects(() =>
          act(stranger, "recipe", { recipeId: recipe, cookbookId: group }),
        );
      },
    );
    await check("recipient cannot change original sharing", async () => {
      await assert.rejects(() =>
        act(friend, "destinations", {
          recipeId: recipe,
          discover: true,
          cookbookIds: [],
        }),
      );
    });
    await check(
      "save creates independent attributed structured copy and is idempotent",
      async () => {
        const key = randomUUID();
        copyId = (
          await act(friend, "save", {
            recipeId: recipe,
            cookbookId: group,
            idempotencyKey: key,
          })
        ).id;
        assert.notEqual(copyId, recipe);
        assert.equal(
          (
            await act(friend, "save", {
              recipeId: recipe,
              cookbookId: group,
              idempotencyKey: key,
            })
          ).id,
          copyId,
        );
        assert.equal(
          (
            await sql.query(
              "SELECT quantity FROM recipe_ingredients WHERE recipe_id=$1",
              [copyId],
            )
          )[0].quantity,
          "200",
        );
      },
    );
    await check(
      "private copies cannot be published or moved to another group",
      async () => {
        await assert.rejects(() =>
          act(friend, "destinations", {
            recipeId: copyId,
            discover: true,
            cookbookIds: [],
          }),
        );
        const other = (await act(friend, "createCookbook", { name: "Other" }))
          .id;
        await assert.rejects(() =>
          act(friend, "destinations", {
            recipeId: copyId,
            discover: false,
            cookbookIds: [other],
          }),
        );
      },
    );
    await check(
      "private contributors have stable aliases and can be blocked without public profiles",
      async () => {
        await act(friend, "destinations", {
          recipeId: copyId,
          discover: false,
          cookbookIds: [group],
        });
        const r = await act(owner, "recipe", {
          recipeId: copyId,
          cookbookId: group,
        });
        assert.ok(r.author.id);
        assert.notEqual(r.author.id, friend.userId);
        assert.equal((await socialState(friend)).profile, null);
        await act(owner, "block", { userId: r.author.id, enabled: true });
        await assert.rejects(() =>
          act(owner, "recipe", { recipeId: copyId, cookbookId: group }),
        );
        assert.ok(
          (await socialState(owner)).blocks.some((x) => x.id === r.author.id),
        );
        await act(owner, "block", { userId: r.author.id, enabled: false });
        assert.equal(
          (await act(owner, "recipe", { recipeId: copyId, cookbookId: group }))
            .author.id,
          r.author.id,
        );
        await act(friend, "destinations", {
          recipeId: copyId,
          discover: false,
          cookbookIds: [],
        });
      },
    );
    await check(
      "ingredient alternative preserves original and rejects stale revision",
      async () => {
        const r = await act(friend, "recipe", {
          recipeId: recipe,
          cookbookId: group,
        });
        const alt = {
          recipeId: recipe,
          cookbookId: group,
          ingredientId: r.ingredients[0].id,
          revision: r.revision,
          quantity: "200",
          unit: "g",
          name: "quinoa",
          note: "Rinse first",
        };
        await act(friend, "alternative", alt);
        assert.equal(
          (await act(friend, "recipe", { recipeId: recipe, cookbookId: group }))
            .alternatives.length,
          1,
        );
        await assert.rejects(() =>
          act(friend, "alternative", { ...alt, revision: "stale" }),
        );
        assert.equal(
          (
            await sql.query(
              "SELECT name FROM recipe_ingredients WHERE recipe_id=$1",
              [recipe],
            )
          )[0].name,
          "rice",
        );
      },
    );
    await check(
      "alternatives can be applied only to a new independent copy and removed by their author",
      async () => {
        const r = await act(friend, "recipe", {
          recipeId: recipe,
          cookbookId: group,
        });
        const alt = r.alternatives[0];
        const saved = await act(friend, "save", {
          recipeId: recipe,
          cookbookId: group,
          alternativeId: alt.id,
          idempotencyKey: randomUUID(),
        });
        assert.equal(
          (
            await sql.query(
              "SELECT name FROM recipe_ingredients WHERE recipe_id=$1",
              [saved.id],
            )
          )[0].name,
          "quinoa",
        );
        assert.equal(
          (
            await sql.query(
              "SELECT name FROM recipe_ingredients WHERE recipe_id=$1",
              [recipe],
            )
          )[0].name,
          "rice",
        );
        await act(friend, "removeAlternative", {
          id: alt.id,
          cookbookId: group,
        });
        assert.equal(
          (await act(friend, "recipe", { recipeId: recipe, cookbookId: group }))
            .alternatives.length,
          0,
        );
      },
    );
    await check(
      "revoked grants cannot leak future private edits through administrator reports",
      async () => {
        await act(owner, "member", {
          id: group,
          userId: friend.userId,
          action: "administrator",
        });
        await act(friend, "report", {
          kind: "recipe",
          targetId: recipe,
          cookbookId: group,
          reason: "Other",
          details: "",
        });
        await act(owner, "destinations", {
          recipeId: recipe,
          discover: false,
          cookbookIds: [],
        });
        await sql.query("UPDATE recipes SET title='Now private' WHERE id=$1", [
          recipe,
        ]);
        const q = await act(friend, "reports", { cookbookId: group });
        assert.equal(
          q.reports.find((x) => x.target_id === recipe).content,
          null,
        );
        await sql.query("UPDATE recipes SET title='Family test' WHERE id=$1", [
          recipe,
        ]);
        await act(owner, "destinations", {
          recipeId: recipe,
          discover: false,
          cookbookIds: [group],
        });
      },
    );
    await check(
      "public publishing fails closed while no verified moderator exists",
      async () => {
        const configured = process.env.SOCIAL_MODERATOR_EMAILS;
        try {
          process.env.SOCIAL_MODERATOR_EMAILS = "missing-moderator@example.com";
          assert.equal((await socialState(owner)).publicPublishingReady, false);
          await assert.rejects(
            () =>
              act(owner, "destinations", {
                recipeId: recipe,
                discover: true,
                cookbookIds: [group],
              }),
            (e) => e.status === 503,
          );
          assert.ok(
            (await act(friend, "cookbook", { id: group })).recipes.some(
              (r) => r.id === recipe,
            ),
          );
        } finally {
          process.env.SOCIAL_MODERATOR_EMAILS = configured;
        }
      },
    );
    await check(
      "public snapshot allowlist and anonymous revocation",
      async () => {
        await act(owner, "destinations", {
          recipeId: recipe,
          discover: true,
          cookbookIds: [group],
        });
        const share = await act(owner, "sharing", { recipeId: recipe });
        token = share.path.split("/").pop();
        const pub = await readPublication(token);
        assert.equal(pub.dto.ingredients[0].unit, "g");
        assert.notEqual(pub.dto.author.id, owner.userId);
        assert.ok(pub.dto.author.id);
        assert.ok(!JSON.stringify(pub.dto).includes(owner.userId));
        assert.ok(!JSON.stringify(pub.dto).includes("must-not-leak"));
        assert.ok(!JSON.stringify(pub.dto).includes(group));
        assert.equal(pub.dto.imageUrl, `/api/shared/${token}/photo`);
      },
    );
    await check(
      "Discover filters search actual ingredient, cuisine and known time",
      async () => {
        await sql.query(
          "UPDATE recipes SET prep_minutes=5,cook_minutes=20 WHERE id=$1",
          [recipe],
        );
        await act(owner, "destinations", {
          recipeId: recipe,
          discover: true,
          cookbookIds: [group],
          cuisine: "Mediterranean",
        });
        assert.ok(
          (
            await act(stranger, "feed", {
              tab: "discover",
              query: "rice",
              cuisine: "Mediterranean",
              maxMinutes: 30,
            })
          ).recipes.some((r) => r.id === recipe),
        );
        assert.ok(
          !(
            await act(stranger, "feed", { tab: "discover", query: "quinoa" })
          ).recipes.some((r) => r.id === recipe),
        );
      },
    );
    await check(
      "family pagination retains recipes beyond the first page",
      async () => {
        const extras = await sql.query(
          "INSERT INTO recipes(user_id,title,created_at) SELECT $1,'Page test '||n,now()+n*interval '1 microsecond' FROM generate_series(1,21) n RETURNING id",
          [owner.userId],
        );
        for (const x of extras)
          await sql.query(
            "INSERT INTO social_grants(cookbook_id,recipe_id,contributor_id) VALUES($1,$2,$3)",
            [group, x.id, owner.userId],
          );
        const first = await act(friend, "cookbook", { id: group, offset: 0 }),
          next = await act(friend, "cookbook", { id: group, offset: 20 });
        assert.equal(first.recipes.length, 20);
        assert.equal(first.hasMore, true);
        assert.equal(next.recipes.length, 2);
        assert.equal(next.hasMore, false);
      },
    );
    await check(
      "report moderation is restricted and hides anonymous snapshot",
      async () => {
        await act(stranger, "report", {
          kind: "recipe",
          targetId: recipe,
          reason: "Spam",
          details: "",
        });
        await assert.rejects(() => act(friend, "reports", {}));
        const q = await act(mod, "reports", {});
        const report = q.reports.find((r) => r.target_id === recipe);
        assert.ok(report);
        await act(mod, "resolve", { id: report.id, action: "remove" });
        assert.equal(await readPublication(token), null);
        await assert.rejects(() =>
          act(owner, "destinations", {
            recipeId: recipe,
            discover: true,
            cookbookIds: [group],
          }),
        );
      },
    );
    await check("concurrent administrator demotions retain an administrator",async()=>{const results=await Promise.allSettled([act(owner,'member',{id:group,userId:friend.userId,action:'member'}),act(friend,'member',{id:group,userId:owner.userId,action:'member'})]);assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.ok((await sql.query("SELECT count(*)::int n FROM social_members WHERE cookbook_id=$1 AND role='Administrator'",[group]))[0].n>=1);});
    await check(
      "removal revokes group access and owned contributions",
      async () => {
        await act(owner, "member", {
          id: group,
          userId: friend.userId,
          action: "remove",
        });
        await assert.rejects(() =>
          act(friend, "recipe", { recipeId: recipe, cookbookId: group }),
        );
      },
    );
    await check(
      "owner cannot leave without transferring ownership",
      async () => {
        await assert.rejects(() => act(owner, "leave", { id: group }));
      },
    );
    await check("deleting original preserves recipient snapshot", async () => {
      await sql.query("DELETE FROM recipes WHERE id=$1", [recipe]);
      assert.equal(
        (
          await sql.query(
            "SELECT title FROM recipes WHERE id=$1 AND user_id=$2",
            [copyId, friend.userId],
          )
        ).length,
        1,
      );
      assert.equal(
        (
          await sql.query(
            "SELECT root_recipe_id FROM social_copies WHERE recipe_id=$1",
            [copyId],
          )
        )[0].root_recipe_id,
        null,
      );
    });
    console.log(`${count} integration checks passed.`);
  } finally {
    const ids = [owner.userId, friend.userId, stranger.userId, mod.userId];
    await sql.query(
      "DELETE FROM social_cookbooks WHERE owner_id=ANY($1::text[])",
      [ids],
    );
    await sql.query("DELETE FROM recipes WHERE user_id=ANY($1::text[])", [ids]);
    for (const [table, col] of [
      ["social_profiles", "user_id"],
      ["social_identities", "user_id"],
      ["social_reports", "reporter_id"],
      ["social_rate_limits", "actor_id"],
      ["social_blocks", "user_id"],
      ["social_follows", "follower_id"],
    ])
      await sql.query(`DELETE FROM ${table} WHERE ${col}=ANY($1::text[])`, [
        ids,
      ]);
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
