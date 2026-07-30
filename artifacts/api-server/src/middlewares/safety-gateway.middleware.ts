import type { Request, Response, NextFunction } from "express";
import {
  RateLimiter,
  SafetyError,
  evaluatePrompt,
  recordDecision,
} from "../lib/safety-gateway";

// One shared limiter for all /api/ai/* traffic: 30 requests per 5 minutes per IP.
// (A single «Lag skin» round uses up to 4 AI calls, so this allows ~7 rounds.)
const limiter = new RateLimiter(30, 5 * 60 * 1000);

/** Text fields in AI request bodies that contain child-written free text. */
const TEXT_FIELDS = ["prompt", "instruction", "theme"] as const;

function sendSafetyError(req: Request, res: Response, err: SafetyError): void {
  // Data-minimized audit log: category + stage + decision, never the raw text.
  req.log?.warn(
    { code: err.code, stage: err.stage, categories: err.categories, ip: req.ip },
    "safety_gateway.blocked",
  );
  res.status(err.httpStatus).json({
    error: err.code,
    code: err.code,
    message: err.message,
    stage: err.stage,
    retryable: err.retryable,
    requestId: (req as Request & { id?: string | number }).id ?? null,
  });
}

/**
 * SafetyGateway middleware — mounted in front of ALL /api/ai/* routes.
 * Rate-limits per IP, then runs every child-written text field through the
 * safety pipeline. Allowed prompts are replaced in-place with their normalized
 * safe form, so downstream services and storage never see or keep text that
 * references protected characters.
 */
export function safetyGatewayMiddleware(req: Request, res: Response, next: NextFunction): void {
  try {
    limiter.check(req.ip ?? "unknown");

    if (req.method === "POST" && req.body && typeof req.body === "object") {
      const body = req.body as Record<string, unknown>;
      for (const field of TEXT_FIELDS) {
        const value = body[field];
        if (typeof value !== "string" || value.trim().length === 0) continue;
        const decision = evaluatePrompt(value);
        body[field] = decision.safePrompt;
        recordDecision(decision);
        req.log?.info(
          {
            field,
            decision: decision.decision,
            categories: decision.categories,
            promptHash: decision.promptHash,
            safePromptHash: decision.safePromptHash,
          },
          "safety_gateway.decision",
        );
      }
    }
    next();
  } catch (err) {
    if (err instanceof SafetyError) {
      sendSafetyError(req, res, err);
      return;
    }
    next(err);
  }
}
