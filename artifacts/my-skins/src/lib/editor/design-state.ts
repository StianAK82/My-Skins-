import { create } from "zustand";
import { z } from "zod";

export type TemplateType = "shirt" | "pants";
export type ToolType = "templates" | "uploads" | "media" | "aiMedia" | "accessories" | "text" | "draw";
export type LayerType = "imageLayer" | "textLayer" | "brushLayer" | "accessoryLayer" | "paintLayerSet" | "moduleLayer";
export type AvatarModelVariant = "classic_blocky" | "proportioned_r15" | "heroic";
export type AvatarPresentation = "neutral" | "masculine" | "feminine" | "androgynous";
export type AvatarPose = "idle" | "hero" | "walk";
export type AvatarScalePreset = "standard" | "slender" | "stocky";
export type AvatarCosmeticSlot = "face" | "hair" | "hat" | "neck" | "leftShoulder" | "rightShoulder" | "back" | "leftFootwear" | "rightFootwear" | "aura";

export type LayerTransform = { x: number; y: number; scale: number; rotation: number; opacity: number; visible: boolean; locked: boolean };
export type BrushPoint = { x: number; y: number; size: number; opacity: number; softness: number; erase?: boolean };
export type AvatarSlotItem = {
  assetId: string;
  color?: string;
  scale: number;
  offset: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  visible: boolean;
};

export type AvatarState = {
  modelVariant: AvatarModelVariant;
  presentation: AvatarPresentation;
  skinTone: string;
  pose: AvatarPose;
  scalePreset: AvatarScalePreset;
  bodyScale: { height: number; width: number; head: number; legs: number };
  slots: Record<AvatarCosmeticSlot, AvatarSlotItem | null>;
};

export type AvatarStatePatch = Partial<Omit<AvatarState, "slots">> & { slots?: Partial<Record<AvatarCosmeticSlot, AvatarSlotItem | null>> };

export type DesignLayer = {
  id: string;
  name: string;
  type: LayerType;
  zone: string;
  assetId?: string;
  assetCategory?: string;
  color?: string;
  image?: string;
  text?: string;
  fontSize?: number;
  points?: BrushPoint[];
  transform: LayerTransform;
};

export type DesignState = {
  version: 4;
  template: TemplateType;
  activeTool: ToolType;
  activeZone: string;
  selectedLayerId: string | null;
  layers: DesignLayer[];
  preview: { split: boolean; mode: "2d" | "3d" | "split"; bodyType: "blocky" | "boy" | "girl"; view: "front" | "back" };
  avatar: AvatarState;
  baseColor?: string;
  paintSwatch: string;
  aiPlanPreview: DesignLayer[];
  aiAvatarPreview: AvatarStatePatch | null;
  aiResultSummary: {
    exportable: string[];
    previewOnly: string[];
    appliedTargets: string[];
  } | null;
};

const defaultTransform = (): LayerTransform => ({ x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, visible: true, locked: false });

export const defaultAvatarState = (): AvatarState => ({
  modelVariant: "proportioned_r15",
  presentation: "neutral",
  skinTone: "#f1c27d",
  pose: "idle",
  scalePreset: "standard",
  bodyScale: { height: 1, width: 1, head: 1, legs: 1 },
  slots: {
    face: { assetId: "face_confident", scale: 1, visible: true, offset: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
    hair: null,
    hat: null,
    neck: null,
    leftShoulder: null,
    rightShoulder: null,
    back: null,
    leftFootwear: { assetId: "footwear_runner_black", scale: 1, visible: true, offset: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
    rightFootwear: { assetId: "footwear_runner_black_right", scale: 1, visible: true, offset: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } },
    aura: null,
  },
});

const initialState: DesignState = {
  version: 4,
  template: "shirt",
  activeTool: "templates",
  activeZone: "front",
  selectedLayerId: null,
  layers: [],
  preview: { split: true, mode: "split", bodyType: "blocky", view: "front" },
  avatar: defaultAvatarState(),
  baseColor: undefined,
  paintSwatch: "#ef4444",
  aiPlanPreview: [],
  aiAvatarPreview: null,
  aiResultSummary: null,
};

type DesignStore = {
  state: DesignState;
  setTool: (tool: ToolType) => void;
  setTemplate: (template: TemplateType) => void;
  setZone: (zone: string) => void;
  setPreviewMode: (mode: DesignState["preview"]["mode"]) => void;
  setBodyType: (bodyType: DesignState["preview"]["bodyType"]) => void;
  setView: (view: DesignState["preview"]["view"]) => void;
  setAvatarPatch: (patch: AvatarStatePatch) => void;
  setAvatarSlot: (slot: AvatarCosmeticSlot, item: AvatarSlotItem | null) => void;
  setPaintSwatch: (hex: string) => void;
  setBaseColor: (hex: string) => void;
  addLayer: (layer: Omit<DesignLayer, "id" | "transform"> & { id?: string; transform?: Partial<LayerTransform> }) => void;
  patchLayer: (id: string, patch: Partial<DesignLayer>) => void;
  reorderLayer: (id: string, direction: "up" | "down") => void;
  duplicateLayer: (id: string) => void;
  deleteLayer: (id: string) => void;
  selectLayer: (id: string | null) => void;
  addBrushPoint: (layerId: string, point: BrushPoint) => void;
  setAiPlanPreview: (layers: DesignLayer[]) => void;
  setAiAvatarPreview: (avatar: AvatarStatePatch | null) => void;
  setAiResultSummary: (summary: DesignState["aiResultSummary"]) => void;
  applyAiPlan: () => void;
  loadSnapshot: (snapshot: DesignState) => void;
};

function uid(prefix: string) { return `${prefix}_${Math.random().toString(36).slice(2, 10)}`; }

function defaultZoneForTemplate(template: TemplateType) {
  return template === "pants" ? "left_leg_front" : "front";
}

const avatarSlotItemSchema = z.object({
  assetId: z.string(),
  color: z.string().optional(),
  scale: z.number(),
  offset: z.object({ x: z.number(), y: z.number(), z: z.number() }),
  rotation: z.object({ x: z.number(), y: z.number(), z: z.number() }),
  visible: z.boolean(),
});

export const designStateSchema = z.object({
  version: z.literal(4),
  template: z.enum(["shirt", "pants"]),
  activeTool: z.enum(["templates", "uploads", "media", "aiMedia", "accessories", "text", "draw"]),
  activeZone: z.string(),
  selectedLayerId: z.string().nullable(),
  baseColor: z.string().optional(),
  paintSwatch: z.string(),
  preview: z.object({ split: z.boolean(), mode: z.enum(["2d", "3d", "split"]), bodyType: z.enum(["blocky", "boy", "girl"]), view: z.enum(["front", "back"]) }),
  avatar: z.object({
    modelVariant: z.enum(["classic_blocky", "proportioned_r15", "heroic"]),
    presentation: z.enum(["neutral", "masculine", "feminine", "androgynous"]),
    skinTone: z.string(),
    pose: z.enum(["idle", "hero", "walk"]),
    scalePreset: z.enum(["standard", "slender", "stocky"]),
    bodyScale: z.object({ height: z.number(), width: z.number(), head: z.number(), legs: z.number() }),
    slots: z.object({
      face: avatarSlotItemSchema.nullable(),
      hair: avatarSlotItemSchema.nullable(),
      hat: avatarSlotItemSchema.nullable(),
      neck: avatarSlotItemSchema.nullable(),
      leftShoulder: avatarSlotItemSchema.nullable(),
      rightShoulder: avatarSlotItemSchema.nullable(),
      back: avatarSlotItemSchema.nullable(),
      leftFootwear: avatarSlotItemSchema.nullable(),
      rightFootwear: avatarSlotItemSchema.nullable(),
      aura: avatarSlotItemSchema.nullable(),
    }),
  }),
  aiAvatarPreview: z.object({
    modelVariant: z.enum(["classic_blocky", "proportioned_r15", "heroic"]).optional(),
    presentation: z.enum(["neutral", "masculine", "feminine", "androgynous"]).optional(),
    skinTone: z.string().optional(),
    pose: z.enum(["idle", "hero", "walk"]).optional(),
    scalePreset: z.enum(["standard", "slender", "stocky"]).optional(),
    bodyScale: z.object({ height: z.number(), width: z.number(), head: z.number(), legs: z.number() }).optional(),
    slots: z.object({
      face: avatarSlotItemSchema.nullable().optional(),
      hair: avatarSlotItemSchema.nullable().optional(),
      hat: avatarSlotItemSchema.nullable().optional(),
      neck: avatarSlotItemSchema.nullable().optional(),
      leftShoulder: avatarSlotItemSchema.nullable().optional(),
      rightShoulder: avatarSlotItemSchema.nullable().optional(),
      back: avatarSlotItemSchema.nullable().optional(),
      leftFootwear: avatarSlotItemSchema.nullable().optional(),
      rightFootwear: avatarSlotItemSchema.nullable().optional(),
      aura: avatarSlotItemSchema.nullable().optional(),
    }).optional(),
  }).nullable(),
  aiResultSummary: z.object({
    exportable: z.array(z.string()),
    previewOnly: z.array(z.string()),
    appliedTargets: z.array(z.string()),
  }).nullable().optional().default(null),
  aiPlanPreview: z.array(z.object({
    id: z.string(), name: z.string(), type: z.enum(["imageLayer", "textLayer", "brushLayer", "accessoryLayer", "paintLayerSet", "moduleLayer"]), zone: z.string(),
    assetId: z.string().optional(), assetCategory: z.string().optional(), color: z.string().optional(), image: z.string().optional(), text: z.string().optional(), fontSize: z.number().optional(),
    points: z.array(z.object({ x: z.number(), y: z.number(), size: z.number(), opacity: z.number(), softness: z.number(), erase: z.boolean().optional() })).optional(),
    transform: z.object({ x: z.number(), y: z.number(), scale: z.number(), rotation: z.number(), opacity: z.number(), visible: z.boolean(), locked: z.boolean() }),
  })),
  layers: z.array(z.object({
    id: z.string(), name: z.string(), type: z.enum(["imageLayer", "textLayer", "brushLayer", "accessoryLayer", "paintLayerSet", "moduleLayer"]), zone: z.string(),
    assetId: z.string().optional(), assetCategory: z.string().optional(), color: z.string().optional(), image: z.string().optional(), text: z.string().optional(), fontSize: z.number().optional(),
    points: z.array(z.object({ x: z.number(), y: z.number(), size: z.number(), opacity: z.number(), softness: z.number(), erase: z.boolean().optional() })).optional(),
    transform: z.object({ x: z.number(), y: z.number(), scale: z.number(), rotation: z.number(), opacity: z.number(), visible: z.boolean(), locked: z.boolean() }),
  })),
});

export const useDesignStore = create<DesignStore>((set) => ({
  state: initialState,
  setTool: (tool) => set((s) => ({ state: { ...s.state, activeTool: tool } })),
  setTemplate: (template) => set((s) => ({ state: { ...s.state, template, activeZone: defaultZoneForTemplate(template) } })),
  setZone: (zone) => set((s) => ({ state: { ...s.state, activeZone: zone } })),
  setPreviewMode: (mode) => set((s) => ({ state: { ...s.state, preview: { ...s.state.preview, mode, split: mode === "split" } } })),
  setBodyType: (bodyType) => set((s) => ({ state: { ...s.state, preview: { ...s.state.preview, bodyType } } })),
  setView: (view) => set((s) => ({ state: { ...s.state, preview: { ...s.state.preview, view } } })),
  setAvatarPatch: (patch) => set((s) => ({ state: { ...s.state, avatar: { ...s.state.avatar, ...patch, slots: { ...s.state.avatar.slots, ...patch.slots } } } })),
  setAvatarSlot: (slot, item) => set((s) => ({ state: { ...s.state, avatar: { ...s.state.avatar, slots: { ...s.state.avatar.slots, [slot]: item } } } })),
  setPaintSwatch: (hex) => set((s) => ({ state: { ...s.state, paintSwatch: hex } })),
  setBaseColor: (hex) => set((s) => ({ state: { ...s.state, baseColor: hex, paintSwatch: hex } })),
  addLayer: (layer) => set((s) => {
    const newLayer = { ...layer, id: layer.id ?? uid("layer"), transform: { ...defaultTransform(), ...layer.transform } };
    return { state: { ...s.state, layers: [...s.state.layers, newLayer], selectedLayerId: newLayer.id } };
  }),
  patchLayer: (id, patch) => set((s) => ({ state: { ...s.state, layers: s.state.layers.map((layer) => (layer.id === id ? { ...layer, ...patch } : layer)) } })),
  reorderLayer: (id, direction) => set((s) => {
    const index = s.state.layers.findIndex((layer) => layer.id === id);
    if (index < 0) return s;
    const target = direction === "up" ? index + 1 : index - 1;
    if (target < 0 || target >= s.state.layers.length) return s;
    const next = [...s.state.layers];
    [next[index], next[target]] = [next[target], next[index]];
    return { state: { ...s.state, layers: next } };
  }),
  duplicateLayer: (id) => set((s) => {
    const layer = s.state.layers.find((candidate) => candidate.id === id);
    if (!layer) return s;
    const copy = { ...layer, id: uid("layer"), name: `${layer.name} copy` };
    return { state: { ...s.state, layers: [...s.state.layers, copy], selectedLayerId: copy.id } };
  }),
  deleteLayer: (id) => set((s) => ({ state: { ...s.state, layers: s.state.layers.filter((layer) => layer.id !== id), selectedLayerId: s.state.selectedLayerId === id ? null : s.state.selectedLayerId } })),
  selectLayer: (id) => set((s) => ({ state: { ...s.state, selectedLayerId: id } })),
  addBrushPoint: (layerId, point) => set((s) => ({ state: { ...s.state, layers: s.state.layers.map((layer) => layer.id === layerId ? { ...layer, points: [...(layer.points ?? []), point] } : layer) } })),
  setAiPlanPreview: (layers) => set((s) => ({ state: { ...s.state, aiPlanPreview: layers } })),
  setAiAvatarPreview: (avatar) => set((s) => ({ state: { ...s.state, aiAvatarPreview: avatar } })),
  setAiResultSummary: (summary) => set((s) => ({ state: { ...s.state, aiResultSummary: summary } })),
  applyAiPlan: () => set((s) => {
    const appliedLayers = s.state.aiPlanPreview.map((layer) => ({ ...layer, id: uid("layer") }));
    const nextAvatar = s.state.aiAvatarPreview ? {
      ...s.state.avatar,
      ...s.state.aiAvatarPreview,
      slots: { ...s.state.avatar.slots, ...s.state.aiAvatarPreview.slots },
    } : s.state.avatar;
    return {
      state: {
        ...s.state,
        avatar: nextAvatar,
        layers: [...s.state.layers, ...appliedLayers],
        selectedLayerId: appliedLayers.at(-1)?.id ?? s.state.selectedLayerId,
        aiPlanPreview: [],
        aiAvatarPreview: null,
        aiResultSummary: s.state.aiResultSummary,
      },
    };
  }),
  loadSnapshot: (snapshot) => set(() => ({ state: snapshot })),
}));
