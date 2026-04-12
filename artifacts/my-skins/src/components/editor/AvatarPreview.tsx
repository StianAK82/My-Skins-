import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { CanvasTexture } from "three";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import type { StylizedOutfitConcept } from "@/lib/ai/stylized-outfit-client";

type ThreeTexture = InstanceType<typeof CanvasTexture>;

type PreviewMode = "classic_2d" | "stylized_outfit";
type GarmentMaterial = "cotton" | "denim" | "nylon";

type AvatarPreviewProps = {
  textureUrl?: string;
  className?: string;
  avatarType?: string;
  bodyType?: string;
  view?: "front" | "back";
  onViewChange?: (view: "front" | "back") => void;
  itemType?: "shirt" | "pants";
  dimension?: "2d" | "3d";
  previewMode?: PreviewMode;
  garmentColor?: string;
  garmentMaterial?: GarmentMaterial;
  garmentScale?: number;
  studioMode?: boolean;
  stylizedConcept?: StylizedOutfitConcept | null;
};

type Zone = { left: number; top: number; width: number; height: number };
type ClothingMaps = { shirtFront: ThreeTexture; shirtBack: ThreeTexture; shirtSide: ThreeTexture; pantsFront: ThreeTexture; pantsBack: ThreeTexture; pantsSide: ThreeTexture };

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
  if (!ctx) return new CanvasTexture(canvas);
  ctx.fillStyle = fallback;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, zone.left, zone.top, zone.width, zone.height, 0, 0, zone.width, zone.height);
  const texture = new CanvasTexture(canvas);
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
  ctx.fillStyle = "#111827";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#334155";
  [SHIRT_FRONT, SHIRT_BACK, SHIRT_SIDE, PANTS_FRONT, PANTS_BACK, PANTS_SIDE].forEach((zone) => ctx.strokeRect(zone.left, zone.top, zone.width, zone.height));
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
        prev?.shirtFront.dispose(); prev?.shirtBack.dispose(); prev?.shirtSide.dispose(); prev?.pantsFront.dispose(); prev?.pantsBack.dispose(); prev?.pantsSide.dispose();
        return {
          shirtFront: makeTextureFromZone(base, SHIRT_FRONT, "#334155"),
          shirtBack: makeTextureFromZone(base, SHIRT_BACK, "#334155"),
          shirtSide: makeTextureFromZone(base, SHIRT_SIDE, "#334155"),
          pantsFront: makeTextureFromZone(base, PANTS_FRONT, "#1e293b"),
          pantsBack: makeTextureFromZone(base, PANTS_BACK, "#1e293b"),
          pantsSide: makeTextureFromZone(base, PANTS_SIDE, "#1e293b"),
        };
      });
    };
    if (source) {
      source.crossOrigin = "anonymous";
      source.onload = () => applyMaps(source);
      source.onerror = () => applyMaps(buildFallbackAtlas());
      source.src = textureUrl ?? "";
    } else applyMaps(buildFallbackAtlas());
    return () => { alive = false; };
  }, [textureUrl]);
  return maps;
}

function bodyScaleFromType(bodyType: string) {
  if (bodyType === "slim") return [0.93, 1.02, 0.9] as const;
  if (bodyType === "athletic") return [1.07, 1.03, 1.04] as const;
  return [1, 1, 1] as const;
}

function PremiumClassicAvatar({ maps, bodyType, view, itemType }: { maps: ClothingMaps; bodyType: string; view: "front" | "back"; itemType: "shirt" | "pants" }) {
  const bodyScale = useMemo(() => bodyScaleFromType(bodyType), [bodyType]);
  const torsoFront = itemType === "shirt" ? maps.shirtFront : maps.shirtSide;
  const torsoBack = itemType === "shirt" ? maps.shirtBack : maps.shirtSide;
  const legFront = itemType === "pants" ? maps.pantsFront : maps.pantsSide;
  const legBack = itemType === "pants" ? maps.pantsBack : maps.pantsSide;

  return (
    <group rotation-y={view === "back" ? Math.PI : 0} scale={bodyScale}>
      <mesh position={[0, 1.83, 0]} castShadow>
        <sphereGeometry args={[0.23, 28, 28]} />
        <meshStandardMaterial color="#f2c3a0" roughness={0.72} />
      </mesh>
      <RoundedBox args={[0.76, 0.9, 0.42]} radius={0.08} smoothness={4} position={[0, 1.2, 0]} castShadow>
        <meshStandardMaterial attach="material-0" map={maps.shirtSide} roughness={0.68} />
        <meshStandardMaterial attach="material-1" map={maps.shirtSide} roughness={0.68} />
        <meshStandardMaterial attach="material-2" color="#0f172a" roughness={0.82} />
        <meshStandardMaterial attach="material-3" color="#0f172a" roughness={0.82} />
        <meshStandardMaterial attach="material-4" map={torsoFront} roughness={0.65} />
        <meshStandardMaterial attach="material-5" map={torsoBack} roughness={0.65} />
      </RoundedBox>
      <RoundedBox args={[0.23, 0.76, 0.24]} radius={0.08} smoothness={4} position={[-0.56, 1.2, 0]} castShadow><meshStandardMaterial color="#e2e8f0" roughness={0.8} /></RoundedBox>
      <RoundedBox args={[0.23, 0.76, 0.24]} radius={0.08} smoothness={4} position={[0.56, 1.2, 0]} castShadow><meshStandardMaterial color="#e2e8f0" roughness={0.8} /></RoundedBox>
      <RoundedBox args={[0.31, 0.98, 0.33]} radius={0.07} smoothness={4} position={[-0.2, 0.45, 0]} castShadow>
        <meshStandardMaterial attach="material-0" map={maps.pantsSide} roughness={0.72} />
        <meshStandardMaterial attach="material-1" map={maps.pantsSide} roughness={0.72} />
        <meshStandardMaterial attach="material-2" color="#0f172a" roughness={0.85} />
        <meshStandardMaterial attach="material-3" color="#0f172a" roughness={0.85} />
        <meshStandardMaterial attach="material-4" map={legFront} roughness={0.72} />
        <meshStandardMaterial attach="material-5" map={legBack} roughness={0.72} />
      </RoundedBox>
      <RoundedBox args={[0.31, 0.98, 0.33]} radius={0.07} smoothness={4} position={[0.2, 0.45, 0]} castShadow>
        <meshStandardMaterial attach="material-0" map={maps.pantsSide} roughness={0.72} />
        <meshStandardMaterial attach="material-1" map={maps.pantsSide} roughness={0.72} />
        <meshStandardMaterial attach="material-2" color="#0f172a" roughness={0.85} />
        <meshStandardMaterial attach="material-3" color="#0f172a" roughness={0.85} />
        <meshStandardMaterial attach="material-4" map={legFront} roughness={0.72} />
        <meshStandardMaterial attach="material-5" map={legBack} roughness={0.72} />
      </RoundedBox>
      <RoundedBox args={[0.33, 0.13, 0.43]} radius={0.05} smoothness={4} position={[-0.2, -0.06, 0.05]}><meshStandardMaterial color="#020617" roughness={0.88} /></RoundedBox>
      <RoundedBox args={[0.33, 0.13, 0.43]} radius={0.05} smoothness={4} position={[0.2, -0.06, 0.05]}><meshStandardMaterial color="#020617" roughness={0.88} /></RoundedBox>
    </group>
  );
}

function StylizedOutfitAvatar({ view, bodyType, garmentColor, concept }: { view: "front" | "back"; bodyType: string; garmentColor: string; concept?: StylizedOutfitConcept | null }) {
  const bodyScale = useMemo(() => bodyScaleFromType(bodyType), [bodyType]);
  const palette = concept?.colorPalette?.length ? concept.colorPalette : [garmentColor, "#0f172a", "#fde68a", "#334155"];
  const coatColor = palette[0] ?? garmentColor;
  const accentColor = palette[2] ?? "#fbbf24";
  const trimColor = palette[3] ?? "#1f2937";

  return (
    <group rotation-y={view === "back" ? Math.PI : 0} scale={bodyScale}>
      <mesh position={[0, 1.84, 0]} castShadow>
        <sphereGeometry args={[0.235, 32, 32]} />
        <meshStandardMaterial color="#f2c3a0" roughness={0.65} />
      </mesh>
      <RoundedBox args={[0.69, 0.82, 0.35]} radius={0.09} smoothness={5} position={[0, 1.2, 0]} castShadow>
        <meshStandardMaterial color="#cbd5e1" roughness={0.85} />
      </RoundedBox>
      <RoundedBox args={[0.84, 1.03, 0.5]} radius={0.1} smoothness={6} position={[0, 1.18, 0]} castShadow>
        <meshStandardMaterial color={coatColor} roughness={0.48} metalness={0.12} />
      </RoundedBox>
      <RoundedBox args={[0.16, 0.95, 0.08]} radius={0.03} smoothness={4} position={[0, 1.18, 0.26]}>
        <meshStandardMaterial color={accentColor} roughness={0.35} metalness={0.35} />
      </RoundedBox>
      <RoundedBox args={[0.95, 0.08, 0.52]} radius={0.03} smoothness={4} position={[0, 0.98, 0.02]}>
        <meshStandardMaterial color={trimColor} roughness={0.4} metalness={0.3} />
      </RoundedBox>
      <RoundedBox args={[0.3, 0.88, 0.3]} radius={0.08} smoothness={4} position={[-0.2, 0.48, 0]} castShadow><meshStandardMaterial color={palette[1] ?? "#1e293b"} roughness={0.7} /></RoundedBox>
      <RoundedBox args={[0.3, 0.88, 0.3]} radius={0.08} smoothness={4} position={[0.2, 0.48, 0]} castShadow><meshStandardMaterial color={palette[1] ?? "#1e293b"} roughness={0.7} /></RoundedBox>
      <RoundedBox args={[0.36, 0.22, 0.44]} radius={0.06} smoothness={4} position={[-0.2, -0.06, 0.05]}><meshStandardMaterial color="#1f2937" roughness={0.92} /></RoundedBox>
      <RoundedBox args={[0.36, 0.22, 0.44]} radius={0.06} smoothness={4} position={[0.2, -0.06, 0.05]}><meshStandardMaterial color="#1f2937" roughness={0.92} /></RoundedBox>
      <RoundedBox args={[0.24, 0.82, 0.24]} radius={0.08} smoothness={4} position={[-0.62, 1.16, 0]} castShadow><meshStandardMaterial color={coatColor} roughness={0.52} /></RoundedBox>
      <RoundedBox args={[0.24, 0.82, 0.24]} radius={0.08} smoothness={4} position={[0.62, 1.16, 0]} castShadow><meshStandardMaterial color={coatColor} roughness={0.52} /></RoundedBox>
      <mesh position={[0, 2.07, 0]} castShadow>
        <cylinderGeometry args={[0.26, 0.33, 0.18, 28]} />
        <meshStandardMaterial color={trimColor} roughness={0.5} metalness={0.18} />
      </mesh>
      <mesh position={[0, 2.14, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.33, 0.05, 16, 40]} />
        <meshStandardMaterial color={accentColor} roughness={0.4} metalness={0.4} />
      </mesh>
    </group>
  );
}

function SceneContent({ maps, previewMode, bodyType, view, itemType, garmentColor, rotation, concept }: {
  maps: ClothingMaps | null;
  previewMode: PreviewMode;
  bodyType: string;
  view: "front" | "back";
  itemType: "shirt" | "pants";
  garmentColor: string;
  rotation: number;
  concept?: StylizedOutfitConcept | null;
}) {
  return (
    <>
      <color attach="background" args={["#070b14"]} />
      <ambientLight intensity={0.62} />
      <directionalLight position={[4, 7, 5]} intensity={1.25} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <pointLight position={[-2, 2.5, -2]} intensity={0.45} color="#818cf8" />
      <group rotation-y={rotation}>
        {previewMode === "classic_2d" && maps ? <PremiumClassicAvatar maps={maps} bodyType={bodyType} view={view} itemType={itemType} /> : null}
        {previewMode === "stylized_outfit" ? <StylizedOutfitAvatar view={view} bodyType={bodyType} garmentColor={garmentColor} concept={concept} /> : null}
      </group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.12, 0]} receiveShadow>
        <circleGeometry args={[2.8, 64]} />
        <meshStandardMaterial color="#0f172a" roughness={1} />
      </mesh>
      <OrbitControls enablePan={false} minDistance={2.3} maxDistance={6.2} target={[0, 1.1, 0]} />
    </>
  );
}

export function AvatarPreview({
  textureUrl,
  className,
  avatarType = "neutral",
  bodyType = "regular",
  view: controlledView,
  onViewChange,
  itemType = "shirt",
  dimension,
  previewMode,
  garmentColor = "#2563eb",
  studioMode = false,
  stylizedConcept,
}: AvatarPreviewProps) {
  const resolvedMode: PreviewMode = previewMode ?? (dimension === "3d" ? "stylized_outfit" : "classic_2d");
  const [internalView, setInternalView] = useState<"front" | "back">("front");
  const [zoom, setZoom] = useState(3.8);
  const [rotation, setRotation] = useState(0);
  const maps = useClothingMaps(textureUrl);

  const view = controlledView ?? internalView;
  const setView = (next: "front" | "back") => {
    if (!controlledView) setInternalView(next);
    onViewChange?.(next);
  };

  const subtitle = resolvedMode === "classic_2d" ? "Classic 2D Texture Preview" : "Stylized Outfit Concept Preview";

  const scene = (
    <Canvas shadows camera={{ position: [0, 1.25, zoom], fov: 40 }} className="w-full h-full">
      <SceneContent
        maps={maps}
        previewMode={resolvedMode}
        bodyType={bodyType}
        view={view}
        itemType={itemType}
        garmentColor={garmentColor}
        rotation={rotation}
        concept={stylizedConcept}
      />
    </Canvas>
  );

  if (studioMode) {
    return (
      <div className="relative w-full h-full">
        {scene}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur rounded-full px-4 py-2 border border-white/10">
          <button onClick={() => setView("front")} className={`text-xs px-3 py-1 rounded-full ${view === "front" ? "bg-white/20 text-white" : "text-white/50 hover:text-white"}`}>Front</button>
          <button onClick={() => setView("back")} className={`text-xs px-3 py-1 rounded-full ${view === "back" ? "bg-white/20 text-white" : "text-white/50 hover:text-white"}`}>Back</button>
          <button onClick={() => setRotation((p) => p + 0.3)} className="text-white/60 hover:text-white p-1" title="Rotate"><RotateCw className="w-3.5 h-3.5" /></button>
          <button onClick={() => setZoom((p) => Math.min(6, p + 0.4))} className="text-white/60 hover:text-white p-1" title="Zoom out"><ZoomOut className="w-3.5 h-3.5" /></button>
          <button onClick={() => setZoom((p) => Math.max(2.2, p - 0.4))} className="text-white/60 hover:text-white p-1" title="Zoom in"><ZoomIn className="w-3.5 h-3.5" /></button>
        </div>
        <div className="absolute top-4 left-4 text-[10px] uppercase tracking-widest text-white/35 font-medium">{avatarType} · {bodyType} · {subtitle}</div>
      </div>
    );
  }

  return (
    <Card className={className}>
      <div className="p-4 text-sm font-medium border-b border-border">Avatar Studio Preview · {avatarType} · {subtitle}</div>
      <div className="px-4 pt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant={view === "front" ? "default" : "outline"} onClick={() => setView("front")}>Front</Button>
        <Button size="sm" variant={view === "back" ? "default" : "outline"} onClick={() => setView("back")}>Back</Button>
        <Button size="icon" variant="outline" onClick={() => setRotation((p) => p + 0.25)}><RotateCw className="w-4 h-4" /></Button>
        <Button size="icon" variant="outline" onClick={() => setZoom((p) => Math.min(5.2, p + 0.25))}><ZoomOut className="w-4 h-4" /></Button>
        <Button size="icon" variant="outline" onClick={() => setZoom((p) => Math.max(2.4, p - 0.25))}><ZoomIn className="w-4 h-4" /></Button>
      </div>
      <div className="h-[560px] p-4">{scene}</div>
    </Card>
  );
}
