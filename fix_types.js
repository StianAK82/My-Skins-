import fs from 'fs';

const filePath = 'artifacts/my-skins/src/components/editor/AvatarPreview.tsx';
let code = fs.readFileSync(filePath, 'utf8');

code = code.replace(
  /let pmremGenerator;/g,
  'let pmremGenerator: THREE.PMREMGenerator | undefined;'
);

code = code.replace(
  /let envScene;/g,
  'let envScene: any;'
);

// We should use ts-ignore for the import
code = code.replace(
  /import\("three\/examples\/jsm\/environments\/RoomEnvironment\.js"\)/g,
  '// @ts-ignore\n    import("three/examples/jsm/environments/RoomEnvironment.js")'
);

fs.writeFileSync(filePath, code);
