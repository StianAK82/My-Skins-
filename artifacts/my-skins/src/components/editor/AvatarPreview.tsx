import { type ComponentType, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RotateCw, ZoomIn, ZoomOut } from "lucide-react";

type AvatarPreviewProps = {
  textureUrl: string;
  className?: string;
  avatarType?: string;
  bodyType?: string;
  view?: "front" | "back";
  onViewChange?: (view: "front" | "back") => void;
};

type ThreeModules = {
  Canvas: ComponentType<Record<string, unknown>>;
  OrbitControls?: ComponentType<Record<string, unknown>>;
  three?: Record<string, unknown>;
};

function loadAvatarModules() {
  const dynamicImport = (specifier: string) => import(/* @vite-ignore */ specifier);
  return Promise.all([
    dynamicImport("@react-three/fiber"),
    dynamicImport("@react-three/drei").catch(() => ({})),
    dynamicImport("three").catch(() => ({})),
  ]);
}

export function AvatarPreview({ textureUrl, className, avatarType = "neutral", bodyType = "regular", view: controlledView, onViewChange }: AvatarPreviewProps) {
  const [modules, setModules] = useState<ThreeModules | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [internalView, setInternalView] = useState<"front" | "back">("front");
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);

  const view = controlledView ?? internalView;
  const setView = (next: "front" | "back") => {
    if (!controlledView) setInternalView(next);
    onViewChange?.(next);
  };

  const bodyScale = useMemo(() => {
    if (bodyType === "slim") return 0.9;
    if (bodyType === "athletic") return 1.08;
    return 1;
  }, [bodyType]);

  useEffect(() => {
    let active = true;

    loadAvatarModules()
      .then(([fiber, drei, three]) => {
        if (!active || !fiber?.Canvas) {
          if (active) setError("3D preview is unavailable in this environment.");
          return;
        }
        setModules({
          Canvas: fiber.Canvas,
          OrbitControls: (drei as { OrbitControls?: ThreeModules["OrbitControls"] }).OrbitControls,
          three: three as Record<string, unknown>,
        });
      })
      .catch(() => {
        if (active) setError("3D preview dependencies failed to load. Showing 2D fallback.");
      });

    return () => {
      active = false;
    };
  }, []);

  if (!modules || error) {
    return (
      <Card className={className}>
        <div className="p-4 text-sm text-muted-foreground border-b border-border">Avatar Preview · {avatarType}</div>
        <div className="px-4 pt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant={view === "front" ? "default" : "outline"} onClick={() => setView("front")}>Front</Button>
          <Button size="sm" variant={view === "back" ? "default" : "outline"} onClick={() => setView("back")}>Back</Button>
          <Button size="icon" variant="outline" onClick={() => setRotation((p) => p + 25)}><RotateCw className="w-4 h-4" /></Button>
          <Button size="icon" variant="outline" onClick={() => setZoom((p) => Math.max(0.7, p - 0.1))}><ZoomOut className="w-4 h-4" /></Button>
          <Button size="icon" variant="outline" onClick={() => setZoom((p) => Math.min(1.8, p + 0.1))}><ZoomIn className="w-4 h-4" /></Button>
        </div>
        <div className="h-[520px] flex flex-col items-center justify-center gap-3 p-4">
          <p className="text-sm text-muted-foreground text-center">{error ?? "Loading 3D preview..."}</p>
          <img src={textureUrl} alt="2D avatar preview" className="max-h-[360px] w-auto rounded border border-border" style={{ transform: `scale(${zoom * bodyScale}) rotate(${rotation}deg) ${view === "back" ? "scaleX(-1)" : ""}` }} />
        </div>
      </Card>
    );
  }

  const Canvas = modules.Canvas;
  const OrbitControls = modules.OrbitControls;

  return (
    <Card className={className}>
      <div className="p-4 text-sm font-medium border-b border-border">Avatar Studio Preview · {avatarType}</div>
      <div className="px-4 pt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant={view === "front" ? "default" : "outline"} onClick={() => setView("front")}>Front</Button>
        <Button size="sm" variant={view === "back" ? "default" : "outline"} onClick={() => setView("back")}>Back</Button>
        <Button size="icon" variant="outline" onClick={() => setRotation((p) => p + 25)}><RotateCw className="w-4 h-4" /></Button>
        <Button size="icon" variant="outline" onClick={() => setZoom((p) => Math.max(0.7, p - 0.1))}><ZoomOut className="w-4 h-4" /></Button>
        <Button size="icon" variant="outline" onClick={() => setZoom((p) => Math.min(1.8, p + 0.1))}><ZoomIn className="w-4 h-4" /></Button>
      </div>
      <div className="h-[520px] flex flex-col items-center justify-center gap-3 p-4">
        <p className="text-xs text-muted-foreground text-center">
          Live clothing preview {OrbitControls ? "(orbit enabled)" : "(orbit unavailable)"}.
        </p>
        <img
          src={textureUrl}
          alt="Avatar texture preview"
          className="max-h-[360px] w-auto rounded border border-border"
          style={{ transform: `scale(${zoom * bodyScale}) rotate(${rotation}deg) ${view === "back" ? "scaleX(-1)" : ""}` }}
        />
        <Canvas camera={{ position: [0, 1.1, 4.8], fov: 40 }} style={{ width: 1, height: 1, opacity: 0, pointerEvents: "none" }}>
          {OrbitControls ? <OrbitControls enablePan={false} minDistance={2.5} maxDistance={8} /> : null}
        </Canvas>
      </div>
    </Card>
  );
}
