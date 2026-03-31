import { Router, type IRouter } from "express";
import { db, exportsTable, projectsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { randomUUID } from "crypto";

const router: IRouter = Router();

router.post("/exports", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const { projectId, format, quality } = req.body;
  if (!projectId || !format) {
    res.status(400).json({ error: "projectId and format are required" });
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

  const isShirt = project.type === "shirt";
  const width = isShirt ? 1024 : 585;
  const height = isShirt ? 512 : 559;

  const [exportRecord] = await db.insert(exportsTable).values({
    id: randomUUID(),
    userId: req.user.id,
    projectId,
    format: format ?? "png",
    width,
    height,
    size: width * height * 4,
    url: project.thumbnailUrl ?? null,
  }).returning();

  res.json({
    id: exportRecord.id,
    projectId: exportRecord.projectId,
    url: exportRecord.url,
    format: exportRecord.format,
    size: exportRecord.size,
    width: exportRecord.width,
    height: exportRecord.height,
    createdAt: exportRecord.createdAt,
  });
});

router.get("/exports", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const exports = await db
    .select()
    .from(exportsTable)
    .where(eq(exportsTable.userId, req.user.id))
    .orderBy(desc(exportsTable.createdAt))
    .limit(20);

  res.json(exports);
});

export default router;
