# Omnicook community

Community is integrated into the original application. The local-only prototype at `/social-preview` is not part of this release.

- Family contains invite-only shared cookbooks, members, invitations, activity and ingredient alternatives.
- Discover contains explicit public snapshots, ingredient/title search, contributor-supplied cuisine and known cooking-time filters.
- My feed is the user's public profile. Public profile IDs are separate from authentication IDs.
- A recipe's Share control selects member cookbooks and/or Discover. Removing every destination makes it private. Saving Discover explicitly refreshes the public snapshot; removing Discover revokes JSON and photo access.
- Saved/adapted copies retain structured quantities, photos, credits and immutable attribution. Private-derived copies cannot expand their audience without root ownership. Using an alternative modifies only a new owned copy.
- Public free-text comments are absent. Reports persist; cookbook administrators handle private reports and configured verified moderators handle public reports. Blocking filters signed-in interactions.

## Configuration and migrations

`SOCIAL_ENABLED` enables the integration after the additive migration. `SOCIAL_MODERATOR_EMAILS` is server-only. Public publishing additionally requires a configured account with a verified email in the same Neon Auth branch; an empty config or unverified moderator fails closed. Optional email OTP verification is available in My kitchen. Provider verification settings and existing sign-in requirements remain unchanged.

`SOCIAL_TOKEN_SECRET` can be a dedicated stable encryption key; otherwise the existing server auth cookie secret encrypts retrievable high-entropy tokens. Only hashes are indexed for public/invitation lookup. Do not rotate this key casually.

Use `scripts/migrate-social.mjs` only with an explicitly verified integration env and direct host. Production uses `scripts/migrate-social-production.mjs` with the explicit `--apply-production` flag, a verified direct host and an env file containing `DATABASE_URL_UNPOOLED`. Create a recovery branch and capture original business-table hashes before production migration; compare them afterwards with `scripts/social-integrity.mjs`. Never use unreviewed `db:push` against production.

## Verification

`npm test` runs pure regressions. `npm run test:social` runs real database privacy checks and `npm run test:social:http` tests actual authenticated routes with disposable accounts. These integration scripts are intentionally pinned to the verified integration branch and local port3040. They refuse production endpoints. `--keep` on the HTTP script retains disposable fixtures for browser QA and records credentials only in the git-ignored execution workspace; remove those exact fixtures afterwards.

Use `npx next build --webpack` on this Windows worktree. Existing dependencies are shared through a junction, which Turbopack cannot reliably follow. Production migrations are additive; the original private recipe/import/editor/photo/collection/AI/planning/nutrition/shopping APIs retain their ownership boundaries.
