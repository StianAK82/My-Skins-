import { useMemo, useState } from "react";
import { Sparkles, Loader2, Wand2, RefreshCcw, Check } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const STYLE_PRESETS = [
  { id: "streetwear", label: "Streetwear" },
  { id: "anime", label: "Anime" },
  { id: "cyberpunk", label: "Cyberpunk" },
  { id: "y2k", label: "Y2K" },
  { id: "minimal", label: "Minimal" },
  { id: "fantasy", label: "Fantasy" },
] as const;

type StylePreset = (typeof STYLE_PRESETS)[number]["id"];

const assetsSchema = z.object({
  frontImage: z.string(),
  backImage: z.string(),
  sleeveImage: z.string(),
  colorPalette: z.array(z.string()),
});

const generateAssetsResponseSchema = assetsSchema.extend({
  variants: z.array(assetsSchema).optional(),
});

type DesignAssets = z.infer<typeof assetsSchema>;

interface AiPanelProps {
  projectType: "shirt" | "pants";
  onUseColors?: (colors: string[]) => void;
  onApplyAssets?: (assets: DesignAssets) => Promise<void> | void;
}

async function callGenerateAssets(body: Record<string, unknown>) {
  const res = await fetch("/api/ai/generate-assets", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.error ?? "AI asset generation failed");
  }

  const parsed = generateAssetsResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error("Server returned invalid asset response schema");
  }

  return parsed.data;
}

export function AiPanel({ projectType, onUseColors, onApplyAssets }: AiPanelProps) {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<StylePreset | "">("");
  const [loading, setLoading] = useState(false);
  const [remixInstruction, setRemixInstruction] = useState("");
  const [variationCount, setVariationCount] = useState<2 | 3 | 4>(2);
  const [activeVariant, setActiveVariant] = useState(0);
  const [result, setResult] = useState<z.infer<typeof generateAssetsResponseSchema> | null>(null);

  const variants = useMemo(() => {
    if (!result) return [];
    return [
      {
        frontImage: result.frontImage,
        backImage: result.backImage,
        sleeveImage: result.sleeveImage,
        colorPalette: result.colorPalette,
      },
      ...(result.variants ?? []),
    ];
  }, [result]);

  const selectedAssets = variants[activeVariant];

  const generate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);

    try {
      const payload = await callGenerateAssets({
        prompt,
        style: selectedStyle || undefined,
        type: projectType,
      });
      setResult(payload);
      setActiveVariant(0);
      toast({ title: "Design generated", description: "Choose a variation and apply it to your canvas." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI request failed";
      toast({ title: "AI Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const generateVariations = async () => {
    if (!prompt.trim()) return;
    setLoading(true);

    try {
      const payload = await callGenerateAssets({
        prompt,
        style: selectedStyle || undefined,
        type: projectType,
        variationCount,
      });
      setResult(payload);
      setActiveVariant(0);
      toast({ title: "Variations ready", description: `${(payload.variants?.length ?? 0) + 1} options generated.` });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Variation generation failed";
      toast({ title: "AI Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const remix = async () => {
    if (!selectedAssets || !prompt.trim() || !remixInstruction.trim()) return;
    setLoading(true);

    try {
      const payload = await callGenerateAssets({
        prompt,
        style: selectedStyle || undefined,
        type: projectType,
        remixInstruction,
        currentDesign: selectedAssets,
      });
      setResult(payload);
      setActiveVariant(0);
      toast({ title: "Design remixed", description: "Your updated visual assets are ready." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Remix failed";
      toast({ title: "AI Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2 text-primary">
        <Sparkles className="w-4 h-4" />
        <span className="font-semibold text-sm">AI Visual Design Engine</span>
      </div>

      <div>
        <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wide">Style Presets</p>
        <div className="grid grid-cols-3 gap-1">
          {STYLE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => setSelectedStyle((prev) => (prev === preset.id ? "" : preset.id))}
              className={`text-[10px] py-1.5 px-1 rounded-md border transition-all ${
                selectedStyle === preset.id
                  ? "border-primary bg-primary/10 text-primary font-semibold"
                  : "border-border text-muted-foreground"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <Textarea
        placeholder="Describe the graphic to generate for Roblox clothing..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="resize-none h-24 bg-background text-xs"
      />

      <div className="grid grid-cols-2 gap-1.5">
        <Button className="gap-2" onClick={generate} disabled={!prompt.trim() || loading} size="sm">
          {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...</> : <><Sparkles className="w-3.5 h-3.5" /> Generate Design</>}
        </Button>
        <Button variant="outline" className="gap-2" onClick={generateVariations} disabled={!prompt.trim() || loading} size="sm">
          <RefreshCcw className="w-3.5 h-3.5" /> Generate Variations
        </Button>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-1.5">
        <Textarea
          placeholder="Improve this design / Make darker / Add more detail"
          value={remixInstruction}
          onChange={(e) => setRemixInstruction(e.target.value)}
          className="resize-none h-16 bg-background text-xs"
        />
        <div className="flex flex-col gap-1.5">
          <select
            className="h-8 rounded-md border border-border bg-background px-2 text-xs"
            value={variationCount}
            onChange={(e) => setVariationCount(Number(e.target.value) as 2 | 3 | 4)}
          >
            <option value={2}>2x</option>
            <option value={3}>3x</option>
            <option value={4}>4x</option>
          </select>
          <Button variant="secondary" size="sm" className="h-8 text-xs" onClick={remix} disabled={!remixInstruction.trim() || loading || !selectedAssets}>
            <Wand2 className="w-3.5 h-3.5 mr-1" /> Remix
          </Button>
        </div>
      </div>

      {selectedAssets && (
        <div className="bg-card border border-border rounded-xl p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              {variants.length} design option{variants.length > 1 ? "s" : ""}
            </div>
            <div className="flex gap-1">
              {variants.map((_, index) => (
                <Button
                  key={`variant-${index}`}
                  variant={activeVariant === index ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-[10px]"
                  onClick={() => setActiveVariant(index)}
                >
                  V{index + 1}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {([
              { label: "Front", src: selectedAssets.frontImage },
              { label: "Back", src: selectedAssets.backImage },
              { label: "Sleeves", src: selectedAssets.sleeveImage },
            ] as const).map((image) => (
              <div key={image.label} className="rounded-lg border border-border overflow-hidden bg-muted/30">
                <img src={image.src} alt={`${image.label} preview`} className="w-full aspect-square object-contain" />
                <div className="px-2 py-1 text-[10px] text-muted-foreground uppercase tracking-wide">{image.label}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 flex-wrap">
            {selectedAssets.colorPalette.map((hex, index) => (
              <Badge key={`${hex}-${index}`} variant="outline" className="text-[10px] font-mono">
                <span className="h-2.5 w-2.5 rounded-full mr-1" style={{ background: hex }} />
                {hex}
              </Badge>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => onUseColors?.(selectedAssets.colorPalette)}>
              <Check className="w-3.5 h-3.5 mr-1" /> Apply Palette
            </Button>
            <Button size="sm" className="h-8 text-xs" onClick={() => onApplyAssets?.(selectedAssets)}>
              <Sparkles className="w-3.5 h-3.5 mr-1" /> Apply to Canvas
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
