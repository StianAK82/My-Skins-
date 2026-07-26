import { Router, type IRouter } from "express";
import type Stripe from "stripe";
import { getUncachableStripeClient } from "../lib/stripeClient";

const router: IRouter = Router();

const FREE_COOKIE = "skinFreeUploads";
const FREE_LIMIT = 3;
const FREE_COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000;

// Fixed one-time price for unlocking a Roblox skin upload.
const SKIN_PRODUCT_NAME = "My Skins – Roblox skin-opplasting";
const SKIN_PRICE_AMOUNT = 1000; // 10.00 NOK, in øre
const SKIN_PRICE_CURRENCY = "nok";

function readFreeUses(req: { cookies?: Record<string, string> }): number {
  const raw = Number(req.cookies?.[FREE_COOKIE] ?? "0");
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
}

function appBaseUrl(req: { protocol: string; get(name: string): string | undefined }): string {
  const host = req.get("x-forwarded-host") ?? req.get("host");
  const proto = req.get("x-forwarded-proto") ?? req.protocol;
  return `${proto}://${host}`;
}

/**
 * Finds (or lazily creates) the one-time Stripe price used to unlock a skin upload.
 * Returns the real price ID so checkout never uses inline price_data.
 */
async function getSkinPriceId(stripe: Stripe): Promise<string> {
  const products = await stripe.products.search({
    query: `name:'${SKIN_PRODUCT_NAME}' AND active:'true'`,
  });

  let product = products.data[0];
  if (!product) {
    product = await stripe.products.create({
      name: SKIN_PRODUCT_NAME,
      description: "Låser opp nedlasting og opplasting av ett Roblox-skin.",
      metadata: { kind: "skin_upload" },
    });
  }

  const prices = await stripe.prices.list({ product: product.id, active: true, limit: 10 });
  const match = prices.data.find(
    (p) => p.unit_amount === SKIN_PRICE_AMOUNT && p.currency === SKIN_PRICE_CURRENCY && !p.recurring,
  );
  if (match) return match.id;

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: SKIN_PRICE_AMOUNT,
    currency: SKIN_PRICE_CURRENCY,
  });
  return price.id;
}

// How many free uploads remain for this browser + the price of a paid one.
router.get("/payments/skin-status", (req, res): void => {
  const freeUsed = readFreeUses(req);
  res.json({
    freeUsed,
    freeLimit: FREE_LIMIT,
    remainingFree: Math.max(0, FREE_LIMIT - freeUsed),
    priceAmount: SKIN_PRICE_AMOUNT,
    priceCurrency: SKIN_PRICE_CURRENCY,
  });
});

// Consume one free upload. Fails with 402 when the free allotment is used up.
router.post("/payments/consume-free", (req, res): void => {
  const freeUsed = readFreeUses(req);
  if (freeUsed >= FREE_LIMIT) {
    res.status(402).json({ error: "FREE_LIMIT_REACHED", needsPayment: true });
    return;
  }
  const next = freeUsed + 1;
  res.cookie(FREE_COOKIE, String(next), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: FREE_COOKIE_MAX_AGE,
  });
  res.json({ ok: true, freeUsed: next, remainingFree: Math.max(0, FREE_LIMIT - next) });
});

// Create a one-time Stripe Checkout session for a single skin upload.
router.post("/payments/create-checkout-session", async (req, res): Promise<void> => {
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
    res.json({ checkoutUrl: session.url });
  } catch (error) {
    req.log.error({ err: error }, "create skin checkout session failed");
    res.status(500).json({ error: "Kunne ikke starte betaling. Prøv igjen." });
  }
});

// Verify a completed checkout session before unlocking the upload.
router.get("/payments/verify", async (req, res): Promise<void> => {
  const sessionId = typeof req.query.session_id === "string" ? req.query.session_id : "";
  if (!sessionId) {
    res.status(400).json({ error: "Missing session_id" });
    return;
  }
  try {
    const stripe = await getUncachableStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paid = session.payment_status === "paid";
    res.json({ paid });
  } catch (error) {
    req.log.error({ err: error }, "verify skin checkout session failed");
    res.status(500).json({ error: "Kunne ikke bekrefte betaling." });
  }
});

export default router;
