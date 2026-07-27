import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { createGarmentMaterials, type OutfitDNA } from "@/lib/editor/garment-preview-material";

function Ribbing({ position, args }: { position: [number, number, number]; args: [number, number, number] }) {
  return <group position={position}>{Array.from({ length: 9 }, (_, index) => <mesh key={index} position={[(index - 4) * args[0] / 9, 0, 0]}><boxGeometry args={[.018, args[1], args[2]]} /><meshStandardMaterial color="#b9bab5" roughness={.9} /></mesh>)}</group>;
}

export function HoodiePreviewShell({ dna }: { dna?: OutfitDNA }) {
  const materials = useMemo(() => createGarmentMaterials(dna), [dna]);
  useEffect(() => () => Object.values(materials).forEach((material) => material.dispose()), [materials]);
  return <group name="hoodie-preview-shell">
    <mesh position={[0, 1.64, .01]} castShadow material={materials.fabric}><boxGeometry args={[1.3, 1.38, .69, 4, 5, 2]} /></mesh>
    {/* hood outer volume, dark inner opening, and rear centre seam */}
    <mesh position={[0, 2.42, -.16]} rotation-x={-.08} castShadow material={materials.fabric}><torusGeometry args={[.49, .2, 16, 32, Math.PI * 1.48]} /></mesh>
    <mesh position={[0, 2.43, .055]} scale={[1, 1.1, 1]} material={materials.opening}><circleGeometry args={[.32, 24]} /></mesh>
    <mesh position={[0, 2.55, -.372]} material={materials.seam}><boxGeometry args={[.025, .62, .018]} /></mesh>
    {/* continuous shoulder-to-wrist tapered sleeves */}
    <mesh position={[-.91, 1.56, 0]} rotation-z={-.035} castShadow material={materials.fabric}><cylinderGeometry args={[.275, .35, 1.74, 20]} /></mesh>
    <mesh position={[.91, 1.56, 0]} rotation-z={.035} castShadow material={materials.fabric}><cylinderGeometry args={[.275, .35, 1.74, 20]} /></mesh>
    {/* thick cuffs */}
    <mesh position={[-.94, .72, 0]} material={materials.seam}><cylinderGeometry args={[.305, .305, .25, 20]} /></mesh>
    <mesh position={[.94, .72, 0]} material={materials.seam}><cylinderGeometry args={[.305, .305, .25, 20]} /></mesh>
    {/* raised pocket and entry welts */}
    <mesh position={[0, 1.3, .376]} castShadow material={materials.fabric}><boxGeometry args={[.78, .43, .085]} /></mesh>
    <mesh position={[-.28, 1.48, .425]} rotation-z={-.35} material={materials.seam}><boxGeometry args={[.3, .025, .025]} /></mesh>
    <mesh position={[.28, 1.48, .425]} rotation-z={.35} material={materials.seam}><boxGeometry args={[.3, .025, .025]} /></mesh>
    {/* waistband and fine ribs */}
    <mesh position={[0, .99, .01]} material={materials.seam}><boxGeometry args={[1.35, .25, .72]} /></mesh>
    <Ribbing position={[0, .99, .382]} args={[1.2, .22, .018]} />
    {/* symmetrical drawstrings and cord ends */}
    {[-.17, .17].map((x) => <group key={x}><mesh position={[x, 2.05, .405]} material={materials.seam}><cylinderGeometry args={[.018, .018, .62, 10]} /></mesh><mesh position={[x, 1.72, .405]} material={materials.shadow}><cylinderGeometry args={[.028, .022, .1, 10]} /></mesh></group>)}
  </group>;
}
