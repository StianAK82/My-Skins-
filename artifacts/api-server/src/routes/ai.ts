import { Router, type IRouter } from "express";

const router: IRouter = Router();

function unauthorized(res: any) {
  res.status(401).json({ error: "Unauthorized" });
}

router.post("/ai/generate-outfit", (req, res): void => {
  if (!req.isAuthenticated()) return unauthorized(res);
  res.setHeader("Deprecation", "true");
  res.status(410).json({
    error: "DEPRECATED_ENDPOINT",
    message: "Use /api/ai/generate and consume canonical status-aware contract.",
    replacement: "/api/ai/generate",
    sunsetDate: "2026-06-01",
  });
});

router.post("/ai/remix-outfit", (req, res): void => {
  if (!req.isAuthenticated()) return unauthorized(res);
  res.setHeader("Deprecation", "true");
  res.status(410).json({
    error: "DEPRECATED_ENDPOINT",
    message: "Use /api/ai/remix and consume canonical status-aware contract.",
    replacement: "/api/ai/remix",
    sunsetDate: "2026-06-01",
  });
});

export default router;
