# Replit Auth Schema Runbook

Use this when diagnosing the auth external-identity rollout on Replit.

## 1) Restart and inspect runtime diagnostics

After a **full Replit restart** (stop + start), inspect logs for:

- `Auth startup diagnostics`

Expected booleans in that log payload:

- `usersColumnsReady: true`
- `usersProviderIndexReady: true`
- `usersIdDbGenerated: true`

## 2) How to map a `false` flag to the missing schema expectation

- `usersColumnsReady: false`
  - Missing one or both `users` columns:
    - `auth_provider`
    - `auth_provider_user_id`
- `usersProviderIndexReady: false`
  - Missing unique index on `users(auth_provider, auth_provider_user_id)`:
    - `users_auth_provider_subject_uidx`
- `usersIdDbGenerated: false`
  - `users.id` default is not DB-generated via:
    - `gen_random_uuid()` or
    - `uuid_generate_v4()`

## 3) Exact repo command to apply DB schema

From repo root:

```bash
pnpm --filter @workspace/db run push
```

This uses Drizzle config in `lib/db/drizzle.config.ts` and requires `DATABASE_URL`.

## 4) Verify DATABASE_URL before pushing

From Replit Shell:

```bash
echo "$DATABASE_URL"
```

If blank, add it in **Replit → Tools → Secrets** as key:

- `DATABASE_URL`

Use the live Postgres connection string value for the running Replit app.

## 5) Restart + verify login after schema apply

1. Run schema push command.
2. Restart app once so startup diagnostics are re-emitted.
3. Confirm all three booleans are `true`.
4. Test login flow (`/login` and callback).

If diagnostics are all true, login should work with external identity lookup mode.
