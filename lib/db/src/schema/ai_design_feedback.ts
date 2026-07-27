import { boolean, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const aiDesignFeedbackTable = pgTable("ai_design_feedback", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  generationHash: text("generation_hash").notNull(),
  garmentKey: text("garment_key").notNull(),
  issues: jsonb("issues").$type<string[]>().notNull().default([]),
  accepted: boolean("accepted").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
