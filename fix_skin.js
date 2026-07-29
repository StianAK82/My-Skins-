import fs from 'fs';

const filePath = 'artifacts/my-skins/src/components/editor/AvatarPreview.tsx';
let code = fs.readFileSync(filePath, 'utf8');

// 1. Fix Bloom
code = code.replace(
  /<Bloom luminanceThreshold=\{1\.2\} mipmapBlur intensity=\{0\.6\} \/>/g,
  '<Bloom luminanceThreshold={2.0} mipmapBlur intensity={1.0} />'
);

// 2. Fix Skin Material
code = code.replace(
  /<meshPhysicalMaterial color=\{skinTone\} roughness=\{0\.35\} metalness=\{0\.05\} clearcoat=\{0\.3\} clearcoatRoughness=\{0\.4\} \/>/g,
  '<meshPhysicalMaterial color={skinTone} roughness={0.6} metalness={0.05} />'
);

// 3. Fix Lights
code = code.replace(
  /<ambientLight intensity=\{1\.5\} color="#ffffff" \/>/g,
  '<ambientLight intensity={1.2} color="#ffffff" />'
);
code = code.replace(
  /<hemisphereLight intensity=\{1\.0\} color="#ffffff" groundColor="#64748b" \/>/g,
  '<hemisphereLight intensity={0.6} color="#ffffff" groundColor="#64748b" />'
);

// 4. Just double check the directional and spot light intensities
code = code.replace(
  /<directionalLight position=\{\[0, 8, 4\]\} intensity=\{2\.8\}/g,
  '<directionalLight position={[0, 8, 4]} intensity={2.5}'
);


fs.writeFileSync(filePath, code);
