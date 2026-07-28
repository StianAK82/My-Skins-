import { useMemo } from "react";
import type { HoodieGarmentSpec } from "@/lib/hoodie/spec";
import { compileHoodie } from "@/lib/hoodie/compiler";
export function SpecHoodie({spec,wireframe=false}:{spec:HoodieGarmentSpec;wireframe?:boolean}){const compiled=useMemo(()=>compileHoodie(spec),[spec]);return <group>{compiled.parts.map(part=><mesh key={part.name} name={part.name} geometry={part.geometry} position={part.position} castShadow receiveShadow><meshPhysicalMaterial color={part.name.includes("drawstring")?"#aab0b6":spec.color} roughness={part.name.includes("cuff")||part.name==="waistband"?.96:.78} sheen={.35} wireframe={wireframe}/></mesh>)}</group>}
