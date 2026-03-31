import { Router, type IRouter } from "express";
import { db, shareLinksTable, projectsTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";

const router: IRouter = Router();

router.post("/share", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { projectId, isPublic } = req.body;
  if (!projectId) {
    res.status(400).json({ error: "projectId is required" });
    return;
  }

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, req.user.id)));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const token = randomUUID().replace(/-/g, "").slice(0, 16);

  const [shareLink] = await db.insert(shareLinksTable).values({
    id: randomUUID(),
    token,
    projectId,
    userId: req.user.id,
    isPublic: isPublic ?? true,
  }).returning();

  res.status(201).json({
    id: shareLink.id,
    token: shareLink.token,
    projectId: shareLink.projectId,
    isPublic: shareLink.isPublic,
    url: `/share/${shareLink.token}`,
    createdAt: shareLink.createdAt,
  });
});

router.get("/share/:token", async (req, res): Promise<void> => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;

  const [shareLink] = await db
    .select()
    .from(shareLinksTable)
    .where(eq(shareLinksTable.token, token));

  if (!shareLink) {
    res.status(404).json({ error: "Share link not found" });
    return;
  }

  if (!shareLink.isPublic) {
    if (!req.isAuthenticated() || req.user.id !== shareLink.userId) {
      res.status(404).json({ error: "Share link not found" });
      return;
    }
  }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, shareLink.projectId));
  const [author] = await db.select().from(usersTable).where(eq(usersTable.id, shareLink.userId));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json({
    project,
    author: {
      displayName: author?.displayName ?? "Creator",
      username: author?.username ?? null,
    },
  });
});

export default router;
