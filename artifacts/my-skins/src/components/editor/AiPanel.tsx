import { useEffect, useMemo, useState } from "react";
import { Sparkles, Loader2, Wand2, RefreshCcw, Check, AlertTriangle, Shirt, Palette } from "lucide-react";
import { aiGenerateDesign, aiImproveDesign, aiRemixDesign, type AiDesign } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { normalizeAiResponse, type NormalizedAiResponse } from "@/lib/ai/normalize-ai-response";
import { aiGenerateStylizedOutfit, type StylizedOutfitConcept } from "@/lib/ai/stylized-outfit-client";

const STYLE_PRESETS = ["Streetwear", "Anime", "Sport", "Cyberpunk", "Minimal", "Fantasy", "Luxury", "Cute", "Tactical"] as const;

type EditorTarget = "shirt" | "pants";
type AiOutputMode = "classic_2d" | "fashion_concept";

interface AiPanelProps {
  projectType: EditorTarget;
  aiMode: AiOutputMode;
  onModeChange: (mode: AiOutputMode) => void;
  onUseColors?: (colors: string[]) => void;
  onApplyAssets?: (result: NormalizedAiResponse) => Promise<unknown> | unknown;
  onFashionConcept?: (concept: StylizedOutfitConcept) => void;
  avatarType?: string;
  bodyType?: string;
  clothingMode: "classic2d" | "fashionBuilder";
}

export function AiPanel({ projectType, aiMode, onModeChange, onUseColors, onApplyAssets, onFashionConcept, avatarType, bodyType, clothingMode }: AiPanelProps) {
  const { toast } = useToast();

  const [prompt, setPrompt] = useState("");
  const [remixInstruction, setRemixInstruction] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<(typeof STYLE_PRESETS)[number] | "">("");
  const [current, setCurrent] = useState<NormalizedAiResponse | null>(null);
  const [fashionConcept, setFashionConcept] = useState<StylizedOutfitConcept | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const palette = useMemo(() => current?.result.colorPalette ?? [], [current]);
  const itemType = projectType === "shirt" ? "classic_shirt" : "classic_pants";

  useEffect(() => {
    setCurrent((prev) => {
      if (!prev) return prev;
      const nextItemType = projectType === "shirt" ? "classic_shirt" : "classic_pants";
      return prev.result.itemType === nextItemType ? prev : null;
    });
  }, [projectType]);

  const runAction = async (mode: "generate" | "improve" | "remix") => {
    if (loading) return;
    if (mode === "generate" && !prompt.trim()) return;
    if ((mode === "improve" || mode === "remix") && !remixInstruction.trim()) return;

    if (aiMode === "fashion_concept") {
      if (mode !== "generate") {
        toast({ title: "Fashion Concept AI", description: "Use Generate to create a fresh fashion concept recommendation." });
        return;
      }
      setLoading(true);
      setErrorMessage(null);
      try {
        const response = await aiGenerateStylizedOutfit({
          prompt: prompt.trim(),
          avatarType,
          bodyType,
          style: selectedStyle || undefined,
        });
        setFashionConcept(response.result);
        onFashionConcept?.(response.result);
        onUseColors?.(response.result.colorPalette);
        toast({ title: "Fashion concept ready", description: "Preview + recommendations updated." });
      } catch (error) {
        const message = error instanceof Error ? error.message : "AI request failed";
        setErrorMessage(message);
        toast({ title: "Fashion concept failed", description: message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
      return;
    }

    if ((mode === "improve" || mode === "remix") && !current) {
      setErrorMessage("Generate a structured design first before improving/remixing.");
      toast({ title: "Missing source design", description: "Generate first, then improve or remix.", variant: "destructive" });
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      const baseDesign = current?.result as AiDesign | undefined;
      const next = mode === "generate"
        ? normalizeAiResponse(await aiGenerateDesign({ prompt: prompt.trim(), itemType, style: selectedStyle || undefined, theme: selectedStyle || undefined }))
        : normalizeAiResponse(await (mode === "improve"
          ? aiImproveDesign({ instruction: remixInstruction.trim(), design: baseDesign as AiDesign })
          : aiRemixDesign({ instruction: remixInstruction.trim(), design: baseDesign as AiDesign })));

      setCurrent(next);
      if (next.meta.status !== "completed") {
        throw new Error(`AI returned status ${next.meta.status}`);
      }
      toast({ title: mode === "generate" ? "Structured design ready" : "Design refined", description: "Review card details before applying." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI request failed";
      setErrorMessage(message);
      toast({ title: "AI validation failed", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-primary"><Sparkles className="w-4 h-4" /><span className="font-semibold text-sm">Create with AI</span></div>
        <div className="grid grid-cols-2 gap-1">
          <Button size="sm" variant={aiMode === "classic_2d" ? "default" : "outline"} onClick={() => onModeChange("classic_2d")} className="gap-1 text-xs">
            <Shirt className="w-3.5 h-3.5" /> Classic Clothing AI
          </Button>
          <Button size="sm" variant={aiMode === "fashion_concept" ? "default" : "outline"} onClick={() => onModeChange("fashion_concept")} className="gap-1 text-xs">
            <Palette className="w-3.5 h-3.5" /> Fashion Concept AI
          </Button>
        </div>
      </div>

      {aiMode === "classic_2d" ? (
        <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80">
          <span className="font-semibold">Classic Clothing AI</span> generates strict Roblox shirt/pants schema output for real classic export.
        </div>
      ) : (
        <div className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs text-indigo-100">
          <span className="font-semibold">Fashion Concept AI</span> suggests garments, colors, patterns, and accessories for Fashion Builder previews.
        </div>
      )}

      <Textarea placeholder={aiMode === "fashion_concept" ? "Try: pirate clothes, tactical accessories, red trim, skull modules" : "Prompt your classic Roblox clothing design"} value={prompt} onChange={(e) => setPrompt(e.target.value)} className="resize-none h-20 text-xs" />

      <div className="grid grid-cols-3 gap-1">
        {STYLE_PRESETS.map((preset) => (
          <button key={preset} onClick={() => setSelectedStyle((prev) => (prev === preset ? "" : preset))} className={`text-[10px] py-1 px-1 rounded border ${selectedStyle === preset ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
            {preset}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" className="gap-1" onClick={() => void runAction("generate")} disabled={!prompt.trim() || loading}>
          {loading ? <><Loader2 className="w-3 h-3 animate-spin" /> Loading</> : <><Sparkles className="w-3 h-3" /> Generate</>}
        </Button>
        <Button size="sm" variant="outline" className="gap-1" onClick={() => void runAction("generate")} disabled={!prompt.trim() || loading}>
          <RefreshCcw className="w-3 h-3" /> Retry
        </Button>
      </div>

      {aiMode === "classic_2d" && (
        <div className="grid grid-cols-[1fr_auto_auto] gap-1.5">
          <Textarea placeholder="Improve/remix instruction" value={remixInstruction} onChange={(e) => setRemixInstruction(e.target.value)} className="resize-none h-14 text-xs" />
          <Button size="sm" variant="secondary" onClick={() => void runAction("remix")} disabled={!current || !remixInstruction.trim() || loading}><Wand2 className="w-3.5 h-3.5" /></Button>
          <Button size="sm" variant="outline" onClick={() => void runAction("improve")} disabled={!current || !remixInstruction.trim() || loading}>Improve</Button>
        </div>
      )}

      {errorMessage && <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive flex gap-2 items-start"><AlertTriangle className="w-3.5 h-3.5 mt-0.5" /><div><p className="font-medium">AI output rejected</p><p>{errorMessage}</p></div></div>}

      {current && aiMode === "classic_2d" && (
        <div className="border rounded-xl p-3 space-y-2">
          <div className="space-y-1">
            <p className="text-xs font-semibold">{current.result.title}</p>
            <p className="text-[11px] text-muted-foreground">{current.result.theme} · {current.result.style} · {current.result.itemType}</p>
            <div className="flex flex-wrap gap-1">{current.result.designElements.map((element) => <Badge key={element} variant="outline" className="text-[10px]">{element}</Badge>)}</div>
          </div>
          <div className="flex flex-wrap gap-1">{palette.map((hex, i) => <Badge key={`${hex}-${i}`} variant="outline" className="text-[10px]">{hex}</Badge>)}</div>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="outline" onClick={() => onUseColors?.(palette)}><Check className="w-3 h-3 mr-1" />Apply Palette</Button>
            <Button size="sm" onClick={() => onApplyAssets?.(current)}><Sparkles className="w-3 h-3 mr-1" />Apply</Button>
          </div>
        </div>
      )}

      {fashionConcept && aiMode === "fashion_concept" && (
        <div className="border rounded-xl p-3 space-y-2 bg-indigo-500/5 border-indigo-500/20">
          <p className="text-xs font-semibold">{fashionConcept.title}</p>
          <p className="text-[11px] text-white/70">{fashionConcept.theme} · {fashionConcept.styleTone} · {clothingMode === "fashionBuilder" ? "Fashion Builder" : "Classic"}</p>
          <p className="text-[11px] text-muted-foreground">{fashionConcept.visualSummary}</p>
          <div className="flex flex-wrap gap-1">{fashionConcept.colorPalette.map((hex, i) => <Badge key={`${hex}-${i}`} variant="outline" className="text-[10px]">{hex}</Badge>)}</div>
        </div>
      )}
    </div>
  );
}
