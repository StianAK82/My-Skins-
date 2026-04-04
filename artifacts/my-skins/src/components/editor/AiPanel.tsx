import { useMemo, useState } from "react";
import { Sparkles, Loader2, Wand2, RefreshCcw, Check, AlertTriangle } from "lucide-react";
import { aiGenerateDesign, aiImproveDesign, aiRemixDesign, type AiDesign } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { normalizeAiResponse, type NormalizedAiResponse } from "@/lib/ai/normalize-ai-response";

const STYLE_PRESETS = ["Streetwear", "Anime", "Sport", "Cyberpunk", "Minimal", "Fantasy", "Luxury", "Cute", "Tactical"] as const;

type EditorTarget = "shirt" | "pants";

interface AiPanelProps {
  projectType: EditorTarget;
  onUseColors?: (colors: string[]) => void;
  onApplyAssets?: (result: NormalizedAiResponse) => Promise<unknown> | unknown;
}

export function AiPanel({ projectType, onUseColors, onApplyAssets }: AiPanelProps) {
  const { toast } = useToast();

  const [prompt, setPrompt] = useState("");
  const [remixInstruction, setRemixInstruction] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<(typeof STYLE_PRESETS)[number] | "">("");
  const [selectedTarget, setSelectedTarget] = useState<EditorTarget>(projectType);
  const [current, setCurrent] = useState<NormalizedAiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const palette = useMemo(() => current?.result.colorPalette ?? [], [current]);
  const itemType = selectedTarget === "shirt" ? "classic_shirt" : "classic_pants";

  const runAction = async (mode: "generate" | "improve" | "remix") => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const next = mode === "generate"
        ? normalizeAiResponse(await aiGenerateDesign({ prompt: prompt.trim(), itemType, style: selectedStyle || undefined, theme: selectedStyle || undefined }))
        : normalizeAiResponse(await (mode === "improve"
          ? aiImproveDesign({ instruction: remixInstruction.trim(), design: current?.result as AiDesign })
          : aiRemixDesign({ instruction: remixInstruction.trim(), design: current?.result as AiDesign })));

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
      <div className="flex items-center gap-2 text-primary"><Sparkles className="w-4 h-4" /><span className="font-semibold text-sm">AI Structured Design Engine</span></div>

      <div className="grid grid-cols-2 gap-1">
        {(["shirt", "pants"] as const).map((t) => (
          <Button key={t} size="sm" variant={selectedTarget === t ? "default" : "outline"} onClick={() => setSelectedTarget(t)}>
            {t === "shirt" ? "Classic Shirt" : "Classic Pants"}
          </Button>
        ))}
      </div>

      <Textarea placeholder="Prompt your Roblox wearable concept" value={prompt} onChange={(e) => setPrompt(e.target.value)} className="resize-none h-20 text-xs" />

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

      <div className="grid grid-cols-[1fr_auto_auto] gap-1.5">
        <Textarea placeholder="Refine/remix instruction" value={remixInstruction} onChange={(e) => setRemixInstruction(e.target.value)} className="resize-none h-14 text-xs" />
        <Button size="sm" variant="secondary" onClick={() => void runAction("remix")} disabled={!current || !remixInstruction.trim() || loading}><Wand2 className="w-3.5 h-3.5" /></Button>
        <Button size="sm" variant="outline" onClick={() => void runAction("improve")} disabled={!current || !remixInstruction.trim() || loading}>Refine</Button>
      </div>

      {errorMessage && <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive flex gap-2 items-start"><AlertTriangle className="w-3.5 h-3.5 mt-0.5" /><div><p className="font-medium">Structured output rejected</p><p>{errorMessage}</p></div></div>}

      {current && (
        <div className="border rounded-xl p-3 space-y-2">
          <div className="space-y-1">
            <p className="text-xs font-semibold">{current.result.title}</p>
            <p className="text-[11px] text-muted-foreground">{current.result.theme} · {current.result.style} · {current.result.itemType}</p>
            <div className="flex flex-wrap gap-1">{current.result.designElements.map((element) => <Badge key={element} variant="outline" className="text-[10px]">{element}</Badge>)}</div>
          </div>
          <div className="flex flex-wrap gap-1">{palette.map((hex, i) => <Badge key={`${hex}-${i}`} variant="outline" className="text-[10px]">{hex}</Badge>)}</div>
          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="outline" onClick={() => onUseColors?.(palette)}><Check className="w-3 h-3 mr-1" />Apply Palette</Button>
            <Button size="sm" onClick={() => onApplyAssets?.(current)}><Sparkles className="w-3 h-3 mr-1" />Apply to design</Button>
          </div>
        </div>
      )}
    </div>
  );
}
