import type { AvatarCosmeticSlot } from "../editor/design-state.ts";
import { getAvatarAssetsForSlot, type AvatarAsset, type AssetImportance } from "../editor/assets.ts";
import type { NormalizedAiResponse } from "./normalize-ai-response";

type ResolvedSlot = {
  slot: AvatarCosmeticSlot;
  assetId: string;
  color?: string;
  role: AssetImportance;
  confidence: number;
  previewOnly: boolean;
};

type ResolveContext = {
  styleVibes: string[];
  fantasyArchetype: "dragon" | "demon" | "angel" | null;
  palette: string[];
  promptTerms: string[];
  prefersEffects: boolean;
};

function overlaps(a: string[] = [], b: string[] = []) {
  return a.reduce((count, item) => count + (b.includes(item) ? 1 : 0), 0);
}

function scoreAsset(asset: AvatarAsset, slotPlan: NormalizedAiResponse["result"]["avatarSlotPlan"][number], context: ResolveContext) {
  let score = 0;
  const hint = slotPlan.assetHint.toLowerCase();

  if (hint.includes(asset.id.toLowerCase()) || hint.includes(asset.name.toLowerCase().replace(/\s+/g, "_"))) score += 6;
  score += overlaps(asset.styleTags, context.styleVibes) * 3;
  if (context.fantasyArchetype) score += overlaps(asset.fantasyTags, [context.fantasyArchetype]) * 4;
  if (context.prefersEffects && asset.slot === "aura") score += 4;
  if (context.promptTerms.some((term) => hint.includes(term) || asset.name.toLowerCase().includes(term))) score += 2;

  if (slotPlan.role === "hero" && asset.importance === "hero") score += 3;
  if (slotPlan.role === "support" && asset.importance === "support") score += 2;
  if (slotPlan.role === "decorative" && asset.importance === "decorative") score += 2;

  if (asset.previewOnly) score += 1;
  return score;
}

export function resolveAvatarSlotAssets(result: NormalizedAiResponse["result"]): ResolvedSlot[] {
  const context: ResolveContext = {
    styleVibes: result.intent.styleVibes,
    fantasyArchetype: result.intent.fantasyArchetype,
    palette: result.colorPalette,
    promptTerms: ["wing", "horn", "halo", "flame", "angel", "dragon", "demon", "tech", "anime"],
    prefersEffects: result.intent.includesEffects,
  };

  const resolved: ResolvedSlot[] = [];

  for (const slotPlan of result.avatarSlotPlan) {
    const candidates = getAvatarAssetsForSlot(slotPlan.slot);
    const ranked = candidates
      .map((asset) => ({ asset, score: scoreAsset(asset, slotPlan, context) }))
      .sort((a, b) => b.score - a.score || a.asset.id.localeCompare(b.asset.id));
    const chosen = ranked[0]?.asset;
    if (!chosen) continue;

    resolved.push({
      slot: slotPlan.slot,
      assetId: chosen.id,
      color: slotPlan.color ?? context.palette[0],
      role: slotPlan.role,
      confidence: ranked[0]?.score ?? 0,
      previewOnly: chosen.previewOnly ?? true,
    });
  }

  return resolved;
}
