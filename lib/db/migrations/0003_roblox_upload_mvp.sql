CREATE TABLE IF NOT EXISTS roblox_oauth_states (
  state text PRIMARY KEY,
  user_id text NOT NULL,
  verifier text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roblox_connections (
  id text PRIMARY KEY,
  user_id text NOT NULL UNIQUE,
  roblox_user_id text NOT NULL,
  roblox_username text NOT NULL,
  access_token text,
  refresh_token text,
  token_type text,
  scope text,
  token_expires_at timestamptz,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS roblox_upload_jobs (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  project_id text NOT NULL,
  export_artifact_id text,
  item_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  roblox_asset_id text,
  error_code text,
  error_message text,
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS roblox_upload_events (
  id text PRIMARY KEY,
  upload_job_id text NOT NULL,
  status text NOT NULL,
  message text,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE roblox_connections
  ADD COLUMN IF NOT EXISTS token_type text,
  ADD COLUMN IF NOT EXISTS scope text,
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE roblox_upload_jobs
  ADD COLUMN IF NOT EXISTS export_artifact_id text,
  ADD COLUMN IF NOT EXISTS item_type text,
  ADD COLUMN IF NOT EXISTS error_code text,
  ADD COLUMN IF NOT EXISTS error_message text,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE roblox_upload_jobs SET item_type = COALESCE(item_type, 'shirt') WHERE item_type IS NULL;
ALTER TABLE roblox_upload_jobs ALTER COLUMN item_type SET NOT NULL;

ALTER TABLE roblox_upload_events
  ADD COLUMN IF NOT EXISTS error_code text;
