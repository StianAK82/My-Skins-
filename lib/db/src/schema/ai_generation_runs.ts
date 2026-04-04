import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const aiGenerationRunsTable = pgTable("ai_generation_runs", {
  id: text("id").primaryKey(),
  generationId: text("generation_id").notNull(),
  userId: text("user_id").notNull(),
  status: text("status").notNull().default("queued"),
  provider: text("provider").notNull().default("openai"),
  model: text("model").notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});
