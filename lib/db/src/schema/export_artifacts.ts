import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const exportArtifactsTable = pgTable("export_artifacts", {
  id: text("id").primaryKey(),
  exportJobId: text("export_job_id").notNull(),
  url: text("url").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  size: integer("size").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
