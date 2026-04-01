import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RotateCcw, Rotate3D, ZoomIn, ZoomOut, SunMoon } from "lucide-react";

type PreviewTarget = "front" | "back";

interface AvatarPreviewProps {
  textureUrl: string;
  className?: string;
}

function extractRegionTexture(textureUrl: string, region: { x: number; y: number; width: number; height: number }) {
  const texture = new THREE.Texture();
  const image = new Image();
  image.crossOrigin = "anonymous";

  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = region.width;
    canvas.height = region.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(image, region.x, region.y, region.width, region.height, 0, 0, region.width, region.height);

    texture.image = canvas;
    texture.flipY = false;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
  };

  image.src = textureUrl;
  return texture;
}

function GlbAvatarModel({ textureUrl }: { textureUrl: string }) {
  const gltf = useGLTF("/models/roblox-r15.glb", true);
  const cloned = useMemo(() => gltf.scene.clone(true), [gltf.scene]);

  const torsoTexture = useMemo(
    () => extractRegionTexture(textureUrl, { x: 196, y: 118, width: 128, height: 128 }),
    [textureUrl],
  );
  const leftArmTexture = useMemo(
    () => extractRegionTexture(textureUrl, { x: 44, y: 118, width: 128, height: 128 }),
    [textureUrl],
  );
  const rightArmTexture = useMemo(
    () => extractRegionTexture(textureUrl, { x: 481, y: 118, width: 88, height: 128 }),
    [textureUrl],
  );

  useEffect(() => () => {
    torsoTexture.dispose();
    leftArmTexture.dispose();
    rightArmTexture.dispose();
  }, [leftArmTexture, rightArmTexture, torsoTexture]);

  cloned.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;
    const key = obj.name.toLowerCase();
    if (key.includes("torso") || key.includes("upperbody")) {
      obj.material = new THREE.MeshStandardMaterial({ map: torsoTexture, roughness: 0.8, metalness: 0 });
    }
    if (key.includes("left") && key.includes("arm")) {
      obj.material = new THREE.MeshStandardMaterial({ map: leftArmTexture, roughness: 0.8, metalness: 0 });
    }
    if (key.includes("right") && key.includes("arm")) {
      obj.material = new THREE.MeshStandardMaterial({ map: rightArmTexture, roughness: 0.8, metalness: 0 });
    }
  });

  return <primitive object={cloned} position={[0, -1.8, 0]} scale={1.6} />;
}

function RobloxAvatarModel({ textureUrl, autoRotate }: { textureUrl: string; autoRotate: boolean }) {
  const fallbackRef = useRef<THREE.Group>(null);
  const [hasGlbModel, setHasGlbModel] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetch("/models/roblox-r15.glb", { method: "HEAD" })
      .then((res) => {
        if (mounted) setHasGlbModel(res.ok);
      })
      .catch(() => {
        if (mounted) setHasGlbModel(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const torsoTexture = useMemo(
    () => extractRegionTexture(textureUrl, { x: 196, y: 118, width: 128, height: 128 }),
    [textureUrl],
  );
  const leftArmTexture = useMemo(
    () => extractRegionTexture(textureUrl, { x: 44, y: 118, width: 128, height: 128 }),
    [textureUrl],
  );
  const rightArmTexture = useMemo(
    () => extractRegionTexture(textureUrl, { x: 481, y: 118, width: 88, height: 128 }),
    [textureUrl],
  );

  useFrame((_, delta) => {
    if (autoRotate && fallbackRef.current) {
      fallbackRef.current.rotation.y += delta * 0.6;
    }
  });

  useEffect(() => () => {
    torsoTexture.dispose();
    leftArmTexture.dispose();
    rightArmTexture.dispose();
  }, [leftArmTexture, rightArmTexture, torsoTexture]);

  if (hasGlbModel) {
    return <GlbAvatarModel textureUrl={textureUrl} />;
  }

  return (
    <group ref={fallbackRef} position={[0, -0.6, 0]}>
      <mesh position={[0, 0.65, 0]}>
        <boxGeometry args={[1.2, 1.4, 0.7]} />
        <meshStandardMaterial map={torsoTexture} roughness={0.8} metalness={0} />
      </mesh>

      <mesh position={[-0.95, 0.65, 0]}>
        <boxGeometry args={[0.45, 1.4, 0.45]} />
        <meshStandardMaterial map={leftArmTexture} roughness={0.8} metalness={0} />
      </mesh>
      <mesh position={[0.95, 0.65, 0]}>
        <boxGeometry args={[0.45, 1.4, 0.45]} />
        <meshStandardMaterial map={rightArmTexture} roughness={0.8} metalness={0} />
      </mesh>

      <mesh position={[-0.35, -0.7, 0]}>
        <boxGeometry args={[0.45, 1.3, 0.45]} />
        <meshStandardMaterial color="#445" roughness={0.95} />
      </mesh>
      <mesh position={[0.35, -0.7, 0]}>
        <boxGeometry args={[0.45, 1.3, 0.45]} />
        <meshStandardMaterial color="#445" roughness={0.95} />
      </mesh>

      <mesh position={[0, 1.72, 0]}>
        <boxGeometry args={[0.9, 0.9, 0.9]} />
        <meshStandardMaterial color="#f3d8c0" roughness={0.8} />
      </mesh>
    </group>
  );
}

function CameraRig({ targetView }: { targetView: PreviewTarget }) {
  const { camera } = useThree();

  useEffect(() => {
    const z = targetView === "front" ? 4.8 : -4.8;
    camera.position.set(0, 1.2, z);
    camera.lookAt(0, 0.6, 0);
  }, [camera, targetView]);

  return null;
}

export function AvatarPreview({ textureUrl, className }: AvatarPreviewProps) {
  const controlsRef = useRef<any>(null);
  const [targetView, setTargetView] = useState<PreviewTarget>("front");
  const [autoRotate, setAutoRotate] = useState(false);
  const [darkBg, setDarkBg] = useState(true);

  return (
    <Card className={className}>
      <div className="flex items-center justify-between p-3 border-b border-border gap-2">
        <div className="text-sm font-medium">Avatar Try-On Preview</div>
        <div className="flex gap-1">
          <Button size="sm" variant="outline" onClick={() => setTargetView((v) => (v === "front" ? "back" : "front"))}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            {targetView === "front" ? "Back" : "Front"}
          </Button>
          <Button size="sm" variant={autoRotate ? "default" : "outline"} onClick={() => setAutoRotate((v) => !v)}>
            <Rotate3D className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDarkBg((v) => !v)}>
            <SunMoon className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="relative h-[520px]">
        <Canvas camera={{ fov: 35, near: 0.1, far: 100 }}>
          <color attach="background" args={[darkBg ? "#0f172a" : "#e2e8f0"]} />
          <ambientLight intensity={0.55} />
          <directionalLight position={[5, 6, 4]} intensity={1.2} />
          <directionalLight position={[-4, 2, -2]} intensity={0.6} />
          <Suspense fallback={null}>
            <CameraRig targetView={targetView} />
            <RobloxAvatarModel textureUrl={textureUrl} autoRotate={autoRotate} />
          </Suspense>
          <OrbitControls ref={controlsRef} enablePan={false} minDistance={2.4} maxDistance={8} target={[0, 0.55, 0]} />
        </Canvas>

        <div className="absolute bottom-3 right-3 flex gap-1">
          <Button size="icon" variant="secondary" onClick={() => controlsRef.current?.dollyIn(1.18)}>
            <ZoomIn className="w-3.5 h-3.5" />
          </Button>
          <Button size="icon" variant="secondary" onClick={() => controlsRef.current?.dollyOut(1.18)}>
            <ZoomOut className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

useGLTF.preload("/models/roblox-r15.glb");
