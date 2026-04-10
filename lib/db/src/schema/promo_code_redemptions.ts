import { sql } from "drizzle-orm";
import { integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { promoCodesTable } from "./promo_codes";

export const promoCodeRedemptionsTable = pgTable("promo_code_redemptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  promoCodeId: varchar("promo_code_id").notNull().references(() => promoCodesTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  appliedTargetId: text("applied_target_id"),
  discountAmountMinor: integer("discount_amount_minor").notNull(),
  currency: text("currency").notNull().default("nok"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PromoCodeRedemption = typeof promoCodeRedemptionsTable.$inferSelect;
export type InsertPromoCodeRedemption = typeof promoCodeRedemptionsTable.$inferInsert;
