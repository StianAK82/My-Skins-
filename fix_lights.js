import fs from 'fs';

const filePath = 'artifacts/my-skins/src/components/editor/AvatarPreview.tsx';
let code = fs.readFileSync(filePath, 'utf8');

code = code.replace(
  /<ambientLight intensity=\{1\.2\} color="#ffffff" \/>/g,
  '<ambientLight intensity={0.8} color="#ffffff" />'
);
code = code.replace(
  /<hemisphereLight intensity=\{0\.6\} color="#ffffff" groundColor="#64748b" \/>/g,
  '<hemisphereLight intensity={0.6} color="#ffffff" groundColor="#334155" />'
);
code = code.replace(
  /<directionalLight position=\{\[0, 8, 4\]\} intensity=\{2\.5\}/g,
  '<directionalLight position={[0, 8, 4]} intensity={2.0}'
);
code = code.replace(
  /<directionalLight position=\{\[-6, 4, -2\]\} intensity=\{2\.0\}/g,
  '<directionalLight position={[-6, 4, -2]} intensity={1.5}'
);
code = code.replace(
  /<directionalLight position=\{\[6, 4, -2\]\} intensity=\{2\.0\}/g,
  '<directionalLight position={[6, 4, -2]} intensity={1.5}'
);
code = code.replace(
  /<spotLight position=\{\[0, 6, -6\]\} intensity=\{3\.5\}/g,
  '<spotLight position={[0, 6, -6]} intensity={2.5}'
);

fs.writeFileSync(filePath, code);
