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
import { randomUUID } from "crypto";
import { z } from "zod";
import {
  canTransitionRobloxUploadStatus,
  deriveRobloxUploadTerminalState,
  isRobloxUploadableProjectType,
  resolveRobloxUploadBlockedReason,
  type RobloxUploadLifecycleStatus,
  type RobloxUploadableProjectType,
} from "../lib/lifecycle";
import {
  buildRobloxAuthorizeUrl,
  createPkcePair,
  exchangeRobloxOAuthCode,
  type RobloxOauthConfig,
} from "../services/roblox/roblox-oauth.service";
import { uploadClassicClothingToRoblox } from "../services/roblox/roblox-upload.service";

const router: IRouter = Router();

const LOGIN_STATE_TTL_MS = 10 * 60 * 1000;
type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const uploadSchema = z.object({ projectId: z.string().uuid() });
const callbackSchema = z.object({ state: z.string().min(1), code: z.string().min(1) });
const uploadJobParamsSchema = z.object({ uploadJobId: z.string().uuid() });

async function cleanupExpiredState() {
  await db.delete(robloxOauthStatesTable).where(lt(robloxOauthStatesTable.expiresAt, new Date()));
}

function robloxConfig(): RobloxOauthConfig {
  return {
    clientId: process.env.ROBLOX_CLIENT_ID,
    clientSecret: process.env.ROBLOX_CLIENT_SECRET,
    redirectUri: process.env.ROBLOX_REDIRECT_URI,
    authorizeUrl: process.env.ROBLOX_OAUTH_AUTHORIZE_URL ?? "https://apis.roblox.com/oauth/v1/authorize",
    tokenUrl: process.env.ROBLOX_OAUTH_TOKEN_URL ?? "https://apis.roblox.com/oauth/v1/token",
  };
}

async function resolveLatestCanonicalExportArtifact(input: { userId: string; projectId: string }) {
  const [artifact] = await db
    .select({
      artifactId: exportArtifactsTable.id,
      artifactUrl: exportArtifactsTable.url,
      width: exportArtifactsTable.width,
      height: exportArtifactsTable.height,
    })
    .from(exportJobsTable)
    .innerJoin(exportArtifactsTable, eq(exportArtifactsTable.exportJobId, exportJobsTable.id))
    .where(
      and(
        eq(exportJobsTable.userId, input.userId),
        eq(exportJobsTable.projectId, input.projectId),
        eq(exportJobsTable.format, "png"),
        eq(exportJobsTable.status, "completed"),
      ),
    )
    .orderBy(desc(exportJobsTable.createdAt))
    .limit(1);

  return artifact ?? null;
}

async function appendUploadEvent(tx: DbTransaction, input: {
  uploadJobId: string;
  status: RobloxUploadLifecycleStatus;
  message: string;
  errorCode?: string | null;
}) {
  await tx.insert(robloxUploadEventsTable).values({
    id: randomUUID(),
    uploadJobId: input.uploadJobId,
    status: input.status,
    message: input.message,
    errorCode: input.errorCode ?? null,
  });
}

async function transitionUploadStatus(tx: DbTransaction, input: {
  uploadJobId: string;
  fromStatus: RobloxUploadLifecycleStatus;
  toStatus: RobloxUploadLifecycleStatus;
  robloxAssetId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}) {
  if (!canTransitionRobloxUploadStatus(input.fromStatus, input.toStatus)) {
    return;
  }

  await tx.update(robloxUploadJobsTable).set({
    status: input.toStatus,
    robloxAssetId: input.robloxAssetId ?? null,
    errorCode: input.errorCode ?? null,
    errorMessage: input.errorMessage ?? null,
    completedAt: input.toStatus === "succeeded" || input.toStatus === "failed" ? new Date() : null,
  }).where(eq(robloxUploadJobsTable.id, input.uploadJobId));
}

async function processUploadJob(input: {
  uploadJobId: string;
  projectTitle: string;
  itemType: RobloxUploadableProjectType;
  pngUrl: string;
  connectionAccessToken: string;
}) {
  await db.transaction(async (tx: DbTransaction) => {
    await transitionUploadStatus(tx, {
      uploadJobId: input.uploadJobId,
      fromStatus: "pending",
      toStatus: "processing",
    });

    await appendUploadEvent(tx, {
      uploadJobId: input.uploadJobId,
      status: "processing",
      message: "Uploading classic clothing texture to Roblox.",
    });
  });

  try {
    const result = await uploadClassicClothingToRoblox({
      accessToken: input.connectionAccessToken,
      itemType: input.itemType,
      title: input.projectTitle,
      pngUrl: input.pngUrl,
    });

    await db.transaction(async (tx: DbTransaction) => {
      await transitionUploadStatus(tx, {
        uploadJobId: input.uploadJobId,
        fromStatus: "processing",
        toStatus: "succeeded",
        robloxAssetId: result.assetId,
      });

      await appendUploadEvent(tx, {
        uploadJobId: input.uploadJobId,
        status: "succeeded",
        message: `Upload succeeded. Roblox asset ${result.assetId} is now available${result.moderationStatus ? ` (${result.moderationStatus})` : ""}.`,
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ROBLOX_UPLOAD_FAILED";
    const errorCode = message.split(":")[0] ?? "ROBLOX_UPLOAD_FAILED";

    await db.transaction(async (tx: DbTransaction) => {
      await transitionUploadStatus(tx, {
        uploadJobId: input.uploadJobId,
        fromStatus: "processing",
        toStatus: "failed",
        errorCode,
        errorMessage: message,
      });

      await appendUploadEvent(tx, {
        uploadJobId: input.uploadJobId,
        status: "failed",
        message: "Upload failed. Retry is available once the underlying error is resolved.",
        errorCode,
      });
    });
  }
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

  res.json({
    configured,
    connected: Boolean(connection),
    connection: connection
      ? {
          robloxUserId: connection.robloxUserId,
          robloxUsername: connection.robloxUsername,
          connectedAt: connection.connectedAt,
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

  const { state, verifier, challenge } = createPkcePair();

  await db.insert(robloxOauthStatesTable).values({
    state,
    userId: req.user.id,
    verifier,
    expiresAt: new Date(Date.now() + LOGIN_STATE_TTL_MS),
  });

  try {
    const authorizeUrl = buildRobloxAuthorizeUrl(cfg, state, challenge);
    res.json({ authorizeUrl });
  } catch {
    res.status(503).json({ error: "ROBLOX_NOT_CONFIGURED", message: "Roblox OAuth is not configured." });
  }
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

  try {
    const exchanged = await exchangeRobloxOAuthCode({
      config: robloxConfig(),
      code,
      verifier: entry.verifier,
    });

    await db
      .insert(robloxConnectionsTable)
      .values({
        id: randomUUID(),
        userId: entry.userId,
        robloxUserId: exchanged.robloxUserId,
        robloxUsername: exchanged.robloxUsername,
        accessToken: exchanged.accessToken,
        refreshToken: exchanged.refreshToken,
        tokenType: exchanged.tokenType,
        scope: exchanged.scope,
        tokenExpiresAt: exchanged.expiresInSeconds ? new Date(Date.now() + exchanged.expiresInSeconds * 1000) : null,
      })
      .onConflictDoUpdate({
        target: robloxConnectionsTable.userId,
        set: {
          robloxUserId: exchanged.robloxUserId,
          robloxUsername: exchanged.robloxUsername,
          accessToken: exchanged.accessToken,
          refreshToken: exchanged.refreshToken,
          tokenType: exchanged.tokenType,
          scope: exchanged.scope,
          tokenExpiresAt: exchanged.expiresInSeconds ? new Date(Date.now() + exchanged.expiresInSeconds * 1000) : null,
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

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, req.user.id)));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  if (!isRobloxUploadableProjectType(project.type)) {
    res.status(422).json({
      error: "ROBLOX_UNSUPPORTED_ITEM_TYPE",
      message: `Project type '${project.type}' is preview-only and cannot be uploaded to Roblox in MVP.`,
    });
    return;
  }

  const exportArtifact = await resolveLatestCanonicalExportArtifact({ userId: req.user.id, projectId });
  if (!exportArtifact) {
    res.status(422).json({
      error: "EXPORT_REQUIRED",
      message: "A completed canonical PNG export is required before Roblox upload.",
    });
    return;
  }

  const [connection] = await db
    .select()
    .from(robloxConnectionsTable)
    .where(eq(robloxConnectionsTable.userId, req.user.id));

  const uploadJobId = randomUUID();
  const cfg = robloxConfig();

  await db.transaction(async (tx: DbTransaction) => {
    await tx.insert(robloxUploadJobsTable).values({
      id: uploadJobId,
      userId: req.user.id,
      projectId,
      exportArtifactId: exportArtifact.artifactId,
      itemType: project.type,
      status: "pending",
    });

    await appendUploadEvent(tx, {
      uploadJobId,
      status: "pending",
      message: "Upload job created from latest canonical export.",
    });

    const terminalReason = resolveRobloxUploadBlockedReason({
      configured: Boolean(cfg.clientId && cfg.clientSecret && cfg.redirectUri),
      hasConnectionToken: Boolean(connection?.accessToken),
    });

    if (!terminalReason) return;

    const terminal = deriveRobloxUploadTerminalState(terminalReason);
    await transitionUploadStatus(tx, {
      uploadJobId,
      fromStatus: "pending",
      toStatus: terminal.status,
      errorCode: terminal.errorCode,
      errorMessage: terminal.message,
    });

    await appendUploadEvent(tx, {
      uploadJobId,
      status: terminal.status,
      message: terminal.message,
      errorCode: terminal.errorCode,
    });
  });

  if (connection?.accessToken) {
    void processUploadJob({
      uploadJobId,
      projectTitle: project.title,
      itemType: project.type,
      pngUrl: exportArtifact.artifactUrl,
      connectionAccessToken: connection.accessToken,
    });
  }

  const [job] = await db.select().from(robloxUploadJobsTable).where(eq(robloxUploadJobsTable.id, uploadJobId));
  const events = await db.select().from(robloxUploadEventsTable).where(eq(robloxUploadEventsTable.uploadJobId, uploadJobId));

  res.status(202).json({
    uploadJobId,
    projectId,
    status: job?.status ?? "pending",
    robloxAssetId: job?.robloxAssetId ?? null,
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

  const { uploadJobId } = parsed.data;

  const [job] = await db
    .select()
    .from(robloxUploadJobsTable)
    .where(and(eq(robloxUploadJobsTable.id, uploadJobId), eq(robloxUploadJobsTable.userId, req.user.id)));

  if (!job) {
    res.status(404).json({ error: "Upload job not found" });
    return;
  }

  if (job.status !== "failed") {
    res.status(409).json({ error: "UPLOAD_JOB_NOT_RETRYABLE", message: "Only failed jobs can be retried." });
    return;
  }

  const [connection] = await db.select().from(robloxConnectionsTable).where(eq(robloxConnectionsTable.userId, req.user.id));
  if (!connection?.accessToken) {
    res.status(422).json({ error: "ROBLOX_CONNECTION_REQUIRED", message: "Reconnect Roblox before retry." });
    return;
  }

  const [project] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, job.projectId), eq(projectsTable.userId, req.user.id)));
  if (!project || !isRobloxUploadableProjectType(project.type)) {
    res.status(422).json({ error: "ROBLOX_UNSUPPORTED_ITEM_TYPE" });
    return;
  }

  const exportArtifact = await resolveLatestCanonicalExportArtifact({ userId: req.user.id, projectId: job.projectId });
  if (!exportArtifact) {
    res.status(422).json({ error: "EXPORT_REQUIRED", message: "A completed canonical PNG export is required before retry." });
    return;
  }

  await db.transaction(async (tx: DbTransaction) => {
    await tx.update(robloxUploadJobsTable).set({
      status: "pending",
      retryCount: (job.retryCount ?? 0) + 1,
      completedAt: null,
      errorCode: null,
      errorMessage: null,
      exportArtifactId: exportArtifact.artifactId,
    }).where(eq(robloxUploadJobsTable.id, uploadJobId));

    await appendUploadEvent(tx, {
      uploadJobId,
      status: "pending",
      message: "Retry requested. Upload job moved back to pending.",
    });
  });

  void processUploadJob({
    uploadJobId,
    projectTitle: project.title,
    itemType: project.type,
    pngUrl: exportArtifact.artifactUrl,
    connectionAccessToken: connection.accessToken,
  });

  const [updated] = await db.select().from(robloxUploadJobsTable).where(eq(robloxUploadJobsTable.id, uploadJobId));
  const events = await db.select().from(robloxUploadEventsTable).where(eq(robloxUploadEventsTable.uploadJobId, uploadJobId));
  res.json({ ...updated, uploadJobId: updated?.id, events });
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

  const events = await db.select().from(robloxUploadEventsTable).where(eq(robloxUploadEventsTable.uploadJobId, uploadJobId));
  res.json({ ...job, uploadJobId: job.id, events });
});

router.delete("/roblox/disconnect", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  await db.delete(robloxConnectionsTable).where(eq(robloxConnectionsTable.userId, req.user.id));
  res.json({ success: true, message: "Roblox account disconnected" });
});

export default router;
