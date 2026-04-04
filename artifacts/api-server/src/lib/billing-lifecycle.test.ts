import test from "node:test";
import assert from "node:assert/strict";
import type Stripe from "stripe";
import { normalizeCheckoutCompleted, normalizeInvoice, normalizeSubscriptionUpdate } from "./billing-lifecycle.ts";

test("normalizeCheckoutCompleted keeps plan and subscription id for idempotent lifecycle persistence", () => {
  const session = {
    metadata: { userId: "user-1", plan: "team" },
    subscription: "sub_123",
    client_reference_id: "user-1",
  } as unknown as Stripe.Checkout.Session;

  const normalized = normalizeCheckoutCompleted(session);
  assert.equal(normalized.userId, "user-1");
  assert.equal(normalized.plan, "team");
  assert.equal(normalized.providerSubscriptionId, "sub_123");
});

test("normalizeInvoice extracts string subscription and defaults status", () => {
  const invoice = {
    id: "in_123",
    subscription: "sub_123",
    amount_paid: 1099,
    status: null,
  } as unknown as Stripe.Invoice;

  const normalized = normalizeInvoice(invoice);
  assert.equal(normalized.providerSubscriptionId, "sub_123");
  assert.equal(normalized.status, "open");
  assert.equal(normalized.amountPaid, 1099);
});

test("normalizeSubscriptionUpdate supports sdk shape with current_period_end", () => {
  const subscription = {
    id: "sub_123",
    status: "active",
    current_period_end: 1770000000,
  } as unknown as Stripe.Subscription;

  const normalized = normalizeSubscriptionUpdate(subscription);
  assert.equal(normalized.id, "sub_123");
  assert.equal(normalized.status, "active");
  assert.ok(normalized.currentPeriodEnd instanceof Date);
});
