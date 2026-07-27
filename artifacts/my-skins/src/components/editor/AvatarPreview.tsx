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

type ThreeTexture = ReturnType<typeof makeTextureFromZone>;
type PreviewMode = "clothing" | "avatar";

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
      emissiveIntensity={part.emissiveIntensity ?? 0}
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
    return <RoundedBox args={args} radius={radius} smoothness={smoothness} position={position} castShadow><meshStandardMaterial color={skinTone} roughness={0.42} metalness={0.02} /></RoundedBox>;
  }
  const mapSet = material === "shirt" ? maps.shirt : maps.pants;
  const baseColor = material === "shirt" ? "#f8fafc" : "#e2e8f0";
  const topColor = material === "shirt" ? "#dbeafe" : "#cbd5e1";
  const bottomColor = material === "shirt" ? "#e2e8f0" : "#bfdbfe";
  return (
    <RoundedBox args={args} radius={radius} smoothness={smoothness} position={position} castShadow>
      <meshStandardMaterial attach="material-0" map={mapSet.side} color={baseColor} roughness={0.69} metalness={0.02} />
      <meshStandardMaterial attach="material-1" map={mapSet.side} color={baseColor} roughness={0.69} metalness={0.02} />
      <meshStandardMaterial attach="material-2" color={topColor} roughness={0.74} />
      <meshStandardMaterial attach="material-3" color={bottomColor} roughness={0.74} />
      <meshStandardMaterial attach="material-4" map={mapSet.front} color={baseColor} roughness={0.66} metalness={0.02} />
      <meshStandardMaterial attach="material-5" map={mapSet.back} color={baseColor} roughness={0.66} metalness={0.02} />
    </RoundedBox>
  );
}

function RobloxAvatar({ maps, view, itemType, avatar, mode }: { maps: ClothingMaps | null; view: "front" | "back"; itemType: "shirt" | "pants"; avatar: AvatarState; mode: PreviewMode }) {
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
      <color attach="background" args={["#10131c"]} />
      <Lightformer intensity={2.4} rotation-x={Math.PI / 2} position={[0, 5, -2]} scale={[12, 12, 1]} color="#ffffff" />
      <Lightformer intensity={1.1} rotation-y={Math.PI / 2} position={[-5, 1.5, 0]} scale={[6, 8, 1]} color="#bcd4ff" />
      <Lightformer intensity={1.1} rotation-y={-Math.PI / 2} position={[5, 1.5, 0]} scale={[6, 8, 1]} color="#ffe6c2" />
      <Lightformer intensity={1.6} rotation-y={Math.PI} position={[0, 2, 4]} scale={[8, 6, 1]} color="#ffffff" />
    </Environment>
  );
}

function IdleGroup({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const groupRef = useRef<{ rotation: { y: number; z: number }; position: { y: number } } | null>(null);
  useFrame(({ clock }) => {
    if (!enabled || !groupRef.current) return;
    const t = clock.getElapsedTime();
    groupRef.current.rotation.y = Math.sin(t * 0.45) * 0.28;
    groupRef.current.position.y = Math.sin(t * 1.6) * 0.02;
    groupRef.current.rotation.z = Math.sin(t * 0.8) * 0.012;
  });
  return <group ref={groupRef}>{children}</group>;
}

function SceneContent({ maps, view, itemType, rotation, avatar, mode, animated = false }: { maps: ClothingMaps | null; view: "front" | "back"; itemType: "shirt" | "pants"; rotation: number; avatar: AvatarState; mode: PreviewMode; animated?: boolean }) {
  const cameraTarget: [number, number, number] = mode === "clothing" ? [0, 1.2, 0] : [0, 1.05, 0];
  return (
    <>
      <color attach="background" args={["#0b0f1a"]} />
      <fog attach="fog" args={["#0b0f1a", 7.5, 16]} />
      <SoftShadows size={26} samples={14} focus={0.85} />
      <StudioEnvironment />
      <ambientLight intensity={mode === "clothing" ? 0.32 : 0.26} />
      <hemisphereLight intensity={0.45} color="#f1f5ff" groundColor="#0b0f1a" />
      <directionalLight
        position={[4.8, 8.2, 5.2]}
        intensity={mode === "clothing" ? 2.5 : 2.1}
        color="#fff6e8"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.00035}
        shadow-normalBias={0.02}
        shadow-camera-near={1}
        shadow-camera-far={24}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={5}
        shadow-camera-bottom={-2}
      />
      <directionalLight position={[-5, 3.4, -3.2]} intensity={0.9} color="#8fb6ff" />
      <pointLight position={[0, 1.6, -3]} intensity={0.7} color="#cfe0ff" />
      <group rotation-y={rotation}><IdleGroup enabled={animated}><RobloxAvatar maps={maps} view={view} itemType={itemType} avatar={avatar} mode={mode} /></IdleGroup></group>
      <ContactShadows position={[0, -0.4, 0]} scale={6} far={4} blur={2.6} opacity={0.6} resolution={1024} color="#05070d" />
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.402, 0]}><ringGeometry args={[1.0, 2.6, 80]} /><meshBasicMaterial color="#38507a" transparent opacity={0.22} /></mesh>
      <OrbitControls enablePan={false} enableDamping dampingFactor={0.08} minPolarAngle={0.35} maxPolarAngle={Math.PI / 1.75} minDistance={2.2} maxDistance={6.2} target={cameraTarget} />
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

export function AvatarPreview({ textureUrl, className, avatarType = "neutral", view: controlledView, onViewChange, itemType = "shirt", dimension, previewMode, studioMode = false, animated = false, avatarState }: AvatarPreviewProps) {
  const resolvedMode: PreviewMode = previewMode ?? (dimension === "3d" ? "avatar" : "clothing");
  const [internalView, setInternalView] = useState<"front" | "back">("front");
  const [zoom, setZoom] = useState(3.6);
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
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        camera={{ position: [0, 1.3, zoom], fov: resolvedMode === "clothing" ? 34 : 38 }}
        className="w-full h-full"
      >
        <SceneContent maps={maps} view={view} itemType={itemType} rotation={rotation} avatar={effectiveAvatar} mode={resolvedMode} animated={animated} />
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
