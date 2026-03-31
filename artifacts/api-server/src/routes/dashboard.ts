import { Router, type IRouter } from "express";
import { db, projectsTable, exportsTable, aiGenerationsTable, robloxConnectionsTable } from "@workspace/db";
import { eq, and, count, desc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const userId = req.user.id;

  const [
    [totalRow],
    [shirtRow],
    [pantsRow],
    [exportsRow],
    [aiRow],
    robloxConn,
  ] = await Promise.all([
    db.select({ total: count() }).from(projectsTable).where(eq(projectsTable.userId, userId)),
    db.select({ total: count() }).from(projectsTable).where(and(eq(projectsTable.userId, userId), eq(projectsTable.type, "shirt"))),
    db.select({ total: count() }).from(projectsTable).where(and(eq(projectsTable.userId, userId), eq(projectsTable.type, "pants"))),
    db.select({ total: count() }).from(exportsTable).where(eq(exportsTable.userId, userId)),
    db.select({ total: count() }).from(aiGenerationsTable).where(eq(aiGenerationsTable.userId, userId)),
    db.select().from(robloxConnectionsTable).where(eq(robloxConnectionsTable.userId, userId)),
  ]);

  res.json({
    totalProjects: Number(totalRow?.total ?? 0),
    shirtProjects: Number(shirtRow?.total ?? 0),
    pantsProjects: Number(pantsRow?.total ?? 0),
    totalExports: Number(exportsRow?.total ?? 0),
    aiGenerations: Number(aiRow?.total ?? 0),
    robloxConnected: robloxConn.length > 0,
  });
});

router.get("/dashboard/recent", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const userId = req.user.id;
  const projects = await db
    .select()
    .from(projectsTable)
    .where(eq(projectsTable.userId, userId))
    .orderBy(desc(projectsTable.updatedAt))
    .limit(6);

  res.json(projects);
});

export default router;
