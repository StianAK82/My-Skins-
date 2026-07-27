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

const router: IRouter = Router();

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
