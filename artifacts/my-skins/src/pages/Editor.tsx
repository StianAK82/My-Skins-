import { useEffect, useRef, useState, useCallback } from "react";
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
type ClothingDimension = "2d" | "3d";
type GarmentMaterial = "cotton" | "denim" | "nylon";

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

const TEMPLATE_ZONES: Record<"shirt" | "pants", { front: TemplateZone; back: TemplateZone; leftRegion: TemplateZone; rightRegion: TemplateZone }> = {
  shirt: {
    front: { label: "Front / Chest", left: 196, top: 118, width: 128, height: 128 },
    back: { label: "Back", left: 338, top: 118, width: 128, height: 128 },
    leftRegion: { label: "Left Sleeve", left: 44, top: 118, width: 128, height: 128 },
    rightRegion: { label: "Right Sleeve", left: 481, top: 118, width: 88, height: 128 },
  },
  pants: {
    front: { label: "Front / Legs", left: 196, top: 288, width: 128, height: 192 },
    back: { label: "Back / Legs", left: 338, top: 288, width: 128, height: 192 },
    leftRegion: { label: "Left Leg", left: 44, top: 288, width: 128, height: 192 },
    rightRegion: { label: "Right Leg", left: 481, top: 288, width: 88, height: 192 },
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

  const [creatorMode, setCreatorMode] = useState<"ai" | "manual" | "template" | "remix">("ai");
  const [selectedObject, setSelectedObject] = useState<fabric.Object | null>(null);
  const [drawingMode, setDrawingMode] = useState(false);
  const [fillColor, setFillColor] = useState("#3b82f6");
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(8);
  const [aiConcept, setAiConcept] = useState<AiConcept | null>(null);
  const [showConcept, setShowConcept] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [avatarTextureUrl, setAvatarTextureUrl] = useState("");
  const [credits, setCredits] = useState(0);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [isBuyingCredit, setIsBuyingCredit] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [creationMode, setCreationMode] = useState("ai");
  const [dimension, setDimension] = useState<ClothingDimension>("2d");
  const [classicItemType, setClassicItemType] = useState<"shirt" | "pants">("shirt");
  const [garmentType3d, setGarmentType3d] = useState<"hoodie">("hoodie");
  const [garmentColor, setGarmentColor] = useState("#2563eb");
  const [garmentMaterial, setGarmentMaterial] = useState<GarmentMaterial>("cotton");
  const [garmentScale, setGarmentScale] = useState(1);
  const [avatarProfile, setAvatarProfile] = useState({ avatarType: "neutral", bodyType: "regular" });
  const [activeModuleCategory, setActiveModuleCategory] = useState("Clothing Parts");
  const [selectedStylePreset, setSelectedStylePreset] = useState<StylePreset>("streetwear");
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [draggingModuleId, setDraggingModuleId] = useState<string | null>(null);
  const [previewFacing, setPreviewFacing] = useState<"front" | "back">("front");

  const { data: project, isLoading } = useGetProject(id);
  const { data: me, refetch: refetchMe } = useGetMe();
  const saveCanvas = useSaveCanvas();
  const createExport = useCreateExport();
  const activeClassicType = classicItemType ?? ((project?.type as "shirt" | "pants") ?? "shirt");

  useEffect(() => {
    if (!project?.type) return;
    if (project.type === "shirt" || project.type === "pants") {
      setClassicItemType(project.type);
    }
  }, [project?.type]);

  // These must be declared BEFORE the canvas useEffect that depends on them
  const handleUseColors = useCallback((colors: string[]) => {
    if (colors[0]) setFillColor(colors[0]);
    if (colors[1]) setStrokeColor(colors[1]);
    toast({ title: language === "no" ? "Farger brukt!" : "Colors applied!" });
  }, [toast, language]);

  const addTemplateGuideLayer = useCallback(() => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    const type = activeClassicType;
    const zones = TEMPLATE_ZONES[type];

    canvas.getObjects().forEach((obj) => {
      if (getObjectMeta(obj).role === "template-guide") {
        canvas.remove(obj);
      }
    });

    (Object.values(zones) as TemplateZone[]).forEach((zone) => {
      const frame = new fabric.Rect({
        left: zone.left,
        top: zone.top,
        width: zone.width,
        height: zone.height,
        fill: "rgba(59, 130, 246, 0.06)",
        stroke: "rgba(59, 130, 246, 0.4)",
        strokeWidth: 1,
        selectable: false,
        evented: false,
        data: { role: "template-guide" },
      });

      const label = new fabric.Text(zone.label, {
        left: zone.left + 6,
        top: zone.top + 6,
        fontSize: 10,
        fill: "rgba(59, 130, 246, 0.8)",
        selectable: false,
        evented: false,
        data: { role: "template-guide" },
      });

      canvas.add(frame);
      canvas.add(label);
      canvas.sendObjectToBack(label);
      canvas.sendObjectToBack(frame);
    });
  }, [activeClassicType]);

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
    addFallbackShapeToZone(zones.leftRegion, palette[1], "Starter Left Sleeve");
    addFallbackShapeToZone(zones.rightRegion, palette[2], "Starter Right Sleeve");
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

    canvas.on("selection:created", (e) => setSelectedObject(e.selected?.[0] || null));
    canvas.on("selection:updated", (e) => setSelectedObject(e.selected?.[0] || null));
    canvas.on("selection:cleared", () => setSelectedObject(null));
    canvas.on("object:moving", (e) => {
      if (!snapEnabled || !e.target) return;
      const grid = 8;
      e.target.set({
        left: Math.round((e.target.left ?? 0) / grid) * grid,
        top: Math.round((e.target.top ?? 0) / grid) * grid,
      });
    });

    return () => { canvas.dispose(); fabricRef.current = null; };
  }, [addTemplateGuideLayer, project?.id, snapEnabled]);

  // Drawing mode
  useEffect(() => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    canvas.isDrawingMode = drawingMode;
    if (drawingMode && canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = strokeColor;
      canvas.freeDrawingBrush.width = brushSize;
    }
  }, [drawingMode, strokeColor, brushSize]);

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
    canvas.on("after:render", updatePreview);

    return () => {
      if (timeout) clearTimeout(timeout);
      canvas.off("object:added", updatePreview);
      canvas.off("object:removed", updatePreview);
      canvas.off("object:modified", updatePreview);
      canvas.off("path:created", updatePreview);
      canvas.off("after:render", updatePreview);
    };
  }, [project?.id]);

  useEffect(() => {
    setCredits(me?.aiCredits ?? 0);
  }, [me?.aiCredits]);

  const handleSave = async () => {
    if (!fabricRef.current) return;
    const canvasJSON = fabricRef.current.toJSON();
    if (aiConcept) (canvasJSON as Record<string, unknown>).__aiConcept = aiConcept;
    const json = JSON.stringify(canvasJSON);
    const dataUrl = fabricRef.current.toDataURL({ format: "png", quality: 0.5, multiplier: 0.5 });

    saveCanvas.mutate(
      { id, data: { canvasData: json, thumbnailUrl: dataUrl } },
      {
        onSuccess: () => toast({ title: language === "no" ? "Lagret!" : "Saved!", description: language === "no" ? "Prosjektet er lagret." : "Project saved." }),
        onError: () => toast({ title: language === "no" ? "Feil" : "Error", description: language === "no" ? "Klarte ikke å lagre." : "Failed to save.", variant: "destructive" }),
      }
    );
  };

  const handleExport = () => {
    if (!fabricRef.current) return;
    const dataUrl = fabricRef.current.toDataURL({ format: "png", multiplier: 1 });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${project?.title ?? "design"}.png`;
    a.click();
    createExport.mutate({ data: { projectId: id, format: "png" } });
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
    const text = new fabric.IText(language === "no" ? "Rediger tekst" : "Edit text", {
      left: 150, top: 150,
      fontFamily: "Inter, sans-serif",
      fill: fillColor, fontSize: 36,
    });
    fabricRef.current.add(text);
    fabricRef.current.setActiveObject(text);
    fabricRef.current.renderAll();
  };

  const addRect = () => {
    if (!fabricRef.current) return;
    setDrawingMode(false);
    const rect = new fabric.Rect({
      left: 100, top: 100,
      fill: fillColor, stroke: strokeColor, strokeWidth: 2,
      width: 120, height: 80, rx: 4,
    });
    fabricRef.current.add(rect);
    fabricRef.current.setActiveObject(rect);
    fabricRef.current.renderAll();
  };

  const addCircle = () => {
    if (!fabricRef.current) return;
    setDrawingMode(false);
    const circle = new fabric.Circle({
      left: 120, top: 120,
      fill: fillColor, stroke: strokeColor, strokeWidth: 2, radius: 50,
    });
    fabricRef.current.add(circle);
    fabricRef.current.setActiveObject(circle);
    fabricRef.current.renderAll();
  };

  const addModule = (module: ModuleDefinition) => {
    if (!fabricRef.current) return;
    setDrawingMode(false);
    let object: fabric.Object;
    if (module.shape === "circle") {
      object = new fabric.Circle({
        left: 160,
        top: 160,
        radius: 36,
        fill: module.color,
        opacity: 0.9,
        data: { role: "module", category: module.category, moduleName: module.name, layerName: module.name },
      });
    } else if (module.shape === "stripe") {
      object = new fabric.Rect({
        left: 120,
        top: 120,
        width: 160,
        height: 22,
        fill: module.color,
        rx: 8,
        opacity: 0.9,
        data: { role: "module", category: module.category, moduleName: module.name, layerName: module.name },
      });
    } else {
      object = new fabric.Rect({
        left: 120,
        top: 120,
        width: 110,
        height: 90,
        rx: 12,
        fill: module.color,
        opacity: 0.9,
        data: { role: "module", category: module.category, moduleName: module.name, layerName: module.name },
      });
    }
    fabricRef.current.add(object);
    fabricRef.current.setActiveObject(object);
    fabricRef.current.renderAll();
  };

  const addModuleAt = (module: ModuleDefinition, left: number, top: number) => {
    addModule(module);
    const obj = fabricRef.current?.getActiveObject();
    if (!obj || !fabricRef.current) return;
    obj.set({ left, top });
    fabricRef.current.renderAll();
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
    });
  };

  const moveLayer = (direction: "up" | "down") => {
    if (!fabricRef.current || !selectedObject) return;
    if (direction === "up") fabricRef.current.bringObjectForward(selectedObject);
    else fabricRef.current.sendObjectBackwards(selectedObject);
    fabricRef.current.renderAll();
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
  };

  const deleteSelected = () => {
    if (!fabricRef.current) return;
    fabricRef.current.getActiveObjects().forEach(obj => fabricRef.current?.remove(obj));
    fabricRef.current.discardActiveObject();
    fabricRef.current.renderAll();
    setSelectedObject(null);
  };

  const groupSelection = () => {
    if (!fabricRef.current) return;
    const active = fabricRef.current.getActiveObject();
    if (active && active.type === "activeSelection") {
      const selection = active as fabric.ActiveSelection;
      const grouped = new fabric.Group(selection.getObjects());
      fabricRef.current.remove(selection);
      fabricRef.current.add(grouped);
      fabricRef.current.setActiveObject(grouped);
      fabricRef.current.renderAll();
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
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !fabricRef.current) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      fabric.FabricImage.fromURL(src).then((img) => {
        img.scaleToWidth(200);
        fabricRef.current?.add(img);
        fabricRef.current?.setActiveObject(img);
        fabricRef.current?.renderAll();
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
      data: { role: "ai-generated", zone: zone.label, layerName: `${layerName} Stripe` },
    });
    const emblem = new fabric.Circle({
      left: zone.left + (zone.width * 0.5) - 20,
      top: zone.top + (zone.height * 0.5) - 20,
      radius: 20,
      fill: color,
      opacity: 0.75,
      selectable: true,
      evented: true,
      data: { role: "ai-generated", zone: zone.label, layerName: `${layerName} Emblem` },
    });
    fabricRef.current.add(stripe);
    fabricRef.current.add(emblem);
  }

  const applyAiOutfitToCanvas = useCallback(async (result: NormalizedAiResponse) => {
    if (!fabricRef.current) return false;
    const canvas = fabricRef.current;

    setDrawingMode(false);
    try {
      const plan = buildEditorApplyPlan(result);
      canvas.backgroundColor = plan.backgroundColor;

      canvas.getObjects().forEach((obj) => {
        if (getObjectMeta(obj).role === "template-guide") {
          canvas.remove(obj);
        }
      });

      if (plan.modules.length === 0) {
        throw new Error("AI returned zero modules; cannot apply degraded design as success.");
      }

      for (const module of plan.modules) {
        const radius = Math.max(8, 28 * module.scale);
        const shape = module.type === "stripe"
          ? new fabric.Rect({ width: 120 * module.scale, height: 18 * module.scale, fill: module.color, opacity: module.opacity })
          : new fabric.Circle({ radius, fill: module.color, opacity: module.opacity });

        shape.set({
          left: 90 + (module.position.x * 460),
          top: 80 + (module.position.y * 420),
          angle: module.rotation,
          selectable: true,
          evented: true,
          data: { role: "ai-generated", moduleId: module.id, layerName: module.label },
        });
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
  }, [addTemplateGuideLayer, handleUseColors, language, toast]);

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
        setCreationMode(parsed.creationMode);
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
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 shrink-0 gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div className="font-semibold text-sm truncate max-w-[180px]">{project?.title}</div>
          <div className="flex items-center gap-1">
            <span className="text-xs bg-muted px-2 py-0.5 rounded uppercase text-muted-foreground">{dimension === "2d" ? "Classic 2D" : "3D clothing"}</span>
            <span className="text-xs bg-muted px-2 py-0.5 rounded uppercase text-muted-foreground">{creationMode}</span>
            <span className="text-xs bg-muted px-2 py-0.5 rounded">{avatarProfile.avatarType}/{avatarProfile.bodyType}</span>
            {project?.isAiGenerated && (
              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded uppercase font-semibold flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5" /> AI
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium px-2 py-1 rounded bg-muted">Credits: {credits}</span>
          <Button size="sm" variant="outline" onClick={() => setPaymentOpen(true)}>
            Buy 1 Credit (10 NOK)
          </Button>
          <Button variant="outline" size="sm" onClick={handleSave} disabled={saveCanvas.isPending}>
            <Save className="w-4 h-4 mr-1.5" />
            {saveCanvas.isPending ? (language === "no" ? "Lagrer..." : "Saving...") : t("editor.save")}
          </Button>
          <Button size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-1.5" />
            {t("editor.export")}
          </Button>
          <Button size="sm" onClick={handleUploadToRoblox} disabled={credits < 1 || isUploading}>
            {isUploading ? "Uploading..." : "Upload to Roblox (1 Credit)"}
          </Button>
          <Button size="sm" variant={snapEnabled ? "default" : "outline"} onClick={() => setSnapEnabled((prev) => !prev)}>
            <Grid3X3 className="w-3.5 h-3.5 mr-1" /> Snap
          </Button>
        </div>
      </header>

      {/* AI Concept Banner */}
      <AnimatePresence>
        {aiConcept && showConcept && (
          <AiConceptBanner
            concept={aiConcept}
            onClose={() => setShowConcept(false)}
            onUseColors={handleUseColors}
          />
        )}
      </AnimatePresence>

      <div className="border-b border-border bg-card/70 px-4 py-3 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Creation dimension</span>
          <Button size="sm" variant={dimension === "2d" ? "default" : "outline"} onClick={() => setDimension("2d")} className="gap-1"><Shirt className="w-3.5 h-3.5" /> Classic 2D Clothing</Button>
          <Button size="sm" variant={dimension === "3d" ? "default" : "outline"} onClick={() => setDimension("3d")} className="gap-1"><Boxes className="w-3.5 h-3.5" /> 3D Clothing</Button>
        </div>
      </div>

      <div className="grid flex-1 overflow-hidden 2xl:grid-cols-[290px_minmax(0,1fr)_360px] xl:grid-cols-[270px_minmax(0,1fr)_340px] lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="border-r border-border bg-card overflow-y-auto p-4 space-y-4">
          <div>
            <h3 className="font-semibold text-sm flex items-center gap-2"><User className="w-4 h-4" /> Build Controls</h3>
            <p className="text-xs text-muted-foreground mt-1">Pick who you are designing for and what garment you are building.</p>
          </div>
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Avatar selection</p>
            <div className="grid grid-cols-2 gap-2">
              {["neutral", "feminine", "masculine", "stylized"].map((type) => (
                <Button key={type} size="sm" variant={avatarProfile.avatarType === type ? "default" : "outline"} className="text-[11px]" onClick={() => setAvatarProfile((p) => ({ ...p, avatarType: type }))}>
                  {type}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Body type</p>
            <div className="grid grid-cols-3 gap-2">
              {["regular", "slim", "athletic"].map((type) => (
                <Button key={type} size="sm" variant={avatarProfile.bodyType === type ? "default" : "outline"} className="text-[11px]" onClick={() => setAvatarProfile((p) => ({ ...p, bodyType: type }))}>
                  {type}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Item type</p>
            <div className="flex flex-wrap gap-2">
              {dimension === "2d" ? (
                <>
                  <Button size="sm" variant={activeClassicType === "shirt" ? "default" : "outline"} className="text-xs" onClick={() => setClassicItemType("shirt")}>Shirt</Button>
                  <Button size="sm" variant={activeClassicType === "pants" ? "default" : "outline"} className="text-xs" onClick={() => setClassicItemType("pants")}>Pants</Button>
                </>
              ) : (
                <Button size="sm" variant="default" className="text-xs" onClick={() => setGarmentType3d("hoodie")}>Hoodie</Button>
              )}
            </div>
          </div>
          {dimension === "3d" && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1"><SlidersHorizontal className="w-3.5 h-3.5" /> 3D garment controls</h4>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Garment color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={garmentColor} onChange={(e) => setGarmentColor(e.target.value)} className="w-8 h-8 rounded border border-border bg-transparent cursor-pointer" />
                  <span className="text-xs font-mono">{garmentColor}</span>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Material</label>
                <div className="grid grid-cols-3 gap-1">
                  {(["cotton", "denim", "nylon"] as const).map((material) => (
                    <Button key={material} size="sm" variant={garmentMaterial === material ? "default" : "outline"} className="h-7 text-[10px]" onClick={() => setGarmentMaterial(material)}>
                      {material}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wide text-muted-foreground">Fit / scale · {garmentScale.toFixed(2)}x</label>
                <input type="range" min={0.85} max={1.2} step={0.01} value={garmentScale} onChange={(e) => setGarmentScale(parseFloat(e.target.value))} className="w-full" />
              </div>
              <p className="text-[11px] text-muted-foreground">Decal placement uses your live design as chest graphic in 3D preview.</p>
            </div>
          )}
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Style presets</p>
            <div className="grid grid-cols-2 gap-2">
              {STYLE_PRESET_VALUES.map((preset) => (
                <Button key={preset} size="sm" variant={selectedStylePreset === preset ? "default" : "outline"} className="h-8 text-[11px] capitalize" onClick={() => setSelectedStylePreset(preset)}>
                  {preset}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Module categories</p>
            <div className="flex flex-wrap gap-1">
              {Array.from(new Set(MODULE_LIBRARY.map((m) => m.category))).map((category) => (
                <button key={category} onClick={() => setActiveModuleCategory(category)} className={`px-2 py-1 text-[10px] rounded border ${activeModuleCategory === category ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                  {category}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Template zones</p>
            <div className="rounded-md border border-border bg-muted/20 p-2 text-xs text-muted-foreground space-y-1">
              {Object.values(TEMPLATE_ZONES[activeClassicType]).map((zone) => (
                <div key={zone.label} className="flex items-center justify-between"><span>{zone.label}</span><span>{zone.width}×{zone.height}</span></div>
              ))}
            </div>
          </div>
        </aside>

        <main className="bg-[#0f172a] relative overflow-auto p-4 lg:p-6 lg:col-span-1 col-span-full order-first lg:order-none">
          <div className="max-w-5xl mx-auto space-y-4 min-h-full">
            <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-xs text-slate-200 flex items-center justify-between">
              <span>Live Avatar Preview · always visible while editing.</span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant={previewFacing === "front" ? "secondary" : "outline"} onClick={() => setPreviewFacing("front")}>Front</Button>
                <Button size="sm" variant={previewFacing === "back" ? "secondary" : "outline"} onClick={() => setPreviewFacing("back")}>Back</Button>
              </div>
            </div>
            <AvatarPreview
              textureUrl={avatarTextureUrl}
              avatarType={avatarProfile.avatarType}
              bodyType={avatarProfile.bodyType}
              view={previewFacing}
              onViewChange={setPreviewFacing}
              itemType={activeClassicType}
              dimension={dimension}
              garmentColor={garmentColor}
              garmentMaterial={garmentMaterial}
              garmentScale={garmentScale}
              className="border-primary/20 shadow-2xl"
            />
            {dimension === "2d" ? (
              <div className="rounded-xl border border-white/10 bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2"><Shirt className="w-4 h-4" /> Classic 2D Design Surface</h3>
                  <div className="flex gap-1.5">
                    <Button variant="ghost" size="icon" onClick={zoomOut}><ZoomOut className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={zoomIn}><ZoomIn className="w-4 h-4" /></Button>
                  </div>
                </div>
                <div className="flex items-center justify-center overflow-auto">
                  <canvas
                    ref={canvasRef}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (!draggingModuleId || !fabricRef.current) return;
                      const module = MODULE_LIBRARY.find((m) => m.id === draggingModuleId);
                      if (!module) return;
                      const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
                      addModuleAt(module, e.clientX - rect.left, e.clientY - rect.top);
                      setDraggingModuleId(null);
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-card p-4 text-sm text-muted-foreground">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2"><Palette className="w-4 h-4" /> 3D garment workspace</h3>
                <p className="mb-2">You are in 3D clothing mode ({garmentType3d}). Use left panel material, color and fit controls. Right panel AI can generate 3D concepts (beta).</p>
                <p>Current release keeps classic 2D export/upload pipeline. 3D previews are live in the center avatar and workflow is separated for future backend completion.</p>
              </div>
            )}
          </div>
        </main>

        <aside className="border-t lg:border-t-0 lg:border-l border-border bg-card p-3 overflow-y-auto shrink-0 lg:col-span-2 xl:col-span-1">
          <Tabs value={creatorMode} onValueChange={(value) => { const mode = value as "ai" | "manual" | "template" | "remix"; setCreatorMode(mode); setCreationMode(mode); }} className="space-y-3">
            <TabsList className="grid grid-cols-2 h-auto gap-1 bg-muted/40 p-1">
              <TabsTrigger value="ai" className="text-xs"><Sparkles className="w-3 h-3 mr-1" /> AI Design</TabsTrigger>
              <TabsTrigger value="manual" className="text-xs"><PenTool className="w-3 h-3 mr-1" /> Build Manually</TabsTrigger>
              <TabsTrigger value="template" className="text-xs"><LayoutTemplate className="w-3 h-3 mr-1" /> Start Template</TabsTrigger>
              <TabsTrigger value="remix" className="text-xs"><Wand2 className="w-3 h-3 mr-1" /> Remix</TabsTrigger>
            </TabsList>
            <TabsContent value="ai" className="m-0">
              <AiPanel
                projectType={activeClassicType}
                dimension={dimension}
                onDimensionChange={setDimension}
                onUseColors={handleUseColors}
                onApplyAssets={applyAiOutfitToCanvas}
              />
            </TabsContent>
            <TabsContent value="manual" className="m-0 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2"><Layers className="w-4 h-4" /> Manual Builder</h3>
              {dimension === "3d" && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-100">
                  Manual 3D tooling currently supports garment controls in the left panel. 2D canvas tools are disabled in 3D mode.
                </div>
              )}
              <div className="grid grid-cols-2 gap-1.5">
                <Button variant="outline" className="flex-col h-14 gap-1 text-xs" onClick={addText} disabled={dimension === "3d"}><Type className="w-4 h-4" />Text</Button>
                <Button variant="outline" className="flex-col h-14 gap-1 text-xs" onClick={addRect} disabled={dimension === "3d"}><Square className="w-4 h-4" />Rect</Button>
                <Button variant="outline" className="flex-col h-14 gap-1 text-xs" onClick={addCircle} disabled={dimension === "3d"}><Circle className="w-4 h-4" />Circle</Button>
                <Button variant={drawingMode ? "default" : "outline"} className="flex-col h-14 gap-1 text-xs" onClick={() => setDrawingMode((p) => !p)} disabled={dimension === "3d"}><PenTool className="w-4 h-4" />Draw</Button>
              </div>
              <label className="flex flex-col items-center gap-1.5 h-14 border border-dashed border-border rounded-md cursor-pointer hover:border-primary/50 text-xs text-muted-foreground justify-center">
                <ImageIcon className="w-4 h-4" /> Upload Image
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={dimension === "3d"} />
              </label>
              <div className="space-y-2">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Module library</p>
                <div className="grid grid-cols-2 gap-2">
                  {MODULE_LIBRARY.filter((module) => module.category === activeModuleCategory).map((module) => (
                    <button key={module.id} onClick={() => addModule(module)} draggable={dimension !== "3d"} onDragStart={() => setDraggingModuleId(module.id)} className="border rounded-md p-2 text-left hover:border-primary/60 transition-colors disabled:opacity-50" disabled={dimension === "3d"}>
                      <div className="w-full h-8 rounded mb-1" style={{ backgroundColor: module.color, opacity: 0.85 }} />
                      <p className="text-xs font-medium leading-tight">{module.name}</p>
                    </button>
                  ))}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="template" className="m-0 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2"><LayoutTemplate className="w-4 h-4" /> Template Loader</h3>
              <p className="text-xs text-muted-foreground">Load zone guides and starter layout for fast composition.</p>
              <Button className="w-full" onClick={() => addTemplateGuideLayer()}>Reload Template Zones</Button>
              <Button variant="outline" className="w-full" onClick={() => ensureVisibleStarterDesign(selectedStylePreset)}>Apply Starter Design</Button>
            </TabsContent>
            <TabsContent value="remix" className="m-0 space-y-3">
              <h3 className="font-semibold text-sm flex items-center gap-2"><Wand2 className="w-4 h-4" /> Remix Existing</h3>
              <p className="text-xs text-muted-foreground">Select a source from current canvas + AI concept and iterate quickly.</p>
              <Button className="w-full" variant="outline" onClick={() => setCreatorMode("ai")}>Open AI Remix Tools</Button>
            </TabsContent>
          </Tabs>

          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4" />
            {t("editor.properties")}
          </h3>

          {dimension === "3d" ? (
            <div className="text-xs text-muted-foreground py-4 leading-relaxed space-y-2">
              <p>3D mode keeps object properties separate from the classic 2D canvas.</p>
              <p>Use left panel controls for color, material, fit and decal behavior.</p>
            </div>
          ) : selectedObject ? (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded capitalize">
                {getObjectMeta(selectedObject).layerName ?? selectedObject.type}
              </div>

              {(selectedObject.type === "i-text" || selectedObject.type === "text") && (
                <div className="space-y-2">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide block">
                    {language === "no" ? "Tekst" : "Text"}
                  </label>
                  <Input
                    value={(selectedObject as fabric.IText).text ?? ""}
                    onChange={e => { (selectedObject as fabric.IText).set("text", e.target.value); fabricRef.current?.renderAll(); }}
                    className="h-8 text-xs"
                  />
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-muted-foreground w-10">
                      {language === "no" ? "Str." : "Size"}
                    </label>
                    <Input
                      type="number"
                      value={(selectedObject as fabric.IText).fontSize ?? 32}
                      onChange={e => { (selectedObject as fabric.IText).set("fontSize", parseInt(e.target.value) || 32); fabricRef.current?.renderAll(); }}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide block">
                  {language === "no" ? "Farge" : "Fill"}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={typeof selectedObject.fill === "string" ? selectedObject.fill : "#000000"}
                    onChange={e => { selectedObject.set("fill", e.target.value); setFillColor(e.target.value); fabricRef.current?.renderAll(); }}
                    className="w-8 h-8 rounded border border-border bg-transparent cursor-pointer"
                  />
                  <span className="text-xs font-mono text-muted-foreground">
                    {typeof selectedObject.fill === "string" ? selectedObject.fill : "–"}
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide block">
                  {language === "no" ? `Gjennomsiktighet — ${Math.round((selectedObject.opacity ?? 1) * 100)}%` : `Opacity — ${Math.round((selectedObject.opacity ?? 1) * 100)}%`}
                </label>
                <input
                  type="range" min="0" max="1" step="0.01"
                  value={selectedObject.opacity ?? 1}
                  onChange={e => { selectedObject.set("opacity", parseFloat(e.target.value)); fabricRef.current?.renderAll(); setSelectedObject({ ...selectedObject } as fabric.Object); }}
                  className="w-full"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide block">
                  {language === "no" ? "Posisjon" : "Position"}
                </label>
                <div className="grid grid-cols-2 gap-1">
                  {["left", "top"].map(axis => (
                    <div key={axis}>
                      <span className="text-[9px] text-muted-foreground">{axis === "left" ? "X" : "Y"}</span>
                      <Input
                        type="number"
                        value={Math.round(axis === "left" ? (selectedObject.left ?? 0) : (selectedObject.top ?? 0))}
                        onChange={e => { selectedObject.set(axis as "left" | "top", parseInt(e.target.value) || 0); fabricRef.current?.renderAll(); }}
                        className="h-7 text-xs mt-0.5"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <Button variant="destructive" size="sm" className="w-full mt-2 h-8 text-xs" onClick={deleteSelected}>
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                {t("common.delete")}
              </Button>
              <div className="grid grid-cols-2 gap-1">
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={duplicateSelected}>
                  <Copy className="w-3.5 h-3.5 mr-1" /> Duplicate
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={toggleObjectLock}>
                  {selectedObject.lockMovementX ? <Unlock className="w-3.5 h-3.5 mr-1" /> : <Lock className="w-3.5 h-3.5 mr-1" />}
                  {selectedObject.lockMovementX ? "Unlock" : "Lock"}
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => moveLayer("up")}>
                  <MoveUp className="w-3.5 h-3.5 mr-1" /> Up
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => moveLayer("down")}>
                  <MoveDown className="w-3.5 h-3.5 mr-1" /> Down
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={groupSelection}>
                  <Group className="w-3.5 h-3.5 mr-1" /> Group
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={ungroupSelection}>
                  <Ungroup className="w-3.5 h-3.5 mr-1" /> Ungroup
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground text-center py-8 leading-relaxed">
              {language === "no" ? "Velg et objekt for å redigere egenskaper" : "Select an object to edit its properties"}
            </div>
          )}
        </aside>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="w-[90vw] max-w-5xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-0">
            <DialogTitle>Preview on Avatar</DialogTitle>
          </DialogHeader>
          <AvatarPreview
            textureUrl={avatarTextureUrl}
            avatarType={avatarProfile.avatarType}
            bodyType={avatarProfile.bodyType}
            view={previewFacing}
            onViewChange={setPreviewFacing}
            itemType={activeClassicType}
            dimension={dimension}
            garmentColor={garmentColor}
            garmentMaterial={garmentMaterial}
            garmentScale={garmentScale}
            className="border-0 rounded-none"
          />
        </DialogContent>
      </Dialog>

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Buy Roblox Upload Credit</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>You need 1 credit (10 NOK) to upload to Roblox.</p>
            <p className="text-muted-foreground">Current credits: <strong>{credits}</strong></p>
            <Button className="w-full" onClick={handleBuyCredit} disabled={isBuyingCredit}>
              {isBuyingCredit ? "Opening Stripe..." : "Buy 1 Credit (10 NOK)"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
