import { z } from "zod";
export const uuid = z.string().uuid();
const text = (max: number) => z.string().trim().min(1).max(max);
export const commands = {
  profile: z
    .object({ name: text(60), bio: z.string().trim().max(240) })
    .strict(),
  createCookbook: z.object({ name: text(60) }).strict(),
  cookbook: z
    .object({ id: uuid, offset: z.number().int().min(0).max(10000).default(0) })
    .strict(),
  renameCookbook: z.object({ id: uuid, name: text(60) }).strict(),
  archiveCookbook: z.object({ id: uuid }).strict(),
  invite: z
    .object({
      id: uuid,
      email: z.string().email().max(254).nullable(),
      role: z.enum(["Administrator", "Member"]),
    })
    .strict(),
  acceptInvite: z.object({ token: z.string().regex(/^[\w-]{43}$/) }).strict(),
  revokeInvite: z.object({ id: uuid, inviteId: uuid }).strict(),
  member: z
    .object({
      id: uuid,
      userId: text(200),
      action: z.enum(["remove", "administrator", "member", "transfer"]),
    })
    .strict(),
  leave: z.object({ id: uuid }).strict(),
  destinations: z
    .object({
      recipeId: uuid,
      discover: z.boolean(),
      cookbookIds: z.array(uuid).max(50),
      cuisine: z.string().trim().max(60).optional(),
    })
    .strict(),
  sharing: z.object({ recipeId: uuid }).strict(),
  feed: z
    .object({
      tab: z.enum(["discover", "profile", "following"]),
      userId: text(200).optional(),
      offset: z.number().int().min(0).max(10000).default(0),
      query: z.string().trim().max(120).optional(),
      cuisine: z.string().trim().max(60).optional(),
      maxMinutes: z.number().int().min(1).max(1440).optional(),
    })
    .strict(),
  recipe: z.object({ recipeId: uuid, cookbookId: uuid.optional() }).strict(),
  save: z
    .object({
      recipeId: uuid,
      cookbookId: uuid.optional(),
      alternativeId: uuid.optional(),
      idempotencyKey: uuid,
    })
    .strict(),
  alternative: z
    .object({
      recipeId: uuid,
      cookbookId: uuid,
      ingredientId: uuid,
      revision: text(100),
      quantity: z.string().trim().max(80).nullable(),
      unit: z.string().trim().max(60).nullable(),
      name: text(160),
      note: z.string().trim().max(240),
    })
    .strict(),
  removeAlternative: z.object({ id: uuid, cookbookId: uuid }).strict(),
  endorse: z
    .object({ id: uuid, cookbookId: uuid, enabled: z.boolean() })
    .strict(),
  react: z.object({ recipeId: uuid, enabled: z.boolean() }).strict(),
  follow: z.object({ userId: text(200), enabled: z.boolean() }).strict(),
  block: z.object({ userId: text(200), enabled: z.boolean() }).strict(),
  cooked: z.object({ recipeId: uuid, cookbookId: uuid.optional() }).strict(),
  report: z
    .object({
      kind: z.enum(["recipe", "alternative", "profile", "activity"]),
      targetId: text(200),
      cookbookId: uuid.optional(),
      reason: z.enum(["Abuse", "Unsafe content", "Spam", "Copyright", "Other"]),
      details: z.string().trim().max(240),
    })
    .strict(),
  reports: z.object({ cookbookId: uuid.optional() }).strict(),
  resolve: z
    .object({ id: uuid, action: z.enum(["dismiss", "remove"]) })
    .strict(),
};
export type Command = keyof typeof commands;
export function parseCommand(operation: string, input: unknown) {
  const schema = commands[operation as Command];
  if (!schema) throw Error("Unknown action.");
  return schema.parse(input);
}
export const readCommands = new Set([
  "cookbook",
  "sharing",
  "feed",
  "recipe",
  "reports",
]);
