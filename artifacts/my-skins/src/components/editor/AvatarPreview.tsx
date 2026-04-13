import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, RoundedBox, Torus } from "@react-three/drei";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import type { StylizedOutfitConcept } from "@/lib/ai/stylized-outfit-client";
import type { AvatarCosmeticSlot, AvatarState } from "@/lib/editor/design-state";
import { defaultAvatarState } from "@/lib/editor/design-state";
import { getAvatarAssetById } from "@/lib/editor/assets";
import { resolveSlotPosition } from "@/lib/editor/avatar-slots";

type ThreeTexture = ReturnType<typeof makeTextureFromZone>;
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
  if (!ctx) return new THREE.CanvasTexture(canvas);
  ctx.fillStyle = fallback;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, zone.left, zone.top, zone.width, zone.height, 0, 0, zone.width, zone.height);
  const texture = new THREE.CanvasTexture(canvas);
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
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  grad.addColorStop(0, "#1e293b");
  grad.addColorStop(1, "#0f172a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return canvas;
}

function makeFaceTexture(faceId: string, tint: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.clearRect(0, 0, 256, 256);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = tint;
  ctx.fillStyle = tint;

  if (faceId.includes("anime")) {
    ctx.strokeStyle = "#0f172a";
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(84, 108, 30, 0.2, Math.PI - 0.2);
    ctx.arc(172, 108, 30, 0.2, Math.PI - 0.2);
    ctx.stroke();
    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.ellipse(84, 128, 16, 24, 0, 0, Math.PI * 2);
    ctx.ellipse(172, 128, 16, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(128, 186, 26, 0.2, Math.PI - 0.2);
    ctx.stroke();
  } else if (faceId.includes("stoic")) {
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(60, 105); ctx.lineTo(104, 105);
    ctx.moveTo(152, 105); ctx.lineTo(196, 105);
    ctx.moveTo(96, 184); ctx.lineTo(160, 184);
    ctx.stroke();
  } else if (faceId.includes("smiley")) {
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(84, 118, 14, 0, Math.PI * 2);
    ctx.arc(172, 118, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(128, 175, 42, 0.2, Math.PI - 0.2);
    ctx.stroke();
  } else {
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(84, 120, 13, 0, Math.PI * 2);
    ctx.arc(172, 120, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(88, 176); ctx.quadraticCurveTo(126, 206, 168, 176);
    ctx.stroke();
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(62, 92); ctx.lineTo(100, 88);
    ctx.moveTo(156, 88); ctx.lineTo(194, 92);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
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
  const faceTexture = useMemo(() => (asset?.mesh === "face_decal" ? makeFaceTexture(asset.id, color) : null), [asset?.id, asset?.mesh, color]);

  useEffect(() => () => faceTexture?.dispose(), [faceTexture]);

  if (asset?.mesh === "face_decal") {
    return <mesh position={[position[0], position[1], position[2] + 0.02]} rotation={rotation} scale={scale}><planeGeometry args={[0.34, 0.34]} /><meshStandardMaterial map={faceTexture ?? undefined} transparent alphaTest={0.1} /></mesh>;
  }
  if (asset?.mesh === "hair_layered") {
    return <group position={position} rotation={rotation} scale={scale}><RoundedBox args={[0.66, 0.32, 0.62]} radius={0.16} position={[0, -0.03, -0.02]}><meshStandardMaterial color={color} roughness={0.75} /></RoundedBox><mesh position={[-0.2, 0.15, 0.05]} rotation={[0.2, 0, -0.3]}><coneGeometry args={[0.16, 0.34, 12]} /><meshStandardMaterial color={color} roughness={0.8} /></mesh><mesh position={[0.03, 0.2, 0.07]} rotation={[0.3, 0, 0]}><coneGeometry args={[0.17, 0.38, 12]} /><meshStandardMaterial color={color} roughness={0.8} /></mesh><mesh position={[0.24, 0.13, 0.05]} rotation={[0.2, 0, 0.35]}><coneGeometry args={[0.14, 0.32, 12]} /><meshStandardMaterial color={color} roughness={0.8} /></mesh></group>;
  }
  if (asset?.mesh === "hair_bob") {
    return <group position={position} rotation={rotation} scale={scale}><RoundedBox args={[0.68, 0.28, 0.64]} radius={0.16} position={[0, 0.04, 0]}><meshStandardMaterial color={color} roughness={0.72} /></RoundedBox><RoundedBox args={[0.2, 0.32, 0.2]} radius={0.08} position={[-0.3, -0.1, -0.03]}><meshStandardMaterial color={color} roughness={0.72} /></RoundedBox><RoundedBox args={[0.2, 0.32, 0.2]} radius={0.08} position={[0.3, -0.1, -0.03]}><meshStandardMaterial color={color} roughness={0.72} /></RoundedBox></group>;
  }
  if (asset?.mesh === "hair_twintail") {
    return <group position={position} rotation={rotation} scale={scale}><RoundedBox args={[0.62, 0.24, 0.56]} radius={0.15} position={[0, 0.08, 0]}><meshStandardMaterial color={color} roughness={0.74} /></RoundedBox><mesh position={[-0.33, -0.16, 0]} rotation={[0.05, 0, 0.2]}><cylinderGeometry args={[0.07, 0.09, 0.42, 14]} /><meshStandardMaterial color={color} roughness={0.78} /></mesh><mesh position={[0.33, -0.16, 0]} rotation={[0.05, 0, -0.2]}><cylinderGeometry args={[0.07, 0.09, 0.42, 14]} /><meshStandardMaterial color={color} roughness={0.78} /></mesh></group>;
  }
  if (asset?.mesh === "hat_cap") {
    return <group position={position} rotation={rotation} scale={scale}><RoundedBox args={[0.65, 0.22, 0.6]} radius={0.15}><meshStandardMaterial color={color} roughness={0.58} /></RoundedBox><RoundedBox args={[0.38, 0.05, 0.23]} radius={0.03} position={[0, -0.03, 0.37]}><meshStandardMaterial color={color} roughness={0.56} /></RoundedBox></group>;
  }
  if (asset?.mesh === "hat_beanie") {
    return <group position={position} rotation={rotation} scale={scale}><RoundedBox args={[0.62, 0.32, 0.58]} radius={0.17}><meshStandardMaterial color={color} roughness={0.78} /></RoundedBox><RoundedBox args={[0.66, 0.09, 0.62]} radius={0.05} position={[0, -0.14, 0]}><meshStandardMaterial color="#0f172a" roughness={0.62} /></RoundedBox></group>;
  }
  if (asset?.mesh === "hat_horns") {
    return <group position={position} rotation={rotation} scale={scale}><mesh position={[-0.2, 0.1, -0.1]} rotation={[0, 0, 0.35]}><coneGeometry args={[0.06, 0.34, 16]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} /></mesh><mesh position={[0.2, 0.1, -0.1]} rotation={[0, 0, -0.35]}><coneGeometry args={[0.06, 0.34, 16]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.2} /></mesh></group>;
  }
  if (asset?.mesh === "neck_chain") {
    return <group position={position} rotation={rotation} scale={scale}><Torus args={[0.2, 0.03, 16, 36]} rotation={[Math.PI / 2, 0, 0]}><meshStandardMaterial color={color} roughness={0.35} metalness={0.74} /></Torus><mesh position={[0, -0.12, 0.08]}><octahedronGeometry args={[0.05, 0]} /><meshStandardMaterial color="#fef08a" roughness={0.3} metalness={0.66} /></mesh></group>;
  }
  if (asset?.mesh === "neck_scarf") {
    return <group position={position} rotation={rotation} scale={scale}><Torus args={[0.24, 0.06, 12, 30]} rotation={[Math.PI / 2, 0, 0]}><meshStandardMaterial color={color} roughness={0.84} /></Torus><RoundedBox args={[0.12, 0.3, 0.08]} radius={0.03} position={[0.1, -0.2, 0.2]}><meshStandardMaterial color={color} roughness={0.86} /></RoundedBox></group>;
  }
  if (asset?.mesh === "shoulder_pet") {
    return <group position={position} rotation={rotation} scale={scale}><mesh><sphereGeometry args={[0.13, 18, 18]} /><meshStandardMaterial color={color} roughness={0.45} metalness={0.1} /></mesh><mesh position={[0, -0.04, 0.1]}><sphereGeometry args={[0.07, 12, 12]} /><meshStandardMaterial color="#f8fafc" roughness={0.55} /></mesh><mesh position={[-0.035, 0.03, 0.12]}><sphereGeometry args={[0.01, 8, 8]} /><meshStandardMaterial color="#0f172a" /></mesh><mesh position={[0.035, 0.03, 0.12]}><sphereGeometry args={[0.01, 8, 8]} /><meshStandardMaterial color="#0f172a" /></mesh></group>;
  }
  if (asset?.mesh === "shoulder_armor") {
    return <group position={position} rotation={rotation} scale={scale}><RoundedBox args={[0.24, 0.17, 0.3]} radius={0.08}><meshStandardMaterial color={color} roughness={0.5} metalness={0.55} /></RoundedBox><RoundedBox args={[0.26, 0.08, 0.08]} radius={0.02} position={[0, -0.08, 0.08]}><meshStandardMaterial color="#cbd5e1" roughness={0.45} metalness={0.66} /></RoundedBox></group>;
  }
  if (asset?.mesh === "back_pack") {
    return <group position={position} rotation={rotation} scale={scale}><RoundedBox args={[0.44, 0.54, 0.2]} radius={0.08}><meshStandardMaterial color={color} roughness={0.58} /></RoundedBox><RoundedBox args={[0.14, 0.2, 0.08]} radius={0.03} position={[0, -0.08, 0.14]}><meshStandardMaterial color="#94a3b8" roughness={0.48} /></RoundedBox><RoundedBox args={[0.08, 0.55, 0.05]} radius={0.02} position={[-0.18, 0, 0.09]}><meshStandardMaterial color="#1e293b" roughness={0.72} /></RoundedBox><RoundedBox args={[0.08, 0.55, 0.05]} radius={0.02} position={[0.18, 0, 0.09]}><meshStandardMaterial color="#1e293b" roughness={0.72} /></RoundedBox></group>;
  }
  if (asset?.mesh === "back_sword") {
    return <group position={position} rotation={rotation} scale={scale}><mesh position={[-0.12, 0.2, 0.1]} rotation={[0.2, 0, -0.5]}><boxGeometry args={[0.05, 0.65, 0.08]} /><meshStandardMaterial color="#e2e8f0" metalness={0.7} roughness={0.34} /></mesh><mesh position={[0.1, 0.14, 0.06]} rotation={[0.2, 0, 0.5]}><boxGeometry args={[0.05, 0.65, 0.08]} /><meshStandardMaterial color="#cbd5e1" metalness={0.72} roughness={0.36} /></mesh><RoundedBox args={[0.25, 0.18, 0.14]} radius={0.03} position={[0, -0.06, 0]}><meshStandardMaterial color={color} roughness={0.54} /></RoundedBox></group>;
  }
  if (asset?.mesh === "footwear_sneaker") {
    return <group position={position} rotation={rotation} scale={scale}><RoundedBox args={[0.27, 0.18, 0.4]} radius={0.06}><meshStandardMaterial color={color} roughness={0.66} /></RoundedBox><RoundedBox args={[0.25, 0.05, 0.42]} radius={0.02} position={[0, -0.08, 0]}><meshStandardMaterial color="#e2e8f0" roughness={0.4} /></RoundedBox></group>;
  }
  if (asset?.mesh === "footwear_boot") {
    return <group position={position} rotation={rotation} scale={scale}><RoundedBox args={[0.28, 0.28, 0.36]} radius={0.06}><meshStandardMaterial color={color} roughness={0.54} metalness={0.2} /></RoundedBox><RoundedBox args={[0.29, 0.08, 0.38]} radius={0.02} position={[0, -0.12, 0]}><meshStandardMaterial color="#334155" roughness={0.36} /></RoundedBox></group>;
  }
  if (asset?.mesh === "aura_ring") {
    return <group position={position} rotation={rotation} scale={scale}><Torus args={[0.78, 0.05, 16, 40]} rotation={[Math.PI / 2, 0, 0]}><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} transparent opacity={0.72} /></Torus></group>;
  }
  if (asset?.mesh === "aura_flame") {
    return <group position={position} rotation={rotation} scale={scale}><Torus args={[0.78, 0.03, 10, 36]} rotation={[Math.PI / 2, 0, 0]}><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.65} transparent opacity={0.65} /></Torus>{[-0.55, -0.25, 0, 0.25, 0.55].map((x, idx) => <mesh key={idx} position={[x, 0.1 + (idx % 2 ? 0.04 : 0), 0]}><coneGeometry args={[0.08, 0.28, 10]} /><meshStandardMaterial color="#fb923c" emissive="#f97316" emissiveIntensity={0.45} transparent opacity={0.78} /></mesh>)}</group>;
  }
  if (asset?.mesh === "aura_pixels") {
    return <group position={position} rotation={rotation} scale={scale}>{[-0.55, -0.25, 0.05, 0.3, 0.6].map((x, idx) => <mesh key={idx} position={[x, idx % 2 ? 0.1 : -0.03, idx % 2 ? 0.12 : -0.12]}><boxGeometry args={[0.08, 0.08, 0.08]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.44} /></mesh>)}</group>;
  }

  return <RoundedBox args={[0.34 * scale, 0.2 * scale, 0.24 * scale]} radius={0.04} smoothness={3} position={position} rotation={rotation} castShadow><meshStandardMaterial color={color} roughness={0.6} metalness={0.1} /></RoundedBox>;
}

function RobloxAvatar({ maps, view, itemType, avatar }: { maps: ClothingMaps | null; view: "front" | "back"; itemType: "shirt" | "pants"; avatar: AvatarState }) {
  if (!maps) return null;
  const shirtMaps: FaceMaps = { front: itemType === "shirt" ? maps.shirtFront : maps.shirtSide, back: itemType === "shirt" ? maps.shirtBack : maps.shirtSide, side: maps.shirtSide };
  const pantsMaps: FaceMaps = { front: itemType === "pants" ? maps.pantsFront : maps.pantsSide, back: itemType === "pants" ? maps.pantsBack : maps.pantsSide, side: maps.pantsSide };
  const modelScale = avatar.scalePreset === "slender" ? [0.94, 1.05, 0.92] : avatar.scalePreset === "stocky" ? [1.1, 0.98, 1.1] : [1, 1, 1];
  const poseRotY = avatar.pose === "hero" ? 0.15 : avatar.pose === "walk" ? 0.06 : 0;

  return (
    <group rotation-y={view === "back" ? Math.PI : 0} scale={[modelScale[0] * avatar.bodyScale.width, modelScale[1] * avatar.bodyScale.height, modelScale[2]]}>
      <group rotation-y={poseRotY}>
        <RoundedBox args={[0.66 * avatar.bodyScale.head, 0.62 * avatar.bodyScale.head, 0.58]} radius={0.17} smoothness={6} position={[0, 2.02, 0]} castShadow>
          <meshStandardMaterial color={avatar.skinTone} roughness={0.32} metalness={0.02} />
        </RoundedBox>
        <RoundedBox args={[0.3, 0.16, 0.28]} radius={0.08} position={[0, 1.72, 0]} castShadow><meshStandardMaterial color={avatar.skinTone} roughness={0.45} /></RoundedBox>
        <TexturedBlock size={[0.95, 0.82, 0.56]} radius={0.13} position={[0, 1.33, 0]} frontMap={shirtMaps.front} backMap={shirtMaps.back} sideMap={shirtMaps.side} />
        <TexturedBlock size={[0.84, 0.4, 0.52]} radius={0.09} position={[0, 0.84, 0]} frontMap={pantsMaps.front} backMap={pantsMaps.back} sideMap={pantsMaps.side} />

        <RoundedBox args={[0.34, 0.28, 0.33]} radius={0.13} smoothness={4} position={[-0.64, 1.55, 0]} castShadow><meshStandardMaterial map={shirtMaps.side} roughness={0.58} /></RoundedBox>
        <RoundedBox args={[0.34, 0.28, 0.33]} radius={0.13} smoothness={4} position={[0.64, 1.55, 0]} castShadow><meshStandardMaterial map={shirtMaps.side} roughness={0.58} /></RoundedBox>
        <TexturedBlock size={[0.32, 0.64, 0.32]} position={[-0.64, 1.1, 0]} frontMap={shirtMaps.front} backMap={shirtMaps.back} sideMap={shirtMaps.side} />
        <TexturedBlock size={[0.32, 0.64, 0.32]} position={[0.64, 1.1, 0]} frontMap={shirtMaps.front} backMap={shirtMaps.back} sideMap={shirtMaps.side} />
        <RoundedBox args={[0.25, 0.24, 0.25]} radius={0.08} position={[-0.62, 0.73, 0]} castShadow><meshStandardMaterial color={avatar.skinTone} roughness={0.45} /></RoundedBox>
        <RoundedBox args={[0.25, 0.24, 0.25]} radius={0.08} position={[0.62, 0.73, 0]} castShadow><meshStandardMaterial color={avatar.skinTone} roughness={0.45} /></RoundedBox>

        <TexturedBlock size={[0.34, 0.84 * avatar.bodyScale.legs, 0.36]} radius={0.08} position={[-0.22, 0.46, 0]} frontMap={pantsMaps.front} backMap={pantsMaps.back} sideMap={pantsMaps.side} />
        <TexturedBlock size={[0.34, 0.84 * avatar.bodyScale.legs, 0.36]} radius={0.08} position={[0.22, 0.46, 0]} frontMap={pantsMaps.front} backMap={pantsMaps.back} sideMap={pantsMaps.side} />
      </group>
      {(["face", "hair", "hat", "neck", "leftShoulder", "rightShoulder", "back", "leftFootwear", "rightFootwear", "aura"] as AvatarCosmeticSlot[]).map((slot) => <AvatarCosmetic key={slot} slot={slot} avatar={avatar} />)}
    </group>
  );
}

function SceneContent({ maps, view, itemType, rotation, avatar }: { maps: ClothingMaps | null; view: "front" | "back"; itemType: "shirt" | "pants"; rotation: number; avatar: AvatarState }) {
  return (
    <>
      <color attach="background" args={["#0a1020"]} />
      <fog attach="fog" args={["#0a1020", 6.2, 13.8]} />
      <ambientLight intensity={0.5} />
      <hemisphereLight intensity={0.7} color="#f8fafc" groundColor="#111827" />
      <directionalLight position={[4.8, 7.2, 4.6]} intensity={1.7} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-bias={-0.0003} />
      <directionalLight position={[-3.8, 3, -3.6]} intensity={0.62} color="#93c5fd" />
      <pointLight position={[0, 3.5, 2.8]} intensity={0.32} color="#fde68a" />
      <group rotation-y={rotation}><RobloxAvatar maps={maps} view={view} itemType={itemType} avatar={avatar} /></group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.4, 0]} receiveShadow><circleGeometry args={[3.2, 64]} /><meshStandardMaterial color="#0f172a" roughness={0.92} /></mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.395, 0]}><ringGeometry args={[0.94, 2.4, 64]} /><meshBasicMaterial color="#475569" transparent opacity={0.3} /></mesh>
      <OrbitControls enablePan={false} minDistance={2.2} maxDistance={6.2} target={[0, 1.12, 0]} />
    </>
  );
}

export function AvatarPreview({ textureUrl, className, avatarType = "neutral", view: controlledView, onViewChange, itemType = "shirt", dimension, previewMode, studioMode = false, avatarState }: AvatarPreviewProps) {
  const resolvedMode: PreviewMode = previewMode ?? (dimension === "3d" ? "fashion_builder" : "classic_2d");
  const [internalView, setInternalView] = useState<"front" | "back">("front");
  const [zoom, setZoom] = useState(3.6);
  const [rotation, setRotation] = useState(0);
  const maps = useClothingMaps(textureUrl);
  const effectiveAvatar = useMemo(() => ({ ...defaultAvatarState(), ...avatarState, slots: { ...defaultAvatarState().slots, ...(avatarState?.slots ?? {}) } }), [avatarState]);
  const view = controlledView ?? internalView;
  const setView = (next: "front" | "back") => { if (!controlledView) setInternalView(next); onViewChange?.(next); };
  const subtitle = resolvedMode === "classic_2d" ? "Avatar Composition Preview" : "Avatar Composition Preview";

  const scene = <Canvas shadows camera={{ position: [0, 1.3, zoom], fov: 36 }} className="w-full h-full"><SceneContent maps={maps} view={view} itemType={itemType} rotation={rotation} avatar={effectiveAvatar} /></Canvas>;

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
