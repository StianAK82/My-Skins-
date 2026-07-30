import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const aiGenerationsTable = pgTable("ai_generations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  projectId: text("project_id"),
  // Data minimization: `prompt` holds the NORMALIZED SAFE form produced by the
  // SafetyGateway (never the raw child prompt when it referenced protected IP).
  prompt: text("prompt").notNull(),
  promptHash: text("prompt_hash"),
  safetyDecision: text("safety_decision"),
  result: text("result").notNull(),
  style: text("style"),
  type: text("type"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAiGenerationSchema = createInsertSchema(aiGenerationsTable).omit({ createdAt: true });
export type InsertAiGeneration = typeof aiGenerationsTable.$inferInsert;
export type AiGeneration = typeof aiGenerationsTable.$inferSelect;
