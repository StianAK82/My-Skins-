// Hidden visual QA page for verifying accessory placement on the 3D avatar.
// Open /fit-check?page=N — each page renders 3 outfit combos, front + back.
// Not linked from anywhere in the product UI.
import { useMemo } from "react";
import { useSearch } from "wouter";
import { AvatarPreview, type GarmentConfig } from "@/components/editor/AvatarPreview";
import { defaultAvatarState } from "@/lib/editor/design-state";
import type { AvatarModelVariant, AvatarSlotItem, AvatarCosmeticSlot, AvatarState } from "@/lib/editor/design-state";

const slotItem = (assetId: string, color?: string): AvatarSlotItem => ({
  assetId,
  color,
  scale: 1,
  visible: true,
  offset: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
});

type Combo = {
  label: string;
  model: AvatarModelVariant;
  garment?: GarmentConfig;
  slots?: Partial<Record<AvatarCosmeticSlot, AvatarSlotItem | null>>;
  customParts?: Array<{
    name: string;
    shape: "horn" | "spike" | "orb" | "plate" | "band" | "snake" | "fin" | "blob";
    attach: "forehead" | "head_top" | "face" | "neck" | "chest" | "belly" | "back" | "hips" | "left_shoulder" | "right_shoulder" | "left_hand" | "right_hand" | "left_leg" | "right_leg" | "left_foot" | "right_foot";
    color: string;
    size: "small" | "medium" | "large";
  }>;
};

const COMBOS: Combo[][] = [
  // Page 1 — prompts 1-3 (r15)
  [
    { label: "Hvit hoodie", model: "proportioned_r15", garment: { top: "hoodie", bottom: "pants" } },
    { label: "Langt svart hår + rød caps", model: "proportioned_r15", garment: { top: "tshirt", bottom: "pants" }, slots: { hair: slotItem("hair_long", "#111827"), hat: slotItem("hat_street_cap", "#dc2626") } },
    { label: "Jakke + jeans + sko", model: "proportioned_r15", garment: { top: "jacket", bottom: "pants", shoes: "sneakers" } },
  ],
  // Page 2 — prompts 4-5
  [
    { label: "Ryggsekk", model: "proportioned_r15", garment: { top: "tshirt", bottom: "pants" }, slots: { back: slotItem("back_backpack") } },
    { label: "Vinger", model: "proportioned_r15", garment: { top: "tshirt", bottom: "pants" }, slots: { back: slotItem("back_wings") } },
    { label: "Prinsessekjole + krone", model: "proportioned_r15", garment: { top: "dress", bottom: null }, slots: { hat: slotItem("hat_crown") } },
  ],
  // Page 3 — prompts 6-8
  [
    { label: "Ninja med maske", model: "proportioned_r15", garment: { top: "tshirt", bottom: "pants" }, slots: { hat: slotItem("hat_mask") } },
    { label: "Fotballdrakt", model: "proportioned_r15", garment: { top: "tshirt", bottom: "shorts", shoes: "sneakers" } },
    { label: "Vinter: jakke+lue+bag+støvler", model: "proportioned_r15", garment: { top: "jacket", bottom: "pants", shoes: "boots" }, slots: { hat: slotItem("hat_beanie_soft"), back: slotItem("back_bag") } },
  ],
  // Page 4 — prompts 9-10 + belt
  [
    { label: "Blå hettegenser+caps+sekk+hvite sko", model: "proportioned_r15", garment: { top: "hoodie", bottom: "pants", shoes: "sneakers" }, slots: { hat: slotItem("hat_street_cap", "#1d4ed8"), back: slotItem("back_backpack") } },
    { label: "Hår + vinger + kjole", model: "proportioned_r15", garment: { top: "dress", bottom: null }, slots: { hair: slotItem("hair_long", "#7c2d12"), back: slotItem("back_wings") } },
    { label: "Belte", model: "proportioned_r15", garment: { top: "tshirt", bottom: "pants" }, slots: { neck: slotItem("neck_belt") } },
  ],
  // Page 5 — accessories close-up (r15)
  [
    { label: "Hansker", model: "proportioned_r15", garment: { top: "tshirt", bottom: "pants" }, slots: { neck: slotItem("neck_gloves") } },
    { label: "Hale + briller", model: "proportioned_r15", garment: { top: "tshirt", bottom: "pants" }, slots: { back: slotItem("back_tail"), hat: slotItem("hat_glasses") } },
    { label: "Skjørt + ponytail", model: "proportioned_r15", garment: { top: "tshirt", bottom: "skirt" }, slots: { hair: slotItem("hair_ponytail") } },
  ],
  // Page 6 — classic blocky
  [
    { label: "Blocky: hår+caps+støvler", model: "classic_blocky", garment: { top: "hoodie", bottom: "pants", shoes: "boots" }, slots: { hair: slotItem("hair_long", "#111827"), hat: slotItem("hat_street_cap", "#dc2626") } },
    { label: "Blocky: vinger+kjole+krone", model: "classic_blocky", garment: { top: "dress", bottom: null }, slots: { back: slotItem("back_wings"), hat: slotItem("hat_crown") } },
    { label: "Blocky: sekk+belte+hansker", model: "classic_blocky", garment: { top: "tshirt", bottom: "pants" }, slots: { back: slotItem("back_backpack"), neck: slotItem("neck_belt") } },
  ],
  // Page 7 — heroic
  [
    { label: "Heroic: hår+caps+støvler", model: "heroic", garment: { top: "hoodie", bottom: "pants", shoes: "boots" }, slots: { hair: slotItem("hair_long", "#111827"), hat: slotItem("hat_street_cap", "#dc2626") } },
    { label: "Heroic: vinger+kjole+krone", model: "heroic", garment: { top: "dress", bottom: null }, slots: { back: slotItem("back_wings"), hat: slotItem("hat_crown") } },
    { label: "Heroic: sekk+belte", model: "heroic", garment: { top: "tshirt", bottom: "pants" }, slots: { back: slotItem("back_backpack"), neck: slotItem("neck_belt") } },
  ],
  // Page 8 — gloves/glasses/mask/tail across models
  [
    { label: "Blocky: hansker+briller+hale", model: "classic_blocky", garment: { top: "tshirt", bottom: "pants" }, slots: { neck: slotItem("neck_gloves"), hat: slotItem("hat_glasses"), back: slotItem("back_tail") } },
    { label: "Heroic: hansker+briller+hale", model: "heroic", garment: { top: "tshirt", bottom: "pants" }, slots: { neck: slotItem("neck_gloves"), hat: slotItem("hat_glasses"), back: slotItem("back_tail") } },
    { label: "Heroic: maske + curly hår", model: "heroic", garment: { top: "tshirt", bottom: "pants" }, slots: { hat: slotItem("hat_mask") } },
  ],
  // Page 8 — custom parts & snake hair
  [
    { label: "Slangehår + pannehorn", model: "proportioned_r15", garment: { top: "tshirt", bottom: "pants" }, slots: { hair: slotItem("hair_snakes", "#3E8E4E") }, customParts: [{ name: "Pannehorn", shape: "horn", attach: "forehead", color: "#facc15", size: "medium" }] },
    { label: "Ryggpigger + magehorn", model: "classic_blocky", garment: { top: "tshirt", bottom: "pants" }, customParts: [{ name: "Ryggpigger", shape: "spike", attach: "back", color: "#ef4444", size: "large" }, { name: "Magehorn", shape: "horn", attach: "belly", color: "#3b82f6", size: "large" }] },
    { label: "Hånd-kule + skulderslange", model: "heroic", garment: { top: "hoodie", bottom: "pants" }, customParts: [{ name: "Glødende kule", shape: "orb", attach: "right_hand", color: "#22d3ee", size: "medium" }, { name: "Skulderslange", shape: "snake", attach: "left_shoulder", color: "#a855f7", size: "medium" }] },
  ],
];

const ALL_COMBOS: Combo[] = COMBOS.flat();

function comboAvatar(combo: Combo): AvatarState {
  const base = defaultAvatarState();
  return { ...base, modelVariant: combo.model, slots: { ...base.slots, ...(combo.slots ?? {}) } };
}

export default function FitCheck() {
  const search = useSearch();
  const index = Math.min(ALL_COMBOS.length - 1, Math.max(0, Number(new URLSearchParams(search).get("combo") ?? "0")));
  const combo = ALL_COMBOS[index];
  const avatar = useMemo(() => comboAvatar(combo), [combo]);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-3">
      <div className="text-sm mb-2">#{index + 1}/{ALL_COMBOS.length} · {combo.label} · {combo.model}</div>
      <div className="h-[760px] rounded-lg overflow-hidden border border-white/10">
        <AvatarPreview
          studioMode
          previewMode="avatar"
          dimension="3d"
          avatarState={avatar}
          garment={combo.garment}
          customParts={combo.customParts}
          animated={false}
        />
      </div>
    </div>
  );
}
