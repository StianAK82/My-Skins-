CREATE TABLE IF NOT EXISTS "ai_design_feedback" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "generation_hash" text NOT NULL,
  "garment_key" text NOT NULL,
  "issues" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "accepted" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "ai_design_feedback_garment_created_idx" ON "ai_design_feedback" ("garment_key", "created_at");

