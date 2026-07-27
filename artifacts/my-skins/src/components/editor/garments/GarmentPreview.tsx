import { HoodiePreviewShell } from "./HoodiePreviewShell";
import type { OutfitDNA } from "@/lib/editor/garment-preview-material";

export function GarmentPreview({ kind = "hoodie", dna }: { kind?: "hoodie"; dna?: OutfitDNA }) {
  return kind === "hoodie" ? <HoodiePreviewShell dna={dna} /> : null;
}
