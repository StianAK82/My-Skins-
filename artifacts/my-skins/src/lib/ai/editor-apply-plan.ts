import type { NormalizedAiResponse } from "./normalize-ai-response";

export interface EditorApplyPlan {
  backgroundColor: string;
  modules: Array<NormalizedAiResponse["result"]["modules"][number]>;
  palette: string[];
  exportable: string[];
  previewOnly: string[];
}

export function buildEditorApplyPlan(ai: NormalizedAiResponse): EditorApplyPlan {
  return {
    backgroundColor: ai.result.colorPalette[0] ?? "#111111",
    modules: ai.result.modules,
    palette: ai.result.colorPalette,
    exportable: [
      ...(ai.result.exportablePlan.classicShirt ? ["classic_shirt"] : []),
      ...(ai.result.exportablePlan.classicPants ? ["classic_pants"] : []),
    ],
    previewOnly: ai.result.previewOnlyPlan.cosmetics.map((entry) => `${entry.role}:${entry.slot}:${entry.label}`),
  };
}
