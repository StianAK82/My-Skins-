import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, Loader2, RotateCw, Save, Sparkles } from "lucide-react";
import { AvatarPreview } from "@/components/editor/AvatarPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requestOutfitSpec, type GenerateOutfitSpecResponse, type GenerationState, type OutfitSpecApiError } from "@/lib/outfit-spec-api";
import { resolveGarmentManifest } from "@/lib/editor/garment-resolver";
import type { GarmentManifest } from "@/lib/editor/garment-manifest";
import { buildAiAvatarLook } from "@/lib/editor/avatar-look";
import { defaultAvatarState } from "@/lib/editor/design-state";

function downloadPart(dataUrl: string, name: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `my-skins-${name}-585x559.png`;
  link.click();
}

export default function Create() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<GenerateOutfitSpecResponse | null>(null);
  const [generationState,setGenerationState]=useState<GenerationState>("idle");
  const [errorCode,setErrorCode]=useState<string | null>(null);
  const [manifest, setManifest] = useState<GarmentManifest | null>(null);
  const [avatarLook, setAvatarLook] = useState(defaultAvatarState);
  const [view, setView] = useState<"front" | "back">("front");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [progress, setProgress] = useState("Planning your skin…");
  const [revision, setRevision] = useState("");
  const requestRef = useRef<{ id: number; controller: AbortController } | null>(null);
  const requestSequence = useRef(0);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!loading) return;
    const started = Date.now();
    const timer = window.setInterval(() => {
      const seconds = Math.floor((Date.now() - started) / 1000);
      setElapsedSeconds(seconds);
      setProgress(seconds < 5 ? "Planning your skin…" : seconds < 75 ? "Creating the top…" : seconds < 150 ? "Creating the bottoms…" : "Building the preview…");
    }, 1000);
    return () => window.clearInterval(timer);
  }, [loading]);

  useEffect(() => () => requestRef.current?.controller.abort(), []);

  const generate = useCallback(async () => {
    if (busyRef.current || prompt.trim().length < 3) return;
    requestRef.current?.controller.abort();
    const id = ++requestSequence.current;
    const controller = new AbortController();
    requestRef.current = { id, controller };
    busyRef.current = true;
    setLoading(true); setGenerationState("understanding"); setErrorCode(null); setMessage(""); setElapsedSeconds(0); setProgress("Planning your skin…");
    try {
      setGenerationState("generating");
      const data = await requestOutfitSpec(prompt.trim(), controller.signal);
      setGenerationState("validating");
      if (requestRef.current?.id !== id) return;
      setGenerationState("compiling"); setProgress("Building the preview…");
      setResult(data); setView("front");
      setManifest(null);
      const palette = data.outfitSpec.palette;
      const look = buildAiAvatarLook(prompt.trim(), palette);
      setAvatarLook({ ...defaultAvatarState(), ...look, slots: { ...defaultAvatarState().slots, ...(look.slots ?? {}) } });
      setGenerationState("ready");
    } catch (caught) {
      if (controller.signal.aborted || requestRef.current?.id !== id) return;
      const error = caught as OutfitSpecApiError; setErrorCode(error.code); setGenerationState("failed");
      console.error("Outfit generation failed",{code:error.code,stage:error.stage,requestId:error.requestId,generationId:error.generationId,error});
      const messages:Record<string,string>={SAFETY_BLOCKED:"That request cannot be generated safely.",MODEL_CONFIGURATION_ERROR:"Outfit generation is not configured. Please contact support.",MODEL_TIMEOUT:"Generation timed out. You can retry.",SCHEMA_REPAIR_FAILED:"The AI response could not be validated. Please retry.",CLIENT_RESPONSE_INVALID:"The server response was incompatible. Please retry."};
      setMessage(messages[error.code]??"The outfit service could not complete your request. Please retry.");
    } finally {
      if (requestRef.current?.id === id) {
        busyRef.current = false;
        setLoading(false);
      }
    }
  }, [prompt]);

  const download = () => {
    if (!result) return;
    result.classicExports.forEach((part,index)=>setTimeout(()=>downloadPart(part.url,part.type),index*150));
    setMessage("Your Classic Shirt is ready to upload.");
  };
  const save = () => {
    if (!result) return;
    localStorage.setItem("my-skins-saved-outfit", JSON.stringify({ prompt, result }));
    setMessage("Skin saved on this device!");
  };
  const revise = (instruction: string) => {
    if (!result || !instruction.trim()) return;
    setPrompt(`${prompt}. Keep the approved outfit details and ${instruction.trim()}`);
    setRevision("");
    window.setTimeout(() => document.querySelector<HTMLButtonElement>('[data-generate]')?.click(), 0);
  };

  return <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
    <div className="mx-auto flex max-w-4xl flex-col gap-7">
      <header className="text-center"><h1 className="text-4xl font-bold tracking-tight">My Skins AI</h1><p className="mt-2 text-slate-300">Describe your skin. AI creates the complete outfit.</p></header>
      <section className="rounded-3xl border border-violet-500/30 bg-slate-900/80 p-5 shadow-2xl shadow-violet-950/30">
        <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void generate(); }}>
          <label className="block text-lg font-semibold" htmlFor="skin-prompt">Describe your skin</label>
          <div className="flex flex-col gap-3 sm:flex-row"><Input id="skin-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} disabled={loading} maxLength={600} className="h-14 bg-slate-950 text-base" placeholder="Lag en hvit hettegenser" /><Button data-generate className="h-14 px-8 text-base" type="submit" disabled={loading || prompt.trim().length < 3}>{loading ? <Loader2 className="mr-2 animate-spin" /> : <Sparkles className="mr-2" />}Create</Button></div>
          <div className="flex flex-wrap gap-2 text-sm text-slate-400" aria-label="Prompt examples">{["White hoodie skin", "Black T-shirt and blue jeans", "Red football uniform number 10", "Pink princess outfit", "Green cargo outfit", "Knight armour outfit"].map((example) => <button type="button" key={example} className="rounded-full bg-slate-800 px-3 py-1 hover:bg-slate-700" onClick={() => setPrompt(example)}>{example}</button>)}</div>
        </form>
      </section>
      <section className="relative h-[540px] overflow-hidden rounded-3xl border border-slate-800 bg-slate-900" aria-label="Complete outfit preview">
        <AvatarPreview shirtTextureUrl={result?.classicExports.find(part=>part.type==="shirt")?.url} garmentManifest={manifest ?? undefined} hoodieSpec={result?.outfitSpec.top} avatarState={avatarLook} view={view} onViewChange={setView} previewMode="avatar" studioMode animated />
        {loading && <div className="absolute inset-0 grid place-content-center bg-slate-950/75 text-center" role="status"><Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-violet-400" /><strong>{progress}</strong><span className="mt-1 text-sm text-slate-300">Elapsed time: {elapsedSeconds}s</span></div>}
        {result && <><div className="absolute left-4 top-4 rounded-full bg-black/60 px-4 py-2 text-sm backdrop-blur">✨ AI Generated · {result.outfitSpec.outfitName}</div><div className="absolute bottom-4 left-4 rounded-full bg-emerald-950/90 px-4 py-2 text-sm text-emerald-200"><CheckCircle2 className="mr-1 inline h-4 w-4"/>PNG checks passed · Enhanced preview available</div></>}
      </section>
      <div className="flex flex-wrap justify-center gap-3"><Button variant="outline" onClick={() => setView(view === "front" ? "back" : "front")}><RotateCw className="mr-2" />{view === "front" ? "Show Back" : "Show Front"}</Button><Button variant="outline" onClick={() => void generate()} disabled={loading || prompt.trim().length < 3}><Sparkles className="mr-2" />Try Again</Button><Button onClick={download} disabled={!result}><Download className="mr-2" />Download PNG files</Button><Button variant="outline" onClick={save} disabled={!result}><Save className="mr-2" />Save</Button></div>
      {result && <section className="grid gap-5 rounded-3xl border border-slate-800 bg-slate-900 p-5 md:grid-cols-2">
        <div><h2 className="text-xl font-bold">Change something</h2><p className="mt-1 text-sm text-slate-400">Ask AI for one change. Everything else stays.</p><div className="mt-3 flex gap-2"><Input aria-label="Ask for an outfit change" value={revision} onChange={e=>setRevision(e.target.value)} placeholder="Make the hood bigger"/><Button onClick={()=>revise(revision)} disabled={!revision.trim()}>Change</Button></div><div className="mt-3 flex flex-wrap gap-2">{["Make it blue","Add stars","Bigger hood","More colourful"].map(action=><button key={action} onClick={()=>revise(action)} className="min-h-11 rounded-full bg-violet-950 px-3 text-sm text-violet-100 hover:bg-violet-900">{action}</button>)}</div></div>
        <div><h2 className="text-xl font-bold">Roblox Classic files</h2><div className="mt-3 flex gap-3"><figure className="min-w-0 flex-1"><img className="aspect-square w-full rounded-xl bg-slate-800 object-contain" src={result.classicExports.find(part=>part.type==="shirt")?.url} alt="Classic Shirt texture"/><figcaption className="mt-1 text-center text-sm">Classic Shirt</figcaption></figure></div></div>
        <p className="text-sm text-slate-300 md:col-span-2">Enhanced Preview shows the AI-designed 3D outfit shape. Roblox Classic downloads contain the compatible shirt and pants textures.</p>
        <aside className="rounded-xl bg-slate-950 p-4 text-sm md:col-span-2"><strong>Upload with a parent</strong><p className="mt-1 text-slate-400">Download the PNG files, then use Roblox Creator Hub to upload each one as Classic Clothing. Direct upload is not connected, so My Skins will never ask for or store your Roblox password.</p></aside>
      </section>}
      {message && <p role="alert" data-error-code={errorCode??undefined} className="text-center text-sm text-slate-300">{message}</p>}<output className="sr-only" data-generation-state={generationState}>{generationState}</output>
    </div>
  </main>;
}
