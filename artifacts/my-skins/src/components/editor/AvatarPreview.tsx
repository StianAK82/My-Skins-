import { Component, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, RoundedBox, ContactShadows, SoftShadows } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import type { StylizedOutfitConcept } from "@/lib/ai/stylized-outfit-client";
import type { AvatarCosmeticSlot, AvatarState } from "@/lib/editor/design-state";
import { defaultAvatarState } from "@/lib/editor/design-state";
import { getAvatarAssetById, getAvatarBaseModel, type AvatarRenderPart } from "@/lib/editor/assets";
import { getSlotFit, resolveSlotPosition } from "@/lib/editor/avatar-slots";
import type { PreviewSceneSpec } from "@/lib/ai/universal-outfit";
import { disposeConstruction, materializeConstruction, verifyRenderedConstruction, type RenderedGeometryVerificationReport } from "@/lib/ai/rendered-construction";

type ThreeTexture = ReturnType<typeof makeTextureFromZone>;
type PreviewMode = "clothing" | "avatar";

export type GarmentConfig = {
  top?: "hoodie" | "zip_hoodie" | "sweater" | "tshirt" | "jersey" | "jacket" | "formal_jacket" | "winter_coat" | "dress" | null;
  bottom?: "pants" | "jeans" | "joggers" | "cargo_pants" | "shorts" | "skirt" | null;
  shoes?: "sneakers" | "boots" | null;
  shoesColor?: string | null;
};

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
  animated?: boolean;
  stylizedConcept?: StylizedOutfitConcept | null;
  garmentBase?: string;
  garmentVariant?: string;
  accessories?: { hair?: string; hat?: string; glasses?: string; beard?: string; backpack?: string };
  avatarState?: AvatarState;
  garment?: GarmentConfig;
  previewScene?: PreviewSceneSpec | null;
  onGeometryVerification?: (report: RenderedGeometryVerificationReport) => void;
  // When provided, the preview registers a function here that exports the
  // currently shown avatar (with outfit) as a binary .glb blob.
  exportRef?: MutableRefObject<(() => Promise<Blob>) | null>;
  customParts?: {
    name: string;
    shape: "horn" | "spike" | "orb" | "plate" | "band" | "snake" | "fin" | "blob" | "headcover";
    attach: "forehead" | "head_top" | "face" | "neck" | "chest" | "belly" | "back" | "hips" | "left_shoulder" | "right_shoulder" | "left_hand" | "right_hand" | "left_leg" | "right_leg" | "left_foot" | "right_foot";
    color: string;
    size: "small" | "medium" | "large";
  }[];
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
  // The atlas may be rendered at higher resolution than the 585x559 template — scale zone coords to match.
  const sourceWidth = "width" in source ? Number(source.width) : 585;
  const atlasScale = sourceWidth > 0 ? sourceWidth / 585 : 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(zone.width * atlasScale);
  canvas.height = Math.round(zone.height * atlasScale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);
  ctx.fillStyle = fallback;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, zone.left * atlasScale, zone.top * atlasScale, zone.width * atlasScale, zone.height * atlasScale, 0, 0, canvas.width, canvas.height);
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

function makeImageTexture(imagePath?: string | null) {
  if (!imagePath) return null;
  const texture = new THREE.TextureLoader().load(imagePath);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 8;
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

function makeStandardMaterial(part: AvatarRenderPart, color: string, texture: ThreeTexture | null) {
  return (
    <meshPhysicalMaterial
      color={texture ? "#ffffff" : (part.useAssetColor ? color : (part.color ?? "#94a3b8"))}
      map={texture ?? undefined}
      emissive={part.emissive}
      emissiveIntensity={part.emissiveIntensity ? part.emissiveIntensity * 3 : 0}
      transparent={part.transparent}
      opacity={part.opacity ?? 1}
      metalness={part.metalness ?? 0.05}
      roughness={part.roughness ?? 0.5}
      alphaTest={part.alphaTest}
      clearcoat={part.metalness ? 0.0 : 0.2}
      clearcoatRoughness={0.3}
    />
  );
}

function RenderAssetPart({ part, assetColor }: { part: AvatarRenderPart; assetColor: string }) {
  const texture = useMemo(() => makeImageTexture(part.texture), [part.texture]);
  useEffect(() => () => texture?.dispose(), [texture]);
  const shared = {
    position: part.position ?? [0, 0, 0],
    rotation: part.rotation ?? [0, 0, 0],
    scale: part.scale ?? [1, 1, 1],
  } as const;

  if (part.primitive === "roundedBox") {
    // Radius must stay below half the smallest dimension or the geometry folds into spikes.
    const maxRadius = Math.max(0.005, Math.min(part.args[0], part.args[1], part.args[2]) / 2 - 0.005);
    const radius = Math.min(part.radius ?? 0.04, maxRadius);
    return <RoundedBox args={part.args as [number, number, number]} radius={radius} smoothness={part.smoothness ?? 12} {...shared}>{makeStandardMaterial(part, assetColor, texture)}</RoundedBox>;
  }
  if (part.primitive === "box") {
    return <mesh {...shared}><boxGeometry args={part.args as [number, number, number]} />{makeStandardMaterial(part, assetColor, texture)}</mesh>;
  }
  if (part.primitive === "cylinder") {
    return <mesh {...shared}><cylinderGeometry args={part.args as [number, number, number, number]} />{makeStandardMaterial(part, assetColor, texture)}</mesh>;
  }
  if (part.primitive === "cone") {
    return <mesh {...shared}><coneGeometry args={part.args as [number, number, number]} />{makeStandardMaterial(part, assetColor, texture)}</mesh>;
  }
  if (part.primitive === "sphere") {
    return <mesh {...shared}><sphereGeometry args={part.args as [number, number, number]} />{makeStandardMaterial(part, assetColor, texture)}</mesh>;
  }
  if (part.primitive === "torus") {
    return <mesh {...shared}><torusGeometry args={part.args as [number, number, number, number]} />{makeStandardMaterial(part, assetColor, texture)}</mesh>;
  }
  return <mesh {...shared}><planeGeometry args={part.args as [number, number]} />{makeStandardMaterial(part, assetColor, texture)}</mesh>;
}

function AvatarCosmetic({ slot, avatar, mode }: { slot: AvatarCosmeticSlot; avatar: AvatarState; mode: PreviewMode }) {
  const item = avatar.slots[slot];
  if (!item || !item.visible || (mode === "clothing" && slot === "aura")) return null;
  const asset = getAvatarAssetById(item.assetId);
  if (!asset) return null;

  const color = item.color ?? asset.color;
  const anchor = resolveSlotPosition(slot, avatar);
  const modelAdjust = asset.modelAdjustments?.[avatar.modelVariant];
  const fit = getSlotFit(slot, avatar.modelVariant);
  const assetOffset = asset.defaultOffset ?? { x: 0, y: 0, z: 0 };
  const adjustOffset = modelAdjust?.offset ?? { x: 0, y: 0, z: 0 };
  const position: [number, number, number] = [
    anchor[0] + assetOffset.x + adjustOffset.x + fit.dx,
    anchor[1] + assetOffset.y + adjustOffset.y + fit.dy,
    anchor[2] + assetOffset.z + adjustOffset.z + fit.dz,
  ];
  const rotation: [number, number, number] = [THREE.MathUtils.degToRad(item.rotation.x), THREE.MathUtils.degToRad(item.rotation.y), THREE.MathUtils.degToRad(item.rotation.z)];
  const scale = item.scale * (asset.defaultScale ?? 1) * (modelAdjust?.scale ?? 1) * fit.scale;
  const texture = useMemo(() => makeImageTexture(asset.decalTexture), [asset.decalTexture]);
  useEffect(() => () => texture?.dispose(), [texture]);

  if (asset.renderMode === "decal") {
    return <mesh position={[position[0], position[1], position[2] + 0.02]} rotation={rotation} scale={scale}><planeGeometry args={[0.36, 0.36]} /><meshPhysicalMaterial map={texture ?? undefined} transparent alphaTest={0.1} roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} /></mesh>;
  }

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {asset.parts?.map((part, index) => <RenderAssetPart key={`${asset.id}-${index}`} part={part} assetColor={color} />)}
    </group>
  );
}

function BodyPart({ material, args, position, radius, smoothness, maps, skinTone }: {
  material: "skin" | "shirt" | "pants";
  args: [number, number, number];
  position: [number, number, number];
  radius: number;
  smoothness: number;
  maps: { shirt: FaceMaps; pants: FaceMaps };
  skinTone: string;
}) {
  if (material === "skin") {
    return <RoundedBox args={args} radius={radius} smoothness={smoothness} position={position} castShadow frustumCulled={false}><meshPhysicalMaterial color={skinTone} roughness={0.6} metalness={0.05} /></RoundedBox>;
  }
  const mapSet = material === "shirt" ? maps.shirt : maps.pants;
  const baseColor = "#ffffff";
  const topColor = "#ffffff";
  const bottomColor = "#ffffff";
  return (
    <RoundedBox args={args} radius={radius} smoothness={smoothness} position={position} castShadow frustumCulled={false}>
      <meshPhysicalMaterial attach="material-0" map={mapSet.side} color={baseColor} roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
      <meshPhysicalMaterial attach="material-1" map={mapSet.side} color={baseColor} roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
      <meshPhysicalMaterial attach="material-2" color={topColor} roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
      <meshPhysicalMaterial attach="material-3" color={bottomColor} roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
      <meshPhysicalMaterial attach="material-4" map={mapSet.front} color={baseColor} roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
      <meshPhysicalMaterial attach="material-5" map={mapSet.back} color={baseColor} roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
    </RoundedBox>
  );
}

function sampleTextureColor(texture: ThreeTexture | null): string {
  if (!texture?.image) return "#ffffff";
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "#ffffff";
    ctx.drawImage(texture.image, 0, 0, 1, 1);
    const pixel = ctx.getImageData(0, 0, 1, 1).data;
    return `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
  } catch {
    return "#ffffff";
  }
}

function GarmentOverlay({
  partId, args, maps, garment, baseModelId, skinTone
}: {
  partId: string; args: [number, number, number]; maps: { shirt: FaceMaps; pants: FaceMaps }; garment?: GarmentConfig; baseModelId: string; skinTone: string;
}) {
  if (!garment) return null;
  const top = garment.top !== undefined ? garment.top : "sweater";
  const bottom = garment.bottom !== undefined ? garment.bottom : "pants";
  const shoes = garment.shoes;

  const isMainTorso = partId === "torso" || partId === "upperTorso";
  const isBottomTorso = partId === "torso" || partId === "lowerTorso" || partId === "hips";

  const isBlockyArm = baseModelId !== "proportioned_r15" && (partId === "leftUpperArm" || partId === "rightUpperArm");
  const isR15TopArm = baseModelId === "proportioned_r15" && (partId === "leftUpperArm" || partId === "rightUpperArm");
  const isR15BottomArm = baseModelId === "proportioned_r15" && (partId === "leftLowerArm" || partId === "rightLowerArm");
                      
  const isBottomLeg = (baseModelId === "proportioned_r15" && (partId === "leftLowerLeg" || partId === "rightLowerLeg")) ||
                      (baseModelId !== "proportioned_r15" && (partId === "leftLeg" || partId === "rightLeg"));
                      
  const isTopLeg = (baseModelId === "proportioned_r15" && (partId === "leftUpperLeg" || partId === "rightUpperLeg")) ||
                   (baseModelId !== "proportioned_r15" && (partId === "leftLeg" || partId === "rightLeg"));

  const shirtColor = "#ffffff";
  const pantsColor = "#ffffff";
  const shirtMapFront = maps.shirt.front;
  const shirtMapBack = maps.shirt.back;
  const shirtMapSide = maps.shirt.side;

  return (
    <>
      {top && (
        <>
          {/* HOOD - resting behind neck on main torso */}
          {(top === "hoodie" || top === "zip_hoodie") && isMainTorso && (
            <group position={[0, args[1]/2 - 0.05, -args[2]/2 - 0.05]}>
              <RoundedBox args={[args[0] * 0.8, 0.25, 0.3]} radius={0.08} smoothness={12} castShadow receiveShadow rotation={[-0.2, 0, 0]}>
                <meshPhysicalMaterial map={shirtMapBack} color={shirtColor} roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
              </RoundedBox>
            </group>
          )}

          {/* HOOD FOLDS - draped over shoulders */}
          {(top === "hoodie" || top === "zip_hoodie") && isMainTorso && (
            <group position={[0, args[1]/2 - 0.02, 0]}>
              <RoundedBox args={[args[0] * 0.9, 0.15, args[2] * 1.05]} radius={0.05} smoothness={12} castShadow receiveShadow>
                <meshPhysicalMaterial map={shirtMapFront} color={shirtColor} roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
              </RoundedBox>
            </group>
          )}

          {/* DRAWSTRINGS */}
          {(top === "hoodie" || top === "zip_hoodie") && isMainTorso && (
            <group position={[0, args[1]/2 - 0.1, args[2]/2 + 0.02]}>
              <mesh position={[-0.15, -0.15, 0]} castShadow rotation={[0, 0, 0.05]}>
                <cylinderGeometry args={[0.012, 0.012, 0.3, 8]} />
                <meshPhysicalMaterial color="#ffffff" roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
              </mesh>
              <mesh position={[-0.16, -0.3, 0]} castShadow>
                <cylinderGeometry args={[0.014, 0.014, 0.04, 8]} />
                <meshPhysicalMaterial color="#94a3b8" roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
              </mesh>
              
              <mesh position={[0.15, -0.15, 0]} castShadow rotation={[0, 0, -0.05]}>
                <cylinderGeometry args={[0.012, 0.012, 0.3, 8]} />
                <meshPhysicalMaterial color="#ffffff" roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
              </mesh>
              <mesh position={[0.16, -0.3, 0]} castShadow>
                <cylinderGeometry args={[0.014, 0.014, 0.04, 8]} />
                <meshPhysicalMaterial color="#94a3b8" roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
              </mesh>
            </group>
          )}

          {/* KANGAROO POCKET */}
          {top === "hoodie" && isBottomTorso && (
            <group position={[0, -args[1]/2 + 0.25, args[2]/2 + 0.02]}>
              <RoundedBox args={[args[0] * 0.7, 0.35, 0.08]} radius={0.04} smoothness={12} castShadow receiveShadow>
                <meshPhysicalMaterial map={shirtMapFront} color={shirtColor} roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
              </RoundedBox>
              {/* Pocket seams/openings */}
              <mesh position={[-args[0] * 0.35 + 0.04, 0, 0.03]} rotation={[0, 0, 0.4]}>
                <cylinderGeometry args={[0.02, 0.02, 0.25, 8]} />
                <meshPhysicalMaterial color="#0f172a" opacity={0.3} transparent roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
              </mesh>
              <mesh position={[args[0] * 0.35 - 0.04, 0, 0.03]} rotation={[0, 0, -0.4]}>
                <cylinderGeometry args={[0.02, 0.02, 0.25, 8]} />
                <meshPhysicalMaterial color="#0f172a" opacity={0.3} transparent roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
              </mesh>
            </group>
          )}

          {/* COLLAR (SWEATER & TSHIRT) */}
          {(top === "sweater" || top === "tshirt" || top === "jersey") && isMainTorso && (
            <group position={[0, args[1]/2, 0]}>
              <RoundedBox args={[args[0] * 0.45, 0.06, args[2] * 0.5]} radius={0.02} smoothness={12} castShadow receiveShadow>
                <meshPhysicalMaterial map={shirtMapFront} color={shirtColor} roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
              </RoundedBox>
            </group>
          )}

          {/* JACKET COLLAR - fold-over style */}
          {(top === "jacket" || top === "formal_jacket" || top === "winter_coat") && isMainTorso && (
            <group position={[0, args[1]/2 - 0.03, args[2]/2 + 0.01]}>
              <RoundedBox args={[args[0] * 0.5, 0.14, 0.08]} radius={0.03} smoothness={12} castShadow receiveShadow rotation={[0.3, 0, 0]}>
                <meshPhysicalMaterial map={shirtMapFront} color={shirtColor} roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
              </RoundedBox>
            </group>
          )}

          {/* JACKET FRONT PLACKET (vertical opening) */}
          {(top === "jacket" || top === "formal_jacket" || top === "winter_coat" || top === "zip_hoodie") && isMainTorso && (
            <>
              <group position={[0.08, 0, args[2]/2 + 0.015]}>
                <RoundedBox args={[0.06, args[1] * 0.9, 0.02]} radius={0.01} smoothness={12} castShadow receiveShadow>
                  <meshPhysicalMaterial color="#1e293b" roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
                </RoundedBox>
              </group>
              <group position={[-0.08, 0, args[2]/2 + 0.015]}>
                <RoundedBox args={[0.06, args[1] * 0.9, 0.02]} radius={0.01} smoothness={12} castShadow receiveShadow>
                  <meshPhysicalMaterial color="#1e293b" roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
                </RoundedBox>
              </group>
            </>
          )}

          {/* DRESS - fitted bodice */}
          {top === "dress" && (isMainTorso || isBottomTorso) && (
            <BodyPart
              material="shirt"
              args={[args[0] * 1.04, args[1] * 0.98, args[2] * 1.04]}
              position={[0, 0, 0]}
              radius={0.06}
              smoothness={12}
              maps={maps}
              skinTone={skinTone}
            />
          )}

          {/* PRINCESS GOWN SKIRT — one big bell from the waist down (like the
              real Roblox ballgowns), rendered ONCE on the lower torso instead
              of per-leg puffs. */}
          {top === "dress" && (partId === "lowerTorso" || partId === "hips" || (partId === "torso" && baseModelId !== "proportioned_r15" && baseModelId !== "heroic")) && (
            <group position={[0, -args[1] / 2, 0]} scale={[1, 1, Math.max(0.7, args[2] / args[0])]}>
              {/* main bell */}
              <mesh position={[0, -args[1] * 0.7, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[args[0] * 0.58, args[0] * 1.1, args[1] * 1.6, 24]} />
                <meshPhysicalMaterial map={maps.shirt.front} color={shirtColor} roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
              </mesh>
              {/* hem ring for a soft rounded bottom edge */}
              <mesh position={[0, -args[1] * 1.5, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <torusGeometry args={[args[0] * 1.06, args[0] * 0.07, 12, 32]} />
                <meshPhysicalMaterial map={maps.shirt.front} color={shirtColor} roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
              </mesh>
              {/* waist sash */}
              <mesh position={[0, 0.02, 0]} castShadow>
                <cylinderGeometry args={[args[0] * 0.64, args[0] * 0.66, 0.1, 24]} />
                <meshPhysicalMaterial color={shirtColor} roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
              </mesh>
            </group>
          )}

          {/* PUFF SLEEVES — small rounded shoulder puffs, classic princess look */}
          {top === "dress" && (isBlockyArm || isR15TopArm) && (
            <group position={[0, args[1] * (isR15TopArm ? 0.3 : 0.35), 0]}>
              <mesh castShadow scale={[1.25, 0.9, 1.25]}>
                <sphereGeometry args={[Math.max(args[0], args[2]) * 0.62, 16, 16]} />
                <meshPhysicalMaterial map={maps.shirt.side} color={shirtColor} roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
              </mesh>
            </group>
          )}

          {/* RIBBED HEM (TORSO) */}
          {(top === "hoodie" || top === "zip_hoodie" || top === "sweater" || top === "jacket" || top === "formal_jacket" || top === "winter_coat") && isBottomTorso && (
            <group position={[0, -args[1]/2 + 0.06, 0]}>
              <RoundedBox args={[args[0] * 1.05, 0.12, args[2] * 1.05]} radius={0.02} smoothness={12} castShadow receiveShadow>
                <meshPhysicalMaterial map={shirtMapFront} color={shirtColor} roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
              </RoundedBox>
              {/* Little detail indent for the hem */}
              <mesh position={[0, 0.06, args[2]*0.52]} rotation={[0, 0, 0]}>
                <boxGeometry args={[args[0]*1.03, 0.01, 0.02]} />
                <meshPhysicalMaterial color="#0f172a" opacity={0.15} transparent roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
              </mesh>
            </group>
          )}

          {/* ARM CUFFS (HOODIE, SWEATER, JACKET) */}
          {(top === "hoodie" || top === "zip_hoodie" || top === "sweater" || top === "jacket" || top === "formal_jacket" || top === "winter_coat") && (isBlockyArm || isR15BottomArm) && (
            <group position={[0, -args[1]/2 + 0.05, 0]}>
              <RoundedBox args={[args[0] * 1.1, 0.12, args[2] * 1.1]} radius={0.02} smoothness={12} castShadow receiveShadow>
                <meshPhysicalMaterial map={shirtMapSide} color={shirtColor} roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
              </RoundedBox>
            </group>
          )}

          {/* TSHIRT SLEEVE HEM */}
          {(top === "tshirt" || top === "jersey") && (
            <>
              {isBlockyArm && (
                <group position={[0, 0, 0]}>
                  <RoundedBox args={[args[0] * 1.1, 0.08, args[2] * 1.1]} radius={0.02} smoothness={12} castShadow receiveShadow>
                    <meshPhysicalMaterial map={shirtMapSide} color={shirtColor} roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
                  </RoundedBox>
                </group>
              )}
              {isR15TopArm && (
                <group position={[0, -args[1]/2 + 0.04, 0]}>
                  <RoundedBox args={[args[0] * 1.1, 0.08, args[2] * 1.1]} radius={0.02} smoothness={12} castShadow receiveShadow>
                    <meshPhysicalMaterial map={shirtMapSide} color={shirtColor} roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
                  </RoundedBox>
                </group>
              )}
            </>
          )}

          {/* FULL ARM PADDING (HOODIE, SWEATER, JACKET) */}
          {(top === "hoodie" || top === "zip_hoodie" || top === "sweater" || top === "jacket" || top === "formal_jacket" || top === "winter_coat") && (isBlockyArm || isR15TopArm || isR15BottomArm) && (
            <BodyPart
              material="shirt"
              args={[args[0] * 1.05, args[1] * 0.98, args[2] * 1.05]}
              position={[0, 0, 0]}
              radius={0.06}
              smoothness={12}
              maps={maps}
              skinTone={skinTone}
            />
          )}

          {/* HALF ARM PADDING (TSHIRT) */}
          {(top === "tshirt" || top === "jersey") && (
            <>
              {isBlockyArm && (
                <group position={[0, args[1]*0.25, 0]}>
                  <BodyPart
                    material="shirt"
                    args={[args[0] * 1.05, args[1] * 0.5, args[2] * 1.05]}
                    position={[0, 0, 0]}
                    radius={0.06}
                    smoothness={12}
                    maps={maps}
                    skinTone={skinTone}
                  />
                </group>
              )}
              {isR15TopArm && (
                <BodyPart
                  material="shirt"
                  args={[args[0] * 1.05, args[1] * 0.98, args[2] * 1.05]}
                  position={[0, 0, 0]}
                  radius={0.06}
                  smoothness={12}
                  maps={maps}
                  skinTone={skinTone}
                />
              )}
            </>
          )}

          {/* TORSO PADDING (makes the garment look thick) */}
          {(isMainTorso || isBottomTorso) && (
            <BodyPart
              material="shirt"
              args={[args[0] * 1.04, args[1] * 0.98, args[2] * 1.04]}
              position={[0, 0, 0]}
              radius={0.06}
              smoothness={12}
              maps={maps}
              skinTone={skinTone}
            />
          )}
        </>
      )}

      {/* PANTS */}
      {(bottom === "pants" || bottom === "jeans" || bottom === "joggers" || bottom === "cargo_pants") && (
        <>
          {(isBottomLeg || isTopLeg) && (
            <BodyPart
              material="pants"
              args={[args[0] * 1.08, args[1] * 0.98, args[2] * 1.08]}
              position={[0, 0, 0]}
              radius={0.06}
              smoothness={12}
              maps={maps}
              skinTone={skinTone}
            />
          )}
          {isBottomLeg && (
            <group position={[0, -args[1]/2 + 0.05, 0]}>
              <RoundedBox args={[args[0] * 1.12, 0.1, args[2] * 1.12]} radius={0.02} smoothness={12} castShadow receiveShadow>
                <meshPhysicalMaterial map={maps.pants.front} color={pantsColor} roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
              </RoundedBox>
            </group>
          )}
          {isTopLeg && (
            <group position={[0, args[1]/2 - 0.04, 0]}>
              <RoundedBox args={[args[0] * 1.1, 0.08, args[2] * 1.1]} radius={0.02} smoothness={12} castShadow receiveShadow>
                <meshPhysicalMaterial map={maps.pants.front} color={pantsColor} roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
              </RoundedBox>
            </group>
          )}
          {bottom === "cargo_pants" && isTopLeg && <RoundedBox position={[partId.startsWith("left") ? -args[0] * .58 : args[0] * .58, 0, 0]} args={[args[0] * .32, args[1] * .38, args[2] * .75]} radius={.03} smoothness={8} castShadow><meshPhysicalMaterial map={maps.pants.side} roughness={.86} /></RoundedBox>}
        </>
      )}

      {/* SHORTS */}
      {bottom === "shorts" && (
        <>
          {isTopLeg && (
            <group position={[0, baseModelId === 'proportioned_r15' ? 0 : args[1]*0.25, 0]}>
              <BodyPart
                material="pants"
                args={[args[0] * 1.08, baseModelId === 'proportioned_r15' ? args[1] * 0.98 : args[1] * 0.5, args[2] * 1.08]}
                position={[0, 0, 0]}
                radius={0.06}
                smoothness={12}
                maps={maps}
                skinTone={skinTone}
              />
              <group position={[0, baseModelId === 'proportioned_r15' ? -args[1]/2 + 0.05 : -args[1]*0.25 + 0.05, 0]}>
                <RoundedBox args={[args[0] * 1.1, 0.08, args[2] * 1.1]} radius={0.02} smoothness={12} castShadow receiveShadow>
                  <meshPhysicalMaterial map={maps.pants.front} color={pantsColor} roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
                </RoundedBox>
              </group>
              <group position={[0, args[1]/2 - 0.04, 0]}>
                <RoundedBox args={[args[0] * 1.1, 0.08, args[2] * 1.1]} radius={0.02} smoothness={12} castShadow receiveShadow>
                  <meshPhysicalMaterial map={maps.pants.front} color={pantsColor} roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
                </RoundedBox>
              </group>
            </group>
          )}
        </>
      )}

      {/* SKIRT */}
      {bottom === "skirt" && top !== "dress" && isTopLeg && (
        <group position={[0, baseModelId === 'proportioned_r15' ? 0 : args[1]*0.15, 0]}>
          {/* Fitted waistband */}
          <group position={[0, args[1]/2 - 0.04, 0]}>
            <RoundedBox args={[args[0] * 1.1, 0.08, args[2] * 1.1]} radius={0.02} smoothness={12} castShadow receiveShadow>
              <meshPhysicalMaterial map={maps.pants.front} color={pantsColor} roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
            </RoundedBox>
          </group>
          {/* Flared A-line skirt volume */}
          <group position={[0, baseModelId === 'proportioned_r15' ? -0.05 : 0.1, 0]}>
            <mesh castShadow receiveShadow rotation={[0, 0, 0]}>
              <cylinderGeometry args={[args[0] * 1.4, args[0] * 1.12, baseModelId === 'proportioned_r15' ? args[1] * 0.85 : args[1] * 0.65, 16]} />
              <meshPhysicalMaterial map={maps.pants.front} color={pantsColor} roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
            </mesh>
          </group>
        </group>
      )}

      {/* (Princess gown skirt renders once on the lower torso — no per-leg puffs.) */}

      {/* SNEAKERS */}
      {shoes === "sneakers" && isBottomLeg && (
        <>
          {(() => {
            const shoeBodyColor = garment.shoesColor || (sampleTextureColor(maps.pants.front) !== "#ffffff" ? sampleTextureColor(maps.pants.front) : "#f8fafc");
            const soleColor = "#cbd5e1";
            const laceColor = "#0f172a";
            
            return (
              <group position={[0, -args[1]/2 - 0.02, 0]}>
                {/* Main shoe body - chunky rounded box wrapping the foot */}
                <RoundedBox args={[args[0] * 1.18, 0.22, args[2] * 1.3]} radius={0.08} smoothness={6} castShadow receiveShadow>
                  <meshPhysicalMaterial color={shoeBodyColor} roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
                </RoundedBox>
                
                {/* Sole slab underneath - lighter and wider */}
                <group position={[0, -0.14, 0.02]}>
                  <RoundedBox args={[args[0] * 1.22, 0.08, args[2] * 1.34]} radius={0.04} smoothness={6} castShadow receiveShadow>
                    <meshPhysicalMaterial color={soleColor} roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
                  </RoundedBox>
                </group>
                
                {/* Toe cap - rounded protective front */}
                <group position={[0, -0.04, args[2] * 0.65 + 0.02]}>
                  <RoundedBox args={[args[0] * 1.16, 0.16, args[2] * 0.24]} radius={0.08} smoothness={6} castShadow receiveShadow>
                    <meshPhysicalMaterial color={soleColor} roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
                  </RoundedBox>
                </group>
                
                {/* Tongue hint - small padded piece near ankle */}
                <group position={[0, 0.08, args[2] * 0.3]}>
                  <RoundedBox args={[args[0] * 0.6, 0.18, 0.08]} radius={0.04} smoothness={12} castShadow receiveShadow>
                    <meshPhysicalMaterial color={shoeBodyColor} roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
                  </RoundedBox>
                </group>
                
                {/* Lace hints - two small horizontal bars */}
                <group position={[0, 0.04, args[2] * 0.4]}>
                  <mesh castShadow>
                    <cylinderGeometry args={[0.015, 0.015, args[0] * 0.7, 8]} />
                    <meshPhysicalMaterial color={laceColor} roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
                  </mesh>
                </group>
                <group position={[0, 0.08, args[2] * 0.25]}>
                  <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
                    <cylinderGeometry args={[0.015, 0.015, args[0] * 0.65, 8]} />
                    <meshPhysicalMaterial color={laceColor} roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
                  </mesh>
                </group>
              </group>
            );
          })()}
        </>
      )}

      {/* BOOTS - taller than sneakers, chunkier */}
      {shoes === "boots" && isBottomLeg && (
        <>
          {(() => {
            const bootBodyColor = garment.shoesColor || (sampleTextureColor(maps.pants.front) !== "#ffffff" ? sampleTextureColor(maps.pants.front) : "#1e293b");
            const bootSoleColor = "#475569";
            
            return (
              <group position={[0, -args[1]/2 - 0.02, 0]}>
                {/* Main boot shaft - tall, reaching up the leg */}
                <RoundedBox args={[args[0] * 1.2, args[1] * 0.7, args[2] * 1.32]} radius={0.09} smoothness={6} castShadow receiveShadow>
                  <meshPhysicalMaterial color={bootBodyColor} roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
                </RoundedBox>
                
                {/* Chunky sole platform */}
                <group position={[0, -args[1] * 0.35 - 0.08, 0.02]}>
                  <RoundedBox args={[args[0] * 1.24, 0.16, args[2] * 1.36]} radius={0.05} smoothness={6} castShadow receiveShadow>
                    <meshPhysicalMaterial color={bootSoleColor} roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
                  </RoundedBox>
                </group>
                
                {/* Toe guard reinforcement */}
                <group position={[0, -args[1] * 0.3, args[2] * 0.66 + 0.02]}>
                  <RoundedBox args={[args[0] * 1.18, 0.2, args[2] * 0.26]} radius={0.09} smoothness={6} castShadow receiveShadow>
                    <meshPhysicalMaterial color={bootSoleColor} roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
                  </RoundedBox>
                </group>
                
                {/* Upper cuff/collar */}
                <group position={[0, args[1] * 0.35 - 0.04, 0]}>
                  <RoundedBox args={[args[0] * 1.22, 0.1, args[2] * 1.34]} radius={0.03} smoothness={12} castShadow receiveShadow>
                    <meshPhysicalMaterial color={bootSoleColor} roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
                  </RoundedBox>
                </group>
              </group>
            );
          })()}
        </>
      )}
    </>
  );
}


function CustomPartsOverlay({ partId, args, customParts, baseModelId }: { partId: string; args: [number, number, number]; customParts?: AvatarPreviewProps["customParts"]; baseModelId: string }) {
  if (!customParts || customParts.length === 0) return null;

  const mapAttachToPartId = (attach: string): string[] => {
    switch (attach) {
      case "forehead":
      case "head_top":
      case "face": return ["head"];
      case "neck": return ["neck"];
      case "chest": return baseModelId === "proportioned_r15" ? ["upperTorso"] : ["torso"];
      case "belly": return baseModelId === "proportioned_r15" ? ["lowerTorso"] : ["torso"];
      case "back": return baseModelId === "proportioned_r15" ? ["upperTorso"] : ["torso"];
      case "hips": return baseModelId === "proportioned_r15" ? ["lowerTorso"] : baseModelId === "heroic" ? ["hips"] : ["torso"];
      case "left_shoulder": return ["leftUpperArm"];
      case "right_shoulder": return ["rightUpperArm"];
      case "left_hand": return baseModelId === "proportioned_r15" ? ["leftHand"] : ["leftHand"]; 
      case "right_hand": return baseModelId === "proportioned_r15" ? ["rightHand"] : ["rightHand"];
      case "left_leg": return baseModelId === "proportioned_r15" ? ["leftUpperLeg", "leftLowerLeg"] : ["leftLeg"];
      case "right_leg": return baseModelId === "proportioned_r15" ? ["rightUpperLeg", "rightLowerLeg"] : ["rightLeg"];
      case "left_foot": return baseModelId === "proportioned_r15" ? ["leftLowerLeg"] : ["leftLeg"];
      case "right_foot": return baseModelId === "proportioned_r15" ? ["rightLowerLeg"] : ["rightLeg"];
      default: return [];
    }
  };

  // Headcovers wrap the whole head — several stacked on the same body part just
  // hide each other (and can swallow the figure), so keep only the first one.
  let headcoverSeen = false;
  const matchingParts = customParts
    .filter(p => mapAttachToPartId(p.attach).includes(partId))
    .filter(p => {
      if (p.shape !== "headcover") return true;
      if (headcoverSeen) return false;
      headcoverSeen = true;
      return true;
    });
  if (matchingParts.length === 0) return null;

  return (
    <>
      {matchingParts.map((p, i) => {
        let pos: [number, number, number] = [0, 0, 0];
        let rot: [number, number, number] = [0, 0, 0];
        let scaleMulti = p.size === "small" ? 0.6 : p.size === "large" ? 1.4 : 1;
        // Clamp headcovers: the shell is already sized relative to the head (1.18x),
        // so extra size multipliers would hide the face/body. Never exceed 1.
        if (p.shape === "headcover") scaleMulti = Math.min(scaleMulti, 1);

        switch (p.attach) {
          case "forehead": pos = [0, args[1]*0.2, args[2]*0.5]; rot = [0.2, 0, 0]; break;
          case "head_top": pos = [0, args[1]*0.5, 0]; rot = [-Math.PI/2, 0, 0]; break;
          case "face": pos = [0, -args[1]*0.1, args[2]*0.5]; break;
          case "neck": pos = [0, 0, args[2]*0.5]; break;
          case "chest": pos = [0, baseModelId === "proportioned_r15" ? 0 : args[1]*0.2, args[2]*0.5]; break;
          case "belly": pos = [0, baseModelId === "proportioned_r15" ? 0 : -args[1]*0.2, args[2]*0.5]; break;
          case "back": pos = [0, baseModelId === "proportioned_r15" ? 0 : args[1]*0.2, -args[2]*0.5]; rot = [0, Math.PI, 0]; break;
          case "hips": pos = [0, baseModelId === "proportioned_r15" ? 0 : -args[1]*0.4, args[2]*0.5]; break;
          case "left_shoulder": pos = [-args[0]*0.1, args[1]*0.5, 0]; rot = [-Math.PI/2, -0.2, 0]; break;
          case "right_shoulder": pos = [args[0]*0.1, args[1]*0.5, 0]; rot = [-Math.PI/2, 0.2, 0]; break;
          case "left_hand": pos = [0, -args[1]*0.1, args[2]*0.5]; rot = [0, 0, 0]; break;
          case "right_hand": pos = [0, -args[1]*0.1, args[2]*0.5]; rot = [0, 0, 0]; break;
          case "left_leg": pos = [0, 0, args[2]*0.5]; break;
          case "right_leg": pos = [0, 0, args[2]*0.5]; break;
          case "left_foot": pos = [0, baseModelId === "proportioned_r15" ? -args[1]*0.4 : -args[1]*0.4, args[2]*0.5]; rot = [0.2, 0, 0]; break;
          case "right_foot": pos = [0, baseModelId === "proportioned_r15" ? -args[1]*0.4 : -args[1]*0.4, args[2]*0.5]; rot = [0.2, 0, 0]; break;
        }

        const partScale: [number, number, number] = [scaleMulti, scaleMulti, scaleMulti];

        const renderShape = () => {
          const m = <meshPhysicalMaterial color={p.color} roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />;
          switch (p.shape) {
            case "horn":
              // Tilt the horn upward so it never points straight at the camera
              // (a forward-facing cone foreshortens into a circle and reads as a ball).
              return (
                <group position={[0, 0, 0]} rotation={[-0.55, 0, 0]}>
                  <mesh position={[0, 0, 0.1]} rotation={[Math.PI/2, 0, 0]}>
                    <cylinderGeometry args={[0.10, 0.14, 0.2, 16]} />
                    {m}
                  </mesh>
                  <mesh position={[0, 0.02, 0.28]} rotation={[Math.PI/2 - 0.15, 0, 0]}>
                    <cylinderGeometry args={[0.06, 0.10, 0.2, 16]} />
                    {m}
                  </mesh>
                  <mesh position={[0, 0.06, 0.46]} rotation={[Math.PI/2 - 0.3, 0, 0]}>
                    <cylinderGeometry args={[0.02, 0.06, 0.2, 16]} />
                    {m}
                  </mesh>
                  <mesh position={[0, 0.13, 0.62]} rotation={[Math.PI/2 - 0.45, 0, 0]}>
                    <coneGeometry args={[0.02, 0.2, 16]} />
                    {m}
                  </mesh>
                </group>
              );
            case "spike":
              if (p.attach === "back") {
                return (
                  <group position={[0, 0, 0]}>
                    <mesh position={[0, 0.2, 0.05]} rotation={[Math.PI/2 + 0.2, 0, 0]}><coneGeometry args={[0.06, 0.2, 4]} />{m}</mesh>
                    <mesh position={[0, 0, 0.05]} rotation={[Math.PI/2, 0, 0]}><coneGeometry args={[0.08, 0.25, 4]} />{m}</mesh>
                    <mesh position={[0, -0.2, 0.05]} rotation={[Math.PI/2 - 0.2, 0, 0]}><coneGeometry args={[0.06, 0.2, 4]} />{m}</mesh>
                  </group>
                );
              }
              return (
                <group position={[0, 0, 0]}>
                  <mesh position={[0, 0.05, 0.1]} rotation={[Math.PI/2, 0, 0]}><coneGeometry args={[0.05, 0.2, 4]} />{m}</mesh>
                  <mesh position={[0.08, -0.05, 0.08]} rotation={[Math.PI/2, 0.3, 0]}><coneGeometry args={[0.04, 0.15, 4]} />{m}</mesh>
                  <mesh position={[-0.08, -0.05, 0.08]} rotation={[Math.PI/2, -0.3, 0]}><coneGeometry args={[0.04, 0.15, 4]} />{m}</mesh>
                </group>
              );
            case "orb":
              return (
                <mesh position={[0, 0, 0.15]}>
                  <sphereGeometry args={[0.12, 24, 24]} />
                  <meshPhysicalMaterial color={p.color} emissive={p.color} emissiveIntensity={1.5} toneMapped={false} roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
                </mesh>
              );
            case "plate":
              return (
                <group position={[0, 0, 0.03]}>
                  <RoundedBox args={[0.3, 0.3, 0.06]} radius={0.02} smoothness={12}>{m}</RoundedBox>
                </group>
              );
            case "band":
              // Elliptical band hugging the attached body part (was a wide circular
              // "hula hoop" floating around the waist). Local Y is squashed to the
              // part's depth so the ring follows the body silhouette.
              return (
                <group rotation={[Math.PI/2, 0, 0]} position={[0, 0, -args[2]*0.5]} scale={[1, Math.max(args[2] / Math.max(args[0], 0.01), 0.45), 1]}>
                  <mesh><torusGeometry args={[args[0] * 0.58 + 0.03, 0.045, 16, 40]} />{m}</mesh>
                </group>
              );
            case "snake":
              return (
                <group position={[0, 0, 0]} scale={[1.4, 1.4, 1.4]}>
                  {Array.from({length: 12}).map((_, j) => {
                    const t = j / 11;
                    const z = t * 0.34;
                    const x = Math.sin(t * Math.PI * 2.5) * 0.07;
                    const y = t * 0.06;
                    const radius = 0.075 * (1 - t * 0.2);
                    return (
                      <mesh key={j} position={[x, y, z]}>
                        <sphereGeometry args={[radius, 16, 16]} />
                        {m}
                      </mesh>
                    );
                  })}
                  <group position={[Math.sin(1 * Math.PI * 2.5) * 0.07, 0.06, 0.34 + 0.03]} rotation={[0.2, Math.cos(1 * Math.PI * 2.5) * -0.5, 0]}>
                    <mesh scale={[1.25, 0.8, 1.45]}><sphereGeometry args={[0.075, 16, 16]} />{m}</mesh>
                    <mesh position={[-0.025, 0.02, 0.045]}><sphereGeometry args={[0.015]} /><meshBasicMaterial color="#ffffff" /><mesh position={[0, 0, 0.01]}><sphereGeometry args={[0.007]} /><meshBasicMaterial color="#000000" /></mesh></mesh>
                    <mesh position={[0.025, 0.02, 0.045]}><sphereGeometry args={[0.015]} /><meshBasicMaterial color="#ffffff" /><mesh position={[0, 0, 0.01]}><sphereGeometry args={[0.007]} /><meshBasicMaterial color="#000000" /></mesh></mesh>
                    <mesh position={[0, -0.01, 0.08]} rotation={[Math.PI/2, 0, 0]}><coneGeometry args={[0.012, 0.05, 4]} /><meshBasicMaterial color="#ef4444" /></mesh>
                  </group>
                </group>
              );
            case "fin":
              return (
                <mesh position={[0, 0, 0.1]} rotation={[Math.PI/2, 0, 0]}>
                  <coneGeometry args={[0.04, 0.25, 3]} />
                  {m}
                </mesh>
              );
            case "blob":
              return (
                <mesh position={[0, 0, 0.06]}>
                  <sphereGeometry args={[0.12, 16, 16]} />
                  {m}
                </mesh>
              );
            case "headcover":
              // Wraps the whole head (marshmallow head, pumpkin head, ...):
              // a soft rounded shell slightly larger than the head part itself.
              // Rendered relative to the head group's center, ignoring the attach offset.
              // Like the real Roblox item, the cover has its OWN simple face
              // (dot eyes + smile) painted on the front — the avatar's normal
              // face is hidden while a headcover is worn.
              return (
                <group position={[-pos[0], -pos[1], -pos[2]]} rotation={[-rot[0], -rot[1], -rot[2]]}>
                  <RoundedBox
                    args={[args[0] * 1.18, args[1] * 1.18, args[2] * 1.18]}
                    radius={Math.min(args[0], args[1], args[2]) * 0.35}
                    smoothness={12}
                  >
                    <meshPhysicalMaterial color={p.color} roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />
                  </RoundedBox>
                  {(() => {
                    const z = args[2] * 0.59 + 0.012;
                    const ex = args[0] * 0.19;
                    const ey = args[1] * 0.12;
                    const dark = "#141414";
                    return (
                      <group>
                        {/* dot eyes */}
                        <mesh position={[-ex, ey, z]} scale={[1, 1.35, 0.4]}>
                          <sphereGeometry args={[args[0] * 0.075, 12, 12]} />
                          <meshBasicMaterial color={dark} />
                        </mesh>
                        <mesh position={[ex, ey, z]} scale={[1, 1.35, 0.4]}>
                          <sphereGeometry args={[args[0] * 0.075, 12, 12]} />
                          <meshBasicMaterial color={dark} />
                        </mesh>
                        {/* smile: torus arc, opening upwards */}
                        <mesh position={[0, -args[1] * 0.16, z]} rotation={[0, 0, Math.PI]}>
                          <torusGeometry args={[args[0] * 0.22, args[0] * 0.035, 10, 24, Math.PI]} />
                          <meshBasicMaterial color={dark} />
                        </mesh>
                      </group>
                    );
                  })()}
                </group>
              );
            default:
              return null;
          }
        };

        return (
          <group key={i} position={pos} rotation={rot} scale={partScale}>
            {renderShape()}
          </group>
        );
      })}
    </>
  );
}

function RobloxAvatar({ maps, view, itemType, avatar, mode, garment, customParts }: { maps: ClothingMaps | null; view: "front" | "back"; itemType: "shirt" | "pants"; avatar: AvatarState; mode: PreviewMode; garment?: GarmentConfig; customParts?: AvatarPreviewProps["customParts"] }) {
  if (!maps) return null;
  // Show the full outfit: shirt zones on the torso/arms and pants zones on the legs.
  void itemType;
  const shirtMaps: FaceMaps = { front: maps.shirtFront, back: maps.shirtBack, side: maps.shirtSide };
  // Leg sides sample the front zone: the side zone (x=44) is unpainted in the shirt-template atlas.
  const pantsMaps: FaceMaps = { front: maps.pantsFront, back: maps.pantsBack, side: maps.pantsFront };
  const baseModel = getAvatarBaseModel(avatar.modelVariant);
  const presetScale = avatar.scalePreset === "slender" ? [0.94, 1.05, 0.92] : avatar.scalePreset === "stocky" ? [1.1, 0.98, 1.1] : [1, 1, 1];
  const poseRotY = avatar.pose === "hero" ? 0.15 : avatar.pose === "walk" ? 0.06 : 0;
  const partScaleForId = (partId: string): [number, number, number] => {
    if (partId.includes("head")) return [avatar.bodyScale.head, avatar.bodyScale.head, avatar.bodyScale.head];
    if (partId.includes("Leg")) return [1, avatar.bodyScale.legs, 1];
    return [1, 1, 1];
  };

  return (
    <group rotation-y={view === "back" ? Math.PI : 0} scale={[
      baseModel.proportions.x * presetScale[0] * avatar.bodyScale.width,
      baseModel.proportions.y * presetScale[1] * avatar.bodyScale.height,
      baseModel.proportions.z * presetScale[2],
    ]}>
      <group rotation-y={poseRotY}>
        {baseModel.bodyParts.map((part) => (
          <group key={part.id} position={part.position} scale={partScaleForId(part.id)}>
            <BodyPart material={part.material} args={part.args} position={[0, 0, 0]} radius={part.radius} smoothness={part.smoothness} maps={{ shirt: shirtMaps, pants: pantsMaps }} skinTone={avatar.skinTone} />
            <GarmentOverlay partId={part.id} args={part.args} maps={{ shirt: shirtMaps, pants: pantsMaps }} garment={garment} baseModelId={baseModel.id} skinTone={avatar.skinTone} />
            <CustomPartsOverlay partId={part.id} args={part.args} customParts={customParts} baseModelId={baseModel.id} />
          </group>
        ))}
      </group>
      {(["face", "hair", "hat", "neck", "leftShoulder", "rightShoulder", "back", "leftFootwear", "rightFootwear", "aura"] as AvatarCosmeticSlot[])
        .filter((slot) => !(garment?.shoes && (slot === "leftFootwear" || slot === "rightFootwear")))
        .filter((slot) => !(customParts?.some((p) => p.shape === "headcover") && (slot === "face" || slot === "hair" || slot === "hat")))
        .map((slot) => <AvatarCosmetic key={slot} slot={slot} avatar={avatar} mode={mode} />)}
    </group>
  );
}

// Rough low-end heuristic for kids' tablets/phones: few CPU cores or coarse
// pointer + small screen. Lowers shadow samples and skips bloom to hold 60fps.
const LOW_END_DEVICE =
  typeof navigator !== "undefined" &&
  ((navigator.hardwareConcurrency ?? 8) <= 4 ||
    (typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches && window.screen.width < 900));

function StudioEnvironment() {
  const { gl, scene } = useThree();
  
  useEffect(() => {
    let pmremGenerator: any;
    let envScene: any;
    let renderTarget: any;
    let cancelled = false;
    // @ts-ignore
    import("three/examples/jsm/environments/RoomEnvironment.js")
      .then(({ RoomEnvironment }) => {
        if (cancelled) return;
        pmremGenerator = new THREE.PMREMGenerator(gl);
        pmremGenerator.compileEquirectangularShader();
        envScene = new RoomEnvironment();
        renderTarget = pmremGenerator.fromScene(envScene);
        scene.environment = renderTarget.texture;
        // RoomEnvironment is bright — dial it down so it only adds soft reflections,
        // otherwise skin tones blow out past the bloom threshold.
        (scene as any).environmentIntensity = 0.35;
      })
      .catch((e) => console.error("Could not load RoomEnvironment", e));

    return () => {
      cancelled = true;
      scene.environment = null;
      // Dispose the PMREM render target (and its texture) too, or GPU memory
      // accumulates on every remount of the preview.
      if (renderTarget) renderTarget.dispose();
      if (pmremGenerator) pmremGenerator.dispose();
      if (envScene) envScene.dispose();
    };
  }, [gl, scene]);

  return (
    <>
      <ambientLight intensity={0.45} color="#ffffff" />
      <hemisphereLight intensity={0.5} color="#ffffff" groundColor="#334155" />
      <directionalLight position={[0, 8, 4]} intensity={1.6} color="#ffffff" castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0001} />
      <directionalLight position={[-6, 4, -2]} intensity={1.1} color="#dbeafe" />
      <directionalLight position={[6, 4, -2]} intensity={1.1} color="#e0e7ff" />
      <spotLight position={[0, 6, -6]} intensity={1.8} color="#ffffff" angle={0.8} penumbra={1} distance={15} />
    </>
  );
}

function Stage() {
  return (
    <group position={[0, -0.42, 0]}>
      {/* Studio Pedestal */}
      <mesh receiveShadow position={[0, -0.05, 0]}>
        <cylinderGeometry args={[2.0, 2.1, 0.1, 64]} />
        <meshPhysicalMaterial color="#0f172a" roughness={0.15} metalness={0.8} clearcoat={1.0} clearcoatRoughness={0.1} />
      </mesh>
      
      <mesh receiveShadow position={[0, 0.005, 0]}>
        <cylinderGeometry args={[1.9, 1.9, 0.1, 64]} />
        <meshPhysicalMaterial color="#1e293b" roughness={0.6} metalness={0.2} />
      </mesh>

      {/* A restrained light ring separates dark shoes from the pedestal and
          gives the preview a deliberate product-photography focal point. */}
      <mesh position={[0, 0.061, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.34, 1.38, 96]} />
        <meshBasicMaterial color="#60a5fa" transparent opacity={0.34} toneMapped={false} />
      </mesh>
      
      <ContactShadows position={[0, 0.056, 0]} scale={5} far={2} blur={2.5} opacity={0.85} color="#000000" />
    </group>
  );
}

function IdleGroup({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const groupRef = useRef<{
    rotation: { x: number; y: number; z: number };
    position: { y: number };
    scale: { x: number; y: number; z: number; set: (x: number, y: number, z: number) => void };
  } | null>(null);
  useFrame(({ clock }) => {
    if (!enabled || !groupRef.current) return;
    const t = clock.getElapsedTime();
    // Keep the outfit readable: a subtle showroom turn and breathing motion
    // feels premium without distorting the generated garment or its graphics.
    groupRef.current.position.y = Math.sin(t * 1.4) * 0.018;
    groupRef.current.rotation.y = Math.sin(t * 0.55) * 0.09;
    groupRef.current.rotation.z = Math.sin(t * 0.7) * 0.008;
    groupRef.current.rotation.x = 0;
    const stretch = 1 + Math.sin(t * 1.4) * 0.004;
    const squash = 1 - Math.sin(t * 1.4) * 0.002;
    groupRef.current.scale.set(squash, stretch, squash);
  });
  return <group ref={groupRef}>{children}</group>;
}

function CameraRig({ zoom, mode }: { zoom: number; mode: PreviewMode }) {
  const camera = useThree((state) => state.camera);
  useFrame((_, delta) => {
    // Canvas camera props only establish the initial position. Drive later
    // zoom-button changes here and ease them so framing never snaps.
    const responsiveness = 1 - Math.exp(-delta * 9);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, zoom, responsiveness);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, mode === "clothing" ? 1.4 : 1.3, responsiveness);
    camera.updateProjectionMatrix();
  });
  return null;
}

function CanonicalConstruction({scene,onVerification}:{scene:PreviewSceneSpec;onVerification?:AvatarPreviewProps["onGeometryVerification"]}) {
  const root=useMemo(()=>{const group=new THREE.Group(); group.name="canonical-construction"; scene.items.forEach(item=>group.add(materializeConstruction(item.construction))); return group;},[scene]);
  useEffect(()=>{onVerification?.(verifyRenderedConstruction(scene.generationId,scene.items.map(i=>i.construction),root)); return()=>disposeConstruction(root);},[root,scene,onVerification]);
  return <primitive object={root} data-testid="canonical-construction" />;
}

function SceneContent({ maps, view, itemType, rotation, zoom, avatar, mode, animated = false, garment, customParts, previewScene, onGeometryVerification }: { maps: ClothingMaps | null; view: "front" | "back"; itemType: "shirt" | "pants"; rotation: number; zoom: number; avatar: AvatarState; mode: PreviewMode; animated?: boolean; garment?: GarmentConfig; customParts?: AvatarPreviewProps["customParts"]; previewScene?:PreviewSceneSpec|null; onGeometryVerification?:AvatarPreviewProps["onGeometryVerification"] }) {
  const cameraTarget: [number, number, number] = mode === "clothing" ? [0, 1.2, 0] : [0, 1.15, 0];
  return (
    <>
      <color attach="background" args={["#050811"]} />
      <fog attach="fog" args={["#050811", 5, 14]} />
      <SoftShadows size={15} samples={LOW_END_DEVICE ? 6 : 16} focus={0.5} />
      <StudioEnvironment />
      <CameraRig zoom={zoom} mode={mode} />
      
      <Stage />

      <group name="avatar-root" rotation-y={rotation}>
        <IdleGroup enabled={animated}>
          <RobloxAvatar maps={maps} view={view} itemType={itemType} avatar={avatar} mode={mode} garment={previewScene ? undefined : garment} customParts={customParts} />
          {previewScene ? <CanonicalConstruction scene={previewScene} onVerification={onGeometryVerification} /> : null}
        </IdleGroup>
      </group>

      {!LOW_END_DEVICE && (
        <EffectComposer multisampling={0}>
          <Bloom luminanceThreshold={2.0} mipmapBlur intensity={1.0} />
        </EffectComposer>
      )}

      <OrbitControls enablePan={false} enableDamping dampingFactor={0.08} minPolarAngle={0.2} maxPolarAngle={Math.PI / 1.8} minDistance={2.2} maxDistance={6.2} target={cameraTarget} />
    </>
  );
}

// Registers a "export the avatar as a .glb file" function on the ref the page
// hands us. Lives inside <Canvas> so it can reach the live three.js scene.
function ExportBridge({ exportRef }: { exportRef: MutableRefObject<(() => Promise<Blob>) | null> }) {
  const scene = useThree((s) => s.scene);
  useEffect(() => {
    exportRef.current = async () => {
      const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
      const root = scene.getObjectByName("avatar-root") ?? scene;
      const result = await new GLTFExporter().parseAsync(root, { binary: true, onlyVisible: true });
      if (result instanceof ArrayBuffer) return new Blob([result], { type: "model/gltf-binary" });
      return new Blob([JSON.stringify(result)], { type: "model/gltf+json" });
    };
    return () => {
      exportRef.current = null;
    };
  }, [scene, exportRef]);
  return null;
}

function detectWebGL(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    return Boolean(gl);
  } catch {
    return false;
  }
}

function useWebGLAvailable(): boolean {
  const [available] = useState(() => detectWebGL());
  return available;
}

class WebGLBoundary extends Component<{ fallback: ReactNode; resetKey?: string; children: ReactNode }, { failed: boolean; lastKey?: string }> {
  state: { failed: boolean; lastKey?: string } = { failed: false, lastKey: this.props.resetKey };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidUpdate() {
    // A new design (different props) deserves a fresh render attempt so one bad
    // AI response doesn't leave the preview stuck on the error screen forever.
    if (this.state.failed && this.props.resetKey !== this.state.lastKey) {
      this.setState({ failed: false, lastKey: this.props.resetKey });
    }
  }
  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
}

function RenderErrorFallback() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-slate-950 rounded-lg p-4 text-center">
      <div className="text-4xl" aria-hidden>🎨</div>
      <p className="text-sm text-white font-medium">Oops! Figuren ble litt for vill for oss.</p>
      <p className="text-xs text-white/60 max-w-[18rem]">Prøv å lage designet på nytt, eller endre litt på beskrivelsen — så fikser vi det!</p>
    </div>
  );
}

function PreviewFallback({ textureUrl }: { textureUrl?: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-slate-950 rounded-lg p-4 text-center">
      {textureUrl ? (
        <img src={textureUrl} alt="Flat design preview" className="max-h-[70%] max-w-[80%] rounded-md border border-white/10 object-contain" />
      ) : (
        <div className="h-24 w-24 rounded-full border-2 border-dashed border-white/20" />
      )}
      <p className="text-xs text-white/60 max-w-[16rem]">3D preview needs WebGL. Showing your flat design — open in a browser with hardware acceleration to view it on the avatar.</p>
    </div>
  );
}

export function AvatarPreview({ textureUrl, className, avatarType = "neutral", view: controlledView, onViewChange, itemType = "shirt", dimension, previewMode, studioMode = false, animated = false, avatarState, garment, customParts, exportRef, previewScene, onGeometryVerification }: AvatarPreviewProps) {
  const resolvedMode: PreviewMode = previewMode ?? (dimension === "3d" ? "avatar" : "clothing");
  const [internalView, setInternalView] = useState<"front" | "back">("front");
  const [zoom, setZoom] = useState(resolvedMode === "clothing" ? 3.6 : 4.9);
  const [rotation, setRotation] = useState(0);
  const maps = useClothingMaps(textureUrl);
  const effectiveAvatar = useMemo(() => ({ ...defaultAvatarState(), ...avatarState, slots: { ...defaultAvatarState().slots, ...(avatarState?.slots ?? {}) } }), [avatarState]);
  const view = controlledView ?? internalView;
  const setView = (next: "front" | "back") => { if (!controlledView) setInternalView(next); onViewChange?.(next); };
  const subtitle = resolvedMode === "clothing" ? "Clothing Preview" : "Avatar Look Preview";
  const webglAvailable = useWebGLAvailable();
  const cameraPresets = [
    { id: "front", label: "Front", rotation: 0, textureView: "front" },
    { id: "front-45", label: "Front 45°", rotation: -Math.PI / 4, textureView: "front" },
    { id: "right", label: "Right", rotation: -Math.PI / 2, textureView: "front" },
    { id: "back", label: "Back", rotation: Math.PI, textureView: "back" },
    { id: "back-45", label: "Back 45°", rotation: (Math.PI * 3) / 4, textureView: "back" },
    { id: "left", label: "Left", rotation: Math.PI / 2, textureView: "front" },
  ] as const;
  const selectCameraPreset = (preset: (typeof cameraPresets)[number]) => {
    setRotation(preset.rotation);
    setView(preset.textureView);
  };

  const scene = !webglAvailable ? (
    <PreviewFallback textureUrl={textureUrl} />
  ) : (
    <WebGLBoundary fallback={<RenderErrorFallback />} resetKey={JSON.stringify({ customParts, garment, slots: effectiveAvatar.slots, model: effectiveAvatar.modelVariant })}>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95 }}
        camera={{ position: [0, 1.3, zoom], fov: resolvedMode === "clothing" ? 34 : 38 }}
        className="w-full h-full"
      >
        <SceneContent maps={maps} view={view} itemType={itemType} rotation={rotation} zoom={zoom} avatar={effectiveAvatar} mode={resolvedMode} animated={animated} garment={garment} customParts={customParts} previewScene={previewScene} onGeometryVerification={onGeometryVerification} />
        {exportRef ? <ExportBridge exportRef={exportRef} /> : null}
      </Canvas>
    </WebGLBoundary>
  );

  if (studioMode) {
    return <div data-testid="avatar-preview" className="relative w-full h-full bg-[radial-gradient(circle_at_50%_34%,#182743_0%,#080d19_48%,#03050b_100%)]">{scene}<div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-sky-400/[0.06] to-transparent" /><div aria-label="Camera views" className="absolute bottom-6 left-1/2 -translate-x-1/2 flex max-w-[92%] items-center gap-1 overflow-x-auto bg-slate-950/75 shadow-2xl shadow-black/50 backdrop-blur-xl rounded-full px-3 py-2 border border-white/15">{cameraPresets.map((preset) => <button key={preset.id} data-testid={`camera-${preset.id}`} onClick={() => selectCameraPreset(preset)} className="whitespace-nowrap text-[11px] px-2 py-1 rounded-full text-white/65 hover:bg-white/15 hover:text-white">{preset.label}</button>)}<button onClick={() => setRotation((p) => p + 0.3)} className="text-white/60 hover:text-white p-1" title="Rotate"><RotateCw className="w-3.5 h-3.5" /></button><button onClick={() => setZoom((p) => Math.min(6, p + 0.4))} className="text-white/60 hover:text-white p-1" title="Zoom out"><ZoomOut className="w-3.5 h-3.5" /></button><button onClick={() => setZoom((p) => Math.max(2.2, p - 0.4))} className="text-white/60 hover:text-white p-1" title="Zoom in"><ZoomIn className="w-3.5 h-3.5" /></button></div><div className="absolute top-4 left-4 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-white/45 font-medium backdrop-blur-md">{avatarType} · {subtitle}</div></div>;
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
