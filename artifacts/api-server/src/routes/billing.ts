import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import { billingInvoicesTable, billingSubscriptionsTable, db, entitlementsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/billing/state", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [subscription] = await db
    .select()
    .from(billingSubscriptionsTable)
    .where(eq(billingSubscriptionsTable.userId, req.user.id))
    .orderBy(desc(billingSubscriptionsTable.createdAt))
    .limit(1);

  const entitlements = await db
    .select()
    .from(entitlementsTable)
    .where(eq(entitlementsTable.userId, req.user.id))
    .orderBy(desc(entitlementsTable.createdAt));

  const invoices = subscription
    ? await db
        .select()
        .from(billingInvoicesTable)
        .where(eq(billingInvoicesTable.subscriptionId, subscription.id))
        .orderBy(desc(billingInvoicesTable.createdAt))
        .limit(20)
    : [];

  res.json({
    plans: ["free", "pro", "team", "enterprise"],
    subscription: subscription ?? null,
    entitlements,
    invoices,
  });
});

export default router;
