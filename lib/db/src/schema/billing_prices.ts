import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const billingPricesTable = pgTable("billing_prices", {
  id: text("id").primaryKey(),
  productId: text("product_id").notNull(),
  providerPriceId: text("provider_price_id").notNull().unique(),
  currency: text("currency").notNull().default("nok"),
  amount: integer("amount").notNull(),
  interval: text("interval"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
