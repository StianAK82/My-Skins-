import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

router.get("/ai/health", (_req, res) => {
  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  let baseUrlValid = false;
  try { baseUrlValid = Boolean(baseUrl && ["http:", "https:"].includes(new URL(baseUrl).protocol)); } catch { /* safe false */ }
  const checks = {
    apiKeyConfigured: Boolean(process.env.AI_INTEGRATIONS_OPENAI_API_KEY),
    baseUrlValid,
    textModelConfigured: Boolean(process.env.AI_TEXT_MODEL ?? "gpt-4o-mini"),
    imageModelConfigured: Boolean(process.env.AI_IMAGE_MODEL ?? "gpt-image-1"),
    imageIntegrationReady: Boolean(process.env.AI_INTEGRATIONS_OPENAI_API_KEY && baseUrlValid),
  };
  res.status(Object.values(checks).every(Boolean) ? 200 : 503).json({ status: Object.values(checks).every(Boolean) ? "ready" : "unavailable", checks });
});

export default router;
