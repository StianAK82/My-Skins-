import type Stripe from "stripe";

export function normalizeCheckoutCompleted(session: Stripe.Checkout.Session): {
  userId: string | null;
  plan: "pro" | "team" | "enterprise";
  providerSubscriptionId: string | null;
} {
  const rawPlan = session.metadata?.plan;
  return {
    userId: session.metadata?.userId ?? session.client_reference_id ?? null,
    plan: rawPlan === "team" || rawPlan === "enterprise" ? rawPlan : "pro",
    providerSubscriptionId: typeof session.subscription === "string" ? session.subscription : null,
  };
}

export function normalizeSubscriptionUpdate(subscription: Stripe.Subscription): {
  id: string;
  status: string;
  currentPeriodEnd: Date | null;
} {
  const subscriptionWithPeriod = subscription as Stripe.Subscription & { current_period_end?: number };
  return {
    id: subscription.id,
    status: subscription.status,
    currentPeriodEnd: subscriptionWithPeriod.current_period_end
      ? new Date(subscriptionWithPeriod.current_period_end * 1000)
      : null,
  };
}

export function normalizeInvoice(invoice: Stripe.Invoice): {
  id: string;
  status: string;
  amountPaid: number;
  providerSubscriptionId: string | null;
} {
  const invoiceWithSubscription = invoice as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null };
  return {
    id: invoice.id ?? "unknown-invoice",
    status: invoice.status ?? "open",
    amountPaid: invoice.amount_paid ?? 0,
    providerSubscriptionId: typeof invoiceWithSubscription.subscription === "string"
      ? invoiceWithSubscription.subscription
      : null,
  };
}
