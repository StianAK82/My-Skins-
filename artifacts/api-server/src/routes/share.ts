import { Router, type IRouter } from "express";
import { db, shareLinksTable, projectsTable, userProfilesTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { randomUUID } from "crypto";
import { z } from "zod";
import { resolveCreatorIdentity } from "../lib/lifecycle";

const router: IRouter = Router();

const createShareSchema = z.object({
  projectId: z.string().uuid(),
  isPublic: z.boolean().optional(),
});
const shareTokenSchema = z.object({ token: z.string().min(8).max(64) });

router.post("/share", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = createShareSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid share request", details: parsed.error.flatten() });
    return;
  }

  const { projectId, isPublic } = parsed.data;

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
  const parsedToken = shareTokenSchema.safeParse(req.params);
  if (!parsedToken.success) {
    res.status(400).json({ error: "Invalid share token", details: parsedToken.error.flatten() });
    return;
  }
  const { token } = parsedToken.data;

  const [shareLink] = await db
    .select()
    .from(shareLinksTable)
    .where(eq(shareLinksTable.token, token));

  if (!shareLink) {
    res.status(404).json({ error: "Share link not found" });
    return;
  }

  if (!shareLink.isPublic && (!req.isAuthenticated() || req.user.id !== shareLink.userId)) {
    res.status(404).json({ error: "Share link not found" });
    return;
  }

  const [project] = await db.select().from(projectsTable).where(eq(projectsTable.id, shareLink.projectId));
  const [author] = await db.select().from(usersTable).where(eq(usersTable.id, shareLink.userId));
  const [authorProfile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, shareLink.userId));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json({
    project,
    author: resolveCreatorIdentity({
      profileDisplayName: authorProfile?.displayName,
      userFirstName: author?.firstName,
      userDisplayName: author?.displayName,
      profileUsername: authorProfile?.username,
      userEmail: author?.email,
    }),
  });
});

export default router;
