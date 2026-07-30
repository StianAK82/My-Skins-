-- SafetyGateway data minimization: store the prompt hash and policy decision
-- alongside each AI generation. Both are nullable (older rows have neither).
ALTER TABLE ai_generations ADD COLUMN IF NOT EXISTS prompt_hash text;
ALTER TABLE ai_generations ADD COLUMN IF NOT EXISTS safety_decision text;
