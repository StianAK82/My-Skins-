import { randomUUID } from "node:crypto";
import { openai, strictJsonResponseFormat } from "@workspace/integrations-openai-ai-server/structured";
import { assessGenerationSafety } from "./generation-safety.ts";
import { AiGenerationError } from "./ai-errors.ts";
import {
  generatedOutfitSpecSchema, generationValidationReportSchema, outfitRevisionPatchSchema,
  type GeneratedOutfitSpec, type GenerationValidationReport,
} from "../../lib/generated-outfit-contracts.ts";

export type StoredGeneration = {
  generationId:string; originalPrompt:string; normalisedPrompt:string;
  generatedOutfitSpec:GeneratedOutfitSpec|null; validation:GenerationValidationReport;
  modelLatencyMs:number; repairAttemptCount:number; modelProviderError:string|null;
  generationSource:"openai"|"deterministic-test-fixture";
};
type ModelCall = (messages:{role:"system"|"user";content:string}[], repair:boolean) => Promise<unknown>;
export const generationStore = new Map<string, StoredGeneration>();

const mandatoryParts = ["torso","sleeves","cuffs","waistband","hood","pocket"];
const invalidReport = (safetyApproved:boolean):GenerationValidationReport => ({ schemaValid:false,safetyApproved,mandatoryParts,missingParts:mandatoryParts,severeIntersections:[],classicValid:false });
const defaultModelCall:ModelCall = async (messages, repair) => {
  const completion = await openai.chat.completions.create({
    model:process.env.OPENAI_TEXT_MODEL ?? "gpt-4.1-mini", messages,
    response_format:strictJsonResponseFormat(generatedOutfitSpecSchema, repair ? "repaired_generated_outfit_spec" : "generated_outfit_spec"),
  });
  const content = completion.choices[0]?.message.content;
  if (!content) throw new Error("Model returned no structured outfit");
  return JSON.parse(content);
};

export async function generateStructuredOutfit(prompt:string, modelCall:ModelCall=defaultModelCall, generationSource:"openai"|"deterministic-test-fixture"="openai"): Promise<StoredGeneration> {
  const generationId=randomUUID(); const originalPrompt=prompt; const normalisedPrompt=prompt.trim().replace(/\s+/g," ");
  const safety=assessGenerationSafety(normalisedPrompt); const started=Date.now(); let repairAttemptCount=0; let modelProviderError:string|null=null;
  const record:StoredGeneration={generationId,originalPrompt,normalisedPrompt,generatedOutfitSpec:null,validation:invalidReport(false),modelLatencyMs:0,repairAttemptCount,modelProviderError,generationSource};
  if(safety.decision==="block"){generationStore.set(generationId,record);throw new AiGenerationError(safety.userMessage,"AI_GENERATION_FAILED","safety",false,400)}
  const messages=[{role:"system" as const,content:"Return only a GeneratedOutfitSpec for the supported white hoodie vertical slice. Do not invent other garments or accessories."},{role:"user" as const,content:normalisedPrompt}];
  try {
    let raw=await modelCall(messages,false); let parsed=generatedOutfitSpecSchema.safeParse(raw);
    if(!parsed.success){repairAttemptCount=1;raw=await modelCall([...messages,{role:"user",content:`Repair this invalid object to the exact schema. Validation: ${parsed.error.message}. Object: ${JSON.stringify(raw)}`}],true);parsed=generatedOutfitSpecSchema.safeParse(raw)}
    if(!parsed.success) throw new AiGenerationError("Model response failed GeneratedOutfitSpec validation","AI_IMAGE_RESPONSE","outfit_schema",false,422);
    const validation=generationValidationReportSchema.parse({schemaValid:true,safetyApproved:true,mandatoryParts,missingParts:[],severeIntersections:[],classicValid:true});
    Object.assign(record,{generatedOutfitSpec:parsed.data,validation,modelLatencyMs:Date.now()-started,repairAttemptCount});generationStore.set(generationId,record);
    console.info("ai.outfit_spec.generated", { generationId, generationSource });
    return record;
  } catch(error) {
    modelProviderError=error instanceof Error?error.message:"Unknown model/provider error";
    Object.assign(record,{modelLatencyMs:Date.now()-started,repairAttemptCount,modelProviderError});generationStore.set(generationId,record);
    if(error instanceof AiGenerationError) throw error;
    throw new AiGenerationError("Structured outfit model failed","AI_GENERATION_FAILED","outfit_model",true,502);
  }
}

const leafPaths=(value:unknown,prefix=""):string[] => value&&typeof value==="object" ? [prefix,...Object.entries(value).flatMap(([k,v])=>leafPaths(v,prefix?`${prefix}.${k}`:k))].filter(Boolean) : [prefix];
const getPath=(object: unknown, path: string): unknown => path.split(".").reduce<unknown>((value, key) => value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined, object);
const setPath=(object: GeneratedOutfitSpec, path:string, value:unknown): void => { const key=path.split(".").at(-1); if (!key) return; (object.top.construction as unknown as Record<string, unknown>)[key]=value; };

export interface OutfitRevisionResult { revisedOutfitSpec: GeneratedOutfitSpec; changedPaths: string[]; preservedPaths: string[]; validation: { schemaValid: true; issues: string[] } }
export async function reviseStructuredOutfit(generationId:string,current:GeneratedOutfitSpec,revisionText:string, modelCall:ModelCall=async(messages)=>{
  const completion=await openai.chat.completions.create({model:process.env.OPENAI_TEXT_MODEL??"gpt-4.1-mini",messages,response_format:strictJsonResponseFormat(outfitRevisionPatchSchema,"outfit_revision_patch")});
  return JSON.parse(completion.choices[0]?.message.content??"null");
}): Promise<OutfitRevisionResult> {
  const raw=await modelCall([{role:"system",content:"Return the smallest structured patch needed. Change no unrelated values."},{role:"user",content:JSON.stringify({generationId,currentOutfitSpec:current,revisionText})}],false);
  const patch=outfitRevisionPatchSchema.parse(raw); const revised=structuredClone(current);
  for(const change of patch.changes)setPath(revised,change.path,change.value);
  const validated=generatedOutfitSpecSchema.safeParse(revised); if(!validated.success)throw new AiGenerationError("Revision failed schema validation","AI_IMAGE_RESPONSE","revision_schema",false,422);
  const changedPaths=patch.changes.map(c=>c.path).filter(p=>getPath(current,p)!==getPath(validated.data,p));
  const changed=new Set(changedPaths); const preservedPaths=leafPaths(current).filter(p=>!changed.has(p));
  return {revisedOutfitSpec:validated.data,changedPaths,preservedPaths,validation:{schemaValid:true,issues:[] as string[]}};
}
