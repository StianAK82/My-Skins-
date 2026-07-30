-- Retention deadline for data minimization: rows past this timestamp are
-- deleted by the api-server retention sweeper (ai-retention.ts).
ALTER TABLE "ai_generations" ADD COLUMN IF NOT EXISTS "retention_until" timestamp with time zone;
