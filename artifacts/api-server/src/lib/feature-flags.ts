export const serverFeatureFlags = Object.freeze({
  stripePurchase: process.env.FEATURE_STRIPE_PURCHASE === "true",
  robloxOAuth: process.env.FEATURE_ROBLOX_OAUTH === "true",
  robloxDelivery: process.env.FEATURE_ROBLOX_DELIVERY === "true",
  marketplace: false,
  production3dExport: false,
});
