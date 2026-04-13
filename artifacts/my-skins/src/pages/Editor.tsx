import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, Copy, Download, Layers, Lock, MoveDown, MoveUp, Sparkles, Trash2, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AvatarPreview } from "@/components/editor/AvatarPreview";
import { parseClassicTextureAi } from "@/lib/editor/ai-schema";
import { useDesignStore, type ToolType } from "@/lib/editor/design-state";
import { renderDesignToCanvas } from "@/lib/editor/renderer";
import { parseDesignState, serializeDesignState } from "@/lib/editor/persistence";
import { TEMPLATE_SIZE, getZonesForTemplate } from "@/lib/editor/templates";

const TOOLS: Array<{ key: ToolType; label: string }> = [
  { key: "templates", label: "Templates" },
  { key: "uploads", label: "Uploads" },
  { key: "media", label: "Media" },
  { key: "aiMedia", label: "AI Media" },
  { key: "accessories", label: "Accessories" },
  { key: "text", label: "Text" },
  { key: "draw", label: "Draw" },
];

const SWATCHES = ["#ef4444", "#3b82f6", "#f59e0b", "#10b981", "#a855f7", "#f8fafc", "#111827"];

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
  const [aiJson, setAiJson] = useState('{"model":"ClassicTextureAI","layers":[{"name":"Front Flame","type":"paintLayerSet","zone":"front","color":"#f97316"}]}');
  const [drawActiveLayer, setDrawActiveLayer] = useState<string | null>(null);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const idHandle = window.setTimeout(() => {
      setPreviewTexture(renderDesignToCanvas(state, canvas));
    }, 40);
    return () => window.clearTimeout(idHandle);
  }, [state]);

  const onPointerDraw = (event: PointerEvent<HTMLCanvasElement>) => {
    if (state.activeTool !== "draw") return;
    if (!drawActiveLayer) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * TEMPLATE_SIZE.width;
    const y = ((event.clientY - rect.top) / rect.height) * TEMPLATE_SIZE.height;
    addBrushPoint(drawActiveLayer, { x, y, size: 8, opacity: 0.6, softness: 0.6, erase: event.shiftKey });
  };

  return (
    <div className="h-screen bg-slate-950 text-slate-100 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild><Link href="/projects"><ArrowLeft className="mr-2 h-4 w-4" />Projects</Link></Button>
          <h1 className="text-lg font-semibold">My Skins Studio — Project {id}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => localStorage.setItem(`design:${id}`, serializeDesignState(state))}>Save</Button>
          <Button variant="secondary" onClick={() => {
            const raw = localStorage.getItem(`design:${id}`);
            if (!raw) return;
            loadSnapshot(parseDesignState(raw));
          }}>Load</Button>
          <Button onClick={() => previewTexture && downloadPng(previewTexture, `${state.template}.png`)}><Download className="mr-2 h-4 w-4" />Export PNG</Button>
        </div>
      </div>

      <div className="grid grid-cols-[220px_1fr_320px] gap-4 h-[calc(100vh-88px)]">
        <aside className="rounded-xl border border-slate-800 bg-slate-900 p-3 overflow-auto">
          <h2 className="font-medium mb-3">Tool Sidebar</h2>
          <div className="space-y-2">
            {TOOLS.map((tool) => (
              <Button key={tool.key} variant={state.activeTool === tool.key ? "default" : "outline"} className="w-full justify-start" onClick={() => setTool(tool.key)}>{tool.label}</Button>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            <p className="text-xs uppercase text-slate-400">Template</p>
            <Button variant={state.template === "shirt" ? "default" : "outline"} className="w-full" onClick={() => setTemplate("shirt")}>Classic Shirt</Button>
            <Button variant={state.template === "pants" ? "default" : "outline"} className="w-full" onClick={() => setTemplate("pants")}>Classic Pants</Button>
          </div>
          <div className="mt-4 space-y-2">
            <p className="text-xs uppercase text-slate-400">Swatches</p>
            <div className="grid grid-cols-4 gap-2">
              {SWATCHES.map((swatch) => (
                <button key={swatch} className="h-8 rounded border border-slate-700" style={{ backgroundColor: swatch }} onClick={() => setPaintSwatch(swatch)} />
              ))}
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <Button className="w-full" onClick={() => addLayer({ name: "Paint Layer", type: "paintLayerSet", zone: state.activeZone, color: state.paintSwatch })}>+ Paint Layer</Button>
            <Button className="w-full" onClick={() => addLayer({ name: "Text Layer", type: "textLayer", zone: state.activeZone, text: "MY SKINS", color: state.paintSwatch, fontSize: 30, transform: { x: 220, y: 210 } })}>+ Text Layer</Button>
            <Button className="w-full" onClick={() => {
              addLayer({ name: "Brush Layer", type: "brushLayer", zone: state.activeZone, color: state.paintSwatch, points: [] });
              const latest = useDesignStore.getState().state.layers.at(-1);
              setDrawActiveLayer(latest?.id ?? null);
            }}>+ Brush Layer</Button>
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
                <div className="absolute inset-2 pointer-events-none">
                  {zones.map((zone) => (
                    <button
                      key={zone.key}
                      className={`absolute border ${state.activeZone === zone.key ? "border-cyan-400 bg-cyan-400/20" : "border-slate-500/50 bg-slate-500/10"}`}
                      style={{ left: `${(zone.left / TEMPLATE_SIZE.width) * 100}%`, top: `${(zone.top / TEMPLATE_SIZE.height) * 100}%`, width: `${(zone.width / TEMPLATE_SIZE.width) * 100}%`, height: `${(zone.height / TEMPLATE_SIZE.height) * 100}%` }}
                    />
                  ))}
                </div>
              </div>
            )}
            {(state.preview.mode === "3d" || state.preview.mode === "split") && (
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-2">
                <AvatarPreview textureUrl={previewTexture} view={state.preview.view} bodyType={state.preview.bodyType === "girl" ? "slim" : state.preview.bodyType === "boy" ? "athletic" : "classic"} itemType={state.template} />
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <div className="flex gap-2 items-center mb-2">
              <Sparkles className="h-4 w-4" />
              <p className="text-sm font-medium">Structured AI</p>
              <Button size="sm" variant="secondary" onClick={() => {
                try { setAiPlanPreview(parseClassicTextureAi(JSON.parse(aiJson))); } catch { setAiPlanPreview([]); }
              }}>Preview Plan</Button>
              <Button size="sm" onClick={applyAiPlan}>Apply Plan</Button>
            </div>
            <textarea value={aiJson} onChange={(event) => setAiJson(event.target.value)} className="w-full h-28 bg-slate-900 border border-slate-700 rounded p-2 text-xs font-mono" />
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
            <div className="space-y-2">
              <Input value={selectedLayer.name} onChange={(event) => patchLayer(selectedLayer.id, { name: event.target.value })} />
              <Input type="number" value={selectedLayer.transform.opacity} min={0} max={1} step={0.1} onChange={(event) => patchLayer(selectedLayer.id, { transform: { ...selectedLayer.transform, opacity: Number(event.target.value) } })} />
            </div>
          ) : <p className="text-sm text-slate-400">Select a layer to edit.</p>}

          <div className="mt-4 space-y-2">
            <p className="text-xs uppercase text-slate-400">3D Preview</p>
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
