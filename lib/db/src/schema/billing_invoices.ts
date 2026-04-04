import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const billingInvoicesTable = pgTable("billing_invoices", {
  id: text("id").primaryKey(),
  subscriptionId: text("subscription_id"),
  providerInvoiceId: text("provider_invoice_id").notNull().unique(),
  status: text("status").notNull(),
  amountPaid: integer("amount_paid").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
