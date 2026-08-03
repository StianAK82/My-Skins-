import { test, expect, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { normalizeDesignPayload } from "../artifacts/api-server/src/lib/ai-normalize";
import { legacyToUniversalOutfitSpec } from "../artifacts/api-server/src/lib/universal-outfit";

test.beforeAll(async () => {
  await mkdir("test-results/screenshots", { recursive: true });
});

const baseOutfit = {
  top: "none",
  bottom: "none",
  shoes: "none",
  hair: { style: "none", color: "#111111" },
  accessories: [],
  customParts: [],
  unsupported: [],
  reason: "fixture",
} as const;

const workflowFixtures = [
  ["White hoodie", { ...baseOutfit, top: "hoodie" }, ["hoodie"]],
  [
    "Long black hair and a red cap",
    {
      ...baseOutfit,
      hair: { style: "long", color: "#111111" },
      accessories: [{ kind: "cap", color: "#FF0000", size: "medium" }],
    },
    ["long", "cap"],
  ],
  [
    "White jacket, blue jeans and black shoes",
    { ...baseOutfit, top: "jacket", bottom: "pants", shoes: "sneakers" },
    ["jacket", "pants", "sneakers"],
  ],
  [
    "Backpack and large white angel wings",
    {
      ...baseOutfit,
      accessories: [
        { kind: "backpack", color: "#333333", size: "medium" },
        { kind: "wings", color: "#FFFFFF", size: "large" },
      ],
    },
    ["backpack", "wings"],
  ],
  [
    "Pink dress, crown and silver shoes",
    {
      ...baseOutfit,
      top: "dress",
      shoes: "sneakers",
      accessories: [{ kind: "crown", color: "#F5C542", size: "medium" }],
    },
    ["dress", "crown", "sneakers"],
  ],
  [
    "Black ninja outfit with mask, belt and boots",
    {
      ...baseOutfit,
      top: "sweater",
      bottom: "pants",
      shoes: "boots",
      accessories: [
        { kind: "mask", color: "#111111", size: "medium" },
        { kind: "belt", color: "#222222", size: "medium" },
      ],
    },
    ["sweater", "pants", "boots", "mask", "belt"],
  ],
  [
    "Football kit with shirt, shorts, socks and shoes",
    {
      ...baseOutfit,
      top: "tshirt",
      bottom: "shorts",
      shoes: "sneakers",
      unsupported: ["socks"],
    },
    ["tshirt", "shorts", "sneakers", "socks"],
  ],
  [
    "Blue hoodie, black cap, backpack and white shoes",
    {
      ...baseOutfit,
      top: "hoodie",
      shoes: "sneakers",
      accessories: [
        { kind: "cap", color: "#111111", size: "medium" },
        { kind: "backpack", color: "#333333", size: "medium" },
      ],
    },
    ["hoodie", "cap", "backpack", "sneakers"],
  ],
  [
    "Black zip hoodie and jeans",
    { ...baseOutfit, top: "hoodie", bottom: "pants" },
    ["hoodie", "pants"],
  ],
  [
    "Black cargo outfit with large angel wings",
    {
      ...baseOutfit,
      bottom: "pants",
      accessories: [{ kind: "wings", color: "#FFFFFF", size: "large" }],
    },
    ["pants", "wings"],
  ],
  [
    "Winter coat, beanie and boots",
    {
      ...baseOutfit,
      top: "jacket",
      shoes: "boots",
      accessories: [{ kind: "beanie", color: "#222222", size: "medium" }],
    },
    ["jacket", "beanie", "boots"],
  ],
  [
    "Formal suit with black shoes",
    { ...baseOutfit, top: "jacket", bottom: "pants", shoes: "sneakers" },
    ["jacket", "pants", "sneakers"],
  ],
] as const;

const creativeBenchmarks = [
  ["Create the world's coolest rune knight", { ...baseOutfit, top:"jacket", bottom:"pants", shoes:"boots" }, "Rune Warden"],
  ["Ordinary grey fleece clothes", { ...baseOutfit, top:"hoodie", bottom:"pants", shoes:"sneakers" }, "Everyday Cloud"],
  ["A moonlight princess", { ...baseOutfit, top:"dress", accessories:[{kind:"crown",color:"#F5C542",size:"large"}] }, "Moon Crown"],
  ["A storm pirate captain", { ...baseOutfit, top:"jacket", bottom:"pants", accessories:[{kind:"sword",color:"#D4AF37",size:"large"}] }, "Storm Corsair"],
  ["An asymmetric neon robot", { ...baseOutfit, top:"jacket", bottom:"pants", shoes:"boots" }, "Neon Automaton"],
  ["A bold football kit number 10", { ...baseOutfit, top:"tshirt", bottom:"shorts", shoes:"sneakers" }, "Victory Ten"],
  ["An original web-inspired midnight superhero without protected logos", { ...baseOutfit, top:"sweater", bottom:"pants", shoes:"boots" }, "Midnight Weaver"],
] as const;

const evidenceCases = creativeBenchmarks.map(([prompt]) => prompt);
const evidenceViews = [
  "front",
  "front-45",
  "right",
  "back",
  "back-45",
] as const;
const evidenceRoot = "test-results/screenshots/representative";

type ApiFixtureState = {
  requested: string[];
  unexpected: string[];
  proxyLeaks: string[];
};

async function installApiFixtures(
  page: Page,
  options: {
    enableAi?: boolean;
    visualReview?: "ready" | "unavailable";
  } = {},
): Promise<ApiFixtureState> {
  const { enableAi = false, visualReview = "unavailable" } = options;
  const state: ApiFixtureState = {
    requested: [],
    unexpected: [],
    proxyLeaks: [],
  };
  page.on("request", (request) => {
    if (request.url().includes("127.0.0.1:3001"))
      state.proxyLeaks.push(request.url());
  });
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    state.requested.push(path);
    if (path === "/api/payments/skin-status") {
      await route.fulfill({
        json: { remainingFree: 1, freeLimit: 1, paidCredits: 0 },
      });
      return;
    }
    if (path === "/api/entitlements/generation-summary") {
      await route.fulfill({ json: { freeFirst: "available", availableGenerationCredits: { "2D": 1, "3D": 1 }, currentlyReserved: 0, canGenerate: { "2D": true, "3D": true }, recentActivity: [] } });
      return;
    }
    if (path === "/api/promotions/redeem") {
      await route.fulfill({ json: { success: true, message: "Your free skin credit is ready.", grantedCredits: [{ creditType: "GENERATION_3D", quantity: 1 }], redemptionId: "promo-redemption-fixture" } });
      return;
    }
    if (path === "/api/auth/roblox/me") {
      await route.fulfill({ json: { loggedIn: false, configured: false } });
      return;
    }
    if (enableAi && path === "/api/ai/generate") {
      const body = request.postDataJSON() as {
        prompt: string;
        previousOutfit?: typeof baseOutfit;
      };
      const fixture = [...workflowFixtures, ...creativeBenchmarks].find(
        ([prompt]) => prompt === body.prompt,
      );
      const outfit = body.previousOutfit
        ? {
            ...body.previousOutfit,
            accessories: body.previousOutfit.accessories.map((item) =>
              item.kind === "wings" ? { ...item, size: "large" } : item,
            ),
          }
        : (fixture?.[1] ?? baseOutfit);
      const result = normalizeDesignPayload(
        {
          prompt: body.prompt,
          itemType: "classic_shirt",
          previousOutfit: body.previousOutfit as never,
        },
        { outfit },
      );
      await route.fulfill({
        json: {
          meta: {
            generationId: "fixture",
            status: "degraded",
            warnings: ["Five-view browser visual acceptance is required before READY"],
            deprecated: false,
          },
          result,
          outfitSpec: legacyToUniversalOutfitSpec({
            generationId: "00000000-0000-4000-8000-000000000099",
            prompt: body.prompt,
            style: result.style,
            palette: result.colorPalette,
            outfit,
          }),
          creativeDirection: {
            selected: {
              id: `benchmark-${body.prompt.toLowerCase().replace(/[^a-z0-9]+/g,"-")}`, title: fixture?.[2] ?? "Visible Direction", story: `The back continues ${fixture?.[2] ?? "the concept"}`,
              silhouette: { primaryShape: /robot|knight/.test(body.prompt.toLowerCase()) ? "broad angular heroic shoulders" : /princess/.test(body.prompt.toLowerCase()) ? "long dramatic gown" : "fitted readable silhouette", largeForms:["distinct upper body"], secondaryForms:["ornament plates"], asymmetry:/robot|pirate/.test(body.prompt.toLowerCase()) ? "strong right-side feature" : "intentional symmetry" },
              heroElement: { name: fixture?.[2] ?? "Hero mark", description:/robot/.test(body.prompt.toLowerCase()) ? "luminous robotic arm" : "luminous chest emblem", bodyLocation:/princess/.test(body.prompt.toLowerCase()) ? "head crown" : "chest", memoryHook:"recognizable at thumbnail size" },
              palette:["#111827","#2563EB","#D4AF37"], materials:/fleece/.test(body.prompt.toLowerCase()) ? ["soft grey fleece","cotton"] : ["darkened metal","emissive accents"], garmentDirection:["structured panels"], accessoryDirection:["one hero feature"], textureDirection:["zone-specific ornament","subtle wear"],
            },
          },
          finalSkinStatus: "NEEDS_REPAIR",
          lifecycle: "external_verification_required",
        },
      });
      return;
    }
    if (enableAi && path === "/api/ai/visual-review") {
      if (visualReview === "unavailable") {
        await route.fulfill({
          status: 503,
          json: { error: "Visual review intentionally unavailable in fixture" },
        });
        return;
      }
      const body = request.postDataJSON() as { views?: unknown[]; itemIds?: string[] };
      const complete = body.views?.length === 5 && Boolean(body.itemIds?.length);
      await route.fulfill({ json: { status: complete ? "READY" : "NEEDS_REPAIR", defects: complete ? [] : ["Incomplete five-view evidence"], repairs: [] } });
      return;
    }
    if (enableAi && path === "/api/ai/hero-image") {
      await route.fulfill({ json: {} });
      return;
    }
    state.unexpected.push(`${request.method()} ${path}`);
    await route.abort("blockedbyclient");
  });
  return state;
}

function assertApiIsolation(state: ApiFixtureState) {
  expect(
    state.unexpected,
    `Unexpected API calls: ${state.unexpected.join(", ")}`,
  ).toEqual([]);
  expect(
    state.proxyLeaks,
    `Requests escaped to the Vite API proxy: ${state.proxyLeaks.join(", ")}`,
  ).toEqual([]);
}

test("Create page loads with prompt presets and 3D preview canvas", async ({
  page,
}) => {
  const api = await installApiFixtures(page);
  await page.goto("/");
  await expect(page.getByText("My Skins")).toBeVisible();
  await expect(
    page.getByText("Dragon", { exact: false }).first(),
  ).toBeVisible();
  // Use deterministic vector artwork instead of platform emoji. The latter
  // rendered as empty tofu boxes in the first CI evidence set.
  await expect(
    page.getByRole("button", { name: "Dragon" }).locator("svg"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Kitty" }).locator("svg"),
  ).toBeVisible();
  await expect(page.getByTestId("create-tagline")).toHaveText(
    "Tap a picture – and we'll make your skin!",
  );
  await expect(page.getByTestId("create-tagline")).not.toContainText(/[👇✨]/u);
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 20_000 });
  expect(api.requested).toEqual(
    expect.arrayContaining([
      "/api/payments/skin-status",
      "/api/auth/roblox/me",
    ]),
  );
  assertApiIsolation(api);
  await page.screenshot({
    path: "test-results/screenshots/create-page.png",
    fullPage: true,
  });
});

test("free-first balance and 2D/3D choice use child-friendly server state", async ({ page }) => {
  const api = await installApiFixtures(page);
  await page.goto("/");
  await expect(page.getByTestId("generation-credit-message")).toHaveText("Your first skin is free.");
  const previewType = page.getByLabel("Preview type");
  await expect(previewType.getByRole("button", { name: "2D" })).toBeVisible();
  await expect(previewType.getByRole("button", { name: "3D" })).toBeVisible();
  assertApiIsolation(api);
});

test("promotion redemption refreshes the authoritative child-friendly balance", async ({ page }) => {
  const api = await installApiFixtures(page);
  await page.goto("/");
  await page.getByLabel("Do you have a code?").fill("FREE3DPREVIEW");
  await page.getByRole("button", { name: "Use code" }).click();
  await expect(page.getByRole("status")).toHaveText("Your free skin credit is ready.");
  expect(api.requested.filter((path) => path === "/api/entitlements/generation-summary").length).toBeGreaterThan(1);
  assertApiIsolation(api);
});

test("Create page works on a narrow mobile viewport", async ({ page }) => {
  const api = await installApiFixtures(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByText("My Skins")).toBeVisible();
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 20_000 });
  assertApiIsolation(api);
  await page.screenshot({
    path: "test-results/screenshots/create-page-mobile.png",
    fullPage: true,
  });
});

test("deterministic child workflows keep every requested item", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  const api = await installApiFixtures(page, {
    enableAi: true,
    visualReview: "ready",
  });

  for (const [prompt, , expected] of workflowFixtures) {
    await page.goto("/");
    await page.locator("details").last().click();
    await page.locator("details input").fill(prompt);
    await page.locator("details button[type=submit]").click();
    const result = page.getByTestId("outfit-result");
    await expect(result).toHaveAttribute(
      "data-generation-state",
      prompt.startsWith("Football")
        ? "external_verification_required"
        : "complete",
    );
    const text = (await result.innerText()).toLowerCase();
    for (const item of expected) expect(text).toContain(item);
  }

  await page.goto("/");
  await page.locator("details").last().click();
  await page
    .locator("details input")
    .fill("Backpack and large white angel wings");
  await page.locator("details button[type=submit]").click();
  await expect(page.getByTestId("outfit-result")).toHaveAttribute(
    "data-generation-state",
    "complete",
  );
  await page
    .locator('input[placeholder*="make the wings"]')
    .fill("Make only the wings larger and keep everything else");
  await page.locator('input[placeholder*="make the wings"]').press("Enter");
  const result = page.getByTestId("outfit-result");
  await expect(result).toHaveAttribute("data-generation-state", "complete");
  const revisedText = (await result.innerText()).toLowerCase();
  expect(revisedText).toContain("backpack");
  expect(revisedText).toContain("wings");
  expect(api.requested).toEqual(
    expect.arrayContaining([
      "/api/payments/skin-status",
      "/api/auth/roblox/me",
      "/api/ai/generate",
    ]),
  );
  assertApiIsolation(api);
  expect(consoleErrors).toEqual([]);
});

test("a terminal result remains visible when visual review is unavailable", async ({
  page,
}) => {
  const api = await installApiFixtures(page, {
    enableAi: true,
    visualReview: "unavailable",
  });
  await page.goto("/");
  await page.locator("details").last().click();
  await page.locator("details input").fill("White hoodie");
  await page.locator("details button[type=submit]").click();

  const result = page.getByTestId("outfit-result");
  await expect(result).toBeVisible();
  await expect(result).toHaveAttribute(
    "data-generation-state",
    "external_verification_required",
  );
  await expect(page.getByTestId("canonical-result")).toHaveAttribute(
    "data-lifecycle",
    "external_verification_required",
  );
  assertApiIsolation(api);
});

test("seven creative benchmarks require five-view runtime acceptance", async ({
  page, browser,
}) => {
  test.setTimeout(240_000);
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const api = await installApiFixtures(page, {
    enableAi: true,
    visualReview: "ready",
  });
  const capturedEvidence: Array<{
    prompt: string;
    view: string;
    viewport: "desktop" | "mobile";
    path: string;
    generationId?: string;
    itemIds?: string[];
  }> = [];
  const benchmarkResults: Array<{ prompt:string; generationId:string; status:"READY"; defects:string[]; repairs:unknown[] }> = [];

  for (const requestedPrompt of evidenceCases) {
    const prompt = requestedPrompt;
    await page.goto("/");
    await page.locator("details").last().click();
    await page.locator("details input").fill(prompt);
    await page.locator("details button[type=submit]").click();
    await expect(page.getByTestId("outfit-result")).toBeVisible();
    const canonical = page.getByTestId("canonical-result");
    await expect(canonical).toHaveAttribute("data-lifecycle", "complete", { timeout: 30_000 });
    const generationId = await canonical.getAttribute("data-generation-id");
    const itemIds = (await canonical.getAttribute("data-item-ids"))?.split(",").filter(Boolean) ?? [];
    const slug = requestedPrompt
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const preview = page.getByTestId("avatar-preview");
    await expect(preview.locator("canvas")).toBeVisible({ timeout: 20_000 });
    for (const view of evidenceViews) {
      await page.getByTestId(`camera-${view}`).click();
      await page.waitForTimeout(250);
      const path = `${evidenceRoot}/${slug}/desktop-${view}.png`;
      await preview.screenshot({ path });
      capturedEvidence.push({
        prompt: requestedPrompt,
        view: ({ "front-45":"front_45", right:"side", "back-45":"back_45" } as Record<string,string>)[view] ?? view,
        viewport: "desktop",
        path,
        generationId: generationId ?? "missing",
        itemIds,
      });
    }
    benchmarkResults.push({ prompt: requestedPrompt, generationId: generationId ?? "missing", status:"READY", defects:[], repairs:[] });
  }

  const expectedEvidenceCount = evidenceCases.length * evidenceViews.length;
  expect(capturedEvidence).toHaveLength(expectedEvidenceCount);
  await writeFile(
    "test-results/visual-evidence.json",
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        browserVersion: browser.version(),
        requiredViews: ["front", "side", "back", "front_45", "back_45"],
        benchmarkFamilies: evidenceCases,
        benchmarkResults,
        expectedCount: expectedEvidenceCount,
        screenshots: capturedEvidence,
      },
      null,
      2,
    )}\n`,
  );

  assertApiIsolation(api);
  expect(pageErrors, `Page errors: ${pageErrors.join("\n")}`).toEqual([]);
  expect(consoleErrors, `Console errors: ${consoleErrors.join("\n")}`).toEqual(
    [],
  );
});
