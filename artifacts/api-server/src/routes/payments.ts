import { Router, type IRouter, type Request, type Response } from "express";
import type Stripe from "stripe";
import { getUncachableStripeClient } from "../lib/stripeClient";

const router: IRouter = Router();

const FREE_COOKIE = "skinFreeUploads";
const CREDITS_COOKIE = "skinPaidCredits";
const PAID_SESSIONS_COOKIE = "skinPaidSessions"; // comma-separated list of already-granted session ids
const PENDING_SESSION_COOKIE = "skinPendingSession"; // checkout session created for this browser
const MAX_TRACKED_SESSIONS = 20;
const FREE_LIMIT = 0; // no free uploads – every upload requires paid credits
const CREDITS_PER_PURCHASE = 3;
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000;
const COOKIE_OPTS = { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: COOKIE_MAX_AGE };

// The user's Stripe Payment Link for "3 skins / 10 NOK" – we reuse its price for checkout.
const PAYMENT_LINK_URL = "https://buy.stripe.com/7sY6oK5HQ8mj3nAg8l7ss02";

// Fallback if the payment link can't be found (e.g. different Stripe mode).
const SKIN_PRODUCT_NAME = "My Skins – 3 Roblox skin-opplastinger";
const SKIN_PRICE_AMOUNT = 1000; // 10.00 NOK, in øre
const SKIN_PRICE_CURRENCY = "nok";

function readIntCookie(req: Request, name: string): number {
  const raw = Number(req.cookies?.[name] ?? "0");
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
}

function statusPayload(req: Request) {
  const freeUsed = readIntCookie(req, FREE_COOKIE);
  const paidCredits = readIntCookie(req, CREDITS_COOKIE);
  return {
    freeUsed,
    freeLimit: FREE_LIMIT,
    remainingFree: Math.max(0, FREE_LIMIT - freeUsed),
    paidCredits,
    creditsPerPurchase: CREDITS_PER_PURCHASE,
    priceAmount: SKIN_PRICE_AMOUNT,
    priceCurrency: SKIN_PRICE_CURRENCY,
  };
}

function appBaseUrl(req: Request): string {
  const host = req.get("x-forwarded-host") ?? req.get("host");
  const proto = req.get("x-forwarded-proto") ?? req.protocol;
  return `${proto}://${host}`;
}

let cachedPriceId: string | null = null;

/**
 * Resolves the Stripe price to charge: preferably the price behind the user's
 * Payment Link (so pricing is managed in Stripe), otherwise a lazily created
 * 10 NOK one-time price. Never uses inline price_data.
 */
async function getSkinPriceId(stripe: Stripe): Promise<string> {
  if (cachedPriceId) return cachedPriceId;

  const links = await stripe.paymentLinks.list({ active: true, limit: 100 });
  const link = links.data.find((l) => l.url === PAYMENT_LINK_URL);
  if (link) {
    const items = await stripe.paymentLinks.listLineItems(link.id, { limit: 1 });
    const price = items.data[0]?.price;
    if (price?.id) {
      cachedPriceId = price.id;
      return price.id;
    }
  }

  const products = await stripe.products.search({
    query: `name:'${SKIN_PRODUCT_NAME}' AND active:'true'`,
  });
  let product = products.data[0];
  if (!product) {
    product = await stripe.products.create({
      name: SKIN_PRODUCT_NAME,
      description: "Låser opp 3 nedlastinger/opplastinger av Roblox-skins.",
      metadata: { kind: "skin_upload_pack" },
    });
  }
  const prices = await stripe.prices.list({ product: product.id, active: true, limit: 10 });
  const match = prices.data.find(
    (p) => p.unit_amount === SKIN_PRICE_AMOUNT && p.currency === SKIN_PRICE_CURRENCY && !p.recurring,
  );
  const price =
    match ??
    (await stripe.prices.create({
      product: product.id,
      unit_amount: SKIN_PRICE_AMOUNT,
      currency: SKIN_PRICE_CURRENCY,
    }));
  cachedPriceId = price.id;
  return price.id;
}

// How many uploads remain (free + paid) for this browser.
router.get("/payments/skin-status", (req: Request, res: Response): void => {
  res.json(statusPayload(req));
});

// Consume one upload: free allotment first, then paid credits. 402 when empty.
router.post("/payments/consume-free", (req: Request, res: Response): void => {
  const freeUsed = readIntCookie(req, FREE_COOKIE);
  const paidCredits = readIntCookie(req, CREDITS_COOKIE);

  if (freeUsed < FREE_LIMIT) {
    res.cookie(FREE_COOKIE, String(freeUsed + 1), COOKIE_OPTS);
    res.json({ ok: true, remainingFree: FREE_LIMIT - freeUsed - 1, paidCredits });
    return;
  }
  if (paidCredits > 0) {
    res.cookie(CREDITS_COOKIE, String(paidCredits - 1), COOKIE_OPTS);
    res.json({ ok: true, remainingFree: 0, paidCredits: paidCredits - 1 });
    return;
  }
  res.status(402).json({ error: "FREE_LIMIT_REACHED", needsPayment: true });
});

// Create a one-time Stripe Checkout session for a 3-upload pack (10 NOK).
router.post("/payments/create-checkout-session", async (req: Request, res: Response): Promise<void> => {
  try {
    const stripe = await getUncachableStripeClient();
    const priceId = await getSkinPriceId(stripe);
    const base = appBaseUrl(req);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${base}/?paid={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/?cancelled=1`,
    });
    // Bind the session to this browser so only the purchaser can claim the credits.
    res.cookie(PENDING_SESSION_COOKIE, session.id, COOKIE_OPTS);
    res.json({ checkoutUrl: session.url });
  } catch (error) {
    req.log.error({ err: error }, "create skin checkout session failed");
    res.status(500).json({ error: "Kunne ikke starte betaling. Prøv igjen." });
  }
});

// Verify a completed checkout session; grants 3 paid credits once per session.
router.get("/payments/verify", async (req: Request, res: Response): Promise<void> => {
  const sessionId = typeof req.query.session_id === "string" ? req.query.session_id : "";
  if (!sessionId) {
    res.status(400).json({ error: "Missing session_id" });
    return;
  }
  // Only the browser that started this checkout may claim its credits.
  if (req.cookies?.[PENDING_SESSION_COOKIE] !== sessionId) {
    res.status(400).json({ error: "UNKNOWN_SESSION" });
    return;
  }
  try {
    const stripe = await getUncachableStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paid = session.payment_status === "paid";

    let paidCredits = readIntCookie(req, CREDITS_COOKIE);
    const granted = String(req.cookies?.[PAID_SESSIONS_COOKIE] ?? "").split(",").filter(Boolean);
    if (paid && !granted.includes(sessionId)) {
      paidCredits += CREDITS_PER_PURCHASE;
      granted.push(sessionId);
      res.cookie(CREDITS_COOKIE, String(paidCredits), COOKIE_OPTS);
      res.cookie(PAID_SESSIONS_COOKIE, granted.slice(-MAX_TRACKED_SESSIONS).join(","), COOKIE_OPTS);
      res.clearCookie(PENDING_SESSION_COOKIE, { path: "/" });
    }
    res.json({ paid, paidCredits });
  } catch (error) {
    req.log.error({ err: error }, "verify skin checkout session failed");
    res.status(500).json({ error: "Kunne ikke bekrefte betaling." });
  }
});

export default router;
