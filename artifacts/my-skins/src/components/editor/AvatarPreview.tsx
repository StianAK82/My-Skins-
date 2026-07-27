import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, RoundedBox, Environment, Lightformer, ContactShadows, SoftShadows } from "@react-three/drei";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import type { StylizedOutfitConcept } from "@/lib/ai/stylized-outfit-client";
import type { AvatarCosmeticSlot, AvatarState } from "@/lib/editor/design-state";
import { defaultAvatarState } from "@/lib/editor/design-state";
import { getAvatarAssetById, getAvatarBaseModel, type AvatarRenderPart } from "@/lib/editor/assets";
import { resolveSlotPosition } from "@/lib/editor/avatar-slots";
import { CLASSIC_SHIRT_UV } from "@/lib/editor/classic-shirt-uv";
import { RobloxAvatarModel } from "@/components/editor/avatar/RobloxAvatarModel";
import { GarmentPreview } from "@/components/editor/garments/GarmentPreview";
import type { OutfitDNA } from "@/lib/editor/garment-preview-material";

type ThreeTexture = ReturnType<typeof makeTextureFromZone>;
type PreviewMode = "clothing" | "avatar";
export type PreviewRepresentation = "classic" | "enhanced";

type AvatarPreviewProps = {
  textureUrl?: string;
  shirtTextureUrl?: string;
  pantsTextureUrl?: string;
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
  outfitDNA?: OutfitDNA;
  representation?: PreviewRepresentation;
  onRepresentationChange?: (representation: PreviewRepresentation) => void;
};

type Zone = { left: number; top: number; width: number; height: number };
type ClothingMaps = { shirtFront: ThreeTexture; shirtBack: ThreeTexture; shirtSide: ThreeTexture; leftArmFront: ThreeTexture; leftArmBack: ThreeTexture; leftArmSide: ThreeTexture; rightArmFront: ThreeTexture; rightArmBack: ThreeTexture; rightArmSide: ThreeTexture; pantsFront: ThreeTexture; pantsBack: ThreeTexture; pantsSide: ThreeTexture };
type FaceMaps = { front: ThreeTexture; back: ThreeTexture; side: ThreeTexture };

const SHIRT_FRONT: Zone = CLASSIC_SHIRT_UV.torso_front;
const SHIRT_BACK: Zone = CLASSIC_SHIRT_UV.torso_back;
const SHIRT_SIDE: Zone = CLASSIC_SHIRT_UV.torso_right;
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

function useSingleClothingMaps(textureUrl?: string) {
  const [maps, setMaps] = useState<ClothingMaps | null>(null);
  useEffect(() => {
    let alive = true;
    const source = textureUrl ? new Image() : null;
    const applyMaps = (base: CanvasImageSource) => {
      if (!alive) return;
      setMaps((prev) => {
        Object.values(prev ?? {}).forEach((texture) => texture.dispose());
        return {
          shirtFront: makeTextureFromZone(base, SHIRT_FRONT, "#475569"),
          shirtBack: makeTextureFromZone(base, SHIRT_BACK, "#475569"),
          shirtSide: makeTextureFromZone(base, SHIRT_SIDE, "#475569"),
          leftArmFront: makeTextureFromZone(base, CLASSIC_SHIRT_UV.left_arm_front, "#475569"),
          leftArmBack: makeTextureFromZone(base, CLASSIC_SHIRT_UV.left_arm_back, "#475569"),
          leftArmSide: makeTextureFromZone(base, CLASSIC_SHIRT_UV.left_arm_left, "#475569"),
          rightArmFront: makeTextureFromZone(base, CLASSIC_SHIRT_UV.right_arm_front, "#475569"),
          rightArmBack: makeTextureFromZone(base, CLASSIC_SHIRT_UV.right_arm_back, "#475569"),
          rightArmSide: makeTextureFromZone(base, CLASSIC_SHIRT_UV.right_arm_right, "#475569"),
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

function useClothingMaps(textureUrl?: string, shirtTextureUrl?: string, pantsTextureUrl?: string) {
  const shirt = useSingleClothingMaps(shirtTextureUrl ?? textureUrl);
  const pants = useSingleClothingMaps(pantsTextureUrl ?? textureUrl);
  return useMemo(() => shirt && pants ? { ...shirt, pantsFront: pants.pantsFront, pantsBack: pants.pantsBack, pantsSide: pants.pantsSide } : null, [shirt, pants]);
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

function RobloxAvatar({ maps, view, itemType, avatar, mode, representation, outfitDNA }: { maps: ClothingMaps | null; view: "front" | "back"; itemType: "shirt" | "pants"; avatar: AvatarState; mode: PreviewMode; representation: PreviewRepresentation; outfitDNA?: OutfitDNA }) {
  if (!maps) return null;
  // Show the full outfit: shirt zones on the torso/arms and pants zones on the legs.
  void itemType;
  const torsoMaps: FaceMaps = { front: maps.shirtFront, back: maps.shirtBack, side: maps.shirtSide };
  const leftArmMaps: FaceMaps = { front: maps.leftArmFront, back: maps.leftArmBack, side: maps.leftArmSide };
  const rightArmMaps: FaceMaps = { front: maps.rightArmFront, back: maps.rightArmBack, side: maps.rightArmSide };
  // Leg sides sample the front zone: the side zone (x=44) is unpainted in the shirt-template atlas.
  const pantsMaps: FaceMaps = { front: maps.pantsFront, back: maps.pantsBack, side: maps.pantsFront };
  const baseModel = getAvatarBaseModel(avatar.modelVariant);
  const presetScale = avatar.scalePreset === "slender" ? [0.94, 1.05, 0.92] : avatar.scalePreset === "stocky" ? [1.1, 0.98, 1.1] : [1, 1, 1];
  const poseRotY = avatar.pose === "hero" ? 0.15 : avatar.pose === "walk" ? 0.06 : 0;
  return (
    <group rotation-y={view === "back" ? Math.PI : 0} scale={[
      baseModel.proportions.x * presetScale[0] * avatar.bodyScale.width,
      baseModel.proportions.y * presetScale[1] * avatar.bodyScale.height,
      baseModel.proportions.z * presetScale[2],
    ]}>
      <group rotation-y={poseRotY}>
        <RobloxAvatarModel surfaces={{
          torso: <meshStandardMaterial map={view === "back" ? torsoMaps.back : torsoMaps.front} roughness={.76} />,
          leftArm: <meshStandardMaterial map={view === "back" ? leftArmMaps.back : leftArmMaps.front} roughness={.76} />,
          rightArm: <meshStandardMaterial map={view === "back" ? rightArmMaps.back : rightArmMaps.front} roughness={.76} />,
          pants: <meshStandardMaterial map={view === "back" ? pantsMaps.back : pantsMaps.front} roughness={.72} />,
          skin: <meshStandardMaterial color={avatar.skinTone} roughness={.48} />,
        }}>{representation === "enhanced" && <GarmentPreview dna={outfitDNA} />}</RobloxAvatarModel>
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
      <Lightformer intensity={1.2} rotation-y={Math.PI / 2} position={[-5, 2, 0]} scale={[10, 10, 1]} color="#f4f1ea" />
      <Lightformer intensity={.8} rotation-y={-Math.PI / 2} position={[5, 2, 0]} scale={[10, 10, 1]} color="#e8edf2" />
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

function SceneContent({ maps, view, itemType, rotation, avatar, mode, representation, outfitDNA, animated = false }: { maps: ClothingMaps | null; view: "front" | "back"; itemType: "shirt" | "pants"; rotation: number; avatar: AvatarState; mode: PreviewMode; representation: PreviewRepresentation; outfitDNA?: OutfitDNA; animated?: boolean }) {
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
      
      <spotLight position={[-4, 4, -4]} intensity={1.1} color="#f4f1ea" penumbra={1} distance={15} />
      <spotLight position={[4, 3, -4]} intensity={.8} color="#e8edf2" penumbra={1} distance={15} />

      <Stage />

      <group rotation-y={rotation}>
        <IdleGroup enabled={animated}>
          <RobloxAvatar maps={maps} view={view} itemType={itemType} avatar={avatar} mode={mode} representation={representation} outfitDNA={outfitDNA} />
        </IdleGroup>
      </group>

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

export function AvatarPreview({ textureUrl, shirtTextureUrl, pantsTextureUrl, className, avatarType = "neutral", view: controlledView, onViewChange, itemType = "shirt", dimension, previewMode, studioMode = false, animated = false, avatarState, outfitDNA, representation: controlledRepresentation, onRepresentationChange }: AvatarPreviewProps) {
  const resolvedMode: PreviewMode = previewMode ?? (dimension === "3d" ? "avatar" : "clothing");
  const [internalView, setInternalView] = useState<"front" | "back">("front");
  const [zoom, setZoom] = useState(resolvedMode === "clothing" ? 3.6 : 4.9);
  const [rotation, setRotation] = useState(0);
  const [internalRepresentation, setInternalRepresentation] = useState<PreviewRepresentation>("enhanced");
  const maps = useClothingMaps(textureUrl, shirtTextureUrl, pantsTextureUrl);
  const effectiveAvatar = useMemo(() => ({ ...defaultAvatarState(), ...avatarState, slots: { ...defaultAvatarState().slots, ...(avatarState?.slots ?? {}) } }), [avatarState]);
  const view = controlledView ?? internalView;
  const setView = (next: "front" | "back") => { if (!controlledView) setInternalView(next); onViewChange?.(next); };
  const subtitle = resolvedMode === "clothing" ? "Clothing Preview" : "Avatar Look Preview";
  const webglAvailable = useWebGLAvailable();
  const representation = controlledRepresentation ?? internalRepresentation;
  const setRepresentation = (next: PreviewRepresentation) => { if (!controlledRepresentation) setInternalRepresentation(next); onRepresentationChange?.(next); };

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
        <SceneContent maps={maps} view={view} itemType={itemType} rotation={rotation} avatar={effectiveAvatar} mode={resolvedMode} representation={representation} outfitDNA={outfitDNA} animated={animated} />
      </Canvas>
    </WebGLBoundary>
  );

  if (studioMode) {
    return <div className="relative w-full h-full">{scene}<div className="absolute right-4 top-4 flex rounded-full border border-white/15 bg-black/70 p-1 backdrop-blur"><button onClick={() => setRepresentation("enhanced")} className={`rounded-full px-3 py-1.5 text-xs ${representation === "enhanced" ? "bg-violet-500 text-white" : "text-white/65"}`}>Enhanced Preview</button><button onClick={() => setRepresentation("classic")} className={`rounded-full px-3 py-1.5 text-xs ${representation === "classic" ? "bg-violet-500 text-white" : "text-white/65"}`}>Roblox Classic</button></div><div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur rounded-full px-4 py-2 border border-white/10"><button onClick={() => setView("front")} className={`text-xs px-3 py-1 rounded-full ${view === "front" ? "bg-white/20 text-white" : "text-white/50 hover:text-white"}`}>Front</button><button onClick={() => setView("back")} className={`text-xs px-3 py-1 rounded-full ${view === "back" ? "bg-white/20 text-white" : "text-white/50 hover:text-white"}`}>Back</button><button onClick={() => setRotation((p) => p + 0.3)} className="text-white/60 hover:text-white p-1" title="Rotate"><RotateCw className="w-3.5 h-3.5" /></button><button onClick={() => setZoom((p) => Math.min(6, p + 0.4))} className="text-white/60 hover:text-white p-1" title="Zoom out"><ZoomOut className="w-3.5 h-3.5" /></button><button onClick={() => setZoom((p) => Math.max(2.2, p - 0.4))} className="text-white/60 hover:text-white p-1" title="Zoom in"><ZoomIn className="w-3.5 h-3.5" /></button></div><div className="absolute left-4 top-4 text-[10px] uppercase tracking-widest text-white/35 font-medium">{avatarType} · {subtitle}<span className="mt-2 block max-w-48 normal-case tracking-normal text-white/55">The 3D garment shape is an enhanced preview. Your Roblox Classic Clothing download contains the texture.</span></div></div>;
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
