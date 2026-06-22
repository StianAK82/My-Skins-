---
name: my-skins DB schema push
description: The app's Postgres is separate from the executeSql tool DB; how to fix an empty/unmigrated schema.
---

# my-skins database: two different Postgres instances

The `my-skins` app + `api-server` connect via `process.env.DATABASE_URL`, which points at
host `helium` / db `heliumdb`. The `executeSql` code-execution tool connects to the
Replit-managed Postgres — a **different** database. Querying `users` via `executeSql`
returns "relation does not exist" even when the app DB has it, and vice versa.

**How to apply:** To inspect or migrate the app's real DB, use `psql "$DATABASE_URL" ...`
or `drizzle-kit push`, NOT the `executeSql` tool.

## Empty-schema symptom (login 500s)
If `/api/callback` returns 500 with "users table is missing external identity columns
(auth_provider, auth_provider_user_id)", the real cause may be that the **entire schema
was never pushed** — the app DB had zero tables. `ensureAuthSchemaReady` throws that same
misleading message whenever the column check fails, including when the `users` table is
absent entirely.

**Fix:** `pnpm --filter @workspace/db run push` (drizzle-kit push) creates all tables from
`lib/db/src/schema`. There is NO `build` script for lib packages — they're consumed
directly via tsx/esbuild bundling, so `tsc -p` in api-server shows pre-existing TS6305
"output not built" reference errors that are unrelated to your changes.

**Why:** A fresh/reset app DB starts empty; nothing auto-migrates on boot. drizzle-kit push
is the source of truth for schema creation here.
