import fs from 'fs';

const filePath = 'artifacts/my-skins/src/components/editor/AvatarPreview.tsx';
let code = fs.readFileSync(filePath, 'utf8');

// The main goal is to make colors "#ffffff" when there's a map in BodyPart and GarmentOverlay
// In BodyPart: 
code = code.replace(
  /const baseColor = material === "shirt" \? "#f8fafc" : "#e2e8f0";/g,
  'const baseColor = "#ffffff";'
);
// In GarmentOverlay:
code = code.replace(
  /const shirtColor = "#f8fafc";/g,
  'const shirtColor = "#ffffff";'
);
code = code.replace(
  /const pantsColor = "#e2e8f0";/g,
  'const pantsColor = "#ffffff";'
);

// We need to also check RenderAssetPart and makeStandardMaterial
// makeStandardMaterial should set color to white if there's a map and useAssetColor isn't meant to tint it? 
// The user said: "garment meshes with a texture map should generally use color="#ffffff" unless the map is meant to be tinted"
// In makeStandardMaterial:
// `color={part.useAssetColor ? color : (part.color ?? "#94a3b8")}`
// If texture exists and it's a map, we might want color="#ffffff", but usually `part.color` or `part.useAssetColor` defines this.
// For garments, `baseColor` / `shirtColor` / `pantsColor` is what's multiplying the maps, so making them `#ffffff` fixes the garments.

// Now for StudioEnvironment, replace the lighting and the procedural PMREM Environment.
const envRegex = /function StudioEnvironment\(\) \{[\s\S]*?\}\s*\n\s*\nfunction Stage/m;
const newEnv = `function StudioEnvironment() {
  const { gl, scene } = useThree();
  
  useEffect(() => {
    let pmremGenerator;
    let envScene;
    import("three/examples/jsm/environments/RoomEnvironment.js")
      .then(({ RoomEnvironment }) => {
        pmremGenerator = new THREE.PMREMGenerator(gl);
        pmremGenerator.compileEquirectangularShader();
        envScene = new RoomEnvironment();
        scene.environment = pmremGenerator.fromScene(envScene).texture;
      })
      .catch((e) => console.error("Could not load RoomEnvironment", e));

    return () => {
      scene.environment = null;
      if (pmremGenerator) pmremGenerator.dispose();
      if (envScene) envScene.dispose();
    };
  }, [gl, scene]);

  return (
    <>
      <ambientLight intensity={1.5} color="#ffffff" />
      <hemisphereLight intensity={1.0} color="#ffffff" groundColor="#64748b" />
      <directionalLight position={[0, 8, 4]} intensity={2.8} color="#ffffff" castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0001} />
      <directionalLight position={[-6, 4, -2]} intensity={2.0} color="#dbeafe" />
      <directionalLight position={[6, 4, -2]} intensity={2.0} color="#e0e7ff" />
      <spotLight position={[0, 6, -6]} intensity={3.5} color="#ffffff" angle={0.8} penumbra={1} distance={15} />
    </>
  );
}

function Stage`;

code = code.replace(envRegex, newEnv);

// Remove the import of Environment from @react-three/drei since we don't use it anymore
code = code.replace(
  /import \{ OrbitControls, RoundedBox, ContactShadows, SoftShadows, Environment \} from "@react-three\/drei";/,
  'import { OrbitControls, RoundedBox, ContactShadows, SoftShadows } from "@react-three/drei";'
);

fs.writeFileSync(filePath, code);
