import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "wouter";
import * as fabric from "fabric";
import { 
  useGetProject, 
  useUpdateProject, 
  useSaveCanvas, 
  useCreateExport,
  useGenerateAiDesign,
  useGenerateColorPalette
} from "@workspace/api-client-react";
import { useLanguage } from "@/hooks/use-language";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Save, Download, ArrowLeft, Image as ImageIcon, Type, Square, Circle, Sparkles, Layers, PenTool, MousePointer2 } from "lucide-react";

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  
  const [activeTab, setActiveTab] = useState("tools");
  const [selectedObject, setSelectedObject] = useState<fabric.Object | null>(null);
  
  const { data: project, isLoading } = useGetProject(id);
  const saveCanvas = useSaveCanvas();
  const createExport = useCreateExport();
  const generateAi = useGenerateAiDesign();

  const [aiPrompt, setAiPrompt] = useState("");

  // Initialize Canvas
  useEffect(() => {
    if (!canvasRef.current || !project) return;
    
    const width = project.type === "shirt" ? 1024 : 585;
    const height = project.type === "shirt" ? 512 : 559;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width,
      height,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true
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

    canvas.on('selection:created', (e) => setSelectedObject(e.selected?.[0] || null));
    canvas.on('selection:updated', (e) => setSelectedObject(e.selected?.[0] || null));
    canvas.on('selection:cleared', () => setSelectedObject(null));

    return () => {
      canvas.dispose();
      fabricRef.current = null;
    };
  }, [project?.id]); // Re-init if project ID changes, but wait for project data

  const handleSave = async () => {
    if (!fabricRef.current) return;
    
    const json = JSON.stringify(fabricRef.current.toJSON());
    const dataUrl = fabricRef.current.toDataURL({ format: 'png', quality: 0.5, multiplier: 0.5 });
    
    saveCanvas.mutate(
      { data: { canvasData: json, thumbnailUrl: dataUrl } },
      {
        onSuccess: () => {
          toast({ title: t("common.success"), description: "Project saved successfully." });
        },
        onError: () => {
          toast({ title: t("common.error"), description: "Failed to save project.", variant: "destructive" });
        }
      }
    );
  };

  const handleExport = () => {
    if (!fabricRef.current) return;
    
    createExport.mutate(
      { data: { projectId: id, format: "png" } },
      {
        onSuccess: (res) => {
          toast({ title: t("common.success"), description: "Export triggered successfully." });
          // In a real app we might poll for the result, for now we just show success
        },
        onError: () => {
          toast({ title: t("common.error"), description: "Export failed.", variant: "destructive" });
        }
      }
    );
  };

  const addText = () => {
    if (!fabricRef.current) return;
    const text = new fabric.IText("Hello Roblox", {
      left: 100,
      top: 100,
      fontFamily: "Inter",
      fill: "#000000",
      fontSize: 40
    });
    fabricRef.current.add(text);
    fabricRef.current.setActiveObject(text);
  };

  const addRect = () => {
    if (!fabricRef.current) return;
    const rect = new fabric.Rect({
      left: 100,
      top: 100,
      fill: "#3b82f6",
      width: 100,
      height: 100
    });
    fabricRef.current.add(rect);
    fabricRef.current.setActiveObject(rect);
  };

  const handleAiGenerate = () => {
    if (!aiPrompt || !project) return;
    generateAi.mutate(
      { data: { prompt: aiPrompt, type: project.type } },
      {
        onSuccess: (res) => {
          toast({ title: t("common.success"), description: "AI generated texture!" });
          // Normally we'd load the result URL into the canvas
          if (res.result && fabricRef.current) {
            fabric.FabricImage.fromURL(res.result).then((img) => {
              img.scaleToWidth(200);
              fabricRef.current?.add(img);
              fabricRef.current?.centerObject(img);
              fabricRef.current?.setActiveObject(img);
            });
          }
        },
        onError: () => {
          toast({ title: t("common.error"), description: "Failed to generate AI texture.", variant: "destructive" });
        }
      }
    );
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen bg-background text-foreground">{t("common.loading")}</div>;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
      {/* Topbar */}
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon"><ArrowLeft className="w-4 h-4" /></Button>
          </Link>
          <div className="font-semibold">{project?.title}</div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleSave} disabled={saveCanvas.isPending}>
            <Save className="w-4 h-4 mr-2" />
            {saveCanvas.isPending ? "Saving..." : t("editor.save")}
          </Button>
          <Button size="sm" onClick={handleExport} disabled={createExport.isPending}>
            <Download className="w-4 h-4 mr-2" />
            {t("editor.export")}
          </Button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-64 border-r border-border bg-card flex flex-col">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
            <TabsList className="w-full justify-start rounded-none border-b border-border h-12 bg-transparent p-0">
              <TabsTrigger value="tools" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">{t("editor.tools")}</TabsTrigger>
              <TabsTrigger value="ai" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary">AI</TabsTrigger>
            </TabsList>
            
            <div className="flex-1 overflow-y-auto p-4">
              <TabsContent value="tools" className="m-0 space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="flex-col h-20 gap-2" onClick={addText}>
                    <Type className="w-6 h-6" /> Text
                  </Button>
                  <Button variant="outline" className="flex-col h-20 gap-2" onClick={addRect}>
                    <Square className="w-6 h-6" /> Shape
                  </Button>
                  <Button variant="outline" className="flex-col h-20 gap-2">
                    <ImageIcon className="w-6 h-6" /> Image
                  </Button>
                  <Button variant="outline" className="flex-col h-20 gap-2">
                    <PenTool className="w-6 h-6" /> Draw
                  </Button>
                </div>
              </TabsContent>
              
              <TabsContent value="ai" className="m-0 space-y-4">
                <div className="p-4 bg-primary/10 rounded-xl border border-primary/20 text-sm mb-4">
                  <Sparkles className="w-5 h-5 text-primary mb-2" />
                  Describe a texture, pattern, or full outfit design and let AI generate it for you.
                </div>
                <div className="space-y-2">
                  <Textarea 
                    placeholder={t("ai.prompt")} 
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    className="resize-none h-32 bg-background"
                  />
                  <Button 
                    className="w-full" 
                    onClick={handleAiGenerate}
                    disabled={!aiPrompt || generateAi.isPending}
                  >
                    {generateAi.isPending ? "Generating..." : t("ai.generate")}
                  </Button>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </aside>

        {/* Canvas Area */}
        <main className="flex-1 bg-muted/30 relative flex items-center justify-center overflow-auto p-8">
          <div className="shadow-2xl bg-white relative">
            <canvas ref={canvasRef} />
            {/* Optional Overlay for Roblox Template */}
            <div className="absolute inset-0 pointer-events-none border border-black/10" style={{ 
              backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%, #ccc)',
              backgroundSize: '20px 20px',
              backgroundPosition: '0 0, 10px 10px',
              opacity: 0.05
            }} />
          </div>
        </main>

        {/* Right Sidebar */}
        <aside className="w-64 border-l border-border bg-card p-4 overflow-y-auto">
          <h3 className="font-semibold mb-4">{t("editor.properties")}</h3>
          {selectedObject ? (
            <div className="space-y-4">
              {/* Basic properties placeholder */}
              <div className="space-y-2 text-sm">
                <label className="text-muted-foreground">Type</label>
                <div className="font-medium capitalize">{selectedObject.type}</div>
              </div>
              
              {selectedObject.type === 'i-text' && (
                <div className="space-y-2">
                  <label className="text-xs text-muted-foreground">Text Content</label>
                  <Input 
                    value={(selectedObject as fabric.IText).text} 
                    onChange={(e) => {
                      (selectedObject as fabric.IText).set('text', e.target.value);
                      fabricRef.current?.renderAll();
                    }}
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Opacity</label>
                <Input 
                  type="number" 
                  min="0" max="1" step="0.1"
                  value={selectedObject.opacity} 
                  onChange={(e) => {
                    selectedObject.set('opacity', parseFloat(e.target.value));
                    fabricRef.current?.renderAll();
                  }}
                />
              </div>

              <Button 
                variant="destructive" 
                size="sm" 
                className="w-full mt-4"
                onClick={() => {
                  fabricRef.current?.remove(selectedObject);
                  setSelectedObject(null);
                }}
              >
                {t("common.delete")}
              </Button>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-8">
              Select an object to edit its properties
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
