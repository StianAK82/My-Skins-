import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluatePromotionCampaign,
  genericPromotionMessage,
  hashPromotionCode,
  isPromotionAdmin,
  normalizePromotionCode,
  resolvePromotionGrants,
} from "./internal-promotions-core";

test("promotion codes normalize case, whitespace and compatibility Unicode", () =>
  assert.equal(normalizePromotionCode("  free２d "), "FREE2D"));
test("promotion codes reject punctuation, confusable non-ascii and excess length", () => {
  for (const code of ["A B C", "FRЕE2D", "X".repeat(49)])
    assert.throws(() => normalizePromotionCode(code));
});
test("promotion hashing is keyed, stable and does not expose the code", () => {
  const hash = hashPromotionCode("FREE2D", "x".repeat(32));
  assert.equal(hash, hashPromotionCode("FREE2D", "x".repeat(32)));
  assert.equal(hash.length, 64);
  assert.ok(!hash.includes("FREE2D"));
});
test("selectable bundles resolve consistently to one mode", () =>
  assert.deepEqual(
    resolvePromotionGrants(
      [
        {
          creditType: "GENERATION_2D",
          assetModeRestriction: "EITHER",
          quantity: 1,
        },
        {
          creditType: "EXPORT_2D",
          assetModeRestriction: "EITHER",
          quantity: 1,
        },
      ],
      "THREE_D",
    ).map((g) => g.creditType),
    ["GENERATION_3D", "EXPORT_3D"],
  ));
test("selectable bundles require a mode", () =>
  assert.throws(
    () =>
      resolvePromotionGrants([
        {
          creditType: "GENERATION_2D",
          assetModeRestriction: "EITHER",
          quantity: 1,
        },
      ]),
    /PROMO_MODE_REQUIRED/,
  ));
test("customer error mapping does not disclose campaign state", () =>
  assert.equal(genericPromotionMessage(), "This code cannot be used."));
test("admin authorization is explicit allowlist only", () => {
  assert.equal(isPromotionAdmin("u1", "u1,u2"), true);
  assert.equal(isPromotionAdmin("u3", "u1,u2"), false);
});
test("campaign validation enforces windows and limits", () => {
  const base = {
    active: true,
    currentRedemptions: 0,
    maximumRedemptionsPerUser: 1,
    userRedemptions: 0,
    now: new Date("2026-06-01"),
  };
  assert.equal(
    evaluatePromotionCampaign({ ...base, startsAt: new Date("2026-07-01") }),
    "PROMO_NOT_STARTED",
  );
  assert.equal(
    evaluatePromotionCampaign({ ...base, expiresAt: new Date("2026-05-01") }),
    "PROMO_EXPIRED",
  );
  assert.equal(
    evaluatePromotionCampaign({
      ...base,
      maximumTotalRedemptions: 2,
      currentRedemptions: 2,
    }),
    "PROMO_TOTAL_LIMIT_REACHED",
  );
  assert.equal(
    evaluatePromotionCampaign({ ...base, userRedemptions: 1 }),
    "PROMO_USER_LIMIT_REACHED",
  );
});
test("grant validation rejects invalid quantities and types", () => {
  assert.throws(() =>
    resolvePromotionGrants([{ creditType: "GENERATION_2D", quantity: 0 }]),
  );
  assert.throws(() =>
    resolvePromotionGrants([{ creditType: "UNKNOWN", quantity: 1 }] as never),
  );
});
test("individual credit expiry is preserved", () => {
  const [grant] = resolvePromotionGrants([
    {
      creditType: "EXPORT_2D",
      quantity: 1,
      expiresAt: "2026-12-01T00:00:00.000Z",
    },
  ]);
  assert.equal(grant?.expiresAt?.toISOString(), "2026-12-01T00:00:00.000Z");
});
