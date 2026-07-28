import { zodResponseFormat } from "openai/helpers/zod";
export { openai } from "./client.ts";

/** Deliberately small boundary: prevents OpenAI's parser generics from expanding the complete outfit type in API callers. */
export interface StrictJsonResponseFormat {
  type: "json_schema";
  json_schema: { name: string; strict: true; schema: Record<string, unknown> };
}

export function strictJsonResponseFormat(schema: unknown, name: string): StrictJsonResponseFormat {
  return zodResponseFormat(schema as never, name) as unknown as StrictJsonResponseFormat;
}
