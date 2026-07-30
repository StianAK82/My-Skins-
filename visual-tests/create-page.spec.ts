import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { normalizeDesignPayload } from "../artifacts/api-server/src/lib/ai-normalize";

/**
 * Smoke tests for the real Create page (the only production page).
 * These replace the old white-hoodie fixture spec, which referenced a
 * `/visual-test` route and `src/lib/hoodie/classic-shirt` module that do
 * not exist in the repository (see docs/implementation/current-system-audit.md).
 *
 * WebGL note: the shared Screenshot tooling and default headless Chromium
 * need SwiftShader flags for the Three.js canvas; the playwright config
 * passes them via launchOptions.
 */

test.beforeAll(async () => {
  await mkdir("test-results/screenshots", { recursive: true });
});

test("Create page loads with prompt presets and 3D preview canvas", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("My Skins")).toBeVisible();
  // Preset idea buttons (child-facing prompt shortcuts)
  await expect(page.getByText("Dragon", { exact: false }).first()).toBeVisible();
  // Three.js preview canvas mounts
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: "test-results/screenshots/create-page.png", fullPage: true });
});

test("Create page works on a narrow mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByText("My Skins")).toBeVisible();
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: "test-results/screenshots/create-page-mobile.png", fullPage: true });
});

const baseOutfit = {
  top: "none", bottom: "none", shoes: "none",
  hair: { style: "none", color: "#111111" }, accessories: [], customParts: [], unsupported: [], reason: "fixture",
} as const;

const workflowFixtures = [
  ["White hoodie", { ...baseOutfit, top: "hoodie" }, ["hoodie"]],
  ["Long black hair and a red cap", { ...baseOutfit, hair: { style: "long", color: "#111111" }, accessories: [{ kind: "cap", color: "#FF0000", size: "medium" }] }, ["long", "cap"]],
  ["White jacket, blue jeans and black shoes", { ...baseOutfit, top: "jacket", bottom: "pants", shoes: "sneakers" }, ["jacket", "pants", "sneakers"]],
  ["Backpack and large white angel wings", { ...baseOutfit, accessories: [{ kind: "backpack", color: "#333333", size: "medium" }, { kind: "wings", color: "#FFFFFF", size: "large" }] }, ["backpack", "wings"]],
  ["Pink dress, crown and silver shoes", { ...baseOutfit, top: "dress", shoes: "sneakers", accessories: [{ kind: "crown", color: "#F5C542", size: "medium" }] }, ["dress", "crown", "sneakers"]],
  ["Black ninja outfit with mask, belt and boots", { ...baseOutfit, top: "sweater", bottom: "pants", shoes: "boots", accessories: [{ kind: "mask", color: "#111111", size: "medium" }, { kind: "belt", color: "#222222", size: "medium" }] }, ["sweater", "pants", "boots", "mask", "belt"]],
  ["Football kit with shirt, shorts, socks and shoes", { ...baseOutfit, top: "tshirt", bottom: "shorts", shoes: "sneakers", unsupported: ["socks"] }, ["tshirt", "shorts", "sneakers", "socks"]],
  ["Blue hoodie, black cap, backpack and white shoes", { ...baseOutfit, top: "hoodie", shoes: "sneakers", accessories: [{ kind: "cap", color: "#111111", size: "medium" }, { kind: "backpack", color: "#333333", size: "medium" }] }, ["hoodie", "cap", "backpack", "sneakers"]],
] as const;

test("deterministic child workflows keep every requested item", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    if (request.url().endsWith("/api/ai/generate")) {
      const body = request.postDataJSON() as { prompt: string; previousOutfit?: typeof baseOutfit };
      const fixture = workflowFixtures.find(([prompt]) => prompt === body.prompt);
      const outfit = body.previousOutfit
        ? { ...body.previousOutfit, accessories: body.previousOutfit.accessories.map((item) => item.kind === "wings" ? { ...item, size: "large" } : item) }
        : fixture?.[1] ?? baseOutfit;
      const result = normalizeDesignPayload({ prompt: body.prompt, itemType: "classic_shirt", previousOutfit: body.previousOutfit as never }, { outfit });
      await route.fulfill({ json: { meta: { generationId: "fixture", status: "completed", warnings: [], deprecated: false }, result } });
    } else if (request.url().endsWith("/api/ai/hero-image")) {
      await route.fulfill({ json: {} });
    } else {
      await route.fulfill({ status: 401, json: { error: "fixture-auth" } });
    }
  });

  for (const [prompt, , expected] of workflowFixtures) {
    await page.goto("/");
    await page.locator("details").last().click();
    await page.locator("details input").fill(prompt);
    await page.locator("details button[type=submit]").click();
    await expect(page.getByText("Only visible here", { exact: false })).toBeVisible();
    const body = (await page.locator("body").innerText()).toLowerCase();
    for (const item of expected) expect(body).toContain(item);
  }

  await page.goto("/");
  await page.locator("details").last().click();
  await page.locator("details input").fill("Backpack and large white angel wings");
  await page.locator("details button[type=submit]").click();
  await expect(page.getByText("Only visible here", { exact: false })).toBeVisible();
  await page.locator('input[placeholder*="make the wings"]').fill("Make only the wings larger and keep everything else");
  await page.locator('input[placeholder*="make the wings"]').press("Enter");
  const revisedBody = (await page.locator("body").innerText()).toLowerCase();
  expect(revisedBody).toContain("backpack");
  expect(revisedBody).toContain("wings");
  expect(consoleErrors).toEqual([]);
});
