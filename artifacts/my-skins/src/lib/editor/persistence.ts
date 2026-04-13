import { designStateSchema, type DesignState } from "./design-state.ts";

export function serializeDesignState(state: DesignState): string {
  return JSON.stringify(state);
}

export function parseDesignState(raw: string): DesignState {
  const parsed = JSON.parse(raw);
  if (parsed?.version !== 2) return designStateSchema.parse(parsed);

  const migrated = {
    ...parsed,
    version: 3 as const,
    layers: Array.isArray(parsed.layers) ? parsed.layers.map((layer: Record<string, unknown>) => ({ ...layer })) : [],
    aiPlanPreview: Array.isArray(parsed.aiPlanPreview) ? parsed.aiPlanPreview : [],
  };
  return designStateSchema.parse(migrated);
}
