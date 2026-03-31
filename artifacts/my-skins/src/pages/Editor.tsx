import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, Link } from "wouter";
import * as fabric from "fabric";
import {
  useGetProject,
  useSaveCanvas,
  useCreateExport,
} from "@workspace/api-client-react";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { AiPanel } from "@/components/editor/AiPanel";
import {
  Save,
  Download,
  ArrowLeft,
  Image as ImageIcon,
  Type,
  Square,
  Circle,
  PenTool,
  Trash2,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Layers,
} from "lucide-react";

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);

  const [activeTab, setActiveTab] = useState("tools");
  const [selectedObject, setSelectedObject] = useState<fabric.Object | null>(null);
  const [drawingMode, setDrawingMode] = useState(false);
  const [fillColor, setFillColor] = useState("#3b82f6");
  const [strokeColor, setStrokeColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(8);

  const { data: project, isLoading } = useGetProject(id);
  const saveCanvas = useSaveCanvas();
  const createExport = useCreateExport();

  // Initialize Canvas
  useEffect(() => {
    if (!canvasRef.current || !project) return;

    const width = project.type === "shirt" ? 1024 : 585;
    const height = project.type === "shirt" ? 512 : 559;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width,
      height,
      backgroundColor: "#ffffff",
      preserveObjectStacking: true,
    });

    fabricRef.current = canvas;

    if (project.canvasData) {
      try {
        canvas.loadFromJSON(JSON.parse(project.canvasData)).then(() => {
          canvas.renderAll();
        });
      } catch (e) {
        console.error("Error loading canvas data", e);
      }
    }

    canvas.on("selection:created", (e) => setSelectedObject(e.selected?.[0] || null));
    canvas.on("selection:updated", (e) => setSelectedObject(e.selected?.[0] || null));
    canvas.on("selection:cleared", () => setSelectedObject(null));

    return () => {
      canvas.dispose();
      fabricRef.current = null;
    };
  }, [project?.id]);

  // Drawing mode toggle
  useEffect(() => {
    if (!fabricRef.current) return;
    const canvas = fabricRef.current;
    canvas.isDrawingMode = drawingMode;
    if (drawingMode && canvas.freeDrawingBrush) {
      canvas.freeDrawingBrush.color = strokeColor;
      canvas.freeDrawingBrush.width = brushSize;
    }
  }, [drawingMode, strokeColor, brushSize]);

  const handleSave = async () => {
    if (!fabricRef.current) return;
    const json = JSON.stringify(fabricRef.current.toJSON());
    const dataUrl = fabricRef.current.toDataURL({ format: "png", quality: 0.5, multiplier: 0.5 });

    saveCanvas.mutate(
      { data: { canvasData: json, thumbnailUrl: dataUrl } },
      {
        onSuccess: () => toast({ title: "Saved!", description: "Project saved successfully." }),
        onError: () => toast({ title: "Error", description: "Failed to save project.", variant: "destructive" }),
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

    createExport.mutate(
      { data: { projectId: id, format: "png" } },
      {
        onSuccess: () => toast({ title: "Exported!", description: "PNG downloaded." }),
        onError: () => {},
      }
    );
  };

  const addText = () => {
    if (!fabricRef.current) return;
    setDrawingMode(false);
    const text = new fabric.IText("Edit me", {
      left: 150,
      top: 150,
      fontFamily: "Inter, sans-serif",
      fill: fillColor,
      fontSize: 36,
    });
    fabricRef.current.add(text);
    fabricRef.current.setActiveObject(text);
    fabricRef.current.renderAll();
  };

  const addRect = () => {
    if (!fabricRef.current) return;
    setDrawingMode(false);
    const rect = new fabric.Rect({
      left: 100,
      top: 100,
      fill: fillColor,
      stroke: strokeColor,
      strokeWidth: 2,
      width: 120,
      height: 80,
      rx: 4,
    });
    fabricRef.current.add(rect);
    fabricRef.current.setActiveObject(rect);
    fabricRef.current.renderAll();
  };

  const addCircle = () => {
    if (!fabricRef.current) return;
    setDrawingMode(false);
    const circle = new fabric.Circle({
      left: 120,
      top: 120,
      fill: fillColor,
      stroke: strokeColor,
      strokeWidth: 2,
      radius: 50,
    });
    fabricRef.current.add(circle);
    fabricRef.current.setActiveObject(circle);
    fabricRef.current.renderAll();
  };

  const toggleDraw = () => setDrawingMode(p => !p);

  const deleteSelected = () => {
    if (!fabricRef.current) return;
    const active = fabricRef.current.getActiveObjects();
    active.forEach(obj => fabricRef.current?.remove(obj));
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

  const handleUseColors = useCallback((colors: string[]) => {
    setFillColor(colors[0] ?? "#3b82f6");
    if (colors[1]) setStrokeColor(colors[1]);
    toast({ title: "Colors applied!", description: "Fill and stroke colors updated." });
  }, [toast]);

  const zoomIn = () => {
    if (!fabricRef.current) return;
    const z = fabricRef.current.getZoom();
    fabricRef.current.setZoom(Math.min(z * 1.2, 5));
  };

  const zoomOut = () => {
    if (!fabricRef.current) return;
    const z = fabricRef.current.getZoom();
    fabricRef.current.setZoom(Math.max(z / 1.2, 0.1));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background text-foreground">
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
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div className="font-semibold text-sm truncate max-w-[200px]">{project?.title}</div>
          <span className="text-xs bg-muted px-2 py-0.5 rounded uppercase text-muted-foreground">
            {project?.type}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={zoomOut} title="Zoom out">
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={zoomIn} title="Zoom in">
            <ZoomIn className="w-4 h-4" />
          </Button>
          {selectedObject && (
            <Button variant="ghost" size="icon" onClick={deleteSelected} title="Delete selected">
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          )}
          <div className="w-px h-6 bg-border" />
          <Button variant="outline" size="sm" onClick={handleSave} disabled={saveCanvas.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {saveCanvas.isPending ? "Saving…" : t("editor.save")}
          </Button>
          <Button size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            {t("editor.export")}
          </Button>
        </div>
      </header>

      {/* Main workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-64 border-r border-border bg-card flex flex-col overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
            <TabsList className="w-full justify-start rounded-none border-b border-border h-10 bg-transparent p-0 shrink-0">
              <TabsTrigger
                value="tools"
                className="flex-1 rounded-none text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary h-full"
              >
                {t("editor.tools")}
              </TabsTrigger>
              <TabsTrigger
                value="ai"
                className="flex-1 rounded-none text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary h-full"
              >
                ✨ AI
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto">
              {/* Tools Tab */}
              <TabsContent value="tools" className="m-0 p-3 space-y-4">
                {/* Shape tools */}
                <div>
                  <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wide">Add Elements</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button
                      variant="outline"
                      className="flex-col h-16 gap-1.5 text-xs"
                      onClick={addText}
                    >
                      <Type className="w-5 h-5" />
                      Text
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-col h-16 gap-1.5 text-xs"
                      onClick={addRect}
                    >
                      <Square className="w-5 h-5" />
                      Shape
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-col h-16 gap-1.5 text-xs"
                      onClick={addCircle}
                    >
                      <Circle className="w-5 h-5" />
                      Circle
                    </Button>
                    <Button
                      variant={drawingMode ? "default" : "outline"}
                      className="flex-col h-16 gap-1.5 text-xs"
                      onClick={toggleDraw}
                    >
                      <PenTool className="w-5 h-5" />
                      {drawingMode ? "Stop Draw" : "Draw"}
                    </Button>
                  </div>

                  {/* Image Upload */}
                  <label className="mt-1.5 flex flex-col items-center gap-1.5 h-16 border border-dashed border-border rounded-md cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors text-xs text-muted-foreground justify-center">
                    <ImageIcon className="w-5 h-5" />
                    Upload Image
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                </div>

                {/* Colors */}
                <div>
                  <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wide">Colors</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground w-12">Fill</label>
                      <input
                        type="color"
                        value={fillColor}
                        onChange={e => {
                          setFillColor(e.target.value);
                          if (selectedObject) {
                            selectedObject.set("fill", e.target.value);
                            fabricRef.current?.renderAll();
                          }
                        }}
                        className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent"
                      />
                      <span className="text-xs font-mono text-muted-foreground">{fillColor}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-muted-foreground w-12">Stroke</label>
                      <input
                        type="color"
                        value={strokeColor}
                        onChange={e => {
                          setStrokeColor(e.target.value);
                          if (selectedObject) {
                            selectedObject.set("stroke", e.target.value);
                            fabricRef.current?.renderAll();
                          }
                          if (drawingMode && fabricRef.current?.freeDrawingBrush) {
                            fabricRef.current.freeDrawingBrush.color = e.target.value;
                          }
                        }}
                        className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent"
                      />
                      <span className="text-xs font-mono text-muted-foreground">{strokeColor}</span>
                    </div>
                    {drawingMode && (
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-muted-foreground w-12">Brush</label>
                        <input
                          type="range"
                          min={1}
                          max={50}
                          value={brushSize}
                          onChange={e => {
                            const s = parseInt(e.target.value);
                            setBrushSize(s);
                            if (fabricRef.current?.freeDrawingBrush) {
                              fabricRef.current.freeDrawingBrush.width = s;
                            }
                          }}
                          className="flex-1"
                        />
                        <span className="text-xs text-muted-foreground">{brushSize}px</span>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* AI Tab */}
              <TabsContent value="ai" className="m-0">
                <AiPanel
                  projectType={(project?.type as "shirt" | "pants") ?? "shirt"}
                  onUseColors={handleUseColors}
                />
              </TabsContent>
            </div>
          </Tabs>
        </aside>

        {/* Canvas */}
        <main className="flex-1 bg-[#1a1a2e] relative flex items-center justify-center overflow-auto p-8">
          <div
            className="shadow-2xl relative"
            style={{
              backgroundImage:
                "linear-gradient(45deg,#2a2a3e 25%,transparent 25%,transparent 75%,#2a2a3e 75%,#2a2a3e),linear-gradient(45deg,#2a2a3e 25%,transparent 25%,transparent 75%,#2a2a3e 75%,#2a2a3e)",
              backgroundSize: "20px 20px",
              backgroundPosition: "0 0,10px 10px",
            }}
          >
            <canvas ref={canvasRef} />
          </div>
        </main>

        {/* Right Sidebar – Properties */}
        <aside className="w-56 border-l border-border bg-card p-3 overflow-y-auto shrink-0">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4" />
            {t("editor.properties")}
          </h3>

          {selectedObject ? (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded capitalize">
                {selectedObject.type}
              </div>

              {/* Text editing */}
              {(selectedObject.type === "i-text" || selectedObject.type === "text") && (
                <div className="space-y-2">
                  <label className="text-[10px] text-muted-foreground uppercase tracking-wide block">Text</label>
                  <Input
                    value={(selectedObject as fabric.IText).text ?? ""}
                    onChange={(e) => {
                      (selectedObject as fabric.IText).set("text", e.target.value);
                      fabricRef.current?.renderAll();
                    }}
                    className="h-8 text-xs"
                  />
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-muted-foreground w-10">Size</label>
                    <Input
                      type="number"
                      value={(selectedObject as fabric.IText).fontSize ?? 32}
                      onChange={(e) => {
                        (selectedObject as fabric.IText).set("fontSize", parseInt(e.target.value) || 32);
                        fabricRef.current?.renderAll();
                      }}
                      className="h-8 text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Fill color */}
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide block">Fill</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={typeof selectedObject.fill === "string" ? selectedObject.fill : "#000000"}
                    onChange={(e) => {
                      selectedObject.set("fill", e.target.value);
                      setFillColor(e.target.value);
                      fabricRef.current?.renderAll();
                    }}
                    className="w-8 h-8 rounded border border-border bg-transparent cursor-pointer"
                  />
                  <span className="text-xs font-mono text-muted-foreground">
                    {typeof selectedObject.fill === "string" ? selectedObject.fill : "–"}
                  </span>
                </div>
              </div>

              {/* Opacity */}
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide block">
                  Opacity — {Math.round((selectedObject.opacity ?? 1) * 100)}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={selectedObject.opacity ?? 1}
                  onChange={(e) => {
                    selectedObject.set("opacity", parseFloat(e.target.value));
                    fabricRef.current?.renderAll();
                    setSelectedObject({ ...selectedObject } as fabric.Object);
                  }}
                  className="w-full"
                />
              </div>

              {/* Position */}
              <div className="space-y-1">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide block">Position</label>
                <div className="grid grid-cols-2 gap-1">
                  <div>
                    <span className="text-[9px] text-muted-foreground">X</span>
                    <Input
                      type="number"
                      value={Math.round(selectedObject.left ?? 0)}
                      onChange={(e) => {
                        selectedObject.set("left", parseInt(e.target.value) || 0);
                        fabricRef.current?.renderAll();
                      }}
                      className="h-7 text-xs mt-0.5"
                    />
                  </div>
                  <div>
                    <span className="text-[9px] text-muted-foreground">Y</span>
                    <Input
                      type="number"
                      value={Math.round(selectedObject.top ?? 0)}
                      onChange={(e) => {
                        selectedObject.set("top", parseInt(e.target.value) || 0);
                        fabricRef.current?.renderAll();
                      }}
                      className="h-7 text-xs mt-0.5"
                    />
                  </div>
                </div>
              </div>

              <Button
                variant="destructive"
                size="sm"
                className="w-full mt-2 h-8 text-xs"
                onClick={deleteSelected}
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                {t("common.delete")}
              </Button>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground text-center py-8 leading-relaxed">
              Select an object to edit its properties
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
