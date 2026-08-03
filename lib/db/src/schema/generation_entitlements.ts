import { relations } from "drizzle-orm";
import { integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const entitlementCreditType = pgEnum("entitlement_credit_type", ["GENERATION_2D", "GENERATION_3D", "EXPORT_2D", "EXPORT_3D", "ROBLOX_DELIVERY_2D", "ROBLOX_DELIVERY_3D"]);
export const entitlementTransactionType = pgEnum("entitlement_transaction_type", ["FREE_FIRST_SKIN", "PURCHASE", "PROMOTION", "ADMIN_GRANT", "RESERVATION", "CAPTURE", "RELEASE", "REFUND", "EXPIRATION", "CHARGEBACK_REVERSAL", "SUPPORT_ADJUSTMENT"]);
export const entitlementTransactionStatus = pgEnum("entitlement_transaction_status", ["POSTED", "REVERSED"]);
export const generationReservationStatus = pgEnum("generation_reservation_status", ["ACTIVE", "CAPTURED", "RELEASED", "EXPIRED"]);

export const entitlementAccountsTable = pgTable("entitlement_accounts", {
  userId: varchar("user_id").primaryKey().references(() => usersTable.id), freeFirstGrantedAt: timestamp("free_first_granted_at", { withTimezone: true }), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const entitlementTransactionsTable = pgTable("entitlement_transactions", {
  transactionId: uuid("transaction_id").primaryKey().defaultRandom(), userId: varchar("user_id").notNull().references(() => usersTable.id), creditType: entitlementCreditType("credit_type").notNull(), transactionType: entitlementTransactionType("transaction_type").notNull(), quantity: integer("quantity").notNull(), source: text("source").notNull(), sourceId: text("source_id").notNull(), idempotencyKey: text("idempotency_key").notNull(), generationId: text("generation_id"), artifactId: text("artifact_id"), stripeCheckoutSessionId: text("stripe_checkout_session_id"), stripePaymentIntentId: text("stripe_payment_intent_id"), promotionCodeId: uuid("promotion_code_id"), status: entitlementTransactionStatus("status").notNull().default("POSTED"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), expiresAt: timestamp("expires_at", { withTimezone: true }), reversedByTransactionId: uuid("reversed_by_transaction_id"), metadata: jsonb("metadata").notNull().default({}),
}, (t) => [uniqueIndex("entitlement_idempotency_uidx").on(t.idempotencyKey)]);
export const generationCreditReservationsTable = pgTable("generation_credit_reservations", {
  reservationId: uuid("reservation_id").primaryKey().defaultRandom(), userId: varchar("user_id").notNull().references(() => usersTable.id), generationId: text("generation_id").notNull(), clientRequestId: text("client_request_id").notNull(), idempotencyKey: text("idempotency_key").notNull(), requestedMode: text("requested_mode").notNull(), creditType: entitlementCreditType("credit_type").notNull(), quantity: integer("quantity").notNull(), policyVersion: text("policy_version").notNull(), reservationTransactionId: uuid("reservation_transaction_id").notNull(), finalizationTransactionId: uuid("finalization_transaction_id"), status: generationReservationStatus("status").notNull().default("ACTIVE"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), finalizedAt: timestamp("finalized_at", { withTimezone: true }),
}, (t) => [uniqueIndex("generation_reservation_generation_uidx").on(t.generationId), uniqueIndex("generation_reservation_idempotency_uidx").on(t.idempotencyKey), uniqueIndex("generation_request_once_per_user").on(t.userId,t.clientRequestId)]);
