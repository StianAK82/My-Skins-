import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";

export const robloxUploadJobsTable = pgTable("roblox_upload_jobs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  projectId: text("project_id").notNull(),
  exportArtifactId: text("export_artifact_id"),
  itemType: text("item_type").notNull(),
  status: text("status").notNull().default("pending"),
  robloxAssetId: text("roblox_asset_id"),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});
