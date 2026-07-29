import fs from 'fs';

let code = fs.readFileSync('artifacts/my-skins/src/lib/editor/assets.ts', 'utf8');

// Replace smoothness: 8 with smoothness: 16
code = code.replace(/smoothness: 8/g, 'smoothness: 16');
code = code.replace(/smoothness: 6/g, 'smoothness: 12');

fs.writeFileSync('artifacts/my-skins/src/lib/editor/assets.ts', code);
