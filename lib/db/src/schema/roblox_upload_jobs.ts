import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const robloxUploadJobsTable = pgTable("roblox_upload_jobs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  projectId: text("project_id").notNull(),
  status: text("status").notNull().default("queued"),
  robloxAssetId: text("roblox_asset_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});
