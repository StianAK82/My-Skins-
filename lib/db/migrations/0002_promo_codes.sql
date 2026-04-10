CREATE TABLE IF NOT EXISTS promo_codes (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  campaign_name text,
  discount_type text NOT NULL CHECK (discount_type IN ('percent', 'fixed_amount')),
  discount_percent integer,
  discount_amount_minor integer,
  currency text,
  usage_limit integer,
  per_user_limit integer,
  valid_from timestamptz,
  valid_until timestamptz,
  applicable_target text NOT NULL DEFAULT 'roblox_upload_credit',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (discount_type = 'percent' AND discount_percent IS NOT NULL AND discount_amount_minor IS NULL)
    OR
    (discount_type = 'fixed_amount' AND discount_amount_minor IS NOT NULL AND discount_percent IS NULL)
  ),
  CHECK (discount_percent IS NULL OR (discount_percent >= 1 AND discount_percent <= 100)),
  CHECK (usage_limit IS NULL OR usage_limit > 0),
  CHECK (per_user_limit IS NULL OR per_user_limit > 0),
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from)
);

CREATE TABLE IF NOT EXISTS promo_code_redemptions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id varchar NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  applied_target_id text,
  discount_amount_minor integer NOT NULL,
  currency text NOT NULL DEFAULT 'nok',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS promo_codes_active_idx ON promo_codes (active, applicable_target);
CREATE INDEX IF NOT EXISTS promo_codes_validity_idx ON promo_codes (valid_from, valid_until);
CREATE INDEX IF NOT EXISTS promo_code_redemptions_code_user_idx ON promo_code_redemptions (promo_code_id, user_id);
