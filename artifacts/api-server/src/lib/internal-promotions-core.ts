import { createHmac } from "node:crypto";
import { z } from "zod";

export const promotionModeSchema = z.enum(["TWO_D", "THREE_D"]);
export const promotionGrantSchema = z
  .object({
    creditType: z.enum([
      "GENERATION_2D",
      "GENERATION_3D",
      "EXPORT_2D",
      "EXPORT_3D",
      "ROBLOX_DELIVERY_2D",
      "ROBLOX_DELIVERY_3D",
    ]),
    quantity: z.number().int().min(1).max(100),
    expiresAt: z.string().datetime().optional(),
    assetModeRestriction: z.enum(["TWO_D", "THREE_D", "EITHER"]).optional(),
  })
  .strict();
export const promotionGrantsSchema = z
  .array(promotionGrantSchema)
  .min(1)
  .max(12);

export type PromotionMode = z.infer<typeof promotionModeSchema>;
export type PromotionGrant = z.infer<typeof promotionGrantSchema>;
export type CampaignRejection =
  | "PROMO_DISABLED"
  | "PROMO_NOT_STARTED"
  | "PROMO_EXPIRED"
  | "PROMO_TOTAL_LIMIT_REACHED"
  | "PROMO_USER_LIMIT_REACHED";
export function evaluatePromotionCampaign(input: {
  active: boolean;
  disabledAt?: Date | null;
  startsAt?: Date | null;
  expiresAt?: Date | null;
  maximumTotalRedemptions?: number | null;
  currentRedemptions: number;
  maximumRedemptionsPerUser: number;
  userRedemptions: number;
  now?: Date;
}): CampaignRejection | null {
  const now = input.now ?? new Date();
  if (!input.active || input.disabledAt) return "PROMO_DISABLED";
  if (input.startsAt && now < input.startsAt) return "PROMO_NOT_STARTED";
  if (input.expiresAt && now >= input.expiresAt) return "PROMO_EXPIRED";
  if (
    input.maximumTotalRedemptions != null &&
    input.currentRedemptions >= input.maximumTotalRedemptions
  )
    return "PROMO_TOTAL_LIMIT_REACHED";
  if (input.userRedemptions >= input.maximumRedemptionsPerUser)
    return "PROMO_USER_LIMIT_REACHED";
  return null;
}

export function normalizePromotionCode(value: string): string {
  const normalized = value.trim().normalize("NFKC").toUpperCase();
  if (normalized.length < 4 || normalized.length > 48)
    throw new Error("invalid promotion code");
  if (!/^[A-Z0-9][A-Z0-9_-]*$/.test(normalized))
    throw new Error("invalid promotion code");
  return normalized;
}

export function hashPromotionCode(
  normalizedCode: string,
  pepper: string,
): string {
  if (pepper.length < 32) throw new Error("promotion pepper is not configured");
  return createHmac("sha256", pepper)
    .update(normalizedCode, "utf8")
    .digest("hex");
}

export function resolvePromotionGrants(
  grants: PromotionGrant[],
  selectedMode?: PromotionMode,
) {
  return promotionGrantsSchema.parse(grants).map((grant) => {
    if (grant.assetModeRestriction === "EITHER" && !selectedMode)
      throw new Error("PROMO_MODE_REQUIRED");
    const mode =
      grant.assetModeRestriction === "EITHER"
        ? selectedMode
        : grant.assetModeRestriction;
    if (mode && selectedMode && mode !== selectedMode)
      throw new Error("PROMO_MODE_NOT_ALLOWED");
    return {
      creditType: mode
        ? grant.creditType.replace(
            /_(?:2D|3D)$/,
            mode === "TWO_D" ? "_2D" : "_3D",
          )
        : grant.creditType,
      quantity: grant.quantity,
      expiresAt: grant.expiresAt ? new Date(grant.expiresAt) : undefined,
    };
  });
}

export function genericPromotionMessage() {
  return "This code cannot be used.";
}
export function isPromotionAdmin(
  userId: string,
  allowlist = process.env.PROMOTION_ADMIN_USER_IDS ?? "",
) {
  return allowlist
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
    .includes(userId);
}
