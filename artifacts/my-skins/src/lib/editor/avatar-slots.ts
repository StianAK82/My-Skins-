import type { AvatarCosmeticSlot, AvatarScalePreset, AvatarState } from "./design-state.ts";

export type AvatarAttachmentPoint = "headTop" | "headFront" | "neck" | "leftShoulder" | "rightShoulder" | "back" | "waist" | "leftFoot" | "rightFoot";

const SLOT_TO_ATTACHMENT: Record<AvatarCosmeticSlot, AvatarAttachmentPoint> = {
  face: "headFront",
  hair: "headTop",
  hat: "headTop",
  neck: "neck",
  leftShoulder: "leftShoulder",
  rightShoulder: "rightShoulder",
  back: "back",
  leftFootwear: "leftFoot",
  rightFootwear: "rightFoot",
  aura: "waist",
};

const BASE_POINTS: Record<AvatarAttachmentPoint, [number, number, number]> = {
  headTop: [0, 2.3, 0],
  headFront: [0, 2.02, 0.34],
  neck: [0, 1.72, 0.2],
  leftShoulder: [-0.6, 1.58, 0],
  rightShoulder: [0.6, 1.58, 0],
  back: [0, 1.35, -0.36],
  waist: [0, 0.88, 0],
  leftFoot: [-0.2, -0.22, 0.08],
  rightFoot: [0.2, -0.22, 0.08],
};

function presetScale(preset: AvatarScalePreset) {
  if (preset === "slender") return { x: 0.93, y: 1.04, z: 0.9 };
  if (preset === "stocky") return { x: 1.09, y: 0.98, z: 1.08 };
  return { x: 1, y: 1, z: 1 };
}

export function getAttachmentPoint(slot: AvatarCosmeticSlot, avatar: AvatarState): [number, number, number] {
  const base = BASE_POINTS[SLOT_TO_ATTACHMENT[slot]];
  const scale = presetScale(avatar.scalePreset);
  const [x, y, z] = base;
  return [x * scale.x * avatar.bodyScale.width, y * scale.y * avatar.bodyScale.height, z * scale.z];
}

export function resolveSlotPosition(slot: AvatarCosmeticSlot, avatar: AvatarState): [number, number, number] {
  const anchor = getAttachmentPoint(slot, avatar);
  const item = avatar.slots[slot];
  if (!item) return anchor;
  return [anchor[0] + item.offset.x, anchor[1] + item.offset.y, anchor[2] + item.offset.z];
}
