import { desc, eq } from "drizzle-orm";
import { aiGenerationsTable, db } from "@workspace/db";
import { aiDesignSchema, aiHistoryEntrySchema } from "../../lib/ai-contracts";

export class AiHistoryService {
  async listUserHistory(userId: string) {
    const rows = await db.select().from(aiGenerationsTable)
      .where(eq(aiGenerationsTable.userId, userId))
      .orderBy(desc(aiGenerationsTable.createdAt))
      .limit(30);

    return rows.flatMap((row: any) => {
      try {
        return [aiHistoryEntrySchema.parse({
          id: row.id,
          prompt: row.prompt,
          style: row.style,
          type: row.type,
          createdAt: row.createdAt.toISOString(),
          status: "completed",
          result: aiDesignSchema.parse(JSON.parse(row.result)),
        })];
      } catch {
        return [];
      }
    });
  }
}

export const aiHistoryService = new AiHistoryService();
