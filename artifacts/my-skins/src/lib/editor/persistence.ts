import { defaultAvatarState, designStateSchema, type DesignState } from "./design-state.ts";

function normalizeLayerShape(layer: Record<string, unknown>) {
  const rawTransform = (typeof layer.transform === "object" && layer.transform !== null) ? (layer.transform as Record<string, unknown>) : {};
  return {
    ...layer,
    transform: {
      x: typeof rawTransform.x === "number" ? rawTransform.x : 0,
      y: typeof rawTransform.y === "number" ? rawTransform.y : 0,
      scale: typeof rawTransform.scale === "number" ? rawTransform.scale : 1,
      rotation: typeof rawTransform.rotation === "number" ? rawTransform.rotation : 0,
      opacity: typeof rawTransform.opacity === "number" ? rawTransform.opacity : 1,
      visible: typeof rawTransform.visible === "boolean" ? rawTransform.visible : true,
      locked: typeof rawTransform.locked === "boolean" ? rawTransform.locked : false,
    },
  };
}

function normalizeForPersistence(state: DesignState): DesignState {
  return designStateSchema.parse({
    ...state,
    aiResultSummary: state.aiResultSummary ?? null,
    aiPlanPreview: state.aiPlanPreview.map((layer) => normalizeLayerShape(layer as unknown as Record<string, unknown>)),
    layers: state.layers.map((layer) => normalizeLayerShape(layer as unknown as Record<string, unknown>)),
  }) as DesignState;
}

export function serializeDesignState(state: DesignState): string {
  return JSON.stringify(normalizeForPersistence(state));
}

export function parseDesignState(raw: string): DesignState {
  const parsed = JSON.parse(raw);
  if (parsed?.version === 4) return designStateSchema.parse(parsed) as DesignState;

  if (parsed?.version === 3 || parsed?.version === 2) {
    const defaultAvatar = defaultAvatarState();
    const migrated = {
      ...parsed,
      version: 4 as const,
      layers: Array.isArray(parsed.layers) ? parsed.layers.map((layer: Record<string, unknown>) => normalizeLayerShape(layer)) : [],
      aiPlanPreview: Array.isArray(parsed.aiPlanPreview) ? parsed.aiPlanPreview.map((layer: Record<string, unknown>) => normalizeLayerShape(layer)) : [],
      avatar: parsed.avatar ? { ...defaultAvatar, ...parsed.avatar, slots: { ...defaultAvatar.slots, ...(parsed.avatar?.slots ?? {}) } } : defaultAvatar,
      aiAvatarPreview: parsed.aiAvatarPreview ?? null,
      aiResultSummary: parsed.aiResultSummary ?? null,
    };
    return normalizeForPersistence(designStateSchema.parse(migrated) as DesignState);
  }

  return normalizeForPersistence(designStateSchema.parse(parsed) as DesignState);
}
