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
import { AvatarPreview } from "@/components/editor/AvatarPreview";
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
    <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 64px)" }}>

      {/* ── LEFT PANEL: Configuration ──────────────────────────────── */}
      <aside className="w-[252px] shrink-0 border-r border-white/8 bg-[#0b1120] overflow-y-auto flex flex-col text-white">
        <div className="p-4 border-b border-white/8 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold uppercase tracking-widest text-white/50">
            {language === "no" ? "Ny design" : "New Design"}
          </span>
        </div>

        <div className="p-3 space-y-4 flex-1">
          {/* Creation mode */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
              {language === "no" ? "Modus" : "Mode"}
            </p>
            <div className="grid grid-cols-2 gap-1">
              {CREATION_MODES.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => setCreationMode(mode.id)}
                  className={`text-left rounded-lg border px-2 py-1.5 transition-all text-[11px] leading-tight ${
                    creationMode === mode.id
                      ? "border-indigo-500 bg-indigo-600/20 text-indigo-200"
                      : "border-white/10 text-white/40 hover:border-white/20 hover:text-white/70"
                  }`}
                >
                  <p className="font-semibold">{mode.label}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Avatar type */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Avatar</p>
            <div className="flex flex-wrap gap-1">
              {AVATAR_OPTIONS.map((avatar) => (
                <button
                  key={avatar.id}
                  onClick={() => setAvatarType(avatar.id)}
                  className={`px-2.5 py-1 rounded-full border text-[11px] transition-all ${
                    avatarType === avatar.id
                      ? "border-indigo-500 bg-indigo-600/20 text-indigo-200"
                      : "border-white/10 text-white/40 hover:text-white/70"
                  }`}
                >
                  {avatar.label}
                </button>
              ))}
            </div>
          </div>

          {/* Body type */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
              {language === "no" ? "Kroppsbygning" : "Body"}
            </p>
            <div className="flex flex-wrap gap-1">
              {BODY_TYPES.map((body) => (
                <button
                  key={body.id}
                  onClick={() => setBodyType(body.id)}
                  className={`px-2.5 py-1 rounded-full border text-[11px] transition-all ${
                    bodyType === body.id
                      ? "border-indigo-500 bg-indigo-600/20 text-indigo-200"
                      : "border-white/10 text-white/40 hover:text-white/70"
                  }`}
                >
                  {body.label}
                </button>
              ))}
            </div>
          </div>

          {/* Item type */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
              {language === "no" ? "Type" : "Item"}
            </p>
            <div className="flex flex-wrap gap-1">
              {ITEM_TYPES.map(item => (
                <button
                  key={item.id}
                  onClick={() => setSelectedType(item.id)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] transition-all ${
                    selectedType === item.id
                      ? "border-indigo-500 bg-indigo-600/20 text-indigo-200"
                      : "border-white/10 text-white/40 hover:border-white/20 hover:text-white/70"
                  }`}
                >
                  <span>{item.emoji}</span>
                  {language === "no" ? item.labelNo : item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Style */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
              {language === "no" ? "Stil" : "Style"}
            </p>
            <div className="flex flex-wrap gap-1">
              {STYLE_PRESETS.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSelectedStyle(prev => prev === s.id ? "" : s.id)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] transition-all ${
                    selectedStyle === s.id
                      ? "border-indigo-500 bg-indigo-600/20 text-indigo-200 font-semibold"
                      : "border-white/10 text-white/40 hover:text-white/70"
                  }`}
                >
                  <span>{s.emoji}</span>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Blank start buttons */}
          <div className="pt-1 border-t border-white/8 space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
              {language === "no" ? "Start blank" : "Start blank"}
            </p>
            <button
              onClick={() => handleBlankCreate("shirt")}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 text-white/50 hover:text-white hover:border-white/20 text-[11px] transition-all text-left"
            >
              <Plus className="w-3 h-3" />
              {language === "no" ? "Tom Skjorte" : "Blank Shirt"}
            </button>
            <button
              onClick={() => handleBlankCreate("pants")}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-white/10 text-white/50 hover:text-white hover:border-white/20 text-[11px] transition-all text-left"
            >
              <Plus className="w-3 h-3" />
              {language === "no" ? "Tom Bukse" : "Blank Pants"}
            </button>
          </div>

          {/* Recent projects */}
          {projects.length > 0 && (
            <div className="pt-1 border-t border-white/8 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
                  {language === "no" ? "Siste" : "Recent"}
                </p>
                <Link href="/projects" className="text-[10px] text-indigo-400 hover:text-indigo-300">
                  {language === "no" ? "Se alle" : "See all"}
                </Link>
              </div>
              <div className="space-y-1">
                {projects.slice(0, 5).map((project: Project) => (
                  <div key={project.id} className="group flex items-center gap-2">
                    <Link href={`/editor/${project.id}`} className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-white/5 transition-colors min-w-0">
                      <div className="w-6 h-6 rounded bg-white/5 border border-white/10 shrink-0 overflow-hidden">
                        {project.thumbnailUrl ? (
                          <img src={project.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            {project.type === "shirt" ? <Scissors className="w-3 h-3 text-white/20" /> : <Layers className="w-3 h-3 text-white/20" />}
                          </div>
                        )}
                      </div>
                      <span className="text-[11px] text-white/50 truncate group-hover:text-white/80 transition-colors">{project.title}</span>
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center text-white/30 hover:text-white transition-all shrink-0">
                          <MoreHorizontal className="w-3 h-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-32">
                        <DropdownMenuItem asChild>
                          <Link href={`/editor/${project.id}`}>
                            <Wand2 className="w-3 h-3 mr-2" />
                            {language === "no" ? "Åpne" : "Open"}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={e => handleDelete(project.id, e as unknown as React.MouseEvent)}
                        >
                          <Trash2 className="w-3 h-3 mr-2" />
                          {language === "no" ? "Slett" : "Delete"}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ── CENTER: Live 3D Avatar Preview ─────────────────────────── */}
      <main className="flex-1 relative overflow-hidden bg-[#080e1a]">
        <AvatarPreview
          avatarType={avatarType}
          bodyType={bodyType}
          itemType={currentItemType.roblox as "shirt" | "pants"}
          previewMode="clothing"
          studioMode={true}
        />

        {/* Center overlay label */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-white/20">
            {language === "no" ? "Live forhåndsvisning" : "Live Preview"}
          </span>
        </div>
      </main>

      {/* ── RIGHT PANEL: AI Prompt + Create ────────────────────────── */}
      <aside className="w-[280px] shrink-0 border-l border-white/8 bg-[#0b1120] overflow-y-auto flex flex-col text-white">
        <div className="p-4 border-b border-white/8 flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold uppercase tracking-widest text-white/50">AI Studio</span>
        </div>

        <div className="flex-1 p-4 space-y-4">
          {/* Prompt */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
              {language === "no" ? "Beskriv designet ditt" : "Describe your design"}
            </p>
            <div className={`rounded-xl border bg-white/5 transition-colors overflow-hidden ${
              creationMode === "ai" ? "border-white/15 focus-within:border-indigo-500/60" : "border-white/5 opacity-50"
            }`}>
              <textarea
                ref={textareaRef}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleCreateByMode();
                }}
                rows={4}
                className="w-full bg-transparent px-4 pt-3 pb-2 text-sm resize-none outline-none placeholder:text-white/20 leading-relaxed text-white"
                placeholder={creationMode === "ai" ? examples[placeholderIdx] : (language === "no" ? "Velg 'AI Design' modus for å skrive prompt" : "Select 'AI Design' mode to write a prompt")}
                disabled={isGenerating || creationMode !== "ai"}
              />
              <div className="px-4 pb-3 text-[10px] text-white/25">
                {creationMode === "ai"
                  ? (language === "no" ? `Lager ${currentItemType.labelNo.toLowerCase()}${selectedStyle ? ` · ${selectedStyle}` : ""}` : `Creating ${currentItemType.label.toLowerCase()}${selectedStyle ? ` · ${selectedStyle}` : ""}`)
                  : (language === "no" ? `Modus: ${CREATION_MODES.find(m => m.id === creationMode)?.label}` : `Mode: ${CREATION_MODES.find(m => m.id === creationMode)?.label}`)}
              </div>
            </div>
          </div>

          {/* Example prompts */}
          {creationMode === "ai" && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
                {language === "no" ? "Prøv:" : "Try:"}
              </p>
              <div className="space-y-1">
                {examples.slice(0, 3).map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => setPrompt(ex)}
                    className="w-full text-left text-[11px] text-white/35 hover:text-white/70 border border-white/8 hover:border-white/15 rounded-lg px-3 py-2 transition-all leading-tight line-clamp-2"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Generate progress */}
          <AnimatePresence>
            {(isGenerating && generatingStep) || failedStep ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="rounded-lg border border-indigo-500/20 bg-indigo-600/10 px-4 py-3"
              >
                <div className="flex items-center gap-2 text-sm text-indigo-300">
                  {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" /> : <Sparkles className="w-3.5 h-3.5 shrink-0" />}
                  {generatingStep || (language === "no" ? "Generering feilet" : "Generation failed")}
                </div>
                {failedStep && (
                  <div className="text-xs text-red-400 mt-1">{language === "no" ? "Feilet:" : "Failed:"} {failedStep}</div>
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Create button */}
          <button
            onClick={handleCreateByMode}
            disabled={isGenerating || (creationMode === "ai" && !prompt.trim())}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all"
          >
            {isGenerating ? (
              <><Loader2 className="w-4 h-4 animate-spin" />{language === "no" ? "Lager..." : "Creating..."}</>
            ) : (
              <><Sparkles className="w-4 h-4" />{creationMode === "ai" ? (language === "no" ? "Generer og åpne editor" : "Generate & open editor") : (language === "no" ? "Åpne editor" : "Open editor")}</>
            )}
          </button>

          {/* Stats */}
          {summary && (
            <div className="pt-2 border-t border-white/8 flex gap-4 text-[11px]">
              <div className="flex items-center gap-1.5 text-white/30">
                <span>{language === "no" ? "Prosjekter:" : "Projects:"}</span>
                <span className="font-bold text-white/60">{summary.totalProjects ?? 0}</span>
              </div>
              <div className="flex items-center gap-1.5 text-white/30">
                <Wand2 className="w-3 h-3 text-indigo-400" />
                <span className="font-bold text-indigo-400">{summary.aiGenerations ?? 0}</span>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
