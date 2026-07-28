import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { SpecHoodie } from "@/components/editor/garments/SpecHoodie";
import { analyseHoodieIntersections, compileHoodie } from "@/lib/hoodie/compiler";
import { getHoodieFixture, HOODIE_FIXTURE_NAMES, type HoodieFixtureName } from "@/lib/hoodie/spec";
import { WHITE_HOODIE_SHIRT_DATA_URL } from "@/lib/hoodie/classic-shirt";

const views=["front","back","angle","wireframe","intersections","classic-front","classic-back"] as const;
type View=typeof views[number];
export default function VisualTest(){const query=new URLSearchParams(location.search);const fixture=(HOODIE_FIXTURE_NAMES.includes(query.get("fixture") as HoodieFixtureName)?query.get("fixture"):"white-hoodie-regular") as HoodieFixtureName;const view=(views.includes(query.get("view") as View)?query.get("view"):"front") as View;const spec=getHoodieFixture(fixture);const compiled=compileHoodie(spec.top);const measurements=analyseHoodieIntersections(spec.top);const classic=view.startsWith("classic");const camera=view==="back"?[0,1.5,-5]:view==="angle"?[3.4,1.7,3.4]:[0,1.5,5];return <main className="min-h-screen bg-slate-950 p-5 text-slate-100" data-fixture={fixture} data-view={view}>
 <header className="mb-3"><h1 className="text-2xl font-bold">{fixture}</h1><p className="text-sm text-slate-400">Production compiler · {view}</p></header>
 <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
  <section className="h-[680px] overflow-hidden rounded-2xl border border-slate-700 bg-gradient-to-b from-slate-700 to-slate-900" aria-label="Deterministic hoodie render">
   {classic?<div className={`grid h-full place-items-center ${view==="classic-back"?"scale-x-[-1]":""}`}><img src={WHITE_HOODIE_SHIRT_DATA_URL} className="max-h-[620px] max-w-[90%] object-contain" alt="Exact Classic Shirt PNG byte source" data-classic-source={WHITE_HOODIE_SHIRT_DATA_URL}/></div>:<Canvas camera={{position:camera as [number,number,number],fov:34}} shadows gl={{preserveDrawingBuffer:true}}><color attach="background" args={["#263244"]}/><ambientLight intensity={1.8}/><directionalLight position={[3,5,4]} intensity={3} castShadow/><directionalLight position={[-3,2,2]} intensity={1.5}/><SpecHoodie spec={spec.top} wireframe={view==="wireframe"}/><ContactShadows position={[0,.35,0]} opacity={.45} scale={5}/><OrbitControls target={[0,1.45,0]} enableDamping={false}/></Canvas>}
  </section>
  <aside className="space-y-4 text-xs"><section className="rounded-xl border border-slate-700 bg-slate-900 p-4"><h2 className="mb-2 text-base font-semibold">Compiler values used</h2><dl className="grid grid-cols-2 gap-x-3 gap-y-1" data-testid="compiler-values">{Object.entries(compiled.valuesUsed).map(([k,v])=><div key={k} className="contents"><dt className="text-slate-400">{k}</dt><dd className="font-mono">{String(v)}</dd></div>)}</dl></section>
   {(view==="intersections"||view==="wireframe")&&<section className="rounded-xl border border-cyan-700 bg-slate-900 p-4" data-testid="intersection-report"><h2 className="mb-2 text-base font-semibold">Measured intersections</h2>{measurements.map(m=><article key={m.label} className="mb-2 border-b border-slate-700 pb-2"><strong>{m.label}</strong><div>distance {m.distance} · overlap {m.overlap.x} × {m.overlap.y} × {m.overlap.z} = {m.overlap.volume}</div><div className={m.severity==="severe-clipping"?"text-red-400":"text-emerald-400"}>{m.severity}</div></article>)}</section>}
   {classic&&<section className="rounded-xl border border-emerald-700 bg-slate-900 p-4"><h2 className="text-base font-semibold">Classic evidence</h2><p>585 × 559 · RGBA alpha · Shirt only</p><p className="break-all font-mono">sha256 d794a750e324f9cd0b247aa1d72933dbc677df6de8c9ccbf2b0ffe7e80e631dd</p><a download="white-hoodie-shirt.png" href={WHITE_HOODIE_SHIRT_DATA_URL} data-testid="classic-download">Download exact source</a></section>}
  </aside>
 </div></main>}
