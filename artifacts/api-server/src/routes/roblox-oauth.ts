import { Router, type IRouter, type Request, type Response } from "express";
import crypto from "node:crypto";

// "Logg inn med Roblox" (OAuth 2.0 + PKCE) and direct classic-clothing upload.
//
// NOTE: Roblox's supported Open Cloud Assets API does NOT accept classic
// Shirt/Pants/TShirt asset types (July 2026). The upload endpoint used below
// (itemconfiguration.roblox.com/v1/avatar-assets/{typeId}/upload) is the
// legacy channel that tools like Customuse rely on. It may reject OAuth
// bearer tokens or change without notice — every failure is surfaced to the
// frontend, which falls back to the manual download flow.

const AUTH_URL = "https://apis.roblox.com/oauth/v1/authorize";
const TOKEN_URL = "https://apis.roblox.com/oauth/v1/token";
const USERINFO_URL = "https://apis.roblox.com/oauth/v1/userinfo";
const SCOPES = "openid profile asset:read asset:write";

const SESSION_COOKIE = "robloxOAuth";
const PKCE_COOKIE = "robloxPkce";
const PKCE_TTL = 10 * 60 * 1000;
const SESSION_TTL = 90 * 24 * 60 * 60 * 1000; // refresh tokens last ~6 months; cap at 90 days

// Classic clothing asset type ids
const ASSET_TYPES: Record<string, number> = { shirt: 11, pants: 12, tshirt: 2 };

type RobloxSession = {
  at: string; // access token
  rt: string; // refresh token
  exp: number; // access token expiry (ms epoch)
  name: string;
  sub: string;
  picture?: string;
};

const router: IRouter = Router();

function getClientCreds() {
  const id = process.env.ROBLOX_CLIENT_ID?.trim();
  const secret = process.env.ROBLOX_CLIENT_SECRET?.trim();
  if (!id || !secret) return null;
  return { id, secret };
}

function getOrigin(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
  return `${proto}://${host}`;
}

function callbackUrl(req: Request): string {
  return `${getOrigin(req)}/api/auth/roblox/callback`;
}

function hmac(value: string): string {
  const key = process.env.SESSION_SECRET || "dev-secret";
  return crypto.createHmac("sha256", key).update(value).digest("base64url");
}

function encodeSession(s: RobloxSession): string {
  const payload = Buffer.from(JSON.stringify(s)).toString("base64url");
  return `${payload}.${hmac(payload)}`;
}

function decodeSession(raw: unknown): RobloxSession | null {
  if (typeof raw !== "string") return null;
  const dot = raw.lastIndexOf(".");
  if (dot < 0) return null;
  const payload = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(hmac(payload)))) return null;
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof parsed?.at !== "string" || typeof parsed?.rt !== "string") return null;
    return parsed as RobloxSession;
  } catch {
    return null;
  }
}

function setSessionCookie(res: Response, s: RobloxSession | null) {
  if (!s) {
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    return;
  }
  res.cookie(SESSION_COOKIE, encodeSession(s), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

function safeReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

async function tokenRequest(params: Record<string, string>) {
  const creds = getClientCreds();
  if (!creds) throw new Error("Roblox OAuth is not configured");
  const body = new URLSearchParams({
    client_id: creds.id,
    client_secret: creds.secret,
    ...params,
  });
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`Roblox token endpoint ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  }
  return data as { access_token: string; refresh_token: string; expires_in: number };
}

/** Returns a session with a valid access token, refreshing (and re-setting the cookie) if needed. */
async function ensureFreshSession(req: Request, res: Response): Promise<RobloxSession | null> {
  const session = decodeSession(req.cookies?.[SESSION_COOKIE]);
  if (!session) return null;
  if (session.exp - 60_000 > Date.now()) return session;
  try {
    const tok = await tokenRequest({ grant_type: "refresh_token", refresh_token: session.rt });
    const fresh: RobloxSession = {
      ...session,
      at: tok.access_token,
      rt: tok.refresh_token ?? session.rt,
      exp: Date.now() + (tok.expires_in ?? 900) * 1000,
    };
    setSessionCookie(res, fresh);
    return fresh;
  } catch (err) {
    console.error("[roblox-oauth] refresh failed:", err);
    setSessionCookie(res, null);
    return null;
  }
}

// ---------- Routes ----------

router.get("/auth/roblox/login", (req: Request, res: Response) => {
  const creds = getClientCreds();
  if (!creds) {
    res.status(500).send("Roblox-innlogging er ikke konfigurert ennå.");
    return;
  }
  const state = crypto.randomBytes(16).toString("base64url");
  const verifier = crypto.randomBytes(32).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  const returnTo = safeReturnTo(req.query.returnTo);
  res.cookie(
    PKCE_COOKIE,
    encodeSession({ at: verifier, rt: state, exp: 0, name: returnTo, sub: "" }),
    { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: PKCE_TTL },
  );
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", creds.id);
  url.searchParams.set("redirect_uri", callbackUrl(req));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  res.redirect(url.href);
});

router.get("/auth/roblox/callback", async (req: Request, res: Response) => {
  const pkce = decodeSession(req.cookies?.[PKCE_COOKIE]);
  res.clearCookie(PKCE_COOKIE, { path: "/" });
  const returnTo = safeReturnTo(pkce?.name);
  const fail = (msg: string) => {
    console.error("[roblox-oauth] callback failed:", msg);
    res.redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}robloxLogin=failed`);
  };
  try {
    const code = req.query.code;
    if (typeof code !== "string") return fail("missing code");
    if (!pkce || req.query.state !== pkce.rt) return fail("state mismatch");

    const tok = await tokenRequest({
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl(req),
      code_verifier: pkce.at,
    });

    const uiRes = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    });
    const ui = (await uiRes.json().catch(() => ({}))) as Record<string, unknown>;
    const session: RobloxSession = {
      at: tok.access_token,
      rt: tok.refresh_token,
      exp: Date.now() + (tok.expires_in ?? 900) * 1000,
      name:
        (typeof ui.preferred_username === "string" && ui.preferred_username) ||
        (typeof ui.name === "string" && ui.name) ||
        "Roblox-bruker",
      sub: typeof ui.sub === "string" ? ui.sub : "",
      picture: typeof ui.picture === "string" ? ui.picture : undefined,
    };
    setSessionCookie(res, session);
    res.redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}robloxLogin=ok`);
  } catch (err) {
    fail(String(err));
  }
});

router.get("/auth/roblox/me", async (req: Request, res: Response) => {
  const session = await ensureFreshSession(req, res);
  if (!session) {
    res.json({ loggedIn: false, configured: Boolean(getClientCreds()) });
    return;
  }
  res.json({ loggedIn: true, configured: true, name: session.name, picture: session.picture });
});

router.post("/auth/roblox/logout", (req: Request, res: Response) => {
  setSessionCookie(res, null);
  res.json({ ok: true });
});

// Direct upload of one classic clothing item. Body: { type: "shirt"|"pants"|"tshirt", name, pngDataUrl }
router.post("/auth/roblox/upload", async (req: Request, res: Response) => {
  const session = await ensureFreshSession(req, res);
  if (!session) {
    res.status(401).json({ error: "Ikke logget inn med Roblox" });
    return;
  }
  const { type, name, pngDataUrl } = (req.body ?? {}) as Record<string, unknown>;
  const assetTypeId = typeof type === "string" ? ASSET_TYPES[type] : undefined;
  const m = typeof pngDataUrl === "string" ? pngDataUrl.match(/^data:image\/png;base64,(.+)$/) : null;
  if (!assetTypeId || !m || typeof name !== "string" || !name.trim()) {
    res.status(400).json({ error: "Ugyldig forespørsel" });
    return;
  }
  const png = Buffer.from(m[1], "base64");
  if (png.length > 4 * 1024 * 1024) {
    res.status(400).json({ error: "Bildet er for stort" });
    return;
  }

  try {
    const form = new FormData();
    form.set("name", name.trim().slice(0, 50));
    form.set("description", "Laget med My Skins");
    form.set("file", new Blob([new Uint8Array(png)], { type: "image/png" }), "skin.png");
    const upRes = await fetch(
      `https://itemconfiguration.roblox.com/v1/avatar-assets/${assetTypeId}/upload`,
      { method: "POST", headers: { Authorization: `Bearer ${session.at}` }, body: form },
    );
    const text = await upRes.text();
    if (!upRes.ok) {
      console.error(`[roblox-oauth] upload ${assetTypeId} failed ${upRes.status}: ${text.slice(0, 500)}`);
      res.status(502).json({
        error: "Roblox godtok ikke opplastingen",
        robloxStatus: upRes.status,
        detail: text.slice(0, 300),
      });
      return;
    }
    let assetId: unknown;
    try {
      assetId = (JSON.parse(text) as Record<string, unknown>).assetId;
    } catch {
      /* non-JSON success body */
    }
    res.json({ ok: true, assetId });
  } catch (err) {
    console.error("[roblox-oauth] upload error:", err);
    res.status(502).json({ error: "Fikk ikke kontakt med Roblox. Prøv igjen." });
  }
});

export default router;
