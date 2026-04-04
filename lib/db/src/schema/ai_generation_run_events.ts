import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const aiGenerationRunEventsTable = pgTable("ai_generation_run_events", {
  id: text("id").primaryKey(),
  runId: text("run_id").notNull(),
  status: text("status").notNull(),
  message: text("message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
