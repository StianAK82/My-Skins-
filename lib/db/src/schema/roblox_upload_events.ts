import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const robloxUploadEventsTable = pgTable("roblox_upload_events", {
  id: text("id").primaryKey(),
  uploadJobId: text("upload_job_id").notNull(),
  status: text("status").notNull(),
  message: text("message"),
  errorCode: text("error_code"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
