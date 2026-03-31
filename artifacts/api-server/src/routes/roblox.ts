import { Router, type IRouter } from "express";
import { db, robloxConnectionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

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
