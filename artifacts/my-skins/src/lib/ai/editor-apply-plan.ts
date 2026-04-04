import type { NormalizedAiResponse } from "./normalize-ai-response";

export interface EditorApplyPlan {
  backgroundColor: string;
  modules: Array<NormalizedAiResponse["result"]["modules"][number]>;
  palette: string[];
}

export function buildEditorApplyPlan(ai: NormalizedAiResponse): EditorApplyPlan {
  return {
    backgroundColor: ai.result.colorPalette[0] ?? "#111111",
    modules: ai.result.modules,
    palette: ai.result.colorPalette,
  };
}
