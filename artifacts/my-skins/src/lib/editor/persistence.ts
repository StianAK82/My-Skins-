import { defaultAvatarState, designStateSchema, type DesignState } from "./design-state.ts";

export function serializeDesignState(state: DesignState): string {
  return JSON.stringify(state);
}

export function parseDesignState(raw: string): DesignState {
  const parsed = JSON.parse(raw);
  if (parsed?.version === 4) return designStateSchema.parse(parsed) as DesignState;

  if (parsed?.version === 3 || parsed?.version === 2) {
    const defaultAvatar = defaultAvatarState();
    const migrated = {
      ...parsed,
      version: 4 as const,
      layers: Array.isArray(parsed.layers) ? parsed.layers.map((layer: Record<string, unknown>) => ({ ...layer })) : [],
      aiPlanPreview: Array.isArray(parsed.aiPlanPreview) ? parsed.aiPlanPreview : [],
      avatar: parsed.avatar ? { ...defaultAvatar, ...parsed.avatar, slots: { ...defaultAvatar.slots, ...(parsed.avatar?.slots ?? {}) } } : defaultAvatar,
      aiAvatarPreview: parsed.aiAvatarPreview ?? null,
    };
    return designStateSchema.parse(migrated) as DesignState;
  }

  return designStateSchema.parse(parsed) as DesignState;
}
