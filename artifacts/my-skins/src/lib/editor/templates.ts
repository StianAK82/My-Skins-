import type { TemplateType } from "./design-state.ts";

export type ZoneRect = { key: string; label: string; left: number; top: number; width: number; height: number };
export const TEMPLATE_SIZE = { width: 585, height: 559 };

export const TEMPLATE_ZONES: Record<TemplateType, Record<string, ZoneRect>> = {
  shirt: {
    front: { key: "front", label: "Front", left: 196, top: 118, width: 128, height: 128 },
    back: { key: "back", label: "Back", left: 338, top: 118, width: 128, height: 128 },
    left_sleeve: { key: "left_sleeve", label: "Left Sleeve", left: 44, top: 118, width: 128, height: 128 },
    right_sleeve: { key: "right_sleeve", label: "Right Sleeve", left: 441, top: 118, width: 128, height: 128 },
  },
  pants: {
    front: { key: "front", label: "Front", left: 196, top: 118, width: 128, height: 128 },
    back: { key: "back", label: "Back", left: 338, top: 118, width: 128, height: 128 },
    left_hip: { key: "left_hip", label: "Left Hip", left: 44, top: 118, width: 128, height: 128 },
    right_hip: { key: "right_hip", label: "Right Hip", left: 441, top: 118, width: 128, height: 128 },
    left_leg_front: { key: "left_leg_front", label: "Left Leg Front", left: 44, top: 288, width: 128, height: 192 },
    right_leg_front: { key: "right_leg_front", label: "Right Leg Front", left: 196, top: 288, width: 128, height: 192 },
    left_leg_back: { key: "left_leg_back", label: "Left Leg Back", left: 338, top: 288, width: 128, height: 192 },
    right_leg_back: { key: "right_leg_back", label: "Right Leg Back", left: 441, top: 288, width: 128, height: 192 },
  },
};

export function getZonesForTemplate(template: TemplateType): ZoneRect[] {
  return Object.values(TEMPLATE_ZONES[template]);
}

export function snapLayerToZone(input: { x: number; y: number; zone: ZoneRect }) {
  const { x, y, zone } = input;
  return {
    x: Math.min(zone.left + zone.width, Math.max(zone.left, x)),
    y: Math.min(zone.top + zone.height, Math.max(zone.top, y)),
  };
}
