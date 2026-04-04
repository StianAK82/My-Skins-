import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const aiGenerationsTable = pgTable("ai_generations", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  projectId: text("project_id"),
  prompt: text("prompt").notNull(),
  result: text("result").notNull(),
  style: text("style"),
  type: text("type"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAiGenerationSchema = createInsertSchema(aiGenerationsTable).omit({ createdAt: true });
export type InsertAiGeneration = typeof aiGenerationsTable.$inferInsert;
export type AiGeneration = typeof aiGenerationsTable.$inferSelect;
