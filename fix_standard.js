import fs from 'fs';

const filePath = 'artifacts/my-skins/src/components/editor/AvatarPreview.tsx';
let code = fs.readFileSync(filePath, 'utf8');

code = code.replace(
  /color=\{part\.useAssetColor \? color : \(part\.color \?\? "#94a3b8"\)\}/g,
  'color={texture ? "#ffffff" : (part.useAssetColor ? color : (part.color ?? "#94a3b8"))}'
);

fs.writeFileSync(filePath, code);
