export type OutfitApiError = Error & { code?: string; stage?: string; retryable?: boolean; status?: number };

export function completeOutfitUrl(basePath: string) {
  const root = basePath.replace(/\/$/, "").replace(/\/api$/, "");
  return `${root}/api/ai/complete-outfit`;
}

export async function requestCompleteOutfit<T>(prompt: string, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<T> {
  const viteEnv = (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env;
  const response = await fetcher(completeOutfitUrl(viteEnv?.BASE_URL ?? "/"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
    signal,
  });
  const text = await response.text();
  let data: Record<string, unknown>;
  try { data = text ? JSON.parse(text) as Record<string, unknown> : {}; }
  catch { data = { error: "The server returned an invalid response", code: "INVALID_RESPONSE" }; }
  if (!response.ok) {
    const error = new Error(typeof data.error === "string" ? data.error : "AI generation could not finish") as OutfitApiError;
    error.code = typeof data.code === "string" ? data.code : undefined;
    error.stage = typeof data.stage === "string" ? data.stage : undefined;
    error.retryable = data.retryable === true;
    error.status = response.status;
    throw error;
  }
  return data as T;
}
