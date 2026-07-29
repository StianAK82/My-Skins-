const fs = require('fs');
const file = 'artifacts/my-skins/src/lib/editor/assets.ts';
let content = fs.readFileSync(file, 'utf8');

const snakePartsCode = `
const hairSnakesParts: AvatarRenderPart[] = [
  makePart("roundedBox", [0.68, 0.2, 0.62], { radius: 0.1, position: [0, 0.05, 0], useAssetColor: true }),
];
[
  { r: 0, d: 0.2 }, { r: Math.PI/4, d: 0.2 }, { r: Math.PI/2, d: 0.2 }, { r: 3*Math.PI/4, d: 0.2 },
  { r: Math.PI, d: 0.2 }, { r: 5*Math.PI/4, d: 0.2 }, { r: 3*Math.PI/2, d: 0.2 }, { r: 7*Math.PI/4, d: 0.2 }
].forEach(({r, d}) => {
  const x = Math.sin(r) * d;
  const z = Math.cos(r) * d;
  // Outward curve
  hairSnakesParts.push(makePart("cylinder", [0.03, 0.035, 0.15, 8], { position: [x*1.2, 0.15, z*1.2], rotation: [Math.cos(r)*0.5, -r, -Math.sin(r)*0.5], useAssetColor: true }));
  hairSnakesParts.push(makePart("cylinder", [0.025, 0.03, 0.15, 8], { position: [x*1.5, 0.26, z*1.5], rotation: [Math.cos(r)*1.0, -r, -Math.sin(r)*1.0], useAssetColor: true }));
  hairSnakesParts.push(makePart("sphere", [0.05, 8, 8], { position: [x*1.75, 0.33, z*1.75], useAssetColor: true }));
  // Eyes
  hairSnakesParts.push(makePart("sphere", [0.012, 8, 8], { position: [x*1.75 + Math.sin(r-0.4)*0.04, 0.35, z*1.75 + Math.cos(r-0.4)*0.04], color: "#ef4444" }));
  hairSnakesParts.push(makePart("sphere", [0.012, 8, 8], { position: [x*1.75 + Math.sin(r+0.4)*0.04, 0.35, z*1.75 + Math.cos(r+0.4)*0.04], color: "#ef4444" }));
});
`;

content = content.replace('const hairBraidsParts = [', snakePartsCode + '\nconst hairBraidsParts = [');

const snakeAssetCode = `
  { id: "hair_snakes", name: "Snake Hair", category: "hair", slot: "hair", color: "#3E8E4E", renderMode: "part_kit", modelPath: "/avatar/hair/snakes.glb", parts: hairSnakesParts, styleTags: ["fantasy"], previewOnly: true, exportable: false },`;

content = content.replace('  { id: "hair_braids", name: "Braids",', snakeAssetCode + '\n  { id: "hair_braids", name: "Braids",');

fs.writeFileSync(file, content);
