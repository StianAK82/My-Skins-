import type { DesignLayer } from "../editor/design-state.ts";

type SelectedCreative = {
  id: string; title: string; story: string; palette: string[]; materials: string[];
  heroElement: { name: string; bodyLocation: string };
  silhouette: { primaryShape: string; largeForms: string[]; secondaryForms: string[]; asymmetry: string };
  textureDirection: string[];
};

export type VisibleReviewStatus = "READY" | "NEEDS_REPAIR" | "UNSUPPORTED" | "MANUAL_REVIEW";

/** Composes semantic artwork per Roblox region. No source image is stamped across zones. */
export function compileCreativeZoneArtwork(selected: SelectedCreative): Omit<DesignLayer, "id">[] {
  const color = (index: number) => selected.palette[index % selected.palette.length] ?? "#64748B";
  const transform = { x: 0, y: 0, scale: 1, rotation: 0, opacity: 1, visible: true, locked: false };
  const paint = (name: string, zone: string, fill: string): Omit<DesignLayer, "id"> => ({ name, zone, color: fill, type: "paintLayerSet", transform });
  const text = (name: string, zone: string, value: string, fill: string, scale: number): Omit<DesignLayer, "id"> => ({ name, zone, text: value, color: fill, type: "textLayer", fontSize: 18, transform: { ...transform, scale } });
  return [
    paint("creative:torso-front", "front", color(0)),
    text("creative:hero-front", "front", selected.heroElement.name.slice(0, 18), color(1), 0.72),
    paint("creative:torso-back", "back", color(0)),
    text("creative:story-back", "back", selected.story.slice(0, 22), color(2), 0.58),
    paint("creative:left-sleeve", "left_sleeve", color(1)),
    paint("creative:right-sleeve", "right_sleeve", /none|symmetr/i.test(selected.silhouette.asymmetry) ? color(1) : color(2)),
    paint("creative:left-leg-front", "left_leg_front", color(0)),
    paint("creative:right-leg-front", "right_leg_front", color(1)),
    paint("creative:left-leg-back", "left_leg_back", color(2)),
    paint("creative:right-leg-back", "right_leg_back", color(0)),
    text("creative:secondary-left", "left_sleeve", selected.silhouette.secondaryForms[0]?.slice(0, 12) ?? "detail", color(2), 0.4),
    text("creative:ornament-right", "right_sleeve", selected.textureDirection[0]?.slice(0, 12) ?? "trim", color(0), 0.4),
  ];
}

/** READY is deliberately categorical and requires renderer/export evidence. */
export function decideVisibleDesignStatus(evidence: {
  supported: boolean; heroVisible: boolean; conceptVisible: boolean; silhouetteVisible: boolean;
  materialsReadable: boolean; frontBackCoherent: boolean; criticalClipping: boolean;
  missingRequestedItems: string[]; exportValid: boolean; allViewsRendered: boolean;
}): { status: VisibleReviewStatus; defects: string[] } {
  if (!evidence.supported) return { status: "UNSUPPORTED", defects: ["Selected hero element cannot be materialized"] };
  const defects = [
    !evidence.heroVisible && "Hero element is not visible",
    !evidence.conceptVisible && "Selected concept is not visible",
    !evidence.silhouetteVisible && "Silhouette does not match the concept",
    !evidence.materialsReadable && "Materials are not visually readable",
    !evidence.frontBackCoherent && "Front and back are not coherent",
    evidence.criticalClipping && "Critical clipping is present",
    !evidence.exportValid && "Classic export is invalid",
    !evidence.allViewsRendered && "Required five-view render is incomplete",
    ...evidence.missingRequestedItems.map(item => `Missing requested item: ${item}`),
  ].filter((value): value is string => Boolean(value));
  return { status: defects.length ? "NEEDS_REPAIR" : "READY", defects };
}
