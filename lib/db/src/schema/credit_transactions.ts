import { sql } from "drizzle-orm";
import { integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const creditTransactionsTable = pgTable("credit_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  type: text("type", { enum: ["purchase", "usage", "refund"] }).notNull(),
  credits: integer("credits").notNull(),
  amountNok: integer("amount_nok"),
  stripeSessionId: text("stripe_session_id").unique(),
  uploadId: text("upload_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CreditTransaction = typeof creditTransactionsTable.$inferSelect;
export type InsertCreditTransaction = typeof creditTransactionsTable.$inferInsert;
