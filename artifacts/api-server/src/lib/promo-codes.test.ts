import test from "node:test";
import assert from "node:assert/strict";
import { promoCodeRecordSchema, validatePromoCode } from "./promo-codes.ts";

const base = promoCodeRecordSchema.parse({
  id: "promo-1",
  code: "BETA50",
  active: true,
  discountType: "percent",
  discountPercent: 50,
  discountAmountMinor: null,
  usageLimit: 100,
  perUserLimit: 1,
  validFrom: new Date("2026-01-01T00:00:00.000Z"),
  validUntil: new Date("2026-12-31T23:59:59.000Z"),
  applicableTarget: "roblox_upload_credit",
  metadata: { campaign: "launch-beta" },
});

test("validatePromoCode applies percent discount for Roblox upload credit", () => {
  const result = validatePromoCode(base, {
    code: "BETA50",
    target: "roblox_upload_credit",
    subtotalMinor: 1000,
    now: new Date("2026-04-01T12:00:00.000Z"),
    totalRedemptions: 3,
    userRedemptions: 0,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.discountMinor, 500);
  assert.equal(result.finalTotalMinor, 500);
});

test("validatePromoCode rejects mismatched target and expired windows", () => {
  const mismatch = validatePromoCode(base, {
    code: "BETA50",
    target: "subscription_plan",
    subtotalMinor: 1000,
  });
  assert.equal(mismatch.ok, false);
  if (!mismatch.ok) assert.equal(mismatch.reason, "target_mismatch");

  const expired = validatePromoCode(base, {
    code: "BETA50",
    target: "roblox_upload_credit",
    subtotalMinor: 1000,
    now: new Date("2027-01-01T00:00:00.000Z"),
  });
  assert.equal(expired.ok, false);
  if (!expired.ok) assert.equal(expired.reason, "expired");
});

test("validatePromoCode enforces usage and per-user limits", () => {
  const usageLimited = validatePromoCode(base, {
    code: "BETA50",
    target: "roblox_upload_credit",
    subtotalMinor: 1000,
    totalRedemptions: 100,
    userRedemptions: 0,
  });
  assert.equal(usageLimited.ok, false);
  if (!usageLimited.ok) assert.equal(usageLimited.reason, "usage_limit_reached");

  const perUserLimited = validatePromoCode(base, {
    code: "BETA50",
    target: "roblox_upload_credit",
    subtotalMinor: 1000,
    totalRedemptions: 5,
    userRedemptions: 1,
  });
  assert.equal(perUserLimited.ok, false);
  if (!perUserLimited.ok) assert.equal(perUserLimited.reason, "per_user_limit_reached");
});
