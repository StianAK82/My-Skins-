import { Router, type IRouter } from "express";
import { db, artifactObjectsTable, exportArtifactsTable, exportJobsTable, exportsTable, projectsTable } from "@workspace/db";
import { and, desc, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { z } from "zod";
import { toExportJobResponse, type ExportJobRecord } from "../lib/lifecycle";
import { compileClassicClothing, parseDesignSpec, COMPILER_VERSION, PIPELINE_VERSION } from "../lib/clothing-compiler";
import { validateClassicClothing } from "../lib/clothing-validator";
import { getArtifactStore } from "../lib/artifact-storage";
import type { TemplateType } from "../lib/clothing-templates";

const router: IRouter = Router();

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

const createExportSchema = z.object({
  projectId: z.string().uuid(),
  format: z.enum(["png"]).default("png"),
});

const exportJobParamsSchema = z.object({ jobId: z.string().uuid() });

const exportJobRowSchema = z.custom<ExportJobRecord>();

const DOWNLOAD_URL_TTL_SEC = 15 * 60;

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
  const generationId = randomUUID();
  const templateType: TemplateType = project.type === "pants" ? "pants" : "shirt";

  // Compile a real 585x559 PNG server-side from the persisted design state.
  // The thumbnail is never reused as the artifact.
  const design = parseDesignSpec(project.canvasData, templateType);
  const specId = randomUUID();
  const compiled = await compileClassicClothing({ specId, type: templateType, design });

  // Duplicate detection: identical bytes as a previous artifact for a
  // *different* generation of the same project are flagged in the report but
  // do not block re-downloading the same design.
  const priorArtifacts = await db
    .select({ sha256: artifactObjectsTable.sha256 })
    .from(artifactObjectsTable)
    .where(and(eq(artifactObjectsTable.userId, req.user.id), eq(artifactObjectsTable.projectId, projectId)));
  const priorHashes = new Set(priorArtifacts.map((row: { sha256: string }) => row.sha256));

  const report = validateClassicClothing({
    png: compiled.png,
    sha256: compiled.sha256,
    templateType,
  });
  const isDuplicateOfPrior = priorHashes.has(compiled.sha256);

  if (!report.ok) {
    await db.transaction(async (tx: DbTransaction) => {
      await tx.insert(exportJobsTable).values({
        id: exportJobId,
        userId: req.user.id,
        projectId,
        format,
        status: "failed",
        completedAt: new Date(),
      });
    });
    res.status(422).json({
      error: "Generated clothing file failed validation",
      jobId: exportJobId,
      validationReport: report,
    });
    return;
  }

  const store = getArtifactStore();
  const stored = await store.putArtifact({
    bytes: compiled.png,
    mimeType: compiled.mimeType,
    sha256: compiled.sha256,
    keyHint: `${projectId}/${generationId}`,
  });

  const hashVerified = await store.verifyArtifactHash(stored.objectPath, compiled.sha256);
  if (!hashVerified) {
    await store.deleteArtifact(stored.objectPath);
    res.status(500).json({ error: "Stored artifact failed hash verification" });
    return;
  }

  const downloadUrl = await store.createSignedDownloadUrl(stored.objectPath, DOWNLOAD_URL_TTL_SEC);
  const artifactId = randomUUID();
  const artifactObjectId = randomUUID();
  const reportJson = JSON.stringify({ ...report, duplicateOfPriorGeneration: isDuplicateOfPrior });

  await db.transaction(async (tx: DbTransaction) => {
    await tx.insert(exportJobsTable).values({
      id: exportJobId,
      userId: req.user.id,
      projectId,
      format,
      status: "completed",
      completedAt: new Date(),
    });

    await tx.insert(exportArtifactsTable).values({
      id: artifactId,
      exportJobId,
      url: stored.objectPath,
      width: compiled.width,
      height: compiled.height,
      size: compiled.byteSize,
    });

    await tx.insert(artifactObjectsTable).values({
      id: artifactObjectId,
      generationId,
      sourceSpecId: specId,
      exportJobId,
      projectId,
      userId: req.user.id,
      itemId: null,
      artifactClass: compiled.artifactClass,
      pipelineVersion: PIPELINE_VERSION,
      compilerVersion: COMPILER_VERSION,
      modelVersion: project.isAiGenerated ? "gpt-5.2" : null,
      seed: null,
      sha256: compiled.sha256,
      mimeType: compiled.mimeType,
      byteSize: compiled.byteSize,
      width: compiled.width,
      height: compiled.height,
      objectPath: stored.objectPath,
      moderationDecision: "approved",
      rightsDecision: "approved",
      validationReport: reportJson,
    });

    await tx.insert(exportsTable).values({
      id: randomUUID(),
      userId: req.user.id,
      projectId,
      format,
      url: stored.objectPath,
      width: compiled.width,
      height: compiled.height,
      size: compiled.byteSize,
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

  res.status(201).json({
    ...toExportJobResponse(created),
    generationId,
    sourceSpecId: specId,
    artifactClass: compiled.artifactClass,
    sha256: compiled.sha256,
    mimeType: compiled.mimeType,
    downloadUrl,
    downloadUrlExpiresInSec: DOWNLOAD_URL_TTL_SEC,
    validationReport: report,
    duplicateOfPriorGeneration: isDuplicateOfPrior,
  });
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

// Fresh signed, time-limited download URL for a completed export.
// Preview and download resolve to the exact same stored pixels.
router.get("/exports/:jobId/download", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = exportJobParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid export job id", details: parsed.error.flatten() });
    return;
  }

  const [artifact] = await db
    .select({
      objectPath: artifactObjectsTable.objectPath,
      sha256: artifactObjectsTable.sha256,
      quarantined: artifactObjectsTable.quarantined,
      deletedAt: artifactObjectsTable.deletedAt,
    })
    .from(artifactObjectsTable)
    .where(and(eq(artifactObjectsTable.exportJobId, parsed.data.jobId), eq(artifactObjectsTable.userId, req.user.id)))
    .limit(1);

  if (!artifact || artifact.deletedAt) {
    res.status(404).json({ error: "Export artifact not found" });
    return;
  }

  if (artifact.quarantined) {
    res.status(423).json({ error: "Artifact is quarantined" });
    return;
  }

  const store = getArtifactStore();
  const verified = await store.verifyArtifactHash(artifact.objectPath, artifact.sha256);
  if (!verified) {
    await store.quarantineArtifact(artifact.objectPath, "hash_mismatch_on_download");
    await db
      .update(artifactObjectsTable)
      .set({ quarantined: true, quarantineReason: "hash_mismatch_on_download" })
      .where(eq(artifactObjectsTable.objectPath, artifact.objectPath));
    res.status(409).json({ error: "Artifact failed integrity verification" });
    return;
  }

  const downloadUrl = await store.createSignedDownloadUrl(artifact.objectPath, DOWNLOAD_URL_TTL_SEC);
  res.json({ downloadUrl, expiresInSec: DOWNLOAD_URL_TTL_SEC, sha256: artifact.sha256 });
});

export default router;
