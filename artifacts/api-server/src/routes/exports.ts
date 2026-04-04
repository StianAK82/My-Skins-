import { Router, type IRouter } from "express";
import { db, exportArtifactsTable, exportJobsTable, exportsTable, projectsTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { z } from "zod";
import { resolveExportDimensions, toExportJobResponse, type ExportJobRecord } from "../lib/lifecycle";

const router: IRouter = Router();

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const createExportSchema = z.object({
  projectId: z.string().uuid(),
  format: z.enum(["png"]).default("png"),
});

const exportJobParamsSchema = z.object({ jobId: z.string().uuid() });

const exportJobRowSchema = z.custom<ExportJobRecord>();

router.post("/exports", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = createExportSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid export request", details: parsed.error.flatten() });
    return;
  }

  const { projectId, format } = parsed.data;

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, req.user.id)));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const exportJobId = randomUUID();
  const artifactId = randomUUID();

  const { width, height } = resolveExportDimensions(project.type);
  const artifactUrl = project.thumbnailUrl ?? null;

  await db.transaction(async (tx: DbTransaction) => {
    await tx.insert(exportJobsTable).values({
      id: exportJobId,
      userId: req.user.id,
      projectId,
      format,
      status: "processing",
    });

    if (artifactUrl) {
      await tx.insert(exportArtifactsTable).values({
        id: artifactId,
        exportJobId,
        url: artifactUrl,
        width,
        height,
        size: width * height * 4,
      });
    }

    await tx.update(exportJobsTable).set({
      status: artifactUrl ? "completed" : "failed",
      completedAt: new Date(),
    }).where(eq(exportJobsTable.id, exportJobId));

    await tx.insert(exportsTable).values({
      id: randomUUID(),
      userId: req.user.id,
      projectId,
      format,
      url: artifactUrl,
      width,
      height,
      size: width * height * 4,
    });
  });

  const [created] = await db
    .select({
      jobId: exportJobsTable.id,
      projectId: exportJobsTable.projectId,
      format: exportJobsTable.format,
      status: exportJobsTable.status,
      createdAt: exportJobsTable.createdAt,
      completedAt: exportJobsTable.completedAt,
      artifactId: exportArtifactsTable.id,
      artifactUrl: exportArtifactsTable.url,
      width: exportArtifactsTable.width,
      height: exportArtifactsTable.height,
      size: exportArtifactsTable.size,
    })
    .from(exportJobsTable)
    .leftJoin(exportArtifactsTable, eq(exportArtifactsTable.exportJobId, exportJobsTable.id))
    .where(and(eq(exportJobsTable.id, exportJobId), eq(exportJobsTable.userId, req.user.id)))
    .limit(1);

  res.status(201).json(toExportJobResponse(created));
});

router.get("/exports", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const jobs = await db
    .select({
      jobId: exportJobsTable.id,
      projectId: exportJobsTable.projectId,
      format: exportJobsTable.format,
      status: exportJobsTable.status,
      createdAt: exportJobsTable.createdAt,
      completedAt: exportJobsTable.completedAt,
      artifactId: exportArtifactsTable.id,
      artifactUrl: exportArtifactsTable.url,
      width: exportArtifactsTable.width,
      height: exportArtifactsTable.height,
      size: exportArtifactsTable.size,
    })
    .from(exportJobsTable)
    .leftJoin(exportArtifactsTable, eq(exportArtifactsTable.exportJobId, exportJobsTable.id))
    .where(eq(exportJobsTable.userId, req.user.id))
    .orderBy(desc(exportJobsTable.createdAt))
    .limit(20);

  res.json(jobs.map((job: ExportJobRecord) => toExportJobResponse(exportJobRowSchema.parse(job))));
});

router.get("/exports/:jobId", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = exportJobParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid export job id", details: parsed.error.flatten() });
    return;
  }

  const { jobId } = parsed.data;

  const [job] = await db
    .select({
      jobId: exportJobsTable.id,
      projectId: exportJobsTable.projectId,
      format: exportJobsTable.format,
      status: exportJobsTable.status,
      createdAt: exportJobsTable.createdAt,
      completedAt: exportJobsTable.completedAt,
      artifactId: exportArtifactsTable.id,
      artifactUrl: exportArtifactsTable.url,
      width: exportArtifactsTable.width,
      height: exportArtifactsTable.height,
      size: exportArtifactsTable.size,
    })
    .from(exportJobsTable)
    .leftJoin(exportArtifactsTable, eq(exportArtifactsTable.exportJobId, exportJobsTable.id))
    .where(and(eq(exportJobsTable.id, jobId), eq(exportJobsTable.userId, req.user.id)));

  if (!job) {
    res.status(404).json({ error: "Export job not found" });
    return;
  }

  res.json(toExportJobResponse(exportJobRowSchema.parse(job)));
});

export default router;
