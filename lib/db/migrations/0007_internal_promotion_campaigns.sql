CREATE TYPE promotion_asset_mode AS ENUM ('TWO_D','THREE_D','EITHER');
CREATE TYPE promotion_redemption_status AS ENUM ('COMPLETED','REVERSED');

CREATE TABLE internal_promotion_campaigns (
  promotion_code_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  configuration_version integer NOT NULL DEFAULT 1 CHECK (configuration_version>0),
  normalized_code_hash text NOT NULL UNIQUE CHECK (length(normalized_code_hash)=64),
  masked_display_label text,
  campaign_name text NOT NULL,
  description text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT false,
  starts_at timestamptz,
  expires_at timestamptz,
  maximum_total_redemptions integer CHECK (maximum_total_redemptions IS NULL OR maximum_total_redemptions>0),
  maximum_redemptions_per_user integer NOT NULL DEFAULT 1 CHECK (maximum_redemptions_per_user>0),
  current_redemption_projection integer NOT NULL DEFAULT 0 CHECK (current_redemption_projection>=0),
  allowed_asset_mode promotion_asset_mode NOT NULL,
  allowed_user_ids text[],
  allowed_email_domains text[],
  granted_credits jsonb NOT NULL,
  credit_expires_at timestamptz,
  credit_lifetime_seconds integer CHECK (credit_lifetime_seconds IS NULL OR credit_lifetime_seconds>0),
  created_by_user_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  disabled_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (expires_at IS NULL OR starts_at IS NULL OR expires_at>starts_at),
  CHECK (credit_expires_at IS NULL OR credit_lifetime_seconds IS NULL),
  CHECK (octet_length(metadata::text)<=4096)
);

CREATE TABLE internal_promotion_redemptions (
  redemption_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_code_id uuid NOT NULL REFERENCES internal_promotion_campaigns(promotion_code_id) ON DELETE RESTRICT,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL UNIQUE CHECK (length(idempotency_key) BETWEEN 8 AND 200),
  selected_mode promotion_asset_mode CHECK (selected_mode IS NULL OR selected_mode<>'EITHER'),
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  status promotion_redemption_status NOT NULL DEFAULT 'COMPLETED',
  ledger_transaction_ids uuid[] NOT NULL,
  request_id text NOT NULL,
  safe_failure_reason text,
  reversed_at timestamptz,
  UNIQUE(promotion_code_id,user_id,idempotency_key)
);
CREATE INDEX internal_promotion_redemptions_campaign_user_idx ON internal_promotion_redemptions(promotion_code_id,user_id);
