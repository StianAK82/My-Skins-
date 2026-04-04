import { Router, type IRouter } from "express";
import { and, eq } from "drizzle-orm";
import {
  db,
  projectsTable,
  robloxConnectionsTable,
  robloxUploadEventsTable,
  robloxUploadJobsTable,
  userProfilesTable,
  usersTable,
} from "@workspace/db";
import { createHash, randomBytes, randomUUID } from "crypto";
import { z } from "zod";
import { deriveRobloxUploadTerminalState } from "../lib/lifecycle";

const router: IRouter = Router();

const loginState = new Map<string, { userId: string; verifier: string; createdAt: number }>();
const LOGIN_STATE_TTL_MS = 10 * 60 * 1000;

const uploadSchema = z.object({ projectId: z.string().min(1) });

function base64url(input: Buffer): string {
  return input.toString("base64url");
}

function cleanupExpiredState() {
  const now = Date.now();
  for (const [state, entry] of loginState.entries()) {
    if (now - entry.createdAt > LOGIN_STATE_TTL_MS) loginState.delete(state);
  }
}

function robloxConfig() {
  return {
    clientId: process.env.ROBLOX_CLIENT_ID,
    clientSecret: process.env.ROBLOX_CLIENT_SECRET,
    redirectUri: process.env.ROBLOX_REDIRECT_URI,
    authorizeUrl: process.env.ROBLOX_OAUTH_AUTHORIZE_URL ?? "https://apis.roblox.com/oauth/v1/authorize",
    tokenUrl: process.env.ROBLOX_OAUTH_TOKEN_URL ?? "https://apis.roblox.com/oauth/v1/token",
  };
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
  const configured = Boolean(cfg.clientId && cfg.redirectUri);

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

  cleanupExpiredState();

  const state = base64url(randomBytes(24));
  const verifier = base64url(randomBytes(48));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  loginState.set(state, { userId: req.user.id, verifier, createdAt: Date.now() });

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
  const state = typeof req.query.state === "string" ? req.query.state : "";
  const code = typeof req.query.code === "string" ? req.query.code : "";
  if (!state || !code) {
    res.status(400).json({ error: "Missing state/code" });
    return;
  }

  cleanupExpiredState();
  const entry = loginState.get(state);
  if (!entry) {
    res.status(400).json({ error: "Invalid or expired OAuth state" });
    return;
  }
  loginState.delete(state);

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
      user_id?: string;
      preferred_username?: string;
    };

    await db
      .insert(robloxConnectionsTable)
      .values({
        id: randomUUID(),
        userId: entry.userId,
        robloxUserId: tokenData.user_id ?? "unknown",
        robloxUsername: tokenData.preferred_username ?? "roblox-user",
        accessToken: tokenData.access_token ?? null,
        refreshToken: tokenData.refresh_token ?? null,
      })
      .onConflictDoUpdate({
        target: robloxConnectionsTable.userId,
        set: {
          robloxUserId: tokenData.user_id ?? "unknown",
          robloxUsername: tokenData.preferred_username ?? "roblox-user",
          accessToken: tokenData.access_token ?? null,
          refreshToken: tokenData.refresh_token ?? null,
          connectedAt: new Date(),
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

  const [connection] = await db
    .select()
    .from(robloxConnectionsTable)
    .where(eq(robloxConnectionsTable.userId, req.user.id));

  const uploadJobId = randomUUID();
  const cfg = robloxConfig();

  await db.transaction(async (tx: any) => {
    await tx.insert(robloxUploadJobsTable).values({
      id: uploadJobId,
      userId: req.user.id,
      projectId,
      status: "queued",
    });

    await tx.insert(robloxUploadEventsTable).values({
      id: randomUUID(),
      uploadJobId,
      status: "queued",
      message: "Upload request accepted.",
    });

    if (!cfg.clientId || !cfg.clientSecret || !cfg.redirectUri) {
      const terminal = deriveRobloxUploadTerminalState("not_configured");
      await tx.update(robloxUploadJobsTable).set({ status: terminal.status, completedAt: new Date() }).where(eq(robloxUploadJobsTable.id, uploadJobId));
      await tx.insert(robloxUploadEventsTable).values({
        id: randomUUID(),
        uploadJobId,
        status: terminal.status,
        message: terminal.message,
      });
      return;
    }

    if (!connection?.accessToken) {
      const terminal = deriveRobloxUploadTerminalState("missing_connection");
      await tx.update(robloxUploadJobsTable).set({ status: terminal.status, completedAt: new Date() }).where(eq(robloxUploadJobsTable.id, uploadJobId));
      await tx.insert(robloxUploadEventsTable).values({
        id: randomUUID(),
        uploadJobId,
        status: terminal.status,
        message: terminal.message,
      });
      return;
    }

    const terminal = deriveRobloxUploadTerminalState("activation_pending");
    await tx.update(robloxUploadJobsTable).set({ status: terminal.status, completedAt: new Date() }).where(eq(robloxUploadJobsTable.id, uploadJobId));
    await tx.insert(robloxUploadEventsTable).values({
      id: randomUUID(),
      uploadJobId,
      status: terminal.status,
      message: terminal.message,
    });
  });

  const [job] = await db.select().from(robloxUploadJobsTable).where(eq(robloxUploadJobsTable.id, uploadJobId));
  const events = await db.select().from(robloxUploadEventsTable).where(eq(robloxUploadEventsTable.uploadJobId, uploadJobId));

  res.status(202).json({
    uploadJobId,
    projectId,
    status: job?.status ?? "queued",
    events,
  });
});

router.get("/roblox/upload/:uploadJobId", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const uploadJobId = Array.isArray(req.params.uploadJobId) ? req.params.uploadJobId[0] : req.params.uploadJobId;

  const [job] = await db
    .select()
    .from(robloxUploadJobsTable)
    .where(and(eq(robloxUploadJobsTable.id, uploadJobId), eq(robloxUploadJobsTable.userId, req.user.id)));

  if (!job) {
    res.status(404).json({ error: "Upload job not found" });
    return;
  }

  const events = await db.select().from(robloxUploadEventsTable).where(eq(robloxUploadEventsTable.uploadJobId, uploadJobId));
  res.json({ ...job, events });
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
