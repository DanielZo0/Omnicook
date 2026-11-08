import {
  pgTable,
  text,
  varchar,
  uuid,
  timestamp,
  boolean,
  jsonb,
  integer,
  primaryKey,
  uniqueIndex,
  check,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { recipes } from "./schema";
const created = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const group = () =>
  uuid("cookbook_id")
    .notNull()
    .references(() => socialCookbooks.id, { onDelete: "cascade" });
const recipe = () =>
  uuid("recipe_id")
    .notNull()
    .references(() => recipes.id, { onDelete: "cascade" });
export const socialProfiles = pgTable("social_profiles", {
  userId: text("user_id").primaryKey(),
  publicId: uuid("public_id").notNull().defaultRandom().unique(),
  displayName: varchar("display_name", { length: 60 }).notNull(),
  bio: varchar("bio", { length: 240 }).notNull().default(""),
  hidden: boolean("hidden").notNull().default(false),
  createdAt: created(),
});
export const socialCookbooks = pgTable("social_cookbooks", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 60 }).notNull(),
  ownerId: text("owner_id").notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: created(),
});
export const socialMembers = pgTable(
  "social_members",
  {
    cookbookId: group(),
    userId: text("user_id").notNull(),
    role: text("role").notNull(),
    createdAt: created(),
  },
  (t) => [
    primaryKey({ columns: [t.cookbookId, t.userId] }),
    check(
      "social_members_role_check",
      sql`${t.role} IN ('Administrator','Member')`,
    ),
    index("social_members_user_idx").on(t.userId, t.cookbookId),
  ],
);
export const socialInvites = pgTable(
  "social_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cookbookId: group(),
    tokenHash: text("token_hash").notNull().unique(),
    email: text("email"),
    role: text("role").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: created(),
  },
  (t) => [
    check(
      "social_invites_role_check",
      sql`${t.role} IN ('Administrator','Member')`,
    ),
  ],
);
export const socialGrants = pgTable(
  "social_grants",
  {
    cookbookId: group(),
    recipeId: recipe(),
    contributorId: text("contributor_id").notNull(),
    createdAt: created(),
  },
  (t) => [primaryKey({ columns: [t.cookbookId, t.recipeId] })],
);
export const socialPublications = pgTable(
  "social_publications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    recipeId: recipe().unique(),
    ownerId: text("owner_id").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    tokenSealed: text("token_sealed").notNull(),
    discover: boolean("discover").notNull().default(false),
    hidden: boolean("hidden").notNull().default(false),
    snapshot: jsonb("snapshot").notNull(),
    createdAt: created(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("social_publications_feed_idx").on(
      t.discover,
      t.hidden,
      t.updatedAt.desc(),
      t.id,
    ),
  ],
);
export const socialCopies = pgTable(
  "social_copies",
  {
    recipeId: recipe().primaryKey(),
    ownerId: text("owner_id").notNull(),
    sourceId: text("source_id").notNull(),
    rootRecipeId: uuid("root_recipe_id").references(() => recipes.id, {
      onDelete: "set null",
    }),
    rootOwnerId: text("root_owner_id").notNull(),
    sourceCookbookId: uuid("source_cookbook_id").references(
      () => socialCookbooks.id,
      { onDelete: "set null" },
    ),
    restricted: boolean("restricted").notNull(),
    attribution: jsonb("attribution").notNull(),
    idempotencyKey: uuid("idempotency_key").notNull(),
    createdAt: created(),
  },
  (t) => [
    uniqueIndex("social_copies_owner_id_idempotency_key_key").on(
      t.ownerId,
      t.idempotencyKey,
    ),
  ],
);
export const socialAlternatives = pgTable(
  "social_alternatives",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cookbookId: group(),
    recipeId: recipe(),
    ingredientId: uuid("ingredient_id").notNull(),
    revision: text("revision").notNull(),
    authorId: text("author_id").notNull(),
    quantity: varchar("quantity", { length: 80 }),
    unit: varchar("unit", { length: 60 }),
    name: varchar("name", { length: 160 }).notNull(),
    note: varchar("note", { length: 240 }).notNull().default(""),
    endorsed: boolean("endorsed").notNull().default(false),
    stale: boolean("stale").notNull().default(false),
    hidden: boolean("hidden").notNull().default(false),
    createdAt: created(),
  },
  (t) => [
    index("social_alternatives_recipe_idx").on(
      t.cookbookId,
      t.recipeId,
      t.stale,
    ),
  ],
);
export const socialReactions = pgTable(
  "social_reactions",
  {
    recipeId: recipe(),
    userId: text("user_id").notNull(),
    createdAt: created(),
  },
  (t) => [primaryKey({ columns: [t.recipeId, t.userId] })],
);
export const socialFollows = pgTable(
  "social_follows",
  {
    followerId: text("follower_id").notNull(),
    followedId: text("followed_id").notNull(),
    createdAt: created(),
  },
  (t) => [
    primaryKey({ columns: [t.followerId, t.followedId] }),
    check("social_follows_check", sql`${t.followerId}<>${t.followedId}`),
  ],
);
export const socialBlocks = pgTable(
  "social_blocks",
  {
    userId: text("user_id").notNull(),
    blockedId: text("blocked_id").notNull(),
    createdAt: created(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.blockedId] }),
    check("social_blocks_check", sql`${t.userId}<>${t.blockedId}`),
  ],
);
export const socialActivity = pgTable(
  "social_activity",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cookbookId: uuid("cookbook_id").references(() => socialCookbooks.id, {
      onDelete: "cascade",
    }),
    actorId: text("actor_id").notNull(),
    recipeId: uuid("recipe_id").references(() => recipes.id, {
      onDelete: "set null",
    }),
    kind: text("kind").notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    photoData: text("photo_data"),
    createdAt: created(),
  },
  (t) => [
    check(
      "social_activity_kind_check",
      sql`${t.kind} IN ('shared','cooked','alternative')`,
    ),
    index("social_activity_group_idx").on(t.cookbookId, t.createdAt.desc()),
  ],
);
export const socialReports = pgTable(
  "social_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reporterId: text("reporter_id").notNull(),
    targetKind: text("target_kind").notNull(),
    targetId: text("target_id").notNull(),
    cookbookId: uuid("cookbook_id").references(() => socialCookbooks.id, {
      onDelete: "cascade",
    }),
    reason: varchar("reason", { length: 80 }).notNull(),
    details: varchar("details", { length: 240 }).notNull().default(""),
    status: text("status").notNull().default("open"),
    resolvedBy: text("resolved_by"),
    createdAt: created(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    check(
      "social_reports_target_kind_check",
      sql`${t.targetKind} IN ('recipe','alternative','profile','activity')`,
    ),
    check(
      "social_reports_status_check",
      sql`${t.status} IN ('open','dismissed','removed')`,
    ),
    index("social_reports_queue_idx").on(
      t.cookbookId,
      t.status,
      t.createdAt.desc(),
    ),
  ],
);
export const socialRateLimits = pgTable(
  "social_rate_limits",
  {
    actorId: text("actor_id").notNull(),
    bucket: text("bucket").notNull(),
    used: integer("used").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.actorId, t.bucket] })],
);

export const socialIdentities = pgTable("social_identities", {
  userId: text("user_id").primaryKey(),
  publicId: uuid("public_id").notNull().defaultRandom().unique(),
});
