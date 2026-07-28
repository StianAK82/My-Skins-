export type AiErrorCode =
  | "SAFETY_BLOCKED"
  | "MODEL_CONFIGURATION_ERROR"
  | "MODEL_REQUEST_FAILED"
  | "MODEL_TIMEOUT"
  | "INVALID_MODEL_RESPONSE"
  | "SCHEMA_REPAIR_FAILED"
  | "CLASSIC_COMPILATION_FAILED"
  | "AI_TIMEOUT"
  | "AI_RATE_LIMIT"
  | "AI_AUTH"
  | "AI_CONFIGURATION"
  | "AI_NETWORK"
  | "AI_IMAGE_RESPONSE"
  | "AI_VALIDATION"
  | "DATABASE_ERROR"
  | "AI_GENERATION_FAILED";

export class AiGenerationError extends Error {
  readonly code: AiErrorCode;
  readonly stage: string;
  readonly retryable: boolean;
  readonly status?: number;
  constructor(
    message: string,
    code: AiErrorCode,
    stage: string,
    retryable: boolean,
    status?: number,
  ) {
    super(message);
    this.name = "AiGenerationError";
    this.code = code;
    this.stage = stage;
    this.retryable = retryable;
    this.status = status;
  }
}

export function timeoutMs(name: "AI_TEXT_TIMEOUT_MS" | "AI_IMAGE_TIMEOUT_MS" | "COMPLETE_OUTFIT_TIMEOUT_MS", fallback: number) {
  const configured = Number(process.env[name]);
  return Number.isFinite(configured) && configured > 0 ? configured : fallback;
}

export async function withAiTimeout<T>(operation: (signal: AbortSignal) => Promise<T>, milliseconds: number, stage: string): Promise<T> {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new AiGenerationError("AI operation timed out", "AI_TIMEOUT", stage, true, 504));
    }, milliseconds);
  });
  try {
    return await Promise.race([operation(controller.signal), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function normalizeAiError(error: unknown, stage: string): AiGenerationError {
  if (error instanceof AiGenerationError) return error;
  const value = error as { status?: number; code?: string; name?: string; message?: string };
  if (value?.code === "AI_CONFIGURATION") return new AiGenerationError("AI configuration is unavailable", "AI_CONFIGURATION", stage, false, 503);
  if (value?.code === "AI_IMAGE_RESPONSE") return new AiGenerationError("AI returned a malformed image", "AI_IMAGE_RESPONSE", stage, true, 502);
  if (value?.status === 401) return new AiGenerationError("AI authentication failed", "AI_AUTH", stage, false, 401);
  if (value?.status === 429) return new AiGenerationError("AI rate limit reached", "AI_RATE_LIMIT", stage, true, 429);
  if (value?.name === "AbortError") return new AiGenerationError("AI operation timed out", "AI_TIMEOUT", stage, true, 504);
  if (["ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "ETIMEDOUT"].includes(value?.code ?? ""))
    return new AiGenerationError("AI network request failed", "AI_NETWORK", stage, true, 502);
  return new AiGenerationError("AI generation failed", "AI_GENERATION_FAILED", stage, true, value?.status);
}
