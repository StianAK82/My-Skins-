import { useMemo, useState } from "react";
import {
  type AiGeneratedOutfit,
  type AiOutfitPlan,
  useGenerateOutfit,
  useGenerateOutfitVariants,
  useRemixOutfit,
} from "@workspace/api-client-react";
import { Sparkles, Loader2, Wand2, RefreshCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

const STYLE_PRESETS = ["Streetwear", "Anime", "Cyberpunk", "Y2K", "Minimal", "Fantasy", "Sport", "Luxury"] as const;
const VARIANT_ORDER = ["Clean", "Bold", "Premium", "Experimental"] as const;

type EditorTarget = "shirt" | "pants";

interface AiPanelProps {
  projectType: EditorTarget;
  onUseColors?: (colors: string[]) => void;
  onApplyAssets?: (result: AiGeneratedOutfit) => Promise<void> | void;
}

export function AiPanel({ projectType, onUseColors, onApplyAssets }: AiPanelProps) {
  const { toast } = useToast();
  const generateOutfit = useGenerateOutfit();
  const generateVariants = useGenerateOutfitVariants();
  const remixOutfit = useRemixOutfit();

  const [prompt, setPrompt] = useState("");
  const [remixInstruction, setRemixInstruction] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<(typeof STYLE_PRESETS)[number] | "">("");
  const [selectedTarget, setSelectedTarget] = useState<EditorTarget>(projectType);
  const [variants, setVariants] = useState<Array<{ label: string; result: AiGeneratedOutfit }>>([]);
  const [activeVariant, setActiveVariant] = useState(0);

  const loading = generateOutfit.isPending || generateVariants.isPending || remixOutfit.isPending;
  const current = variants[activeVariant]?.result;

  const palette = useMemo(() => current?.concept.colorPalette ?? [], [current]);

  const target = selectedTarget === "shirt" ? "classic_shirt" : "classic_pants";

  const buildFallbackPreview = (label: string) => {
    if (!current) return "";
    const palette = current.concept.colorPalette;
    const primary = palette[0] ?? current.concept.baseColor;
    const secondary = palette[1] ?? "#ffffff";
    const accent = palette[2] ?? "#111111";
    const data = `
      <svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
        <rect width="512" height="512" fill="${current.concept.baseColor}" />
        <rect x="48" y="72" width="416" height="368" rx="24" fill="${primary}" opacity="0.28" />
        <rect x="56" y="112" width="400" height="34" rx="17" fill="${secondary}" opacity="0.9" />
        <rect x="56" y="366" width="400" height="24" rx="12" fill="${accent}" opacity="0.85" />
        <circle cx="256" cy="256" r="82" fill="${secondary}" opacity="0.85" />
        <circle cx="256" cy="256" r="42" fill="${accent}" opacity="0.9" />
      </svg>
    `;
    return `data:image/svg+xml;utf8,${encodeURIComponent(data)}#${encodeURIComponent(label)}`;
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    try {
      const result = await generateOutfit.mutateAsync({ data: { prompt: prompt.trim(), target, stylePreset: selectedStyle || undefined } });
      setVariants([{ label: "Base", result }]);
      setActiveVariant(0);
      toast({ title: "Outfit generated", description: "Preview regions and apply to canvas." });
    } catch (error) {
      toast({ title: "AI Error", description: error instanceof Error ? error.message : "Generation failed", variant: "destructive" });
    }
  };

  const handleVariants = async () => {
    if (!prompt.trim()) return;
    try {
      const payload = await generateVariants.mutateAsync({
        data: {
          prompt: prompt.trim(),
          target,
          stylePreset: selectedStyle || undefined,
          basePlan: current?.concept as AiOutfitPlan | undefined,
        },
      });

      setVariants(payload.variants.map((variant) => ({ label: variant.variant, result: variant.result })));
      setActiveVariant(0);
      toast({ title: "Variants ready", description: "Generated Clean, Bold, Premium, and Experimental." });
    } catch (error) {
      toast({ title: "AI Error", description: error instanceof Error ? error.message : "Variant generation failed", variant: "destructive" });
    }
  };

  const handleRemix = async () => {
    if (!current || !remixInstruction.trim()) return;
    try {
      const result = await remixOutfit.mutateAsync({ data: { instruction: remixInstruction.trim(), source: current } });
      setVariants([{ label: "Remix", result }]);
      setActiveVariant(0);
      toast({ title: "Remix ready", description: "Your concept was improved while preserving core style." });
    } catch (error) {
      toast({ title: "AI Error", description: error instanceof Error ? error.message : "Remix failed", variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2 text-primary"><Sparkles className="w-4 h-4" /><span className="font-semibold text-sm">AI Roblox Outfit Engine</span></div>

      <div className="grid grid-cols-2 gap-1">
        {(["shirt", "pants"] as const).map((t) => (
          <Button key={t} size="sm" variant={selectedTarget === t ? "default" : "outline"} onClick={() => setSelectedTarget(t)}>
            {t === "shirt" ? "Shirt" : "Pants"}
          </Button>
        ))}
      </div>

      <Textarea placeholder="Prompt: black streetwear shirt with blue flames and subtle sleeve stripes" value={prompt} onChange={(e) => setPrompt(e.target.value)} className="resize-none h-20 text-xs" />

      <div className="grid grid-cols-4 gap-1">
        {STYLE_PRESETS.map((preset) => (
          <button key={preset} onClick={() => setSelectedStyle((prev) => (prev === preset ? "" : preset))} className={`text-[10px] py-1 px-1 rounded border ${selectedStyle === preset ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
            {preset}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" className="gap-1" onClick={handleGenerate} disabled={!prompt.trim() || loading}>
          {loading ? <><Loader2 className="w-3 h-3 animate-spin" /> Generating</> : <><Sparkles className="w-3 h-3" /> Generate</>}
        </Button>
        <Button size="sm" variant="outline" className="gap-1" onClick={handleVariants} disabled={!prompt.trim() || loading}>
          <RefreshCcw className="w-3 h-3" /> Variants
        </Button>
      </div>

      <div className="grid grid-cols-[1fr_auto_auto] gap-1.5">
        <Textarea placeholder="make it darker / cleaner / more premium / add sleeve detail" value={remixInstruction} onChange={(e) => setRemixInstruction(e.target.value)} className="resize-none h-14 text-xs" />
        <Button size="sm" variant="secondary" onClick={handleRemix} disabled={!current || !remixInstruction.trim() || loading}><Wand2 className="w-3.5 h-3.5" /></Button>
        <Button size="sm" variant="outline" onClick={handleRemix} disabled={!current || !remixInstruction.trim() || loading}>Improve</Button>
      </div>

      {current && (
        <div className="border rounded-xl p-3 space-y-2">
          <div className="grid grid-cols-4 gap-1">
            {(variants.length ? variants : VARIANT_ORDER.map((v) => ({ label: v, result: current }))).map((v, index) => (
              <Button key={`${v.label}-${index}`} size="sm" variant={index === activeVariant ? "default" : "outline"} className="text-[10px] h-7" onClick={() => setActiveVariant(index)}>{v.label}</Button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Front", src: current.assets?.frontImage },
              { label: "Back", src: current.assets?.backImage },
              { label: "Left Sleeve", src: current.assets?.leftSleeveImage },
              { label: "Right Sleeve", src: current.assets?.rightSleeveImage },
            ].map((item) => (
              <div key={item.label} className="border rounded-lg overflow-hidden bg-muted/20">
                <img src={item.src || buildFallbackPreview(item.label)} alt={item.label} className="w-full aspect-square object-contain" />
                <div className="text-[10px] px-2 py-1 uppercase text-muted-foreground">{item.label}</div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-1">{palette.map((hex, i) => <Badge key={`${hex}-${i}`} variant="outline" className="text-[10px]">{hex}</Badge>)}</div>

          <div className="grid grid-cols-2 gap-2">
            <Button size="sm" variant="outline" onClick={() => onUseColors?.(palette)}><Check className="w-3 h-3 mr-1" />Apply Palette</Button>
            <Button size="sm" onClick={() => current && onApplyAssets?.(current)} disabled={!current}><Sparkles className="w-3 h-3 mr-1" />Apply to canvas</Button>
          </div>
        </div>
      )}
    </div>
  );
}
