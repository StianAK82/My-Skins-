import { Router, type IRouter } from "express";
import { db, projectsTable } from "@workspace/db";
import { eq, and, desc, count } from "drizzle-orm";
import { randomUUID } from "crypto";

const router: IRouter = Router();

router.get("/projects", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const userId = req.user.id;
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const type = req.query.type as string | undefined;
  const offset = (page - 1) * limit;

  const conditions = [eq(projectsTable.userId, userId)];
  if (type === "shirt" || type === "pants") {
    conditions.push(eq(projectsTable.type, type));
  }

  const where = conditions.length > 1 ? and(...conditions) : conditions[0];

  const [projects, [{ total }]] = await Promise.all([
    db.select().from(projectsTable).where(where).orderBy(desc(projectsTable.updatedAt)).limit(limit).offset(offset),
    db.select({ total: count() }).from(projectsTable).where(where),
  ]);

  res.json({ projects, total: Number(total), page, limit });
});

router.post("/projects", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { title, type, isAiGenerated } = req.body;
  if (!title || !type) {
    res.status(400).json({ error: "title and type are required" });
    return;
  }

  const [project] = await db.insert(projectsTable).values({
    id: randomUUID(),
    userId: req.user.id,
    title,
    type,
    isAiGenerated: isAiGenerated ?? false,
    tags: [],
  }).returning();

  res.status(201).json(project);
});

router.get("/projects/:id", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [project] = await db.select().from(projectsTable).where(
    and(eq(projectsTable.id, id), eq(projectsTable.userId, req.user.id))
  );

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json(project);
});

router.patch("/projects/:id", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { title, isPublic, tags } = req.body;

  const updates: Record<string, unknown> = {};
  if (title != null) updates.title = title;
  if (isPublic != null) updates.isPublic = isPublic;
  if (tags != null) updates.tags = tags;

  const [project] = await db
    .update(projectsTable)
    .set(updates)
    .where(and(eq(projectsTable.id, id), eq(projectsTable.userId, req.user.id)))
    .returning();

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json(project);
});

router.delete("/projects/:id", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [deleted] = await db
    .delete(projectsTable)
    .where(and(eq(projectsTable.id, id), eq(projectsTable.userId, req.user.id)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json({ success: true, message: "Project deleted" });
});

router.post("/projects/:id/duplicate", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

  const [original] = await db.select().from(projectsTable).where(
    and(eq(projectsTable.id, id), eq(projectsTable.userId, req.user.id))
  );

  if (!original) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const [copy] = await db.insert(projectsTable).values({
    id: randomUUID(),
    userId: req.user.id,
    title: `${original.title} (Copy)`,
    type: original.type,
    canvasData: original.canvasData,
    thumbnailUrl: original.thumbnailUrl,
    isPublic: false,
    isAiGenerated: original.isAiGenerated,
    tags: original.tags,
  }).returning();

  res.status(201).json(copy);
});

router.put("/projects/:id/canvas", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const { canvasData, thumbnailUrl } = req.body;

  if (canvasData == null) {
    res.status(400).json({ error: "canvasData is required" });
    return;
  }

  const updates: Record<string, unknown> = { canvasData };
  if (thumbnailUrl != null) updates.thumbnailUrl = thumbnailUrl;

  const [project] = await db
    .update(projectsTable)
    .set(updates)
    .where(and(eq(projectsTable.id, id), eq(projectsTable.userId, req.user.id)))
    .returning();

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json({ success: true, message: "Canvas saved" });
});

export default router;
