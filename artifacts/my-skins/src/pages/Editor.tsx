import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Link, useParams } from "wouter";
import { ArrowLeft, Check, Copy, Download, Eye, Layers, Lock, MoveDown, MoveUp, Palette, Sparkles, ToyBrick, Trash2, Unlock, UserRound, Wand2 } from "lucide-react";
import { aiGenerateDesign } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AvatarPreview } from "@/components/editor/AvatarPreview";
import { classicTextureAiSchema, parseClassicTextureAiPlan } from "@/lib/editor/ai-schema";
import { useDesignStore, type AvatarCosmeticSlot, type ToolType } from "@/lib/editor/design-state";
import { preloadOverlayImages, renderDesignToCanvas } from "@/lib/editor/renderer";
import { parseDesignState, serializeDesignState } from "@/lib/editor/persistence";
import {
  AVATAR_ASSETS,
  getAssetById,
  getAssetsForTemplate,
  getAvatarAssetById,
  getAvatarAssetsForSlot,
  makeLayerFromAsset,
  type AssetBrowserExportFilter,
  type AssetCategory,
  type AvatarAssetCategory,
  type AvatarAsset,
  filterStudioAssets,
  filterAvatarAssets,
  collectAssetTags,
} from "@/lib/editor/assets";
import { buildAiAvatarLook } from "@/lib/editor/avatar-look";
import { normalizeAiResponse } from "@/lib/ai/normalize-ai-response";
import { resolveAvatarSlotAssets } from "@/lib/ai/asset-resolver";
import { TEMPLATE_SIZE, getZonesForTemplate } from "@/lib/editor/templates";
import { getFriendlyEmptyState, getSimpleFlowStep, getVisibleSimplePanels, shouldShowAdvancedControls, type EditorExperienceMode, type SimpleCreationPath } from "@/lib/editor/experience-mode";

const TOOLS: Array<{ key: ToolType; label: string; hint: string }> = [
  { key: "templates", label: "Templates", hint: "Choose your clothing base" },
  { key: "media", label: "Modules", hint: "Insert graphics and trims" },
  { key: "accessories", label: "Accessories", hint: "Add accessory overlays" },
  { key: "text", label: "Text", hint: "Place editable text" },
  { key: "draw", label: "Draw", hint: "Paint directly on canvas" },
  { key: "aiMedia", label: "AI Studio", hint: "Generate guided design cards" },
  { key: "uploads", label: "Uploads", hint: "Use your own image overlays" },
];

const SWATCHES = ["#ef4444", "#3b82f6", "#f59e0b", "#10b981", "#a855f7", "#f8fafc", "#111827"];
const STYLE_PRESETS = ["Streetwear", "Esports", "Tactical", "Fantasy", "Minimal", "Anime"];
const SIMPLE_STYLE_CARDS = ["Cute", "Dark", "Anime", "Dragon", "Cyber", "Sport", "Flame"];
const SIMPLE_AI_HELPERS = ["make it darker", "add wings", "make it cute", "make it more Roblox", "show 3 ideas"];
const AVATAR_SLOTS: AvatarCosmeticSlot[] = ["face", "hair", "hat", "neck", "leftShoulder", "rightShoulder", "back", "leftFootwear", "rightFootwear", "aura"];

const ROLE_OPTIONS = ["all", "graphic", "module", "trim", "face", "hair", "headwear", "neckwear", "armor", "wings", "aura", "footwear", "companion"] as const;

function slotLabel(slot: AvatarCosmeticSlot) {
  return slot.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

function assetStatusLabel(previewOnly?: boolean, exportable?: boolean) {
  if (previewOnly) return "Preview-only";
  if (exportable) return "Exportable";
  return "Mixed";
}

function downloadPng(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

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
}, template: "shirt" | "pants") {
  const boundedX = clamp(module.position.x, 0, 1);
  const boundedY = clamp(module.position.y, 0, 1);
  const isPattern = module.type.toLowerCase().includes("pattern");
  const isAccessory = module.type.toLowerCase().includes("accessory") || module.type.toLowerCase().includes("hair");
  const isTrim = module.type.toLowerCase().includes("trim");
  const zone = template === "shirt"
    ? boundedX < 0.18 ? "left_sleeve" : boundedX > 0.82 ? "right_sleeve" : boundedY > 0.72 ? "back" : "front"
    : boundedX >= 0.5 ? "right_leg_front" : "left_leg_front";
  const halfWidth = template === "shirt" ? 64 : 34;
  const halfHeight = template === "shirt" ? 64 : 96;
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

export default function Editor() {
  const { id = "local" } = useParams<{ id?: string }>();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [previewTexture, setPreviewTexture] = useState<string>("");
  const [drawActiveLayer, setDrawActiveLayer] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState("clean competitive jersey with side trims");
  const [aiStyle, setAiStyle] = useState("Streetwear");
  const [aiError, setAiError] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [imageRenderNonce, setImageRenderNonce] = useState(0);
  const [saveStatus, setSaveStatus] = useState<string>("");
  const [previewFocus, setPreviewFocus] = useState<"clothing" | "avatar">("clothing");
  const [assetSearch, setAssetSearch] = useState("");
  const [avatarAssetSearch, setAvatarAssetSearch] = useState("");
  const [assetCategoryFilter, setAssetCategoryFilter] = useState<AssetCategory | "all">("all");
  const [avatarSlotFilter, setAvatarSlotFilter] = useState<AvatarCosmeticSlot | "all">("all");
  const [avatarCategoryFilter, setAvatarCategoryFilter] = useState<AvatarAssetCategory | "all">("all");
  const [roleFilter, setRoleFilter] = useState<(typeof ROLE_OPTIONS)[number]>("all");
  const [importanceFilter, setImportanceFilter] = useState<"all" | "hero" | "support" | "decorative">("all");
  const [exportFilter, setExportFilter] = useState<AssetBrowserExportFilter>("all");
  const [styleTagFilter, setStyleTagFilter] = useState<string>("all");
  const [vibeTagFilter, setVibeTagFilter] = useState<string>("all");
  const [fantasyTagFilter, setFantasyTagFilter] = useState<string>("all");
  const [experienceMode, setExperienceMode] = useState<EditorExperienceMode>("simple");
  const [simpleCreationPath, setSimpleCreationPath] = useState<SimpleCreationPath>(null);
  const [simpleStyleChoice, setSimpleStyleChoice] = useState<string | null>(null);
  const [editorSurface, setEditorSurface] = useState<"clothes" | "avatar">("clothes");
  const [simpleAdvancedOpen, setSimpleAdvancedOpen] = useState(false);

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
    setAvatarPatch,
    setAvatarSlot,
    setAiPlanPreview,
    setAiAvatarPreview,
    setAiResultSummary,
    applyAiPlan,
    loadSnapshot,
  } = useDesignStore();

  const selectedLayer = state.layers.find((layer) => layer.id === state.selectedLayerId) ?? null;
  const zones = useMemo(() => getZonesForTemplate(state.template), [state.template]);
  const templateAssets = useMemo(() => getAssetsForTemplate(state.template), [state.template]);
  const tagOptions = useMemo(() => collectAssetTags([...templateAssets, ...AVATAR_ASSETS]), [templateAssets]);
  const hasLayers = state.layers.length > 0;
  const storageKey = `design:${id}`;
  const hasSavedVersion = typeof window !== "undefined" && Boolean(localStorage.getItem(storageKey));
  const simpleStep = getSimpleFlowStep({ creationPath: simpleCreationPath, template: state.template, style: simpleStyleChoice, hasDraft: hasLayers });
  const showAdvancedControls = shouldShowAdvancedControls(experienceMode, simpleAdvancedOpen);
  const simplePanels = getVisibleSimplePanels({ step: simpleStep, surface: editorSurface, advancedOpen: simpleAdvancedOpen });
  const friendlyEmptyMessage = getFriendlyEmptyState({
    hasLayers,
    selectedLayerId: state.selectedLayerId,
    hasAiCards: state.aiPlanPreview.length > 0,
    isRobloxConnected: false,
  });

  const handleOverlayImageReady = useCallback(() => {
    setImageRenderNonce((current) => current + 1);
  }, []);

  const handleExportPng = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasLayers) return;
    await preloadOverlayImages(state);
    const nextTexture = renderDesignToCanvas(state, canvas, { onOverlayImageReady: handleOverlayImageReady, target: "export" });
    setPreviewTexture(nextTexture);
    downloadPng(nextTexture, `${state.template}.png`);
    setSaveStatus("Exported PNG from current design state.");
  }, [handleOverlayImageReady, hasLayers, state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const idHandle = window.setTimeout(() => {
      setPreviewTexture(renderDesignToCanvas(state, canvas, { onOverlayImageReady: handleOverlayImageReady }));
    }, 20);
    return () => window.clearTimeout(idHandle);
  }, [handleOverlayImageReady, imageRenderNonce, state]);

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

  const saveDesign = () => {
    localStorage.setItem(storageKey, serializeDesignState(state));
    setSaveStatus("Saved locally. You can reload this from this device.");
  };

  const loadDesign = () => {
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      setSaveStatus("No saved version found yet. Make a change and click Save first.");
      return;
    }
    loadSnapshot(parseDesignState(raw));
    setSaveStatus("Loaded saved design snapshot.");
  };

  const generateAiPlan = async () => {
    setAiLoading(true);
    setAiError("");
    try {
      const itemType = state.template === "shirt" ? "classic_shirt" : "classic_pants";
      const response = normalizeAiResponse(await aiGenerateDesign({ prompt: aiPrompt, itemType, style: aiStyle, theme: aiStyle }));
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
        garmentType: state.template,
        style: response.result.style,
        palette: response.result.colorPalette,
        zones: response.result.placement,
        avatarLook: previewAvatar,
        layers: response.result.modules.map((module) => mapAiModuleToLayer(module, state.template)),
      };
      const parsed = classicTextureAiSchema.parse(payload);
      const plan = parseClassicTextureAiPlan(parsed);
      setAiPlanPreview(plan.layers);
      setAiAvatarPreview(plan.avatarLook ?? null);
      setAiResultSummary({
        exportable: [
          ...(response.result.exportablePlan.classicShirt ? ["Classic shirt texture"] : []),
          ...(response.result.exportablePlan.classicPants ? ["Classic pants texture"] : []),
        ],
        previewOnly: response.result.previewOnlyPlan.cosmetics.map((entry) => `${entry.role} ${entry.slot}: ${entry.label}`),
        appliedTargets: [
          "Applied to shirt/pants layers",
          ...resolvedSlots.map((slot) => `Resolved ${slot.role} ${slot.slot} -> ${slot.assetId}`),
          ...(response.result.intent.includesAvatarLook ? ["Applied to avatar look preview"] : []),
        ],
      });
      if (parsed.palette[0]) setPaintSwatch(parsed.palette[0]);
    } catch (error) {
      setAiPlanPreview([]);
      setAiAvatarPreview(null);
      setAiResultSummary(null);
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

  const assignAvatarSlotAsset = (slot: AvatarCosmeticSlot, asset: AvatarAsset) => {
    setAvatarSlot(slot, {
      assetId: asset.id,
      color: asset.color,
      scale: asset.defaultScale ?? 1,
      offset: asset.defaultOffset ?? { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      visible: true,
    });
  };

  const replaceSelectedLayerAsset = (assetId: string) => {
    if (!selectedLayer) return;
    const asset = templateAssets.find((entry) => entry.id === assetId);
    if (!asset) return;
    patchLayer(selectedLayer.id, {
      name: asset.name,
      assetId: asset.id,
      assetCategory: asset.category,
      image: asset.overlayImage,
      color: asset.defaultColor,
      type: asset.category === "accessory" || asset.category === "hair" ? "accessoryLayer" : "moduleLayer",
      zone: selectedLayer.zone,
    });
  };

  const activeCategory = (state.activeTool === "accessories" ? "accessory" : state.activeTool === "media" ? "module" : "pattern") as AssetCategory;
  const libraryAssets = useMemo(() => filterStudioAssets(templateAssets, {
    category: assetCategoryFilter === "all" ? (activeCategory === "pattern" ? "all" : activeCategory) : assetCategoryFilter,
    zone: state.activeZone,
    role: roleFilter,
    importance: importanceFilter,
    exportFilter,
    styleTag: styleTagFilter,
    vibeTag: vibeTagFilter,
    fantasyTag: fantasyTagFilter,
    search: assetSearch,
  }), [activeCategory, assetCategoryFilter, assetSearch, exportFilter, fantasyTagFilter, importanceFilter, roleFilter, state.activeZone, styleTagFilter, templateAssets, vibeTagFilter]);
  const filteredAvatarAssets = useMemo(() => filterAvatarAssets(AVATAR_ASSETS, {
    slot: avatarSlotFilter,
    category: avatarCategoryFilter,
    role: roleFilter,
    importance: importanceFilter,
    exportFilter,
    styleTag: styleTagFilter,
    vibeTag: vibeTagFilter,
    fantasyTag: fantasyTagFilter,
    search: avatarAssetSearch,
  }), [avatarAssetSearch, avatarCategoryFilter, avatarSlotFilter, exportFilter, fantasyTagFilter, importanceFilter, roleFilter, styleTagFilter, vibeTagFilter]);
  const layeredRoleSummary = useMemo(() => state.layers.reduce((acc, layer) => {
    const role = getAssetById(layer.assetId)?.importance ?? "decorative";
    acc[role] += 1;
    return acc;
  }, { hero: 0, support: 0, decorative: 0 }), [state.layers]);
  const activeToolMeta = TOOLS.find((tool) => tool.key === state.activeTool);

  return (
    <div className="h-screen bg-slate-950 text-slate-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild><Link href="/projects"><ArrowLeft className="mr-2 h-4 w-4" />Projects</Link></Button>
          <h1 className="text-lg font-semibold">My Skins Studio — Project {id}</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-1 flex gap-1">
            <Button size="sm" variant={experienceMode === "simple" ? "default" : "ghost"} className="h-9 px-4" onClick={() => setExperienceMode("simple")}>Simple Mode</Button>
            <Button size="sm" variant={experienceMode === "studio" ? "default" : "ghost"} className="h-9 px-4" onClick={() => setExperienceMode("studio")}>Studio Mode</Button>
          </div>
          <Button variant="secondary" onClick={saveDesign}>Save</Button>
          <Button variant="secondary" onClick={loadDesign}>Load</Button>
          <Button onClick={() => void handleExportPng()} disabled={!hasLayers}><Download className="mr-2 h-4 w-4" />Export PNG</Button>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-xs text-slate-300 flex items-center justify-between gap-3">
        <p>{experienceMode === "simple" ? `Simple flow: ${simpleStep === 1 ? "Choose how to create" : simpleStep === 2 ? "Pick shirt or pants" : simpleStep === 3 ? "Pick your style" : "Create and refine"}.` : "Studio flow: Template → Build with assets/AI/tools → Check preview → Save → Export."}</p>
        <p className="text-slate-400">{saveStatus || (hasSavedVersion ? "Saved version available for quick reload." : "No saved version yet for this project.")}</p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <Button
          variant={editorSurface === "clothes" ? "default" : "outline"}
          className="h-12 justify-start text-base"
          onClick={() => setEditorSurface("clothes")}
        >
          <Palette className="mr-2 h-5 w-5" /> Clothes
        </Button>
        <Button
          variant={editorSurface === "avatar" ? "default" : "outline"}
          className="h-12 justify-start text-base"
          onClick={() => setEditorSurface("avatar")}
        >
          <UserRound className="mr-2 h-5 w-5" /> Avatar
        </Button>
      </div>

      <div className="grid grid-cols-[280px_1fr_360px] gap-4 h-[calc(100vh-132px)]">
        <aside className="rounded-xl border border-slate-800 bg-slate-900 p-3 overflow-auto">
          {experienceMode === "simple" ? (
            <div className="space-y-3">
              <h2 className="font-semibold text-base">Guided Creator</h2>
              <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-3">
                <p className="text-xs uppercase text-slate-400 mb-2">Step 1 · Choose how to create</p>
                <div className="grid grid-cols-1 gap-2">
                  {[
                    { id: "ai" as const, label: "AI", icon: Sparkles },
                    { id: "build" as const, label: "Build myself", icon: ToyBrick },
                    { id: "remix" as const, label: "Remix", icon: Copy },
                  ].map((path) => (
                    <Button key={path.id} variant={simpleCreationPath === path.id ? "default" : "outline"} className="h-12 justify-start text-sm" onClick={() => setSimpleCreationPath(path.id)}>
                      <path.icon className="mr-2 h-4 w-4" />{path.label}
                      {simpleCreationPath === path.id ? <Check className="ml-auto h-4 w-4" /> : null}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-3">
                <p className="text-xs uppercase text-slate-400 mb-2">Step 2 · Choose what to make</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant={state.template === "shirt" ? "default" : "outline"} className="h-12" onClick={() => setTemplate("shirt")}>👕 Shirt</Button>
                  <Button variant={state.template === "pants" ? "default" : "outline"} className="h-12" onClick={() => setTemplate("pants")}>👖 Pants</Button>
                </div>
              </div>
              <div className="rounded-lg border border-slate-700 bg-slate-950/60 p-3">
                <p className="text-xs uppercase text-slate-400 mb-2">Step 3 · Choose style</p>
                <div className="grid grid-cols-2 gap-2">
                  {SIMPLE_STYLE_CARDS.map((style) => (
                    <Button
                      key={style}
                      variant={simpleStyleChoice === style ? "default" : "outline"}
                      className="h-11 justify-start"
                      onClick={() => {
                        setSimpleStyleChoice(style);
                        setAiStyle(style);
                        setAiPrompt(`${style.toLowerCase()} ${state.template} design for Roblox`);
                      }}
                    >
                      {style}
                    </Button>
                  ))}
                </div>
              </div>
              <Button variant="secondary" className="w-full h-11" onClick={() => setSimpleAdvancedOpen((current) => !current)}>
                {simpleAdvancedOpen ? "Hide More Tools" : "More Tools"}
              </Button>
              <Button className="w-full h-11" onClick={() => setExperienceMode("studio")}>Open Studio</Button>
            </div>
          ) : (
            <>
              <h2 className="font-medium mb-2">Studio Tools</h2>
              <div className="grid grid-cols-2 gap-2">
                {TOOLS.map((tool) => (
                  <Button key={tool.key} variant={state.activeTool === tool.key ? "default" : "outline"} className="justify-start text-xs" onClick={() => setTool(tool.key)}>{tool.label}</Button>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-2">{activeToolMeta?.hint}</p>
            </>
          )}

          {(experienceMode === "studio" || showAdvancedControls) ? <div className="mt-4 space-y-2">
            <p className="text-xs uppercase text-slate-400">1) Start from Template</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant={state.template === "shirt" ? "default" : "outline"} onClick={() => setTemplate("shirt")}>Classic Shirt</Button>
              <Button variant={state.template === "pants" ? "default" : "outline"} onClick={() => setTemplate("pants")}>Classic Pants</Button>
            </div>
          </div> : null}

          {(experienceMode === "studio" || showAdvancedControls) ? <div className="mt-4 space-y-2">
            <p className="text-xs uppercase text-slate-400">2) Style Direction</p>
            <div className="grid grid-cols-2 gap-1">
              {STYLE_PRESETS.map((style) => (
                <Button key={style} variant={aiStyle === style ? "default" : "outline"} size="sm" onClick={() => setAiStyle(style)}>{style}</Button>
              ))}
            </div>
          </div> : null}

          {(experienceMode === "studio" || showAdvancedControls || simplePanels.showBuilder) ? <div className="mt-4 space-y-2">
            <p className="text-xs uppercase text-slate-400">Quick Colors</p>
            <div className="grid grid-cols-4 gap-2">
              {SWATCHES.map((swatch) => (
                <button key={swatch} className="h-8 rounded border border-slate-700" style={{ backgroundColor: swatch }} onClick={() => setPaintSwatch(swatch)} aria-label={`Set swatch ${swatch}`} />
              ))}
            </div>
          </div> : null}

          {(experienceMode === "studio" || showAdvancedControls || simplePanels.showBuilder) ? <div className="mt-4 space-y-2">
            <p className="text-xs uppercase text-slate-400">Manual Build</p>
            <Button className="w-full" onClick={() => addLayer({ name: "Base Fill", type: "paintLayerSet", zone: state.activeZone, color: state.paintSwatch })}>+ Fill Active Zone</Button>
            <Button className="w-full" onClick={() => addLayer({ name: "Text Label", type: "textLayer", zone: state.activeZone, text: "MY SKINS", color: state.paintSwatch, fontSize: 30, transform: { x: 220, y: 210 } })}>+ Add Text</Button>
            <Button className="w-full" onClick={() => {
              addLayer({ name: "Brush Strokes", type: "brushLayer", zone: state.activeZone, color: state.paintSwatch, points: [] });
              const latest = useDesignStore.getState().state.layers.at(-1);
              setDrawActiveLayer(latest?.id ?? null);
            }}>+ Brush Layer</Button>
          </div> : null}

          {(experienceMode === "studio" || showAdvancedControls || (simplePanels.showBuilder && editorSurface === "clothes")) ? <div className="mt-4 space-y-2">
            <p className="text-xs uppercase text-slate-400">3) Asset Library</p>
            <Input value={assetSearch} onChange={(event) => setAssetSearch(event.target.value)} placeholder="Search clothing asset..." />
            <div className="grid grid-cols-2 gap-2 text-xs">
              <select className="rounded border border-slate-700 bg-slate-950 px-2 py-1" value={assetCategoryFilter} onChange={(event) => setAssetCategoryFilter(event.target.value as AssetCategory | "all")}>
                <option value="all">All categories</option>
                <option value="pattern">Pattern</option>
                <option value="graphic">Graphic</option>
                <option value="trim">Trim</option>
                <option value="patch">Patch</option>
                <option value="accessory">Accessory</option>
                <option value="module">Module</option>
              </select>
              <select className="rounded border border-slate-700 bg-slate-950 px-2 py-1" value={exportFilter} onChange={(event) => setExportFilter(event.target.value as AssetBrowserExportFilter)}>
                <option value="all">All availability</option>
                <option value="exportable">Exportable only</option>
                <option value="previewOnly">Preview-only only</option>
              </select>
              <select className="rounded border border-slate-700 bg-slate-950 px-2 py-1" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as (typeof ROLE_OPTIONS)[number])}>
                <option value="all">Any role</option>
                {ROLE_OPTIONS.filter((role) => role !== "all").map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
              <select className="rounded border border-slate-700 bg-slate-950 px-2 py-1" value={importanceFilter} onChange={(event) => setImportanceFilter(event.target.value as "all" | "hero" | "support" | "decorative")}>
                <option value="all">Any weight</option>
                <option value="hero">Hero</option>
                <option value="support">Support</option>
                <option value="decorative">Decorative</option>
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <select className="rounded border border-slate-700 bg-slate-950 px-2 py-1" value={styleTagFilter} onChange={(event) => setStyleTagFilter(event.target.value)}>
                <option value="all">Style tag</option>
                {tagOptions.styleTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
              </select>
              <select className="rounded border border-slate-700 bg-slate-950 px-2 py-1" value={vibeTagFilter} onChange={(event) => setVibeTagFilter(event.target.value)}>
                <option value="all">Vibe tag</option>
                {tagOptions.vibeTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
              </select>
              <select className="rounded border border-slate-700 bg-slate-950 px-2 py-1" value={fantasyTagFilter} onChange={(event) => setFantasyTagFilter(event.target.value)}>
                <option value="all">Fantasy tag</option>
                {tagOptions.fantasyTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
              </select>
            </div>
            {libraryAssets.length > 0 ? (
              <div className="space-y-1 max-h-64 overflow-auto">
                {libraryAssets.map((asset) => (
                  <Button key={asset.id} variant="outline" className="w-full justify-between" onClick={() => insertAsset(asset.id)}>
                    <span>{asset.name}</span>
                    <span className="text-[10px] text-slate-400">{asset.importance ?? "support"} · {assetStatusLabel(asset.previewOnly, asset.exportable)}</span>
                  </Button>
                ))}
              </div>
            ) : <p className="text-xs text-slate-400 rounded border border-dashed border-slate-700 p-2">No assets for this tool/template combo yet. Switch template or tool type.</p>}
          </div> : null}
        </aside>

        <main className="rounded-xl border border-slate-800 bg-slate-900 p-3 grid grid-rows-[1fr_auto] gap-3">
          <div className={`grid gap-3 ${state.preview.mode === "split" ? "grid-cols-2" : "grid-cols-1"}`}>
            {(state.preview.mode === "2d" || state.preview.mode === "split") && (
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-2 relative">
                {!hasLayers ? <div className="absolute inset-3 z-10 rounded border border-dashed border-slate-700 bg-slate-900/80 p-3 text-sm text-slate-200">{friendlyEmptyMessage}</div> : null}
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
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-2 relative">
                <AvatarPreview textureUrl={previewTexture} view={state.preview.view} previewMode={previewFocus} bodyType={state.preview.bodyType === "girl" ? "slim" : state.preview.bodyType === "boy" ? "athletic" : "classic"} itemType={state.template} avatarState={state.avatar} studioMode />
                <div className="absolute top-3 left-3 rounded bg-slate-900/70 border border-slate-700 px-2 py-1 text-[11px] text-slate-300 flex items-center gap-1"><Eye className="h-3 w-3" />Drag to orbit, buttons to zoom/rotate.</div>
              </div>
            )}
          </div>

          {(experienceMode === "studio" || simplePanels.showAi) ? <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
            <div className="flex gap-2 items-center mb-2">
              <Sparkles className="h-4 w-4" />
              <p className="text-sm font-medium">AI Suggestion Cards</p>
              <Button size="sm" variant="secondary" onClick={() => void generateAiPlan()} disabled={aiLoading || !aiPrompt.trim()}>{aiLoading ? "Generating..." : "Generate"}</Button>
              <Button size="sm" onClick={applyAiPlan} disabled={state.aiPlanPreview.length === 0}><Wand2 className="h-3 w-3 mr-1" />Apply to Design</Button>
              <p className="text-[11px] text-slate-400">{state.aiPlanPreview.length > 0 ? `Reviewing ${state.aiPlanPreview.length} card(s) and avatar look before apply.` : "Generate cards, review placement, then apply."}</p>
            </div>
            <Input value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} placeholder="Describe your Roblox clothing design..." />
            {experienceMode === "simple" ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {SIMPLE_AI_HELPERS.map((chip) => (
                  <Button key={chip} size="sm" variant="outline" className="h-9 rounded-full" onClick={() => setAiPrompt((current) => `${current}${current ? ", " : ""}${chip}`)}>
                    {chip}
                  </Button>
                ))}
              </div>
            ) : null}
            {aiError ? <p className="text-xs text-red-400 mt-2">{aiError}</p> : null}
            {state.aiPlanPreview.length > 0 ? (
              <div className="space-y-2 mt-2">
                <div className="grid grid-cols-2 gap-2">
                  {state.aiPlanPreview.map((layer) => (
                    <div key={layer.id} className="rounded border border-slate-700 p-2 text-xs">
                      <p className="font-medium">{layer.name}</p>
                      <p className="text-slate-400">{layer.type} · {layer.zone}</p>
                    </div>
                  ))}
                </div>
                {state.aiResultSummary ? (
                  <div className="rounded border border-slate-700/70 bg-slate-900/60 p-2 text-[11px] space-y-1">
                    <p className="font-semibold text-slate-200">AI result breakdown</p>
                    <p className="text-slate-400">Exportable clothing: {state.aiResultSummary.exportable.join(", ") || "none"}</p>
                    <p className="text-slate-400">Avatar preview cosmetics: {state.aiResultSummary.previewOnly.join(", ") || "none"}</p>
                    <p className="text-slate-400">Applied targets: {state.aiResultSummary.appliedTargets.join(", ")}</p>
                  </div>
                ) : null}
                <div className="rounded border border-slate-700/70 bg-slate-900/60 p-2 text-[11px] space-y-2">
                  <p className="font-semibold text-slate-200">Refine after apply</p>
                  <p className="text-slate-400">Layer mix: {layeredRoleSummary.hero} hero · {layeredRoleSummary.support} support · {layeredRoleSummary.decorative} decorative</p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" variant="outline" onClick={() => {
                      const heroLayer = [...state.layers].reverse().find((layer) => getAssetById(layer.assetId)?.importance === "hero");
                      if (heroLayer) selectLayer(heroLayer.id);
                    }}>Select latest hero</Button>
                    <Button size="sm" variant="outline" onClick={() => {
                      const decorativeLayer = [...state.layers].reverse().find((layer) => (getAssetById(layer.assetId)?.importance ?? "decorative") === "decorative");
                      if (decorativeLayer) deleteLayer(decorativeLayer.id);
                    }}>Remove last decorative</Button>
                  </div>
                </div>
              </div>
            ) : <p className="text-xs text-slate-400 mt-2">No AI cards yet. Generate first, review cards, then apply.</p>}
          </div> : null}
        </main>

        <aside className="rounded-xl border border-slate-800 bg-slate-900 p-3 overflow-auto">
          {editorSurface === "clothes" ? (
            <>
          <h2 className="font-medium mb-2 flex items-center gap-2"><Layers className="h-4 w-4" />Clothes Layers</h2>
          {(experienceMode === "studio" || simplePanels.showLayerStack) && hasLayers ? (
            <div className="space-y-2">
              {state.layers.map((layer, index) => (
                <div key={layer.id} className={`rounded border p-2 ${state.selectedLayerId === layer.id ? "border-cyan-400 bg-cyan-500/10 shadow-[0_0_0_1px_rgba(34,211,238,0.3)]" : "border-slate-700"}`}>
                  {(() => {
                    const meta = getAssetById(layer.assetId);
                    return <p className="text-[10px] text-slate-400 mb-1">{meta?.importance ?? "decorative"} · {assetStatusLabel(meta?.previewOnly, meta?.exportable)}</p>;
                  })()}
                  <button className="w-full text-left text-sm font-medium" onClick={() => { selectLayer(layer.id); setZone(layer.zone); }}>{layer.name}</button>
                  <p className="text-xs text-slate-400">{layer.type} · {layer.zone}{layer.transform.locked ? " · locked" : ""}</p>
                  <div className="flex gap-1 mt-2">
                    <Button size="icon" variant="ghost" onClick={() => reorderLayer(layer.id, "up")} disabled={index === state.layers.length - 1}><MoveUp className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => reorderLayer(layer.id, "down")} disabled={index === 0}><MoveDown className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => duplicateLayer(layer.id)}><Copy className="h-3 w-3" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => patchLayer(layer.id, { transform: { ...layer.transform, locked: !layer.transform.locked } })}>{layer.transform.locked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}</Button>
                    <Button size="icon" variant="ghost" onClick={() => deleteLayer(layer.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-slate-400 rounded border border-dashed border-slate-700 p-3">{friendlyEmptyMessage || "No layers added yet. Add one from Manual Build or Asset Library to unlock editing and export."}</p>}

          {(experienceMode === "studio" || simplePanels.showLayerStack) ? <h2 className="font-medium mt-4 mb-2">Properties</h2> : null}
          {selectedLayer ? (
            <div className="space-y-2 text-xs">
              <p className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-300">
                Target: {selectedLayer.zone} · {selectedLayer.type} · {assetStatusLabel(getAssetById(selectedLayer.assetId)?.previewOnly, getAssetById(selectedLayer.assetId)?.exportable)}
              </p>
              <label className="text-slate-400">Layer Name</label>
              <Input value={selectedLayer.name} onChange={(event) => patchLayer(selectedLayer.id, { name: event.target.value })} />
              {selectedLayer.assetId ? (
                <>
                  <label className="text-slate-400">Replace with clothing asset</label>
                  <select className="rounded border border-slate-700 bg-slate-950 px-2 py-1" onChange={(event) => event.target.value && replaceSelectedLayerAsset(event.target.value)} value="">
                    <option value="">Choose replacement...</option>
                    {templateAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name}</option>)}
                  </select>
                  <Button size="sm" variant="outline" onClick={() => deleteLayer(selectedLayer.id)}>Remove selected layer</Button>
                </>
              ) : null}
              <label className="text-slate-400">Opacity (0-1)</label>
              <Input type="number" value={selectedLayer.transform.opacity} min={0} max={1} step={0.1} onChange={(event) => patchLayer(selectedLayer.id, { transform: { ...selectedLayer.transform, opacity: clamp(Number(event.target.value), 0, 1) } })} />
              <label className="text-slate-400">Scale</label>
              <Input type="number" value={selectedLayer.transform.scale} min={0.1} max={4} step={0.1} onChange={(event) => patchLayer(selectedLayer.id, { transform: { ...selectedLayer.transform, scale: clamp(Number(event.target.value), 0.1, 4) } })} />
              <label className="text-slate-400">Rotation</label>
              <Input type="number" value={selectedLayer.transform.rotation} min={-360} max={360} step={5} onChange={(event) => patchLayer(selectedLayer.id, { transform: { ...selectedLayer.transform, rotation: clamp(Number(event.target.value), -360, 360) } })} />
            </div>
          ) : (experienceMode === "studio" || simplePanels.showLayerStack) ? <p className="text-sm text-slate-400 rounded border border-dashed border-slate-700 p-2">No layer selected. Click a layer card to edit transform and appearance.</p> : null}
            </>
          ) : (
            <div className="rounded border border-dashed border-slate-700 p-3 text-sm text-slate-300">
              Avatar editing is open. Pick avatar slots below to style face, hair, aura, and accessories.
            </div>
          )}

          <div className="mt-4 space-y-2">
            <p className="text-xs uppercase text-slate-400">Preview Studio</p>
            <div className="grid grid-cols-3 gap-2">
              <Button variant={state.preview.mode === "2d" ? "default" : "outline"} onClick={() => setPreviewMode("2d")}>2D</Button>
              <Button variant={state.preview.mode === "3d" ? "default" : "outline"} onClick={() => setPreviewMode("3d")}>3D</Button>
              <Button variant={state.preview.mode === "split" ? "default" : "outline"} onClick={() => setPreviewMode("split")}>Split</Button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Button variant={state.preview.bodyType === "blocky" ? "default" : "outline"} onClick={() => setBodyType("blocky")}>Blocky</Button>
              <Button variant={state.preview.bodyType === "boy" ? "default" : "outline"} onClick={() => setBodyType("boy")}>Boy</Button>
              <Button variant={state.preview.bodyType === "girl" ? "default" : "outline"} onClick={() => setBodyType("girl")}>Girl</Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant={state.preview.view === "front" ? "default" : "outline"} onClick={() => setView("front")}>Front</Button>
              <Button variant={state.preview.view === "back" ? "default" : "outline"} onClick={() => setView("back")}>Back</Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant={previewFocus === "clothing" ? "default" : "outline"} onClick={() => setPreviewFocus("clothing")}>Clothing Focus</Button>
              <Button variant={previewFocus === "avatar" ? "default" : "outline"} onClick={() => setPreviewFocus("avatar")}>Avatar Focus</Button>
            </div>
            <div className="space-y-2 rounded border border-slate-700 p-2">
              <p className="text-xs uppercase text-slate-400">Avatar Styling</p>
              <div className="grid grid-cols-3 gap-2">
                <Button size="sm" variant={state.avatar.scalePreset === "standard" ? "default" : "outline"} onClick={() => setAvatarPatch({ scalePreset: "standard" })}>Standard</Button>
                <Button size="sm" variant={state.avatar.scalePreset === "slender" ? "default" : "outline"} onClick={() => setAvatarPatch({ scalePreset: "slender" })}>Slender</Button>
                <Button size="sm" variant={state.avatar.scalePreset === "stocky" ? "default" : "outline"} onClick={() => setAvatarPatch({ scalePreset: "stocky" })}>Stocky</Button>
              </div>
              <Input value={state.avatar.skinTone} onChange={(event) => setAvatarPatch({ skinTone: event.target.value })} placeholder="#f1c27d" />
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant={state.avatar.pose === "idle" ? "default" : "outline"} onClick={() => setAvatarPatch({ pose: "idle" })}>Idle</Button>
                <Button size="sm" variant={state.avatar.pose === "hero" ? "default" : "outline"} onClick={() => setAvatarPatch({ pose: "hero" })}>Hero</Button>
              </div>
            </div>
            {(experienceMode === "studio" || showAdvancedControls || editorSurface === "avatar") ? <div className="space-y-2 rounded border border-slate-700 p-2">
              <p className="text-xs uppercase text-slate-400">Avatar slot editor</p>
              <Input value={avatarAssetSearch} onChange={(event) => setAvatarAssetSearch(event.target.value)} placeholder="Search avatar assets..." />
              <div className="grid grid-cols-2 gap-2 text-xs">
                <select className="rounded border border-slate-700 bg-slate-950 px-2 py-1" value={avatarSlotFilter} onChange={(event) => setAvatarSlotFilter(event.target.value as AvatarCosmeticSlot | "all")}>
                  <option value="all">All slots</option>
                  {AVATAR_SLOTS.map((slot) => <option key={slot} value={slot}>{slotLabel(slot)}</option>)}
                </select>
                <select className="rounded border border-slate-700 bg-slate-950 px-2 py-1" value={avatarCategoryFilter} onChange={(event) => setAvatarCategoryFilter(event.target.value as AvatarAssetCategory | "all")}>
                  <option value="all">All categories</option>
                  <option value="face">Face</option>
                  <option value="hair">Hair</option>
                  <option value="hat">Hat</option>
                  <option value="neck">Neck</option>
                  <option value="shoulder">Shoulder</option>
                  <option value="back">Back</option>
                  <option value="footwear">Footwear</option>
                  <option value="aura">Aura</option>
                </select>
              </div>
              <div className="space-y-1 max-h-64 overflow-auto">
                {AVATAR_SLOTS.filter((slot) => avatarSlotFilter === "all" || slot === avatarSlotFilter).map((slot) => {
                  const current = state.avatar.slots[slot];
                  const currentAsset = getAvatarAssetById(current?.assetId);
                  const candidates = filteredAvatarAssets.filter((asset) => asset.slot === slot);
                  return (
                    <div key={slot} className="rounded border border-slate-700 p-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] text-slate-300">{slotLabel(slot)}</p>
                        <span className="text-[10px] text-slate-400">{currentAsset ? assetStatusLabel(currentAsset.previewOnly, currentAsset.exportable) : "Empty"}</span>
                      </div>
                      <p className="text-[11px] text-slate-400">{currentAsset?.name ?? "No asset assigned"}</p>
                      <div className="grid grid-cols-2 gap-1 mt-1">
                        {candidates.slice(0, 2).map((asset) => (
                          <Button key={asset.id} size="sm" variant={current?.assetId === asset.id ? "default" : "outline"} className="justify-start text-[11px]" onClick={() => assignAvatarSlotAsset(slot, asset)}>
                            {asset.name}
                          </Button>
                        ))}
                        <Button size="sm" variant="ghost" onClick={() => setAvatarSlot(slot, null)}>Remove</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div> : null}
            <p className="text-xs text-slate-400">Export captures this exact design state and layer stack.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
