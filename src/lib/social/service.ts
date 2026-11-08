import "server-only";
import {
  withPlannerTransaction,
  PlannerError,
  type PlannerClient,
} from "../db/planner-transaction";
import {
  canRedistribute,
  hashToken,
  newToken,
  openToken,
  sealToken,
  publicRecipe,
  socialEnabled,
} from "./policy";
import { commands, readCommands, type Command } from "./commands";
import type { SocialActor } from "./actor-policy";
// SQL parameters are always bound. Social membership writes share a transaction lock;
// recipe owner writes also use the existing owner lock through withPlannerTransaction.
type Row = Record<string, any>; // database JSON projections are narrowed at the DTO boundary
function fail(message: string, status = 403): never {
  throw new PlannerError(message, status);
}
async function one(
  c: PlannerClient,
  sql: string,
  args: unknown[] = [],
): Promise<Row | null> {
  return (await c.query(sql, args)).rows[0] || null;
}
async function many(
  c: PlannerClient,
  sql: string,
  args: unknown[] = [],
): Promise<Row[]> {
  return (await c.query(sql, args)).rows;
}
async function member(
  c: PlannerClient,
  actor: SocialActor,
  id: string,
  admin = false,
) {
  const m = await one(
    c,
    `SELECT m.*,b.name,b.owner_id FROM social_members m JOIN social_cookbooks b ON b.id=m.cookbook_id WHERE m.cookbook_id=$1 AND m.user_id=$2 AND b.archived_at IS NULL`,
    [id, actor.userId],
  );
  if (!m || (admin && m.role !== "Administrator"))
    fail("Cookbook access required.");
  return m;
}
async function rate(
  c: PlannerClient,
  a: SocialActor,
  bucket = "write",
  limit = 30,
  seconds = 60,
) {
  const r = await one(
    c,
    `INSERT INTO social_rate_limits(actor_id,bucket,used,expires_at) VALUES($1,$2,1,now()+$3*interval '1 second') ON CONFLICT(actor_id,bucket) DO UPDATE SET used=CASE WHEN social_rate_limits.expires_at<=now() THEN 1 ELSE social_rate_limits.used+1 END,expires_at=CASE WHEN social_rate_limits.expires_at<=now() THEN now()+$3*interval '1 second' ELSE social_rate_limits.expires_at END RETURNING used`,
    [a.userId, bucket, seconds],
  );
  if (r!.used > limit) fail("Please try again later.", 429);
}
async function blocked(c: PlannerClient, a: string, b: string) {
  return !!(await one(
    c,
    "SELECT 1 FROM social_blocks WHERE (user_id=$1 AND blocked_id=$2) OR (user_id=$2 AND blocked_id=$1)",
    [a, b],
  ));
}
export async function recipeSnapshot(c: PlannerClient, id: string) {
  // A single SQL snapshot prevents mixed revisions during concurrent original edits.
  return one(
    c,
    `SELECT r.*,(SELECT attribution FROM social_copies WHERE recipe_id=r.id) attribution,COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.position) FROM recipe_ingredients i WHERE i.recipe_id=r.id),'[]'::jsonb) ingredients,COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY s.position) FROM recipe_steps s WHERE s.recipe_id=r.id),'[]'::jsonb) steps FROM recipes r WHERE r.id=$1 FOR SHARE OF r`,
    [id],
  );
}
async function identity(c: PlannerClient, userId: string) {
  const existing = await one(
    c,
    "SELECT public_id FROM social_identities WHERE user_id=$1",
    [userId],
  );
  if (existing) return existing.public_id as string;
  const row = await one(
    c,
    "INSERT INTO social_identities(user_id,public_id) VALUES($1,COALESCE((SELECT public_id FROM social_profiles WHERE user_id=$1),gen_random_uuid())) ON CONFLICT(user_id) DO UPDATE SET user_id=EXCLUDED.user_id RETURNING public_id",
    [userId],
  );
  return row!.public_id as string;
}
async function author(c: PlannerClient, id: string) {
  const p = await one(
    c,
    "SELECT display_name,public_id FROM social_profiles WHERE user_id=$1 AND hidden=false",
    [id],
  );
  return { id: await identity(c, id), name: p?.display_name || "A home cook" };
}
async function accessible(
  c: PlannerClient,
  a: SocialActor,
  id: string,
  group?: string,
) {
  if (group) await member(c, a, group);
  const r = await recipeSnapshot(c, id);
  if (!r) fail("Recipe not found.", 404);
  if (
    group &&
    !(await one(
      c,
      "SELECT 1 FROM social_grants WHERE cookbook_id=$1 AND recipe_id=$2",
      [group, id],
    ))
  )
    fail("Recipe not found.", 404);
  if (r!.user_id === a.userId) return r!;
  if (await blocked(c, a.userId, r!.user_id)) fail("Recipe not found.", 404);
  if (group) {
    await member(c, a, group);
    if (
      !(await one(
        c,
        "SELECT 1 FROM social_grants WHERE cookbook_id=$1 AND recipe_id=$2",
        [group, id],
      ))
    )
      fail("Recipe not found.", 404);
    return r!;
  }
  const p = await one(
    c,
    `SELECT snapshot FROM social_publications p WHERE recipe_id=$1 AND discover=true AND hidden=false AND NOT EXISTS(SELECT 1 FROM social_profiles WHERE user_id=p.owner_id AND hidden=true)`,
    [id],
  );
  if (!p) fail("Recipe not found.", 404);
  return { ...p!.snapshot, user_id: r!.user_id };
}
function revision(r: Row) {
  return new Date(r.updated_at).toISOString();
}
async function familyRecipe(
  c: PlannerClient,
  r: Row,
  group: string,
  viewerId: string,
) {
  const person = await author(c, r.user_id);
  if (person.name === "A home cook") {
    const registered = await one(
      c,
      "SELECT CASE WHEN name NOT LIKE '%@%' THEN left(name,60) END AS name FROM neon_auth.\"user\" WHERE id::text=$1",
      [r.user_id],
    );
    if (registered?.name) person.name = registered.name;
  }
  const dto = publicRecipe(r, "", person);
  const canManage =
    (
      await member(
        c,
        { userId: viewerId, verifiedEmail: null, isModerator: false },
        group,
      )
    ).role === "Administrator";
  return {
    ...dto,
    isContributor: r.user_id === viewerId,
    shareUrl: null,
    imageUrl: r.photo_data
      ? `/api/social/photo?recipeId=${r.id}&cookbookId=${group}`
      : dto.imageUrl,
    revision: revision(r),
    alternatives: (
      await many(
        c,
        "SELECT id,ingredient_id,author_id,quantity,unit,name,note,endorsed FROM social_alternatives WHERE cookbook_id=$1 AND recipe_id=$2 AND stale=false AND hidden=false ORDER BY created_at",
        [group, r.id],
      )
    ).map((alt) => ({
      ...alt,
      canRemove:
        canManage || alt.author_id === viewerId || r.user_id === viewerId,
    })),
  };
}
async function activity(
  c: PlannerClient,
  a: SocialActor,
  group: string,
  id: string,
  kind: string,
  title: string,
) {
  await c.query(
    "INSERT INTO social_activity(cookbook_id,actor_id,recipe_id,kind,title) VALUES($1,$2,$3,$4,$5)",
    [group, a.userId, id, kind, title],
  );
}
async function publicModerationReady(c: PlannerClient) {
  const emails = (process.env.SOCIAL_MODERATOR_EMAILS || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  if (!emails.length) return false;
  if (
    !(await one(c, "SELECT to_regclass('neon_auth.user') available"))?.available
  )
    return false;
  return !!(await one(
    c,
    'SELECT 1 FROM neon_auth."user" WHERE lower(email)=ANY($1::text[]) AND "emailVerified"=true LIMIT 1',
    [emails],
  ));
}
export async function socialState(a: SocialActor) {
  return transaction(a, async (c) => ({
    publicId: await identity(c, a.userId),
    profile: await one(
      c,
      "SELECT user_id,public_id,display_name,bio,hidden FROM social_profiles WHERE user_id=$1",
      [a.userId],
    ),
    cookbooks: await many(
      c,
      `SELECT b.id,b.name,b.owner_id,m.role,(SELECT count(*)::int FROM social_members n WHERE n.cookbook_id=b.id) member_count FROM social_cookbooks b JOIN social_members m ON m.cookbook_id=b.id WHERE m.user_id=$1 AND b.archived_at IS NULL ORDER BY b.created_at`,
      [a.userId],
    ),
    blocks: await many(
      c,
      "SELECT p.public_id AS id FROM social_blocks b JOIN social_identities p ON p.user_id=b.blocked_id WHERE b.user_id=$1",
      [a.userId],
    ),
    following: await many(
      c,
      "SELECT p.public_id AS id FROM social_follows f JOIN social_profiles p ON p.user_id=f.followed_id WHERE f.follower_id=$1",
      [a.userId],
    ),
    publicPublishingReady: await publicModerationReady(c),
    isModerator: a.isModerator,
    userId: a.userId,
  }));
}
async function transaction<T>(
  a: SocialActor,
  fn: (c: PlannerClient) => Promise<T>,
  mutating = false,
) {
  if (!socialEnabled()) fail("Community is not available yet.", 503);
  return withPlannerTransaction(
    a.userId,
    async (c) => {
      await c.query("SET LOCAL statement_timeout = '15s'");
      await c.query("SET LOCAL idle_in_transaction_session_timeout = '15s'");
      if (mutating)
        await c.query(
          "SELECT pg_advisory_xact_lock(hashtextextended('omnicook-social',0))",
        );
      return fn(c);
    },
    mutating,
  );
}
export async function socialCommand(
  a: SocialActor,
  operation: string,
  input: unknown,
): Promise<any> {
  const schema = Object.hasOwn(commands, operation)
    ? commands[operation as Command]
    : undefined;
  if (!schema) fail("Unknown action.", 400);
  const parsed = schema.safeParse(input);
  if (!parsed.success) fail("Invalid input.", 400);
  const p = parsed.data as Row;
  return transaction(
    a,
    async (c) => {
      if (!readCommands.has(operation)) await rate(c, a);
      switch (operation) {
        case "profile": {
        if(!await publicModerationReady(c))fail("Public profiles are awaiting moderator email verification.",503);
          const publicId = await identity(c, a.userId);
          await c.query(
            `INSERT INTO social_profiles(user_id,display_name,bio,public_id) VALUES($1,$2,$3,$4) ON CONFLICT(user_id) DO UPDATE SET display_name=$2,bio=$3`,
            [a.userId, p.name, p.bio, publicId],
          );
          return { ok: true };
        }
        case "createCookbook": {
          if (
            (await one(
              c,
              "SELECT count(*)::int n FROM social_members WHERE user_id=$1",
              [a.userId],
            ))!.n >= 50
          )
            fail("Cookbook limit reached.", 400);
          const b = await one(
            c,
            "INSERT INTO social_cookbooks(name,owner_id) VALUES($1,$2) RETURNING id",
            [p.name, a.userId],
          );
          await c.query(
            "INSERT INTO social_members(cookbook_id,user_id,role) VALUES($1,$2,'Administrator')",
            [b!.id, a.userId],
          );
          return b;
        }
        case "cookbook": {
          const m = await member(c, a, p.id);
          const rows = await many(
            c,
            "SELECT recipe_id FROM social_grants WHERE cookbook_id=$1 ORDER BY created_at DESC LIMIT 21 OFFSET $2",
            [p.id, p.offset],
          );
          const recipes = [];
          for (const row of rows.slice(0, 20)) {
            const r = await accessible(c, a, row.recipe_id, p.id).catch(
              () => null,
            );
            if (r) recipes.push(await familyRecipe(c, r, p.id, a.userId));
          }
          return {
            id: p.id,
            name: m.name,
            ownerId: m.owner_id,
            role: m.role,
            recipes,
            hasMore: rows.length > 20,
            members: await many(
              c,
              `SELECT m.user_id,m.role,COALESCE(p.display_name,CASE WHEN u.name NOT LIKE '%@%' THEN left(u.name,60) END,'A home cook') name FROM social_members m LEFT JOIN social_profiles p ON p.user_id=m.user_id LEFT JOIN neon_auth."user" u ON u.id::text=m.user_id WHERE m.cookbook_id=$1 ORDER BY m.created_at`,
              [p.id],
            ),
            invites:
              m.role === "Administrator"
                ? await many(
                    c,
                    "SELECT id,email,role,expires_at FROM social_invites WHERE cookbook_id=$1 AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at>now() ORDER BY created_at",
                    [p.id],
                  )
                : [],
            activity: await many(
              c,
              `SELECT x.id,x.kind,x.title,x.created_at,(x.actor_id=$2) AS is_mine,(x.photo_data IS NOT NULL) AS has_photo,COALESCE(p.display_name,CASE WHEN u.name NOT LIKE '%@%' THEN left(u.name,60) END,'A home cook') name FROM social_activity x LEFT JOIN social_profiles p ON p.user_id=x.actor_id LEFT JOIN neon_auth."user" u ON u.id::text=x.actor_id WHERE x.cookbook_id=$1 AND NOT EXISTS(SELECT 1 FROM social_blocks b WHERE (b.user_id=$2 AND b.blocked_id=x.actor_id) OR (b.user_id=x.actor_id AND b.blocked_id=$2)) ORDER BY x.created_at DESC LIMIT 20`,
              [p.id, a.userId],
            ),
          };
        }
        case "renameCookbook":
          await member(c, a, p.id, true);
          await c.query("UPDATE social_cookbooks SET name=$2 WHERE id=$1", [
            p.id,
            p.name,
          ]);
          return { ok: true };
        case "archiveCookbook": {
          const m = await member(c, a, p.id, true);
          if (m.owner_id !== a.userId)
            fail("Only the cookbook owner can archive it.");
          await c.query(
            "UPDATE social_cookbooks SET archived_at=now() WHERE id=$1",
            [p.id],
          );
          await c.query("DELETE FROM social_grants WHERE cookbook_id=$1", [
            p.id,
          ]);
          await c.query(
            "UPDATE social_invites SET revoked_at=now() WHERE cookbook_id=$1",
            [p.id],
          );
          return { ok: true };
        }
        case "invite": {
          await member(c, a, p.id, true);
          await rate(c, a, "invites", 20, 86400);
          const token = newToken();
          const i = await one(
            c,
            "INSERT INTO social_invites(cookbook_id,token_hash,email,role,expires_at) VALUES($1,$2,$3,$4,now()+interval '7 days') RETURNING id,expires_at",
            [p.id, hashToken(token), p.email?.toLowerCase() || null, p.role],
          );
          return { ...i, path: `/invite/${token}` };
        }
        case "revokeInvite":
          await member(c, a, p.id, true);
          await c.query(
            "UPDATE social_invites SET revoked_at=now() WHERE id=$1 AND cookbook_id=$2",
            [p.inviteId, p.id],
          );
          return { ok: true };
        case "acceptInvite": {
          const i = await one(
            c,
            `SELECT i.* FROM social_invites i JOIN social_cookbooks b ON b.id=i.cookbook_id WHERE i.token_hash=$1 AND i.consumed_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>now() AND b.archived_at IS NULL FOR UPDATE OF i`,
            [hashToken(p.token)],
          );
          if (!i)
            fail("This invitation has expired or already been used.", 410);
          if (i!.email && a.verifiedEmail !== i!.email)
            fail(
              "Sign in with the verified email this invitation was sent to.",
            );
          await c.query(
            "INSERT INTO social_members(cookbook_id,user_id,role) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
            [i!.cookbook_id, a.userId, i!.role],
          );
          await c.query(
            "UPDATE social_invites SET consumed_at=now() WHERE id=$1",
            [i!.id],
          );
          return { id: i!.cookbook_id };
        }
        case "member":
        case "leave": {
          const me = await member(c, a, p.id, operation === "member");
          const target = operation === "leave" ? a.userId : p.userId;
          const m = await one(
            c,
            "SELECT role FROM social_members WHERE cookbook_id=$1 AND user_id=$2",
            [p.id, target],
          );
          if (!m) fail("Member not found.", 404);
          const action = operation === "leave" ? "remove" : p.action;
          if (action === "transfer") {
            if (me.owner_id !== a.userId || target === a.userId)
              fail(
                "Only the owner can transfer this cookbook to another member.",
              );
            await c.query(
              "UPDATE social_members SET role='Administrator' WHERE cookbook_id=$1 AND user_id=$2",
              [p.id, target],
            );
            await c.query(
              "UPDATE social_cookbooks SET owner_id=$2 WHERE id=$1",
              [p.id, target],
            );
            return { ok: true };
          }
          if (
            target === me.owner_id &&
            (action === "remove" || action === "member")
          )
            fail("Transfer cookbook ownership first.");
          if (
            m!.role === "Administrator" &&
            action !== "administrator" &&
            (await one(
              c,
              "SELECT count(*)::int n FROM social_members WHERE cookbook_id=$1 AND role='Administrator'",
              [p.id],
            ))!.n <= 1
          )
            fail("A cookbook needs an administrator.");
          if (action === "remove") {
            await c.query(
              "DELETE FROM social_members WHERE cookbook_id=$1 AND user_id=$2",
              [p.id, target],
            );
            await c.query(
              "DELETE FROM social_grants WHERE cookbook_id=$1 AND contributor_id=$2",
              [p.id, target],
            );
          } else
            await c.query(
              "UPDATE social_members SET role=$3 WHERE cookbook_id=$1 AND user_id=$2",
              [
                p.id,
                target,
                action === "administrator" ? "Administrator" : "Member",
              ],
            );
          return { ok: true };
        }
        case "sharing": {
          const r = await recipeSnapshot(c, p.recipeId);
          if (r?.user_id !== a.userId)
            fail("Only the contributor can change sharing.");
          const pub = await one(
            c,
            "SELECT * FROM social_publications WHERE recipe_id=$1",
            [p.recipeId],
          );
          return {
            cuisine: pub?.snapshot?.cuisine || "",
            attribution: r!.attribution || null,
            discover: !!pub?.discover,
            cookbookIds: (
              await many(
                c,
                "SELECT cookbook_id FROM social_grants WHERE recipe_id=$1",
                [p.recipeId],
              )
            ).map((x) => x.cookbook_id),
            path:
              pub && !pub.hidden
                ? `/shared/${openToken(pub.token_sealed)}`
                : null,
            hidden: !!pub?.hidden,
          };
        }
        case "destinations": {
          const r = await recipeSnapshot(c, p.recipeId);
          if (r?.user_id !== a.userId)
            fail("Only the contributor can change sharing.");
          const copy = await one(
            c,
            "SELECT restricted,source_cookbook_id,root_owner_id FROM social_copies WHERE recipe_id=$1",
            [p.recipeId],
          );
          if (
            !canRedistribute(
              copy
                ? {
                    restricted: copy.restricted,
                    sourceCookbookId: copy.source_cookbook_id,
                    rootOwnerId: copy.root_owner_id,
                  }
                : null,
              a.userId,
              { discover: p.discover, cookbookIds: p.cookbookIds },
            )
          )
            fail(
              "This family recipe can only be shared back to its original cookbook.",
            );
          const groups = [...new Set<string>(p.cookbookIds)];
          for (const id of groups) await member(c, a, id);
          const existing = await many(
            c,
            "SELECT cookbook_id FROM social_grants WHERE recipe_id=$1",
            [p.recipeId],
          );
          await c.query(
            "DELETE FROM social_grants WHERE recipe_id=$1 AND NOT(cookbook_id=ANY($2::uuid[]))",
            [p.recipeId, groups],
          );
          for (const id of groups) {
            await c.query(
              "INSERT INTO social_grants(cookbook_id,recipe_id,contributor_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
              [id, p.recipeId, a.userId],
            );
            if (!existing.some((x) => x.cookbook_id === id))
              await activity(c, a, id, p.recipeId, "shared", r!.title);
          }
          if (p.discover) {
            if (!(await publicModerationReady(c)))
              fail(
                "Public publishing is awaiting moderator email verification.",
                503,
              );
            if (
              !(await one(
                c,
                "SELECT 1 FROM social_profiles WHERE user_id=$1 AND hidden=false",
                [a.userId],
              ))
            )
              fail("Create a public cook profile before publishing.", 400);
            if (
              await one(
                c,
                "SELECT 1 FROM social_publications WHERE recipe_id=$1 AND hidden=true",
                [p.recipeId],
              )
            )
              fail("This recipe is hidden by moderation.");
            const token = newToken();
            await c.query(
              `INSERT INTO social_publications(recipe_id,owner_id,token_hash,token_sealed,discover,snapshot) VALUES($1,$2,$3,$4,true,$5::jsonb) ON CONFLICT(recipe_id) DO UPDATE SET discover=true,snapshot=EXCLUDED.snapshot,updated_at=now()`,
              [
                p.recipeId,
                a.userId,
                hashToken(token),
                sealToken(token),
                JSON.stringify({ ...r, cuisine: p.cuisine || null }),
              ],
            );
          } else
            await c.query(
              "DELETE FROM social_publications WHERE recipe_id=$1 AND hidden=false",
              [p.recipeId],
            );
          return { ok: true };
        }
        case "recipe": {
          const r = await accessible(c, a, p.recipeId, p.cookbookId);
          if (p.cookbookId) return familyRecipe(c, r, p.cookbookId, a.userId);
          const pub = await one(
            c,
            "SELECT token_sealed FROM social_publications WHERE recipe_id=$1 AND hidden=false AND discover=true",
            [p.recipeId],
          );
          if (!pub) fail("Recipe not found.", 404);
          return publicRecipe(
            r,
            openToken(pub!.token_sealed),
            await author(c, r.user_id),
          );
        }
        case "save": {
          const previous = await one(
            c,
            "SELECT recipe_id FROM social_copies WHERE owner_id=$1 AND idempotency_key=$2",
            [a.userId, p.idempotencyKey],
          );
          if (previous) return { id: previous.recipe_id };
          const r = await accessible(c, a, p.recipeId, p.cookbookId);
          if (p.alternativeId) {
            if (!p.cookbookId) fail("Choose the alternative’s cookbook.", 400);
            const alt = await one(
              c,
              "SELECT * FROM social_alternatives WHERE id=$1 AND cookbook_id=$2 AND recipe_id=$3 AND stale=false AND hidden=false",
              [p.alternativeId, p.cookbookId, p.recipeId],
            );
            if (
              !alt ||
              revision(r) !== alt.revision ||
              !r.ingredients.some((i: Row) => i.id === alt.ingredient_id)
            )
              fail("This alternative is no longer current.", 409);
            r.ingredients = r.ingredients.map((i: Row) =>
              i.id === alt.ingredient_id
                ? {
                    ...i,
                    quantity: alt.quantity,
                    unit: alt.unit,
                    name: alt.name,
                    notes: alt.note || null,
                  }
                : i,
            );
          }
          const provenance = await one(
            c,
            "SELECT * FROM social_copies WHERE recipe_id=$1",
            [r.id],
          );
          const saved = await one(
            c,
            `INSERT INTO recipes(user_id,title,creator,source_url,original_recipe_url,image_url,photo_data,photo_metadata,category,prep_minutes,cook_minutes,servings) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12) RETURNING id`,
            [
              a.userId,
              r.title,
              r.creator,
              r.source_url,
              r.original_recipe_url,
              r.image_url,
              r.photo_data,
              JSON.stringify(r.photo_metadata),
              r.category,
              r.prep_minutes,
              r.cook_minutes,
              r.servings,
            ],
          );
          for (const i of r.ingredients)
            await c.query(
              "INSERT INTO recipe_ingredients(recipe_id,position,quantity,unit,name,notes,aisle) VALUES($1,$2,$3,$4,$5,$6,$7)",
              [
                saved!.id,
                i.position,
                i.quantity,
                i.unit,
                i.name,
                i.notes,
                i.aisle,
              ],
            );
          for (const s of r.steps)
            await c.query(
              "INSERT INTO recipe_steps(recipe_id,position,instruction) VALUES($1,$2,$3)",
              [saved!.id, s.position, s.instruction],
            );
          const attribution = {
            author: await author(c, r.user_id),
            title: r.title,
            sourceId: r.id,
            sourceUrl: r.source_url,
            originalRecipeUrl: r.original_recipe_url,
          };
          await c.query(
            "INSERT INTO social_copies(recipe_id,owner_id,source_id,root_recipe_id,root_owner_id,source_cookbook_id,restricted,attribution,idempotency_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)",
            [
              saved!.id,
              a.userId,
              r.id,
              provenance?.root_recipe_id || r.id,
              provenance?.root_owner_id || r.user_id,
              provenance?.source_cookbook_id || p.cookbookId || null,
              !!provenance?.restricted || !!p.cookbookId,
              JSON.stringify(provenance?.attribution || attribution),
              p.idempotencyKey,
            ],
          );
          return { id: saved!.id };
        }
        case "alternative": {
          const r = await accessible(c, a, p.recipeId, p.cookbookId);
          if (
            revision(r) !== p.revision ||
            !r.ingredients.some((i: Row) => i.id === p.ingredientId)
          )
            fail(
              "The original recipe has changed. Reopen it before suggesting an alternative.",
              409,
            );
          const alt = await one(
            c,
            "INSERT INTO social_alternatives(cookbook_id,recipe_id,ingredient_id,revision,author_id,quantity,unit,name,note) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id",
            [
              p.cookbookId,
              p.recipeId,
              p.ingredientId,
              p.revision,
              a.userId,
              p.quantity,
              p.unit,
              p.name,
              p.note,
            ],
          );
          await activity(
            c,
            a,
            p.cookbookId,
            p.recipeId,
            "alternative",
            r.title,
          );
          return alt;
        }
        case "removeAlternative": {
          const m = await member(c, a, p.cookbookId);
          const alt = await one(
            c,
            "SELECT a.*,r.user_id FROM social_alternatives a JOIN recipes r ON r.id=a.recipe_id WHERE a.id=$1 AND a.cookbook_id=$2",
            [p.id, p.cookbookId],
          );
          if (!alt) fail("Alternative not found.", 404);
          if (
            alt.author_id !== a.userId &&
            alt.user_id !== a.userId &&
            m.role !== "Administrator"
          )
            fail("You cannot remove this alternative.");
          await c.query(
            "UPDATE social_alternatives SET hidden=true WHERE id=$1",
            [p.id],
          );
          return { ok: true };
        }
        case "endorse": {
          await member(c, a, p.cookbookId);
          const alt = await one(
            c,
            "SELECT a.*,r.user_id FROM social_alternatives a JOIN recipes r ON r.id=a.recipe_id WHERE a.id=$1 AND a.cookbook_id=$2",
            [p.id, p.cookbookId],
          );
          if (alt?.user_id !== a.userId)
            fail("Only the recipe contributor can endorse alternatives.");
          await c.query(
            "UPDATE social_alternatives SET endorsed=$2 WHERE id=$1",
            [p.id, p.enabled],
          );
          return { ok: true };
        }
        case "feed": {
          const id =
            p.tab === "profile"
              ? p.userId
                ? (
                    await one(
                      c,
                      "SELECT user_id FROM social_profiles WHERE public_id::text=$1 AND hidden=false",
                      [p.userId],
                    )
                  )?.user_id || "unavailable"
                : a.userId
              : null;
          if (id && id !== a.userId && (await blocked(c, a.userId, id)))
            fail("Cook not found.", 404);
          const rows = await many(
            c,
            `SELECT p.* FROM social_publications p WHERE p.discover=true AND p.hidden=false AND ($2::text IS NULL OR p.owner_id=$2) AND NOT EXISTS(SELECT 1 FROM social_profiles s WHERE s.user_id=p.owner_id AND s.hidden=true) AND NOT EXISTS(SELECT 1 FROM social_blocks b WHERE (b.user_id=$1 AND b.blocked_id=p.owner_id) OR (b.user_id=p.owner_id AND b.blocked_id=$1)) AND ($3::boolean=false OR EXISTS(SELECT 1 FROM social_follows f WHERE f.follower_id=$1 AND f.followed_id=p.owner_id)) AND ($5::text IS NULL OR p.snapshot->>'title' ILIKE $5 OR EXISTS(SELECT 1 FROM jsonb_array_elements(p.snapshot->'ingredients') i WHERE i->>'name' ILIKE $5)) AND ($6::text IS NULL OR p.snapshot->>'cuisine' ILIKE $6) AND ($7::int IS NULL OR (COALESCE((p.snapshot->>'prep_minutes')::int,0)+COALESCE((p.snapshot->>'cook_minutes')::int,0)>0 AND COALESCE((p.snapshot->>'prep_minutes')::int,0)+COALESCE((p.snapshot->>'cook_minutes')::int,0)<=$7)) ORDER BY p.updated_at DESC,p.id LIMIT 21 OFFSET $4`,
            [
              a.userId,
              id,
              p.tab === "following",
              p.offset,
              p.query ? "%" + p.query + "%" : null,
              p.cuisine || null,
              p.maxMinutes || null,
            ],
          );
          const recipes = [];
          for (const row of rows.slice(0, 20)) {
            const token = openToken(row.token_sealed);
            recipes.push({
              ...publicRecipe(
                row.snapshot,
                token,
                await author(c, row.owner_id),
              ),
              liked: !!(await one(
                c,
                "SELECT 1 FROM social_reactions WHERE recipe_id=$1 AND user_id=$2",
                [row.recipe_id, a.userId],
              )),
              likes: (await one(
                c,
                "SELECT count(*)::int n FROM social_reactions r WHERE r.recipe_id=$1 AND NOT EXISTS(SELECT 1 FROM social_blocks b WHERE (b.user_id=$2 AND b.blocked_id=r.user_id) OR (b.user_id=r.user_id AND b.blocked_id=$2))",
                [row.recipe_id, a.userId],
              ))!.n,
            });
          }
          const profile = id
            ? await one(
                c,
                "SELECT public_id,display_name,bio FROM social_profiles WHERE user_id=$1 AND hidden=false",
                [id],
              )
            : null;
          return { recipes, profile, hasMore: rows.length > 20 };
        }
        case "react":
          await accessible(c, a, p.recipeId);
          if (p.enabled)
            await c.query(
              "INSERT INTO social_reactions(recipe_id,user_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
              [p.recipeId, a.userId],
            );
          else
            await c.query(
              "DELETE FROM social_reactions WHERE recipe_id=$1 AND user_id=$2",
              [p.recipeId, a.userId],
            );
          return { ok: true };
        case "follow":
          p.userId =
            (
              await one(
                c,
                "SELECT user_id FROM social_profiles WHERE public_id::text=$1 AND hidden=false",
                [p.userId],
              )
            )?.user_id || fail("Cook not found.", 404);
          if (p.userId === a.userId || (await blocked(c, a.userId, p.userId)))
            fail("This cook is unavailable.");
          if (
            !(await one(
              c,
              "SELECT 1 FROM social_profiles WHERE user_id=$1 AND hidden=false",
              [p.userId],
            ))
          )
            fail("Cook not found.", 404);
          if (p.enabled)
            await c.query(
              "INSERT INTO social_follows(follower_id,followed_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
              [a.userId, p.userId],
            );
          else
            await c.query(
              "DELETE FROM social_follows WHERE follower_id=$1 AND followed_id=$2",
              [a.userId, p.userId],
            );
          return { ok: true };
        case "block":
          p.userId =
            (
              await one(
                c,
                "SELECT user_id FROM social_identities WHERE public_id::text=$1",
                [p.userId],
              )
            )?.user_id || fail("Cook not found.", 404);
          if (p.userId === a.userId) fail("You cannot block yourself.", 400);
          if (p.enabled) {
            await c.query(
              "INSERT INTO social_blocks(user_id,blocked_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
              [a.userId, p.userId],
            );
            await c.query(
              "DELETE FROM social_follows WHERE (follower_id=$1 AND followed_id=$2) OR (follower_id=$2 AND followed_id=$1)",
              [a.userId, p.userId],
            );
          } else
            await c.query(
              "DELETE FROM social_blocks WHERE user_id=$1 AND blocked_id=$2",
              [a.userId, p.userId],
            );
          return { ok: true };
        case "cooked": {
          const r = await accessible(c, a, p.recipeId, p.cookbookId);
          if (!p.cookbookId)
            fail("Choose a shared cookbook for this activity.", 400);
          await activity(c, a, p.cookbookId, p.recipeId, "cooked", r.title);
          return { ok: true };
        }
        case "report": {
          await rate(c, a, "reports", 10, 86400);
          if (p.cookbookId) await member(c, a, p.cookbookId);
          if (p.kind === "profile") {
            p.targetId =
              (
                await one(
                  c,
                  "SELECT user_id FROM social_profiles WHERE public_id::text=$1 AND hidden=false",
                  [p.targetId],
                )
              )?.user_id || fail("Cook not found.", 404);
            p.cookbookId = null;
          }
          if (p.kind === "recipe")
            await accessible(c, a, p.targetId, p.cookbookId);
          else if (p.kind === "profile") {
            if (
              !(await one(
                c,
                "SELECT 1 FROM social_profiles WHERE user_id=$1 AND hidden=false",
                [p.targetId],
              ))
            )
              fail("Cook not found.", 404);
          } else {
            if (!p.cookbookId) fail("Cookbook required.", 400);
            const table =
              p.kind === "alternative"
                ? "social_alternatives"
                : "social_activity";
            if (
              !(await one(
                c,
                `SELECT 1 FROM ${table} WHERE id::text=$1 AND cookbook_id=$2`,
                [p.targetId, p.cookbookId],
              ))
            )
              fail("Content not found.", 404);
          }
          await c.query(
            "INSERT INTO social_reports(reporter_id,target_kind,target_id,cookbook_id,reason,details) VALUES($1,$2,$3,$4,$5,$6)",
            [
              a.userId,
              p.kind,
              p.targetId,
              p.cookbookId || null,
              p.reason,
              p.details,
            ],
          );
          return { ok: true };
        }
        case "reports": {
          if (p.cookbookId) await member(c, a, p.cookbookId, true);
          else if (!a.isModerator) fail("Moderator access required.");
          const reports = await many(
            c,
            "SELECT id,target_kind,target_id,reason,details,created_at FROM social_reports WHERE cookbook_id IS NOT DISTINCT FROM $1::uuid AND status='open' ORDER BY created_at LIMIT 100",
            [p.cookbookId || null],
          );
          for (const report of reports) {
            if (report.target_kind === "recipe") {
              if (p.cookbookId) {
                const granted = await one(
                  c,
                  "SELECT 1 FROM social_grants WHERE recipe_id::text=$1 AND cookbook_id=$2",
                  [report.target_id, p.cookbookId],
                );
                const r = granted
                  ? await recipeSnapshot(c, report.target_id)
                  : null;
                report.content = r
                  ? {
                      title: r.title,
                      ingredients: r.ingredients.map((i: Row) => ({
                        name: i.name,
                        quantity: i.quantity,
                        unit: i.unit,
                        notes: i.notes,
                      })),
                      steps: r.steps.map((s: Row) => s.instruction),
                    }
                  : null;
              } else {
                const r = await one(
                  c,
                  "SELECT snapshot FROM social_publications WHERE recipe_id::text=$1",
                  [report.target_id],
                );
                report.content = r
                  ? publicRecipe(
                      r.snapshot,
                      "",
                      await author(c, r.snapshot.user_id),
                    )
                  : null;
              }
            } else if (report.target_kind === "profile")
              report.content = await one(
                c,
                "SELECT display_name,bio FROM social_profiles WHERE user_id=$1",
                [report.target_id],
              );
            else if (report.target_kind === "alternative")
              report.content = await one(
                c,
                "SELECT name,quantity,unit,note FROM social_alternatives WHERE id::text=$1 AND cookbook_id=$2",
                [report.target_id, p.cookbookId],
              );
            else
              report.content = await one(
                c,
                "SELECT title,kind FROM social_activity WHERE id::text=$1 AND cookbook_id=$2",
                [report.target_id, p.cookbookId],
              );
          }
          for (const report of reports) {
            if (
              report.content &&
              ["recipe", "activity"].includes(report.target_kind)
            )
              report.content.imageUrl = `/api/social/reports/${report.id}/photo`;
          }
          return { reports };
        }
        case "resolve": {
          const report = await one(
            c,
            "SELECT * FROM social_reports WHERE id=$1 AND status='open'",
            [p.id],
          );
          if (!report) fail("Report not found.", 404);
          if (report!.cookbook_id)
            await member(c, a, report!.cookbook_id, true);
          else if (!a.isModerator) fail("Moderator access required.");
          if (p.action === "remove") {
            const t = report!.target_id,
              g = report!.cookbook_id;
            if (report!.target_kind === "recipe") {
              if (g)
                await c.query(
                  "DELETE FROM social_grants WHERE recipe_id::text=$1 AND cookbook_id=$2",
                  [t, g],
                );
              else
                await c.query(
                  "UPDATE social_publications SET hidden=true WHERE recipe_id::text=$1",
                  [t],
                );
            } else if (report!.target_kind === "profile") {
              if (g) fail("Profile reports require public moderation.");
              await c.query(
                "UPDATE social_profiles SET hidden=true WHERE user_id=$1",
                [t],
              );
            } else if (report!.target_kind === "alternative")
              await c.query(
                "UPDATE social_alternatives SET hidden=true WHERE id::text=$1 AND cookbook_id=$2",
                [t, g],
              );
            else
              await c.query(
                "DELETE FROM social_activity WHERE id::text=$1 AND cookbook_id=$2",
                [t, g],
              );
          }
          await c.query(
            "UPDATE social_reports SET status=$2,resolved_by=$3,resolved_at=now() WHERE id=$1",
            [p.id, p.action === "remove" ? "removed" : "dismissed", a.userId],
          );
          return { ok: true };
        }
        default:
          fail("Unknown action.", 400);
      }
    },
    !readCommands.has(operation),
  );
}
export async function readPublication(token: string) {
  if (!socialEnabled() || !/^[-\w]{43}$/.test(token)) return null;
  return withPlannerTransaction(
    "anonymous-social",
    async (c) => {
      const row = await one(
        c,
        `SELECT p.* FROM social_publications p WHERE token_hash=$1 AND discover=true AND hidden=false AND NOT EXISTS(SELECT 1 FROM social_profiles s WHERE s.user_id=p.owner_id AND s.hidden=true)`,
        [hashToken(token)],
      );
      if (!row) return null;
      return {
        dto: publicRecipe(row.snapshot, token, await author(c, row.owner_id)),
        photo: row.snapshot.photo_data || null,
      };
    },
    false,
  );
}
export async function readFamilyPhoto(
  a: SocialActor,
  recipeId: string,
  cookbookId: string,
) {
  return transaction(
    a,
    async (c) => {
      const r = await accessible(c, a, recipeId, cookbookId);
      return r.photo_data || null;
    },
    false,
  );
}
export async function readPublicProfile(userId: string, offset = 0) {
  if (
    !socialEnabled() ||
    !userId ||
    userId.length > 200 ||
    offset < 0 ||
    offset > 10000
  )
    return null;
  return withPlannerTransaction(
    "anonymous-social",
    async (c) => {
      const p = await one(
        c,
        "SELECT user_id,display_name,bio FROM social_profiles WHERE public_id::text=$1 AND hidden=false",
        [userId],
      );
      if (!p) return null;
      const rows = await many(
        c,
        "SELECT snapshot,token_sealed FROM social_publications WHERE owner_id=$1 AND discover=true AND hidden=false ORDER BY updated_at DESC,id LIMIT 21 OFFSET $2",
        [p.user_id, offset],
      );
      return {
        name: p.display_name,
        bio: p.bio,
        recipes: rows.slice(0, 20).map((r) =>
          publicRecipe(r.snapshot, openToken(r.token_sealed), {
            id: userId,
            name: p.display_name,
          }),
        ),
        hasMore: rows.length > 20,
      };
    },
    false,
  );
}
export async function activityPhoto(a: SocialActor, id: string, data?: string) {
  return transaction(
    a,
    async (c) => {
      const event = await one(
        c,
        "SELECT id,cookbook_id,actor_id,photo_data FROM social_activity WHERE id=$1",
        [id],
      );
      if (!event?.cookbook_id) fail("Activity not found.", 404);
      await member(c, a, event.cookbook_id);
      if (await blocked(c, a.userId, event.actor_id))
        fail("Activity not found.", 404);
      if (data !== undefined) {
        if (event.actor_id !== a.userId) fail("Only the cook can add a photo.");
        await rate(c, a);
        await c.query("UPDATE social_activity SET photo_data=$2 WHERE id=$1", [
          id,
          data,
        ]);
        return null;
      }
      return event.photo_data || null;
    },
    data !== undefined,
  );
}
export async function reportedPhoto(a: SocialActor, id: string) {
  return transaction(a, async (c) => {
    const report = await one(c, "SELECT * FROM social_reports WHERE id=$1", [
      id,
    ]);
    if (!report) fail("Report not found.", 404);
    if (report.cookbook_id) await member(c, a, report.cookbook_id, true);
    else if (!a.isModerator) fail("Moderator access required.");
    if (report.target_kind === "recipe") {
      if (report.cookbook_id) {
        if (
          !(await one(
            c,
            "SELECT 1 FROM social_grants WHERE recipe_id::text=$1 AND cookbook_id=$2",
            [report.target_id, report.cookbook_id],
          ))
        )
          return null;
        return (await recipeSnapshot(c, report.target_id))?.photo_data || null;
      }
      return (
        (
          await one(
            c,
            "SELECT snapshot FROM social_publications WHERE recipe_id::text=$1",
            [report.target_id],
          )
        )?.snapshot?.photo_data || null
      );
    }
    if (report.target_kind === "activity" && report.cookbook_id)
      return (
        (
          await one(
            c,
            "SELECT photo_data FROM social_activity WHERE id::text=$1 AND cookbook_id=$2",
            [report.target_id, report.cookbook_id],
          )
        )?.photo_data || null
      );
    return null;
  });
}
