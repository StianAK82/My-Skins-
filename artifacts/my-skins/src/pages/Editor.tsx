import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useParams, Link } from "wouter";
import * as fabric from "fabric";
import { useGetProject, useSaveCanvas, useCreateExport, useGetMe } from "@workspace/api-client-react";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { AiPanel } from "@/components/editor/AiPanel";
import { AvatarPreview } from "@/components/editor/AvatarPreview";
import {
  Save, Download, ArrowLeft, Image as ImageIcon, Type, Square, Circle,
  PenTool, Trash2, ZoomIn, ZoomOut, Layers, Sparkles, ChevronDown, X, Copy, Lock, Unlock, MoveUp, MoveDown, Grid3X3, Group, Ungroup, User, Shirt, LayoutTemplate, Wand2, Boxes, Palette, SlidersHorizontal
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { normalizeAiResponse, type NormalizedAiResponse } from "@/lib/ai/normalize-ai-response";
import { createCheckoutSession } from "@/lib/billing/billing-client";
import { uploadToRoblox } from "@/lib/roblox/upload-client";
import { buildEditorApplyPlan } from "@/lib/ai/editor-apply-plan";
import type { StylizedOutfitConcept } from "@/lib/ai/stylized-outfit-client";

interface AiConcept {
  title?: string;
  concept?: string;
  description?: string;
  mood?: string;
  style?: string;
  primaryColor?: string;
  backgroundColor?: string;
  colors?: Array<{ hex: string; name: string; role?: string }>;
  keyElements?: string[];
  designTips?: string[];
}

interface TemplateZone {
  key: string;
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

interface ModuleDefinition {
  id: string;
  name: string;
  category: string;
  shape: "rect" | "circle" | "stripe";
  color: string;
}

type StylePreset = "streetwear" | "anime" | "sport" | "cyberpunk" | "minimal";
type EditorMetaState = { avatar?: { avatarType?: string; bodyType?: string }; creationMode?: string; stylePreset?: StylePreset };
type FabricObjectMeta = { role?: string; layerName?: string; zone?: string; moduleId?: string };
type AiOutputMode = "classic_2d" | "stylized_outfit";
type GarmentMaterial = "cotton" | "denim" | "nylon";
type ZoneKey =
  | "front"
  | "back"
  | "left_sleeve"
  | "right_sleeve"
  | "left_leg_front"
  | "right_leg_front"
  | "left_leg_back"
  | "right_leg_back";

const MODULE_LIBRARY: ModuleDefinition[] = [
  { id: "mod-sleeve-stripe", name: "Sleeve Stripe", category: "Clothing Parts", shape: "stripe", color: "#ef4444" },
  { id: "mod-pocket", name: "Pocket", category: "Clothing Parts", shape: "rect", color: "#334155" },
  { id: "mod-collar", name: "Collar", category: "Clothing Parts", shape: "rect", color: "#0f172a" },
  { id: "mod-flame", name: "Flame Emblem", category: "Graphics", shape: "circle", color: "#f97316" },
  { id: "mod-star", name: "Star Emblem", category: "Graphics", shape: "circle", color: "#facc15" },
  { id: "mod-cyber", name: "Cyber Trim", category: "Patterns", shape: "stripe", color: "#22d3ee" },
  { id: "mod-fade", name: "Fade Band", category: "Patterns", shape: "stripe", color: "#1d4ed8" },
  { id: "mod-neon-glow", name: "Neon Glow", category: "Effects", shape: "circle", color: "#a855f7" },
  { id: "mod-speed-lines", name: "Speed Lines", category: "Effects", shape: "stripe", color: "#14b8a6" },
  { id: "mod-backpack", name: "Backpack Mark", category: "Accessories", shape: "rect", color: "#10b981" },
  { id: "mod-chain", name: "Chain Accent", category: "Accessories", shape: "stripe", color: "#cbd5e1" },
];
const STYLE_PRESET_VALUES: StylePreset[] = ["streetwear", "anime", "sport", "cyberpunk", "minimal"];

const TEMPLATE_ZONES: Record<"shirt" | "pants", Record<ZoneKey, TemplateZone>> = {
  shirt: {
    front: { key: "front", label: "Front", left: 196, top: 118, width: 128, height: 128 },
    back: { key: "back", label: "Back", left: 338, top: 118, width: 128, height: 128 },
    left_sleeve: { key: "left_sleeve", label: "Left Sleeve", left: 44, top: 118, width: 128, height: 128 },
    right_sleeve: { key: "right_sleeve", label: "Right Sleeve", left: 441, top: 118, width: 128, height: 128 },
    left_leg_front: { key: "left_leg_front", label: "Left Leg Front", left: 196, top: 288, width: 64, height: 192 },
    right_leg_front: { key: "right_leg_front", label: "Right Leg Front", left: 260, top: 288, width: 64, height: 192 },
    left_leg_back: { key: "left_leg_back", label: "Left Leg Back", left: 338, top: 288, width: 64, height: 192 },
    right_leg_back: { key: "right_leg_back", label: "Right Leg Back", left: 402, top: 288, width: 64, height: 192 },
  },
  pants: {
    front: { key: "front", label: "Front", left: 196, top: 118, width: 128, height: 128 },
    back: { key: "back", label: "Back", left: 338, top: 118, width: 128, height: 128 },
    left_sleeve: { key: "left_sleeve", label: "Left Sleeve", left: 44, top: 118, width: 128, height: 128 },
    right_sleeve: { key: "right_sleeve", label: "Right Sleeve", left: 441, top: 118, width: 128, height: 128 },
    left_leg_front: { key: "left_leg_front", label: "Left Leg Front", left: 44, top: 288, width: 128, height: 192 },
    right_leg_front: { key: "right_leg_front", label: "Right Leg Front", left: 196, top: 288, width: 128, height: 192 },
    left_leg_back: { key: "left_leg_back", label: "Left Leg Back", left: 338, top: 288, width: 128, height: 192 },
    right_leg_back: { key: "right_leg_back", label: "Right Leg Back", left: 441, top: 288, width: 128, height: 192 },
  },
};

function parseAiConcept(canvasData: string | null | undefined): AiConcept | null {
  if (!canvasData) return null;
  try {
    const parsed = JSON.parse(canvasData);
    return parsed.__aiConcept ?? null;
  } catch {
    return null;
  }
}

function getObjectMeta(obj: fabric.Object): FabricObjectMeta {
  return (obj as fabric.Object & { data?: FabricObjectMeta }).data ?? {};
}

function isStylePreset(value: unknown): value is StylePreset {
  return typeof value === "string" && STYLE_PRESET_VALUES.includes(value as StylePreset);
}

function getEnabledZones(type: "shirt" | "pants"): TemplateZone[] {
  const zones = TEMPLATE_ZONES[type];
  if (type === "shirt") {
    return [zones.front, zones.back, zones.left_sleeve, zones.right_sleeve];
  }
  return [zones.left_leg_front, zones.right_leg_front, zones.left_leg_back, zones.right_leg_back];
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function resolveZoneForModule(type: "shirt" | "pants", module: NormalizedAiResponse["result"]["modules"][number]): TemplateZone {
  const zones = getEnabledZones(type);
  const x = clamp01(module.position.x);
  const y = clamp01(module.position.y);
  const moduleType = module.type.toLowerCase();

  if (type === "shirt") {
    if (moduleType === "sleeve_detail" || moduleType === "trim") {
      return x < 0.5 ? TEMPLATE_ZONES.shirt.left_sleeve : TEMPLATE_ZONES.shirt.right_sleeve;
    }
    const bodyZones = [TEMPLATE_ZONES.shirt.front, TEMPLATE_ZONES.shirt.back];
    return x < 0.6 ? bodyZones[0] : bodyZones[1];
  }

  const rowZones = y < 0.5
    ? [TEMPLATE_ZONES.pants.left_leg_front, TEMPLATE_ZONES.pants.right_leg_front]
    : [TEMPLATE_ZONES.pants.left_leg_back, TEMPLATE_ZONES.pants.right_leg_back];
  if (moduleType === "stripe") {
    return x < 0.5 ? rowZones[0] : rowZones[1];
  }
  const nearest = zones.reduce((best, zone) => {
    const cx = zone.left + zone.width / 2;
    const cy = zone.top + zone.height / 2;
    const dx = x * 585 - cx;
    const dy = y * 559 - cy;
    const distance = (dx * dx) + (dy * dy);
    if (!best || distance < best.distance) return { zone, distance };
    return best;
  }, null as null | { zone: TemplateZone; distance: number });
  return nearest?.zone ?? TEMPLATE_ZONES.pants.left_leg_front;
}

function AiConceptBanner({ concept, onClose, onUseColors }: {
  concept: AiConcept;
  onClose: () => void;
  onUseColors: (colors: string[]) => void;
}) {
  const { language } = useLanguage();
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="border-b border-primary/20 bg-primary/5 overflow-hidden shrink-0"
    >
      <div className="px-4 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            <div className="min-w-0">
              <span className="text-xs font-semibold text-primary">
                {language === "no" ? "AI Designkonsept" : "AI Design Concept"}
              </span>
              {concept.concept && (
                <p className="text-xs text-muted-foreground truncate">{concept.concept}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {concept.colors && concept.colors.length > 0 && (
              <div className="flex gap-1">
                {concept.colors.slice(0, 5).map((c, i) => (
                  <button
                    key={i}
                    onClick={() => onUseColors(concept.colors!.map(x => x.hex))}
                    title={`${c.name} — klikk for å bruke alle farger`}
                    className="w-5 h-5 rounded-full border border-white/20 hover:scale-110 transition-transform"
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
            )}
            <button
              onClick={() => setExpanded(p => !p)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              {expanded
                ? (language === "no" ? "Skjul" : "Hide")
                : (language === "no" ? "Mer" : "More")}
              <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-3 space-y-3">
                {concept.description && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{concept.description}</p>
                )}

                {concept.colors && concept.colors.length > 0 && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">
                      {language === "no" ? "Fargepalett" : "Color Palette"}
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      {concept.colors.map((c, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <div
                            className="w-6 h-6 rounded border border-white/10"
                            style={{ backgroundColor: c.hex }}
                          />
                          <div>
                            <p className="text-[10px] font-medium">{c.name}</p>
                            <p className="text-[9px] font-mono text-muted-foreground">{c.hex}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 h-7 text-xs gap-1"
                      onClick={() => onUseColors(concept.colors!.map(c => c.hex))}
                    >
                      {language === "no" ? "Bruk disse fargene" : "Apply these colors"}
                    </Button>
                  </div>
                )}

                {concept.keyElements && concept.keyElements.length > 0 && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">
                      {language === "no" ? "Hovedelementer" : "Key elements"}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {concept.keyElements.map((el, i) => (
                        <span key={i} className="text-[10px] bg-background/50 border border-border rounded-full px-2 py-0.5">
                          {el}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {concept.designTips && concept.designTips.length > 0 && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">
                      {language === "no" ? "Designtips" : "Design tips"}
                    </p>
                    <ul className="space-y-0.5">
                      {concept.designTips.map((tip, i) => (
                        <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                          <span className="text-primary shrink-0">•</span> {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const snapEnabledRef = useRef(true);

  const [creatorMode, setCreatorMode] = useState<"ai" | "manual" | "template" | "remix">("ai");
  const [selectedObject, setSelectedObject] = useState<fabric.Object | null>(null);
  const [drawingMode, setDrawingMode] = useState(false);
  const [eraserMode, setEraserMode] = useState(false);
  const [fillColor, setFillColor] = useState("#3b82f6");
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(8);
  const [aiConcept, setAiConcept] = useState<AiConcept | null>(null);
  const [showConcept, setShowConcept] = useState(true);
  const [textureEditorOpen, setTextureEditorOpen] = useState(false);
  const [avatarTextureUrl, setAvatarTextureUrl] = useState("");
  const [credits, setCredits] = useState(0);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [isBuyingCredit, setIsBuyingCredit] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [aiMode, setAiMode] = useState<AiOutputMode>("classic_2d");
  const [stylizedConcept, setStylizedConcept] = useState<StylizedOutfitConcept | null>(null);
  const [garmentColor, setGarmentColor] = useState("#2563eb");
  const [garmentMaterial, setGarmentMaterial] = useState<GarmentMaterial>("cotton");
  const [garmentScale, setGarmentScale] = useState(1);
  const [avatarProfile, setAvatarProfile] = useState({ avatarType: "neutral", bodyType: "regular" });
  const [activeModuleCategory, setActiveModuleCategory] = useState("Clothing Parts");
  const [selectedStylePreset, setSelectedStylePreset] = useState<StylePreset>("streetwear");
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [draggingModuleId, setDraggingModuleId] = useState<string | null>(null);
  const [previewFacing, setPreviewFacing] = useState<"front" | "back">("front");
  const [activeZone, setActiveZone] = useState<ZoneKey>("front");

  const { data: project, isLoading } = useGetProject(id);
  const { data: me, refetch: refetchMe } = useGetMe();
  const saveCanvas = useSaveCanvas();
  const createExport = useCreateExport();
  const activeClassicType = (project?.type === "pants" ? "pants" : "shirt") as "shirt" | "pants";
  const targetLabel = useMemo(() => activeClassicType === "shirt" ? "Classic Shirt" : "Classic Pants", [activeClassicType]);

  useEffect(() => {
    const next = getEnabledZones(activeClassicType)[0];
    if (next) setActiveZone(next.key as ZoneKey);
  }, [activeClassicType]);

  // These must be declared BEFORE the canvas useEffect that depends on them
  const handleUseColors = useCallback((colors: string[]) => {
    if (colors[0]) setFillColor(colors[0]);
    if (colors[1]) setStrokeColor(colors[1]);
    toast({ title: language === "no" ? "Farger brukt!" : "Colors applied!" });
  }, [toast, language]);

  const getZoneByKey = useCallback((zoneKey: string): TemplateZone | undefined => {
    return TEMPLATE_ZONES[activeClassicType][zoneKey as ZoneKey];
  }, [activeClassicType]);

  const constrainObjectToZone = useCallback((obj: fabric.Object, zoneKey: string) => {
    const zone = getZoneByKey(zoneKey);
    if (!zone) return;
    const objectWidth = obj.getScaledWidth();
    const objectHeight = obj.getScaledHeight();
    const minLeft = zone.left;
    const maxLeft = zone.left + zone.width - objectWidth;
    const minTop = zone.top;
    const maxTop = zone.top + zone.height - objectHeight;
    obj.set({
      left: Math.min(Math.max(obj.left ?? minLeft, minLeft), Math.max(minLeft, maxLeft)),
      top: Math.min(Math.max(obj.top ?? minTop, minTop), Math.max(minTop, maxTop)),
    });
  }, [getZoneByKey]);

  useEffect(() => {
    snapEnabledRef.current = snapEnabled;
  }, [snapEnabled]);

  const addTemplateGuideLayer = useCallback(() => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    const type = activeClassicType;
    const zones = getEnabledZones(type);

    canvas.getObjects().forEach((obj) => {
      if (getObjectMeta(obj).role === "template-guide") {
        canvas.remove(obj);
      }
    });

    zones.forEach((zone) => {
      const isActiveZone = zone.key === activeZone;
      const frame = new fabric.Rect({
        left: zone.left,
        top: zone.top,
        width: zone.width,
        height: zone.height,
        fill: isActiveZone ? "rgba(99, 102, 241, 0.18)" : "rgba(59, 130, 246, 0.06)",
        stroke: isActiveZone ? "rgba(129, 140, 248, 0.95)" : "rgba(59, 130, 246, 0.4)",
        strokeWidth: isActiveZone ? 2 : 1,
        selectable: true,
        evented: true,
        hoverCursor: "pointer",
        excludeFromExport: true,
        data: { role: "template-guide", zone: zone.key, layerName: zone.label },
      });

      const label = new fabric.Text(zone.label, {
        left: zone.left + 6,
        top: zone.top + 6,
        fontSize: 10,
        fill: isActiveZone ? "rgba(199, 210, 254, 1)" : "rgba(59, 130, 246, 0.8)",
        selectable: false,
        evented: false,
        excludeFromExport: true,
        data: { role: "template-guide", zone: zone.key },
      });

      canvas.add(frame);
      canvas.add(label);
      canvas.sendObjectToBack(label);
      canvas.sendObjectToBack(frame);
    });
  }, [activeClassicType, activeZone]);

  const ensureVisibleStarterDesign = useCallback((preset: StylePreset = "streetwear") => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    const type = activeClassicType;
    const zones = TEMPLATE_ZONES[type];
    const hasUserObjects = canvas.getObjects().some((obj) => getObjectMeta(obj).role !== "template-guide");
    if (hasUserObjects) return;

    const stylePalettes: Record<StylePreset, string[]> = {
      streetwear: ["#111827", "#ef4444", "#e5e7eb"],
      anime: ["#f472b6", "#fde047", "#1d4ed8"],
      sport: ["#0f172a", "#22c55e", "#f8fafc"],
      cyberpunk: ["#0b1120", "#22d3ee", "#a855f7"],
      minimal: ["#f8fafc", "#334155", "#94a3b8"],
    };
    const palette = stylePalettes[preset];
    canvas.backgroundColor = palette[0];
    addFallbackShapeToZone(zones.front, palette[1], "Starter Front");
    addFallbackShapeToZone(zones.back, palette[2], "Starter Back");
    if (type === "shirt") {
      addFallbackShapeToZone(zones.left_sleeve, palette[1], "Starter Left Sleeve");
      addFallbackShapeToZone(zones.right_sleeve, palette[2], "Starter Right Sleeve");
    } else {
      addFallbackShapeToZone(zones.left_leg_front, palette[1], "Starter Left Leg Front");
      addFallbackShapeToZone(zones.right_leg_front, palette[2], "Starter Right Leg Front");
    }
    canvas.renderAll();
  }, [activeClassicType]);

  // Initialize Canvas
  useEffect(() => {
    if (!canvasRef.current || !project) return;

    // Roblox classic clothing template = 585×559 for BOTH shirt and pants
    const width = 585;
    const height = 559;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width,
      height,
      backgroundColor: "#ffffff",
      preserveObjectStacking: true,
    });

    fabricRef.current = canvas;

    // Parse AI concept if present
    const concept = parseAiConcept(project.canvasData);
    if (concept) {
      setAiConcept(concept);
      setShowConcept(true);
      if (concept.backgroundColor) {
        canvas.backgroundColor = concept.backgroundColor;
      }
      if (concept.colors?.[0]?.hex) {
        setFillColor(concept.colors[0].hex);
      }
    }

    if (project.canvasData) {
      try {
        const parsed = JSON.parse(project.canvasData);
        // Strip non-Fabric meta fields before loading
        const { __aiConcept: _a, __itemLabel: _b, __originalPrompt: _c, ...fabricJson } = parsed as Record<string, unknown>;
        if (fabricJson.objects && Array.isArray(fabricJson.objects)) {
          canvas.loadFromJSON(fabricJson).then(() => {
            addTemplateGuideLayer();
            canvas.renderAll();
          }).catch(err => {
            console.error("loadFromJSON error", err);
            addTemplateGuideLayer();
            canvas.renderAll();
          });
        } else {
          addTemplateGuideLayer();
          canvas.renderAll();
        }
      } catch (e) {
        console.error("Error loading canvas data", e);
        addTemplateGuideLayer();
        canvas.renderAll();
      }
    } else {
      addTemplateGuideLayer();
      canvas.renderAll();
    }

    canvas.on("selection:created", (e) => {
      const obj = e.selected?.[0] || null;
      if (obj && getObjectMeta(obj).role === "template-guide" && getObjectMeta(obj).zone) {
        setActiveZone(getObjectMeta(obj).zone as ZoneKey);
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        return;
      }
      if (obj && getObjectMeta(obj).zone) {
        setActiveZone(getObjectMeta(obj).zone as ZoneKey);
      }
      setSelectedObject(obj);
    });
    canvas.on("selection:updated", (e) => {
      const obj = e.selected?.[0] || null;
      if (obj && getObjectMeta(obj).role === "template-guide" && getObjectMeta(obj).zone) {
        setActiveZone(getObjectMeta(obj).zone as ZoneKey);
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        return;
      }
      if (obj && getObjectMeta(obj).zone) {
        setActiveZone(getObjectMeta(obj).zone as ZoneKey);
      }
      setSelectedObject(obj);
    });
    canvas.on("selection:cleared", () => setSelectedObject(null));
    canvas.on("object:moving", (e) => {
      if (!e.target) return;
      const grid = 8;
      const meta = getObjectMeta(e.target);
      if (meta.zone) {
        constrainObjectToZone(e.target, meta.zone);
      }
      if (snapEnabledRef.current) {
        e.target.set({
          left: Math.round((e.target.left ?? 0) / grid) * grid,
          top: Math.round((e.target.top ?? 0) / grid) * grid,
        });
      }
    });
    canvas.on("object:scaling", (e) => {
      if (!e.target) return;
      const meta = getObjectMeta(e.target);
      if (meta.zone) constrainObjectToZone(e.target, meta.zone);
    });

    return () => { canvas.dispose(); fabricRef.current = null; };
  }, [project?.id, constrainObjectToZone]);

  // Drawing mode
  useEffect(() => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    canvas.isDrawingMode = drawingMode;
    if (drawingMode && canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = eraserMode ? "#000000" : strokeColor;
      canvas.freeDrawingBrush.width = brushSize;
      (canvas.freeDrawingBrush as unknown as { globalCompositeOperation?: string }).globalCompositeOperation = eraserMode ? "destination-out" : "source-over";
    }
  }, [drawingMode, strokeColor, brushSize, eraserMode]);

  useEffect(() => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    const onPathCreated = (evt: { path?: fabric.Object }) => {
      const path = evt.path;
      const zone = getZoneByKey(activeZone);
      if (!path || !zone) return;
      path.set({
        data: { ...(getObjectMeta(path)), role: "manual-path", zone: zone.key, layerName: `${zone.label} Drawing` },
        clipPath: new fabric.Rect({ left: zone.left, top: zone.top, width: zone.width, height: zone.height, absolutePositioned: true }),
      });
      constrainObjectToZone(path, zone.key);
      canvas.requestRenderAll();
    };
    canvas.on("path:created", onPathCreated);
    return () => {
      canvas.off("path:created", onPathCreated);
    };
  }, [activeZone, constrainObjectToZone, getZoneByKey]);

  useEffect(() => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const updatePreview = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (!fabricRef.current) return;
        const dataUrl = fabricRef.current.toDataURL({ format: "png", multiplier: 1, quality: 0.92 });
        setAvatarTextureUrl(dataUrl);
      }, 140);
    };

    updatePreview();
    canvas.on("object:added", updatePreview);
    canvas.on("object:removed", updatePreview);
    canvas.on("object:modified", updatePreview);
    canvas.on("path:created", updatePreview);

    return () => {
      if (timeout) clearTimeout(timeout);
      canvas.off("object:added", updatePreview);
      canvas.off("object:removed", updatePreview);
      canvas.off("object:modified", updatePreview);
      canvas.off("path:created", updatePreview);
    };
  }, [project?.id]);

  useEffect(() => {
    setCredits(me?.aiCredits ?? 0);
  }, [me?.aiCredits]);

  const syncAvatarTextureFromCanvas = useCallback(() => {
    if (!fabricRef.current) return;
    const dataUrl = fabricRef.current.toDataURL({ format: "png", multiplier: 1, quality: 0.92 });
    setAvatarTextureUrl(dataUrl);
  }, []);

  const buildCanonicalCanvasSnapshot = useCallback(() => {
    if (!fabricRef.current) return null;
    const canvasJSON = fabricRef.current.toJSON();
    if (aiConcept) (canvasJSON as Record<string, unknown>).__aiConcept = aiConcept;
    const canvasData = JSON.stringify(canvasJSON);
    const textureDataUrl = fabricRef.current.toDataURL({ format: "png", multiplier: 1, quality: 0.92 });
    return { canvasData, textureDataUrl };
  }, [aiConcept]);

  const handleSave = async () => {
    const snapshot = buildCanonicalCanvasSnapshot();
    if (!snapshot) return;

    saveCanvas.mutate(
      { id, data: { canvasData: snapshot.canvasData, thumbnailUrl: snapshot.textureDataUrl } },
      {
        onSuccess: () => toast({ title: language === "no" ? "Lagret!" : "Saved!", description: language === "no" ? "Prosjektet er lagret." : "Project saved." }),
        onError: () => toast({ title: language === "no" ? "Feil" : "Error", description: language === "no" ? "Klarte ikke å lagre." : "Failed to save.", variant: "destructive" }),
      }
    );
  };

  const handleExport = async () => {
    const snapshot = buildCanonicalCanvasSnapshot();
    if (!snapshot) return;
    if (aiMode === "stylized_outfit") {
      toast({
        title: "3D export is not yet supported",
        description: "Switch back to Classic 2D mode to export your Roblox template texture.",
        variant: "destructive",
      });
      return;
    }
    try {
      const a = document.createElement("a");
      a.href = snapshot.textureDataUrl;
      a.download = `${project?.title ?? "design"}.png`;
      a.click();
      await saveCanvas.mutateAsync({ id, data: { canvasData: snapshot.canvasData, thumbnailUrl: snapshot.textureDataUrl } });
      createExport.mutate({ data: { projectId: id, format: "png" } });
    } catch {
      toast({
        title: language === "no" ? "Feil" : "Error",
        description: language === "no" ? "Klarte ikke å eksportere." : "Failed to export latest edits.",
        variant: "destructive",
      });
    }
  };

  const handleBuyCredit = async () => {
    setIsBuyingCredit(true);
    try {
      const data = await createCheckoutSession("pro") as { checkoutUrl?: string; error?: string };
      if (!data.checkoutUrl) {
        throw new Error(data.error ?? "Unable to create checkout session.");
      }
      window.location.href = data.checkoutUrl;
    } catch (error) {
      toast({
        title: "Payment failed",
        description: error instanceof Error ? error.message : "Could not start checkout.",
        variant: "destructive",
      });
    } finally {
      setIsBuyingCredit(false);
    }
  };

  const handleUploadToRoblox = async () => {
    if (!id) return;
    if (aiMode === "stylized_outfit") {
      toast({
        title: "3D upload is not supported",
        description: "Switch back to Classic 2D mode before uploading to Roblox.",
        variant: "destructive",
      });
      return;
    }
    if (credits < 1) {
      setPaymentOpen(true);
      return;
    }

    setIsUploading(true);
    try {
      const data = await uploadToRoblox(id) as { error?: string; message?: string; status?: string; events?: Array<{ message?: string }> };
      if (data.error) {
        if (data.error === "INSUFFICIENT_CREDITS") setPaymentOpen(true);
        throw new Error(data.message ?? "Upload failed.");
      }
      const status = data.status ?? "queued";
      const latestMessage = data.events?.at(-1)?.message;
      if (status === "blocked" || status === "failed") {
        toast({
          title: status === "blocked" ? "Upload blocked" : "Upload failed",
          description: latestMessage ?? "Roblox upload could not proceed with the current integration state.",
          variant: "destructive",
        });
        return;
      }

      toast({ title: "Roblox upload job created", description: latestMessage ?? `Current status: ${status}.` });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Could not upload to Roblox.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      void refetchMe();
    }
  };

  const addText = () => {
    if (!fabricRef.current) return;
    setDrawingMode(false);
    const zone = getZoneByKey(activeZone);
    const text = new fabric.IText(language === "no" ? "Rediger tekst" : "Edit text", {
      left: zone ? zone.left + 12 : 150,
      top: zone ? zone.top + 12 : 150,
      fontFamily: "Inter, sans-serif",
      fill: fillColor, fontSize: 36,
      data: { role: "manual-text", zone: zone?.key, layerName: "Text" },
    });
    if (zone) constrainObjectToZone(text, zone.key);
    fabricRef.current.add(text);
    fabricRef.current.setActiveObject(text);
    fabricRef.current.renderAll();
    syncAvatarTextureFromCanvas();
  };

  const addRect = () => {
    if (!fabricRef.current) return;
    setDrawingMode(false);
    const zone = getZoneByKey(activeZone);
    const rect = new fabric.Rect({
      left: zone ? zone.left + 12 : 100,
      top: zone ? zone.top + 12 : 100,
      fill: fillColor, stroke: strokeColor, strokeWidth: 2,
      width: 120, height: 80, rx: 4,
      data: { role: "manual-shape", zone: zone?.key, layerName: "Rectangle" },
    });
    if (zone) constrainObjectToZone(rect, zone.key);
    fabricRef.current.add(rect);
    fabricRef.current.setActiveObject(rect);
    fabricRef.current.renderAll();
    syncAvatarTextureFromCanvas();
  };

  const addCircle = () => {
    if (!fabricRef.current) return;
    setDrawingMode(false);
    const zone = getZoneByKey(activeZone);
    const circle = new fabric.Circle({
      left: zone ? zone.left + 18 : 120,
      top: zone ? zone.top + 18 : 120,
      fill: fillColor, stroke: strokeColor, strokeWidth: 2, radius: 50,
      data: { role: "manual-shape", zone: zone?.key, layerName: "Circle" },
    });
    if (zone) constrainObjectToZone(circle, zone.key);
    fabricRef.current.add(circle);
    fabricRef.current.setActiveObject(circle);
    fabricRef.current.renderAll();
    syncAvatarTextureFromCanvas();
  };

  const addModule = (module: ModuleDefinition) => {
    if (!fabricRef.current) return;
    setDrawingMode(false);
    const zone = getZoneByKey(activeZone);
    let object: fabric.Object;
    if (module.shape === "circle") {
      object = new fabric.Circle({
        left: zone ? zone.left + 16 : 160,
        top: zone ? zone.top + 16 : 160,
        radius: 36,
        fill: module.color,
        opacity: 0.9,
        data: { role: "module", category: module.category, moduleName: module.name, layerName: module.name, zone: zone?.key },
      });
    } else if (module.shape === "stripe") {
      object = new fabric.Rect({
        left: zone ? zone.left + 12 : 120,
        top: zone ? zone.top + 12 : 120,
        width: 160,
        height: 22,
        fill: module.color,
        rx: 8,
        opacity: 0.9,
        data: { role: "module", category: module.category, moduleName: module.name, layerName: module.name, zone: zone?.key },
      });
    } else {
      object = new fabric.Rect({
        left: zone ? zone.left + 12 : 120,
        top: zone ? zone.top + 12 : 120,
        width: 110,
        height: 90,
        rx: 12,
        fill: module.color,
        opacity: 0.9,
        data: { role: "module", category: module.category, moduleName: module.name, layerName: module.name, zone: zone?.key },
      });
    }
    if (zone) constrainObjectToZone(object, zone.key);
    fabricRef.current.add(object);
    fabricRef.current.setActiveObject(object);
    fabricRef.current.renderAll();
    syncAvatarTextureFromCanvas();
  };

  const addModuleAt = (module: ModuleDefinition, left: number, top: number) => {
    addModule(module);
    const obj = fabricRef.current?.getActiveObject();
    if (!obj || !fabricRef.current) return;
    obj.set({ left, top });
    const zone = getObjectMeta(obj).zone;
    if (zone) constrainObjectToZone(obj, zone);
    fabricRef.current.renderAll();
    syncAvatarTextureFromCanvas();
  };

  const duplicateSelected = () => {
    if (!fabricRef.current || !selectedObject) return;
    selectedObject.clone().then((cloned) => {
      cloned.set({
        left: (selectedObject.left ?? 0) + 20,
        top: (selectedObject.top ?? 0) + 20,
      });
      fabricRef.current?.add(cloned);
      fabricRef.current?.setActiveObject(cloned);
      fabricRef.current?.renderAll();
      syncAvatarTextureFromCanvas();
    });
  };

  const moveLayer = (direction: "up" | "down") => {
    if (!fabricRef.current || !selectedObject) return;
    if (direction === "up") fabricRef.current.bringObjectForward(selectedObject);
    else fabricRef.current.sendObjectBackwards(selectedObject);
    fabricRef.current.renderAll();
    syncAvatarTextureFromCanvas();
  };

  const toggleObjectLock = () => {
    if (!selectedObject || !fabricRef.current) return;
    const locked = Boolean(selectedObject.lockMovementX);
    selectedObject.set({
      lockMovementX: !locked,
      lockMovementY: !locked,
      lockRotation: !locked,
      lockScalingX: !locked,
      lockScalingY: !locked,
      selectable: locked,
      evented: locked,
    });
    fabricRef.current.renderAll();
    setSelectedObject({ ...selectedObject } as fabric.Object);
    syncAvatarTextureFromCanvas();
  };

  const deleteSelected = () => {
    if (!fabricRef.current) return;
    fabricRef.current.getActiveObjects().forEach(obj => fabricRef.current?.remove(obj));
    fabricRef.current.discardActiveObject();
    fabricRef.current.renderAll();
    setSelectedObject(null);
    syncAvatarTextureFromCanvas();
  };

  const fillActiveZone = () => {
    if (!fabricRef.current) return;
    const zone = getZoneByKey(activeZone);
    if (!zone) return;
    const fillRect = new fabric.Rect({
      left: zone.left,
      top: zone.top,
      width: zone.width,
      height: zone.height,
      fill: fillColor,
      selectable: true,
      evented: true,
      data: { role: "manual-fill", zone: zone.key, layerName: `${zone.label} Fill` },
    });
    fabricRef.current.add(fillRect);
    fabricRef.current.setActiveObject(fillRect);
    fabricRef.current.renderAll();
    syncAvatarTextureFromCanvas();
  };

  const groupSelection = () => {
    if (!fabricRef.current) return;
    const active = fabricRef.current.getActiveObject();
    if (active && active.type === "activeSelection") {
      const selection = active as fabric.ActiveSelection;
      const items = selection.getObjects();
      if (items.length === 0) return;
      fabricRef.current.discardActiveObject();
      items.forEach((item) => fabricRef.current?.remove(item));
      const grouped = new fabric.Group(items);
      grouped.set("data", { role: "manual-group", zone: getObjectMeta(items[0]).zone, layerName: "Grouped Objects" });
      fabricRef.current.setActiveObject(grouped);
      fabricRef.current.add(grouped);
      fabricRef.current.renderAll();
      syncAvatarTextureFromCanvas();
    }
  };

  const ungroupSelection = () => {
    if (!fabricRef.current) return;
    const active = fabricRef.current.getActiveObject();
    if (active && active.type === "group") {
      const group = active as fabric.Group;
      const items = group.removeAll();
      fabricRef.current.remove(group);
      const selection = new fabric.ActiveSelection(items, { canvas: fabricRef.current });
      fabricRef.current.setActiveObject(selection);
      fabricRef.current.requestRenderAll();
      fabricRef.current.renderAll();
      syncAvatarTextureFromCanvas();
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fabricRef.current) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      fabric.FabricImage.fromURL(src).then((img) => {
        const zone = getZoneByKey(activeZone);
        img.scaleToWidth(200);
        img.set({
          left: zone ? zone.left + 8 : 120,
          top: zone ? zone.top + 8 : 120,
          data: { ...(getObjectMeta(img)), role: "manual-image", zone: zone?.key, layerName: `${zone?.label ?? "Zone"} Image` },
        });
        if (zone) {
          img.set({
            clipPath: new fabric.Rect({ left: zone.left, top: zone.top, width: zone.width, height: zone.height, absolutePositioned: true }),
          });
          constrainObjectToZone(img, zone.key);
        }
        fabricRef.current?.add(img);
        fabricRef.current?.setActiveObject(img);
        fabricRef.current?.renderAll();
        syncAvatarTextureFromCanvas();
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  function addFallbackShapeToZone(zone: TemplateZone, color: string, layerName: string) {
    if (!fabricRef.current) return;
    const stripe = new fabric.Rect({
      left: zone.left,
      top: zone.top,
      width: zone.width,
      height: zone.height * 0.28,
      fill: color,
      opacity: 0.85,
      selectable: true,
      evented: true,
      data: { role: "ai-generated", zone: zone.key, layerName: `${layerName} Stripe` },
    });
    const emblem = new fabric.Circle({
      left: zone.left + (zone.width * 0.5) - 20,
      top: zone.top + (zone.height * 0.5) - 20,
      radius: 20,
      fill: color,
      opacity: 0.75,
      selectable: true,
      evented: true,
      data: { role: "ai-generated", zone: zone.key, layerName: `${layerName} Emblem` },
    });
    fabricRef.current.add(stripe);
    fabricRef.current.add(emblem);
  }

  const applyAiOutfitToCanvas = useCallback(async (result: NormalizedAiResponse) => {
    if (!fabricRef.current) return false;
    const canvas = fabricRef.current;
    const expectedItemType = activeClassicType === "shirt" ? "classic_shirt" : "classic_pants";
    if (result.result.itemType !== expectedItemType) {
      toast({
        title: language === "no" ? "Feil klesmål fra AI" : "AI target mismatch",
        description: language === "no"
          ? "AI-resultatet matcher ikke prosjekttypen. Generer på nytt for riktig klassisk type."
          : "AI output does not match this project type. Regenerate for the matching classic type.",
        variant: "destructive",
      });
      return false;
    }

    setDrawingMode(false);
    try {
      const plan = buildEditorApplyPlan(result);
      canvas.backgroundColor = plan.backgroundColor;

      canvas.getObjects().forEach((obj) => {
        const role = getObjectMeta(obj).role;
        if (role === "template-guide" || role === "ai-generated") {
          canvas.remove(obj);
        }
      });

      if (plan.modules.length === 0) {
        throw new Error("AI returned zero modules; cannot apply degraded design as success.");
      }

      for (const module of plan.modules) {
        const zone = resolveZoneForModule(activeClassicType, module);
        const radius = Math.max(8, 28 * module.scale);
        const shape = module.type === "stripe"
          ? new fabric.Rect({ width: 120 * module.scale, height: 18 * module.scale, fill: module.color, opacity: module.opacity })
          : new fabric.Circle({ radius, fill: module.color, opacity: module.opacity });
        const left = zone.left + clamp01(module.position.x) * Math.max(8, zone.width - shape.getScaledWidth());
        const top = zone.top + clamp01(module.position.y) * Math.max(8, zone.height - shape.getScaledHeight());

        shape.set({
          left,
          top,
          angle: module.rotation,
          selectable: true,
          evented: true,
          data: { role: "ai-generated", moduleId: module.id, layerName: module.label, zone: zone.key },
          clipPath: new fabric.Rect({ left: zone.left, top: zone.top, width: zone.width, height: zone.height, absolutePositioned: true }),
        });
        constrainObjectToZone(shape, zone.key);
        canvas.add(shape);
      }

      canvas.renderAll();
      setAiConcept({
        title: result.result.title,
        style: result.result.style,
        backgroundColor: plan.backgroundColor,
        colors: plan.palette.map((hex, index) => ({ hex, name: `Color ${index + 1}` })),
        description: `${result.result.placement.front} / ${result.result.placement.back}`,
      });
      setShowConcept(true);
      handleUseColors(plan.palette);
      addTemplateGuideLayer();
      toast({ title: language === "no" ? "AI design lagt til!" : "AI design applied to canvas!" });
      return true;
    } catch (error) {
      console.error("canvas.apply.failure", error);
      toast({
        title: language === "no" ? "Kunne ikke bruke AI-design" : "Failed to apply AI design",
        description: "AI output was degraded and not applied.",
        variant: "destructive",
      });
      addTemplateGuideLayer();
      return false;
    }
  }, [activeClassicType, addTemplateGuideLayer, constrainObjectToZone, handleUseColors, language, toast]);

  const handleAiModeChange = useCallback((next: AiOutputMode) => {
    setAiMode(next);
    if (next === "classic_2d") {
      setStylizedConcept(null);
      return;
    }
    if (next === "stylized_outfit") {
      toast({
        title: "Stylized Outfit AI",
        description: "This mode generates concept renders and styled preview, not classic export textures.",
      });
    }
  }, [toast]);

  useEffect(() => {
    if (!project?.id || !fabricRef.current) return;
    const key = `my-skins:pending-ai:${project.id}`;
    const pending = sessionStorage.getItem(key);
    if (!pending) return;
    sessionStorage.removeItem(key);
    try {
      const parsed = normalizeAiResponse(JSON.parse(pending));
      console.info("editor.ai.pipeline.received", { projectId: project.id });
      void applyAiOutfitToCanvas(parsed).then((applied) => {
        if (!applied) {
          toast({
            title: "Design generation failed",
            description: "Design generation failed. No visible assets were applied.",
            variant: "destructive",
          });
        }
      });
    } catch (error) {
      console.error("editor.ai.pipeline.invalid-payload", error);
      toast({
        title: "Design generation failed",
        description: "Invalid AI payload schema. No visible assets were applied.",
        variant: "destructive",
      });
    }
  }, [applyAiOutfitToCanvas, project?.id, toast]);

  useEffect(() => {
    if (!project?.id) return;
    const key = `my-skins:editor-meta:${project.id}`;
    const raw = sessionStorage.getItem(key);
    if (!raw) return;
    sessionStorage.removeItem(key);
    try {
      const parsed = JSON.parse(raw) as EditorMetaState;
      if (parsed.avatar?.avatarType || parsed.avatar?.bodyType) {
        setAvatarProfile({
          avatarType: parsed.avatar.avatarType ?? "neutral",
          bodyType: parsed.avatar.bodyType ?? "regular",
        });
      }
      if (parsed.creationMode) {
        if (["ai", "manual", "template", "remix"].includes(parsed.creationMode)) {
          setCreatorMode(parsed.creationMode as "ai" | "manual" | "template" | "remix");
        }
      }
      if (isStylePreset(parsed.stylePreset)) {
        setSelectedStylePreset(parsed.stylePreset);
      }
    } catch (error) {
      console.error("editor.meta.invalid", error);
    }
  }, [project?.id]);

  useEffect(() => {
    if (!project?.id || !fabricRef.current) return;
    ensureVisibleStarterDesign(selectedStylePreset);
  }, [ensureVisibleStarterDesign, project?.id, selectedStylePreset]);

  useEffect(() => {
    if (!fabricRef.current) return;
    addTemplateGuideLayer();
    fabricRef.current.renderAll();
  }, [addTemplateGuideLayer, activeZone]);

  const zoomIn = () => {
    if (!fabricRef.current) return;
    fabricRef.current.setZoom(Math.min(fabricRef.current.getZoom() * 1.2, 5));
  };

  const zoomOut = () => {
    if (!fabricRef.current) return;
    fabricRef.current.setZoom(Math.max(fabricRef.current.getZoom() / 1.2, 0.1));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#080e1a]">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#080e1a] text-white">

      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <header className="h-12 border-b border-white/10 bg-[#0d1117] flex items-center justify-between px-4 shrink-0 gap-3 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <Link href="/dashboard">
            <button className="p-1.5 rounded hover:bg-white/10 transition-colors text-white/60 hover:text-white">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <span className="font-semibold text-sm truncate max-w-[160px] text-white">{project?.title}</span>
          <span className="text-[10px] rounded-full border border-white/15 px-2 py-0.5 text-white/70">{targetLabel}</span>
          <span className="text-[10px] rounded-full border border-white/15 px-2 py-0.5 text-white/70 uppercase">{creatorMode}</span>
          {project?.isAiGenerated && (
            <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
              <Sparkles className="w-2.5 h-2.5" /> AI
            </span>
          )}
        </div>

        {/* Center: AI output mode toggle */}
        <div className="flex items-center bg-white/5 rounded-lg p-0.5 border border-white/10 shrink-0">
          <button
            onClick={() => handleAiModeChange("classic_2d")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${aiMode === "classic_2d" ? "bg-indigo-600 text-white shadow" : "text-white/50 hover:text-white"}`}
          >
            <Shirt className="w-3.5 h-3.5" /> Classic 2D
          </button>
          <button
            onClick={() => handleAiModeChange("stylized_outfit")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${aiMode === "stylized_outfit" ? "bg-indigo-600 text-white shadow" : "text-white/50 hover:text-white"}`}
          >
            <Boxes className="w-3.5 h-3.5" /> Stylized Outfit AI
          </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => {
              if (aiMode === "stylized_outfit") {
                toast({
                  title: "Texture editor is Classic 2D only",
                  description: "Switch to Classic 2D to edit atlas zones.",
                });
                return;
              }
              setTextureEditorOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white/10 hover:bg-white/15 border border-white/10 transition-colors"
          >
            <PenTool className="w-3.5 h-3.5" /> Edit Texture
          </button>
          <button
            onClick={handleSave}
            disabled={saveCanvas.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-white/10 hover:bg-white/15 border border-white/10 transition-colors disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {saveCanvas.isPending ? "..." : "Save"}
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-indigo-600 hover:bg-indigo-500 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Export
          </button>
        </div>
      </header>

      {/* ── 3-PANEL BODY ─────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT: Build Tools ──────────────────────────────────────── */}
        <aside className="w-[240px] shrink-0 border-r border-white/8 bg-[#0d1117] overflow-y-auto flex flex-col">
          <div className="px-4 pt-4 pb-2 border-b border-white/8">
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/40">Studio</p>
          </div>

          <div className="p-3 space-y-5 flex-1">
            {/* Avatar type */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Avatar</p>
              <div className="grid grid-cols-2 gap-1.5">
                {[{ id: "neutral", label: "Neutral" }, { id: "feminine", label: "Female" }, { id: "masculine", label: "Male" }, { id: "stylized", label: "Stylized" }].map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setAvatarProfile((p) => ({ ...p, avatarType: a.id }))}
                    className={`text-[11px] py-1.5 px-2 rounded-md border transition-all ${avatarProfile.avatarType === a.id ? "bg-indigo-600/80 border-indigo-500 text-white" : "border-white/10 text-white/50 hover:text-white hover:border-white/20"}`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Body type */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Body Type</p>
              <div className="grid grid-cols-3 gap-1.5">
                {["Slim", "Regular", "Athletic"].map((b) => (
                  <button
                    key={b}
                    onClick={() => setAvatarProfile((p) => ({ ...p, bodyType: b.toLowerCase() }))}
                    className={`text-[11px] py-1.5 rounded-md border transition-all ${avatarProfile.bodyType === b.toLowerCase() ? "bg-indigo-600/80 border-indigo-500 text-white" : "border-white/10 text-white/50 hover:text-white hover:border-white/20"}`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            {/* Item type */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Clothing</p>
              {aiMode === "classic_2d" ? (
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: "shirt", label: "👕 Shirt" },
                    { id: "pants", label: "👖 Pants" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      disabled
                      className={`text-[11px] py-2 rounded-md border transition-all ${activeClassicType === item.id ? "bg-indigo-600/80 border-indigo-500 text-white" : "border-white/10 text-white/35"}`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-1.5">
                  {["Hoodie", "Jacket", "T-Shirt", "Suit"].map((g) => (
                    <button
                      key={g}
                      className="text-[11px] py-2 rounded-md border border-white/10 text-white/50 hover:text-white hover:border-white/20 transition-all"
                    >
                      {g}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Style presets */}
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Style</p>
              <div className="grid grid-cols-2 gap-1.5">
                {STYLE_PRESET_VALUES.map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setSelectedStylePreset(preset)}
                    className={`text-[11px] py-1.5 capitalize rounded-md border transition-all ${selectedStylePreset === preset ? "bg-indigo-600/80 border-indigo-500 text-white" : "border-white/10 text-white/50 hover:text-white hover:border-white/20"}`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* 3D garment controls */}
            {aiMode === "stylized_outfit" && (
              <div className="space-y-3 rounded-lg border border-white/10 bg-white/5 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 flex items-center gap-1"><SlidersHorizontal className="w-3 h-3" /> 3D Controls</p>
                <div className="space-y-1">
                  <label className="text-[10px] text-white/40">Color</label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={garmentColor} onChange={(e) => setGarmentColor(e.target.value)} className="w-8 h-8 rounded border border-white/20 bg-transparent cursor-pointer" />
                    <span className="text-xs font-mono text-white/60">{garmentColor}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-white/40">Material</label>
                  <div className="grid grid-cols-3 gap-1">
                    {(["cotton", "denim", "nylon"] as const).map((m) => (
                      <button key={m} onClick={() => setGarmentMaterial(m)} className={`text-[10px] py-1 rounded border transition-all ${garmentMaterial === m ? "bg-indigo-600/80 border-indigo-500 text-white" : "border-white/10 text-white/40 hover:text-white"}`}>{m}</button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-white/40">Fit {garmentScale.toFixed(2)}x</label>
                  <input type="range" min={0.85} max={1.2} step={0.01} value={garmentScale} onChange={(e) => setGarmentScale(parseFloat(e.target.value))} className="w-full" />
                </div>
              </div>
            )}

            {/* Upload + Roblox */}
            <div className="pt-2 border-t border-white/8 space-y-2">
              <p className="text-[10px] leading-relaxed text-white/45">
                Launch scope: Classic Shirt/Pants workflows are supported. Roblox upload remains gated by integration/account state.
              </p>
              <div className="flex items-center justify-between text-[10px] text-white/40">
                <span>Credits</span>
                <span className="font-mono font-bold text-white/60">{credits}</span>
              </div>
              <button
                onClick={handleUploadToRoblox}
                disabled={credits < 1 || isUploading}
                className="w-full text-[11px] py-2 rounded-md border border-white/10 text-white/50 hover:text-white hover:border-white/20 transition-all disabled:opacity-30"
              >
                {isUploading ? "Uploading…" : "↑ Upload to Roblox"}
              </button>
              <button
                onClick={() => setPaymentOpen(true)}
                className="w-full text-[11px] py-1.5 rounded-md text-white/30 hover:text-white/60 transition-colors"
              >
                Buy credits
              </button>
            </div>
          </div>
        </aside>

        {/* ── CENTER: 3D Avatar Stage ─────────────────────────────────── */}
        <main className="flex-1 relative overflow-hidden bg-[#080e1a]">
          <AvatarPreview
            textureUrl={avatarTextureUrl}
            avatarType={avatarProfile.avatarType}
            bodyType={avatarProfile.bodyType}
            view={previewFacing}
            onViewChange={setPreviewFacing}
            itemType={activeClassicType}
            previewMode={aiMode}
            garmentColor={garmentColor}
            garmentMaterial={garmentMaterial}
            garmentScale={garmentScale}
            studioMode={true}
            stylizedConcept={stylizedConcept}
          />
        </main>

        {/* ── RIGHT: AI Panel ─────────────────────────────────────────── */}
        <aside className="w-[300px] shrink-0 border-l border-white/8 bg-[#0d1117] overflow-y-auto flex flex-col">
          <div className="px-4 pt-4 pb-2 border-b border-white/8 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/40">AI Studio</p>
          </div>

          <div className="flex-1 p-3">
            <AiPanel
              projectType={activeClassicType}
              aiMode={aiMode}
              onModeChange={handleAiModeChange}
              onUseColors={handleUseColors}
              onApplyAssets={applyAiOutfitToCanvas}
              onStylizedConcept={setStylizedConcept}
              avatarType={avatarProfile.avatarType}
              bodyType={avatarProfile.bodyType}
            />
          </div>

          {/* AI Concept banner (inline when there's a result) */}
          {aiConcept && showConcept && (
            <div className="mx-3 mb-3 rounded-lg border border-indigo-500/20 bg-indigo-500/10 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-indigo-300 flex items-center gap-1"><Sparkles className="w-3 h-3" /> {aiConcept.title ?? "AI Design"}</span>
                <button onClick={() => setShowConcept(false)} className="text-white/30 hover:text-white"><X className="w-3.5 h-3.5" /></button>
              </div>
              {aiConcept.colors && aiConcept.colors.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {aiConcept.colors.slice(0, 6).map((c, i) => (
                    <button
                      key={i}
                      onClick={() => handleUseColors(aiConcept.colors!.map((x) => x.hex))}
                      title={c.name}
                      className="w-5 h-5 rounded-full border border-white/20 hover:scale-110 transition-transform"
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              )}
              {aiConcept.style && <p className="text-[10px] text-white/40 mt-1.5">{aiConcept.style}</p>}
            </div>
          )}
        </aside>
      </div>

      {/* ── 2D TEXTURE EDITOR OVERLAY ─────────────────────────────────
           Canvas is ALWAYS in the DOM here (never unmounted) so Fabric.js
           keeps its state. We toggle visibility with opacity + pointer-events.  */}
      <div
        className="fixed inset-0 flex flex-col bg-[#080e1a] transition-opacity duration-200"
        style={{ zIndex: 60, opacity: textureEditorOpen ? 1 : 0, pointerEvents: textureEditorOpen ? "auto" : "none" }}
      >
        {/* Toolbar */}
        <div className="h-12 shrink-0 border-b border-white/10 bg-[#0d1117] flex items-center px-4 gap-2 overflow-x-auto">
          <span className="text-sm font-semibold text-white flex items-center gap-2 shrink-0 mr-2">
            <Shirt className="w-4 h-4 text-indigo-400" />
            {activeClassicType === "shirt" ? "Shirt Texture" : "Pants Texture"}
          </span>

          <button onClick={() => { setEraserMode(false); setDrawingMode((p) => !p); }} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border transition-all shrink-0 ${drawingMode && !eraserMode ? "bg-indigo-600 border-indigo-500 text-white" : "border-white/10 text-white/50 hover:text-white"}`}>
            <PenTool className="w-3.5 h-3.5" /> Draw
          </button>
          <button
            onClick={() => { setEraserMode((prev) => !prev); setDrawingMode(true); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border transition-all shrink-0 ${eraserMode ? "bg-red-600 border-red-500 text-white" : "border-white/10 text-white/50 hover:text-white"}`}
          >
            <Trash2 className="w-3.5 h-3.5" /> Erase
          </button>
          <button onClick={fillActiveZone} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border border-white/10 text-white/50 hover:text-white transition-all shrink-0">
            <Palette className="w-3.5 h-3.5" /> Fill Zone
          </button>
          <button onClick={addText} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border border-white/10 text-white/50 hover:text-white transition-all shrink-0">
            <Type className="w-3.5 h-3.5" /> Text
          </button>
          <button onClick={addRect} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border border-white/10 text-white/50 hover:text-white transition-all shrink-0">
            <Square className="w-3.5 h-3.5" /> Rect
          </button>
          <button onClick={addCircle} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border border-white/10 text-white/50 hover:text-white transition-all shrink-0">
            <Circle className="w-3.5 h-3.5" /> Circle
          </button>
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs border border-white/10 text-white/50 hover:text-white transition-all cursor-pointer shrink-0">
            <ImageIcon className="w-3.5 h-3.5" /> Image
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </label>
          <button onClick={zoomOut} className="p-2 rounded border border-white/10 text-white/50 hover:text-white shrink-0"><ZoomOut className="w-3.5 h-3.5" /></button>
          <button onClick={zoomIn} className="p-2 rounded border border-white/10 text-white/50 hover:text-white shrink-0"><ZoomIn className="w-3.5 h-3.5" /></button>

          <div className="flex items-center gap-1 px-2 py-1 rounded-md border border-white/10 bg-white/5 shrink-0">
            <span className="text-[10px] uppercase tracking-wide text-white/40">Zone</span>
            <select
              value={activeZone}
              onChange={(e) => setActiveZone(e.target.value as ZoneKey)}
              className="bg-transparent text-xs text-white/80 outline-none"
            >
              {getEnabledZones(activeClassicType).map((zone) => (
                <option key={zone.key} value={zone.key} className="bg-[#0d1117]">
                  {zone.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1" />

          <button
            onClick={() => { handleSave(); setTextureEditorOpen(false); }}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shrink-0"
          >
            <Save className="w-3.5 h-3.5" /> Done
          </button>
        </div>

        {/* Canvas + sidebar */}
        <div className="flex flex-1 overflow-hidden">
          {/* Canvas area */}
          <div
            className="flex-1 overflow-auto flex items-center justify-center bg-[#060b14] p-6"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!draggingModuleId || !fabricRef.current) return;
              const module = MODULE_LIBRARY.find((m) => m.id === draggingModuleId);
              if (!module) return;
              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              addModuleAt(module, e.clientX - rect.left, e.clientY - rect.top);
              setDraggingModuleId(null);
            }}
          >
            <canvas ref={canvasRef} className="shadow-2xl rounded" />
          </div>

          {/* Right sidebar: colors + properties + modules */}
          <div className="w-52 shrink-0 border-l border-white/10 bg-[#0d1117] overflow-y-auto p-3 space-y-4">
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Colors</p>
              <div className="flex flex-wrap gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] text-white/30 block">Fill</label>
                  <input type="color" value={fillColor} onChange={(e) => setFillColor(e.target.value)} className="w-8 h-8 rounded border border-white/20 cursor-pointer bg-transparent" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-white/30 block">Stroke</label>
                  <input type="color" value={strokeColor} onChange={(e) => setStrokeColor(e.target.value)} className="w-8 h-8 rounded border border-white/20 cursor-pointer bg-transparent" />
                </div>
              </div>
              {drawingMode && (
                <div className="space-y-1">
                  <label className="text-[9px] text-white/30 block">Brush size: {brushSize}px</label>
                  <input type="range" min={1} max={40} value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-full" />
                </div>
              )}
            </div>

            {selectedObject && (
              <div className="space-y-2 pt-2 border-t border-white/8">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Selected</p>
                <div className="text-[10px] text-white/30 bg-white/5 px-2 py-1 rounded capitalize">
                  {getObjectMeta(selectedObject).layerName ?? selectedObject.type}
                </div>
                <div className="flex items-center gap-2">
                  <input type="color" value={typeof selectedObject.fill === "string" ? selectedObject.fill : "#000000"}
                    onChange={e => { selectedObject.set("fill", e.target.value); setFillColor(e.target.value); fabricRef.current?.renderAll(); syncAvatarTextureFromCanvas(); }}
                    className="w-7 h-7 rounded border border-white/20 cursor-pointer bg-transparent"
                  />
                  <span className="text-[10px] font-mono text-white/40">{typeof selectedObject.fill === "string" ? selectedObject.fill : "–"}</span>
                </div>
                <div className="space-y-0.5">
                  <label className="text-[9px] text-white/30 block">Opacity {Math.round((selectedObject.opacity ?? 1) * 100)}%</label>
                  <input type="range" min="0" max="1" step="0.01" value={selectedObject.opacity ?? 1}
                    onChange={e => { selectedObject.set("opacity", parseFloat(e.target.value)); fabricRef.current?.renderAll(); setSelectedObject({ ...selectedObject } as fabric.Object); syncAvatarTextureFromCanvas(); }}
                    className="w-full"
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[9px] text-white/30 block">Rotation {Math.round(selectedObject.angle ?? 0)}°</label>
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    step={1}
                    value={selectedObject.angle ?? 0}
                    onChange={(e) => {
                      selectedObject.set("angle", parseFloat(e.target.value));
                      fabricRef.current?.renderAll();
                      setSelectedObject({ ...selectedObject } as fabric.Object);
                      syncAvatarTextureFromCanvas();
                    }}
                    className="w-full"
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[9px] text-white/30 block">Size {Number(selectedObject.scaleX ?? 1).toFixed(2)}x</label>
                  <input
                    type="range"
                    min={0.2}
                    max={3}
                    step={0.01}
                    value={selectedObject.scaleX ?? 1}
                    onChange={(e) => {
                      const nextScale = parseFloat(e.target.value);
                      selectedObject.set({ scaleX: nextScale, scaleY: nextScale });
                      const zone = getObjectMeta(selectedObject).zone;
                      if (zone) constrainObjectToZone(selectedObject, zone);
                      fabricRef.current?.renderAll();
                      setSelectedObject({ ...selectedObject } as fabric.Object);
                      syncAvatarTextureFromCanvas();
                    }}
                    className="w-full"
                  />
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <label className="text-[9px] text-white/30">
                    X
                    <Input
                      value={Math.round(selectedObject.left ?? 0)}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        selectedObject.set("left", Number.isFinite(next) ? next : 0);
                        const zone = getObjectMeta(selectedObject).zone;
                        if (zone) constrainObjectToZone(selectedObject, zone);
                        fabricRef.current?.renderAll();
                        setSelectedObject({ ...selectedObject } as fabric.Object);
                        syncAvatarTextureFromCanvas();
                      }}
                      className="h-6 mt-1 bg-white/5 border-white/10 text-[10px]"
                    />
                  </label>
                  <label className="text-[9px] text-white/30">
                    Y
                    <Input
                      value={Math.round(selectedObject.top ?? 0)}
                      onChange={(e) => {
                        const next = Number(e.target.value);
                        selectedObject.set("top", Number.isFinite(next) ? next : 0);
                        const zone = getObjectMeta(selectedObject).zone;
                        if (zone) constrainObjectToZone(selectedObject, zone);
                        fabricRef.current?.renderAll();
                        setSelectedObject({ ...selectedObject } as fabric.Object);
                        syncAvatarTextureFromCanvas();
                      }}
                      className="h-6 mt-1 bg-white/5 border-white/10 text-[10px]"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <button onClick={() => setSnapEnabled((prev) => !prev)} className={`flex items-center justify-center gap-1 py-1.5 text-[10px] rounded border transition-colors ${snapEnabled ? "border-indigo-500/60 text-indigo-300 bg-indigo-500/10" : "border-white/10 text-white/40 hover:text-white"}`}>
                    <Grid3X3 className="w-3 h-3" /> Snap
                  </button>
                  <button onClick={toggleObjectLock} className="flex items-center justify-center gap-1 py-1.5 text-[10px] rounded border border-white/10 text-white/40 hover:text-white transition-colors">
                    {selectedObject.lockMovementX ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />} {selectedObject.lockMovementX ? "Unlock" : "Lock"}
                  </button>
                  <button onClick={groupSelection} className="flex items-center justify-center gap-1 py-1.5 text-[10px] rounded border border-white/10 text-white/40 hover:text-white transition-colors">
                    <Group className="w-3 h-3" /> Group
                  </button>
                  <button onClick={ungroupSelection} className="flex items-center justify-center gap-1 py-1.5 text-[10px] rounded border border-white/10 text-white/40 hover:text-white transition-colors">
                    <Ungroup className="w-3 h-3" /> Ungroup
                  </button>
                  <button onClick={deleteSelected} className="flex items-center justify-center gap-1 py-1.5 text-[10px] rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">
                    <Trash2 className="w-3 h-3" /> Del
                  </button>
                  <button onClick={duplicateSelected} className="flex items-center justify-center gap-1 py-1.5 text-[10px] rounded border border-white/10 text-white/40 hover:text-white transition-colors">
                    <Copy className="w-3 h-3" /> Copy
                  </button>
                  <button onClick={() => moveLayer("up")} className="flex items-center justify-center gap-1 py-1.5 text-[10px] rounded border border-white/10 text-white/40 hover:text-white transition-colors">
                    <MoveUp className="w-3 h-3" /> Up
                  </button>
                  <button onClick={() => moveLayer("down")} className="flex items-center justify-center gap-1 py-1.5 text-[10px] rounded border border-white/10 text-white/40 hover:text-white transition-colors">
                    <MoveDown className="w-3 h-3" /> Down
                  </button>
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-white/8 space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Modules</p>
              <div className="flex flex-wrap gap-1">
                {Array.from(new Set(MODULE_LIBRARY.map((m) => m.category))).map((cat) => (
                  <button key={cat} onClick={() => setActiveModuleCategory(cat)}
                    className={`px-1.5 py-0.5 text-[9px] rounded border transition-all ${activeModuleCategory === cat ? "border-indigo-500 bg-indigo-600/30 text-indigo-300" : "border-white/10 text-white/30 hover:text-white"}`}
                  >{cat}</button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {MODULE_LIBRARY.filter((m) => m.category === activeModuleCategory).map((module) => (
                  <button key={module.id} onClick={() => addModule(module)} draggable onDragStart={() => setDraggingModuleId(module.id)}
                    className="border border-white/10 rounded-md p-1.5 text-left hover:border-white/20 transition-colors"
                  >
                    <div className="w-full h-6 rounded mb-1" style={{ backgroundColor: module.color, opacity: 0.85 }} />
                    <p className="text-[9px] text-white/50 leading-tight">{module.name}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── PAYMENT DIALOG ───────────────────────────────────────────── */}
      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="max-w-md bg-[#0d1117] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Buy Roblox Upload Credit</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-white/70">You need 1 credit (10 NOK) to upload to Roblox.</p>
            <p className="text-white/50">Current credits: <strong className="text-white">{credits}</strong></p>
            <Button className="w-full" onClick={handleBuyCredit} disabled={isBuyingCredit}>
              {isBuyingCredit ? "Opening Stripe..." : "Buy 1 Credit (10 NOK)"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
