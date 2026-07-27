import test from "node:test";
import assert from "node:assert/strict";
import { generateCompleteOutfit } from "../services/ai/complete-outfit.service.ts";
import { AiGenerationError, withAiTimeout } from "../services/ai/ai-errors.ts";

const texture = (type: string) => ({ imageUrl: `${type}-image`, attempts: 1 });

test("complete outfit plans once and generates shirt then pants sequentially", async () => {
  let plans = 0;
  const calls: string[] = [];
  const result = await generateCompleteOutfit("blue hoodie", {
    plan(description) {
      plans++;
      return { theme: description, style: "streetwear", primaryColours: ["blue"], accentColours: ["white"], avatar: { bodyStyle: "Roblox-style", skinTone: "default" }, top: { type: "hoodie", colour: "blue" }, bottom: { type: "trousers", colour: "blue" }, footwear: { type: "shoes", colour: "white" }, accessories: [], completeLook: "blue outfit" };
    },
    generate: (async (type: "shirt" | "pants", _prompt: string, prepared: unknown) => {
      assert.ok(prepared, "prepared specification prevents another planner call");
      calls.push(`${type}:start`);
      await new Promise((resolve) => setTimeout(resolve, 2));
      calls.push(`${type}:end`);
      return texture(type);
    }) as never,
    log() {},
  });
  assert.equal(plans, 1);
  assert.deepEqual(calls, ["shirt:start", "shirt:end", "pants:start", "pants:end"]);
  assert.equal(result.components.pantsTexture, "pants-image");
});

test("shirt failure prevents pants generation and preserves its stage", async () => {
  const calls: string[] = [];
  await assert.rejects(generateCompleteOutfit("red outfit", {
    generate: (async (type: "shirt" | "pants") => {
      calls.push(type);
      throw new AiGenerationError("failed", "AI_IMAGE_RESPONSE", "shirt_generation", true, 502);
    }) as never,
    log() {},
  }), (error: AiGenerationError) => error.stage === "shirt_generation");
  assert.deepEqual(calls, ["shirt"]);
});

test("pants failure returns a clear pants stage", async () => {
  await assert.rejects(generateCompleteOutfit("green outfit", {
    generate: (async (type: "shirt" | "pants") => {
      if (type === "pants") throw new Error("down");
      return texture(type);
    }) as never,
    log() {},
  }), (error: AiGenerationError) => error.stage === "pants_generation");
});

test("AI operations cannot wait forever and return typed timeouts", async () => {
  await assert.rejects(withAiTimeout(() => new Promise(() => undefined), 5, "shirt_generation"),
    (error: AiGenerationError) => error.code === "AI_TIMEOUT" && error.retryable && error.stage === "shirt_generation");
});
