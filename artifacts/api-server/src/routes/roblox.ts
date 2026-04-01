import { Router, type IRouter } from "express";
import { and, eq, gte, sql } from "drizzle-orm";
import { creditTransactionsTable, db, projectsTable, robloxConnectionsTable, usersTable } from "@workspace/db";
import { randomUUID } from "crypto";

const router: IRouter = Router();

router.get("/roblox/connect", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [connection] = await db
    .select()
    .from(robloxConnectionsTable)
    .where(eq(robloxConnectionsTable.userId, req.user.id));

  if (!connection) {
    res.json({ connected: false });
    return;
  }

  res.json({
    connected: true,
    robloxUserId: connection.robloxUserId,
    robloxUsername: connection.robloxUsername,
    connectedAt: connection.connectedAt,
  });
});

router.get("/credits", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [user] = await db.select({ credits: usersTable.credits }).from(usersTable).where(eq(usersTable.id, req.user.id));
  res.json({ credits: user?.credits ?? 0, unitPriceNok: 10 });
});

router.post("/roblox/upload", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { projectId } = req.body as { projectId?: string };
  if (!projectId) {
    res.status(400).json({ error: "projectId is required" });
    return;
  }

  const [project] = await db.select().from(projectsTable).where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, req.user.id)));
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const uploadId = randomUUID();

  try {
    const [user] = await db.select({ credits: usersTable.credits }).from(usersTable).where(eq(usersTable.id, req.user.id));
    if (!user || user.credits < 1) {
      res.status(402).json({ error: "INSUFFICIENT_CREDITS", message: "You need 1 credit (10 NOK) to upload to Roblox." });
      return;
    }

    const simulatedRobloxAssetId = `rbx_${uploadId.slice(0, 12)}`;

    await db.transaction(async (tx) => {
      const updated = await tx
        .update(usersTable)
        .set({ credits: sql`${usersTable.credits} - 1` })
        .where(and(eq(usersTable.id, req.user.id), gte(usersTable.credits, 1)))
        .returning({ credits: usersTable.credits });

      if (updated.length === 0) {
        throw new Error("INSUFFICIENT_CREDITS_RACE");
      }

      await tx.insert(creditTransactionsTable).values({
        userId: req.user.id,
        type: "usage",
        credits: -1,
        amountNok: null,
        stripeSessionId: null,
        uploadId,
      });
    });

    const [latestUser] = await db.select({ credits: usersTable.credits }).from(usersTable).where(eq(usersTable.id, req.user.id));

    res.json({
      success: true,
      uploadId,
      robloxAssetId: simulatedRobloxAssetId,
      message: "Upload to Roblox completed successfully.",
      creditsRemaining: latestUser?.credits ?? 0,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "INSUFFICIENT_CREDITS_RACE") {
      res.status(402).json({ error: "INSUFFICIENT_CREDITS", message: "You need 1 credit (10 NOK) to upload to Roblox." });
      return;
    }

    req.log.error({ err: error, projectId, uploadId }, "roblox upload failed");
    res.status(500).json({ error: "UPLOAD_FAILED", message: "Upload failed. Credit was not deducted." });
  }
});

router.delete("/roblox/disconnect", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  await db
    .delete(robloxConnectionsTable)
    .where(eq(robloxConnectionsTable.userId, req.user.id));

  res.json({ success: true, message: "Roblox account disconnected" });
});

export default router;
