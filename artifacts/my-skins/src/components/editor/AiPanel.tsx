import { useMemo, useState } from "react";
import { z } from "zod";
import { Sparkles, Loader2, Wand2, RefreshCcw, Check, AlertTriangle } from "lucide-react";
import { type AiGeneratedOutfit } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const STYLE_PRESETS = ["Streetwear", "Anime", "Sport", "Cyberpunk", "Minimal", "Fantasy", "Luxury", "Cute", "Tactical"] as const;

type EditorTarget = "shirt" | "pants";

interface AiPanelProps {
  projectType: EditorTarget;
  onUseColors?: (colors: string[]) => void;
  onApplyAssets?: (result: AiGeneratedOutfit) => Promise<unknown> | unknown;
}

const moduleSchema = z.object({
  id: z.string(),
  type: z.string(),
  label: z.string(),
  color: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  scale: z.number(),
  rotation: z.number(),
  opacity: z.number(),
  layer: z.number(),
});

const aiDesignSchema = z.object({
  title: z.string(),
  itemType: z.enum(["classic_shirt", "classic_pants"]),
  style: z.string(),
  target: z.literal("roblox"),
  theme: z.string(),
  colorPalette: z.array(z.string()).min(2),
  designElements: z.array(z.string()).min(1),
  placement: z.object({
    front: z.string(),
    back: z.string(),
    leftSleeve: z.string(),
    rightSleeve: z.string(),
    leftLeg: z.string(),
    rightLeg: z.string(),
  }),
  modules: z.array(moduleSchema),
  editorInstructions: z.object({
    baseTemplate: z.string(),
    recommendedPreset: z.string(),
    notes: z.array(z.string()),
  }),
});

type AiDesign = z.infer<typeof aiDesignSchema>;

async function postAi(path: string, body: unknown): Promise<AiDesign> {
  const response = await fetch(`/api/ai/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.error ?? "AI request failed");
  }

  return aiDesignSchema.parse(payload);
}

function toLegacyOutfit(design: AiDesign): AiGeneratedOutfit {
  return {
    concept: {
      title: design.title,
      style: design.style,
      baseColor: design.colorPalette[0],
      colorPalette: design.colorPalette,
      front: { description: design.placement.front },
      back: { description: design.placement.back },
      leftSleeve: { description: design.placement.leftSleeve },
      rightSleeve: { description: design.placement.rightSleeve },
    },
    assets: {
      frontImage: null,
      backImage: null,
      leftSleeveImage: null,
      rightSleeveImage: null,
    },
  };
}

export function AiPanel({ projectType, onUseColors, onApplyAssets }: AiPanelProps) {
  const { toast } = useToast();

  const [prompt, setPrompt] = useState("");
  const [remixInstruction, setRemixInstruction] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<(typeof STYLE_PRESETS)[number] | "">("");
  const [selectedTarget, setSelectedTarget] = useState<EditorTarget>(projectType);
  const [current, setCurrent] = useState<AiDesign | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const palette = useMemo(() => current?.colorPalette ?? [], [current]);
  const itemType = selectedTarget === "shirt" ? "classic_shirt" : "classic_pants";

  const requestBody = {
    prompt: prompt.trim(),
    itemType,
    style: selectedStyle || undefined,
    theme: selectedStyle || undefined,
  };

  const runAction = async (mode: "generate" | "improve" | "remix") => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const next = mode === "generate"
        ? await postAi("generate", requestBody)
        : await postAi(mode, { instruction: remixInstruction.trim(), design: current });
      setCurrent(next);
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

      {errorMessage && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive flex gap-2 items-start">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5" />
          <div>
            <p className="font-medium">Structured output rejected</p>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {current && (
        <div className="border rounded-xl p-3 space-y-2">
          <div className="space-y-1">
            <p className="text-xs font-semibold">{current.title}</p>
            <p className="text-[11px] text-muted-foreground">{current.theme} · {current.style} · {current.itemType}</p>
            <div className="flex flex-wrap gap-1">{current.designElements.map((element) => <Badge key={element} variant="outline" className="text-[10px]">{element}</Badge>)}</div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
            <div className="border rounded p-2">Front: {current.placement.front}</div>
            <div className="border rounded p-2">Back: {current.placement.back}</div>
            <div className="border rounded p-2">Left: {current.itemType === "classic_shirt" ? current.placement.leftSleeve : current.placement.leftLeg}</div>
            <div className="border rounded p-2">Right: {current.itemType === "classic_shirt" ? current.placement.rightSleeve : current.placement.rightLeg}</div>
          </div>

          <div className="flex flex-wrap gap-1">{palette.map((hex, i) => <Badge key={`${hex}-${i}`} variant="outline" className="text-[10px]">{hex}</Badge>)}</div>

          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="outline" onClick={() => onUseColors?.(palette)}><Check className="w-3 h-3 mr-1" />Apply Palette</Button>
            <Button size="sm" onClick={() => onApplyAssets?.(toLegacyOutfit(current))}><Sparkles className="w-3 h-3 mr-1" />Apply to design</Button>
          </div>
        </div>
      )}
    </div>
  );
}
