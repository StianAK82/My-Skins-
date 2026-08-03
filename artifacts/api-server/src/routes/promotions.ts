import { Router, type IRouter } from "express";
import { z } from "zod";
import { serverFeatureFlags } from "../lib/feature-flags";
import {
  isPromotionAdmin,
  promotionModeSchema,
} from "../lib/internal-promotions-core";
import { internalPromotions, PromotionError } from "../lib/internal-promotions";
import { generationEntitlements } from "../lib/generation-entitlements";

const router: IRouter = Router();
const redeemSchema = z
  .object({
    code: z.string().min(1).max(80),
    idempotencyKey: z.string().min(8).max(200),
    selectedMode: promotionModeSchema.optional(),
  })
  .strict();
const attempts = new Map<string, { count: number; reset: number }>();
function rateLimited(key: string) {
  const now = Date.now();
  const prior = attempts.get(key);
  const state =
    !prior || prior.reset <= now
      ? { count: 0, reset: now + 10 * 60_000 }
      : prior;
  state.count += 1;
  attempts.set(key, state);
  return state.count > 10;
}
function requireAdmin(req: any, res: any) {
  if (!req.isAuthenticated() || !isPromotionAdmin(req.user.id)) {
    res.status(403).json({
      code: "PROMO_INVALID",
      message: "This action is not available.",
    });
    return false;
  }
  return true;
}

router.post("/promotions/redeem", async (req, res) => {
  const requestId = String(req.id ?? "request-unknown");
  if (!serverFeatureFlags.internalPromotions) {
    res.status(404).json({
      code: "FEATURE_DISABLED",
      message: "This feature is not available.",
    });
    return;
  }
  if (!req.isAuthenticated()) {
    res.status(401).json({
      code: "AUTH_REQUIRED",
      requestId,
      stage: "authentication",
      retryable: false,
      message: "Please sign in to use a code.",
      diagnosticCode: "SESSION_REQUIRED",
    });
    return;
  }
  const key = `${req.user.id}:${req.ip}`;
  if (rateLimited(key)) {
    const error = new PromotionError(
      "PROMO_RATE_LIMITED",
      requestId,
      "rate_limit",
      "PROMOTION_ATTEMPT_LIMIT",
      true,
    );
    req.log.warn(
      { userId: req.user.id, requestId, diagnosticCode: error.diagnosticCode },
      "promotion.redemption.rejected",
    );
    res.status(429).json(error.toSafeJSON());
    return;
  }
  const parsed = redeemSchema.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json(
        new PromotionError(
          "PROMO_INVALID",
          requestId,
          "validation",
          "INVALID_REQUEST",
        ).toSafeJSON(),
      );
    return;
  }
  try {
    const result = await internalPromotions.redeem({
      userId: req.user.id,
      requestId,
      ...parsed.data,
    });
    const entitlementSummary =
      await generationEntitlements.getSafeEntitlementSummary(req.user.id);
    req.log.info(
      {
        userId: req.user.id,
        requestId,
        redemptionId: result.redemptionId,
        grantCount: result.ledgerTransactionIds.length,
      },
      "promotion.redemption.completed",
    );
    res.json({
      success: true,
      message: "Your free skin credit is ready.",
      grantedCredits: result.grants ?? [],
      entitlementSummary,
      redemptionId: result.redemptionId,
    });
  } catch (error) {
    const promoError =
      error instanceof PromotionError
        ? error
        : new PromotionError(
            "PROMO_CONFIGURATION_ERROR",
            requestId,
            "redemption",
            "REDEMPTION_TRANSACTION_FAILED",
            true,
          );
    req.log.warn(
      {
        userId: req.user.id,
        requestId,
        diagnosticCode: promoError.diagnosticCode,
      },
      "promotion.redemption.rejected",
    );
    res.status(promoError.retryable ? 503 : 400).json(promoError.toSafeJSON());
  }
});
router.get("/promotions/redemptions/recent", async (req, res) => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ code: "AUTH_REQUIRED", message: "Please sign in." });
    return;
  }
  res.json({ redemptions: await internalPromotions.recent(req.user.id) });
});
router.post("/internal/promotions/campaigns", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    res
      .status(201)
      .json(await internalPromotions.createCampaign(req.user!.id, req.body));
  } catch (error) {
    req.log.error({ error }, "promotion.admin.create_failed");
    res.status(400).json({
      code: "PROMO_CONFIGURATION_ERROR",
      message: "Campaign configuration is invalid.",
    });
  }
});
router.post("/internal/promotions/campaigns/:id/activate", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json(await internalPromotions.setActive(req.params.id, true));
});
router.post("/internal/promotions/campaigns/:id/disable", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json(await internalPromotions.setActive(req.params.id, false));
});
router.get("/internal/promotions/campaigns/:id/metrics", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json(await internalPromotions.metrics(req.params.id));
});
router.post(
  "/internal/promotions/redemptions/:id/reverse",
  async (req, res) => {
    if (!requireAdmin(req, res)) return;
    res.json(
      await internalPromotions.reverseRedemption(
        req.user!.id,
        req.params.id,
        String(req.id ?? "admin-request"),
      ),
    );
  },
);
router.post("/internal/promotions/support-grants", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const parsed = z
    .object({
      userId: z.string().min(1),
      creditType: z.enum(["GENERATION_2D", "GENERATION_3D"]),
      quantity: z.number().int().min(1).max(100),
      idempotencyKey: z.string().min(8).max(200),
      expiresAt: z.coerce.date().optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({
        code: "PROMO_CONFIGURATION_ERROR",
        message: "Support grant configuration is invalid.",
      });
    return;
  }
  await generationEntitlements.grantAdministrativeCredits({
    ...parsed.data,
    actorId: req.user!.id,
  });
  res
    .status(201)
    .json({
      success: true,
      entitlementSummary:
        await generationEntitlements.getSafeEntitlementSummary(
          parsed.data.userId,
        ),
    });
});
export default router;
