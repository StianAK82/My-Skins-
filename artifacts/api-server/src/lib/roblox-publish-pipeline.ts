export const CANONICAL_CLASSIC_PNG_WIDTH = 585;
export const CANONICAL_CLASSIC_PNG_HEIGHT = 559;
export const MAX_UPLOAD_RETRIES = 3;

export type UploadExecutionMode = "inline" | "deferred";

export type CanonicalExportArtifactCandidate = {
  exportJobId: string;
  exportJobCreatedAt: Date;
  artifactId: string;
  artifactUrl: string | null;
  width: number;
  height: number;
  size: number;
  artifactCreatedAt: Date;
};

export type CanonicalExportArtifactResolution =
  | { ok: true; artifact: CanonicalExportArtifactCandidate }
  | { ok: false; reason: "NO_EXPORTS" | "INVALID_CANONICAL_ARTIFACT" };

export function parseUploadExecutionMode(value: string | undefined): UploadExecutionMode {
  return value === "deferred" ? "deferred" : "inline";
}

function isValidHttpUrl(value: string | null): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function resolveLatestCanonicalExportArtifact(
  candidates: CanonicalExportArtifactCandidate[],
): CanonicalExportArtifactResolution {
  if (!candidates.length) {
    return { ok: false, reason: "NO_EXPORTS" };
  }

  const artifact = candidates.find((candidate) =>
    isValidHttpUrl(candidate.artifactUrl)
    && candidate.width === CANONICAL_CLASSIC_PNG_WIDTH
    && candidate.height === CANONICAL_CLASSIC_PNG_HEIGHT
    && candidate.size > 0,
  );

  if (!artifact) {
    return { ok: false, reason: "INVALID_CANONICAL_ARTIFACT" };
  }

  return { ok: true, artifact };
}

export function validateRetryEligibility(input: { status: string; retryCount: number; maxRetries?: number }) {
  const maxRetries = input.maxRetries ?? MAX_UPLOAD_RETRIES;
  if (input.status !== "failed") {
    return { ok: false as const, error: "RETRY_NOT_ALLOWED", message: "Only failed jobs can be retried." };
  }
  if (input.retryCount >= maxRetries) {
    return { ok: false as const, error: "RETRY_LIMIT_REACHED", message: "Upload retry limit reached." };
  }
  return { ok: true as const };
}

export function buildProcessingAttempt(retryCount: number) {
  return retryCount + 1;
}
