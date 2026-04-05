import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RotateCw, ZoomIn, ZoomOut } from "lucide-react";

type AvatarPreviewProps = {
  textureUrl?: string;
  className?: string;
  avatarType?: string;
  bodyType?: string;
  view?: "front" | "back";
  onViewChange?: (view: "front" | "back") => void;
  itemType?: "shirt" | "pants";
};

type Zone = { left: number; top: number; width: number; height: number };

type ClothingMaps = {
  shirtFront: any;
  shirtBack: any;
  shirtSide: any;
  pantsFront: any;
  pantsBack: any;
  pantsSide: any;
};

const SHIRT_FRONT: Zone = { left: 196, top: 118, width: 128, height: 128 };
const SHIRT_BACK: Zone = { left: 338, top: 118, width: 128, height: 128 };
const SHIRT_SIDE: Zone = { left: 44, top: 118, width: 128, height: 128 };
const PANTS_FRONT: Zone = { left: 196, top: 288, width: 128, height: 192 };
const PANTS_BACK: Zone = { left: 338, top: 288, width: 128, height: 192 };
const PANTS_SIDE: Zone = { left: 44, top: 288, width: 128, height: 192 };

function makeTextureFromZone(source: CanvasImageSource, zone: Zone, fallback = "#d1d5db") {
  const canvas = document.createElement("canvas");
  canvas.width = zone.width;
  canvas.height = zone.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const fallbackTexture = new THREE.Texture();
    fallbackTexture.needsUpdate = true;
    return fallbackTexture;
  }

  ctx.fillStyle = fallback;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(
    source,
    zone.left,
    zone.top,
    zone.width,
    zone.height,
    0,
    0,
    zone.width,
    zone.height,
  );

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function buildFallbackAtlas() {
  const canvas = document.createElement("canvas");
  canvas.width = 585;
  canvas.height = 559;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  [SHIRT_FRONT, SHIRT_BACK, SHIRT_SIDE, PANTS_FRONT, PANTS_BACK, PANTS_SIDE].forEach((zone) => {
    ctx.strokeRect(zone.left, zone.top, zone.width, zone.height);
  });

  return canvas;
}

function useClothingMaps(textureUrl?: string) {
  const [maps, setMaps] = useState<ClothingMaps | null>(null);

  useEffect(() => {
    let alive = true;

    const source = textureUrl ? new Image() : null;
    const applyMaps = (base: CanvasImageSource) => {
      if (!alive) return;
      setMaps((prev) => {
        prev?.shirtFront.dispose();
        prev?.shirtBack.dispose();
        prev?.shirtSide.dispose();
        prev?.pantsFront.dispose();
        prev?.pantsBack.dispose();
        prev?.pantsSide.dispose();

        return {
          shirtFront: makeTextureFromZone(base, SHIRT_FRONT, "#e2e8f0"),
          shirtBack: makeTextureFromZone(base, SHIRT_BACK, "#e2e8f0"),
          shirtSide: makeTextureFromZone(base, SHIRT_SIDE, "#e2e8f0"),
          pantsFront: makeTextureFromZone(base, PANTS_FRONT, "#cbd5e1"),
          pantsBack: makeTextureFromZone(base, PANTS_BACK, "#cbd5e1"),
          pantsSide: makeTextureFromZone(base, PANTS_SIDE, "#cbd5e1"),
        };
      });
    };

    if (source) {
      source.crossOrigin = "anonymous";
      source.onload = () => applyMaps(source);
      source.src = textureUrl ?? "";
      source.onerror = () => applyMaps(buildFallbackAtlas());
    } else {
      applyMaps(buildFallbackAtlas());
    }

    return () => {
      alive = false;
    };
  }, [textureUrl]);

  return maps;
}

function Mannequin({ maps, bodyType, view, itemType }: { maps: ClothingMaps; bodyType: string; view: "front" | "back"; itemType: "shirt" | "pants" }) {
  const bodyScale = useMemo(() => {
    if (bodyType === "slim") return [0.93, 1, 0.9] as const;
    if (bodyType === "athletic") return [1.08, 1.04, 1.06] as const;
    return [1, 1, 1] as const;
  }, [bodyType]);

  const torsoFront = itemType === "shirt" ? maps.shirtFront : maps.shirtSide;
  const torsoBack = itemType === "shirt" ? maps.shirtBack : maps.shirtSide;
  const torsoSide = maps.shirtSide;

  const legFront = itemType === "pants" ? maps.pantsFront : maps.pantsSide;
  const legBack = itemType === "pants" ? maps.pantsBack : maps.pantsSide;
  const legSide = maps.pantsSide;

  return (
    <group rotation-y={view === "back" ? Math.PI : 0} scale={bodyScale}>
      <mesh position={[0, 1.78, 0]} castShadow>
        <sphereGeometry args={[0.23, 32, 32]} />
        <meshStandardMaterial color="#f1c7a6" roughness={0.8} />
      </mesh>

      <mesh position={[0, 1.2, 0]} castShadow>
        <boxGeometry args={[0.72, 0.82, 0.36]} />
        <meshStandardMaterial attach="material-0" map={torsoSide} roughness={0.7} />
        <meshStandardMaterial attach="material-1" map={torsoSide} roughness={0.7} />
        <meshStandardMaterial attach="material-2" color="#f8fafc" roughness={0.7} />
        <meshStandardMaterial attach="material-3" color="#f8fafc" roughness={0.7} />
        <meshStandardMaterial attach="material-4" map={torsoFront} roughness={0.7} />
        <meshStandardMaterial attach="material-5" map={torsoBack} roughness={0.7} />
      </mesh>

      <mesh position={[-0.56, 1.2, 0]} castShadow>
        <boxGeometry args={[0.28, 0.78, 0.28]} />
        <meshStandardMaterial map={torsoSide} roughness={0.7} />
      </mesh>
      <mesh position={[0.56, 1.2, 0]} castShadow>
        <boxGeometry args={[0.28, 0.78, 0.28]} />
        <meshStandardMaterial map={torsoSide} roughness={0.7} />
      </mesh>

      <mesh position={[-0.2, 0.46, 0]} castShadow>
        <boxGeometry args={[0.3, 0.92, 0.3]} />
        <meshStandardMaterial attach="material-0" map={legSide} roughness={0.7} />
        <meshStandardMaterial attach="material-1" map={legSide} roughness={0.7} />
        <meshStandardMaterial attach="material-2" color="#111827" roughness={0.8} />
        <meshStandardMaterial attach="material-3" color="#111827" roughness={0.8} />
        <meshStandardMaterial attach="material-4" map={legFront} roughness={0.7} />
        <meshStandardMaterial attach="material-5" map={legBack} roughness={0.7} />
      </mesh>

      <mesh position={[0.2, 0.46, 0]} castShadow>
        <boxGeometry args={[0.3, 0.92, 0.3]} />
        <meshStandardMaterial attach="material-0" map={legSide} roughness={0.7} />
        <meshStandardMaterial attach="material-1" map={legSide} roughness={0.7} />
        <meshStandardMaterial attach="material-2" color="#111827" roughness={0.8} />
        <meshStandardMaterial attach="material-3" color="#111827" roughness={0.8} />
        <meshStandardMaterial attach="material-4" map={legFront} roughness={0.7} />
        <meshStandardMaterial attach="material-5" map={legBack} roughness={0.7} />
      </mesh>
    </group>
  );
}

export function AvatarPreview({ textureUrl, className, avatarType = "neutral", bodyType = "regular", view: controlledView, onViewChange, itemType = "shirt" }: AvatarPreviewProps) {
  const [internalView, setInternalView] = useState<"front" | "back">("front");
  const [zoom, setZoom] = useState(3.8);
  const [rotation, setRotation] = useState(0);
  const maps = useClothingMaps(textureUrl);

  const view = controlledView ?? internalView;
  const setView = (next: "front" | "back") => {
    if (!controlledView) setInternalView(next);
    onViewChange?.(next);
  };

  return (
    <Card className={className}>
      <div className="p-4 text-sm font-medium border-b border-border">Avatar Studio Preview · {avatarType}</div>
      <div className="px-4 pt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant={view === "front" ? "default" : "outline"} onClick={() => setView("front")}>Front</Button>
        <Button size="sm" variant={view === "back" ? "default" : "outline"} onClick={() => setView("back")}>Back</Button>
        <Button size="icon" variant="outline" onClick={() => setRotation((p) => p + 0.25)}><RotateCw className="w-4 h-4" /></Button>
        <Button size="icon" variant="outline" onClick={() => setZoom((p) => Math.min(5.2, p + 0.25))}><ZoomOut className="w-4 h-4" /></Button>
        <Button size="icon" variant="outline" onClick={() => setZoom((p) => Math.max(2.4, p - 0.25))}><ZoomIn className="w-4 h-4" /></Button>
      </div>
      <div className="h-[520px] p-4">
        {maps ? (
          <Canvas shadows camera={{ position: [0, 1.25, zoom], fov: 38 }}>
            <color attach="background" args={["#0f172a"]} />
            <ambientLight intensity={0.8} />
            <directionalLight position={[4, 6, 4]} intensity={1.1} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
            <directionalLight position={[-3, 3, -4]} intensity={0.45} />
            <group rotation-y={rotation}>
              <Mannequin maps={maps} bodyType={bodyType} view={view} itemType={itemType} />
            </group>
            <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow>
              <circleGeometry args={[2.2, 64]} />
              <meshStandardMaterial color="#1e293b" roughness={1} />
            </mesh>
            <OrbitControls enablePan={false} minDistance={2.4} maxDistance={5.2} target={[0, 1.1, 0]} />
          </Canvas>
        ) : (
          <div className="h-full rounded-lg border border-dashed border-border text-sm text-muted-foreground flex items-center justify-center">
            Building live 3D texture preview...
          </div>
        )}
      </div>
    </Card>
  );
}
