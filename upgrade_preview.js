import fs from 'fs';

const filePath = 'artifacts/my-skins/src/components/editor/AvatarPreview.tsx';
let code = fs.readFileSync(filePath, 'utf8');

// 1. Add Environment to imports
if (!code.includes('Environment')) {
  code = code.replace(
    /import \{ OrbitControls, RoundedBox, ContactShadows, SoftShadows \} from "@react-three\/drei";/,
    'import { OrbitControls, RoundedBox, ContactShadows, SoftShadows, Environment } from "@react-three/drei";'
  );
}

// 2. Change makeStandardMaterial implementation
code = code.replace(
  /<meshStandardMaterial\n\s*color=\{part\.useAssetColor \? color : \(part\.color \?\? "#94a3b8"\)\}[\s\S]*?alphaTest=\{part\.alphaTest\}\n\s*\/>/,
  `<meshPhysicalMaterial
      color={part.useAssetColor ? color : (part.color ?? "#94a3b8")}
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
    />`
);

// 3. BodyPart skin
code = code.replace(
  /<meshStandardMaterial color=\{skinTone\} roughness=\{0\.35\} metalness=\{0\.05\} \/>/g,
  '<meshPhysicalMaterial color={skinTone} roughness={0.35} metalness={0.05} clearcoat={0.3} clearcoatRoughness={0.4} />'
);

// 4. BodyPart clothing
for (let i = 0; i < 6; i++) {
  code = code.replace(
    new RegExp(`<meshStandardMaterial attach="material-${i}" ([^>]+) roughness=\\{0\\.4\\} metalness=\\{0\\.05\\} \\/>`, 'g'),
    `<meshPhysicalMaterial attach="material-${i}" $1 roughness={0.75} metalness={0.02} sheen={0.4} sheenRoughness={0.5} />`
  );
}

// 5. GarmentOverlay generic materials
code = code.replace(
  /<meshStandardMaterial ([^>]+) \/>/g,
  (match, props) => {
    // If it already has sheen or clearcoat, skip
    if (props.includes('sheen=') || props.includes('clearcoat=')) return match;
    // Replace roughness/metalness if present
    let newProps = props;
    if (newProps.includes('roughness=')) {
      newProps = newProps.replace(/roughness=\{[0-9.]+\}/, 'roughness={0.75}');
    } else {
      newProps += ' roughness={0.75}';
    }
    if (newProps.includes('metalness=')) {
      newProps = newProps.replace(/metalness=\{[0-9.]+\}/, 'metalness={0.02}');
    } else {
      newProps += ' metalness={0.02}';
    }
    return `<meshPhysicalMaterial ${newProps} sheen={0.4} sheenRoughness={0.5} />`;
  }
);

// 6. Lighting & Backdrops in AvatarPreview component
// Replace the pedestal:
code = code.replace(
  /\{mode === "avatar" && \(\s*<mesh position=\{\[0, -0\.05, 0\]\} receiveShadow>\s*<cylinderGeometry args=\{\[1\.5, 1\.5, 0\.1, 64\]\} \/>\s*<meshPhysicalMaterial[^>]+>\s*<\/mesh>\s*\)\}/,
  `{mode === "avatar" && (
            <group position={[0, -0.05, 0]}>
              <mesh receiveShadow castShadow>
                <cylinderGeometry args={[1.3, 1.35, 0.1, 64]} />
                <meshPhysicalMaterial color="#0f172a" roughness={0.2} metalness={0.5} clearcoat={0.5} clearcoatRoughness={0.2} />
              </mesh>
              <mesh position={[0, 0.005, 0]} receiveShadow>
                <cylinderGeometry args={[1.2, 1.2, 0.1, 64]} />
                <meshPhysicalMaterial color="#1e293b" roughness={0.7} metalness={0.1} />
              </mesh>
            </group>
          )}`
);

// And replace the lighting block
const lightingRegex = /\{studioMode \? \([\s\S]*? intensity=\{0\.5\} \/>\s*<\/>\s*\)\}/;
const newLighting = `{studioMode ? (
          <>
            <Environment preset="city" environmentIntensity={0.8} />
            <spotLight position={[4, 6, 4]} angle={0.6} penumbra={0.5} intensity={2.5} castShadow shadow-bias={-0.0001} shadow-mapSize={[1024, 1024]} color="#fff0dd" />
            <spotLight position={[-4, 4, 4]} angle={0.6} penumbra={0.5} intensity={1} color="#dbeafe" />
            <spotLight position={[0, 5, -6]} angle={0.6} penumbra={0.2} intensity={4} color="#e0e7ff" castShadow shadow-bias={-0.0001} />
          </>
        ) : (
          <>
            <Environment preset="city" environmentIntensity={0.6} />
            <spotLight position={[3, 5, 4]} angle={0.5} penumbra={0.5} intensity={1.8} castShadow shadow-bias={-0.0001} shadow-mapSize={[1024, 1024]} color="#fffaf0" />
            <spotLight position={[-3, 3, 3]} angle={0.5} penumbra={0.5} intensity={0.8} color="#e2e8f0" />
            <spotLight position={[0, 4, -5]} angle={0.6} penumbra={0.5} intensity={2.5} color="#e0e7ff" />
          </>
        )}`;

if (code.match(lightingRegex)) {
  code = code.replace(lightingRegex, newLighting);
} else {
  console.log("Could not find lighting block to replace!");
}

// Ensure SoftShadows are updated
code = code.replace(/<SoftShadows size=\{20\} samples=\{10\} focus=\{0\.5\} \/>/g, '<SoftShadows size={15} samples={16} focus={0.5} />');

// Ensure ContactShadows are updated if exist, else add them
if (!code.includes('<ContactShadows')) {
  // Add inside the group but after mode === avatar
  code = code.replace(
    /\{mode === "avatar" && \(/,
    `<ContactShadows position={[0, 0.01, 0]} opacity={0.5} scale={4} blur={2.5} far={2} />\n          {mode === "avatar" && (`
  );
}

fs.writeFileSync(filePath, code);
console.log("Upgraded AvatarPreview.tsx successfully.");
