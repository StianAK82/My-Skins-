import { createHmac } from "node:crypto";
import { z } from "zod";

export const promotionModeSchema = z.enum(["TWO_D", "THREE_D"]);
export const promotionGrantSchema = z
  .object({
    family: z.enum(["GENERATION", "EXPORT", "ROBLOX_DELIVERY"]),
    mode: z.enum(["TWO_D", "THREE_D", "SELECTED"]),
    quantity: z.number().int().min(1).max(100),
    expiresAt: z.string().datetime().optional(),
  })
  .strict();
export const promotionGrantsSchema = z
  .array(promotionGrantSchema)
  .min(1)
  .max(12);

export type PromotionMode = z.infer<typeof promotionModeSchema>;
export type PromotionGrant = z.infer<typeof promotionGrantSchema>;

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
    const mode = grant.mode === "SELECTED" ? selectedMode : grant.mode;
    if (!mode) throw new Error("PROMO_MODE_REQUIRED");
    return {
      creditType: `${grant.family}_${mode === "TWO_D" ? "2D" : "3D"}` as const,
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
