import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, RoundedBox, Environment, Lightformer, ContactShadows, SoftShadows } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import type { StylizedOutfitConcept } from "@/lib/ai/stylized-outfit-client";
import type { AvatarCosmeticSlot, AvatarState } from "@/lib/editor/design-state";
import { defaultAvatarState } from "@/lib/editor/design-state";
import { getAvatarAssetById, getAvatarBaseModel, type AvatarRenderPart } from "@/lib/editor/assets";
import { resolveSlotPosition } from "@/lib/editor/avatar-slots";

type ThreeTexture = ReturnType<typeof makeTextureFromZone>;
type PreviewMode = "clothing" | "avatar";

export type GarmentConfig = {
  top?: "hoodie" | "tshirt" | null;
  bottom?: "pants" | "shorts" | null;
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
    return <RoundedBox args={part.args as [number, number, number]} radius={part.radius ?? 0.04} smoothness={part.smoothness ?? 4} {...shared}>{makeStandardMaterial(part, assetColor, texture)}</RoundedBox>;
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
  const position = resolveSlotPosition(slot, avatar);
  const rotation: [number, number, number] = [THREE.MathUtils.degToRad(item.rotation.x), THREE.MathUtils.degToRad(item.rotation.y), THREE.MathUtils.degToRad(item.rotation.z)];
  const scale = item.scale * (asset.defaultScale ?? 1);
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
    return <RoundedBox args={args} radius={radius} smoothness={smoothness} position={position} castShadow><meshStandardMaterial color={skinTone} roughness={0.35} metalness={0.05} /></RoundedBox>;
  }
  const mapSet = material === "shirt" ? maps.shirt : maps.pants;
  const baseColor = material === "shirt" ? "#f8fafc" : "#e2e8f0";
  const topColor = material === "shirt" ? "#dbeafe" : "#cbd5e1";
  const bottomColor = material === "shirt" ? "#e2e8f0" : "#bfdbfe";
  return (
    <RoundedBox args={args} radius={radius} smoothness={smoothness} position={position} castShadow>
      <meshStandardMaterial attach="material-0" map={mapSet.side} color={baseColor} roughness={0.4} metalness={0.05} />
      <meshStandardMaterial attach="material-1" map={mapSet.side} color={baseColor} roughness={0.4} metalness={0.05} />
      <meshStandardMaterial attach="material-2" color={topColor} roughness={0.4} metalness={0.05} />
      <meshStandardMaterial attach="material-3" color={bottomColor} roughness={0.4} metalness={0.05} />
      <meshStandardMaterial attach="material-4" map={mapSet.front} color={baseColor} roughness={0.4} metalness={0.05} />
      <meshStandardMaterial attach="material-5" map={mapSet.back} color={baseColor} roughness={0.4} metalness={0.05} />
    </RoundedBox>
  );
}

function GarmentOverlay({
  partId, args, maps, garment, baseModelId, skinTone
}: {
  partId: string; args: [number, number, number]; maps: { shirt: FaceMaps; pants: FaceMaps }; garment?: GarmentConfig; baseModelId: string; skinTone: string;
}) {
  if (!garment) return null;
  const top = garment.top || "tshirt";
  const bottom = garment.bottom || "pants";

  const isMainTorso = partId === "torso" || partId === "upperTorso";
  const isBottomTorso = partId === "torso" || partId === "lowerTorso" || partId === "hips";

  const isBottomArm = (baseModelId === "proportioned_r15" && (partId === "leftLowerArm" || partId === "rightLowerArm")) ||
                      (baseModelId !== "proportioned_r15" && (partId === "leftUpperArm" || partId === "rightUpperArm"));
                      
  const isTopArm = (baseModelId === "proportioned_r15" && (partId === "leftUpperArm" || partId === "rightUpperArm")) ||
                   (baseModelId !== "proportioned_r15" && (partId === "leftUpperArm" || partId === "rightUpperArm"));
                      
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
      {top === "hoodie" && (
        <>
          {/* HOOD - resting behind neck on main torso */}
          {isMainTorso && (
            <group position={[0, args[1]/2 - 0.05, -args[2]/2 - 0.05]}>
              <RoundedBox args={[args[0] * 0.8, 0.25, 0.3]} radius={0.08} smoothness={4} castShadow receiveShadow rotation={[-0.2, 0, 0]}>
                <meshStandardMaterial map={shirtMapBack} color={shirtColor} roughness={0.7} metalness={0.05} />
              </RoundedBox>
            </group>
          )}

          {/* HOOD FOLDS - draped over shoulders */}
          {isMainTorso && (
            <group position={[0, args[1]/2 - 0.02, 0]}>
              <RoundedBox args={[args[0] * 0.9, 0.15, args[2] * 1.05]} radius={0.05} smoothness={4} castShadow receiveShadow>
                <meshStandardMaterial map={shirtMapFront} color={shirtColor} roughness={0.7} metalness={0.05} />
              </RoundedBox>
            </group>
          )}

          {/* DRAWSTRINGS */}
          {isMainTorso && (
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
          {isBottomTorso && (
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

          {/* RIBBED HEM (TORSO) */}
          {isBottomTorso && (
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

          {/* ARM CUFFS */}
          {isBottomArm && (
            <group position={[0, -args[1]/2 + 0.05, 0]}>
              <RoundedBox args={[args[0] * 1.1, 0.12, args[2] * 1.1]} radius={0.02} smoothness={4} castShadow receiveShadow>
                <meshStandardMaterial map={shirtMapSide} color={shirtColor} roughness={0.8} metalness={0.05} />
              </RoundedBox>
            </group>
          )}

          {/* ARM PADDING */}
          {(isTopArm || isBottomArm) && (
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
          
          {/* TORSO PADDING (makes the hoodie look thick) */}
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
    </>
  );
}

function RobloxAvatar({ maps, view, itemType, avatar, mode, garment }: { maps: ClothingMaps | null; view: "front" | "back"; itemType: "shirt" | "pants"; avatar: AvatarState; mode: PreviewMode; garment?: GarmentConfig }) {
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
          </group>
        ))}
      </group>
      {(["face", "hair", "hat", "neck", "leftShoulder", "rightShoulder", "back", "leftFootwear", "rightFootwear", "aura"] as AvatarCosmeticSlot[]).map((slot) => <AvatarCosmetic key={slot} slot={slot} avatar={avatar} mode={mode} />)}
    </group>
  );
}

function StudioEnvironment() {
  return (
    <Environment resolution={256} frames={1}>
      <color attach="background" args={["#050811"]} />
      <Lightformer intensity={3} rotation-x={Math.PI / 2} position={[0, 5, -2]} scale={[12, 12, 1]} color="#ffffff" />
      <Lightformer intensity={2} rotation-y={Math.PI / 2} position={[-5, 2, 0]} scale={[10, 10, 1]} color="#ec4899" />
      <Lightformer intensity={2} rotation-y={-Math.PI / 2} position={[5, 2, 0]} scale={[10, 10, 1]} color="#38bdf8" />
      <Lightformer intensity={1.5} rotation-y={Math.PI} position={[0, 2, 4]} scale={[8, 6, 1]} color="#ffffff" />
    </Environment>
  );
}

function Stage() {
  return (
    <group position={[0, -0.42, 0]}>
      <mesh rotation-x={-Math.PI / 2} receiveShadow position={[0, 0, 0]}>
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

function SceneContent({ maps, view, itemType, rotation, avatar, mode, animated = false, garment }: { maps: ClothingMaps | null; view: "front" | "back"; itemType: "shirt" | "pants"; rotation: number; avatar: AvatarState; mode: PreviewMode; animated?: boolean; garment?: GarmentConfig }) {
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
          <RobloxAvatar maps={maps} view={view} itemType={itemType} avatar={avatar} mode={mode} garment={garment} />
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

class WebGLBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) return this.props.fallback;
    return this.props.children;
  }
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

export function AvatarPreview({ textureUrl, className, avatarType = "neutral", view: controlledView, onViewChange, itemType = "shirt", dimension, previewMode, studioMode = false, animated = false, avatarState, garment }: AvatarPreviewProps) {
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
    <WebGLBoundary fallback={<PreviewFallback textureUrl={textureUrl} />}>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 0.95 }}
        camera={{ position: [0, 1.3, zoom], fov: resolvedMode === "clothing" ? 34 : 38 }}
        className="w-full h-full"
      >
        <SceneContent maps={maps} view={view} itemType={itemType} rotation={rotation} avatar={effectiveAvatar} mode={resolvedMode} animated={animated} garment={garment} />
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
