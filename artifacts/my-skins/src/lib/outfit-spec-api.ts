export type GeneratedOutfitSpecResponse<T> = {
  generationId: string;
  generationSource: "openai" | "deterministic-test-fixture";
  outfitSpec: T;
  exports: Array<{ garment: "Shirt Classic"; width: 585; height: 559 }>;
};

export async function requestOutfitSpec<T>(prompt: string, signal?: AbortSignal): Promise<GeneratedOutfitSpecResponse<T>> {
  const response = await fetch("/api/ai/outfit-spec", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt }),
    signal,
  });
  const payload = await response.json() as GeneratedOutfitSpecResponse<T> & { error?: string };
  if (!response.ok) throw Object.assign(new Error(payload.error ?? "Outfit generation failed"), { status: response.status });
  if (!payload.generationId || !payload.outfitSpec || payload.generationSource !== "openai") throw new Error("Invalid production outfit response");
  return payload;
}
