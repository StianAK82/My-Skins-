import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const robloxUploadEventsTable = pgTable("roblox_upload_events", {
  id: text("id").primaryKey(),
  uploadJobId: text("upload_job_id").notNull(),
  status: text("status").notNull(),
  code: text("code"),
  message: text("message"),
  detail: text("detail"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
