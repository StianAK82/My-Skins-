import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { usersTable } from "./auth";
export const promotionAssetMode = pgEnum("promotion_asset_mode", [
  "TWO_D",
  "THREE_D",
  "EITHER",
]);
export const promotionRedemptionStatus = pgEnum("promotion_redemption_status", [
  "COMPLETED",
  "REVERSED",
]);
export const internalPromotionCampaignsTable = pgTable(
  "internal_promotion_campaigns",
  {
    promotionCodeId: uuid("promotion_code_id").primaryKey().defaultRandom(),
    normalizedCodeHash: text("normalized_code_hash").notNull(),
    maskedDisplayLabel: text("masked_display_label"),
    campaignName: text("campaign_name").notNull(),
    description: text("description").notNull().default(""),
    active: boolean("active").notNull().default(false),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    maximumTotalRedemptions: integer("maximum_total_redemptions"),
    maximumRedemptionsPerUser: integer("maximum_redemptions_per_user")
      .notNull()
      .default(1),
    currentRedemptionProjection: integer("current_redemption_projection")
      .notNull()
      .default(0),
    allowedAssetMode: promotionAssetMode("allowed_asset_mode").notNull(),
    allowedUserIds: text("allowed_user_ids").array(),
    allowedEmailDomains: text("allowed_email_domains").array(),
    grantedCredits: jsonb("granted_credits").notNull(),
    creditExpiresAt: timestamp("credit_expires_at", { withTimezone: true }),
    creditLifetimeSeconds: integer("credit_lifetime_seconds"),
    createdByUserId: varchar("created_by_user_id")
      .notNull()
      .references(() => usersTable.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    metadata: jsonb("metadata").notNull().default({}),
  },
  (t) => [
    uniqueIndex("internal_promotion_code_hash_uidx").on(t.normalizedCodeHash),
  ],
);
export const internalPromotionRedemptionsTable = pgTable(
  "internal_promotion_redemptions",
  {
    redemptionId: uuid("redemption_id").primaryKey().defaultRandom(),
    promotionCodeId: uuid("promotion_code_id")
      .notNull()
      .references(() => internalPromotionCampaignsTable.promotionCodeId),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id),
    idempotencyKey: text("idempotency_key").notNull(),
    selectedMode: promotionAssetMode("selected_mode"),
    redeemedAt: timestamp("redeemed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    status: promotionRedemptionStatus("status").notNull().default("COMPLETED"),
    ledgerTransactionIds: uuid("ledger_transaction_ids").array().notNull(),
    requestId: text("request_id").notNull(),
    safeFailureReason: text("safe_failure_reason"),
    reversedAt: timestamp("reversed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("internal_promotion_redemption_idempotency_uidx").on(
      t.idempotencyKey,
    ),
  ],
);
