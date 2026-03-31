import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/use-language";
import { Sparkles, Loader2, Copy, ChevronDown, ChevronUp, Wand2, Tag, TrendingUp, Palette as PaletteIcon } from "lucide-react";
const STYLE_PRESETS = [
  { id: "streetwear", label: "Streetwear", emoji: "🏙️" },
  { id: "anime", label: "Anime", emoji: "⭐" },
  { id: "cyberpunk", label: "Cyberpunk", emoji: "🌐" },
  { id: "y2k", label: "Y2K", emoji: "✨" },
  { id: "minimal", label: "Minimal", emoji: "◻️" },
  { id: "fantasy", label: "Fantasy", emoji: "🔮" },
];

type AiMode = "idea" | "listing" | "improve" | "palette";

interface IdeaResult {
  idea?: string;
  concept?: string;
  description?: string;
  colors?: Array<{ hex: string; name: string; role?: string }>;
  style?: string;
  mood?: string;
  elements?: string[];
}

interface ListingResult {
  title?: string;
  description?: string;
  tags?: string[];
  priceRange?: string;
  targetAudience?: string;
}

interface ImprovementResult {
  overall?: string;
  score?: number;
  improvements?: Array<{ area: string; issue: string; fix: string }>;
  revisedDescription?: string;
  colorFixes?: Array<{ hex: string; name: string; replaces?: string }>;
  nextSteps?: string[];
}

interface PaletteResult {
  name?: string;
  description?: string;
  colors?: Array<{ hex: string; name: string; role?: string }>;
  usage?: string;
}

interface AiPanelProps {
  projectType: "shirt" | "pants";
  onUseColors?: (colors: string[]) => void;
}

async function callAi<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`/api/${endpoint}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error ?? "AI request failed");
  }
  return res.json();
}

function ColorSwatch({ hex, name, role }: { hex: string; name: string; role?: string }) {
  const { toast } = useToast();
  const copy = () => {
    navigator.clipboard.writeText(hex);
    toast({ title: "Copied!", description: `${hex} copied to clipboard` });
  };
  return (
    <button
      onClick={copy}
      title={`${name} – click to copy ${hex}`}
      className="group flex flex-col items-center gap-1 cursor-pointer"
    >
      <div
        className="w-10 h-10 rounded-lg border border-white/10 shadow-sm group-hover:scale-110 transition-transform"
        style={{ backgroundColor: hex }}
      />
      <span className="text-[10px] text-muted-foreground font-mono leading-tight">{hex}</span>
      {role && <span className="text-[9px] text-muted-foreground/60 capitalize">{role}</span>}
    </button>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 8 ? "text-green-400 bg-green-400/10" :
    score >= 6 ? "text-yellow-400 bg-yellow-400/10" :
    "text-red-400 bg-red-400/10";
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>
      {score}/10
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const { toast } = useToast();
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        toast({ title: "Copied!" });
      }}
      className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
      title="Copy"
    >
      <Copy className="w-3.5 h-3.5" />
    </button>
  );
}

export function AiPanel({ projectType, onUseColors }: AiPanelProps) {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [mode, setMode] = useState<AiMode>("idea");
  const [prompt, setPrompt] = useState("");
  const [selectedStyle, setSelectedStyle] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const [ideaResult, setIdeaResult] = useState<IdeaResult | null>(null);
  const [listingResult, setListingResult] = useState<ListingResult | null>(null);
  const [improveResult, setImproveResult] = useState<ImprovementResult | null>(null);
  const [paletteResult, setPaletteResult] = useState<PaletteResult | null>(null);

  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setExpandedSections(p => ({ ...p, [key]: !p[key] }));

  const placeholders: Record<AiMode, string> = {
    idea: "e.g. black hoodie with flames and dragons...",
    listing: "Describe your design to generate a marketplace listing...",
    improve: "Describe your current design and I'll suggest improvements...",
    palette: "e.g. sunset over a cyberpunk city...",
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);

    try {
      if (mode === "idea") {
        const result = await callAi<IdeaResult>("ai/generate-idea", {
          prompt,
          style: selectedStyle || undefined,
          language,
        });
        setIdeaResult(result);
      } else if (mode === "listing") {
        const result = await callAi<ListingResult>("ai/generate-listing", {
          idea: prompt,
          style: selectedStyle || undefined,
          type: projectType,
          language,
        });
        setListingResult(result);
      } else if (mode === "improve") {
        const result = await callAi<ImprovementResult>("ai/improve", {
          description: prompt,
          style: selectedStyle || undefined,
          type: projectType,
          language,
        });
        setImproveResult(result);
      } else if (mode === "palette") {
        const result = await callAi<PaletteResult>("ai/palette", {
          prompt,
          style: selectedStyle || undefined,
          language,
        });
        setPaletteResult(result);
      }
    } catch (err) {
      toast({
        title: "AI Error",
        description: "Failed to generate. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const MODE_TABS: { id: AiMode; icon: React.ReactNode; label: string }[] = [
    { id: "idea", icon: <Wand2 className="w-3.5 h-3.5" />, label: "Idea" },
    { id: "listing", icon: <Tag className="w-3.5 h-3.5" />, label: "Listing" },
    { id: "improve", icon: <TrendingUp className="w-3.5 h-3.5" />, label: "Improve" },
    { id: "palette", icon: <PaletteIcon className="w-3.5 h-3.5" />, label: "Palette" },
  ];

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Header */}
      <div className="flex items-center gap-2 text-primary">
        <Sparkles className="w-4 h-4" />
        <span className="font-semibold text-sm">AI Design Studio</span>
      </div>

      {/* Mode Tabs */}
      <div className="grid grid-cols-4 gap-1 bg-muted/50 p-1 rounded-lg">
        {MODE_TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setMode(tab.id)}
            className={`flex flex-col items-center gap-0.5 py-1.5 rounded-md text-[10px] font-medium transition-colors ${
              mode === tab.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Style Presets */}
      <div>
        <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wide">Quick Style</p>
        <div className="grid grid-cols-3 gap-1">
          {STYLE_PRESETS.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedStyle(prev => prev === s.id ? "" : s.id)}
              className={`text-[10px] py-1.5 px-1 rounded-md border transition-all text-center leading-tight ${
                selectedStyle === s.id
                  ? "border-primary bg-primary/10 text-primary font-semibold"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
              }`}
            >
              <span className="text-sm block">{s.emoji}</span>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Prompt */}
      <Textarea
        placeholder={placeholders[mode]}
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        className="resize-none h-24 bg-background text-xs"
        onKeyDown={e => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate();
        }}
      />

      <Button
        className="w-full gap-2"
        onClick={handleGenerate}
        disabled={!prompt.trim() || loading}
        size="sm"
      >
        {loading ? (
          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...</>
        ) : (
          <><Sparkles className="w-3.5 h-3.5" /> Generate</>
        )}
      </Button>

      {/* ── IDEA RESULT ── */}
      {mode === "idea" && ideaResult && (
        <div className="space-y-2">
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
            <div className="flex items-start justify-between mb-1">
              <h4 className="font-semibold text-sm text-foreground">{ideaResult.idea ?? "Design Idea"}</h4>
              <CopyButton text={ideaResult.description ?? ideaResult.idea ?? ""} />
            </div>
            {ideaResult.concept && (
              <p className="text-xs text-primary mb-2 italic">{ideaResult.concept}</p>
            )}
            {ideaResult.mood && (
              <span className="inline-block text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground mb-2">
                Mood: {ideaResult.mood}
              </span>
            )}
            {ideaResult.description && (
              <p className="text-xs text-muted-foreground leading-relaxed">{ideaResult.description}</p>
            )}
          </div>

          {ideaResult.colors && ideaResult.colors.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Color Palette</p>
                {onUseColors && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[10px] px-2"
                    onClick={() => onUseColors(ideaResult.colors!.map(c => c.hex))}
                  >
                    Use Colors
                  </Button>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                {ideaResult.colors.map((c, i) => (
                  <ColorSwatch key={i} hex={c.hex} name={c.name} role={c.role} />
                ))}
              </div>
            </div>
          )}

          {ideaResult.elements && ideaResult.elements.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Key Elements</p>
              <div className="flex flex-wrap gap-1">
                {ideaResult.elements.map((el, i) => (
                  <span key={i} className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-foreground">{el}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LISTING RESULT ── */}
      {mode === "listing" && listingResult && (
        <div className="space-y-2">
          {listingResult.title && (
            <div className="bg-card border border-border rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Title</p>
                <CopyButton text={listingResult.title} />
              </div>
              <p className="font-bold text-foreground">{listingResult.title}</p>
            </div>
          )}

          {listingResult.description && (
            <div className="bg-card border border-border rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Description</p>
                <CopyButton text={listingResult.description} />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{listingResult.description}</p>
            </div>
          )}

          {listingResult.tags && listingResult.tags.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Tags</p>
              <div className="flex flex-wrap gap-1">
                {listingResult.tags.map((tag, i) => (
                  <span key={i} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">#{tag}</span>
                ))}
              </div>
            </div>
          )}

          {(listingResult.priceRange || listingResult.targetAudience) && (
            <div className="bg-card border border-border rounded-xl p-3 space-y-1.5">
              {listingResult.priceRange && (
                <div>
                  <p className="text-[10px] text-muted-foreground">Suggested Price</p>
                  <p className="text-xs font-medium text-green-400">{listingResult.priceRange}</p>
                </div>
              )}
              {listingResult.targetAudience && (
                <div>
                  <p className="text-[10px] text-muted-foreground">Target Audience</p>
                  <p className="text-xs text-foreground">{listingResult.targetAudience}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── IMPROVE RESULT ── */}
      {mode === "improve" && improveResult && (
        <div className="space-y-2">
          {improveResult.overall && (
            <div className="bg-card border border-border rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Assessment</p>
                {improveResult.score && <ScoreBadge score={improveResult.score} />}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{improveResult.overall}</p>
            </div>
          )}

          {improveResult.improvements && improveResult.improvements.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-3">
              <button
                className="flex items-center justify-between w-full"
                onClick={() => toggle("improvements")}
              >
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Improvements</p>
                {expandedSections.improvements ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
              {expandedSections.improvements && (
                <div className="mt-2 space-y-2">
                  {improveResult.improvements.map((imp, i) => (
                    <div key={i} className="border-l-2 border-primary/40 pl-2">
                      <p className="text-[10px] font-semibold text-primary">{imp.area}</p>
                      <p className="text-[10px] text-red-400/80 line-through">{imp.issue}</p>
                      <p className="text-[10px] text-green-400">{imp.fix}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {improveResult.revisedDescription && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Revised Design</p>
                <CopyButton text={improveResult.revisedDescription} />
              </div>
              <p className="text-xs text-foreground leading-relaxed">{improveResult.revisedDescription}</p>
            </div>
          )}

          {improveResult.colorFixes && improveResult.colorFixes.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Color Fixes</p>
              <div className="flex gap-2 flex-wrap">
                {improveResult.colorFixes.map((c, i) => (
                  <ColorSwatch key={i} hex={c.hex} name={c.name} role={c.replaces ? `replaces: ${c.replaces}` : undefined} />
                ))}
              </div>
            </div>
          )}

          {improveResult.nextSteps && improveResult.nextSteps.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Next Steps</p>
              <ol className="space-y-1">
                {improveResult.nextSteps.map((step, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-2">
                    <span className="text-primary font-bold shrink-0">{i + 1}.</span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {/* ── PALETTE RESULT ── */}
      {mode === "palette" && paletteResult && (
        <div className="space-y-2">
          <div className="bg-card border border-border rounded-xl p-3">
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-semibold text-sm">{paletteResult.name ?? "Color Palette"}</h4>
              {onUseColors && paletteResult.colors && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[10px] px-2"
                  onClick={() => onUseColors(paletteResult.colors!.map(c => c.hex))}
                >
                  Use All
                </Button>
              )}
            </div>
            {paletteResult.description && (
              <p className="text-xs text-muted-foreground mb-3">{paletteResult.description}</p>
            )}
            {paletteResult.colors && paletteResult.colors.length > 0 && (
              <>
                {/* Big swatch bar */}
                <div className="flex h-12 rounded-lg overflow-hidden mb-3 border border-white/10">
                  {paletteResult.colors.map((c, i) => (
                    <div
                      key={i}
                      className="flex-1"
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  ))}
                </div>
                <div className="flex gap-2 flex-wrap">
                  {paletteResult.colors.map((c, i) => (
                    <ColorSwatch key={i} hex={c.hex} name={c.name} role={c.role} />
                  ))}
                </div>
              </>
            )}
            {paletteResult.usage && (
              <p className="text-xs text-muted-foreground mt-3 italic">💡 {paletteResult.usage}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
