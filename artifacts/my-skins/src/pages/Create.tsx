import { useCallback, useState } from "react";
import { Download, Loader2, RotateCw, Save, Sparkles, Upload } from "lucide-react";
import { AvatarPreview } from "@/components/editor/AvatarPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API_BASE = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`;
type Blueprint = { theme: string; completeLook: string; top: { type: string }; bottom: { type: string }; footwear: { type: string } };
type OutfitResult = {
  preview: { shirtTexture: string; pantsTexture: string };
  outfitBlueprint: Blueprint;
  components: { shirtTexture: string; pantsTexture: string; footwearPreview: { support: string }; accessories: unknown[] };
  export: { robloxItemCount: number };
};

function downloadPart(dataUrl: string, name: string) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `my-skins-${name}-585x559.png`;
  link.click();
}

export default function Create() {
  const [prompt, setPrompt] = useState("");
  const [result, setResult] = useState<OutfitResult | null>(null);
  const [view, setView] = useState<"front" | "back">("front");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const generate = useCallback(async () => {
    if (loading || prompt.trim().length < 3) return;
    setLoading(true); setMessage("");
    try {
      const response = await fetch(`${API_BASE}/ai/complete-outfit`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: prompt.trim() }) });
      const data = await response.json() as OutfitResult & { error?: string };
      if (!response.ok || !data.components?.shirtTexture || !data.components?.pantsTexture) throw new Error(data.error);
      setResult(data); setView("front");
    } catch { setMessage("AI couldn't finish that skin. Try again!"); }
    finally { setLoading(false); }
  }, [loading, prompt]);

  const download = () => {
    if (!result) return;
    downloadPart(result.components.shirtTexture, "top");
    setTimeout(() => downloadPart(result.components.pantsTexture, "bottom"), 150);
    setMessage("Your complete skin includes two ready-to-upload clothing files. Shoes and extras are included in the preview.");
  };
  const save = () => {
    if (!result) return;
    localStorage.setItem("my-skins-saved-outfit", JSON.stringify({ prompt, result }));
    setMessage("Skin saved on this device!");
  };
  const upload = () => result && setMessage(`This skin contains ${result.export.robloxItemCount} Roblox clothing items. We'll guide you through uploading both together.`);

  return <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
    <div className="mx-auto flex max-w-4xl flex-col gap-7">
      <header className="text-center"><h1 className="text-4xl font-bold tracking-tight">My Skins AI</h1><p className="mt-2 text-slate-300">Describe your skin. AI creates the complete outfit.</p></header>
      <section className="rounded-3xl border border-violet-500/30 bg-slate-900/80 p-5 shadow-2xl shadow-violet-950/30">
        <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); void generate(); }}>
          <label className="block text-lg font-semibold" htmlFor="skin-prompt">Describe your skin</label>
          <div className="flex flex-col gap-3 sm:flex-row"><Input id="skin-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} disabled={loading} maxLength={600} className="h-14 bg-slate-950 text-base" placeholder="White hoodie skin" /><Button className="h-14 px-8 text-base" type="submit" disabled={loading || prompt.trim().length < 3}>{loading ? <Loader2 className="mr-2 animate-spin" /> : <Sparkles className="mr-2" />}Create Skin</Button></div>
          <div className="flex flex-wrap gap-2 text-sm text-slate-400" aria-label="Prompt examples">{["White hoodie skin", "Pink anime outfit", "Black fire skin", "Blue football skin"].map((example) => <button type="button" key={example} className="rounded-full bg-slate-800 px-3 py-1 hover:bg-slate-700" onClick={() => setPrompt(example)}>{example}</button>)}</div>
        </form>
      </section>
      <section className="relative h-[540px] overflow-hidden rounded-3xl border border-slate-800 bg-slate-900" aria-label="Complete outfit preview">
        <AvatarPreview shirtTextureUrl={result?.components.shirtTexture} pantsTextureUrl={result?.components.pantsTexture} view={view} onViewChange={setView} previewMode="avatar" studioMode animated />
        {loading && <div className="absolute inset-0 grid place-content-center bg-slate-950/75 text-center"><Loader2 className="mx-auto mb-3 h-10 w-10 animate-spin text-violet-400" /><strong>Creating your whole outfit…</strong><span className="mt-1 text-sm text-slate-300">Top, bottoms, shoes and finishing touches</span></div>}
        {result && <div className="absolute left-4 top-4 rounded-full bg-black/60 px-4 py-2 text-sm backdrop-blur">✨ {result.outfitBlueprint.completeLook}</div>}
      </section>
      <div className="flex flex-wrap justify-center gap-3"><Button variant="outline" onClick={() => setView(view === "front" ? "back" : "front")}><RotateCw className="mr-2" />{view === "front" ? "Show Back" : "Show Front"}</Button><Button variant="outline" onClick={() => void generate()} disabled={!result || loading}><Sparkles className="mr-2" />Try Again</Button><Button onClick={download} disabled={!result}><Download className="mr-2" />Download Skin</Button><Button variant="outline" onClick={save} disabled={!result}><Save className="mr-2" />Save Skin</Button><Button variant="outline" onClick={upload} disabled={!result}><Upload className="mr-2" />Upload to Roblox</Button></div>
      {message && <p role="status" className="text-center text-sm text-slate-300">{message}</p>}
    </div>
  </main>;
}
