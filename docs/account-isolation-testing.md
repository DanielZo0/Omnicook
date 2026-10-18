# Account isolation integration test

`npm run test:isolation` exercises the local HTTP API using two real temporary
Neon Auth accounts and the database configured in `.env.local`.

Start the app in one terminal:

```powershell
npm run dev -- --hostname 127.0.0.1 --port 3018
```

Run the test in another terminal:

```powershell
npm run test:isolation
```

Neon trusts `http://127.0.0.1:3018` as of 2026-10-14. If using another local
origin, add that exact origin with `neon neon-auth domain add` on the configured
project/branch. Otherwise browser Google/email sign-in can fail with a 403.
`ISOLATION_TEST_AUTH_ORIGIN` can override the test's Origin header for diagnosis,
but trusting the actual local origin is necessary for browser testing.

The server URL defaults to `http://127.0.0.1:3018`; override it with
`ISOLATION_TEST_BASE_URL`. Remote server URLs are rejected. The database is
real and can be production if `.env.local` points there: the test creates
temporary accounts, collections, recipes (including automatic starter recipes),
and meal-plan entries. It removes only this run's account IDs and business data
in `finally`. If managed auth does not expose `delete-user`, cleanup deletes
the exact temporary ID/email from `neon_auth."user"` using the database owner
connection; dependent auth sessions/accounts cascade. An interrupted process
can leave fixtures, so let the test finish and check its cleanup output.

Coverage includes anonymous requests, both directions of cross-account
reads/edits/deletes, collection assignment, meal-plan recipe ownership,
legacy invalid meal-plan references, nonexistent IDs, and allowed owner actions.
Removing the ownership guards reproduces the original unauthorized writes and
recipe-title disclosure. This tests local source against real services; it does
not verify that the fixes have been deployed.
