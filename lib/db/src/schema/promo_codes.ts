import { sql } from "drizzle-orm";
import { boolean, integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const promoCodesTable = pgTable("promo_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  active: boolean("active").notNull().default(true),
  campaignName: text("campaign_name"),
  discountType: text("discount_type", { enum: ["percent", "fixed_amount"] }).notNull(),
  discountPercent: integer("discount_percent"),
  discountAmountMinor: integer("discount_amount_minor"),
  currency: text("currency"),
  usageLimit: integer("usage_limit"),
  perUserLimit: integer("per_user_limit"),
  validFrom: timestamp("valid_from", { withTimezone: true }),
  validUntil: timestamp("valid_until", { withTimezone: true }),
  applicableTarget: text("applicable_target").notNull().default("roblox_upload_credit"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PromoCode = typeof promoCodesTable.$inferSelect;
export type InsertPromoCode = typeof promoCodesTable.$inferInsert;
