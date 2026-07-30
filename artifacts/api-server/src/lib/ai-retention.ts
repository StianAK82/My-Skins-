import { and, isNull, lte, or } from "drizzle-orm";

/**
 * Data-minimization retention for ai_generations.
 *
 * Every stored generation gets a retention deadline (`retention_until`) at
 * save time; a periodic sweeper deletes rows past that deadline. Legacy rows
 * saved before the column existed (retention_until IS NULL) are handled by
 * falling back to created_at + RETENTION_DAYS.
 */

export const RETENTION_DAYS = 90;

export interface AiRetentionRepository {
  deleteExpired(now: Date, legacyCutoff: Date): Promise<number>;
}

export async function createProductionAiRetentionRepository(): Promise<AiRetentionRepository> {
  const { aiGenerationsTable, db } = await import("@workspace/db");
  return {
    async deleteExpired(now, legacyCutoff) {
      const deleted = await db.delete(aiGenerationsTable).where(or(
        lte(aiGenerationsTable.retentionUntil, now),
        and(isNull(aiGenerationsTable.retentionUntil), lte(aiGenerationsTable.createdAt, legacyCutoff)),
      )).returning({ id: aiGenerationsTable.id });
      return deleted.length;
    },
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function computeRetentionUntil(now: Date = new Date(), retentionDays: number = RETENTION_DAYS): Date {
  return new Date(now.getTime() + retentionDays * DAY_MS);
}

/**
 * Pure deletion decision used by the sweeper (unit-testable without a DB).
 * A row is expired when its retention deadline has passed; rows without a
 * deadline fall back to created_at + retentionDays.
 */
export function isGenerationExpired(
  row: { retentionUntil: Date | null; createdAt: Date },
  now: Date = new Date(),
  retentionDays: number = RETENTION_DAYS,
): boolean {
  const deadline = row.retentionUntil ?? new Date(row.createdAt.getTime() + retentionDays * DAY_MS);
  return deadline.getTime() <= now.getTime();
}

/** Delete all ai_generations rows past their retention deadline. Returns the deleted count. */
export async function sweepExpiredAiGenerations(now: Date = new Date(), repository?: AiRetentionRepository): Promise<number> {
  const legacyCutoff = new Date(now.getTime() - RETENTION_DAYS * DAY_MS);
  const activeRepository = repository ?? await createProductionAiRetentionRepository();
  return activeRepository.deleteExpired(now, legacyCutoff);
}

const SWEEP_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours

/** Start the periodic retention sweeper. Runs once at startup, then on an interval. */
export function startAiRetentionSweeper(): void {
  const run = async () => {
    try {
      const deleted = await sweepExpiredAiGenerations();
      if (deleted > 0) console.info("ai.retention.swept", { deleted });
    } catch (error) {
      console.error("ai.retention.sweep_failed", { error });
    }
  };
  void run();
  const timer = setInterval(run, SWEEP_INTERVAL_MS);
  timer.unref?.();
}
