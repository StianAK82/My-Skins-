import fs from 'fs';

const filePath = 'artifacts/my-skins/src/components/editor/AvatarPreview.tsx';
let code = fs.readFileSync(filePath, 'utf8');

code = code.replace(
  /let pmremGenerator: THREE\.PMREMGenerator \| undefined;/g,
  'let pmremGenerator: any;'
);

fs.writeFileSync(filePath, code);
