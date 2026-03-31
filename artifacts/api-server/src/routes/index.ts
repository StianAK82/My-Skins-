import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import authUserRouter from "./auth-user";
import projectsRouter from "./projects";
import dashboardRouter from "./dashboard";
import aiRouter from "./ai";
import aiCreateRouter from "./ai-create";
import exportsRouter from "./exports";
import robloxRouter from "./roblox";
import shareRouter from "./share";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(authUserRouter);
router.use(projectsRouter);
router.use(dashboardRouter);
router.use(aiRouter);
router.use(aiCreateRouter);
router.use(exportsRouter);
router.use(robloxRouter);
router.use(shareRouter);

export default router;
