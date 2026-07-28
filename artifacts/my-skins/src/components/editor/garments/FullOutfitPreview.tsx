import { RoundedBox } from "@react-three/drei";
import { useMemo, type ReactNode } from "react";
import * as THREE from "three";
import { GARMENT_FITS } from "@/lib/editor/garment-fit";
import { GARMENT_MATERIALS } from "@/lib/editor/garment-materials";
import { getGarment, type ShellKey } from "@/lib/editor/garment-registry";
import { validateGarmentManifest, type GarmentItem, type GarmentManifest } from "@/lib/editor/garment-manifest";
import { createHood, createHoodieTorso, createPocket, createSleeve } from "@/lib/editor/ai-geometry/hoodie-geometry";

export type OutfitDNA = { primary: string; secondary: string; accent: string };
type Props={ manifest:GarmentManifest; outfitDNA:OutfitDNA; underlyingAvatar?:ReactNode; previewMode?:"enhanced"|"roblox-classic" };
const Mat=({item,color}:{item:GarmentItem;color:string})=>{const m=GARMENT_MATERIALS[item.material];return <meshStandardMaterial color={color} roughness={m.roughness} metalness={m.metallic}/>};
function Shell({item,dna}:{item:GarmentItem;dna:OutfitDNA}) { const shell:ShellKey=getGarment(item.category).shell; const f=GARMENT_FITS[item.fit]; const mat=<Mat item={item} color={dna.primary}/>;
  if(shell==="dress") return <group><RoundedBox args={[1.05*f.width,1.05,0.58]} position={[0,1.55,0]} radius={.09}>{mat}</RoundedBox><mesh position={[0,.65,0]}><coneGeometry args={[.92*f.width,.42,1.35,20]}/>{mat}</mesh></group>;
  if(shell==="hoodie") return <ProceduralHoodie item={item} dna={dna} width={f.width} sleeveWidth={f.sleeveWidth}/>;
  if(shell==="top"||shell==="jersey"||shell==="jacket") return <group><RoundedBox args={[(shell==="jacket"?1.12:1)*f.width,(shell==="jersey"?.94:1.03)*f.lengthScale,.58+f.bodyOffset]} position={[0,1.55,0]} radius={shell==="jacket"?.045:.09}>{mat}</RoundedBox>{[-1,1].map(side=><RoundedBox key={side} args={[.31*f.sleeveWidth,shell==="jacket"?.9:.48,.45]} position={[side*.67,shell==="jacket"?1.48:1.79,0]} radius={.1}>{mat}</RoundedBox>)}{shell==="jersey"&&<mesh position={[0,1.57,.31]}><planeGeometry args={[.32,.45]}/><Mat item={item} color={dna.accent}/></mesh>}</group>;
  if(shell==="shorts") return <group>{[-.3,.3].map(x=><RoundedBox key={x} args={[.46*f.width,.62,.54]} position={[x,.55,0]} radius={.07}>{mat}</RoundedBox>)}</group>;
  return <group>{[-.3,.3].map(x=><RoundedBox key={x} args={[(shell==="cargo"?.55:.46)*f.width,1.38,.55]} position={[x,.15,0]} radius={shell==="bottom"&&item.category==="joggers"?.15:.05}>{mat}</RoundedBox>)}{shell==="cargo"&&[-.62,.62].map(x=><RoundedBox key={x} args={[.25,.38,.62]} position={[x,.3,0]} radius={.03}><Mat item={item} color={dna.secondary}/></RoundedBox>)}</group>;
}

function ProceduralHoodie({item,dna,width,sleeveWidth}:{item:GarmentItem;dna:OutfitDNA;width:number;sleeveWidth:number}) {
  const geometry = useMemo(() => ({ torso:createHoodieTorso(width), left:createSleeve(-1,sleeveWidth), right:createSleeve(1,sleeveWidth), hood:createHood(), pocket:createPocket() }), [width,sleeveWidth]);
  const fabric = <meshPhysicalMaterial color={dna.primary} roughness={.82} sheen={.28} sheenColor="#d8dce2" clearcoat={.03}/>;
  const rib = <meshStandardMaterial color={dna.primary} roughness={.94}/>;
  const cord = new THREE.MeshStandardMaterial({color:dna.secondary,roughness:.65});
  const cordCurve = (x:number) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(x,1.91,.385),new THREE.Vector3(x*.95,1.72,.41),new THREE.Vector3(x*1.08,1.55,.405)]),12,.012,8,false);
  return <group>
    <mesh geometry={geometry.torso} castShadow>{fabric}</mesh>
    <mesh geometry={geometry.left} castShadow>{fabric}</mesh><mesh geometry={geometry.right} castShadow>{fabric}</mesh>
    <mesh geometry={geometry.hood} castShadow>{fabric}</mesh>
    <mesh geometry={geometry.pocket} castShadow>{fabric}</mesh>
    {[-1,1].map(side=><mesh key={`cuff-${side}`} position={[side*.72,1.025,.015]}><cylinderGeometry args={[.19*sleeveWidth,.205*sleeveWidth,.16,20]}/>{rib}</mesh>)}
    <mesh position={[0,.94,0]}><cylinderGeometry args={[.34,.54*width,.14,28]}/>{rib}</mesh>
    {[-.13,.13].map(x=><group key={`cord-${x}`}><mesh geometry={cordCurve(x)} material={cord}/><mesh position={[x*1.08,1.53,.405]}><cylinderGeometry args={[.023,.023,.055,10]}/><meshStandardMaterial color={dna.secondary} roughness={.55}/></mesh></group>)}
    <mesh position={[0,1.47,.397]}><torusGeometry args={[.35,.008,6,30,Math.PI]}/><meshStandardMaterial color="#b8bcc2" roughness={.8}/></mesh>
    {item.category==="zip-hoodie"&&<mesh position={[0,1.5,.4]}><boxGeometry args={[.035,1.12,.025]}/><Mat item={item} color={dna.accent}/></mesh>}
  </group>;
}
function Footwear({category,dna}:{category:string;dna:OutfitDNA}) { const boot=category==="boots"; return <group>{[-.3,.3].map(x=><RoundedBox key={x} args={[.5,boot?.5:.28,.78]} position={[x,-.65,.08]} radius={.1}><meshStandardMaterial color={dna.secondary} roughness={.45}/></RoundedBox>)}</group>; }
export function FullOutfitPreview({manifest,outfitDNA,underlyingAvatar,previewMode="enhanced"}:Props){const safe=validateGarmentManifest(manifest);if(previewMode==="roblox-classic")return <>{underlyingAvatar}</>;return <group renderOrder={10}>{underlyingAvatar}{safe.onePiece?<Shell item={safe.onePiece} dna={outfitDNA}/>:<>{safe.top&&<Shell item={safe.top} dna={outfitDNA}/>} {safe.bottom&&<Shell item={safe.bottom} dna={{...outfitDNA,primary:outfitDNA.secondary}}/>}</>}{safe.footwear&&<Footwear category={safe.footwear.category} dna={outfitDNA}/>}</group>}
