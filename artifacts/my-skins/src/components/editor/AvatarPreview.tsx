import { type ComponentType, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type AvatarPreviewProps = {
  textureUrl: string;
  className?: string;
  avatarType?: string;
  bodyType?: string;
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

export function AvatarPreview({ textureUrl, className, avatarType = "neutral", bodyType = "regular" }: AvatarPreviewProps) {
  const [modules, setModules] = useState<ThreeModules | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"front" | "back">("front");
  const [zoom, setZoom] = useState(1);

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
        <div className="p-4 text-sm text-muted-foreground border-b border-border">Avatar Preview</div>
        <div className="px-4 pt-3 flex items-center gap-2">
          <Button size="sm" variant={view === "front" ? "default" : "outline"} onClick={() => setView("front")}>Front</Button>
          <Button size="sm" variant={view === "back" ? "default" : "outline"} onClick={() => setView("back")}>Back</Button>
        </div>
        <div className="h-[420px] flex flex-col items-center justify-center gap-3 p-4">
          <p className="text-sm text-muted-foreground text-center">{error ?? "Loading 3D preview..."}</p>
          <img src={textureUrl} alt="2D avatar preview" className="max-h-[300px] w-auto rounded border border-border" style={{ transform: `scale(${zoom}) ${view === "back" ? "scaleX(-1)" : ""}` }} />
          <input type="range" min="0.7" max="1.6" step="0.05" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
        </div>
      </Card>
    );
  }

  const Canvas = modules.Canvas;
  const OrbitControls = modules.OrbitControls;

  return (
    <Card className={className}>
      <div className="p-4 text-sm font-medium border-b border-border">Avatar Preview (3D)</div>
      <div className="h-[420px]">
        <Canvas camera={{ position: [0, 1.1, 4.8], fov: 40 }}>
          <color attach="background" args={["#0f172a"]} />
          <ambientLight intensity={0.75} />
          <directionalLight position={[3, 4, 3]} intensity={1.2} />
          <mesh position={[0, 1, 0]}>
            <boxGeometry args={[1.3 * bodyScale, 1.7 * bodyScale, 0.8]} />
            <meshStandardMaterial map={null} color={avatarType === "female" ? "#475569" : avatarType === "male" ? "#334155" : "#3f3f46"} />
          </mesh>
          {OrbitControls ? <OrbitControls enablePan={false} minDistance={2.5} maxDistance={8} /> : null}
        </Canvas>
      </div>
    </Card>
  );
}
