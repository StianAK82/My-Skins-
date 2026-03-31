import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.post("/ai/quick-create", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  res.status(503).json({
    error: "Quick create is temporarily disabled. Generate a structured idea first via /api/ai/generate-idea.",
  });
});

export default router;
