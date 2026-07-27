import OpenAI from "openai";

const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? undefined;
const apiKey = process.env.OPENAI_API_KEY ?? process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "not-configured";

export const openai = new OpenAI({
  apiKey,
  ...(baseURL ? { baseURL } : {}),
});

/** Validate configuration at request time so the server and safe health endpoint can still start. */
export function assertOpenAiConfigured() {
  if (!process.env.OPENAI_API_KEY && !process.env.AI_INTEGRATIONS_OPENAI_API_KEY)
    throw Object.assign(new Error("OpenAI API key is not configured"), { code: "AI_CONFIGURATION" });
  if (baseURL) {
    try {
      const url = new URL(baseURL);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    } catch {
      throw Object.assign(new Error("OpenAI API base URL is invalid"), { code: "AI_CONFIGURATION" });
    }
  }
}
