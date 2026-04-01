import { Router, type IRouter } from "express";
import Stripe from "stripe";
import { and, eq, sql } from "drizzle-orm";
import { creditTransactionsTable, db, usersTable } from "@workspace/db";

const router: IRouter = Router();

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const priceId = process.env.STRIPE_PRICE_ID;
const appUrl = process.env.APP_URL;

const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

function assertStripeEnv(): { stripe: Stripe; priceId: string; appUrl: string } {
  if (!stripe || !priceId || !appUrl) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY, STRIPE_PRICE_ID and APP_URL.");
  }
  return { stripe, priceId, appUrl };
}

router.post("/payments/create-checkout-session", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const { stripe, priceId, appUrl } = assertStripeEnv();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/payment-cancelled`,
      metadata: { userId: req.user.id, credits: "1" },
      client_reference_id: req.user.id,
    });

    res.json({ checkoutUrl: session.url, sessionId: session.id });
  } catch (error) {
    req.log.error({ err: error }, "create checkout session failed");
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

router.post("/payments/webhook", async (req, res): Promise<void> => {
  if (!stripe || !webhookSecret) {
    res.status(500).json({ error: "Stripe webhook is not configured." });
    return;
  }

  const signature = req.headers["stripe-signature"];
  if (!signature || typeof signature !== "string") {
    res.status(400).json({ error: "Missing stripe signature" });
    return;
  }

  let event: Stripe.Event;
  try {
    const payload = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    req.log.warn({ err: error }, "invalid stripe webhook signature");
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  if (event.type !== "checkout.session.completed") {
    res.json({ received: true });
    return;
  }

  const session = event.data.object as Stripe.Checkout.Session;
  const userId = session.metadata?.userId ?? session.client_reference_id;

  if (!userId || !session.id) {
    req.log.warn({ sessionId: session.id }, "missing metadata in checkout session");
    res.json({ received: true });
    return;
  }

  try {
    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: creditTransactionsTable.id })
        .from(creditTransactionsTable)
        .where(and(
          eq(creditTransactionsTable.stripeSessionId, session.id),
          eq(creditTransactionsTable.type, "purchase"),
        ))
        .limit(1);

      if (existing) {
        return;
      }

      await tx
        .update(usersTable)
        .set({ credits: sql`${usersTable.credits} + 1` })
        .where(eq(usersTable.id, userId));

      await tx.insert(creditTransactionsTable).values({
        userId,
        type: "purchase",
        credits: 1,
        amountNok: 10,
        stripeSessionId: session.id,
        uploadId: null,
      });
    });

    res.json({ received: true });
  } catch (error) {
    req.log.error({ err: error, sessionId: session.id }, "stripe webhook processing failed");
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default router;
