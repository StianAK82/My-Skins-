import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
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

type ThreeTexture = ReturnType<typeof makeTextureFromZone>;
type PreviewMode = "clothing" | "avatar";

export type GarmentConfig = {
  top?: "hoodie" | "sweater" | "tshirt" | "jacket" | "dress" | null;
  bottom?: "pants" | "shorts" | "skirt" | null;
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
    <meshStandardMaterial
      color={part.useAssetColor ? color : (part.color ?? "#94a3b8")}
      map={texture ?? undefined}
      emissive={part.emissive}
      emissiveIntensity={part.emissiveIntensity ? part.emissiveIntensity * 3 : 0}
      transparent={part.transparent}
      opacity={part.opacity ?? 1}
      metalness={part.metalness ?? 0.1}
      roughness={part.roughness ?? 0.68}
      alphaTest={part.alphaTest}
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
    return <RoundedBox args={part.args as [number, number, number]} radius={radius} smoothness={part.smoothness ?? 4} {...shared}>{makeStandardMaterial(part, assetColor, texture)}</RoundedBox>;
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
    return <mesh position={[position[0], position[1], position[2] + 0.02]} rotation={rotation} scale={scale}><planeGeometry args={[0.36, 0.36]} /><meshStandardMaterial map={texture ?? undefined} transparent alphaTest={0.1} /></mesh>;
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
    return <RoundedBox args={args} radius={radius} smoothness={smoothness} position={position} castShadow frustumCulled={false}><meshStandardMaterial color={skinTone} roughness={0.35} metalness={0.05} /></RoundedBox>;
  }
  const mapSet = material === "shirt" ? maps.shirt : maps.pants;
  const baseColor = material === "shirt" ? "#f8fafc" : "#e2e8f0";
  const topColor = material === "shirt" ? "#dbeafe" : "#cbd5e1";
  const bottomColor = material === "shirt" ? "#e2e8f0" : "#bfdbfe";
  return (
    <RoundedBox args={args} radius={radius} smoothness={smoothness} position={position} castShadow frustumCulled={false}>
      <meshStandardMaterial attach="material-0" map={mapSet.side} color={baseColor} roughness={0.4} metalness={0.05} />
      <meshStandardMaterial attach="material-1" map={mapSet.side} color={baseColor} roughness={0.4} metalness={0.05} />
      <meshStandardMaterial attach="material-2" color={topColor} roughness={0.4} metalness={0.05} />
      <meshStandardMaterial attach="material-3" color={bottomColor} roughness={0.4} metalness={0.05} />
      <meshStandardMaterial attach="material-4" map={mapSet.front} color={baseColor} roughness={0.4} metalness={0.05} />
      <meshStandardMaterial attach="material-5" map={mapSet.back} color={baseColor} roughness={0.4} metalness={0.05} />
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

  const shirtColor = "#f8fafc";
  const pantsColor = "#e2e8f0";
  const shirtMapFront = maps.shirt.front;
  const shirtMapBack = maps.shirt.back;
  const shirtMapSide = maps.shirt.side;

  return (
    <>
      {top && (
        <>
          {/* HOOD - resting behind neck on main torso */}
          {top === "hoodie" && isMainTorso && (
            <group position={[0, args[1]/2 - 0.05, -args[2]/2 - 0.05]}>
              <RoundedBox args={[args[0] * 0.8, 0.25, 0.3]} radius={0.08} smoothness={4} castShadow receiveShadow rotation={[-0.2, 0, 0]}>
                <meshStandardMaterial map={shirtMapBack} color={shirtColor} roughness={0.7} metalness={0.05} />
              </RoundedBox>
            </group>
          )}

          {/* HOOD FOLDS - draped over shoulders */}
          {top === "hoodie" && isMainTorso && (
            <group position={[0, args[1]/2 - 0.02, 0]}>
              <RoundedBox args={[args[0] * 0.9, 0.15, args[2] * 1.05]} radius={0.05} smoothness={4} castShadow receiveShadow>
                <meshStandardMaterial map={shirtMapFront} color={shirtColor} roughness={0.7} metalness={0.05} />
              </RoundedBox>
            </group>
          )}

          {/* DRAWSTRINGS */}
          {top === "hoodie" && isMainTorso && (
            <group position={[0, args[1]/2 - 0.1, args[2]/2 + 0.02]}>
              <mesh position={[-0.15, -0.15, 0]} castShadow rotation={[0, 0, 0.05]}>
                <cylinderGeometry args={[0.012, 0.012, 0.3, 8]} />
                <meshStandardMaterial color="#ffffff" roughness={0.9} />
              </mesh>
              <mesh position={[-0.16, -0.3, 0]} castShadow>
                <cylinderGeometry args={[0.014, 0.014, 0.04, 8]} />
                <meshStandardMaterial color="#94a3b8" roughness={0.5} />
              </mesh>
              
              <mesh position={[0.15, -0.15, 0]} castShadow rotation={[0, 0, -0.05]}>
                <cylinderGeometry args={[0.012, 0.012, 0.3, 8]} />
                <meshStandardMaterial color="#ffffff" roughness={0.9} />
              </mesh>
              <mesh position={[0.16, -0.3, 0]} castShadow>
                <cylinderGeometry args={[0.014, 0.014, 0.04, 8]} />
                <meshStandardMaterial color="#94a3b8" roughness={0.5} />
              </mesh>
            </group>
          )}

          {/* KANGAROO POCKET */}
          {top === "hoodie" && isBottomTorso && (
            <group position={[0, -args[1]/2 + 0.25, args[2]/2 + 0.02]}>
              <RoundedBox args={[args[0] * 0.7, 0.35, 0.08]} radius={0.04} smoothness={4} castShadow receiveShadow>
                <meshStandardMaterial map={shirtMapFront} color={shirtColor} roughness={0.7} metalness={0.05} />
              </RoundedBox>
              {/* Pocket seams/openings */}
              <mesh position={[-args[0] * 0.35 + 0.04, 0, 0.03]} rotation={[0, 0, 0.4]}>
                <cylinderGeometry args={[0.02, 0.02, 0.25, 8]} />
                <meshStandardMaterial color="#0f172a" opacity={0.3} transparent roughness={0.9} />
              </mesh>
              <mesh position={[args[0] * 0.35 - 0.04, 0, 0.03]} rotation={[0, 0, -0.4]}>
                <cylinderGeometry args={[0.02, 0.02, 0.25, 8]} />
                <meshStandardMaterial color="#0f172a" opacity={0.3} transparent roughness={0.9} />
              </mesh>
            </group>
          )}

          {/* COLLAR (SWEATER & TSHIRT) */}
          {(top === "sweater" || top === "tshirt") && isMainTorso && (
            <group position={[0, args[1]/2, 0]}>
              <RoundedBox args={[args[0] * 0.45, 0.06, args[2] * 0.5]} radius={0.02} smoothness={4} castShadow receiveShadow>
                <meshStandardMaterial map={shirtMapFront} color={shirtColor} roughness={0.8} metalness={0.05} />
              </RoundedBox>
            </group>
          )}

          {/* JACKET COLLAR - fold-over style */}
          {top === "jacket" && isMainTorso && (
            <group position={[0, args[1]/2 - 0.03, args[2]/2 + 0.01]}>
              <RoundedBox args={[args[0] * 0.5, 0.14, 0.08]} radius={0.03} smoothness={4} castShadow receiveShadow rotation={[0.3, 0, 0]}>
                <meshStandardMaterial map={shirtMapFront} color={shirtColor} roughness={0.7} metalness={0.05} />
              </RoundedBox>
            </group>
          )}

          {/* JACKET FRONT PLACKET (vertical opening) */}
          {top === "jacket" && isMainTorso && (
            <>
              <group position={[0.08, 0, args[2]/2 + 0.015]}>
                <RoundedBox args={[0.06, args[1] * 0.9, 0.02]} radius={0.01} smoothness={4} castShadow receiveShadow>
                  <meshStandardMaterial color="#1e293b" roughness={0.6} metalness={0.1} />
                </RoundedBox>
              </group>
              <group position={[-0.08, 0, args[2]/2 + 0.015]}>
                <RoundedBox args={[0.06, args[1] * 0.9, 0.02]} radius={0.01} smoothness={4} castShadow receiveShadow>
                  <meshStandardMaterial color="#1e293b" roughness={0.6} metalness={0.1} />
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
              smoothness={4}
              maps={maps}
              skinTone={skinTone}
            />
          )}

          {/* RIBBED HEM (TORSO) */}
          {(top === "hoodie" || top === "sweater" || top === "jacket") && isBottomTorso && (
            <group position={[0, -args[1]/2 + 0.06, 0]}>
              <RoundedBox args={[args[0] * 1.05, 0.12, args[2] * 1.05]} radius={0.02} smoothness={4} castShadow receiveShadow>
                <meshStandardMaterial map={shirtMapFront} color={shirtColor} roughness={0.8} metalness={0.05} />
              </RoundedBox>
              {/* Little detail indent for the hem */}
              <mesh position={[0, 0.06, args[2]*0.52]} rotation={[0, 0, 0]}>
                <boxGeometry args={[args[0]*1.03, 0.01, 0.02]} />
                <meshStandardMaterial color="#0f172a" opacity={0.15} transparent roughness={0.9} />
              </mesh>
            </group>
          )}

          {/* ARM CUFFS (HOODIE, SWEATER, JACKET) */}
          {(top === "hoodie" || top === "sweater" || top === "jacket") && (isBlockyArm || isR15BottomArm) && (
            <group position={[0, -args[1]/2 + 0.05, 0]}>
              <RoundedBox args={[args[0] * 1.1, 0.12, args[2] * 1.1]} radius={0.02} smoothness={4} castShadow receiveShadow>
                <meshStandardMaterial map={shirtMapSide} color={shirtColor} roughness={0.8} metalness={0.05} />
              </RoundedBox>
            </group>
          )}

          {/* TSHIRT SLEEVE HEM */}
          {top === "tshirt" && (
            <>
              {isBlockyArm && (
                <group position={[0, 0, 0]}>
                  <RoundedBox args={[args[0] * 1.1, 0.08, args[2] * 1.1]} radius={0.02} smoothness={4} castShadow receiveShadow>
                    <meshStandardMaterial map={shirtMapSide} color={shirtColor} roughness={0.8} metalness={0.05} />
                  </RoundedBox>
                </group>
              )}
              {isR15TopArm && (
                <group position={[0, -args[1]/2 + 0.04, 0]}>
                  <RoundedBox args={[args[0] * 1.1, 0.08, args[2] * 1.1]} radius={0.02} smoothness={4} castShadow receiveShadow>
                    <meshStandardMaterial map={shirtMapSide} color={shirtColor} roughness={0.8} metalness={0.05} />
                  </RoundedBox>
                </group>
              )}
            </>
          )}

          {/* FULL ARM PADDING (HOODIE, SWEATER, JACKET) */}
          {(top === "hoodie" || top === "sweater" || top === "jacket") && (isBlockyArm || isR15TopArm || isR15BottomArm) && (
            <BodyPart
              material="shirt"
              args={[args[0] * 1.05, args[1] * 0.98, args[2] * 1.05]}
              position={[0, 0, 0]}
              radius={0.06}
              smoothness={4}
              maps={maps}
              skinTone={skinTone}
            />
          )}

          {/* HALF ARM PADDING (TSHIRT) */}
          {top === "tshirt" && (
            <>
              {isBlockyArm && (
                <group position={[0, args[1]*0.25, 0]}>
                  <BodyPart
                    material="shirt"
                    args={[args[0] * 1.05, args[1] * 0.5, args[2] * 1.05]}
                    position={[0, 0, 0]}
                    radius={0.06}
                    smoothness={4}
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
                  smoothness={4}
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
              smoothness={4}
              maps={maps}
              skinTone={skinTone}
            />
          )}
        </>
      )}

      {/* PANTS */}
      {bottom === "pants" && (
        <>
          {(isBottomLeg || isTopLeg) && (
            <BodyPart
              material="pants"
              args={[args[0] * 1.08, args[1] * 0.98, args[2] * 1.08]}
              position={[0, 0, 0]}
              radius={0.06}
              smoothness={4}
              maps={maps}
              skinTone={skinTone}
            />
          )}
          {isBottomLeg && (
            <group position={[0, -args[1]/2 + 0.05, 0]}>
              <RoundedBox args={[args[0] * 1.12, 0.1, args[2] * 1.12]} radius={0.02} smoothness={4} castShadow receiveShadow>
                <meshStandardMaterial map={maps.pants.front} color={pantsColor} roughness={0.8} metalness={0.05} />
              </RoundedBox>
            </group>
          )}
          {isTopLeg && (
            <group position={[0, args[1]/2 - 0.04, 0]}>
              <RoundedBox args={[args[0] * 1.1, 0.08, args[2] * 1.1]} radius={0.02} smoothness={4} castShadow receiveShadow>
                <meshStandardMaterial map={maps.pants.front} color={pantsColor} roughness={0.8} metalness={0.05} />
              </RoundedBox>
            </group>
          )}
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
                smoothness={4}
                maps={maps}
                skinTone={skinTone}
              />
              <group position={[0, baseModelId === 'proportioned_r15' ? -args[1]/2 + 0.05 : -args[1]*0.25 + 0.05, 0]}>
                <RoundedBox args={[args[0] * 1.1, 0.08, args[2] * 1.1]} radius={0.02} smoothness={4} castShadow receiveShadow>
                  <meshStandardMaterial map={maps.pants.front} color={pantsColor} roughness={0.8} metalness={0.05} />
                </RoundedBox>
              </group>
              <group position={[0, args[1]/2 - 0.04, 0]}>
                <RoundedBox args={[args[0] * 1.1, 0.08, args[2] * 1.1]} radius={0.02} smoothness={4} castShadow receiveShadow>
                  <meshStandardMaterial map={maps.pants.front} color={pantsColor} roughness={0.8} metalness={0.05} />
                </RoundedBox>
              </group>
            </group>
          )}
        </>
      )}

      {/* SKIRT */}
      {bottom === "skirt" && isTopLeg && (
        <group position={[0, baseModelId === 'proportioned_r15' ? 0 : args[1]*0.15, 0]}>
          {/* Fitted waistband */}
          <group position={[0, args[1]/2 - 0.04, 0]}>
            <RoundedBox args={[args[0] * 1.1, 0.08, args[2] * 1.1]} radius={0.02} smoothness={4} castShadow receiveShadow>
              <meshStandardMaterial map={maps.pants.front} color={pantsColor} roughness={0.8} metalness={0.05} />
            </RoundedBox>
          </group>
          {/* Flared A-line skirt volume */}
          <group position={[0, baseModelId === 'proportioned_r15' ? -0.05 : 0.1, 0]}>
            <mesh castShadow receiveShadow rotation={[0, 0, 0]}>
              <cylinderGeometry args={[args[0] * 1.4, args[0] * 1.12, baseModelId === 'proportioned_r15' ? args[1] * 0.85 : args[1] * 0.65, 16]} />
              <meshStandardMaterial map={maps.pants.front} color={pantsColor} roughness={0.75} metalness={0.05} />
            </mesh>
          </group>
        </group>
      )}

      {/* DRESS SKIRT (when dress is the top) */}
      {top === "dress" && isTopLeg && (
        <group position={[0, baseModelId === 'proportioned_r15' ? 0 : args[1]*0.15, 0]}>
          {/* A-line flare */}
          <group position={[0, baseModelId === 'proportioned_r15' ? -0.05 : 0.1, 0]}>
            <mesh castShadow receiveShadow rotation={[0, 0, 0]}>
              <cylinderGeometry args={[args[0] * 1.5, args[0] * 1.08, baseModelId === 'proportioned_r15' ? args[1] * 0.9 : args[1] * 0.7, 16]} />
              <meshStandardMaterial map={maps.shirt.front} color={shirtColor} roughness={0.75} metalness={0.05} />
            </mesh>
          </group>
        </group>
      )}

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
                  <meshStandardMaterial color={shoeBodyColor} roughness={0.65} metalness={0.08} />
                </RoundedBox>
                
                {/* Sole slab underneath - lighter and wider */}
                <group position={[0, -0.14, 0.02]}>
                  <RoundedBox args={[args[0] * 1.22, 0.08, args[2] * 1.34]} radius={0.04} smoothness={6} castShadow receiveShadow>
                    <meshStandardMaterial color={soleColor} roughness={0.75} metalness={0.1} />
                  </RoundedBox>
                </group>
                
                {/* Toe cap - rounded protective front */}
                <group position={[0, -0.04, args[2] * 0.65 + 0.02]}>
                  <RoundedBox args={[args[0] * 1.16, 0.16, args[2] * 0.24]} radius={0.08} smoothness={6} castShadow receiveShadow>
                    <meshStandardMaterial color={soleColor} roughness={0.7} metalness={0.12} />
                  </RoundedBox>
                </group>
                
                {/* Tongue hint - small padded piece near ankle */}
                <group position={[0, 0.08, args[2] * 0.3]}>
                  <RoundedBox args={[args[0] * 0.6, 0.18, 0.08]} radius={0.04} smoothness={4} castShadow receiveShadow>
                    <meshStandardMaterial color={shoeBodyColor} roughness={0.68} metalness={0.05} />
                  </RoundedBox>
                </group>
                
                {/* Lace hints - two small horizontal bars */}
                <group position={[0, 0.04, args[2] * 0.4]}>
                  <mesh castShadow>
                    <cylinderGeometry args={[0.015, 0.015, args[0] * 0.7, 8]} />
                    <meshStandardMaterial color={laceColor} roughness={0.85} />
                  </mesh>
                </group>
                <group position={[0, 0.08, args[2] * 0.25]}>
                  <mesh castShadow rotation={[0, 0, Math.PI / 2]}>
                    <cylinderGeometry args={[0.015, 0.015, args[0] * 0.65, 8]} />
                    <meshStandardMaterial color={laceColor} roughness={0.85} />
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
                  <meshStandardMaterial color={bootBodyColor} roughness={0.6} metalness={0.12} />
                </RoundedBox>
                
                {/* Chunky sole platform */}
                <group position={[0, -args[1] * 0.35 - 0.08, 0.02]}>
                  <RoundedBox args={[args[0] * 1.24, 0.16, args[2] * 1.36]} radius={0.05} smoothness={6} castShadow receiveShadow>
                    <meshStandardMaterial color={bootSoleColor} roughness={0.8} metalness={0.15} />
                  </RoundedBox>
                </group>
                
                {/* Toe guard reinforcement */}
                <group position={[0, -args[1] * 0.3, args[2] * 0.66 + 0.02]}>
                  <RoundedBox args={[args[0] * 1.18, 0.2, args[2] * 0.26]} radius={0.09} smoothness={6} castShadow receiveShadow>
                    <meshStandardMaterial color={bootSoleColor} roughness={0.65} metalness={0.18} />
                  </RoundedBox>
                </group>
                
                {/* Upper cuff/collar */}
                <group position={[0, args[1] * 0.35 - 0.04, 0]}>
                  <RoundedBox args={[args[0] * 1.22, 0.1, args[2] * 1.34]} radius={0.03} smoothness={4} castShadow receiveShadow>
                    <meshStandardMaterial color={bootSoleColor} roughness={0.7} metalness={0.1} />
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
          const m = <meshStandardMaterial color={p.color} roughness={0.5} metalness={0.2} />;
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
                  <meshStandardMaterial color={p.color} emissive={p.color} emissiveIntensity={1.5} toneMapped={false} />
                </mesh>
              );
            case "plate":
              return (
                <group position={[0, 0, 0.03]}>
                  <RoundedBox args={[0.3, 0.3, 0.06]} radius={0.02} smoothness={4}>{m}</RoundedBox>
                </group>
              );
            case "band":
              return (
                <group rotation={[Math.PI/2, 0, 0]} position={[0, 0, -args[2]*0.5]}>
                  <mesh><torusGeometry args={[Math.max(args[0], args[2])*0.6, 0.05, 16, 32]} />{m}</mesh>
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
              return (
                <group position={[-pos[0], -pos[1], -pos[2]]} rotation={[-rot[0], -rot[1], -rot[2]]}>
                  <RoundedBox
                    args={[args[0] * 1.18, args[1] * 1.18, args[2] * 1.18]}
                    radius={Math.min(args[0], args[1], args[2]) * 0.35}
                    smoothness={4}
                  >
                    <meshStandardMaterial color={p.color} roughness={0.85} metalness={0} />
                  </RoundedBox>
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
        .map((slot) => <AvatarCosmetic key={slot} slot={slot} avatar={avatar} mode={mode} />)}
    </group>
  );
}

function StudioEnvironment() {
  // NOTE: Do NOT use <Environment> with <Lightformer> children here — the
  // light panels leak into the visible scene as giant walls that slice
  // through the avatar when the camera orbits. Plain lights instead.
  return (
    <>
      <ambientLight intensity={0.5} color="#dbeafe" />
      <directionalLight position={[0, 6, -3]} intensity={1.1} color="#ffffff" />
      <directionalLight position={[-5, 2, 1]} intensity={1.4} color="#ec4899" />
      <directionalLight position={[5, 2, 1]} intensity={1.4} color="#38bdf8" />
    </>
  );
}

function Stage() {
  return (
    <group position={[0, -0.42, 0]}>
      {/* Floor disc — NOTE: cylinderGeometry is already flat (axis along Y);
          rotating it -90° turns it into a giant vertical wall through the avatar. */}
      <mesh receiveShadow position={[0, -0.05, 0]}>
        <cylinderGeometry args={[2.8, 2.8, 0.1, 64]} />
        <meshStandardMaterial color="#05070d" roughness={0.2} metalness={0.6} />
      </mesh>
      
      {/* Inner glowing ring */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.052, 0]}>
        <ringGeometry args={[1.4, 1.45, 64]} />
        <meshBasicMaterial color={new THREE.Color("#38bdf8").multiplyScalar(5)} toneMapped={false} transparent opacity={0.9} />
      </mesh>
      
      {/* Outer glowing ring */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.052, 0]}>
        <ringGeometry args={[2.5, 2.55, 64]} />
        <meshBasicMaterial color={new THREE.Color("#ec4899").multiplyScalar(5)} toneMapped={false} transparent opacity={0.9} />
      </mesh>
      
      <ContactShadows position={[0, 0.055, 0]} scale={4} far={2} blur={1.5} opacity={0.8} color="#000000" />
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
    groupRef.current.position.y = Math.abs(Math.sin(t * 3)) * 0.08;
    groupRef.current.rotation.y = Math.sin(t * 1.5) * 0.2;
    groupRef.current.rotation.z = Math.sin(t * 3) * 0.06;
    groupRef.current.rotation.x = Math.sin(t * 1.5) * 0.05;
    const stretch = 1 + Math.sin(t * 3) * 0.03;
    const squash = 1 - Math.sin(t * 3) * 0.015;
    groupRef.current.scale.set(squash, stretch, squash);
  });
  return <group ref={groupRef}>{children}</group>;
}

function SceneContent({ maps, view, itemType, rotation, avatar, mode, animated = false, garment, customParts }: { maps: ClothingMaps | null; view: "front" | "back"; itemType: "shirt" | "pants"; rotation: number; avatar: AvatarState; mode: PreviewMode; animated?: boolean; garment?: GarmentConfig; customParts?: AvatarPreviewProps["customParts"] }) {
  const cameraTarget: [number, number, number] = mode === "clothing" ? [0, 1.2, 0] : [0, 1.15, 0];
  return (
    <>
      <color attach="background" args={["#050811"]} />
      <fog attach="fog" args={["#050811", 5, 14]} />
      <SoftShadows size={12} samples={8} focus={0.5} />
      <StudioEnvironment />
      
      <hemisphereLight intensity={0.75} color="#ffffff" groundColor="#0f172a" />
      
      <spotLight
        position={[3, 7, 5]}
        intensity={mode === "clothing" ? 3.5 : 3}
        color="#ffffff"
        castShadow
        penumbra={1}
        angle={0.7}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0001}
      />
      
      <spotLight position={[-4, 4, -4]} intensity={5} color="#ec4899" penumbra={1} distance={15} />
      <spotLight position={[4, 3, -4]} intensity={5} color="#38bdf8" penumbra={1} distance={15} />

      <Stage />

      <group rotation-y={rotation}>
        <IdleGroup enabled={animated}>
          <RobloxAvatar maps={maps} view={view} itemType={itemType} avatar={avatar} mode={mode} garment={garment} customParts={customParts} />
        </IdleGroup>
      </group>

      <EffectComposer multisampling={0}>
        <Bloom luminanceThreshold={2.0} mipmapBlur intensity={1.0} />
      </EffectComposer>

      <OrbitControls enablePan={false} enableDamping dampingFactor={0.08} minPolarAngle={0.2} maxPolarAngle={Math.PI / 1.8} minDistance={2.2} maxDistance={6.2} target={cameraTarget} />
    </>
  );
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

export function AvatarPreview({ textureUrl, className, avatarType = "neutral", view: controlledView, onViewChange, itemType = "shirt", dimension, previewMode, studioMode = false, animated = false, avatarState, garment, customParts }: AvatarPreviewProps) {
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
        <SceneContent maps={maps} view={view} itemType={itemType} rotation={rotation} avatar={effectiveAvatar} mode={resolvedMode} animated={animated} garment={garment} customParts={customParts} />
      </Canvas>
    </WebGLBoundary>
  );

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
