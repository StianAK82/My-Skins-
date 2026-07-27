import { GARMENT_REGISTRY } from "./garment-registry.ts";
import type { GarmentManifest } from "./garment-manifest.ts";
export type GeometryEvidence = { visible: ReadonlySet<string>; intersections: number; silhouetteId: string; projectionCoverage: number };
export type RenderValidation = { valid: boolean; errors: string[] };
export function validateRenderedOutfit(manifest: GarmentManifest, evidence: Partial<Record<"top"|"bottom"|"onePiece"|"footwear",GeometryEvidence>>): RenderValidation {
  const errors:string[]=[];
  for (const slot of ["top","bottom","onePiece"] as const) { const item=manifest[slot]; if(!item) continue; const profile=GARMENT_REGISTRY[item.category].validation; const proof=evidence[slot];
    if(!proof) { errors.push(`${slot}: missing rendered geometry evidence`); continue; }
    for(const required of profile.requiredEvidence) if(!proof.visible.has(required)) errors.push(`${item.category}: missing ${required}`);
    for(const forbidden of profile.forbiddenEvidence??[]) if(proof.visible.has(forbidden)) errors.push(`${item.category}: forbidden ${forbidden}`);
    if(proof.intersections>0) errors.push(`${item.category}: ${proof.intersections} body intersections`);
    if(proof.projectionCoverage<=0) errors.push(`${item.category}: empty projection`);
  }
  if(manifest.onePiece && evidence.onePiece?.visible.has("separate-leg-shells")) errors.push("one-piece conflict: separate legs rendered");
  return {valid:errors.length===0,errors};
}
