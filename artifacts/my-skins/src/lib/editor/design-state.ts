import { create } from "zustand";
import { z } from "zod";

export type TemplateType = "shirt" | "pants";
export type ToolType = "templates" | "uploads" | "media" | "aiMedia" | "accessories" | "text" | "draw";
export type LayerType = "imageLayer" | "textLayer" | "brushLayer" | "accessoryLayer" | "paintLayerSet" | "moduleLayer";

export type LayerTransform = { x: number; y: number; scale: number; rotation: number; opacity: number; visible: boolean; locked: boolean };
export type BrushPoint = { x: number; y: number; size: number; opacity: number; softness: number; erase?: boolean };

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
  version: 3;
  template: TemplateType;
  activeTool: ToolType;
  activeZone: string;
  selectedLayerId: string | null;
  layers: DesignLayer[];
  preview: { split: boolean; mode: "2d" | "3d" | "split"; bodyType: "blocky" | "boy" | "girl"; view: "front" | "back" };
  paintSwatch: string;
  aiPlanPreview: DesignLayer[];
};

const defaultTransform = (): LayerTransform => ({ x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, visible: true, locked: false });

const initialState: DesignState = {
  version: 3,
  template: "shirt",
  activeTool: "templates",
  activeZone: "front",
  selectedLayerId: null,
  layers: [],
  preview: { split: true, mode: "split", bodyType: "blocky", view: "front" },
  paintSwatch: "#ef4444",
  aiPlanPreview: [],
};

type DesignStore = {
  state: DesignState;
  setTool: (tool: ToolType) => void;
  setTemplate: (template: TemplateType) => void;
  setZone: (zone: string) => void;
  setPreviewMode: (mode: DesignState["preview"]["mode"]) => void;
  setBodyType: (bodyType: DesignState["preview"]["bodyType"]) => void;
  setView: (view: DesignState["preview"]["view"]) => void;
  setPaintSwatch: (hex: string) => void;
  addLayer: (layer: Omit<DesignLayer, "id" | "transform"> & { id?: string; transform?: Partial<LayerTransform> }) => void;
  patchLayer: (id: string, patch: Partial<DesignLayer>) => void;
  reorderLayer: (id: string, direction: "up" | "down") => void;
  duplicateLayer: (id: string) => void;
  deleteLayer: (id: string) => void;
  selectLayer: (id: string | null) => void;
  addBrushPoint: (layerId: string, point: BrushPoint) => void;
  setAiPlanPreview: (layers: DesignLayer[]) => void;
  applyAiPlan: () => void;
  loadSnapshot: (snapshot: DesignState) => void;
};

function uid(prefix: string) { return `${prefix}_${Math.random().toString(36).slice(2, 10)}`; }

export const designStateSchema = z.object({
  version: z.literal(3),
  template: z.enum(["shirt", "pants"]),
  activeTool: z.enum(["templates", "uploads", "media", "aiMedia", "accessories", "text", "draw"]),
  activeZone: z.string(),
  selectedLayerId: z.string().nullable(),
  paintSwatch: z.string(),
  preview: z.object({ split: z.boolean(), mode: z.enum(["2d", "3d", "split"]), bodyType: z.enum(["blocky", "boy", "girl"]), view: z.enum(["front", "back"]) }),
  aiPlanPreview: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(["imageLayer", "textLayer", "brushLayer", "accessoryLayer", "paintLayerSet", "moduleLayer"]),
    zone: z.string(),
    assetId: z.string().optional(),
    assetCategory: z.string().optional(),
    color: z.string().optional(),
    image: z.string().optional(),
    text: z.string().optional(),
    fontSize: z.number().optional(),
    points: z.array(z.object({ x: z.number(), y: z.number(), size: z.number(), opacity: z.number(), softness: z.number(), erase: z.boolean().optional() })).optional(),
    transform: z.object({ x: z.number(), y: z.number(), scale: z.number(), rotation: z.number(), opacity: z.number(), visible: z.boolean(), locked: z.boolean() }),
  })),
  layers: z.array(z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(["imageLayer", "textLayer", "brushLayer", "accessoryLayer", "paintLayerSet", "moduleLayer"]),
    zone: z.string(),
    assetId: z.string().optional(),
    assetCategory: z.string().optional(),
    color: z.string().optional(),
    image: z.string().optional(),
    text: z.string().optional(),
    fontSize: z.number().optional(),
    points: z.array(z.object({ x: z.number(), y: z.number(), size: z.number(), opacity: z.number(), softness: z.number(), erase: z.boolean().optional() })).optional(),
    transform: z.object({ x: z.number(), y: z.number(), scale: z.number(), rotation: z.number(), opacity: z.number(), visible: z.boolean(), locked: z.boolean() }),
  })),
});

export const useDesignStore = create<DesignStore>((set) => ({
  state: initialState,
  setTool: (tool) => set((s) => ({ state: { ...s.state, activeTool: tool } })),
  setTemplate: (template) => set((s) => ({ state: { ...s.state, template } })),
  setZone: (zone) => set((s) => ({ state: { ...s.state, activeZone: zone } })),
  setPreviewMode: (mode) => set((s) => ({ state: { ...s.state, preview: { ...s.state.preview, mode, split: mode === "split" } } })),
  setBodyType: (bodyType) => set((s) => ({ state: { ...s.state, preview: { ...s.state.preview, bodyType } } })),
  setView: (view) => set((s) => ({ state: { ...s.state, preview: { ...s.state.preview, view } } })),
  setPaintSwatch: (hex) => set((s) => ({ state: { ...s.state, paintSwatch: hex } })),
  addLayer: (layer) => set((s) => ({ state: { ...s.state, layers: [...s.state.layers, { ...layer, id: layer.id ?? uid("layer"), transform: { ...defaultTransform(), ...layer.transform } }] } })),
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
    return { state: { ...s.state, layers: [...s.state.layers, { ...layer, id: uid("layer"), name: `${layer.name} copy` }] } };
  }),
  deleteLayer: (id) => set((s) => ({ state: { ...s.state, layers: s.state.layers.filter((layer) => layer.id !== id), selectedLayerId: s.state.selectedLayerId === id ? null : s.state.selectedLayerId } })),
  selectLayer: (id) => set((s) => ({ state: { ...s.state, selectedLayerId: id } })),
  addBrushPoint: (layerId, point) => set((s) => ({ state: { ...s.state, layers: s.state.layers.map((layer) => layer.id === layerId ? { ...layer, points: [...(layer.points ?? []), point] } : layer) } })),
  setAiPlanPreview: (layers) => set((s) => ({ state: { ...s.state, aiPlanPreview: layers } })),
  applyAiPlan: () => set((s) => ({ state: { ...s.state, layers: [...s.state.layers, ...s.state.aiPlanPreview.map((layer) => ({ ...layer, id: uid("layer") }))], aiPlanPreview: [] } })),
  loadSnapshot: (snapshot) => set(() => ({ state: snapshot })),
}));
