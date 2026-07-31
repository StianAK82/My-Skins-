# Production readiness

Required gates are frozen install, typecheck, unit, integration, aggregate test, build, Playwright and `git diff --check`. CI uses Node 24/pnpm 10.28.1 and deterministic fixtures without live AI, Roblox, database, object storage or child data. Real Roblox OAuth/upload, moderation approval and production object storage require external credentials and external verification. Never enable mock upload fallback in production.
