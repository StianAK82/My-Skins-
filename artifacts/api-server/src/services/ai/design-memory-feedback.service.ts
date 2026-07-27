import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { aiDesignFeedbackTable, db } from "@workspace/db";
import {
  learnedInstructions,
  type DesignFeedback,
  type DesignIssue,
} from "./design-memory";

export async function getLearnedDesignInstructions(
  garmentKey: string,
): Promise<string[]> {
  const rows = await db
    .select({
      issues: aiDesignFeedbackTable.issues,
      accepted: aiDesignFeedbackTable.accepted,
    })
    .from(aiDesignFeedbackTable)
    .where(eq(aiDesignFeedbackTable.garmentKey, garmentKey))
    .orderBy(desc(aiDesignFeedbackTable.createdAt))
    .limit(200);
  return learnedInstructions(rows as DesignFeedback[]);
}

export async function recordDesignFeedback(input: {
  userId: string;
  generationHash: string;
  garmentKey: string;
  issues: DesignIssue[];
  accepted: boolean;
}) {
  const [row] = await db
    .insert(aiDesignFeedbackTable)
    .values({ id: randomUUID(), ...input })
    .returning({ id: aiDesignFeedbackTable.id });
  return row;
}
