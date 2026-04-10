import * as oidc from "openid-client";
import { z } from "zod";
import { Router, type IRouter, type Request, type Response } from "express";
import { db, usersTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import {
  clearSession,
  getOidcConfig,
  getSessionId,
  createSession,
  deleteSession,
  SESSION_COOKIE,
  SESSION_TTL,
  ISSUER_URL,
  type SessionData,
} from "../lib/auth";

const GetCurrentAuthUserResponse = z.object({
  user: z.object({
    id: z.string(),
    email: z.string().nullable().optional(),
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
    profileImageUrl: z.string().nullable().optional(),
  }).nullable(),
});

const ExchangeMobileAuthorizationCodeBody = z.object({
  code: z.string(),
  code_verifier: z.string(),
  redirect_uri: z.string(),
  state: z.string(),
  nonce: z.string().nullable().optional(),
});

const ExchangeMobileAuthorizationCodeResponse = z.object({
  token: z.string(),
});

const LogoutMobileSessionResponse = z.object({
  success: z.boolean(),
});

const OIDC_COOKIE_TTL = 10 * 60 * 1000;
let authSchemaValidated = false;
let authSchemaDiagnosticLogged = false;

const router: IRouter = Router();

const DEFAULT_AUTH_PROVIDER = "replit";

function getOrigin(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host =
    req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
  return `${proto}://${host}`;
}

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

function setOidcCookie(res: Response, name: string, value: string) {
  res.cookie(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: OIDC_COOKIE_TTL,
  });
}

function getSafeReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

async function upsertUser(claims: Record<string, unknown>) {
  const normalizeOptionalString = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const externalUserId = normalizeOptionalString(claims.sub);
  if (!externalUserId) {
    throw new Error("OIDC claims.sub is missing or invalid");
  }

  const authProvider = normalizeOptionalString(claims.iss) ?? DEFAULT_AUTH_PROVIDER;
  const email = normalizeOptionalString(claims.email)?.toLowerCase() ?? null;
  const updatePayload = {
    authProvider,
    authProviderUserId: externalUserId,
    email,
    firstName: normalizeOptionalString(claims.first_name),
    lastName: normalizeOptionalString(claims.last_name),
    profileImageUrl: normalizeOptionalString(claims.profile_image_url ?? claims.picture),
    updatedAt: new Date(),
  };

  const [userByProvider] = await db
    .select()
    .from(usersTable)
    .where(
      and(
        eq(usersTable.authProvider, authProvider),
        eq(usersTable.authProviderUserId, externalUserId),
      ),
    )
    .limit(1);

  if (userByProvider) {
    const [updated] = await db
      .update(usersTable)
      .set(updatePayload)
      .where(eq(usersTable.id, userByProvider.id))
      .returning();
    return updated;
  }

  if (email) {
    const [userByEmail] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (userByEmail) {
      const canLinkProvider =
        userByEmail.authProvider === authProvider ||
        userByEmail.authProvider === null ||
        userByEmail.authProviderUserId === null;

      if (!canLinkProvider) {
        throw new Error("Email already linked to another auth provider identity");
      }

      const [updated] = await db
        .update(usersTable)
        .set(updatePayload)
        .where(eq(usersTable.id, userByEmail.id))
        .returning();
      return updated;
    }
  }

  try {
    const [inserted] = await db.insert(usersTable).values(updatePayload).returning();
    return inserted;
  } catch {
    const [existing] = await db
      .select()
      .from(usersTable)
      .where(
        and(
          eq(usersTable.authProvider, authProvider),
          eq(usersTable.authProviderUserId, externalUserId),
        ),
      )
      .limit(1);
    if (existing) return existing;
    throw new Error("Unable to create or link user account");
  }
}

async function ensureAuthSchemaReady() {
  if (authSchemaValidated) return;

  const runtimeDbResult = await db.execute(sql<{
    current_database: string;
    current_schema: string;
  }>`
    SELECT current_database() AS current_database, current_schema() AS current_schema
  `);

  const columnsResult = await db.execute(sql<{
    auth_provider: "YES" | "NO";
    auth_provider_user_id: "YES" | "NO";
  }>`
    SELECT
      MAX(CASE WHEN column_name = 'auth_provider' THEN 'YES' ELSE 'NO' END) AS auth_provider,
      MAX(CASE WHEN column_name = 'auth_provider_user_id' THEN 'YES' ELSE 'NO' END) AS auth_provider_user_id
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users'
  `);

  const [columns] = columnsResult.rows;
  const columnsReady =
    Boolean(columns) &&
    columns.auth_provider === "YES" &&
    columns.auth_provider_user_id === "YES";

  const uniqueIndexResult = await db.execute(sql<{ index_exists: boolean }>`
    SELECT EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'users'
        AND indexname = 'users_auth_provider_subject_uidx'
    ) AS index_exists
  `);
  const [uniqueIndex] = uniqueIndexResult.rows;

  if (!columns || columns.auth_provider !== "YES" || columns.auth_provider_user_id !== "YES") {
    throw new Error(
      "users table is missing external identity columns (auth_provider, auth_provider_user_id). Run the 0001_users_external_identity migration.",
    );
  }

  const idDefaultResult = await db.execute(sql<{ column_default: string | null }>`
    SELECT column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'id'
    LIMIT 1
  `);

  const [idDefault] = idDefaultResult.rows;
  const defaultExprRaw = idDefault?.column_default;
  const defaultExpr = typeof defaultExprRaw === "string" ? defaultExprRaw : "";
  const idDefaultIsDbGenerated = /gen_random_uuid\(\)|uuid_generate_v4\(\)/.test(defaultExpr);
  if (!authSchemaDiagnosticLogged) {
    authSchemaDiagnosticLogged = true;
    const [runtimeDb] = runtimeDbResult.rows;
    logger.info(
      {
        authFlowVersion: "external_identity_v1",
        authLookupMode: "users(auth_provider, auth_provider_user_id)",
        runtimeDb: runtimeDb?.current_database ?? "unknown",
        runtimeSchema: runtimeDb?.current_schema ?? "unknown",
        usersColumnsReady: columnsReady,
        usersProviderIndexReady: uniqueIndex?.index_exists ?? false,
        usersIdDbGenerated: idDefaultIsDbGenerated,
        usersIdDefaultExpression: defaultExpr || null,
      },
      "Auth startup diagnostics",
    );
  }

  if (!uniqueIndex?.index_exists) {
    throw new Error(
      "users table is missing users_auth_provider_subject_uidx on (auth_provider, auth_provider_user_id). Run the 0001_users_external_identity migration.",
    );
  }

  if (!/gen_random_uuid\(\)|uuid_generate_v4\(\)/.test(defaultExpr)) {
    throw new Error(
      "users.id must be database-generated (gen_random_uuid/uuid_generate_v4) to avoid assigning provider subject IDs.",
    );
  }

  authSchemaValidated = true;
}

router.get("/auth/user", (req: Request, res: Response) => {
  res.json(
    GetCurrentAuthUserResponse.parse({
      user: req.isAuthenticated() ? req.user : null,
    }),
  );
});

router.get("/login", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;

  const returnTo = getSafeReturnTo(req.query.returnTo);

  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);

  const redirectTo = oidc.buildAuthorizationUrl(config, {
    redirect_uri: callbackUrl,
    scope: "openid email profile offline_access",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "login consent",
    state,
    nonce,
  });

  setOidcCookie(res, "code_verifier", codeVerifier);
  setOidcCookie(res, "nonce", nonce);
  setOidcCookie(res, "state", state);
  setOidcCookie(res, "return_to", returnTo);

  res.redirect(redirectTo.href);
});

// Query params are not validated because the OIDC provider may include
// parameters not expressed in the schema.
router.get("/callback", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;

  const codeVerifier = req.cookies?.code_verifier;
  const nonce = req.cookies?.nonce;
  const expectedState = req.cookies?.state;

  if (!codeVerifier || !expectedState) {
    res.redirect("/api/login");
    return;
  }

  const currentUrl = new URL(
    `${callbackUrl}?${new URL(req.url, `http://${req.headers.host}`).searchParams}`,
  );

  let tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers;
  try {
    tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedNonce: nonce,
      expectedState,
      idTokenExpected: true,
    });
  } catch {
    res.redirect("/api/login");
    return;
  }

  const returnTo = getSafeReturnTo(req.cookies?.return_to);

  res.clearCookie("code_verifier", { path: "/" });
  res.clearCookie("nonce", { path: "/" });
  res.clearCookie("state", { path: "/" });
  res.clearCookie("return_to", { path: "/" });

  const claims = tokens.claims();
  if (!claims) {
    res.redirect("/api/login");
    return;
  }

  await ensureAuthSchemaReady();
  const dbUser = await upsertUser(
    claims as unknown as Record<string, unknown>,
  );

  const now = Math.floor(Date.now() / 1000);
  const sessionData: SessionData = {
    user: {
      id: dbUser.id,
      email: dbUser.email ?? "",
      username: dbUser.email?.split("@")[0],
      displayName: [dbUser.firstName, dbUser.lastName].filter(Boolean).join(" ") || undefined,
      avatarUrl: dbUser.profileImageUrl ?? undefined,
      plan: "free",
      aiCredits: dbUser.credits ?? 0,
      createdAt: dbUser.createdAt,
    },
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : claims.exp,
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);
  res.redirect(returnTo);
});

router.get("/logout", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const origin = getOrigin(req);

  const sid = getSessionId(req);
  await clearSession(res, sid);

  const endSessionUrl = oidc.buildEndSessionUrl(config, {
    client_id: process.env.REPL_ID!,
    post_logout_redirect_uri: origin,
  });

  res.redirect(endSessionUrl.href);
});

router.post(
  "/mobile-auth/token-exchange",
  async (req: Request, res: Response) => {
    const parsed = ExchangeMobileAuthorizationCodeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Missing or invalid required parameters" });
      return;
    }

    const { code, code_verifier, redirect_uri, state, nonce } = parsed.data;

    try {
      const config = await getOidcConfig();

      const callbackUrl = new URL(redirect_uri);
      callbackUrl.searchParams.set("code", code);
      callbackUrl.searchParams.set("state", state);
      callbackUrl.searchParams.set("iss", ISSUER_URL);

      const tokens = await oidc.authorizationCodeGrant(config, callbackUrl, {
        pkceCodeVerifier: code_verifier,
        expectedNonce: nonce ?? undefined,
        expectedState: state,
        idTokenExpected: true,
      });

      const claims = tokens.claims();
      if (!claims) {
        res.status(401).json({ error: "No claims in ID token" });
        return;
      }

      await ensureAuthSchemaReady();
      const dbUser = await upsertUser(
        claims as unknown as Record<string, unknown>,
      );

      const now = Math.floor(Date.now() / 1000);
      const sessionData: SessionData = {
        user: {
          id: dbUser.id,
          email: dbUser.email ?? "",
          username: dbUser.email?.split("@")[0],
          displayName: [dbUser.firstName, dbUser.lastName].filter(Boolean).join(" ") || undefined,
          avatarUrl: dbUser.profileImageUrl ?? undefined,
          plan: "free",
          aiCredits: dbUser.credits ?? 0,
          createdAt: dbUser.createdAt,
        },
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : claims.exp,
      };

      const sid = await createSession(sessionData);
      res.json(ExchangeMobileAuthorizationCodeResponse.parse({ token: sid }));
    } catch (err) {
      req.log.error({ err }, "Mobile token exchange error");
      res.status(500).json({ error: "Token exchange failed" });
    }
  },
);

router.post("/mobile-auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  if (sid) {
    await deleteSession(sid);
  }
  res.json(LogoutMobileSessionResponse.parse({ success: true }));
});

export default router;
