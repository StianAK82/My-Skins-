import test from "node:test";
import assert from "node:assert/strict";
import { RETENTION_DAYS, computeRetentionUntil, isGenerationExpired, sweepExpiredAiGenerations, type AiRetentionRepository } from "./ai-retention.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const now = new Date("2026-07-30T12:00:00.000Z");

test("computeRetentionUntil sets deadline RETENTION_DAYS in the future", () => {
  const deadline = computeRetentionUntil(now);
  assert.equal(deadline.getTime(), now.getTime() + RETENTION_DAYS * DAY_MS);
});

test("computeRetentionUntil honors a custom retention window", () => {
  const deadline = computeRetentionUntil(now, 7);
  assert.equal(deadline.getTime(), now.getTime() + 7 * DAY_MS);
});

test("row with a passed retention deadline is expired", () => {
  const row = { retentionUntil: new Date(now.getTime() - 1), createdAt: new Date("2026-01-01T00:00:00Z") };
  assert.equal(isGenerationExpired(row, now), true);
});

test("row with deadline exactly at now is expired (inclusive)", () => {
  const row = { retentionUntil: new Date(now.getTime()), createdAt: new Date("2026-01-01T00:00:00Z") };
  assert.equal(isGenerationExpired(row, now), true);
});

test("row with a future retention deadline is kept", () => {
  const row = { retentionUntil: new Date(now.getTime() + DAY_MS), createdAt: new Date("2020-01-01T00:00:00Z") };
  assert.equal(isGenerationExpired(row, now), false);
});

test("legacy row without deadline falls back to created_at + RETENTION_DAYS", () => {
  const expired = { retentionUntil: null, createdAt: new Date(now.getTime() - (RETENTION_DAYS + 1) * DAY_MS) };
  assert.equal(isGenerationExpired(expired, now), true);

  const fresh = { retentionUntil: null, createdAt: new Date(now.getTime() - (RETENTION_DAYS - 1) * DAY_MS) };
  assert.equal(isGenerationExpired(fresh, now), false);
});

test("retention sweeps deterministically without DATABASE_URL", async () => {
  let received: { now: Date; legacyCutoff: Date } | undefined;
  const repository: AiRetentionRepository = {
    async deleteExpired(sweepNow, legacyCutoff) {
      received = { now: sweepNow, legacyCutoff };
      return 3;
    },
  };
  assert.equal(await sweepExpiredAiGenerations(now, repository), 3);
  assert.equal(received?.now.toISOString(), now.toISOString());
  assert.equal(received?.legacyCutoff.getTime(), now.getTime() - RETENTION_DAYS * DAY_MS);
});
