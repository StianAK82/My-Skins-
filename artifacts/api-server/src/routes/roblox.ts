import { Router, type IRouter } from "express";
import { and, desc, eq, lt } from "drizzle-orm";
import {
  db,
  exportArtifactsTable,
  exportJobsTable,
  projectsTable,
  robloxConnectionsTable,
  robloxOauthStatesTable,
  robloxUploadEventsTable,
  robloxUploadJobsTable,
  userProfilesTable,
  usersTable,
} from "@workspace/db";
import { createHash, randomBytes, randomUUID } from "crypto";
import { z } from "zod";
import {
  canTransitionRobloxUploadStatus,
  isSupportedUploadProjectType,
  resolveRobloxConnectionState,
  toRobloxItemType,
  type RobloxUploadStatus,
} from "../lib/roblox-upload";
import {
  buildProcessingAttempt,
  MAX_UPLOAD_RETRIES,
  parseUploadExecutionMode,
  resolveLatestCanonicalExportArtifact,
  validateRetryEligibility,
  type CanonicalExportArtifactCandidate,
} from "../lib/roblox-publish-pipeline";

const router: IRouter = Router();

const LOGIN_STATE_TTL_MS = 10 * 60 * 1000;
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const uploadSchema = z.object({ projectId: z.string().uuid() });
const callbackSchema = z.object({ state: z.string().min(1), code: z.string().min(1) });
const uploadJobParamsSchema = z.object({ uploadJobId: z.string().uuid() });

function base64url(input: Buffer): string {
  return input.toString("base64url");
}

async function cleanupExpiredState() {
  await db.delete(robloxOauthStatesTable).where(lt(robloxOauthStatesTable.expiresAt, new Date()));
}

function robloxConfig() {
  return {
    clientId: process.env.ROBLOX_CLIENT_ID,
    clientSecret: process.env.ROBLOX_CLIENT_SECRET,
    redirectUri: process.env.ROBLOX_REDIRECT_URI,
    authorizeUrl: process.env.ROBLOX_OAUTH_AUTHORIZE_URL ?? "https://apis.roblox.com/oauth/v1/authorize",
    tokenUrl: process.env.ROBLOX_OAUTH_TOKEN_URL ?? "https://apis.roblox.com/oauth/v1/token",
    classicUploadUrl: process.env.ROBLOX_CLASSIC_UPLOAD_URL,
    uploadMode: process.env.ROBLOX_UPLOAD_MODE ?? "auto",
    executionMode: parseUploadExecutionMode(process.env.ROBLOX_UPLOAD_EXECUTION_MODE),
  };
}

function parseOptionalDate(secondsFromNow?: unknown): Date | null {
  if (typeof secondsFromNow !== "number" || !Number.isFinite(secondsFromNow) || secondsFromNow <= 0) {
    return null;
  }
  return new Date(Date.now() + secondsFromNow * 1000);
}

function mapRobloxTokenResponse(tokenData: {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  user_id?: string;
  preferred_username?: string;
}) {
  return {
    robloxUserId: tokenData.user_id ?? "unknown",
    robloxUsername: tokenData.preferred_username ?? "roblox-user",
    accessToken: tokenData.access_token ?? null,
    refreshToken: tokenData.refresh_token ?? null,
    accessTokenExpiresAt: parseOptionalDate(tokenData.expires_in),
    refreshTokenExpiresAt: parseOptionalDate(tokenData.refresh_token_expires_in),
    tokenInvalidatedAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    disconnectedAt: null,
    revokedByUser: false,
  };
}

async function appendUploadEvent(tx: DbTransaction, input: {
  uploadJobId: string;
  status: RobloxUploadStatus;
  code?: string;
  message: string;
  detail?: unknown;
}) {
  await tx.insert(robloxUploadEventsTable).values({
    id: randomUUID(),
    uploadJobId: input.uploadJobId,
    status: input.status,
    code: input.code ?? null,
    message: input.message,
    detail: input.detail ? JSON.stringify(input.detail) : null,
  });
}

async function transitionUploadJob(tx: DbTransaction, input: {
  uploadJobId: string;
  from: RobloxUploadStatus;
  to: RobloxUploadStatus;
  data?: Record<string, unknown>;
}) {
  if (!canTransitionRobloxUploadStatus(input.from, input.to)) {
    throw new Error(`Invalid upload transition: ${input.from} -> ${input.to}`);
  }
  await tx.update(robloxUploadJobsTable).set({
    ...(input.data ?? {}),
    status: input.to,
    completedAt: input.to === "completed" || input.to === "failed" || input.to === "blocked" ? new Date() : null,
  }).where(and(eq(robloxUploadJobsTable.id, input.uploadJobId), eq(robloxUploadJobsTable.status, input.from)));
}

type RequestLogLike = { log: { warn: (obj: unknown, msg: string) => void; info: (obj: unknown, msg: string) => void; error: (obj: unknown, msg: string) => void } };

async function refreshRobloxAccessToken(connection: typeof robloxConnectionsTable.$inferSelect, cfg: ReturnType<typeof robloxConfig>, req: RequestLogLike) {
  if (!connection.refreshToken) {
    return { ok: false as const, code: "MISSING_REFRESH_TOKEN", message: "Roblox connection refresh token is missing." };
  }
  if (!cfg.clientId || !cfg.clientSecret || !cfg.redirectUri) {
    return { ok: false as const, code: "ROBLOX_NOT_CONFIGURED", message: "Roblox OAuth is not configured." };
  }

  const tokenResponse = await fetch(cfg.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      refresh_token: connection.refreshToken,
      redirect_uri: cfg.redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    const body = await tokenResponse.text();
    req.log.warn({ status: tokenResponse.status, body }, "roblox.token.refresh.failed");
    if (tokenResponse.status === 400 || tokenResponse.status === 401) {
      await db.update(robloxConnectionsTable).set({
        accessToken: null,
        tokenInvalidatedAt: new Date(),
        lastErrorCode: "TOKEN_REFRESH_REJECTED",
        lastErrorMessage: body.slice(0, 2000),
      }).where(eq(robloxConnectionsTable.id, connection.id));
    }
    return { ok: false as const, code: "TOKEN_REFRESH_FAILED", message: "Roblox access token refresh failed." };
  }

  const tokenData = await tokenResponse.json() as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    refresh_token_expires_in?: number;
  };

  const refreshed = {
    accessToken: tokenData.access_token ?? connection.accessToken,
    refreshToken: tokenData.refresh_token ?? connection.refreshToken,
    accessTokenExpiresAt: parseOptionalDate(tokenData.expires_in),
    refreshTokenExpiresAt: parseOptionalDate(tokenData.refresh_token_expires_in) ?? connection.refreshTokenExpiresAt,
    lastRefreshAt: new Date(),
    lastErrorCode: null,
    lastErrorMessage: null,
    tokenInvalidatedAt: null,
  };

  await db.update(robloxConnectionsTable).set(refreshed).where(eq(robloxConnectionsTable.id, connection.id));
  return { ok: true as const, accessToken: refreshed.accessToken };
}

function isPreviewOnlyProject(project: { tags: string[] }) {
  return project.tags.includes("preview_only") || project.tags.includes("avatar_only") || project.tags.includes("non_exportable");
}

async function resolveCanonicalArtifact(userId: string, projectId: string) {
  const artifacts = await db
    .select({
      exportJobId: exportJobsTable.id,
      exportJobCreatedAt: exportJobsTable.createdAt,
      artifactId: exportArtifactsTable.id,
      artifactUrl: exportArtifactsTable.url,
      width: exportArtifactsTable.width,
      height: exportArtifactsTable.height,
      size: exportArtifactsTable.size,
      artifactCreatedAt: exportArtifactsTable.createdAt,
    })
    .from(exportJobsTable)
    .innerJoin(exportArtifactsTable, eq(exportArtifactsTable.exportJobId, exportJobsTable.id))
    .where(and(
      eq(exportJobsTable.userId, userId),
      eq(exportJobsTable.projectId, projectId),
      eq(exportJobsTable.status, "completed"),
      eq(exportJobsTable.format, "png"),
    ))
    .orderBy(desc(exportJobsTable.createdAt), desc(exportArtifactsTable.createdAt))
    .limit(20);

  const resolution = resolveLatestCanonicalExportArtifact(artifacts as CanonicalExportArtifactCandidate[]);
  if (!resolution.ok) return null;
  return resolution.artifact;
}

async function submitClassicUpload(input: {
  cfg: ReturnType<typeof robloxConfig>;
  accessToken: string;
  projectId: string;
  projectType: "shirt" | "pants";
  artifactUrl: string;
  title: string;
  req: RequestLogLike;
}) {
  const useMockFallback = !input.cfg.classicUploadUrl || input.cfg.uploadMode === "mock";
  if (useMockFallback) {
    input.req.log.info({ projectId: input.projectId }, "roblox.upload.mock_fallback");
    return {
      mode: "mock" as const,
      assetId: `mock_${Date.now()}`,
      uploadId: randomUUID(),
      raw: { mock: true, reason: "ROBLOX_CLASSIC_UPLOAD_URL_NOT_CONFIGURED" },
    };
  }

  const uploadUrl = input.cfg.classicUploadUrl;
  if (!uploadUrl) {
    throw new Error("ROBLOX_CLASSIC_UPLOAD_URL_MISSING");
  }

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.accessToken}`,
    },
    body: JSON.stringify({
      title: input.title,
      description: `My Skins ${input.projectType} upload`,
      itemType: toRobloxItemType(input.projectType),
      textureUrl: input.artifactUrl,
      projectId: input.projectId,
    }),
  });

  const rawText = await response.text();
  let rawBody: Record<string, unknown> = {};
  try {
    rawBody = rawText ? JSON.parse(rawText) as Record<string, unknown> : {};
  } catch {
    rawBody = { rawText: rawText.slice(0, 2000) };
  }

  if (!response.ok) {
    return {
      mode: "real" as const,
      ok: false as const,
      status: response.status,
      errorCode: typeof rawBody.code === "string" ? rawBody.code : "ROBLOX_UPLOAD_REQUEST_FAILED",
      errorMessage: typeof rawBody.message === "string" ? rawBody.message : `Roblox upload request failed with ${response.status}`,
      raw: rawBody,
    };
  }

  return {
    mode: "real" as const,
    ok: true as const,
    assetId: typeof rawBody.assetId === "string" ? rawBody.assetId : typeof rawBody.id === "string" ? rawBody.id : null,
    uploadId: typeof rawBody.uploadId === "string" ? rawBody.uploadId : null,
    raw: rawBody,
  };
}

async function processUploadJobNow(input: {
  uploadJobId: string;
  userId: string;
  projectId: string;
  projectType: "shirt" | "pants";
  projectTitle: string;
  connection: typeof robloxConnectionsTable.$inferSelect | undefined;
  cfg: ReturnType<typeof robloxConfig>;
  req: RequestLogLike;
}) {
  const now = new Date();
  const attempt = await db.update(robloxUploadJobsTable).set({ status: "processing", completedAt: null })
    .where(and(eq(robloxUploadJobsTable.id, input.uploadJobId), eq(robloxUploadJobsTable.status, "queued")))
    .returning({ id: robloxUploadJobsTable.id, retryCount: robloxUploadJobsTable.retryCount });

  if (!attempt.length) {
    input.req.log.warn({ uploadJobId: input.uploadJobId }, "roblox.upload.processing_skipped");
    return;
  }

  const attemptNumber = buildProcessingAttempt(attempt[0].retryCount);
  await db.transaction(async (tx: DbTransaction) => {
    await appendUploadEvent(tx, {
      uploadJobId: input.uploadJobId,
      status: "processing",
      code: "UPLOAD_PROCESSING",
      message: "Upload request is being processed.",
      detail: { attempt: attemptNumber },
    });
  });
  input.req.log.info({ uploadJobId: input.uploadJobId, projectId: input.projectId, attempt: attemptNumber }, "roblox.upload.processing_started");

  const connectionState = input.connection
    ? resolveRobloxConnectionState(input.connection, now)
    : "disconnected";
  if (!input.connection || connectionState === "disconnected") {
    await db.transaction(async (tx: DbTransaction) => {
      await transitionUploadJob(tx, { uploadJobId: input.uploadJobId, from: "processing", to: "failed", data: { lastErrorCode: "MISSING_CONNECTION", lastErrorMessage: "No active Roblox OAuth connection." } });
      await appendUploadEvent(tx, {
        uploadJobId: input.uploadJobId,
        status: "failed",
        code: "MISSING_CONNECTION",
        message: "No active Roblox OAuth connection.",
      });
    });
    return;
  }

  const artifact = await resolveCanonicalArtifact(input.userId, input.projectId);
  if (!artifact) {
    await db.transaction(async (tx: DbTransaction) => {
      await transitionUploadJob(tx, { uploadJobId: input.uploadJobId, from: "processing", to: "failed", data: { lastErrorCode: "CANONICAL_EXPORT_MISSING", lastErrorMessage: "No valid canonical PNG export artifact was found." } });
      await appendUploadEvent(tx, {
        uploadJobId: input.uploadJobId,
        status: "failed",
        code: "CANONICAL_EXPORT_MISSING",
        message: "No valid canonical PNG export artifact found.",
        detail: { projectId: input.projectId },
      });
    });
    return;
  }

  let accessToken = input.connection.accessToken;
  if (connectionState === "expired") {
    const refresh = await refreshRobloxAccessToken(input.connection, input.cfg, input.req);
    if (!refresh.ok) {
      await db.transaction(async (tx: DbTransaction) => {
        await transitionUploadJob(tx, { uploadJobId: input.uploadJobId, from: "processing", to: "failed", data: { lastErrorCode: refresh.code, lastErrorMessage: refresh.message } });
        await appendUploadEvent(tx, {
          uploadJobId: input.uploadJobId,
          status: "failed",
          code: refresh.code,
          message: "Roblox token refresh failed. Reconnect your Roblox account.",
          detail: { attempt: attemptNumber },
        });
      });
      return;
    }
    accessToken = refresh.accessToken;
  }

  if (!accessToken) {
    await db.transaction(async (tx: DbTransaction) => {
      await transitionUploadJob(tx, { uploadJobId: input.uploadJobId, from: "processing", to: "failed", data: { lastErrorCode: "MISSING_ACCESS_TOKEN", lastErrorMessage: "No Roblox access token available for upload." } });
      await appendUploadEvent(tx, {
        uploadJobId: input.uploadJobId,
        status: "failed",
        code: "MISSING_ACCESS_TOKEN",
        message: "No Roblox access token available for upload.",
      });
    });
    return;
  }

  const uploadResult = await submitClassicUpload({
    cfg: input.cfg,
    accessToken,
    projectId: input.projectId,
    projectType: input.projectType,
    artifactUrl: artifact.artifactUrl!,
    title: input.projectTitle,
    req: input.req,
  });

  if ("ok" in uploadResult && !uploadResult.ok) {
    if (uploadResult.status === 401 || uploadResult.status === 403) {
      await db.update(robloxConnectionsTable).set({
        accessToken: null,
        tokenInvalidatedAt: new Date(),
        lastErrorCode: "TOKEN_REJECTED_BY_UPLOAD_API",
        lastErrorMessage: uploadResult.errorMessage,
      }).where(eq(robloxConnectionsTable.userId, input.userId));
    }
    await db.transaction(async (tx: DbTransaction) => {
      await transitionUploadJob(tx, {
        uploadJobId: input.uploadJobId,
        from: "processing",
        to: "failed",
        data: {
          exportJobId: artifact.exportJobId,
          exportArtifactId: artifact.artifactId,
          exportArtifactUrl: artifact.artifactUrl,
          lastErrorCode: uploadResult.errorCode,
          lastErrorMessage: uploadResult.errorMessage,
        },
      });
      await appendUploadEvent(tx, {
        uploadJobId: input.uploadJobId,
        status: "failed",
        code: uploadResult.errorCode,
        message: uploadResult.errorMessage ?? "Roblox upload failed.",
        detail: { status: uploadResult.status, raw: uploadResult.raw, attempt: attemptNumber, exportArtifactId: artifact.artifactId },
      });
    });
    input.req.log.error({ projectId: input.projectId, uploadJobId: input.uploadJobId, error: uploadResult.errorCode, status: uploadResult.status, attempt: attemptNumber }, "roblox.upload.submit_failed");
    return;
  }

  await db.transaction(async (tx: DbTransaction) => {
    await transitionUploadJob(tx, {
      uploadJobId: input.uploadJobId,
      from: "processing",
      to: "completed",
      data: {
        exportJobId: artifact.exportJobId,
        exportArtifactId: artifact.artifactId,
        exportArtifactUrl: artifact.artifactUrl,
        robloxAssetId: uploadResult.assetId,
        robloxUploadId: uploadResult.uploadId,
        lastErrorCode: null,
        lastErrorMessage: null,
      },
    });
    await appendUploadEvent(tx, {
      uploadJobId: input.uploadJobId,
      status: "completed",
      code: uploadResult.mode === "mock" ? "MOCK_UPLOAD_COMPLETED" : "UPLOAD_COMPLETED",
      message: uploadResult.mode === "mock" ? "Upload completed using explicit mock fallback." : "Roblox upload completed.",
      detail: { raw: uploadResult.raw, robloxAssetId: uploadResult.assetId, mode: uploadResult.mode, attempt: attemptNumber, exportArtifactId: artifact.artifactId },
    });
  });
  input.req.log.info({ projectId: input.projectId, uploadJobId: input.uploadJobId, robloxAssetId: uploadResult.assetId, mode: uploadResult.mode, attempt: attemptNumber }, "roblox.upload.completed");
}

router.get("/credits", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [profile] = await db.select({ aiCredits: userProfilesTable.aiCredits }).from(userProfilesTable).where(eq(userProfilesTable.userId, req.user.id));
  const [user] = await db.select({ credits: usersTable.credits }).from(usersTable).where(eq(usersTable.id, req.user.id));

  res.json({ credits: profile?.aiCredits ?? user?.credits ?? 0, unitPriceNok: 10 });
});

router.get("/roblox/status", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [connection] = await db
    .select()
    .from(robloxConnectionsTable)
    .where(eq(robloxConnectionsTable.userId, req.user.id));

  const cfg = robloxConfig();
  const configured = Boolean(cfg.clientId && cfg.redirectUri && cfg.clientSecret);
  const state = resolveRobloxConnectionState(connection);

  res.json({
    configured,
    connected: state === "connected",
    connectionState: state,
    reconnectRequired: state === "expired",
    connection: connection && state !== "disconnected"
      ? {
          robloxUserId: connection.robloxUserId,
          robloxUsername: connection.robloxUsername,
          connectedAt: connection.connectedAt,
          accessTokenExpiresAt: connection.accessTokenExpiresAt,
          lastRefreshAt: connection.lastRefreshAt,
          lastErrorCode: connection.lastErrorCode,
        }
      : null,
  });
});

router.get("/roblox/login", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const cfg = robloxConfig();
  if (!cfg.clientId || !cfg.redirectUri) {
    res.status(503).json({ error: "ROBLOX_NOT_CONFIGURED", message: "Roblox OAuth is not configured." });
    return;
  }

  await cleanupExpiredState();

  const state = base64url(randomBytes(24));
  const verifier = base64url(randomBytes(48));
  const challenge = base64url(createHash("sha256").update(verifier).digest());

  await db.insert(robloxOauthStatesTable).values({
    state,
    userId: req.user.id,
    verifier,
    expiresAt: new Date(Date.now() + LOGIN_STATE_TTL_MS),
  });

  const authUrl = new URL(cfg.authorizeUrl);
  authUrl.searchParams.set("client_id", cfg.clientId);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", cfg.redirectUri);
  authUrl.searchParams.set("scope", "openid profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  res.json({ authorizeUrl: authUrl.toString() });
});

router.get("/roblox/callback", async (req, res): Promise<void> => {
  const parsed = callbackSchema.safeParse({
    state: typeof req.query.state === "string" ? req.query.state : "",
    code: typeof req.query.code === "string" ? req.query.code : "",
  });

  if (!parsed.success) {
    res.status(400).json({ error: "Missing state/code" });
    return;
  }

  const { state, code } = parsed.data;

  await cleanupExpiredState();
  const [entry] = await db.select().from(robloxOauthStatesTable).where(eq(robloxOauthStatesTable.state, state)).limit(1);

  if (!entry) {
    res.status(400).json({ error: "Invalid or expired OAuth state" });
    return;
  }

  await db.delete(robloxOauthStatesTable).where(eq(robloxOauthStatesTable.state, state));

  const cfg = robloxConfig();
  if (!cfg.clientId || !cfg.clientSecret || !cfg.redirectUri) {
    res.status(503).json({ error: "ROBLOX_NOT_CONFIGURED", message: "Roblox OAuth is not configured." });
    return;
  }

  try {
    const tokenResponse = await fetch(cfg.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: cfg.clientId,
        client_secret: cfg.clientSecret,
        code,
        redirect_uri: cfg.redirectUri,
        code_verifier: entry.verifier,
      }),
    });

    if (!tokenResponse.ok) {
      res.status(502).json({ error: "TOKEN_EXCHANGE_FAILED" });
      return;
    }

    const tokenData = await tokenResponse.json() as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      refresh_token_expires_in?: number;
      user_id?: string;
      preferred_username?: string;
    };

    await db
      .insert(robloxConnectionsTable)
      .values({
        id: randomUUID(),
        userId: entry.userId,
        ...mapRobloxTokenResponse(tokenData),
      })
      .onConflictDoUpdate({
        target: robloxConnectionsTable.userId,
        set: {
          ...mapRobloxTokenResponse(tokenData),
          connectedAt: new Date(),
          updatedAt: new Date(),
        },
      });

    res.json({ success: true, connected: true });
  } catch (error) {
    req.log.error({ err: error }, "roblox.callback.failed");
    res.status(500).json({ error: "ROBLOX_CALLBACK_FAILED" });
  }
});

router.post("/roblox/upload", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = uploadSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid upload request", details: parsed.error.flatten() });
    return;
  }

  const { projectId } = parsed.data;
  const cfg = robloxConfig();
  const configured = Boolean(cfg.clientId && cfg.clientSecret && cfg.redirectUri);

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, req.user.id)));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  if (!isSupportedUploadProjectType(project.type)) {
    res.status(400).json({
      error: "UNSUPPORTED_PROJECT_TYPE",
      message: "Only classic shirt and classic pants are supported for Roblox upload.",
    });
    return;
  }

  if (isPreviewOnlyProject({ tags: project.tags ?? [] })) {
    res.status(400).json({
      error: "PREVIEW_ONLY_PROJECT",
      message: "Preview-only designs cannot be uploaded to Roblox.",
    });
    return;
  }

  const [connection] = await db
    .select()
    .from(robloxConnectionsTable)
    .where(eq(robloxConnectionsTable.userId, req.user.id));

  const uploadJobId = randomUUID();

  await db.transaction(async (tx: DbTransaction) => {
    await tx.insert(robloxUploadJobsTable).values({
      id: uploadJobId,
      userId: req.user.id,
      projectId,
      status: "queued",
      itemType: project.type,
    });

    await appendUploadEvent(tx, {
      uploadJobId,
      status: "queued",
      code: "REQUEST_ACCEPTED",
      message: "Upload request accepted.",
      detail: { projectId, projectType: project.type },
    });
  });

  if (!configured) {
    await db.transaction(async (tx: DbTransaction) => {
      await transitionUploadJob(tx, { uploadJobId, from: "queued", to: "failed", data: { lastErrorCode: "ROBLOX_NOT_CONFIGURED", lastErrorMessage: "Roblox OAuth is not configured in this environment." } });
      await appendUploadEvent(tx, {
        uploadJobId,
        status: "failed",
        code: "ROBLOX_NOT_CONFIGURED",
        message: "Roblox upload is not configured on this environment.",
      });
    });
  } else if (cfg.executionMode === "inline") {
    await processUploadJobNow({
      uploadJobId,
      userId: req.user.id,
      projectId,
      projectType: project.type,
      projectTitle: project.title,
      connection,
      cfg,
      req,
    });
  } else {
    req.log.info({ uploadJobId, projectId }, "roblox.upload.deferred_execution_enqueued");
    await db.transaction(async (tx: DbTransaction) => {
      await appendUploadEvent(tx, {
        uploadJobId,
        status: "queued",
        code: "WORKER_DEFERRED",
        message: "Upload queued for worker/deferred processing.",
      });
    });
  }

  const [job] = await db.select().from(robloxUploadJobsTable).where(eq(robloxUploadJobsTable.id, uploadJobId));
  const events = await db.select().from(robloxUploadEventsTable).where(eq(robloxUploadEventsTable.uploadJobId, uploadJobId)).orderBy(robloxUploadEventsTable.createdAt);

  res.status(202).json({
    uploadJobId,
    projectId,
    status: job?.status ?? "queued",
    reconnectRequired: job?.lastErrorCode === "TOKEN_REFRESH_FAILED" || job?.lastErrorCode === "TOKEN_REJECTED_BY_UPLOAD_API",
    events,
  });
});

router.post("/roblox/upload/:uploadJobId/retry", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = uploadJobParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid upload job id", details: parsed.error.flatten() });
    return;
  }

  const [job] = await db.select().from(robloxUploadJobsTable).where(and(eq(robloxUploadJobsTable.id, parsed.data.uploadJobId), eq(robloxUploadJobsTable.userId, req.user.id)));
  if (!job) {
    res.status(404).json({ error: "Upload job not found" });
    return;
  }

  const retryValidation = validateRetryEligibility({ status: job.status, retryCount: job.retryCount, maxRetries: MAX_UPLOAD_RETRIES });
  if (!retryValidation.ok) {
    res.status(409).json({ error: retryValidation.error, message: retryValidation.message });
    return;
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, job.projectId), eq(projectsTable.userId, req.user.id)));
  if (!project || !isSupportedUploadProjectType(project.type)) {
    res.status(409).json({ error: "RETRY_NOT_ALLOWED", message: "Retry is not allowed for unsupported project types." });
    return;
  }

  const [connection] = await db
    .select()
    .from(robloxConnectionsTable)
    .where(eq(robloxConnectionsTable.userId, req.user.id));

  await db.transaction(async (tx: DbTransaction) => {
    await tx.update(robloxUploadJobsTable).set({
      status: "queued",
      retryCount: job.retryCount + 1,
      completedAt: null,
    }).where(eq(robloxUploadJobsTable.id, job.id));

    await appendUploadEvent(tx, {
      uploadJobId: job.id,
      status: "queued",
      code: "RETRY_REQUESTED",
      message: "Upload retry requested.",
      detail: {
        retryCount: job.retryCount + 1,
        previousErrorCode: job.lastErrorCode,
        previousErrorMessage: job.lastErrorMessage,
      },
    });
  });

  const cfg = robloxConfig();
  if (cfg.executionMode === "inline") {
    await processUploadJobNow({
      uploadJobId: job.id,
      userId: req.user.id,
      projectId: job.projectId,
      projectType: project.type,
      projectTitle: project.title,
      connection,
      cfg,
      req,
    });
  }

  const [updatedJob] = await db.select().from(robloxUploadJobsTable).where(eq(robloxUploadJobsTable.id, job.id));
  res.status(202).json({ success: true, uploadJobId: job.id, status: updatedJob?.status ?? "queued" });
});

router.get("/roblox/upload/:uploadJobId", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = uploadJobParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid upload job id", details: parsed.error.flatten() });
    return;
  }

  const { uploadJobId } = parsed.data;

  const [job] = await db
    .select()
    .from(robloxUploadJobsTable)
    .where(and(eq(robloxUploadJobsTable.id, uploadJobId), eq(robloxUploadJobsTable.userId, req.user.id)));

  if (!job) {
    res.status(404).json({ error: "Upload job not found" });
    return;
  }

  const events = await db.select().from(robloxUploadEventsTable).where(eq(robloxUploadEventsTable.uploadJobId, uploadJobId)).orderBy(robloxUploadEventsTable.createdAt);
  res.json({ ...job, uploadJobId: job.id, events });
});

router.delete("/roblox/disconnect", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  await db.update(robloxConnectionsTable).set({
    accessToken: null,
    refreshToken: null,
    disconnectedAt: new Date(),
    revokedByUser: true,
    tokenInvalidatedAt: new Date(),
    lastErrorCode: null,
    lastErrorMessage: null,
  }).where(eq(robloxConnectionsTable.userId, req.user.id));

  res.json({ success: true, message: "Roblox account disconnected" });
});

export default router;
