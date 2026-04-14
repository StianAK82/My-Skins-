import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const robloxConnectionsTable = pgTable("roblox_connections", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  robloxUserId: text("roblox_user_id").notNull(),
  robloxUsername: text("roblox_username").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  lastRefreshAt: timestamp("last_refresh_at", { withTimezone: true }),
  lastErrorCode: text("last_error_code"),
  lastErrorMessage: text("last_error_message"),
  tokenInvalidatedAt: timestamp("token_invalidated_at", { withTimezone: true }),
  disconnectedAt: timestamp("disconnected_at", { withTimezone: true }),
  connectedAt: timestamp("connected_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  revokedByUser: boolean("revoked_by_user").notNull().default(false),
});

export const insertRobloxConnectionSchema = createInsertSchema(robloxConnectionsTable).omit({ connectedAt: true, updatedAt: true });
export type InsertRobloxConnection = typeof robloxConnectionsTable.$inferInsert;
export type RobloxConnection = typeof robloxConnectionsTable.$inferSelect;
