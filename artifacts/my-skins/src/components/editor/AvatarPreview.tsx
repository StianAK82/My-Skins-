import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, RoundedBox, Torus } from "@react-three/drei";
import * as THREE from "three";
import { CanvasTexture } from "three";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import type { StylizedOutfitConcept } from "@/lib/ai/stylized-outfit-client";
import type { AvatarCosmeticSlot, AvatarState } from "@/lib/editor/design-state";
import { defaultAvatarState } from "@/lib/editor/design-state";
import { getAvatarAssetById } from "@/lib/editor/assets";
import { resolveSlotPosition } from "@/lib/editor/avatar-slots";

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
  avatarState?: AvatarState;
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
  ctx.fillStyle = "#1e293b";
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
          shirtFront: makeTextureFromZone(base, SHIRT_FRONT, "#475569"),
          shirtBack: makeTextureFromZone(base, SHIRT_BACK, "#475569"),
          shirtSide: makeTextureFromZone(base, SHIRT_SIDE, "#475569"),
          pantsFront: makeTextureFromZone(base, PANTS_FRONT, "#334155"),
          pantsBack: makeTextureFromZone(base, PANTS_BACK, "#334155"),
          pantsSide: makeTextureFromZone(base, PANTS_SIDE, "#334155"),
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

function TexturedBlock({ size, position, frontMap, backMap, sideMap, radius = 0.06 }: { size: [number, number, number]; position: [number, number, number]; frontMap: ThreeTexture; backMap: ThreeTexture; sideMap: ThreeTexture; radius?: number }) {
  return (
    <RoundedBox args={size} radius={radius} smoothness={6} position={position} castShadow>
      <meshStandardMaterial attach="material-0" map={sideMap} roughness={0.62} metalness={0.03} />
      <meshStandardMaterial attach="material-1" map={sideMap} roughness={0.62} metalness={0.03} />
      <meshStandardMaterial attach="material-2" color="#1e293b" roughness={0.88} />
      <meshStandardMaterial attach="material-3" color="#111827" roughness={0.88} />
      <meshStandardMaterial attach="material-4" map={frontMap} roughness={0.6} metalness={0.03} />
      <meshStandardMaterial attach="material-5" map={backMap} roughness={0.6} metalness={0.03} />
    </RoundedBox>
  );
}

function AvatarCosmetic({ slot, avatar }: { slot: AvatarCosmeticSlot; avatar: AvatarState }) {
  const item = avatar.slots[slot];
  if (!item || !item.visible) return null;
  const asset = getAvatarAssetById(item.assetId);
  const color = item.color ?? asset?.color ?? "#94a3b8";
  const position = resolveSlotPosition(slot, avatar);
  const rotation: [number, number, number] = [THREE.MathUtils.degToRad(item.rotation.x), THREE.MathUtils.degToRad(item.rotation.y), THREE.MathUtils.degToRad(item.rotation.z)];
  const scale = item.scale;

  if (asset?.mesh === "aura") {
    return <Torus args={[0.78 * scale, 0.07, 16, 40]} position={position} rotation={[Math.PI / 2, 0, 0]}><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.45} transparent opacity={0.65} /></Torus>;
  }
  if (asset?.mesh === "ring") {
    return <Torus args={[0.2 * scale, 0.035, 16, 32]} position={position} rotation={[Math.PI / 2 + rotation[0], rotation[1], rotation[2]]}><meshStandardMaterial color={color} roughness={0.4} metalness={0.45} /></Torus>;
  }
  if (asset?.mesh === "sphere") {
    return <mesh position={position} rotation={rotation} scale={scale} castShadow><sphereGeometry args={[0.14, 18, 18]} /><meshStandardMaterial color={color} roughness={0.52} metalness={0.12} /></mesh>;
  }
  if (asset?.mesh === "cone") {
    return <mesh position={position} rotation={rotation} scale={scale} castShadow><coneGeometry args={[0.28, 0.34, 24]} /><meshStandardMaterial color={color} roughness={0.72} /></mesh>;
  }
  if (asset?.mesh === "visor") {
    return <group position={position} rotation={rotation} scale={scale}><RoundedBox args={[0.34, 0.08, 0.02]} radius={0.01}><meshStandardMaterial color={color} /></RoundedBox><mesh position={[-0.08, 0.03, 0.012]}><circleGeometry args={[0.015, 18]} /><meshStandardMaterial color="#fff" /></mesh><mesh position={[0.08, 0.03, 0.012]}><circleGeometry args={[0.015, 18]} /><meshStandardMaterial color="#fff" /></mesh></group>;
  }
  return <RoundedBox args={[0.34 * scale, 0.2 * scale, 0.24 * scale]} radius={0.04} smoothness={3} position={position} rotation={rotation} castShadow><meshStandardMaterial color={color} roughness={0.6} metalness={0.1} /></RoundedBox>;
}

function RobloxAvatar({ maps, view, itemType, avatar }: { maps: ClothingMaps | null; view: "front" | "back"; itemType: "shirt" | "pants"; avatar: AvatarState }) {
  if (!maps) return null;
  const shirtMaps: FaceMaps = { front: itemType === "shirt" ? maps.shirtFront : maps.shirtSide, back: itemType === "shirt" ? maps.shirtBack : maps.shirtSide, side: maps.shirtSide };
  const pantsMaps: FaceMaps = { front: itemType === "pants" ? maps.pantsFront : maps.pantsSide, back: itemType === "pants" ? maps.pantsBack : maps.pantsSide, side: maps.pantsSide };
  const modelScale = avatar.scalePreset === "slender" ? [0.92, 1.04, 0.9] : avatar.scalePreset === "stocky" ? [1.1, 0.98, 1.08] : [1, 1, 1];
  const poseRotY = avatar.pose === "hero" ? 0.15 : avatar.pose === "walk" ? 0.05 : 0;

  return (
    <group rotation-y={view === "back" ? Math.PI : 0} scale={[modelScale[0] * avatar.bodyScale.width, modelScale[1] * avatar.bodyScale.height, modelScale[2]]}>
      <group rotation-y={poseRotY}>
        <RoundedBox args={[0.62 * avatar.bodyScale.head, 0.58 * avatar.bodyScale.head, 0.56]} radius={0.13} smoothness={6} position={[0, 2.04, 0]} castShadow>
          <meshStandardMaterial color={avatar.skinTone} roughness={0.38} metalness={0.02} />
        </RoundedBox>
        <RoundedBox args={[0.22, 0.2, 0.2]} radius={0.06} position={[0, 1.74, 0]} castShadow><meshStandardMaterial color={avatar.skinTone} roughness={0.45} /></RoundedBox>
        <TexturedBlock size={[0.92, 0.88, 0.55]} radius={0.11} position={[0, 1.34, 0]} frontMap={shirtMaps.front} backMap={shirtMaps.back} sideMap={shirtMaps.side} />
        <TexturedBlock size={[0.8, 0.42, 0.5]} radius={0.07} position={[0, 0.84, 0]} frontMap={pantsMaps.front} backMap={pantsMaps.back} sideMap={pantsMaps.side} />
        <RoundedBox args={[0.28, 0.22, 0.28]} radius={0.1} smoothness={4} position={[-0.58, 1.56, 0]} castShadow><meshStandardMaterial map={shirtMaps.side} roughness={0.62} /></RoundedBox>
        <RoundedBox args={[0.28, 0.22, 0.28]} radius={0.1} smoothness={4} position={[0.58, 1.56, 0]} castShadow><meshStandardMaterial map={shirtMaps.side} roughness={0.62} /></RoundedBox>
        <TexturedBlock size={[0.3, 0.62, 0.3]} position={[-0.58, 1.12, 0]} frontMap={shirtMaps.front} backMap={shirtMaps.back} sideMap={shirtMaps.side} />
        <TexturedBlock size={[0.3, 0.62, 0.3]} position={[0.58, 1.12, 0]} frontMap={shirtMaps.front} backMap={shirtMaps.back} sideMap={shirtMaps.side} />
        <RoundedBox args={[0.24, 0.44, 0.24]} radius={0.06} position={[-0.56, 0.78, 0]} castShadow><meshStandardMaterial color={avatar.skinTone} roughness={0.54} /></RoundedBox>
        <RoundedBox args={[0.24, 0.44, 0.24]} radius={0.06} position={[0.56, 0.78, 0]} castShadow><meshStandardMaterial color={avatar.skinTone} roughness={0.54} /></RoundedBox>
        <TexturedBlock size={[0.32, 0.8 * avatar.bodyScale.legs, 0.34]} position={[-0.2, 0.5, 0]} frontMap={pantsMaps.front} backMap={pantsMaps.back} sideMap={pantsMaps.side} />
        <TexturedBlock size={[0.32, 0.8 * avatar.bodyScale.legs, 0.34]} position={[0.2, 0.5, 0]} frontMap={pantsMaps.front} backMap={pantsMaps.back} sideMap={pantsMaps.side} />
      </group>
      {(["face", "hair", "hat", "neck", "leftShoulder", "rightShoulder", "back", "leftFootwear", "rightFootwear", "aura"] as AvatarCosmeticSlot[]).map((slot) => <AvatarCosmetic key={slot} slot={slot} avatar={avatar} />)}
    </group>
  );
}

function SceneContent({ maps, view, itemType, rotation, avatar }: { maps: ClothingMaps | null; view: "front" | "back"; itemType: "shirt" | "pants"; rotation: number; avatar: AvatarState }) {
  return (
    <>
      <color attach="background" args={["#0b1020"]} />
      <fog attach="fog" args={["#0b1020", 5.6, 12.5]} />
      <ambientLight intensity={0.4} />
      <hemisphereLight intensity={0.58} color="#e2e8f0" groundColor="#111827" />
      <directionalLight position={[5.5, 7.2, 4.2]} intensity={1.5} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <directionalLight position={[-3, 3, -4]} intensity={0.42} color="#93c5fd" />
      <pointLight position={[0, 4.2, 2.7]} intensity={0.26} color="#fde68a" />
      <group rotation-y={rotation}><RobloxAvatar maps={maps} view={view} itemType={itemType} avatar={avatar} /></group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.38, 0]} receiveShadow><circleGeometry args={[2.9, 64]} /><meshStandardMaterial color="#111827" roughness={0.94} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.375, 0]}><ringGeometry args={[1, 2.2, 64]} /><meshBasicMaterial color="#334155" transparent opacity={0.22} /></mesh>
      <OrbitControls enablePan={false} minDistance={2.3} maxDistance={6.4} target={[0, 1.04, 0]} />
    </>
  );
}

export function AvatarPreview({ textureUrl, className, avatarType = "neutral", view: controlledView, onViewChange, itemType = "shirt", dimension, previewMode, studioMode = false, avatarState }: AvatarPreviewProps) {
  const resolvedMode: PreviewMode = previewMode ?? (dimension === "3d" ? "fashion_builder" : "classic_2d");
  const [internalView, setInternalView] = useState<"front" | "back">("front");
  const [zoom, setZoom] = useState(3.8);
  const [rotation, setRotation] = useState(0);
  const maps = useClothingMaps(textureUrl);
  const effectiveAvatar = useMemo(() => ({ ...defaultAvatarState(), ...avatarState, slots: { ...defaultAvatarState().slots, ...(avatarState?.slots ?? {}) } }), [avatarState]);
  const view = controlledView ?? internalView;
  const setView = (next: "front" | "back") => { if (!controlledView) setInternalView(next); onViewChange?.(next); };
  const subtitle = resolvedMode === "classic_2d" ? "Avatar Composition Preview" : "Avatar Composition Preview";

  const scene = <Canvas shadows camera={{ position: [0, 1.25, zoom], fov: 40 }} className="w-full h-full"><SceneContent maps={maps} view={view} itemType={itemType} rotation={rotation} avatar={effectiveAvatar} /></Canvas>;

  if (studioMode) {
    return <div className="relative w-full h-full">{scene}<div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur rounded-full px-4 py-2 border border-white/10"><button onClick={() => setView("front")} className={`text-xs px-3 py-1 rounded-full ${view === "front" ? "bg-white/20 text-white" : "text-white/50 hover:text-white"}`}>Front</button><button onClick={() => setView("back")} className={`text-xs px-3 py-1 rounded-full ${view === "back" ? "bg-white/20 text-white" : "text-white/50 hover:text-white"}`}>Back</button><button onClick={() => setRotation((p) => p + 0.3)} className="text-white/60 hover:text-white p-1" title="Rotate"><RotateCw className="w-3.5 h-3.5" /></button><button onClick={() => setZoom((p) => Math.min(6, p + 0.4))} className="text-white/60 hover:text-white p-1" title="Zoom out"><ZoomOut className="w-3.5 h-3.5" /></button><button onClick={() => setZoom((p) => Math.max(2.2, p - 0.4))} className="text-white/60 hover:text-white p-1" title="Zoom in"><ZoomIn className="w-3.5 h-3.5" /></button></div><div className="absolute top-4 left-4 text-[10px] uppercase tracking-widest text-white/35 font-medium">{avatarType} · {subtitle}</div></div>;
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
