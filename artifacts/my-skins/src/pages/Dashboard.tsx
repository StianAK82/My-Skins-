import { useState, useRef, useEffect } from "react";
import { aiGenerateDesign, useGetDashboardSummary, useGetProjects } from "@workspace/api-client-react";
import type { Project } from "@workspace/api-client-react";
import { useLanguage } from "@/hooks/use-language";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Loader2, ArrowRight, Scissors, Layers,
  Trash2, Copy, MoreHorizontal, Plus, Wand2,
  Shirt, Package
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

const STYLE_PRESETS = [
  { id: "streetwear", label: "Streetwear", emoji: "🏙️" },
  { id: "anime", label: "Anime", emoji: "⭐" },
  { id: "sport", label: "Sport", emoji: "🏅" },
  { id: "cyberpunk", label: "Cyberpunk", emoji: "🌐" },
  { id: "minimal", label: "Minimal", emoji: "◻️" },
];

const CREATION_MODES = [
  { id: "ai", label: "AI Design", description: "Prompt-driven draft generation" },
  { id: "manual", label: "Build Manually", description: "Modular drag-and-build workflow" },
  { id: "template", label: "Start From Template", description: "Blank template with guides" },
  { id: "remix", label: "Remix Existing Design", description: "Pick an existing project to remix" },
] as const;

const AVATAR_OPTIONS = [
  { id: "neutral", label: "Neutral" },
  { id: "male", label: "Male" },
  { id: "female", label: "Female" },
] as const;

const BODY_TYPES = [
  { id: "slim", label: "Slim" },
  { id: "regular", label: "Regular" },
  { id: "athletic", label: "Athletic" },
] as const;

const ITEM_TYPES = [
  { id: "shirt",   label: "Shirt",   labelNo: "Skjorte",  emoji: "👕", roblox: "shirt" },
  { id: "pants",   label: "Pants",   labelNo: "Bukse",    emoji: "👖", roblox: "pants" },
  { id: "hoodie",  label: "Hoodie",  labelNo: "Genser",   emoji: "🧥", roblox: "shirt" },
  { id: "jacket",  label: "Jacket",  labelNo: "Jakke",    emoji: "🥼", roblox: "shirt" },
  { id: "uniform", label: "Uniform", labelNo: "Uniform",  emoji: "👔", roblox: "shirt" },
  { id: "tshirt",  label: "T-Shirt", labelNo: "T-Skjorte",emoji: "👕", roblox: "shirt" },
  { id: "suit",    label: "Suit",    labelNo: "Dress",    emoji: "🤵", roblox: "shirt" },
  { id: "vest",    label: "Vest",    labelNo: "Vest",     emoji: "🦺", roblox: "shirt" },
];

const EXAMPLE_PROMPTS_NO = [
  "svart hettegenser med flammetegninger og drager",
  "neon blå cyberpunk jakke med glødende kretser",
  "japansk anime-stil skjorte med kirsebærblomster",
  "grønn militær uniform med gull-detaljer",
  "minimalistisk hvit t-skjorte med svart stripemønster",
  "lilla fantasikappe med runer og magiske symboler",
];

const EXAMPLE_PROMPTS_EN = [
  "black hoodie with flame drawings and dragons",
  "neon blue cyberpunk jacket with glowing circuits",
  "Japanese anime-style shirt with cherry blossoms",
  "green military uniform with gold details",
  "minimalist white t-shirt with black stripe pattern",
  "purple fantasy robe with runes and magical symbols",
];

async function deleteProject(id: string) {
  const res = await fetch(`/api/projects/${id}`, { method: "DELETE", credentials: "include" });
  if (!res.ok) throw new Error("Delete failed");
  return res.json();
}

async function createBlankProject(type: "shirt" | "pants", title: string) {
  const res = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ title, type }),
  });
  if (!res.ok) throw new Error("Failed to create project");
  return res.json();
}

export default function Dashboard() {
  const { t, language } = useLanguage();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [prompt, setPrompt] = useState("");
  const [creationMode, setCreationMode] = useState<(typeof CREATION_MODES)[number]["id"]>("ai");
  const [selectedType, setSelectedType] = useState("shirt");
  const [selectedStyle, setSelectedStyle] = useState("");
  const [avatarType, setAvatarType] = useState<(typeof AVATAR_OPTIONS)[number]["id"]>("neutral");
  const [bodyType, setBodyType] = useState<(typeof BODY_TYPES)[number]["id"]>("regular");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingStep, setGeneratingStep] = useState("");
  const [failedStep, setFailedStep] = useState("");
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: summary } = useGetDashboardSummary();
  const { data: projectsData, isLoading: projectsLoading, refetch: refetchProjects } = useGetProjects({ limit: 12 });

  const examples = language === "no" ? EXAMPLE_PROMPTS_NO : EXAMPLE_PROMPTS_EN;
  const currentItemType = ITEM_TYPES.find(t => t.id === selectedType) ?? ITEM_TYPES[0];

  // Cycle placeholder examples
  useEffect(() => {
    const timer = setInterval(() => {
      setPlaceholderIdx(i => (i + 1) % examples.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [examples.length]);

  const navigateToEditorWorkspace = async (projectId: string) => {
    const targetPath = `/editor/${projectId}`;

    try {
      setLocation(targetPath);
      await Promise.resolve();

      const currentPath = window.location.pathname;
      const landedInEditor = currentPath === targetPath || currentPath.endsWith(targetPath);
      if (landedInEditor) return;

      toast({
        title: language === "no" ? "Kunne ikke åpne editor" : "Could not open editor",
        description: language === "no"
          ? "Prøver en direkte videresending nå."
          : "Trying a direct redirect now.",
        variant: "destructive",
      });
      window.location.assign(targetPath);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Navigation failed";
      toast({
        title: language === "no" ? "Navigasjon feilet" : "Navigation failed",
        description: message,
        variant: "destructive",
      });
      window.location.assign(targetPath);
    }
  };

  const handleAiCreate = async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    setFailedStep("");

    try {
      const normalizedStyle = selectedStyle
        ? `${selectedStyle.charAt(0).toUpperCase()}${selectedStyle.slice(1)}`
        : undefined;
      const aiTarget = currentItemType.roblox === "pants" ? "classic_pants" : "classic_shirt";

      setGeneratingStep("Creating concept...");
      const generated = await aiGenerateDesign({ prompt: prompt.trim(), itemType: aiTarget, style: normalizedStyle, theme: normalizedStyle });
      if (generated.meta.status !== "completed") {
        throw new Error(`AI generation returned status: ${generated.meta.status}`);
      }
      console.info("dashboard.ai.step.concept.completed", { prompt: prompt.trim(), aiTarget, normalizedStyle });

      setGeneratingStep("Generating visuals...");
      const result = await createBlankProject(currentItemType.roblox as "shirt" | "pants", prompt.trim().slice(0, 60));
      console.info("dashboard.ai.step.visuals.completed", { projectId: result.id });

      setGeneratingStep("Applying to canvas...");
      sessionStorage.setItem(`my-skins:pending-ai:${result.id}`, JSON.stringify({
        ...generated,
        avatar: { avatarType, bodyType },
        creationMode,
      }));
      console.info("dashboard.ai.step.apply.queued", { projectId: result.id });

      setGeneratingStep("Done");
      await navigateToEditorWorkspace(result.id);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "AI creation failed";
      setFailedStep(generatingStep || "Creating concept...");
      console.error("dashboard.ai.pipeline.failed", { step: generatingStep || "unknown", message });
      toast({ title: language === "no" ? "Feil" : "Error", description: message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
      setGeneratingStep("");
    }
  };

  const handleCreateByMode = async () => {
    try {
      if (creationMode === "ai") {
        await handleAiCreate();
        return;
      }

      if (creationMode === "remix") {
        const existing = projects[0];
        if (!existing) {
          toast({ title: "No projects to remix", description: "Create at least one design first.", variant: "destructive" });
          return;
        }
        await navigateToEditorWorkspace(existing.id);
        return;
      }

      const targetType = currentItemType.roblox as "shirt" | "pants";
      const title = creationMode === "manual"
        ? `Manual ${currentItemType.label}`
        : `Template ${currentItemType.label}`;
      const project = await createBlankProject(targetType, title);
      sessionStorage.setItem(`my-skins:editor-meta:${project.id}`, JSON.stringify({
        avatar: { avatarType, bodyType },
        creationMode,
        stylePreset: selectedStyle || null,
      }));
      await navigateToEditorWorkspace(project.id);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Project creation failed";
      toast({
        title: language === "no" ? "Feil" : "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  const handleBlankCreate = async (type: "shirt" | "pants") => {
    try {
      const label = type === "shirt"
        ? (language === "no" ? "Ny Skjorte" : "New Shirt")
        : (language === "no" ? "Ny Bukse" : "New Pants");
      const project = await createBlankProject(type, label);
      await navigateToEditorWorkspace(project.id);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not create project";
      toast({ title: language === "no" ? "Feil" : "Error", description: message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await deleteProject(id);
      refetchProjects();
      toast({ title: language === "no" ? "Slettet" : "Deleted" });
    } catch {
      toast({ title: language === "no" ? "Feil" : "Error", variant: "destructive" });
    }
  };

  const projects: Project[] = projectsData?.projects ?? [];

  return (
    <div className="min-h-screen bg-background">
      {/* AI Creator Hero */}
      <div className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background pointer-events-none" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/3 rounded-full blur-3xl pointer-events-none" />

        <div className="relative container mx-auto px-4 py-10 max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex items-center gap-2 text-primary mb-3">
              <Sparkles className="w-5 h-5" />
              <span className="text-sm font-semibold uppercase tracking-widest">
                {language === "no" ? "Prosjektinngang" : "Project entry"}
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-bold mb-2 leading-tight">
              {language === "no"
                ? "Start her, bygg i editoren"
                : "Start here, build in the editor"}
            </h1>
            <p className="text-muted-foreground mb-8">
              {language === "no"
                ? "Dashboarden er inngangssiden. Selve creator studio med live avatar åpnes direkte i /editor/:id."
                : "The dashboard is the entry page. The real creator studio with live avatar opens directly in /editor/:id."}
            </p>

            <div className="mb-5 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-primary/15 text-primary px-2 py-1 font-semibold">
                  {language === "no" ? "1. Dashboard-oppsett" : "1. Dashboard setup"}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="rounded-full bg-background border border-border px-2 py-1 text-foreground font-medium">
                  {language === "no" ? "2. Editor workspace (live 3D-preview)" : "2. Editor workspace (live 3D preview)"}
                </span>
              </div>
            </div>

            {/* Creation mode selector */}
            <div className="mb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                Creation mode
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {CREATION_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setCreationMode(mode.id)}
                    className={`text-left rounded-lg border px-3 py-2 transition-all ${
                      creationMode === mode.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <p className="text-sm font-semibold">{mode.label}</p>
                    <p className="text-xs text-muted-foreground">{mode.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Avatar and body selectors */}
            <div className="mb-4 grid md:grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Avatar</p>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_OPTIONS.map((avatar) => (
                    <button
                      key={avatar.id}
                      onClick={() => setAvatarType(avatar.id)}
                      className={`px-3 py-1.5 rounded-full border text-sm ${avatarType === avatar.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                    >
                      {avatar.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Body type</p>
                <div className="flex flex-wrap gap-2">
                  {BODY_TYPES.map((body) => (
                    <button
                      key={body.id}
                      onClick={() => setBodyType(body.id)}
                      className={`px-3 py-1.5 rounded-full border text-sm ${bodyType === body.id ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                    >
                      {body.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mb-4 rounded-lg border border-border bg-card/70 px-3 py-2 text-xs text-muted-foreground">
              {language === "no"
                ? "Tips: Avatar-valgene over brukes når editoren åpnes. Selve 3D-avatarforhåndsvisningen er i editor workspace."
                : "Tip: Avatar choices above are applied when the editor opens. The actual live 3D avatar preview is in the editor workspace."}
            </div>

            {/* Item type selector */}
            <div className="mb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                {language === "no" ? "Type gjenstand" : "Item type"}
              </p>
              <div className="flex flex-wrap gap-2">
                {ITEM_TYPES.map(item => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedType(item.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium transition-all ${
                      selectedType === item.id
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    <span>{item.emoji}</span>
                    {language === "no" ? item.labelNo : item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Style presets */}
            <div className="mb-5">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                {language === "no" ? "Stil (valgfritt)" : "Style (optional)"}
              </p>
              <div className="flex flex-wrap gap-2">
                {STYLE_PRESETS.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedStyle(prev => prev === s.id ? "" : s.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm transition-all ${
                      selectedStyle === s.id
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    <span>{s.emoji}</span>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Prompt area */}
            <div className="relative rounded-2xl border border-border bg-card/80 backdrop-blur shadow-xl overflow-hidden focus-within:border-primary/60 transition-colors">
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleAiCreate();
                }}
                rows={3}
                className="w-full bg-transparent px-5 pt-4 pb-2 text-base resize-none outline-none placeholder:text-muted-foreground/50 leading-relaxed"
                placeholder={examples[placeholderIdx]}
                disabled={isGenerating || creationMode !== "ai"}
              />

              <div className="flex items-center justify-between px-5 pb-4 pt-1">
                <div className="text-xs text-muted-foreground">
                  {language === "no"
                    ? `Lager ${currentItemType.labelNo.toLowerCase()}${selectedStyle ? ` · ${selectedStyle}` : ""}`
                    : `Creating ${currentItemType.label.toLowerCase()}${selectedStyle ? ` · ${selectedStyle}` : ""}`}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground hidden sm:block">
                    {language === "no" ? "Ctrl+Enter for å lage" : "Ctrl+Enter to create"}
                  </span>
                  <Button
                    onClick={handleCreateByMode}
                    disabled={isGenerating || (creationMode === "ai" && !prompt.trim())}
                    className="gap-2 px-6"
                    size="sm"
                  >
                    {isGenerating ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />{language === "no" ? "Lager..." : "Creating..."}</>
                    ) : (
                      <><Sparkles className="w-4 h-4" />{creationMode === "ai" ? (language === "no" ? "Opprett og åpne editor" : "Create & open editor") : (language === "no" ? "Fortsett til editor workspace" : "Continue to editor workspace")}</>
                    )}
                  </Button>
                </div>
              </div>

              {/* Generating progress */}
              <AnimatePresence>
                {(isGenerating && generatingStep) || failedStep ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="border-t border-border/50 bg-primary/5 px-5 py-2"
                  >
                    <div className="flex items-center gap-2 text-sm text-primary">
                      {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <Sparkles className="w-3.5 h-3.5 shrink-0" />}
                      {generatingStep || "Generation failed"}
                    </div>
                    {failedStep && (
                      <div className="text-xs text-destructive mt-1">Failed step: {failedStep}</div>
                    )}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            {/* Example prompts */}
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="text-xs text-muted-foreground py-1">
                {language === "no" ? "Prøv:" : "Try:"}
              </span>
              {examples.slice(0, 3).map((ex, i) => (
                <button
                  key={i}
                  onClick={() => setPrompt(ex)}
                  className="text-xs text-muted-foreground hover:text-foreground border border-border/50 hover:border-border rounded-full px-3 py-1 transition-colors truncate max-w-[200px]"
                >
                  {ex}
                </button>
              ))}
            </div>

            {/* Divider + quick blank actions */}
            <div className="flex items-center gap-4 mt-6">
              <div className="flex-1 h-px bg-border/50" />
              <span className="text-xs text-muted-foreground">
                {language === "no" ? "eller start med tom plate" : "or start blank"}
              </span>
              <div className="flex-1 h-px bg-border/50" />
            </div>
            <div className="flex gap-3 mt-4">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => handleBlankCreate("shirt")}
              >
                <Plus className="w-3.5 h-3.5" />
                {language === "no" ? "Tom Skjorte → Editor" : "Blank Shirt → Editor"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => handleBlankCreate("pants")}
              >
                <Plus className="w-3.5 h-3.5" />
                {language === "no" ? "Tom Bukse → Editor" : "Blank Pants → Editor"}
              </Button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Stats bar */}
      {summary && (
        <div className="border-b border-border/50 bg-card/30">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="flex gap-8 py-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{language === "no" ? "Prosjekter" : "Projects"}</span>
                <span className="font-bold text-foreground">{summary.totalProjects ?? 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{language === "no" ? "Eksporter" : "Exports"}</span>
                <span className="font-bold text-foreground">{summary.totalExports ?? 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <Wand2 className="w-3.5 h-3.5 text-primary" />
                <span className="text-muted-foreground">AI</span>
                <span className="font-bold text-primary">{summary.aiGenerations ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Projects grid */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">
            {language === "no" ? "Dine prosjekter (åpner editor)" : "Your projects (opens editor)"}
          </h2>
          <Link href="/projects" className="text-sm text-primary hover:underline flex items-center gap-1">
            {language === "no" ? "Se alle" : "See all"}
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {projectsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="aspect-square rounded-xl bg-card border border-border animate-pulse" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-16 border border-dashed border-border rounded-2xl bg-card/30"
          >
            <Sparkles className="w-10 h-10 text-primary/40 mx-auto mb-4" />
            <h3 className="font-semibold text-lg mb-1">
              {language === "no" ? "Ingen prosjekter ennå" : "No projects yet"}
            </h3>
            <p className="text-muted-foreground text-sm">
              {language === "no"
                ? "Beskriv noe ovenfor og la AI lage ditt første design!"
                : "Describe something above and let AI create your first design!"}
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {projects.map((project: Project, i: number) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.04 }}
                className="group relative"
              >
                <Link href={`/editor/${project.id}`}>
                  <div className="rounded-xl bg-card border border-border overflow-hidden hover:border-primary/50 transition-all hover:shadow-lg hover:shadow-primary/5 cursor-pointer">
                    {/* Thumbnail */}
                    <div className="aspect-square bg-muted/30 relative overflow-hidden">
                      {project.thumbnailUrl ? (
                        <img
                          src={project.thumbnailUrl}
                          alt={project.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                          {project.isAiGenerated ? (
                            <Sparkles className="w-8 h-8 opacity-30 text-primary" />
                          ) : project.type === "shirt" ? (
                            <Scissors className="w-8 h-8 opacity-20" />
                          ) : (
                            <Layers className="w-8 h-8 opacity-20" />
                          )}
                          {project.isAiGenerated && (
                            <span className="text-[9px] text-primary/50 uppercase tracking-widest">AI</span>
                          )}
                        </div>
                      )}

                      {/* Badges */}
                      <div className="absolute top-2 left-2 flex gap-1">
                        {project.isAiGenerated && (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold bg-primary/90 text-background rounded uppercase tracking-wide">
                            AI
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 text-[9px] font-medium bg-background/80 backdrop-blur rounded text-foreground uppercase tracking-wide">
                          {project.type}
                        </span>
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-3">
                      <h3 className="font-medium text-sm truncate group-hover:text-primary transition-colors mb-0.5">
                        {project.title}
                      </h3>
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(project.updatedAt), "d MMM yyyy")}
                      </p>
                    </div>
                  </div>
                </Link>

                {/* Context menu */}
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="w-7 h-7 rounded-lg bg-background/90 backdrop-blur flex items-center justify-center text-muted-foreground hover:text-foreground border border-border/50"
                        onClick={e => e.preventDefault()}
                      >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36">
                      <DropdownMenuItem asChild>
                        <Link href={`/editor/${project.id}`}>
                          <Wand2 className="w-3.5 h-3.5 mr-2" />
                          {language === "no" ? "Åpne i editor" : "Open in editor"}
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={e => handleDelete(project.id, e as unknown as React.MouseEvent)}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-2" />
                        {language === "no" ? "Slett" : "Delete"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
