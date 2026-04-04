import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const billingSubscriptionsTable = pgTable("billing_subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  providerSubscriptionId: text("provider_subscription_id").notNull().unique(),
  status: text("status").notNull(),
  currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
