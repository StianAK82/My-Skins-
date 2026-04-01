import OpenAI from "openai";

if (!process.env.OPENAI_API_KEY && !process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
  throw new Error(
    "OPENAI_API_KEY must be set.",
  );
}

const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL ?? undefined;
const apiKey = process.env.OPENAI_API_KEY ?? process.env.AI_INTEGRATIONS_OPENAI_API_KEY ?? "";

export const openai = new OpenAI({
  apiKey,
  ...(baseURL ? { baseURL } : {}),
});
