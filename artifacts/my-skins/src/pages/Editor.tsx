import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, Link } from "wouter";
import * as fabric from "fabric";
import { type AiGeneratedOutfit, useGetProject, useSaveCanvas, useCreateExport } from "@workspace/api-client-react";
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
  PenTool, Trash2, ZoomIn, ZoomOut, Layers, Sparkles, ChevronDown, X
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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

  const [activeTab, setActiveTab] = useState("tools");
  const [selectedObject, setSelectedObject] = useState<fabric.Object | null>(null);
  const [drawingMode, setDrawingMode] = useState(false);
  const [fillColor, setFillColor] = useState("#3b82f6");
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(8);
  const [aiConcept, setAiConcept] = useState<AiConcept | null>(null);
  const [showConcept, setShowConcept] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [avatarTextureUrl, setAvatarTextureUrl] = useState("");

  const { data: project, isLoading } = useGetProject(id);
  const saveCanvas = useSaveCanvas();
  const createExport = useCreateExport();

  // These must be declared BEFORE the canvas useEffect that depends on them
  const handleUseColors = useCallback((colors: string[]) => {
    if (colors[0]) setFillColor(colors[0]);
    if (colors[1]) setStrokeColor(colors[1]);
    toast({ title: language === "no" ? "Farger brukt!" : "Colors applied!" });
  }, [toast, language]);

  const addTemplateGuideLayer = useCallback(() => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    const type = (project?.type as "shirt" | "pants") ?? "shirt";
    const zones = TEMPLATE_ZONES[type];

    canvas.getObjects().forEach((obj) => {
      if ((obj.data as { role?: string } | undefined)?.role === "template-guide") {
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
  }, [project?.type]);

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

    return () => { canvas.dispose(); fabricRef.current = null; };
  }, [addTemplateGuideLayer, project?.id]);

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

  const handleSave = async () => {
    if (!fabricRef.current) return;
    const canvasJSON = fabricRef.current.toJSON();
    if (aiConcept) (canvasJSON as Record<string, unknown>).__aiConcept = aiConcept;
    const json = JSON.stringify(canvasJSON);
    const dataUrl = fabricRef.current.toDataURL({ format: "png", quality: 0.5, multiplier: 0.5 });

    saveCanvas.mutate(
      { data: { canvasData: json, thumbnailUrl: dataUrl } },
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

  const deleteSelected = () => {
    if (!fabricRef.current) return;
    fabricRef.current.getActiveObjects().forEach(obj => fabricRef.current?.remove(obj));
    fabricRef.current.discardActiveObject();
    fabricRef.current.renderAll();
    setSelectedObject(null);
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

  const addImageToZone = useCallback(async (source: string, zone: TemplateZone, layerName: string) => {
    if (!fabricRef.current) return;
    if (!source.startsWith("data:image/png;base64,") && !source.startsWith("data:image/svg+xml")) {
      throw new Error(`Invalid image format for ${layerName}`);
    }
    const image = await fabric.FabricImage.fromURL(source);
    image.set({
      left: zone.left,
      top: zone.top,
      selectable: true,
      evented: true,
      data: { role: "ai-generated", zone: zone.label, layerName },
    });
    image.scaleToWidth(zone.width);
    if ((image.getScaledHeight() ?? 0) > zone.height) {
      image.scaleToHeight(zone.height);
    }
    fabricRef.current.add(image);
  }, []);

  const addFallbackShapeToZone = useCallback((zone: TemplateZone, color: string, layerName: string) => {
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
  }, []);

  const applyAiOutfitToCanvas = useCallback(async (result: AiGeneratedOutfit) => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    const type = (project?.type as "shirt" | "pants") ?? "shirt";
    const zones = TEMPLATE_ZONES[type];
    const assets = result.assets;

    setDrawingMode(false);
    try {
      canvas.backgroundColor = result.plan.baseColor;

      canvas.getObjects().forEach((obj) => {
        if ((obj.data as { role?: string } | undefined)?.role === "template-guide") {
          canvas.remove(obj);
        }
      });

      const attempts: Array<{ src?: string; zone: TemplateZone; name: string }> = [
        { src: assets?.frontImage, zone: zones.front, name: "AI Front" },
        { src: assets?.backImage, zone: zones.back, name: "AI Back" },
        { src: assets?.leftRegionImage, zone: zones.leftRegion, name: "AI Left Region" },
        { src: assets?.rightRegionImage, zone: zones.rightRegion, name: "AI Right Region" },
      ];

      let applied = 0;
      for (const attempt of attempts) {
        if (!attempt.src) {
          console.error("canvas.apply.missing-asset", { layer: attempt.name });
          addFallbackShapeToZone(attempt.zone, result.plan.colorPalette[1] ?? "#ffffff", attempt.name);
          continue;
        }
        try {
          await addImageToZone(attempt.src, attempt.zone, attempt.name);
          applied += 1;
        } catch (error) {
          console.error("canvas.apply.asset-failure", { layer: attempt.name, error });
          addFallbackShapeToZone(attempt.zone, result.plan.colorPalette[2] ?? "#111111", attempt.name);
        }
      }

      canvas.renderAll();
      handleUseColors(result.plan.colorPalette);
      addTemplateGuideLayer();
      toast({
        title: language === "no" ? "AI design lagt til!" : "AI design applied to canvas!",
        description: applied === 4
          ? undefined
          : (language === "no" ? "Noen regioner brukte fallback-lag." : "Some regions used fallback layers."),
      });
    } catch (error) {
      console.error("canvas.apply.failure", error);
      toast({ title: language === "no" ? "Kunne ikke bruke AI-design" : "Failed to apply AI design", variant: "destructive" });
      addTemplateGuideLayer();
    }
  }, [addFallbackShapeToZone, addImageToZone, addTemplateGuideLayer, handleUseColors, language, project?.type, toast]);

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
      {/* Topbar */}
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 shrink-0 gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div className="font-semibold text-sm truncate max-w-[180px]">{project?.title}</div>
          <div className="flex items-center gap-1">
            <span className="text-xs bg-muted px-2 py-0.5 rounded uppercase text-muted-foreground">{project?.type}</span>
            {project?.isAiGenerated && (
              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded uppercase font-semibold flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5" /> AI
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={zoomOut}><ZoomOut className="w-4 h-4" /></Button>
          <Button variant="ghost" size="icon" onClick={zoomIn}><ZoomIn className="w-4 h-4" /></Button>
          {selectedObject && (
            <Button variant="ghost" size="icon" onClick={deleteSelected}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          )}
          <div className="w-px h-6 bg-border" />
          <Button variant="outline" size="sm" onClick={handleSave} disabled={saveCanvas.isPending}>
            <Save className="w-4 h-4 mr-1.5" />
            {saveCanvas.isPending ? (language === "no" ? "Lagrer..." : "Saving...") : t("editor.save")}
          </Button>
          <Button size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-1.5" />
            {t("editor.export")}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setPreviewOpen(true)} disabled={!avatarTextureUrl}>
            Preview on Avatar
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

      {/* Main workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-64 border-r border-border bg-card flex flex-col overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
            <TabsList className="w-full justify-start rounded-none border-b border-border h-10 bg-transparent p-0 shrink-0">
              <TabsTrigger value="tools" className="flex-1 rounded-none text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary h-full">
                {t("editor.tools")}
              </TabsTrigger>
              <TabsTrigger value="ai" className="flex-1 rounded-none text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary h-full">
                ✨ AI
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto">
              {/* Tools Tab */}
              <TabsContent value="tools" className="m-0 p-3 space-y-4">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wide">
                    {language === "no" ? "Legg til" : "Add Elements"}
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button variant="outline" className="flex-col h-16 gap-1.5 text-xs" onClick={addText}>
                      <Type className="w-5 h-5" /> {language === "no" ? "Tekst" : "Text"}
                    </Button>
                    <Button variant="outline" className="flex-col h-16 gap-1.5 text-xs" onClick={addRect}>
                      <Square className="w-5 h-5" /> {language === "no" ? "Firkant" : "Rectangle"}
                    </Button>
                    <Button variant="outline" className="flex-col h-16 gap-1.5 text-xs" onClick={addCircle}>
                      <Circle className="w-5 h-5" /> {language === "no" ? "Sirkel" : "Circle"}
                    </Button>
                    <Button
                      variant={drawingMode ? "default" : "outline"}
                      className="flex-col h-16 gap-1.5 text-xs"
                      onClick={() => setDrawingMode(p => !p)}
                    >
                      <PenTool className="w-5 h-5" />
                      {drawingMode ? (language === "no" ? "Stopp" : "Stop") : (language === "no" ? "Tegn" : "Draw")}
                    </Button>
                  </div>
                  <label className="mt-1.5 flex flex-col items-center gap-1.5 h-14 border border-dashed border-border rounded-md cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors text-xs text-muted-foreground justify-center">
                    <ImageIcon className="w-4 h-4" />
                    {language === "no" ? "Last opp bilde" : "Upload Image"}
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                </div>

                {/* Colors */}
                <div>
                  <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wide">
                    {language === "no" ? "Farger" : "Colors"}
                  </p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground w-12">
                        {language === "no" ? "Fyll" : "Fill"}
                      </label>
                      <input
                        type="color" value={fillColor}
                        onChange={e => {
                          setFillColor(e.target.value);
                          if (selectedObject) { selectedObject.set("fill", e.target.value); fabricRef.current?.renderAll(); }
                        }}
                        className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent"
                      />
                      <span className="text-xs font-mono text-muted-foreground">{fillColor}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground w-12">
                        {language === "no" ? "Kant" : "Stroke"}
                      </label>
                      <input
                        type="color" value={strokeColor}
                        onChange={e => {
                          setStrokeColor(e.target.value);
                          if (selectedObject) { selectedObject.set("stroke", e.target.value); fabricRef.current?.renderAll(); }
                          if (drawingMode && fabricRef.current?.freeDrawingBrush) fabricRef.current.freeDrawingBrush.color = e.target.value;
                        }}
                        className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent"
                      />
                      <span className="text-xs font-mono text-muted-foreground">{strokeColor}</span>
                    </div>
                    {drawingMode && (
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-muted-foreground w-12">
                          {language === "no" ? "Pensel" : "Brush"}
                        </label>
                        <input
                          type="range" min={1} max={50} value={brushSize}
                          onChange={e => {
                            const s = parseInt(e.target.value);
                            setBrushSize(s);
                            if (fabricRef.current?.freeDrawingBrush) fabricRef.current.freeDrawingBrush.width = s;
                          }}
                          className="flex-1"
                        />
                        <span className="text-xs text-muted-foreground w-10">{brushSize}px</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Canvas background */}
                <div>
                  <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wide">
                    {language === "no" ? "Bakgrunn" : "Background"}
                  </p>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      defaultValue="#ffffff"
                      onChange={e => {
                        if (fabricRef.current) {
                          fabricRef.current.backgroundColor = e.target.value;
                          fabricRef.current.renderAll();
                        }
                      }}
                      className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent"
                    />
                    <span className="text-xs text-muted-foreground">
                      {language === "no" ? "Lerretfarge" : "Canvas color"}
                    </span>
                  </div>
                </div>
              </TabsContent>

              {/* AI Tab */}
              <TabsContent value="ai" className="m-0">
                <AiPanel
                  projectType={(project?.type as "shirt" | "pants") ?? "shirt"}
                  onUseColors={handleUseColors}
                  onApplyAssets={applyAiOutfitToCanvas}
                />
              </TabsContent>
            </div>
          </Tabs>
        </aside>

        {/* Canvas */}
        <main className="flex-1 bg-[#1a1a2e] relative flex items-center justify-center overflow-auto p-8">
          <div className="shadow-2xl relative">
            <canvas ref={canvasRef} />
          </div>
        </main>

        {/* Right Properties */}
        <aside className="w-52 border-l border-border bg-card p-3 overflow-y-auto shrink-0">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4" />
            {t("editor.properties")}
          </h3>

          {selectedObject ? (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded capitalize">{selectedObject.type}</div>

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
                        value={Math.round((selectedObject as Record<string, number>)[axis] ?? 0)}
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
          {avatarTextureUrl ? (
            <AvatarPreview textureUrl={avatarTextureUrl} className="border-0 rounded-none" />
          ) : (
            <div className="h-[420px] flex items-center justify-center text-sm text-muted-foreground">
              Add content on the canvas to preview your design.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
