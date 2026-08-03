import { desc, eq } from "drizzle-orm";
import { aiGenerationsTable, db } from "@workspace/db";
import { aiDesignSchema, aiHistoryEntrySchema } from "../../lib/ai-contracts";

export class AiHistoryService {
  async getUserGeneration(_userId: string, _generationId: string): Promise<null> {
    // Canonical replay payload persistence is introduced with the generation-run
    // projection. Until then an active duplicate is reported as in progress and,
    // critically, never reaches a provider or reserves again.
    return null;
  }
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
