import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const robloxOauthStatesTable = pgTable("roblox_oauth_states", {
  state: text("state").primaryKey(),
  userId: text("user_id").notNull(),
  verifier: text("verifier").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
