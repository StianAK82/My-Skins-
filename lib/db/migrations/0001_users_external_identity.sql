ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "auth_provider" varchar,
  ADD COLUMN IF NOT EXISTS "auth_provider_user_id" varchar;

CREATE UNIQUE INDEX IF NOT EXISTS "users_auth_provider_subject_uidx"
  ON "users" ("auth_provider", "auth_provider_user_id");
