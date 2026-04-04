import { Router, type IRouter } from "express";
import Stripe from "stripe";
import { and, eq } from "drizzle-orm";
import {
  billingInvoicesTable,
  billingPricesTable,
  billingProductsTable,
  billingSubscriptionsTable,
  creditTransactionsTable,
  db,
  entitlementsTable,
} from "@workspace/db";
import { randomUUID } from "crypto";
import { z } from "zod";

const router: IRouter = Router();

const stripeSecret = process.env.STRIPE_SECRET_KEY;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const appUrl = process.env.APP_URL;

const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

const checkoutSchema = z.object({
  plan: z.enum(["pro", "team", "enterprise"]).default("pro"),
});

const PLAN_PRICE_ENV: Record<"pro" | "team" | "enterprise", string | undefined> = {
  pro: process.env.STRIPE_PRO_PRICE_ID,
  team: process.env.STRIPE_TEAM_PRICE_ID,
  enterprise: process.env.STRIPE_ENTERPRISE_PRICE_ID,
};

function assertStripeEnv(): { stripe: Stripe; appUrl: string } {
  if (!stripe || !appUrl) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY and APP_URL.");
  }
  return { stripe, appUrl };
}

router.post("/payments/create-checkout-session", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = checkoutSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid checkout request", details: parsed.error.flatten() });
    return;
  }

  const { stripe, appUrl } = assertStripeEnv();
  const priceId = PLAN_PRICE_ENV[parsed.data.plan];
  if (!priceId) {
    res.status(503).json({ error: "BILLING_NOT_CONFIGURED", message: `Stripe price ID for ${parsed.data.plan} is not configured.` });
    return;
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/payment-cancelled`,
      metadata: { userId: req.user.id, plan: parsed.data.plan },
      client_reference_id: req.user.id,
    });

    res.json({ checkoutUrl: session.url, sessionId: session.id, plan: parsed.data.plan });
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

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId ?? session.client_reference_id;
      const plan = session.metadata?.plan ?? "pro";
      const providerSubscriptionId = typeof session.subscription === "string" ? session.subscription : null;

      if (userId && providerSubscriptionId) {
        await db.transaction(async (tx: any) => {
          const [existing] = await tx
            .select({ id: billingSubscriptionsTable.id })
            .from(billingSubscriptionsTable)
            .where(eq(billingSubscriptionsTable.providerSubscriptionId, providerSubscriptionId))
            .limit(1);

          if (existing) return;

          await tx.insert(billingSubscriptionsTable).values({
            id: randomUUID(),
            userId,
            providerSubscriptionId,
            status: "active",
          });

          await tx.insert(entitlementsTable).values({
            id: randomUUID(),
            userId,
            key: `plan:${plan}`,
            source: "stripe_subscription",
            status: "active",
          });
        });
      }
    }

    if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      await db
        .update(billingSubscriptionsTable)
        .set({
          status: sub.status,
          currentPeriodEnd: (sub as any).current_period_end ? new Date((sub as any).current_period_end * 1000) : null,
        })
        .where(eq(billingSubscriptionsTable.providerSubscriptionId, sub.id));
    }

    if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const providerInvoiceId = invoice.id;
      const providerSubscriptionId = typeof (invoice as any).subscription === "string" ? (invoice as any).subscription : null;

      await db.transaction(async (tx: any) => {
        const [existing] = await tx
          .select({ id: billingInvoicesTable.id })
          .from(billingInvoicesTable)
          .where(eq(billingInvoicesTable.providerInvoiceId, providerInvoiceId))
          .limit(1);

        if (!existing) {
          const [sub] = providerSubscriptionId
            ? await tx
                .select({ id: billingSubscriptionsTable.id })
                .from(billingSubscriptionsTable)
                .where(eq(billingSubscriptionsTable.providerSubscriptionId, providerSubscriptionId))
                .limit(1)
            : [];

          await tx.insert(billingInvoicesTable).values({
            id: randomUUID(),
            subscriptionId: sub?.id ?? null,
            providerInvoiceId,
            status: invoice.status ?? "open",
            amountPaid: invoice.amount_paid ?? 0,
          });
        }

        if (event.type === "invoice.paid" && providerSubscriptionId) {
          const [sub] = await tx
            .select()
            .from(billingSubscriptionsTable)
            .where(eq(billingSubscriptionsTable.providerSubscriptionId, providerSubscriptionId))
            .limit(1);

          if (sub) {
            const [existingCreditTxn] = await tx
              .select({ id: creditTransactionsTable.id })
              .from(creditTransactionsTable)
              .where(and(eq(creditTransactionsTable.userId, sub.userId), eq(creditTransactionsTable.stripeSessionId, providerInvoiceId)))
              .limit(1);

            if (!existingCreditTxn) {
              await tx.insert(creditTransactionsTable).values({
                userId: sub.userId,
                type: "purchase",
                credits: 10,
                amountNok: Math.round((invoice.amount_paid ?? 0) / 100),
                stripeSessionId: providerInvoiceId,
                uploadId: null,
              });
            }
          }
        }
      });
    }

    if (event.type === "product.created" || event.type === "product.updated") {
      const product = event.data.object as Stripe.Product;
      await db.insert(billingProductsTable).values({
        id: randomUUID(),
        provider: "stripe",
        providerProductId: product.id,
        name: product.name,
        active: String(product.active),
      }).onConflictDoUpdate({
        target: billingProductsTable.providerProductId,
        set: { name: product.name, active: String(product.active) },
      });
    }

    if (event.type === "price.created" || event.type === "price.updated") {
      const price = event.data.object as Stripe.Price;
      await db.insert(billingPricesTable).values({
        id: randomUUID(),
        productId: typeof price.product === "string" ? price.product : "unknown",
        providerPriceId: price.id,
        currency: price.currency,
        amount: price.unit_amount ?? 0,
        interval: price.recurring?.interval ?? null,
      }).onConflictDoUpdate({
        target: billingPricesTable.providerPriceId,
        set: {
          currency: price.currency,
          amount: price.unit_amount ?? 0,
          interval: price.recurring?.interval ?? null,
        },
      });
    }

    res.json({ received: true });
  } catch (error) {
    req.log.error({ err: error, eventId: event.id, type: event.type }, "stripe webhook processing failed");
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

export default router;
