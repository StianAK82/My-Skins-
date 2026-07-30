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
import { safetyGatewayMiddleware } from "../middlewares/safety-gateway.middleware";

const router: IRouter = Router();

// SafetyGateway: every /api/ai/* request passes through the child-safety
// pipeline (rate limit, length, PII, moderation, IP protection) BEFORE any
// route handler and thus before any AI provider call.
router.use("/ai", safetyGatewayMiddleware);

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

export default router;
