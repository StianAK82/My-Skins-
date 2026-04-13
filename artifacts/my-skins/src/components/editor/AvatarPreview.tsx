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
type PreviewMode = "classic_2d" | "fashion_builder";

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
  studioMode?: boolean;
  stylizedConcept?: StylizedOutfitConcept | null;
  garmentBase?: string;
  garmentVariant?: string;
  accessories?: { hair?: string; hat?: string; glasses?: string; beard?: string; backpack?: string };
};

type Zone = { left: number; top: number; width: number; height: number };
type ClothingMaps = { shirtFront: ThreeTexture; shirtBack: ThreeTexture; shirtSide: ThreeTexture; pantsFront: ThreeTexture; pantsBack: ThreeTexture; pantsSide: ThreeTexture };
type FaceMaps = { front: ThreeTexture; back: ThreeTexture; side: ThreeTexture };

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
  texture.anisotropy = 8;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
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

  useEffect(() => {
    return () => {
      maps?.shirtFront.dispose();
      maps?.shirtBack.dispose();
      maps?.shirtSide.dispose();
      maps?.pantsFront.dispose();
      maps?.pantsBack.dispose();
      maps?.pantsSide.dispose();
    };
  }, [maps]);
  return maps;
}

function bodyScaleFromType(bodyType: string) {
  if (bodyType === "slim") return [0.9, 1.04, 0.88] as const;
  if (bodyType === "athletic") return [1.1, 1.06, 1.08] as const;
  return [1, 1, 1] as const;
}

function TexturedBlock({
  size,
  position,
  radius = 0.06,
  frontMap,
  backMap,
  sideMap,
  roughness = 0.65,
  colorTop = "#0f172a",
  colorBottom = "#0f172a",
}: {
  size: [number, number, number];
  position: [number, number, number];
  radius?: number;
  frontMap: ThreeTexture;
  backMap: ThreeTexture;
  sideMap: ThreeTexture;
  roughness?: number;
  colorTop?: string;
  colorBottom?: string;
}) {
  return (
    <RoundedBox args={size} radius={radius} smoothness={6} position={position} castShadow>
      <meshStandardMaterial attach="material-0" map={sideMap} roughness={roughness} metalness={0.04} />
      <meshStandardMaterial attach="material-1" map={sideMap} roughness={roughness} metalness={0.04} />
      <meshStandardMaterial attach="material-2" color={colorTop} roughness={0.86} />
      <meshStandardMaterial attach="material-3" color={colorBottom} roughness={0.86} />
      <meshStandardMaterial attach="material-4" map={frontMap} roughness={roughness} metalness={0.04} />
      <meshStandardMaterial attach="material-5" map={backMap} roughness={roughness} metalness={0.04} />
    </RoundedBox>
  );
}

function RobloxStyleBody({
  shirtMaps,
  pantsMaps,
  skinColor = "#ffcf8b",
}: {
  shirtMaps: FaceMaps;
  pantsMaps: FaceMaps;
  skinColor?: string;
}) {
  return (
    <group>
      {/* Head */}
      <RoundedBox args={[0.6, 0.56, 0.54]} radius={0.11} smoothness={6} position={[0, 2.03, 0]} castShadow>
        <meshStandardMaterial color={skinColor} roughness={0.48} metalness={0.02} />
      </RoundedBox>
      {/* Face plate */}
      <mesh position={[0, 2.03, 0.275]}>
        <planeGeometry args={[0.42, 0.4]} />
        <meshStandardMaterial color={skinColor} roughness={0.46} />
      </mesh>
      {/* Eyes */}
      <mesh position={[-0.11, 2.06, 0.279]}><planeGeometry args={[0.07, 0.07]} /><meshStandardMaterial color="#111827" /></mesh>
      <mesh position={[0.11, 2.06, 0.279]}><planeGeometry args={[0.07, 0.07]} /><meshStandardMaterial color="#111827" /></mesh>

      {/* Neck */}
      <RoundedBox args={[0.24, 0.22, 0.24]} radius={0.07} smoothness={4} position={[0, 1.72, 0]} castShadow>
        <meshStandardMaterial color={skinColor} roughness={0.52} />
      </RoundedBox>

      {/* Torso */}
      <TexturedBlock
        size={[0.9, 0.84, 0.54]}
        radius={0.12}
        position={[0, 1.36, 0]}
        frontMap={shirtMaps.front}
        backMap={shirtMaps.back}
        sideMap={shirtMaps.side}
        roughness={0.61}
      />

      {/* Hip / waistband */}
      <TexturedBlock
        size={[0.78, 0.4, 0.48]}
        radius={0.06}
        position={[0, 0.87, 0]}
        frontMap={pantsMaps.front}
        backMap={pantsMaps.back}
        sideMap={pantsMaps.side}
        roughness={0.72}
      />

      {/* Shoulders (soft caps) */}
      <RoundedBox args={[0.24, 0.2, 0.27]} radius={0.09} smoothness={4} position={[-0.57, 1.58, 0]} castShadow>
        <meshStandardMaterial map={shirtMaps.side} roughness={0.62} metalness={0.03} />
      </RoundedBox>
      <RoundedBox args={[0.24, 0.2, 0.27]} radius={0.09} smoothness={4} position={[0.57, 1.58, 0]} castShadow>
        <meshStandardMaterial map={shirtMaps.side} roughness={0.62} metalness={0.03} />
      </RoundedBox>

      {/* Upper arms */}
      <TexturedBlock
        size={[0.29, 0.56, 0.29]}
        radius={0.06}
        position={[-0.57, 1.18, 0]}
        frontMap={shirtMaps.front}
        backMap={shirtMaps.back}
        sideMap={shirtMaps.side}
        roughness={0.66}
      />
      <TexturedBlock
        size={[0.29, 0.56, 0.29]}
        radius={0.06}
        position={[0.57, 1.18, 0]}
        frontMap={shirtMaps.front}
        backMap={shirtMaps.back}
        sideMap={shirtMaps.side}
        roughness={0.66}
      />

      {/* Forearms (skin) */}
      <RoundedBox args={[0.22, 0.42, 0.22]} radius={0.05} smoothness={3} position={[-0.54, 0.85, 0]} castShadow>
        <meshStandardMaterial color={skinColor} roughness={0.58} />
      </RoundedBox>
      <RoundedBox args={[0.22, 0.42, 0.22]} radius={0.05} smoothness={3} position={[0.54, 0.85, 0]} castShadow>
        <meshStandardMaterial color={skinColor} roughness={0.58} />
      </RoundedBox>

      {/* Hands */}
      <RoundedBox args={[0.24, 0.2, 0.2]} radius={0.05} smoothness={3} position={[-0.54, 0.58, 0]} castShadow>
        <meshStandardMaterial color={skinColor} roughness={0.55} />
      </RoundedBox>
      <RoundedBox args={[0.24, 0.2, 0.2]} radius={0.05} smoothness={3} position={[0.54, 0.58, 0]} castShadow>
        <meshStandardMaterial color={skinColor} roughness={0.55} />
      </RoundedBox>

      {/* Left leg */}
      <TexturedBlock
        size={[0.3, 0.74, 0.32]}
        radius={0.06}
        position={[-0.2, 0.55, 0]}
        frontMap={pantsMaps.front}
        backMap={pantsMaps.back}
        sideMap={pantsMaps.side}
        roughness={0.73}
      />
      {/* Right leg */}
      <TexturedBlock
        size={[0.3, 0.74, 0.32]}
        radius={0.06}
        position={[0.2, 0.55, 0]}
        frontMap={pantsMaps.front}
        backMap={pantsMaps.back}
        sideMap={pantsMaps.side}
        roughness={0.73}
      />

      {/* Lower legs (skin-toned or pants-colored) */}
      <TexturedBlock
        size={[0.28, 0.5, 0.29]}
        radius={0.05}
        position={[-0.2, 0.03, 0]}
        frontMap={pantsMaps.front}
        backMap={pantsMaps.back}
        sideMap={pantsMaps.side}
        roughness={0.75}
      />
      <TexturedBlock
        size={[0.28, 0.5, 0.29]}
        radius={0.05}
        position={[0.2, 0.03, 0]}
        frontMap={pantsMaps.front}
        backMap={pantsMaps.back}
        sideMap={pantsMaps.side}
        roughness={0.75}
      />

      {/* Shoes / feet — classic black Roblox shoes */}
      <RoundedBox args={[0.35, 0.2, 0.4]} radius={0.04} smoothness={3} position={[-0.2, -0.24, 0.04]} castShadow>
        <meshStandardMaterial color="#1a1a1a" roughness={0.7} metalness={0.05} />
      </RoundedBox>
      <RoundedBox args={[0.35, 0.2, 0.4]} radius={0.04} smoothness={3} position={[0.2, -0.24, 0.04]} castShadow>
        <meshStandardMaterial color="#1a1a1a" roughness={0.7} metalness={0.05} />
      </RoundedBox>
    </group>
  );
}

function PremiumClassicAvatar({ maps, bodyType, view, itemType }: { maps: ClothingMaps; bodyType: string; view: "front" | "back"; itemType: "shirt" | "pants" }) {
  const bodyScale = useMemo(() => bodyScaleFromType(bodyType), [bodyType]);
  const shirtMaps = useMemo<FaceMaps>(() => ({
    front: itemType === "shirt" ? maps.shirtFront : maps.shirtSide,
    back: itemType === "shirt" ? maps.shirtBack : maps.shirtSide,
    side: maps.shirtSide,
  }), [itemType, maps.shirtBack, maps.shirtFront, maps.shirtSide]);
  const pantsMaps = useMemo<FaceMaps>(() => ({
    front: itemType === "pants" ? maps.pantsFront : maps.pantsSide,
    back: itemType === "pants" ? maps.pantsBack : maps.pantsSide,
    side: maps.pantsSide,
  }), [itemType, maps.pantsBack, maps.pantsFront, maps.pantsSide]);

  return (
    <group rotation-y={view === "back" ? Math.PI : 0} scale={bodyScale}>
      <RobloxStyleBody shirtMaps={shirtMaps} pantsMaps={pantsMaps} />
    </group>
  );
}

function FashionBuilderAvatar({ view, bodyType, garmentColor, garmentBase, garmentVariant, concept, accessories }: {
  view: "front" | "back";
  bodyType: string;
  garmentColor: string;
  garmentBase: string;
  garmentVariant: string;
  concept?: StylizedOutfitConcept | null;
  accessories?: AvatarPreviewProps["accessories"];
}) {
  const bodyScale = useMemo(() => bodyScaleFromType(bodyType), [bodyType]);
  const palette = concept?.colorPalette?.length ? concept.colorPalette : [garmentColor, "#0f172a", "#fde68a", "#334155"];
  const coatColor = palette[0] ?? garmentColor;
  const trimColor = palette[2] ?? "#fbbf24";
  const lowerColor = palette[1] ?? "#1e293b";

  const torsoArgs = garmentBase === "hoodie" ? [0.92, 1.02, 0.55] : garmentBase === "jacket" ? [0.88, 0.96, 0.52] : [0.8, 0.9, 0.46];
  const bottomArgs = garmentBase === "boxers" || garmentBase === "shorts" ? [0.34, 0.56, 0.36] : [0.31, 0.98, 0.33];
  const sportyStripe = garmentVariant.includes("sport") || garmentVariant.includes("streetwear");

  return (
    <group rotation-y={view === "back" ? Math.PI : 0} scale={bodyScale}>
      <RoundedBox args={[0.48, 0.48, 0.46]} radius={0.09} smoothness={5} position={[0, 1.95, 0]} castShadow><meshStandardMaterial color="#f2c3a0" roughness={0.6} /></RoundedBox>
      {accessories?.hair !== "none" ? <mesh position={[0, 2.1, 0]} castShadow><sphereGeometry args={[0.28, 24, 24]} /><meshStandardMaterial color="#2d1b0f" roughness={0.9} /></mesh> : null}
      {accessories?.hat !== "none" ? <mesh position={[0, 2.18, 0]}><cylinderGeometry args={[0.28, 0.34, 0.14, 24]} /><meshStandardMaterial color="#111827" /></mesh> : null}
      {accessories?.glasses !== "none" ? <RoundedBox args={[0.34, 0.07, 0.02]} radius={0.01} smoothness={3} position={[0, 1.95, 0.24]}><meshStandardMaterial color="#0f172a" /></RoundedBox> : null}
      {accessories?.beard !== "none" ? <mesh position={[0, 1.77, 0.2]}><coneGeometry args={[0.08, 0.2, 14]} /><meshStandardMaterial color="#5b4636" /></mesh> : null}

      <RoundedBox args={torsoArgs as [number, number, number]} radius={0.11} smoothness={6} position={[0, 1.34, 0]} castShadow>
        <meshStandardMaterial color={coatColor} roughness={0.5} metalness={0.12} />
      </RoundedBox>
      {sportyStripe ? <RoundedBox args={[0.84, 0.08, 0.52]} radius={0.03} smoothness={4} position={[0, 1.19, 0.02]}><meshStandardMaterial color={trimColor} roughness={0.4} /></RoundedBox> : null}
      <RoundedBox args={[0.26, 0.74, 0.28]} radius={0.08} smoothness={4} position={[-0.5, 1.04, 0]} castShadow><meshStandardMaterial color={coatColor} roughness={0.58} /></RoundedBox>
      <RoundedBox args={[0.26, 0.74, 0.28]} radius={0.08} smoothness={4} position={[0.5, 1.04, 0]} castShadow><meshStandardMaterial color={coatColor} roughness={0.58} /></RoundedBox>
      <RoundedBox args={bottomArgs as [number, number, number]} radius={0.08} smoothness={4} position={[-0.2, garmentBase === "boxers" || garmentBase === "shorts" ? 0.76 : 0.44, 0]} castShadow><meshStandardMaterial color={lowerColor} roughness={0.72} /></RoundedBox>
      <RoundedBox args={bottomArgs as [number, number, number]} radius={0.08} smoothness={4} position={[0.2, garmentBase === "boxers" || garmentBase === "shorts" ? 0.76 : 0.44, 0]} castShadow><meshStandardMaterial color={lowerColor} roughness={0.72} /></RoundedBox>

      {accessories?.backpack !== "none" ? <RoundedBox args={[0.54, 0.62, 0.22]} radius={0.06} smoothness={4} position={[0, 1.34, -0.33]}><meshStandardMaterial color="#111827" roughness={0.8} /></RoundedBox> : null}
    </group>
  );
}

function SceneContent({ maps, previewMode, bodyType, view, itemType, garmentColor, rotation, concept, garmentBase, garmentVariant, accessories }: {
  maps: ClothingMaps | null;
  previewMode: PreviewMode;
  bodyType: string;
  view: "front" | "back";
  itemType: "shirt" | "pants";
  garmentColor: string;
  rotation: number;
  concept?: StylizedOutfitConcept | null;
  garmentBase: string;
  garmentVariant: string;
  accessories?: AvatarPreviewProps["accessories"];
}) {
  return (
    <>
      <color attach="background" args={["#050814"]} />
      <fog attach="fog" args={["#050814", 5.2, 11.5]} />
      <hemisphereLight intensity={0.5} color="#dbeafe" groundColor="#0b1222" />
      <ambientLight intensity={0.24} />
      <directionalLight
        position={[4.4, 6.4, 4.2]}
        intensity={1.55}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <directionalLight position={[-3.4, 2.9, -4]} intensity={0.32} color="#93c5fd" />
      <pointLight position={[0, 3.8, 2.6]} intensity={0.2} color="#fef3c7" />
      <pointLight position={[2.4, 1.8, -2.2]} intensity={0.18} color="#f5d0fe" />
      <group rotation-y={rotation}>
        {previewMode === "classic_2d" && maps ? <PremiumClassicAvatar maps={maps} bodyType={bodyType} view={view} itemType={itemType} /> : null}
        {previewMode === "fashion_builder" ? <FashionBuilderAvatar view={view} bodyType={bodyType} garmentColor={garmentColor} garmentBase={garmentBase} garmentVariant={garmentVariant} concept={concept} accessories={accessories} /> : null}
      </group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.36, 0]} receiveShadow><circleGeometry args={[2.8, 64]} /><meshStandardMaterial color="#0d1324" roughness={0.96} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.355, 0]}><ringGeometry args={[1.05, 2.35, 64]} /><meshBasicMaterial color="#1e293b" transparent opacity={0.26} /></mesh>
      <OrbitControls enablePan={false} minDistance={2.3} maxDistance={6.2} target={[0, 0.9, 0]} />
    </>
  );
}

export function AvatarPreview({ textureUrl, className, avatarType = "neutral", bodyType = "regular", view: controlledView, onViewChange, itemType = "shirt", dimension, previewMode, garmentColor = "#2563eb", studioMode = false, stylizedConcept, garmentBase = "shirt", garmentVariant = "standard", accessories }: AvatarPreviewProps) {
  const resolvedMode: PreviewMode = previewMode ?? (dimension === "3d" ? "fashion_builder" : "classic_2d");
  const [internalView, setInternalView] = useState<"front" | "back">("front");
  const [zoom, setZoom] = useState(3.8);
  const [rotation, setRotation] = useState(0);
  const maps = useClothingMaps(textureUrl);

  const view = controlledView ?? internalView;
  const setView = (next: "front" | "back") => {
    if (!controlledView) setInternalView(next);
    onViewChange?.(next);
  };

  const subtitle = resolvedMode === "classic_2d" ? "Classic 2D Texture Preview" : "Fashion Builder 3D Preview";

  const scene = (
    <Canvas shadows camera={{ position: [0, 1.25, zoom], fov: 40 }} className="w-full h-full">
      <SceneContent maps={maps} previewMode={resolvedMode} bodyType={bodyType} view={view} itemType={itemType} garmentColor={garmentColor} rotation={rotation} concept={stylizedConcept} garmentBase={garmentBase} garmentVariant={garmentVariant} accessories={accessories} />
    </Canvas>
  );

  if (studioMode) {
    return <div className="relative w-full h-full">{scene}<div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur rounded-full px-4 py-2 border border-white/10"><button onClick={() => setView("front")} className={`text-xs px-3 py-1 rounded-full ${view === "front" ? "bg-white/20 text-white" : "text-white/50 hover:text-white"}`}>Front</button><button onClick={() => setView("back")} className={`text-xs px-3 py-1 rounded-full ${view === "back" ? "bg-white/20 text-white" : "text-white/50 hover:text-white"}`}>Back</button><button onClick={() => setRotation((p) => p + 0.3)} className="text-white/60 hover:text-white p-1" title="Rotate"><RotateCw className="w-3.5 h-3.5" /></button><button onClick={() => setZoom((p) => Math.min(6, p + 0.4))} className="text-white/60 hover:text-white p-1" title="Zoom out"><ZoomOut className="w-3.5 h-3.5" /></button><button onClick={() => setZoom((p) => Math.max(2.2, p - 0.4))} className="text-white/60 hover:text-white p-1" title="Zoom in"><ZoomIn className="w-3.5 h-3.5" /></button></div><div className="absolute top-4 left-4 text-[10px] uppercase tracking-widest text-white/35 font-medium">{avatarType} · {bodyType} · {subtitle}</div></div>;
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
