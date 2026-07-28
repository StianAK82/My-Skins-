export type GeneratedOutfitSpecResponse<T> = {
  generationId: string;
  generationSource: "openai" | "deterministic-test-fixture";
  outfitSpec: T;
  exports: Array<{ garment: "Shirt Classic"; width: 585; height: 559 }>;
};

export async function requestOutfitSpec<T>(prompt: string, signal?: AbortSignal): Promise<GeneratedOutfitSpecResponse<T>> {
  const response = await fetch("/api/ai/outfit-spec", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt }),
    signal,
  });
  const payload = await response.json() as GeneratedOutfitSpecResponse<T> & { error?: string };
  if (!response.ok) throw Object.assign(new Error(payload.error ?? "Outfit generation failed"), { status: response.status });
  if (!payload.generationId || !payload.outfitSpec || payload.generationSource !== "openai") throw new Error("Invalid production outfit response");
  return payload;
import { z } from "zod";
import type { HoodieGarmentSpec } from "@/lib/hoodie/spec";

export type GenerationState = "idle" | "understanding" | "generating" | "validating" | "compiling" | "ready" | "failed";
export type OutfitSpecApiError = Error & { code: string; stage: string; retryable: boolean; status?: number; requestId?: string; generationId?: string };

const constructionSchema = z.object({
  fit:z.enum(["regular","oversized","cropped"]), torsoWidth:z.number(), torsoLength:z.number(), torsoDepth:z.number(), shoulderDrop:z.number(),
  sleeveLength:z.number(), sleeveFullness:z.number(), cuffHeight:z.number(), waistbandHeight:z.number(), hoodHeight:z.number(), hoodDepth:z.number(),
  hoodOpeningWidth:z.number(), hoodOpeningHeight:z.number(), pocketType:z.enum(["kangaroo","two-front","none"]), pocketWidth:z.number(), pocketHeight:z.number(),
  drawstringEnabled:z.boolean(), drawstringLength:z.number(),
}).strict();
const outfitSpecSchema = z.object({
  requestLanguage:z.enum(["en","no"]), originalPrompt:z.string(), normalisedPrompt:z.string(), outfitName:z.string(), overallStyle:z.string(), palette:z.array(z.string()),
  top:z.object({id:z.string(),category:z.literal("hoodie"),slot:z.literal("top"),color:z.string(),material:z.literal("cotton-fleece"),construction:constructionSchema}).strict(),
  bottom:z.null(), footwear:z.object({category:z.literal("none"),previewOnly:z.literal(true)}).strict(), graphics:z.array(z.unknown()),
  classicExportPlan:z.object({shirt:z.literal(true),pants:z.literal(false),width:z.literal(585),height:z.literal(559),exportType:z.literal("roblox-classic"),previewRepresentation:z.literal("procedural-hoodie"),hasReal3DExport:z.literal(false)}).strict(),
  safetyDecision:z.enum(["allow","transform"]),modelConfidence:z.number(),generationSeed:z.string(),
}).strict();
const responseSchema = z.object({
  generationId:z.string().uuid(), outfitSpec:outfitSpecSchema,
  validation:z.object({schemaValid:z.boolean(),safetyApproved:z.boolean(),mandatoryParts:z.array(z.string()),missingParts:z.array(z.string()),severeIntersections:z.array(z.string()),classicValid:z.boolean()}).strict(),
  classicExports:z.array(z.object({type:z.enum(["shirt","pants"]),fileName:z.string(),mimeType:z.literal("image/png"),width:z.literal(585),height:z.literal(559),url:z.string()}).strict()).min(1),
  diagnostics:z.object({repairAttempts:z.number().int().nonnegative(),modelLatencyMs:z.number().nonnegative().optional()}).strict().optional(),
}).strict();
export type GenerateOutfitSpecResponse = z.infer<typeof responseSchema> & { outfitSpec: z.infer<typeof outfitSpecSchema> & { top: HoodieGarmentSpec } };

export function outfitSpecUrl(basePath:string){const root=basePath.replace(/\/$/,"").replace(/\/api$/,"");return `${root}/api/ai/outfit-spec`;}
export function parseGenerateOutfitSpecResponse(value:unknown):GenerateOutfitSpecResponse {
  const parsed=responseSchema.safeParse(value);
  if(!parsed.success){const error=new Error("The generation server returned an incompatible response.") as OutfitSpecApiError;error.code="CLIENT_RESPONSE_INVALID";error.stage="client_response_parsing";error.retryable=true;Object.assign(error,{issues:parsed.error.issues});throw error;}
  return parsed.data as GenerateOutfitSpecResponse;
}
export async function requestOutfitSpec(prompt:string,signal:AbortSignal,fetcher:typeof fetch=fetch){
  const base=(import.meta as ImportMeta & {env?:{BASE_URL?:string}}).env?.BASE_URL??"/";
  const response=await fetcher(outfitSpecUrl(base),{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt}),signal});
  const text=await response.text();let body:unknown;
  try{body=text?JSON.parse(text):{};}catch{const error=new Error("The generation server returned invalid JSON.") as OutfitSpecApiError;Object.assign(error,{code:"CLIENT_RESPONSE_INVALID",stage:"client_response_parsing",retryable:true,status:response.status});throw error;}
  if(!response.ok){const data=body as Record<string,unknown>;const error=new Error(typeof data.error==="string"?data.error:"Outfit generation failed.") as OutfitSpecApiError;Object.assign(error,{code:typeof data.code==="string"?data.code:"MODEL_REQUEST_FAILED",stage:typeof data.stage==="string"?data.stage:"unknown",retryable:data.retryable===true,status:response.status,requestId:data.requestId,generationId:data.generationId});throw error;}
  return parseGenerateOutfitSpecResponse(body);
}
