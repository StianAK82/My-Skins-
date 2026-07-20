import { useCallback, useEffect, useRef, useState } from "react";
import { aiGenerateDesign } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Upload, Loader2 } from "lucide-react";
import { AvatarPreview } from "@/components/editor/AvatarPreview";
import { useDesignStore } from "@/lib/editor/design-state";
import { classicTextureAiSchema, parseClassicTextureAiPlan } from "@/lib/editor/ai-schema";
import { preloadOverlayImages, renderDesignToCanvas } from "@/lib/editor/renderer";
import { buildAiAvatarLook } from "@/lib/editor/avatar-look";
import { normalizeAiResponse } from "@/lib/ai/normalize-ai-response";
import { resolveAvatarSlotAssets } from "@/lib/ai/asset-resolver";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function mapAiModuleToLayer(module: {
  id: string;
  type: string;
  label: string;
  color: string;
  position: { x: number; y: number };
  scale: number;
  rotation: number;
  opacity: number;
}) {
  const boundedX = clamp(module.position.x, 0, 1);
  const boundedY = clamp(module.position.y, 0, 1);
  const isPattern = module.type.toLowerCase().includes("pattern");
  const isAccessory = module.type.toLowerCase().includes("accessory") || module.type.toLowerCase().includes("hair");
  const isTrim = module.type.toLowerCase().includes("trim");
  const zone = boundedX < 0.18 ? "left_sleeve" : boundedX > 0.82 ? "right_sleeve" : boundedY > 0.72 ? "back" : "front";
  const halfWidth = 64;
  const halfHeight = 64;
  const layerType: "accessoryLayer" | "moduleLayer" = isAccessory ? "accessoryLayer" : "moduleLayer";
  return {
    name: module.label,
    type: layerType,
    zone,
    placementIntent: isPattern ? "allover" : boundedY < 0.3 ? "hero" : "supporting",
    anchor: boundedY < 0.25 ? "top" : boundedY > 0.75 ? "bottom" : "center",
    relativeScale: clamp(module.scale, 0.2, isPattern ? 0.95 : 1.25),
    color: module.color,
    assetId: module.id,
    assetCategory: isPattern ? "pattern" : isAccessory ? "accessory" : isTrim ? "trim" : "module",
    transform: {
      x: clamp((boundedX - 0.5) * halfWidth * 2, -halfWidth, halfWidth),
      y: clamp((boundedY - 0.5) * halfHeight * 2, -halfHeight, halfHeight),
      scale: clamp(module.scale, 0.2, 1.6),
      rotation: clamp(module.rotation, -180, 180),
      opacity: clamp(module.opacity, 0.2, 1),
    },
  };
}

function downloadPng(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

const STEPS = [
  { title: "1. Beskriv skinnet", text: "Skriv hva du vil ha i feltet under figuren – hva som helst. AI-en lager designet." },
  { title: "2. Se det på figuren", text: "Skinnet dukker opp direkte på 3D-figuren. Dra for å rotere og se det fra alle sider." },
  { title: "3. Last opp til Roblox", text: "Trykk på knappen. Du får en PNG-fil, og Roblox sin opplastingsside åpnes – velg filen der, så er skinnet ditt." },
];

export default function Create() {
  const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [previewTexture, setPreviewTexture] = useState<string>("");
  const [prompt, setPrompt] = useState("");
  const [aiError, setAiError] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>("");
  const [imageRenderNonce, setImageRenderNonce] = useState(0);

  const { state, setAiPlanPreview, setAiAvatarPreview, deleteLayer, applyAiPlan, setPaintSwatch } = useDesignStore();
  const hasDesign = state.layers.length > 0 || Boolean(state.baseColor);

  const handleOverlayImageReady = useCallback(() => {
    setImageRenderNonce((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!offscreenCanvasRef.current) offscreenCanvasRef.current = document.createElement("canvas");
    const offscreen = offscreenCanvasRef.current;
    const idHandle = window.setTimeout(() => {
      setPreviewTexture(renderDesignToCanvas(state, offscreen, { onOverlayImageReady: handleOverlayImageReady }));
    }, 20);
    return () => window.clearTimeout(idHandle);
  }, [handleOverlayImageReady, imageRenderNonce, state]);

  const generate = async () => {
    if (aiLoading || !prompt.trim()) return;
    setAiLoading(true);
    setAiError("");
    setUploadStatus("");
    try {
      const response = normalizeAiResponse(await aiGenerateDesign({ prompt, itemType: "classic_shirt", style: "AI velger", theme: prompt }));
      const previewAvatar = buildAiAvatarLook(
        [response.result.style, ...response.result.intent.styleVibes].join(" "),
        response.result.colorPalette,
      );
      const resolvedSlots = resolveAvatarSlotAssets(response.result);
      for (const slotPlan of resolvedSlots) {
        previewAvatar.slots = {
          ...previewAvatar.slots,
          [slotPlan.slot]: {
            assetId: slotPlan.assetId,
            scale: 1,
            visible: true,
            color: slotPlan.color,
            offset: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
          },
        };
      }
      const payload = {
        model: "ClassicTextureAI.v3",
        garmentType: "shirt",
        style: response.result.style,
        palette: response.result.colorPalette,
        zones: response.result.placement,
        avatarLook: previewAvatar,
        layers: response.result.modules.map((module) => mapAiModuleToLayer(module)),
      };
      const parsed = classicTextureAiSchema.parse(payload);
      const plan = parseClassicTextureAiPlan(parsed);
      const currentLayers = useDesignStore.getState().state.layers;
      for (const layer of currentLayers) deleteLayer(layer.id);
      setAiPlanPreview(plan.layers);
      setAiAvatarPreview(plan.avatarLook ?? null);
      applyAiPlan();
      if (parsed.palette[0]) setPaintSwatch(parsed.palette[0]);
    } catch (error) {
      const status = (error as { status?: number })?.status;
      if (status === 401 || status === 429) {
        setAiError("AI-en er opptatt eller grensen er nådd. Prøv igjen om litt.");
      } else {
        setAiError("Noe gikk galt med AI-en. Prøv igjen, gjerne med en litt annen beskrivelse.");
      }
    } finally {
      setAiLoading(false);
    }
  };

  const uploadToRoblox = async () => {
    if (!offscreenCanvasRef.current) offscreenCanvasRef.current = document.createElement("canvas");
    const canvas = offscreenCanvasRef.current;
    if (!canvas || !hasDesign) return;
    await preloadOverlayImages(state);
    const texture = renderDesignToCanvas(state, canvas, { onOverlayImageReady: handleOverlayImageReady, target: "export" });
    downloadPng(texture, "roblox-skin.png");
    window.open("https://create.roblox.com/dashboard/creations", "_blank", "noopener");
    setUploadStatus("Skinnet er lastet ned som roblox-skin.png. Roblox sin side er åpnet – velg «Clothing» der og last opp filen.");
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-8 flex flex-col items-center gap-8">
        <header className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">My Skins</h1>
          <p className="text-slate-400">Skriv hva du vil ha – AI-en lager skinnet på Roblox-figuren.</p>
        </header>

        <section className="grid gap-3 sm:grid-cols-3 w-full">
          {STEPS.map((step) => (
            <div key={step.title} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <h2 className="text-sm font-semibold mb-1">{step.title}</h2>
              <p className="text-xs text-slate-400 leading-relaxed">{step.text}</p>
            </div>
          ))}
        </section>

        <section className="w-full">
          <div className="h-[520px] rounded-2xl border border-slate-800 overflow-hidden">
            <AvatarPreview
              textureUrl={previewTexture}
              previewMode="avatar"
              itemType="shirt"
              avatarState={state.avatar}
              studioMode
              animated
            />
          </div>
        </section>

        <section className="w-full space-y-3">
          <form
            className="flex flex-col sm:flex-row gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void generate();
            }}
          >
            <Input
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="F.eks. «svart drage-hettegenser med røde flammer»"
              className="h-12 bg-slate-900 border-slate-700 text-base"
              disabled={aiLoading}
            />
            <Button type="submit" size="lg" className="h-12 px-6" disabled={aiLoading || !prompt.trim()}>
              {aiLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
              {aiLoading ? "Lager skin…" : "Lag skin"}
            </Button>
          </form>
          {aiError ? <p className="text-sm text-red-400">{aiError}</p> : null}

          <div className="flex flex-col items-center gap-2 pt-2">
            <Button size="lg" className="h-14 px-10 text-lg font-semibold" onClick={() => void uploadToRoblox()} disabled={!hasDesign}>
              <Upload className="mr-2 h-5 w-5" />
              Last opp til Roblox
            </Button>
            {uploadStatus ? <p className="text-sm text-emerald-400 text-center max-w-lg">{uploadStatus}</p> : null}
            {!hasDesign ? <p className="text-xs text-slate-500">Lag et skin med AI først, så kan du laste det opp.</p> : null}
          </div>
        </section>
      </div>
    </div>
  );
}
