import { designStateSchema, type DesignState } from "./design-state";

export function serializeDesignState(state: DesignState): string {
  return JSON.stringify(state);
}

export function parseDesignState(raw: string): DesignState {
  const parsed = JSON.parse(raw);
  return designStateSchema.parse(parsed);
}
