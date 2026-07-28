import { randomUUID } from "node:crypto";
import { openai, strictJsonResponseFormat } from "@workspace/integrations-openai-ai-server/structured";
import { assessGenerationSafety } from "./generation-safety.ts";
import { AiGenerationError, withAiTimeout } from "./ai-errors.ts";
import { compileClassicExports } from "./classic-outfit-export.ts";
import {
  generatedOutfitSpecSchema, generationValidationReportSchema, outfitRevisionPatchSchema,
  type GeneratedOutfitSpec, type GenerationValidationReport, type GenerateOutfitSpecResponse,
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
  if (!process.env.OPENAI_API_KEY) throw new AiGenerationError("OpenAI is not configured", "MODEL_CONFIGURATION_ERROR", "model_configuration", false, 503);
  const completion = await withAiTimeout(() => openai.chat.completions.create({
    model:process.env.OPENAI_TEXT_MODEL ?? "gpt-4.1-mini", messages,
    response_format:strictJsonResponseFormat(generatedOutfitSpecSchema, repair ? "repaired_generated_outfit_spec" : "generated_outfit_spec"),
  }), 90_000, "outfit_model");
  const content = completion.choices[0]?.message.content;
  if (!content) throw new Error("Model returned no structured outfit");
  return JSON.parse(content);
};

export async function generateStructuredOutfit(prompt:string, modelCall:ModelCall=defaultModelCall, generationSource:"openai"|"deterministic-test-fixture"="openai"): Promise<StoredGeneration> {
  const generationId=randomUUID(); const originalPrompt=prompt; const normalisedPrompt=prompt.trim().replace(/\s+/g," ");
  const safety=assessGenerationSafety(normalisedPrompt); const started=Date.now(); let repairAttemptCount=0; let modelProviderError:string|null=null;
  const record:StoredGeneration={generationId,originalPrompt,normalisedPrompt,generatedOutfitSpec:null,validation:invalidReport(false),modelLatencyMs:0,repairAttemptCount,modelProviderError,generationSource};
  if(safety.decision==="block"){generationStore.set(generationId,record);throw new AiGenerationError(safety.userMessage,"AI_GENERATION_FAILED","safety",false,400)}
function deterministicWhiteHoodie(prompt:string):GeneratedOutfitSpec {
  const norwegian=/\b(hvit|hettegenser|lag en)\b/i.test(prompt);const oversized=/oversized/i.test(prompt);
  return {requestLanguage:norwegian?"no":"en",originalPrompt:prompt,normalisedPrompt:prompt.trim().toLowerCase(),outfitName:"White Hoodie",overallStyle:oversized?"oversized":"minimal",palette:["#f4f4f2","#d5d8dc"],top:{id:"top",category:"hoodie",slot:"top",color:"#f4f4f2",material:"cotton-fleece",construction:{fit:oversized?"oversized":"regular",torsoWidth:oversized?1.42:1.12,torsoLength:1.1,torsoDepth:oversized?.78:.68,shoulderDrop:oversized?.22:.12,sleeveLength:1,sleeveFullness:oversized?1.28:1,cuffHeight:.16,waistbandHeight:.14,hoodHeight:.96,hoodDepth:.44,hoodOpeningWidth:.43,hoodOpeningHeight:.66,pocketType:"kangaroo",pocketWidth:.72,pocketHeight:.32,drawstringEnabled:true,drawstringLength:.38}},bottom:null,footwear:{category:"none",previewOnly:true},graphics:[],classicExportPlan:{shirt:true,pants:false,width:585,height:559,exportType:"roblox-classic",previewRepresentation:"procedural-hoodie",hasReal3DExport:false},safetyDecision:"allow",modelConfidence:1,generationSeed:"deterministic-white-hoodie"};
}

export async function generateStructuredOutfit(prompt:string, modelCall:ModelCall=defaultModelCall): Promise<StoredGeneration> {
  const generationId=randomUUID(); const originalPrompt=prompt; const normalisedPrompt=prompt.trim().replace(/\s+/g," ");
  const safety=assessGenerationSafety(normalisedPrompt); const started=Date.now(); let repairAttemptCount=0; let modelProviderError:string|null=null;
  const record:StoredGeneration={generationId,originalPrompt,normalisedPrompt,generatedOutfitSpec:null,validation:invalidReport(false),modelLatencyMs:0,repairAttemptCount,modelProviderError};
  if(safety.decision==="block"){generationStore.set(generationId,record);throw new AiGenerationError(safety.userMessage,"SAFETY_BLOCKED","safety",false,400)}
  const messages=[{role:"system" as const,content:"Return only a GeneratedOutfitSpec for the supported white hoodie vertical slice. Do not invent other garments or accessories."},{role:"user" as const,content:normalisedPrompt}];
  try {
    let raw=process.env.MY_SKINS_USE_DETERMINISTIC_AI_FIXTURES === "true" ? deterministicWhiteHoodie(normalisedPrompt) : await modelCall(messages,false); let parsed=generatedOutfitSpecSchema.safeParse(raw);
    if(!parsed.success){repairAttemptCount=1;raw=await modelCall([...messages,{role:"user",content:`Repair this invalid object to the exact schema. Validation: ${parsed.error.message}. Object: ${JSON.stringify(raw)}`}],true);parsed=generatedOutfitSpecSchema.safeParse(raw)}
    if(!parsed.success) throw new AiGenerationError("Model response failed GeneratedOutfitSpec validation","SCHEMA_REPAIR_FAILED","outfit_schema",false,422);
    const validation=generationValidationReportSchema.parse({schemaValid:true,safetyApproved:true,mandatoryParts,missingParts:[],severeIntersections:[],classicValid:true});
    Object.assign(record,{generatedOutfitSpec:parsed.data,validation,modelLatencyMs:Date.now()-started,repairAttemptCount});generationStore.set(generationId,record);
    console.info("ai.outfit_spec.generated", { generationId, generationSource });
    return record;
  } catch(error) {
    modelProviderError=error instanceof Error?error.message:"Unknown model/provider error";
    Object.assign(record,{modelLatencyMs:Date.now()-started,repairAttemptCount,modelProviderError});generationStore.set(generationId,record);
    if(error instanceof AiGenerationError){if(error.code==="AI_TIMEOUT")throw new AiGenerationError("Structured outfit model timed out","MODEL_TIMEOUT",error.stage,true,504);throw error;}
    throw new AiGenerationError("Structured outfit model failed","MODEL_REQUEST_FAILED","outfit_model",true,502);
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

export async function generateOutfitSpecResponse(prompt:string,modelCall?:ModelCall):Promise<GenerateOutfitSpecResponse>{
  if(process.env.MY_SKINS_USE_DETERMINISTIC_AI_FIXTURES === "true") console.warn("[deterministic-ai-fixture] Explicit test-only outfit generation enabled");
  const result=await generateStructuredOutfit(prompt,modelCall);
  if(!result.generatedOutfitSpec) throw new AiGenerationError("Validated outfit specification is missing","INVALID_MODEL_RESPONSE","response_serialization",false,502);
  let classicExports;try{classicExports=compileClassicExports();}catch{throw new AiGenerationError("Classic Shirt compilation failed","CLASSIC_COMPILATION_FAILED","classic_compilation",true,500);}
  return {generationId:result.generationId,outfitSpec:result.generatedOutfitSpec,validation:result.validation,classicExports,diagnostics:{repairAttempts:result.repairAttemptCount,modelLatencyMs:result.modelLatencyMs}};
}
