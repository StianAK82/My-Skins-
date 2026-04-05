import { useEffect, useMemo, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { CanvasTexture, TextureLoader } from "three";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RotateCw, ZoomIn, ZoomOut } from "lucide-react";

type ThreeTexture = InstanceType<typeof CanvasTexture>;

type EditorDimension = "2d" | "3d";
type GarmentMaterial = "cotton" | "denim" | "nylon";

type AvatarPreviewProps = {
  textureUrl?: string;
  className?: string;
  avatarType?: string;
  bodyType?: string;
  view?: "front" | "back";
  onViewChange?: (view: "front" | "back") => void;
  itemType?: "shirt" | "pants";
  dimension?: EditorDimension;
  garmentColor?: string;
  garmentMaterial?: GarmentMaterial;
  garmentScale?: number;
  studioMode?: boolean;
};

type Zone = { left: number; top: number; width: number; height: number };

type ClothingMaps = {
  shirtFront: ThreeTexture;
  shirtBack: ThreeTexture;
  shirtSide: ThreeTexture;
  pantsFront: ThreeTexture;
  pantsBack: ThreeTexture;
  pantsSide: ThreeTexture;
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
    const fallbackTexture = new CanvasTexture(canvas);
    fallbackTexture.needsUpdate = true;
    return fallbackTexture;
  }
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
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#334155";
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
      source.src = textureUrl ?? "";
      source.onerror = () => applyMaps(buildFallbackAtlas());
    } else {
      applyMaps(buildFallbackAtlas());
    }
    return () => { alive = false; };
  }, [textureUrl]);

  return maps;
}

function Mannequin2D({ maps, bodyType, view, itemType }: {
  maps: ClothingMaps;
  bodyType: string;
  view: "front" | "back";
  itemType: "shirt" | "pants";
}) {
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
      {/* Head */}
      <mesh position={[0, 1.78, 0]} castShadow>
        <boxGeometry args={[0.4, 0.4, 0.4]} />
        <meshStandardMaterial color="#f1c7a6" roughness={0.8} />
      </mesh>
      {/* Neck */}
      <mesh position={[0, 1.54, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.15, 16]} />
        <meshStandardMaterial color="#f1c7a6" roughness={0.8} />
      </mesh>
      {/* Torso */}
      <mesh position={[0, 1.2, 0]} castShadow>
        <boxGeometry args={[0.72, 0.82, 0.36]} />
        <meshStandardMaterial attach="material-0" map={torsoSide} roughness={0.7} />
        <meshStandardMaterial attach="material-1" map={torsoSide} roughness={0.7} />
        <meshStandardMaterial attach="material-2" color="#1e293b" roughness={0.7} />
        <meshStandardMaterial attach="material-3" color="#1e293b" roughness={0.7} />
        <meshStandardMaterial attach="material-4" map={torsoFront} roughness={0.7} />
        <meshStandardMaterial attach="material-5" map={torsoBack} roughness={0.7} />
      </mesh>
      {/* Left arm */}
      <mesh position={[-0.56, 1.2, 0]} castShadow>
        <boxGeometry args={[0.28, 0.78, 0.28]} />
        <meshStandardMaterial map={torsoSide} roughness={0.7} />
      </mesh>
      {/* Right arm */}
      <mesh position={[0.56, 1.2, 0]} castShadow>
        <boxGeometry args={[0.28, 0.78, 0.28]} />
        <meshStandardMaterial map={torsoSide} roughness={0.7} />
      </mesh>
      {/* Left hand */}
      <mesh position={[-0.56, 0.76, 0]}>
        <boxGeometry args={[0.24, 0.18, 0.24]} />
        <meshStandardMaterial color="#f1c7a6" roughness={0.8} />
      </mesh>
      {/* Right hand */}
      <mesh position={[0.56, 0.76, 0]}>
        <boxGeometry args={[0.24, 0.18, 0.24]} />
        <meshStandardMaterial color="#f1c7a6" roughness={0.8} />
      </mesh>
      {/* Left leg */}
      <mesh position={[-0.2, 0.46, 0]} castShadow>
        <boxGeometry args={[0.3, 0.92, 0.3]} />
        <meshStandardMaterial attach="material-0" map={legSide} roughness={0.7} />
        <meshStandardMaterial attach="material-1" map={legSide} roughness={0.7} />
        <meshStandardMaterial attach="material-2" color="#0f172a" roughness={0.8} />
        <meshStandardMaterial attach="material-3" color="#0f172a" roughness={0.8} />
        <meshStandardMaterial attach="material-4" map={legFront} roughness={0.7} />
        <meshStandardMaterial attach="material-5" map={legBack} roughness={0.7} />
      </mesh>
      {/* Right leg */}
      <mesh position={[0.2, 0.46, 0]} castShadow>
        <boxGeometry args={[0.3, 0.92, 0.3]} />
        <meshStandardMaterial attach="material-0" map={legSide} roughness={0.7} />
        <meshStandardMaterial attach="material-1" map={legSide} roughness={0.7} />
        <meshStandardMaterial attach="material-2" color="#0f172a" roughness={0.8} />
        <meshStandardMaterial attach="material-3" color="#0f172a" roughness={0.8} />
        <meshStandardMaterial attach="material-4" map={legFront} roughness={0.7} />
        <meshStandardMaterial attach="material-5" map={legBack} roughness={0.7} />
      </mesh>
      {/* Feet */}
      <mesh position={[-0.2, -0.02, 0.04]}>
        <boxGeometry args={[0.28, 0.1, 0.36]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} />
      </mesh>
      <mesh position={[0.2, -0.02, 0.04]}>
        <boxGeometry args={[0.28, 0.1, 0.36]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} />
      </mesh>
      {/* Ground shadow ring */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.07, 0]} receiveShadow>
        <circleGeometry args={[0.7, 32]} />
        <meshStandardMaterial color="#000000" transparent opacity={0.25} />
      </mesh>
    </group>
  );
}

function materialProps(material: GarmentMaterial) {
  if (material === "denim") return { roughness: 0.86, metalness: 0.1 };
  if (material === "nylon") return { roughness: 0.35, metalness: 0.2 };
  return { roughness: 0.7, metalness: 0.05 };
}

function Mannequin3D({ view, bodyType, garmentColor, garmentMaterial, garmentScale, textureUrl }: {
  view: "front" | "back";
  bodyType: string;
  garmentColor: string;
  garmentMaterial: GarmentMaterial;
  garmentScale: number;
  textureUrl?: string;
}) {
  const bodyScale = useMemo(() => {
    if (bodyType === "slim") return [0.92, 1, 0.92] as const;
    if (bodyType === "athletic") return [1.08, 1.04, 1.05] as const;
    return [1, 1, 1] as const;
  }, [bodyType]);

  const decalMap = useMemo(() => {
    if (!textureUrl) return null;
    const texture = new TextureLoader().load(textureUrl);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }, [textureUrl]);

  const mat = materialProps(garmentMaterial);

  return (
    <group rotation-y={view === "back" ? Math.PI : 0} scale={bodyScale}>
      {/* Head */}
      <mesh position={[0, 1.8, 0]} castShadow>
        <boxGeometry args={[0.4, 0.4, 0.4]} />
        <meshStandardMaterial color="#f1c7a6" roughness={0.75} />
      </mesh>
      {/* Body underlay */}
      <mesh position={[0, 1.2, 0]} castShadow>
        <boxGeometry args={[0.68, 0.8, 0.34]} />
        <meshStandardMaterial color="#e5e7eb" roughness={0.9} />
      </mesh>
      {/* Garment torso */}
      <mesh position={[0, 1.22, 0]} scale={[garmentScale, garmentScale, garmentScale]} castShadow>
        <boxGeometry args={[0.82, 0.94, 0.46]} />
        <meshStandardMaterial color={garmentColor} {...mat} />
      </mesh>
      {/* Left sleeve */}
      <mesh position={[-0.62, 1.2, 0]} scale={[garmentScale, garmentScale, garmentScale]} castShadow>
        <cylinderGeometry args={[0.14, 0.16, 0.78, 24]} />
        <meshStandardMaterial color={garmentColor} {...mat} />
      </mesh>
      {/* Right sleeve */}
      <mesh position={[0.62, 1.2, 0]} scale={[garmentScale, garmentScale, garmentScale]} castShadow>
        <cylinderGeometry args={[0.14, 0.16, 0.78, 24]} />
        <meshStandardMaterial color={garmentColor} {...mat} />
      </mesh>
      {/* Front decal */}
      <mesh position={[0, 1.32, 0.24]} scale={[garmentScale, garmentScale, garmentScale]}>
        <planeGeometry args={[0.42, 0.32]} />
        <meshStandardMaterial color="#ffffff" map={decalMap ?? undefined} transparent={Boolean(decalMap)} />
      </mesh>
      {/* Legs */}
      <mesh position={[-0.19, 0.46, 0]} castShadow>
        <boxGeometry args={[0.34, 0.92, 0.3]} />
        <meshStandardMaterial color="#1e293b" roughness={0.9} />
      </mesh>
      <mesh position={[0.19, 0.46, 0]} castShadow>
        <boxGeometry args={[0.34, 0.92, 0.3]} />
        <meshStandardMaterial color="#1e293b" roughness={0.9} />
      </mesh>
      {/* Feet */}
      <mesh position={[-0.19, -0.02, 0.04]}>
        <boxGeometry args={[0.28, 0.1, 0.36]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} />
      </mesh>
      <mesh position={[0.19, -0.02, 0.04]}>
        <boxGeometry args={[0.28, 0.1, 0.36]} />
        <meshStandardMaterial color="#0f172a" roughness={0.9} />
      </mesh>
    </group>
  );
}

function SceneContent({ maps, dimension, bodyType, view, itemType, garmentColor, garmentMaterial, garmentScale, textureUrl, rotation }: {
  maps: ClothingMaps | null;
  dimension: EditorDimension;
  bodyType: string;
  view: "front" | "back";
  itemType: "shirt" | "pants";
  garmentColor: string;
  garmentMaterial: GarmentMaterial;
  garmentScale: number;
  textureUrl?: string;
  rotation: number;
}) {
  return (
    <>
      <color attach="background" args={["#080e1a"]} />
      <ambientLight intensity={0.7} />
      <directionalLight position={[4, 7, 5]} intensity={1.2} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <directionalLight position={[-4, 4, -4]} intensity={0.4} />
      <pointLight position={[0, 3, 3]} intensity={0.3} color="#6366f1" />
      <group rotation-y={rotation}>
        {maps ? (
          dimension === "2d" ? (
            <Mannequin2D maps={maps} bodyType={bodyType} view={view} itemType={itemType} />
          ) : (
            <Mannequin3D view={view} bodyType={bodyType} garmentColor={garmentColor} garmentMaterial={garmentMaterial} garmentScale={garmentScale} textureUrl={textureUrl} />
          )
        ) : null}
      </group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.07, 0]} receiveShadow>
        <circleGeometry args={[3, 64]} />
        <meshStandardMaterial color="#0f172a" roughness={1} />
      </mesh>
      <OrbitControls enablePan={false} minDistance={2.2} maxDistance={6} target={[0, 1.0, 0]} />
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
  dimension = "2d",
  garmentColor = "#2563eb",
  garmentMaterial = "cotton",
  garmentScale = 1,
  studioMode = false,
}: AvatarPreviewProps) {
  const [internalView, setInternalView] = useState<"front" | "back">("front");
  const [zoom, setZoom] = useState(3.8);
  const [rotation, setRotation] = useState(0);
  const maps = useClothingMaps(textureUrl);

  const view = controlledView ?? internalView;
  const setView = (next: "front" | "back") => {
    if (!controlledView) setInternalView(next);
    onViewChange?.(next);
  };

  if (studioMode) {
    return (
      <div className="relative w-full h-full">
        <Canvas shadows camera={{ position: [0, 1.25, zoom], fov: 40 }} className="w-full h-full">
          <SceneContent
            maps={maps}
            dimension={dimension}
            bodyType={bodyType}
            view={view}
            itemType={itemType}
            garmentColor={garmentColor}
            garmentMaterial={garmentMaterial}
            garmentScale={garmentScale}
            textureUrl={textureUrl}
            rotation={rotation}
          />
        </Canvas>

        {/* Floating controls */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur rounded-full px-4 py-2 border border-white/10">
          <button
            onClick={() => setView("front")}
            className={`text-xs px-3 py-1 rounded-full transition-colors ${view === "front" ? "bg-white/20 text-white" : "text-white/50 hover:text-white"}`}
          >
            Front
          </button>
          <div className="w-px h-4 bg-white/20" />
          <button
            onClick={() => setView("back")}
            className={`text-xs px-3 py-1 rounded-full transition-colors ${view === "back" ? "bg-white/20 text-white" : "text-white/50 hover:text-white"}`}
          >
            Back
          </button>
          <div className="w-px h-4 bg-white/20" />
          <button onClick={() => setRotation((p) => p + 0.3)} className="text-white/60 hover:text-white p-1 transition-colors" title="Rotate">
            <RotateCw className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setZoom((p) => Math.min(6, p + 0.4))} className="text-white/60 hover:text-white p-1 transition-colors" title="Zoom out">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setZoom((p) => Math.max(2.2, p - 0.4))} className="text-white/60 hover:text-white p-1 transition-colors" title="Zoom in">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Avatar type badge */}
        <div className="absolute top-4 left-4 text-[10px] uppercase tracking-widest text-white/30 font-medium">
          {avatarType} · {bodyType}
        </div>
      </div>
    );
  }

  return (
    <Card className={className}>
      <div className="p-4 text-sm font-medium border-b border-border">
        Avatar Studio Preview · {avatarType} · {dimension === "2d" ? "Classic 2D" : "3D Clothing"}
      </div>
      <div className="px-4 pt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant={view === "front" ? "default" : "outline"} onClick={() => setView("front")}>Front</Button>
        <Button size="sm" variant={view === "back" ? "default" : "outline"} onClick={() => setView("back")}>Back</Button>
        <Button size="icon" variant="outline" onClick={() => setRotation((p) => p + 0.25)}><RotateCw className="w-4 h-4" /></Button>
        <Button size="icon" variant="outline" onClick={() => setZoom((p) => Math.min(5.2, p + 0.25))}><ZoomOut className="w-4 h-4" /></Button>
        <Button size="icon" variant="outline" onClick={() => setZoom((p) => Math.max(2.4, p - 0.25))}><ZoomIn className="w-4 h-4" /></Button>
      </div>
      <div className="h-[560px] p-4">
        {maps ? (
          <Canvas shadows camera={{ position: [0, 1.25, zoom], fov: 38 }}>
            <SceneContent
              maps={maps}
              dimension={dimension}
              bodyType={bodyType}
              view={view}
              itemType={itemType}
              garmentColor={garmentColor}
              garmentMaterial={garmentMaterial}
              garmentScale={garmentScale}
              textureUrl={textureUrl}
              rotation={rotation}
            />
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
