import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import authUserRouter from "./auth-user";
import projectsRouter from "./projects";
import dashboardRouter from "./dashboard";
import aiRouter from "./ai";
import aiV2Router from "./ai-v2";
import exportsRouter from "./exports";
import robloxRouter from "./roblox";
import robloxOAuthRouter from "./roblox-oauth";
import shareRouter from "./share";
import paymentsRouter from "./payments";
import billingRouter from "./billing";
import entitlementsRouter from "./entitlements";
import promotionsRouter from "./promotions";
import { safetyGatewayMiddleware } from "../middlewares/safety-gateway.middleware";
import { serverFeatureFlags } from "../lib/feature-flags";

const router: IRouter = Router();

// SafetyGateway: every /api/ai/* request passes through the child-safety
// pipeline (rate limit, length, PII, moderation, IP protection) BEFORE any
// route handler and thus before any AI provider call.
router.use("/ai", safetyGatewayMiddleware);
router.use((req, res, next) => {
  const disabled =
    (!serverFeatureFlags.stripePurchase && req.path.startsWith("/payments/create-checkout")) ||
    (!serverFeatureFlags.robloxOAuth && req.path.startsWith("/auth/roblox")) ||
    (!serverFeatureFlags.robloxDelivery && req.path.startsWith("/roblox"));
  if (disabled) { res.status(404).json({ code: "FEATURE_DISABLED", message: "This feature is not available in this internal build." }); return; }
  next();
});

router.use(healthRouter);
router.use(authRouter);
router.use(authUserRouter);
router.use(projectsRouter);
router.use(dashboardRouter);
router.use(aiV2Router);
router.use(aiRouter);
router.use(exportsRouter);
router.use(robloxRouter);
router.use(robloxOAuthRouter);
router.use(shareRouter);
router.use(paymentsRouter);
router.use(billingRouter);
router.use(entitlementsRouter);
router.use(promotionsRouter);

export default router;
