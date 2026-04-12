export type StylizedOutfitConcept = {
  title: string;
  theme: string;
  styleTone: string;
  mood: string;
  visualSummary: string;
  colorPalette: string[];
  materials: string[];
  clothingPieces: Array<{ name: string; description: string; material: string; color: string }>;
  accessories: Array<{ name: string; placement: string; detail: string; color: string }>;
  trimsAndDetails: string[];
};

export type StylizedOutfitResponse = {
  meta: { generationId: string; status: "queued" | "processing" | "completed" | "degraded" | "failed"; warnings?: string[] };
  result: StylizedOutfitConcept;
};

export async function aiGenerateStylizedOutfit(payload: {
  prompt: string;
  avatarType?: string;
  bodyType?: string;
  style?: string;
}) {
  const response = await fetch("/api/ai/generate-stylized-outfit", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error ?? "Stylized outfit generation failed");
  }
  return data as StylizedOutfitResponse;
}
