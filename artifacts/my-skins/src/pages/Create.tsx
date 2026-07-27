import { useCallback, useState } from "react";
import { Download, Loader2, RotateCw, Sparkles, Upload } from "lucide-react";
import { AvatarPreview } from "@/components/editor/AvatarPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API_BASE = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`;
type GarmentType = "shirt" | "pants";
type TextureResponse = { imageUrl: string; referenceUrl: string; prompt: string; model: string; requestMode: string };

function finalizeTexture(sourceUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 585;
      canvas.height = 559;
      const context = canvas.getContext("2d");
      if (!context) return reject(new Error("Canvas is unavailable"));
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.clearRect(0, 0, 585, 559);
      // Exactly one conversion from the high-quality model PNG to Roblox dimensions.
      context.drawImage(image, 0, 0, 585, 559);
      resolve(canvas.toDataURL("image/png"));
    };
    image.onerror = () => reject(new Error("The generated PNG could not be loaded"));
    image.src = sourceUrl;
  });
}

function downloadPng(dataUrl: string, garmentType: GarmentType) {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `my-skins-classic-${garmentType}-585x559.png`;
  link.click();
}

export default function Create() {
  const [garmentType, setGarmentType] = useState<GarmentType>("shirt");
  const [prompt, setPrompt] = useState("");
  const [texture, setTexture] = useState("");
  const [view, setView] = useState<"front" | "back">("front");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");

  const generate = useCallback(async () => {
    if (loading || prompt.trim().length < 3) return;
    setLoading(true);
    setError("");
    setUploadStatus("");
    try {
      const response = await fetch(`${API_BASE}/ai/classic-texture`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), garmentType }),
      });
      const data = await response.json() as TextureResponse & { error?: string };
      if (!response.ok || !data.imageUrl) throw new Error(data.error ?? "Generation failed");
      const finalPng = await finalizeTexture(data.imageUrl);
      // Loading the same final PNG successfully is the last client-side validation
      // and the exact bytes shown here are also used for download/upload.
      setTexture(finalPng);
      setView("front");
    } catch {
      setError("AI could not create a complete valid texture. Please regenerate.");
    } finally {
      setLoading(false);
    }
  }, [garmentType, loading, prompt]);

  const upload = async () => {
    if (!texture) return;
    setUploadStatus("Uploading…");
    const response = await fetch(`${API_BASE}/auth/roblox/upload`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: garmentType, name: `My Skins Classic ${garmentType}`, pngDataUrl: texture }),
    });
    setUploadStatus(response.ok ? "Sent to Roblox." : "Roblox upload is not available. Download the PNG instead.");
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto flex max-w-3xl flex-col gap-7">
        <header className="text-center">
          <h1 className="text-4xl font-bold tracking-tight">My Skins AI</h1>
          <p className="mt-2 text-slate-400">Describe it. AI creates the complete Roblox clothing texture.</p>
        </header>

        <section className="rounded-3xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
          <div className="grid grid-cols-2 gap-2" aria-label="Clothing type">
            {(["shirt", "pants"] as const).map((type) => (
              <Button key={type} type="button" variant={garmentType === type ? "default" : "outline"} onClick={() => setGarmentType(type)} disabled={loading}>
                Classic {type === "shirt" ? "Shirt" : "Pants"}
              </Button>
            ))}
          </div>
          <div className="grid gap-2 text-sm text-slate-400 sm:grid-cols-2">
            <p><strong className="text-slate-200">Classic Shirt:</strong> Creates a flat Roblox clothing texture with a hoodie-style appearance.</p>
            <p><strong className="text-slate-200">Layered Clothing / 3D Hoodie:</strong> Creates actual 3D clothing geometry. <span className="text-slate-500">Coming later.</span></p>
          </div>
          <form className="flex flex-col gap-3 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void generate(); }}>
            <Input value={prompt} onChange={(event) => setPrompt(event.target.value)} disabled={loading} maxLength={600} className="h-12 bg-slate-950" placeholder="White cotton zip hoodie with realistic seams and folds…" aria-label="Clothing description" />
            <Button className="h-12 px-7" type="submit" disabled={loading || prompt.trim().length < 3}>
              {loading ? <Loader2 className="mr-2 animate-spin" /> : <Sparkles className="mr-2" />} Generate
            </Button>
          </form>
        </section>

        <section className="relative h-[520px] overflow-hidden rounded-3xl border border-slate-800 bg-slate-900">
          <AvatarPreview textureUrl={texture || undefined} itemType={garmentType} view={view} onViewChange={setView} previewMode="avatar" studioMode animated />
          {loading && <div className="absolute inset-0 grid place-content-center bg-slate-950/70 text-center"><Loader2 className="mx-auto mb-3 h-9 w-9 animate-spin text-emerald-400" /><strong>AI is constructing every clothing surface…</strong></div>}
        </section>

        {error && <p role="alert" className="text-center text-red-400">{error}</p>}
        <div className="flex flex-wrap justify-center gap-3">
          <Button variant="outline" onClick={() => setView(view === "front" ? "back" : "front")}><RotateCw className="mr-2" />{view === "front" ? "Show back" : "Show front"}</Button>
          <Button variant="outline" onClick={() => void generate()} disabled={!texture || loading}><Sparkles className="mr-2" />Regenerate</Button>
          <Button onClick={() => downloadPng(texture, garmentType)} disabled={!texture}><Download className="mr-2" />Download PNG</Button>
          <Button variant="outline" onClick={() => void upload()} disabled={!texture}><Upload className="mr-2" />Upload to Roblox</Button>
        </div>
        {uploadStatus && <p className="text-center text-sm text-slate-400">{uploadStatus}</p>}
      </div>
    </main>
  );
}
