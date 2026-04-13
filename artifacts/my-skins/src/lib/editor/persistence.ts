import { designStateSchema, type DesignState } from "./design-state.ts";

export function serializeDesignState(state: DesignState): string {
  return JSON.stringify(state);
}

export function parseDesignState(raw: string): DesignState {
  const parsed = JSON.parse(raw);
  if (parsed?.version === 2) {
    parsed.version = 3;
    parsed.layers = (parsed.layers ?? []).map((layer: Record<string, unknown>) => ({ ...layer, type: layer.type === "moduleLayer" ? "moduleLayer" : layer.type }));
    parsed.aiPlanPreview = parsed.aiPlanPreview ?? [];
  }
  return designStateSchema.parse(parsed);
}
