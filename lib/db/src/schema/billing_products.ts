import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const billingProductsTable = pgTable("billing_products", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull().default("stripe"),
  providerProductId: text("provider_product_id").notNull().unique(),
  name: text("name").notNull(),
  active: text("active").notNull().default("true"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
