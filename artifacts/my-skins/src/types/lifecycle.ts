export type LifecycleStatus = "queued" | "processing" | "completed" | "degraded" | "failed";

export interface AiLifecycleMeta {
  generationId: string;
  status: LifecycleStatus;
  warnings: string[];
  deprecated?: boolean;
}
