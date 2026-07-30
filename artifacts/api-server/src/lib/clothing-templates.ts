// Canonical Roblox Classic Clothing template geometry.
// Mirrors artifacts/my-skins/src/lib/editor/templates.ts so preview and the
// server-side compiler share the same pixel layout.

export type TemplateType = "shirt" | "pants";

export type ZoneRect = {
  key: string;
  label: string;
  left: number;
  top: number;
  width: number;
  height: number;
};

export const TEMPLATE_SIZE = { width: 585, height: 559 } as const;

export const TEMPLATE_ZONES: Record<TemplateType, Record<string, ZoneRect>> = {
  shirt: {
    front: { key: "front", label: "Front", left: 196, top: 118, width: 128, height: 128 },
    back: { key: "back", label: "Back", left: 338, top: 118, width: 128, height: 128 },
    left_sleeve: { key: "left_sleeve", label: "Left Sleeve", left: 44, top: 118, width: 128, height: 128 },
    right_sleeve: { key: "right_sleeve", label: "Right Sleeve", left: 441, top: 118, width: 128, height: 128 },
    left_leg_front: { key: "left_leg_front", label: "Left Leg Front", left: 196, top: 288, width: 64, height: 192 },
    right_leg_front: { key: "right_leg_front", label: "Right Leg Front", left: 260, top: 288, width: 64, height: 192 },
    left_leg_back: { key: "left_leg_back", label: "Left Leg Back", left: 338, top: 288, width: 64, height: 192 },
    right_leg_back: { key: "right_leg_back", label: "Right Leg Back", left: 402, top: 288, width: 64, height: 192 },
  },
  pants: {
    front: { key: "front", label: "Front", left: 196, top: 118, width: 128, height: 128 },
    back: { key: "back", label: "Back", left: 338, top: 118, width: 128, height: 128 },
    left_sleeve: { key: "left_sleeve", label: "Left Hip", left: 44, top: 118, width: 128, height: 128 },
    right_sleeve: { key: "right_sleeve", label: "Right Hip", left: 441, top: 118, width: 128, height: 128 },
    left_leg_front: { key: "left_leg_front", label: "Left Leg Front", left: 44, top: 288, width: 128, height: 192 },
    right_leg_front: { key: "right_leg_front", label: "Right Leg Front", left: 196, top: 288, width: 128, height: 192 },
    left_leg_back: { key: "left_leg_back", label: "Left Leg Back", left: 338, top: 288, width: 128, height: 192 },
    right_leg_back: { key: "right_leg_back", label: "Right Leg Back", left: 441, top: 288, width: 128, height: 192 },
  },
};

// Zones that must have opaque pixel coverage for each artifact class.
export const REQUIRED_COVERAGE_ZONES: Record<TemplateType, string[]> = {
  shirt: ["front", "back", "left_sleeve", "right_sleeve"],
  pants: ["front", "back", "left_leg_front", "right_leg_front", "left_leg_back", "right_leg_back"],
};
