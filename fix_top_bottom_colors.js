import fs from 'fs';

const filePath = 'artifacts/my-skins/src/components/editor/AvatarPreview.tsx';
let code = fs.readFileSync(filePath, 'utf8');

code = code.replace(
  /const topColor = material === "shirt" \? "#dbeafe" : "#cbd5e1";/g,
  'const topColor = "#ffffff";'
);
code = code.replace(
  /const bottomColor = material === "shirt" \? "#e2e8f0" : "#bfdbfe";/g,
  'const bottomColor = "#ffffff";'
);

fs.writeFileSync(filePath, code);
