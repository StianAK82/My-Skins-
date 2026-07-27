import test from "node:test";
import assert from "node:assert/strict";
import { completeOutfitUrl, requestCompleteOutfit } from "../complete-outfit-api.ts";

test("API route never contains /api/api", () => {
  assert.equal(completeOutfitUrl("/api"), "/api/ai/complete-outfit");
  assert.equal(completeOutfitUrl("/app/"), "/app/api/ai/complete-outfit");
});

test("successful request uses JSON and creates exactly one HTTP request", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async (_url, init) => {
    calls++;
    assert.equal(init?.method, "POST");
    assert.equal((init?.headers as Record<string, string>)["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(String(init?.body)), { prompt: "blue hoodie" });
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };
  assert.deepEqual(await requestCompleteOutfit("blue hoodie", new AbortController().signal, fetcher), { ok: true });
  assert.equal(calls, 1);
});

for (const [status, code] of [[400, undefined], [429, "AI_RATE_LIMIT"], [502, "AI_IMAGE_RESPONSE"]] as const) {
  test(`${status} API failure is safely exposed`, async () => {
    const fetcher = async () => new Response(JSON.stringify({ error: "failed", code }), { status });
    await assert.rejects(requestCompleteOutfit("blue hoodie", new AbortController().signal, fetcher as typeof fetch),
      (error: Error & { status?: number; code?: string }) => error.status === status && error.code === code);
  });
}

test("invalid JSON does not hide the HTTP error", async () => {
  const fetcher = async () => new Response("gateway exploded", { status: 502 });
  await assert.rejects(requestCompleteOutfit("blue hoodie", new AbortController().signal, fetcher as typeof fetch), /invalid response/i);
});

test("an aborted request rejects rather than waiting forever", async () => {
  const controller = new AbortController();
  const fetcher = (_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
  });
  const pending = requestCompleteOutfit("blue hoodie", controller.signal, fetcher as typeof fetch);
  controller.abort();
  await assert.rejects(pending, /aborted/i);
});
