import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, Copy, Download, Layers, Lock, MoveDown, MoveUp, Sparkles, Trash2, Unlock, Wand2 } from "lucide-react";
import { aiGenerateDesign } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AvatarPreview } from "@/components/editor/AvatarPreview";
import { classicTextureAiSchema, parseClassicTextureAi } from "@/lib/editor/ai-schema";
import { useDesignStore, type ToolType } from "@/lib/editor/design-state";
import { renderDesignToCanvas } from "@/lib/editor/renderer";
import { parseDesignState, serializeDesignState } from "@/lib/editor/persistence";
import { getAssetsForTemplate, makeLayerFromAsset, type AssetCategory } from "@/lib/editor/assets";
import { TEMPLATE_SIZE, getZonesForTemplate } from "@/lib/editor/templates";

const TOOLS: Array<{ key: ToolType; label: string }> = [
  { key: "templates", label: "Templates" },
  { key: "media", label: "Modules" },
  { key: "accessories", label: "Accessories" },
  { key: "text", label: "Text" },
  { key: "draw", label: "Draw" },
  { key: "aiMedia", label: "AI Studio" },
  { key: "uploads", label: "Uploads" },
];

const SWATCHES = ["#ef4444", "#3b82f6", "#f59e0b", "#10b981", "#a855f7", "#f8fafc", "#111827"];
const STYLE_PRESETS = ["Streetwear", "Esports", "Tactical", "Fantasy", "Minimal", "Anime"];

function downloadPng(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export default function Editor() {
  const { id = "local" } = useParams<{ id?: string }>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [previewTexture, setPreviewTexture] = useState<string>("");
  const [drawActiveLayer, setDrawActiveLayer] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState("clean competitive jersey with side trims");
  const [aiStyle, setAiStyle] = useState("Streetwear");
  const [aiError, setAiError] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);

  const {
    state,
    setTool,
    setTemplate,
    setZone,
    addLayer,
    patchLayer,
    deleteLayer,
    duplicateLayer,
    reorderLayer,
    selectLayer,
    setPreviewMode,
    setBodyType,
    setView,
    setPaintSwatch,
    addBrushPoint,
    setAiPlanPreview,
    applyAiPlan,
    loadSnapshot,
  } = useDesignStore();

  const selectedLayer = state.layers.find((layer) => layer.id === state.selectedLayerId) ?? null;
  const zones = useMemo(() => getZonesForTemplate(state.template), [state.template]);
  const templateAssets = useMemo(() => getAssetsForTemplate(state.template), [state.template]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const idHandle = window.setTimeout(() => {
      setPreviewTexture(renderDesignToCanvas(state, canvas));
    }, 20);
    return () => window.clearTimeout(idHandle);
  }, [state]);

  const onPointerDraw = (event: PointerEvent<HTMLCanvasElement>) => {
    if (state.activeTool !== "draw") return;
    if (!drawActiveLayer) return;
    const layer = state.layers.find((candidate) => candidate.id === drawActiveLayer);
    if (!layer || layer.transform.locked) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * TEMPLATE_SIZE.width;
    const y = ((event.clientY - rect.top) / rect.height) * TEMPLATE_SIZE.height;
    addBrushPoint(drawActiveLayer, { x, y, size: 8, opacity: 0.6, softness: 0.6, erase: event.shiftKey });
  };

  const saveDesign = () => localStorage.setItem(`design:${id}`, serializeDesignState(state));

  const loadDesign = () => {
    const raw = localStorage.getItem(`design:${id}`);
    if (!raw) return;
    loadSnapshot(parseDesignState(raw));
  };

  const generateAiPlan = async () => {
    setAiLoading(true);
    setAiError("");
    try {
      const itemType = state.template === "shirt" ? "classic_shirt" : "classic_pants";
      const response = await aiGenerateDesign({ prompt: aiPrompt, itemType, style: aiStyle, theme: aiStyle });
      const payload = {
        model: "ClassicTextureAI.v2",
        garmentType: state.template,
        style: response.result.style,
        palette: response.result.colorPalette,
        zones: response.result.placement,
        layers: response.result.modules.map((module) => ({
          name: module.label,
          type: "moduleLayer" as const,
          zone: state.template === "shirt"
            ? module.position.x > 0.68 ? "back" : module.position.x < 0.2 ? "left_sleeve" : "front"
            : module.position.x > 0.5 ? "right_leg_front" : "left_leg_front",
          color: module.color,
          assetId: module.id,
          assetCategory: module.type,
          transform: {
            x: (module.position.x - 0.5) * 72,
            y: (module.position.y - 0.5) * 72,
            scale: module.scale,
            rotation: module.rotation,
            opacity: module.opacity,
          },
        })),
      };
      const parsed = classicTextureAiSchema.parse(payload);
      setAiPlanPreview(parseClassicTextureAi(parsed));
      if (parsed.palette[0]) setPaintSwatch(parsed.palette[0]);
    } catch (error) {
      setAiPlanPreview([]);
      setAiError(error instanceof Error ? error.message : "AI output rejected by schema");
    } finally {
      setAiLoading(false);
    }
  };

  const insertAsset = (assetId: string) => {
    const asset = templateAssets.find((entry) => entry.id === assetId);
    if (!asset) return;
    addLayer(makeLayerFromAsset(asset, state.activeZone));
  };

  const activeCategory = (state.activeTool === "accessories" ? "accessory" : state.activeTool === "media" ? "module" : "pattern") as AssetCategory;

  return (
    <div className="h-screen bg-slate-950 text-slate-100 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild><Link href="/projects"><ArrowLeft className="mr-2 h-4 w-4" />Projects</Link></Button>
          <h1 className="text-lg font-semibold">My Skins Studio — Project {id}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={saveDesign}>Save</Button>
          <Button variant="secondary" onClick={loadDesign}>Load</Button>
          <Button onClick={() => previewTexture && downloadPng(previewTexture, `${state.template}.png`)}><Download className="mr-2 h-4 w-4" />Export PNG</Button>
        </div>
      </div>

      <div className="grid grid-cols-[260px_1fr_340px] gap-4 h-[calc(100vh-88px)]">
        <aside className="rounded-xl border border-slate-800 bg-slate-900 p-3 overflow-auto">
          <h2 className="font-medium mb-2">Studio Tools</h2>
          <div className="grid grid-cols-2 gap-2">
            {TOOLS.map((tool) => (
              <Button key={tool.key} variant={state.activeTool === tool.key ? "default" : "outline"} className="justify-start text-xs" onClick={() => setTool(tool.key)}>{tool.label}</Button>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-xs uppercase text-slate-400">Start from Template</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant={state.template === "shirt" ? "default" : "outline"} onClick={() => setTemplate("shirt")}>Classic Shirt</Button>
              <Button variant={state.template === "pants" ? "default" : "outline"} onClick={() => setTemplate("pants")}>Classic Pants</Button>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-xs uppercase text-slate-400">Styles</p>
            <div className="grid grid-cols-2 gap-1">
              {STYLE_PRESETS.map((style) => (
                <Button key={style} variant={aiStyle === style ? "default" : "outline"} size="sm" onClick={() => setAiStyle(style)}>{style}</Button>
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-xs uppercase text-slate-400">Colors</p>
            <div className="grid grid-cols-4 gap-2">
              {SWATCHES.map((swatch) => (
                <button key={swatch} className="h-8 rounded border border-slate-700" style={{ backgroundColor: swatch }} onClick={() => setPaintSwatch(swatch)} />
              ))}
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-xs uppercase text-slate-400">Manual Build</p>
            <Button className="w-full" onClick={() => addLayer({ name: "Base Paint", type: "paintLayerSet", zone: state.activeZone, color: state.paintSwatch })}>+ Fill Zone</Button>
            <Button className="w-full" onClick={() => addLayer({ name: "Label Text", type: "textLayer", zone: state.activeZone, text: "MY SKINS", color: state.paintSwatch, fontSize: 30, transform: { x: 220, y: 210 } })}>+ Add Text</Button>
            <Button className="w-full" onClick={() => {
              addLayer({ name: "Brush Layer", type: "brushLayer", zone: state.activeZone, color: state.paintSwatch, points: [] });
              const latest = useDesignStore.getState().state.layers.at(-1);
              setDrawActiveLayer(latest?.id ?? null);
            }}>+ Brush Layer</Button>
          </div>

          <div className="mt-4 space-y-2">
            <p className="text-xs uppercase text-slate-400">Asset Library</p>
            <div className="space-y-1 max-h-64 overflow-auto">
              {templateAssets.filter((asset) => activeCategory === "pattern" ? asset.category !== "hair" : asset.category === activeCategory || (activeCategory === "module" && asset.category === "graphic")).map((asset) => (
                <Button key={asset.id} variant="outline" className="w-full justify-start" onClick={() => insertAsset(asset.id)}>{asset.name}</Button>
              ))}
            </div>
          </div>
        </aside>

        <main className="rounded-xl border border-slate-800 bg-slate-900 p-3 grid grid-rows-[1fr_auto] gap-3">
          <div className={`grid gap-3 ${state.preview.mode === "split" ? "grid-cols-2" : "grid-cols-1"}`}>
            {(state.preview.mode === "2d" || state.preview.mode === "split") && (
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-2 relative">
                <canvas
                  ref={canvasRef}
                  width={TEMPLATE_SIZE.width}
                  height={TEMPLATE_SIZE.height}
                  className="w-full h-full object-contain"
                  onPointerDown={onPointerDraw}
                  onPointerMove={(e) => e.buttons === 1 && onPointerDraw(e)}
                />
                <div className="absolute inset-2">
                  {zones.map((zone) => (
                    <button
                      key={zone.key}
                      onClick={() => setZone(zone.key)}
                      className={`absolute border ${state.activeZone === zone.key ? "border-cyan-400 bg-cyan-400/20" : "border-slate-500/40 bg-transparent hover:bg-slate-500/10"}`}
                      style={{ left: `${(zone.left / TEMPLATE_SIZE.width) * 100}%`, top: `${(zone.top / TEMPLATE_SIZE.height) * 100}%`, width: `${(zone.width / TEMPLATE_SIZE.width) * 100}%`, height: `${(zone.height / TEMPLATE_SIZE.height) * 100}%` }}
                      title={zone.label}
                    />
                  ))}
                </div>
              </div>
            )}
            {(state.preview.mode === "3d" || state.preview.mode === "split") && (
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-2">
                <AvatarPreview textureUrl={previewTexture} view={state.preview.view} bodyType={state.preview.bodyType === "girl" ? "slim" : state.preview.bodyType === "boy" ? "athletic" : "classic"} itemType={state.template} studioMode />
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <div className="flex gap-2 items-center mb-2">
              <Sparkles className="h-4 w-4" />
              <p className="text-sm font-medium">AI Suggestion Cards</p>
              <Button size="sm" variant="secondary" onClick={() => void generateAiPlan()} disabled={aiLoading || !aiPrompt.trim()}>{aiLoading ? "Generating..." : "Generate"}</Button>
              <Button size="sm" onClick={applyAiPlan} disabled={state.aiPlanPreview.length === 0}><Wand2 className="h-3 w-3 mr-1" />Apply to Design</Button>
            </div>
            <Input value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} placeholder="Describe your Roblox clothing design..." />
            {aiError ? <p className="text-xs text-red-400 mt-2">{aiError}</p> : null}
            {state.aiPlanPreview.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 mt-2">
                {state.aiPlanPreview.map((layer) => (
                  <div key={layer.id} className="rounded border border-slate-700 p-2 text-xs">
                    <p className="font-medium">{layer.name}</p>
                    <p className="text-slate-400">{layer.type} · {layer.zone}</p>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-slate-400 mt-2">Generate structured output and review cards before applying.</p>}
          </div>
        </main>

        <aside className="rounded-xl border border-slate-800 bg-slate-900 p-3 overflow-auto">
          <h2 className="font-medium mb-2 flex items-center gap-2"><Layers className="h-4 w-4" />Layers</h2>
          <div className="space-y-2">
            {state.layers.map((layer) => (
              <div key={layer.id} className={`rounded border p-2 ${state.selectedLayerId === layer.id ? "border-cyan-400" : "border-slate-700"}`}>
                <button className="w-full text-left text-sm font-medium" onClick={() => { selectLayer(layer.id); setZone(layer.zone); }}>{layer.name}</button>
                <p className="text-xs text-slate-400">{layer.type} · {layer.zone}</p>
                <div className="flex gap-1 mt-2">
                  <Button size="icon" variant="ghost" onClick={() => reorderLayer(layer.id, "up")}><MoveUp className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => reorderLayer(layer.id, "down")}><MoveDown className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => duplicateLayer(layer.id)}><Copy className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => patchLayer(layer.id, { transform: { ...layer.transform, locked: !layer.transform.locked } })}>{layer.transform.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}</Button>
                  <Button size="icon" variant="ghost" onClick={() => deleteLayer(layer.id)}><Trash2 className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
          </div>

          <h2 className="font-medium mt-4 mb-2">Properties</h2>
          {selectedLayer ? (
            <div className="space-y-2 text-xs">
              <Input value={selectedLayer.name} onChange={(event) => patchLayer(selectedLayer.id, { name: event.target.value })} />
              <label>Opacity</label>
              <Input type="number" value={selectedLayer.transform.opacity} min={0} max={1} step={0.1} onChange={(event) => patchLayer(selectedLayer.id, { transform: { ...selectedLayer.transform, opacity: Number(event.target.value) } })} />
              <label>Scale</label>
              <Input type="number" value={selectedLayer.transform.scale} min={0.1} max={4} step={0.1} onChange={(event) => patchLayer(selectedLayer.id, { transform: { ...selectedLayer.transform, scale: Number(event.target.value) } })} />
              <label>Rotate</label>
              <Input type="number" value={selectedLayer.transform.rotation} min={-360} max={360} step={5} onChange={(event) => patchLayer(selectedLayer.id, { transform: { ...selectedLayer.transform, rotation: Number(event.target.value) } })} />
            </div>
          ) : <p className="text-sm text-slate-400">Select a layer to edit.</p>}

          <div className="mt-4 space-y-2">
            <p className="text-xs uppercase text-slate-400">Preview Studio</p>
            <div className="grid grid-cols-3 gap-2">
              <Button variant={state.preview.mode === "2d" ? "default" : "outline"} onClick={() => setPreviewMode("2d")}>2D</Button>
              <Button variant={state.preview.mode === "3d" ? "default" : "outline"} onClick={() => setPreviewMode("3d")}>3D</Button>
              <Button variant={state.preview.mode === "split" ? "default" : "outline"} onClick={() => setPreviewMode("split")}>Split</Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" onClick={() => setBodyType("blocky")}>Blocky</Button>
              <Button variant="outline" onClick={() => setBodyType("boy")}>Boy</Button>
              <Button variant="outline" onClick={() => setBodyType("girl")}>Girl</Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => setView("front")}>Front</Button>
              <Button variant="outline" onClick={() => setView("back")}>Back</Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
