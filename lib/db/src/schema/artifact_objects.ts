import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Section M: object-storage provenance for compiled clothing artifacts.
export const artifactObjectsTable = pgTable("artifact_objects", {
  id: text("id").primaryKey(),
  generationId: text("generation_id").notNull(),
  sourceSpecId: text("source_spec_id"),
  exportJobId: text("export_job_id"),
  projectId: text("project_id").notNull(),
  userId: text("user_id").notNull(),
  parentConsentState: text("parent_consent_state").notNull().default("not_required"),
  itemId: text("item_id"),
  artifactClass: text("artifact_class").notNull(),
  pipelineVersion: text("pipeline_version").notNull(),
  compilerVersion: text("compiler_version").notNull(),
  modelVersion: text("model_version"),
  seed: text("seed"),
  sha256: text("sha256").notNull(),
  mimeType: text("mime_type").notNull(),
  byteSize: integer("byte_size").notNull(),
  width: integer("width"),
  height: integer("height"),
  objectPath: text("object_path").notNull(),
  moderationDecision: text("moderation_decision").notNull().default("pending"),
  rightsDecision: text("rights_decision").notNull().default("pending"),
  quarantined: boolean("quarantined").notNull().default(false),
  quarantineReason: text("quarantine_reason"),
  validationReport: text("validation_report"),
  publicationRefs: text("publication_refs").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  retentionDeadline: timestamp("retention_deadline", { withTimezone: true }),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

export type ArtifactObject = typeof artifactObjectsTable.$inferSelect;
export type InsertArtifactObject = typeof artifactObjectsTable.$inferInsert;
