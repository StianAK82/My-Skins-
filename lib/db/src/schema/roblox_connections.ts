import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const robloxConnectionsTable = pgTable("roblox_connections", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  robloxUserId: text("roblox_user_id").notNull(),
  robloxUsername: text("roblox_username").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRobloxConnectionSchema = createInsertSchema(robloxConnectionsTable).omit({ connectedAt: true });
export type InsertRobloxConnection = typeof robloxConnectionsTable.$inferInsert;
export type RobloxConnection = typeof robloxConnectionsTable.$inferSelect;
