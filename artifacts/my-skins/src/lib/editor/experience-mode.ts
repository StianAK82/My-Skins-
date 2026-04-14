export type EditorExperienceMode = "simple" | "studio";
export type SimpleCreationPath = "ai" | "build" | "remix" | null;
export type SimpleFlowStep = 1 | 2 | 3 | 4;
export type EditorSurface = "clothes" | "avatar";

export function getSimpleFlowStep(input: {
  creationPath: SimpleCreationPath;
  template: "shirt" | "pants" | null;
  style: string | null;
  hasDraft: boolean;
}): SimpleFlowStep {
  if (!input.creationPath) return 1;
  if (!input.template) return 2;
  if (!input.style) return 3;
  return input.hasDraft ? 4 : 4;
}

export function shouldShowAdvancedControls(mode: EditorExperienceMode, advancedOpen: boolean) {
  return mode === "studio" || advancedOpen;
}

export function getVisibleSimplePanels(input: {
  step: SimpleFlowStep;
  surface: EditorSurface;
  advancedOpen: boolean;
}) {
  const showBuilder = input.step >= 4;
  const showAi = input.step >= 3;
  return {
    showBuilder,
    showAi,
    showLayerStack: input.advancedOpen || (showBuilder && input.surface === "clothes"),
    showAvatarSlots: input.advancedOpen || (showBuilder && input.surface === "avatar"),
  };
}

export function getFriendlyEmptyState(input: {
  hasLayers: boolean;
  selectedLayerId: string | null;
  hasAiCards: boolean;
  isRobloxConnected: boolean;
}) {
  if (!input.hasLayers) {
    return "You have no design yet. Tap a style card or add one big sticker to start.";
  }
  if (!input.selectedLayerId) {
    return "Pick one layer to keep editing. Tip: choose your main logo first.";
  }
  if (!input.hasAiCards) {
    return "Need ideas? Tap Generate to see 3 guided AI cards.";
  }
  if (!input.isRobloxConnected) {
    return "You can keep creating. Connect Roblox when you are ready to upload.";
  }
  return "";
}
