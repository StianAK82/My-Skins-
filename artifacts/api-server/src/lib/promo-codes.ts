import { z } from "zod";

export const promoTargetSchema = z.enum(["roblox_upload_credit", "subscription_plan", "beta_invite"]);

export const promoCodeRecordSchema = z.object({
  id: z.string(),
  code: z.string().min(1),
  active: z.boolean(),
  campaignName: z.string().nullable().optional(),
  discountType: z.enum(["percent", "fixed_amount"]),
  discountPercent: z.number().int().min(1).max(100).nullable().optional(),
  discountAmountMinor: z.number().int().min(1).nullable().optional(),
  currency: z.string().nullable().optional(),
  usageLimit: z.number().int().positive().nullable().optional(),
  perUserLimit: z.number().int().positive().nullable().optional(),
  validFrom: z.date().nullable().optional(),
  validUntil: z.date().nullable().optional(),
  applicableTarget: promoTargetSchema,
  metadata: z.record(z.string(), z.unknown()).default({}),
}).strict();

export const promoValidationInputSchema = z.object({
  code: z.string().min(1),
  target: promoTargetSchema,
  subtotalMinor: z.number().int().nonnegative(),
  now: z.date().default(() => new Date()),
  totalRedemptions: z.number().int().nonnegative().default(0),
  userRedemptions: z.number().int().nonnegative().default(0),
});

export type PromoCodeRecord = z.infer<typeof promoCodeRecordSchema>;
export type PromoValidationInput = z.input<typeof promoValidationInputSchema>;

export type PromoValidationResult =
  | {
      ok: true;
      code: string;
      discountMinor: number;
      finalTotalMinor: number;
      target: z.infer<typeof promoTargetSchema>;
    }
  | {
      ok: false;
      code: string;
      reason:
        | "not_active"
        | "not_started"
        | "expired"
        | "target_mismatch"
        | "usage_limit_reached"
        | "per_user_limit_reached"
        | "invalid_discount";
    };

export function validatePromoCode(record: PromoCodeRecord, input: PromoValidationInput): PromoValidationResult {
  const normalized = promoValidationInputSchema.parse(input);

  if (!record.active) return { ok: false, code: record.code, reason: "not_active" };
  if (record.applicableTarget !== normalized.target) return { ok: false, code: record.code, reason: "target_mismatch" };
  if (record.validFrom && normalized.now < record.validFrom) return { ok: false, code: record.code, reason: "not_started" };
  if (record.validUntil && normalized.now > record.validUntil) return { ok: false, code: record.code, reason: "expired" };
  if (typeof record.usageLimit === "number" && normalized.totalRedemptions >= record.usageLimit) {
    return { ok: false, code: record.code, reason: "usage_limit_reached" };
  }
  if (typeof record.perUserLimit === "number" && normalized.userRedemptions >= record.perUserLimit) {
    return { ok: false, code: record.code, reason: "per_user_limit_reached" };
  }

  const discountMinor = record.discountType === "percent"
    ? Math.floor((normalized.subtotalMinor * (record.discountPercent ?? 0)) / 100)
    : (record.discountAmountMinor ?? 0);
  if (!Number.isFinite(discountMinor) || discountMinor <= 0) {
    return { ok: false, code: record.code, reason: "invalid_discount" };
  }

  const boundedDiscount = Math.min(discountMinor, normalized.subtotalMinor);
  return {
    ok: true,
    code: record.code,
    target: normalized.target,
    discountMinor: boundedDiscount,
    finalTotalMinor: Math.max(0, normalized.subtotalMinor - boundedDiscount),
  };
}
