import * as THREE from "three";

export type OutfitDNA = {
  primaryColor?: string;
  shadowColor?: string;
  seamColor?: string;
  materialRoughness?: number;
  fabricSoftness?: number;
  foldIntensity?: number;
  lightingDirection?: [number, number, number];
};

export const DEFAULT_HOODIE_DNA: Required<OutfitDNA> = {
  primaryColor: "#f4f3ef",
  shadowColor: "#b9bab6",
  seamColor: "#c8c8c3",
  materialRoughness: 0.82,
  fabricSoftness: 0.42,
  foldIntensity: 0.28,
  lightingDirection: [-3, 6, 5],
};

export function resolveOutfitDNA(dna?: OutfitDNA): Required<OutfitDNA> {
  return { ...DEFAULT_HOODIE_DNA, ...dna };
}

export function createGarmentMaterials(dna?: OutfitDNA) {
  const value = resolveOutfitDNA(dna);
  const common = { roughness: THREE.MathUtils.clamp(value.materialRoughness, .72, .88), metalness: 0 };
  return {
    fabric: new THREE.MeshStandardMaterial({ color: value.primaryColor, ...common }),
    shadow: new THREE.MeshStandardMaterial({ color: value.shadowColor, ...common }),
    seam: new THREE.MeshStandardMaterial({ color: value.seamColor, roughness: .88, metalness: 0 }),
    opening: new THREE.MeshStandardMaterial({ color: "#777873", roughness: 1, side: THREE.DoubleSide }),
  };
}
