CREATE TYPE entitlement_credit_type AS ENUM ('GENERATION_2D','GENERATION_3D','EXPORT_2D','EXPORT_3D','ROBLOX_DELIVERY_2D','ROBLOX_DELIVERY_3D');
CREATE TYPE entitlement_transaction_type AS ENUM ('FREE_FIRST_SKIN','PURCHASE','PROMOTION','ADMIN_GRANT','RESERVATION','CAPTURE','RELEASE','REFUND','EXPIRATION','CHARGEBACK_REVERSAL','SUPPORT_ADJUSTMENT');
CREATE TYPE entitlement_transaction_status AS ENUM ('POSTED','REVERSED');
CREATE TYPE generation_reservation_status AS ENUM ('ACTIVE','CAPTURED','RELEASED','EXPIRED');

CREATE TABLE entitlement_accounts (
  user_id varchar PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
  free_first_granted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE entitlement_transactions (
  transaction_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  credit_type entitlement_credit_type NOT NULL,
  transaction_type entitlement_transaction_type NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  source text NOT NULL CHECK (length(source) BETWEEN 1 AND 64),
  source_id text NOT NULL CHECK (length(source_id) BETWEEN 1 AND 200),
  idempotency_key text NOT NULL UNIQUE CHECK (length(idempotency_key) BETWEEN 8 AND 200),
  generation_id text,
  artifact_id text,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  promotion_code_id uuid,
  status entitlement_transaction_status NOT NULL DEFAULT 'POSTED',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  reversed_by_transaction_id uuid REFERENCES entitlement_transactions(transaction_id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CHECK (expires_at IS NULL OR expires_at > created_at),
  CHECK (reversed_by_transaction_id IS NULL OR transaction_type IN ('CHARGEBACK_REVERSAL','SUPPORT_ADJUSTMENT')),
  CHECK (octet_length(metadata::text) <= 4096)
);
CREATE UNIQUE INDEX entitlement_one_free_first_per_user ON entitlement_transactions(user_id) WHERE transaction_type='FREE_FIRST_SKIN';

CREATE TABLE generation_credit_reservations (
  reservation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  generation_id text NOT NULL UNIQUE,
  client_request_id text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  requested_mode text NOT NULL CHECK (requested_mode IN ('2D','3D')),
  credit_type entitlement_credit_type NOT NULL CHECK (credit_type IN ('GENERATION_2D','GENERATION_3D')),
  quantity integer NOT NULL CHECK (quantity > 0),
  policy_version text NOT NULL,
  reservation_transaction_id uuid NOT NULL UNIQUE REFERENCES entitlement_transactions(transaction_id),
  finalization_transaction_id uuid UNIQUE REFERENCES entitlement_transactions(transaction_id),
  status generation_reservation_status NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  finalized_at timestamptz,
  CHECK (expires_at > created_at),
  CHECK ((status='ACTIVE' AND finalization_transaction_id IS NULL AND finalized_at IS NULL) OR
         (status<>'ACTIVE' AND finalization_transaction_id IS NOT NULL AND finalized_at IS NOT NULL))
);
CREATE UNIQUE INDEX generation_one_active_reservation ON generation_credit_reservations(generation_id) WHERE status='ACTIVE';
CREATE UNIQUE INDEX generation_request_once_per_user ON generation_credit_reservations(user_id, client_request_id);

-- Durable idempotency projection. The provider response is stored outside the
-- accounting ledger so replay never adds transactions or invokes a provider.
CREATE TABLE generation_request_results (
  generation_id text PRIMARY KEY REFERENCES generation_credit_reservations(generation_id) ON DELETE RESTRICT,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  state text NOT NULL CHECK (state IN ('IN_PROGRESS','COMPLETED','FAILED')),
  response jsonb,
  safe_error jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK ((state='IN_PROGRESS' AND response IS NULL AND safe_error IS NULL AND completed_at IS NULL) OR
         (state='COMPLETED' AND response IS NOT NULL AND safe_error IS NULL AND completed_at IS NOT NULL) OR
         (state='FAILED' AND response IS NULL AND safe_error IS NOT NULL AND completed_at IS NOT NULL))
);
CREATE INDEX generation_request_results_user_idx ON generation_request_results(user_id, created_at DESC);

-- Ledger rows are immutable. Corrections are appended as reversal transactions.
CREATE FUNCTION reject_entitlement_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  RAISE EXCEPTION 'entitlement ledger is append-only';
END $$;
CREATE TRIGGER entitlement_transactions_no_update_delete BEFORE UPDATE OR DELETE ON entitlement_transactions FOR EACH ROW EXECUTE FUNCTION reject_entitlement_mutation();
