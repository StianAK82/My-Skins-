import { RoundedBox } from "@react-three/drei";
import type { ReactNode } from "react";
import { GARMENT_FITS } from "@/lib/editor/garment-fit";
import { GARMENT_MATERIALS } from "@/lib/editor/garment-materials";
import { getGarment, type ShellKey } from "@/lib/editor/garment-registry";
import { validateGarmentManifest, type GarmentItem, type GarmentManifest } from "@/lib/editor/garment-manifest";

export type OutfitDNA = { primary: string; secondary: string; accent: string };
type Props={ manifest:GarmentManifest; outfitDNA:OutfitDNA; underlyingAvatar?:ReactNode; previewMode?:"enhanced"|"roblox-classic" };
const Mat=({item,color}:{item:GarmentItem;color:string})=>{const m=GARMENT_MATERIALS[item.material];return <meshStandardMaterial color={color} roughness={m.roughness} metalness={m.metallic}/>};
function Shell({item,dna}:{item:GarmentItem;dna:OutfitDNA}) { const shell:ShellKey=getGarment(item.category).shell; const f=GARMENT_FITS[item.fit]; const mat=<Mat item={item} color={dna.primary}/>;
  if(shell==="dress") return <group><RoundedBox args={[1.05*f.width,1.05,0.58]} position={[0,1.55,0]} radius={.09}>{mat}</RoundedBox><mesh position={[0,.65,0]}><coneGeometry args={[.92*f.width,.42,1.35,20]}/>{mat}</mesh></group>;
  if(shell==="hoodie") return <group><RoundedBox args={[1.14*f.width,1.16*f.lengthScale,.68]} position={[0,1.48,0]} radius={.14}>{mat}</RoundedBox><mesh position={[0,2.13,-.03]}><torusGeometry args={[.38,.13,12,24,Math.PI]}/>{mat}</mesh>{item.category==="zip-hoodie"&&<mesh position={[0,1.5,.36]}><boxGeometry args={[.035,1,.02]}/><Mat item={item} color={dna.accent}/></mesh>}</group>;
  if(shell==="top"||shell==="jersey"||shell==="jacket") return <group><RoundedBox args={[(shell==="jacket"?1.12:1)*f.width,(shell==="jersey"?.94:1.03)*f.lengthScale,.58+f.bodyOffset]} position={[0,1.55,0]} radius={shell==="jacket"?.045:.09}>{mat}</RoundedBox>{shell==="jersey"&&<mesh position={[0,1.57,.31]}><planeGeometry args={[.32,.45]}/><Mat item={item} color={dna.accent}/></mesh>}</group>;
  if(shell==="shorts") return <group>{[-.3,.3].map(x=><RoundedBox key={x} args={[.46*f.width,.62,.54]} position={[x,.55,0]} radius={.07}>{mat}</RoundedBox>)}</group>;
  return <group>{[-.3,.3].map(x=><RoundedBox key={x} args={[(shell==="cargo"?.55:.46)*f.width,1.38,.55]} position={[x,.15,0]} radius={shell==="bottom"&&item.category==="joggers"?.15:.05}>{mat}</RoundedBox>)}{shell==="cargo"&&[-.62,.62].map(x=><RoundedBox key={x} args={[.25,.38,.62]} position={[x,.3,0]} radius={.03}><Mat item={item} color={dna.secondary}/></RoundedBox>)}</group>;
}
function Footwear({category,dna}:{category:string;dna:OutfitDNA}) { const boot=category==="boots"; return <group>{[-.3,.3].map(x=><RoundedBox key={x} args={[.5,boot?.5:.28,.78]} position={[x,-.65,.08]} radius={.1}><meshStandardMaterial color={dna.secondary} roughness={.45}/></RoundedBox>)}</group>; }
export function FullOutfitPreview({manifest,outfitDNA,underlyingAvatar,previewMode="enhanced"}:Props){const safe=validateGarmentManifest(manifest);if(previewMode==="roblox-classic")return <>{underlyingAvatar}</>;return <group renderOrder={10}>{underlyingAvatar}{safe.onePiece?<Shell item={safe.onePiece} dna={outfitDNA}/>:<>{safe.top&&<Shell item={safe.top} dna={outfitDNA}/>} {safe.bottom&&<Shell item={safe.bottom} dna={{...outfitDNA,primary:outfitDNA.secondary}}/>}</>}{safe.footwear&&<Footwear category={safe.footwear.category} dna={outfitDNA}/>}</group>}
