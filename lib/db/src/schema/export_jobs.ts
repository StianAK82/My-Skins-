import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const exportJobsTable = pgTable("export_jobs", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  projectId: text("project_id").notNull(),
  status: text("status").notNull().default("queued"),
  format: text("format").notNull().default("png"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});
