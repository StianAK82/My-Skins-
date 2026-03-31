import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
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
] as const;

type StylePreset = (typeof STYLE_PRESETS)[number]["id"];
type AiMode = "idea" | "improve-design" | "generate-listing";

const designSchema = z.object({
  title: z.string(),
  style: z.string(),
  colorPalette: z.array(z.string()),
  designElements: z.array(z.string()),
  placement: z.object({
    front: z.string(),
    back: z.string(),
    sleeves: z.string(),
  }),
});

type DesignResult = z.infer<typeof designSchema>;

interface AiPanelProps {
  projectType: "shirt" | "pants";
  onUseColors?: (colors: string[]) => void;
}

async function callAi(endpoint: string, body: Record<string, unknown>): Promise<DesignResult> {
  const res = await fetch(`/api/${endpoint}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload.error ?? "AI request failed");
  }

  const parsed = designSchema.safeParse(payload.data);
  if (!parsed.success) {
    throw new Error("Received invalid AI schema from server");
  }

  return parsed.data;
}

export function AiPanel({ projectType: _projectType, onUseColors }: AiPanelProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<AiMode>("idea");
  const [prompt, setPrompt] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<StylePreset | "">("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DesignResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const endpointMap: Record<AiMode, string> = {
    idea: "ai/generate-idea",
    "improve-design": "ai/improve-design",
    "generate-listing": "ai/generate-listing",
  };

  const generate = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const endpoint = endpointMap[mode];
      const body = mode === "idea"
        ? { prompt, style: selectedStyle || undefined }
        : mode === "improve-design"
          ? { description: prompt, style: selectedStyle || undefined }
          : { idea: prompt, style: selectedStyle || undefined };

      const aiResult = await callAi(endpoint, body);
      setResult(aiResult);
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI request failed";
      setResult(null);
      setErrorMessage(message);
      toast({ title: "AI Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-3">
      <div className="flex items-center gap-2 text-primary">
        <Sparkles className="w-4 h-4" />
        <span className="font-semibold text-sm">AI Design Engine</span>
      </div>

      <div className="grid grid-cols-3 gap-1 bg-muted/50 p-1 rounded-lg">
        {([
          { id: "idea", label: "Generate Idea" },
          { id: "improve-design", label: "Improve" },
          { id: "generate-listing", label: "Listing Spec" },
        ] as const).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setMode(tab.id)}
            className={`py-1.5 rounded-md text-[10px] font-medium transition-colors ${
              mode === tab.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wide">Quick Style</p>
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
        placeholder="Describe the Roblox clothing direction..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="resize-none h-24 bg-background text-xs"
      />

      <Button className="w-full gap-2" onClick={generate} disabled={!prompt.trim() || loading} size="sm">
        {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...</> : <><Sparkles className="w-3.5 h-3.5" /> Generate</>}
      </Button>

      {errorMessage && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 text-xs text-destructive">
          Invalid AI output: {errorMessage}
        </div>
      )}

      {result && (
        <div className="bg-card border border-border rounded-xl p-3 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="font-semibold text-sm">{result.title}</h4>
              <Badge variant="secondary" className="mt-1 text-[10px]">{result.style}</Badge>
            </div>
            <Button size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => onUseColors?.(result.colorPalette)}>
              Apply to design
            </Button>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Color Palette</p>
            <div className="flex gap-2 flex-wrap">
              {result.colorPalette.map((hex, index) => (
                <div key={`${hex}-${index}`} className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px]">
                  <span className="h-3 w-3 rounded-sm border border-white/20" style={{ backgroundColor: hex }} />
                  <span className="font-mono">{hex}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Design Elements</p>
            <div className="flex flex-wrap gap-1">
              {result.designElements.map((element, index) => (
                <Badge key={`${element}-${index}`} variant="outline" className="text-[10px]">{element}</Badge>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 text-xs">
            <div className="rounded-lg border border-border p-2"><strong>Front:</strong> {result.placement.front}</div>
            <div className="rounded-lg border border-border p-2"><strong>Back:</strong> {result.placement.back}</div>
            <div className="rounded-lg border border-border p-2"><strong>Sleeves:</strong> {result.placement.sleeves}</div>
          </div>
        </div>
      )}
    </div>
  );
}
