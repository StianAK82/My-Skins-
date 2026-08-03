export const serverFeatureFlags = Object.freeze({
  internalPromotions: process.env.INTERNAL_PROMOTIONS_ENABLED === "true",
  stripePurchase:
    process.env.STRIPE_PURCHASES_ENABLED === "true" ||
    process.env.FEATURE_STRIPE_PURCHASE === "true",
  robloxOAuth:
    process.env.ROBLOX_OAUTH_ENABLED === "true" ||
    process.env.FEATURE_ROBLOX_OAUTH === "true",
  robloxDelivery:
    process.env.ROBLOX_DELIVERY_ENABLED === "true" ||
    process.env.FEATURE_ROBLOX_DELIVERY === "true",
  marketplace: process.env.MARKETPLACE_ENABLED === "true",
  production3dExport: process.env.PRODUCTION_3D_EXPORT_ENABLED === "true",
});

export function validateFeatureConfiguration() {
  if (serverFeatureFlags.internalPromotions) {
    if ((process.env.PROMOTION_CODE_PEPPER ?? "").length < 32)
      throw new Error(
        "PROMOTION_CODE_PEPPER must be at least 32 characters when internal promotions are enabled",
      );
    if (!(process.env.PROMOTION_ADMIN_USER_IDS ?? "").trim())
      throw new Error(
        "PROMOTION_ADMIN_USER_IDS is required when internal promotions are enabled",
      );
  }
}
