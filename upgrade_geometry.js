import fs from 'fs';

let code = fs.readFileSync('artifacts/my-skins/src/components/editor/AvatarPreview.tsx', 'utf8');

// Update GarmentOverlay smoothness
code = code.replace(/smoothness=\{4\}/g, 'smoothness={12}');
// Replace in RenderAssetPart
code = code.replace(/smoothness=\{part\.smoothness \?\? 4\}/g, 'smoothness={part.smoothness ?? 12}');

fs.writeFileSync('artifacts/my-skins/src/components/editor/AvatarPreview.tsx', code);
