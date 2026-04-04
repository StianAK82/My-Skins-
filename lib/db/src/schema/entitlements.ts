import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const entitlementsTable = pgTable("entitlements", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  key: text("key").notNull(),
  source: text("source").notNull(),
  status: text("status").notNull().default("active"),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
