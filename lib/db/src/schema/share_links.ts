import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const shareLinksTable = pgTable("share_links", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  projectId: text("project_id").notNull(),
  userId: text("user_id").notNull(),
  isPublic: boolean("is_public").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertShareLinkSchema = createInsertSchema(shareLinksTable).omit({ createdAt: true });
export type InsertShareLink = z.infer<typeof insertShareLinkSchema>;
export type ShareLink = typeof shareLinksTable.$inferSelect;
