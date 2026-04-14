import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const robloxUploadJobsTable = pgTable("roblox_upload_jobs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  projectId: text("project_id").notNull(),
  status: text("status").notNull().default("queued"),
  itemType: text("item_type"),
  exportJobId: text("export_job_id"),
  exportArtifactId: text("export_artifact_id"),
  exportArtifactUrl: text("export_artifact_url"),
  retryCount: integer("retry_count").notNull().default(0),
  lastErrorCode: text("last_error_code"),
  lastErrorMessage: text("last_error_message"),
  robloxAssetId: text("roblox_asset_id"),
  robloxUploadId: text("roblox_upload_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});
