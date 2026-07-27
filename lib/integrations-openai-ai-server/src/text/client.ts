import { assertOpenAiConfigured, openai } from "../client";

export interface GarmentClassification {
  garmentType: string;
  material: string;
  fit: string;
  primaryColours: string[];
  accentColours: string[];
  artwork: string[];
  explicitDetails: string[];
}

/** Convert natural clothing language into a small, factual planning record. */
export async function classifyGarmentDescription(description: string): Promise<GarmentClassification> {
  assertOpenAiConfigured();
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "Classify a clothing request for a UV texture planner. Return JSON only with garmentType, material, fit, primaryColours, accentColours, artwork, and explicitDetails. Arrays contain short strings. Infer ordinary garment/material/fit terminology, but never invent logos, text, pockets, closures, colours, or artwork that the user did not request. Use an empty string or array when unknown.",
      },
      { role: "user", content: description },
    ],
  });
  const parsed = JSON.parse(response.choices[0]?.message.content ?? "{}") as Partial<GarmentClassification>;
  const strings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 8) : [];
  return {
    garmentType: typeof parsed.garmentType === "string" ? parsed.garmentType : "",
    material: typeof parsed.material === "string" ? parsed.material : "",
    fit: typeof parsed.fit === "string" ? parsed.fit : "",
    primaryColours: strings(parsed.primaryColours),
    accentColours: strings(parsed.accentColours),
    artwork: strings(parsed.artwork),
    explicitDetails: strings(parsed.explicitDetails),
  };
}
