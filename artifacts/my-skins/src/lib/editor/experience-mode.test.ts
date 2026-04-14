import test from "node:test";
import assert from "node:assert/strict";
import { getFriendlyEmptyState, getSimpleFlowStep, getVisibleSimplePanels, shouldShowAdvancedControls } from "./experience-mode.ts";

test("simple flow step progresses in order", () => {
  assert.equal(getSimpleFlowStep({ creationPath: null, template: null, style: null, hasDraft: false }), 1);
  assert.equal(getSimpleFlowStep({ creationPath: "ai", template: null, style: null, hasDraft: false }), 2);
  assert.equal(getSimpleFlowStep({ creationPath: "ai", template: "shirt", style: null, hasDraft: false }), 3);
  assert.equal(getSimpleFlowStep({ creationPath: "ai", template: "shirt", style: "Cute", hasDraft: false }), 4);
});

test("advanced controls are always visible in studio mode", () => {
  assert.equal(shouldShowAdvancedControls("studio", false), true);
  assert.equal(shouldShowAdvancedControls("simple", false), false);
  assert.equal(shouldShowAdvancedControls("simple", true), true);
});

test("simple visible panels respect step and surface", () => {
  const preCreate = getVisibleSimplePanels({ step: 2, surface: "clothes", advancedOpen: false });
  assert.equal(preCreate.showBuilder, false);
  assert.equal(preCreate.showAi, false);

  const createAvatar = getVisibleSimplePanels({ step: 4, surface: "avatar", advancedOpen: false });
  assert.equal(createAvatar.showAvatarSlots, true);
  assert.equal(createAvatar.showLayerStack, false);
});

test("friendly empty state gives next action", () => {
  assert.match(getFriendlyEmptyState({
    hasLayers: false,
    selectedLayerId: null,
    hasAiCards: false,
    isRobloxConnected: false,
  }), /no design yet/i);
});
