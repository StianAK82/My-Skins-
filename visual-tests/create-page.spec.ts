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

const evidenceCases = [
  ...workflowFixtures.map(([prompt]) => prompt),
  "Wings-only revision",
] as const;
const evidenceViews = [
  "front",
  "front-45",
  "right",
  "back",
  "back-45",
  "left",
] as const;
const evidenceRoot = "test-results/screenshots/representative";

type ApiFixtureState = {
  requested: string[];
  unexpected: string[];
  proxyLeaks: string[];
};

async function installApiFixtures(
  page: Page,
  enableAi = false,
): Promise<ApiFixtureState> {
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
    if (path === "/api/auth/roblox/me") {
      await route.fulfill({ json: { loggedIn: false, configured: false } });
      return;
    }
    if (enableAi && path === "/api/ai/generate") {
      const body = request.postDataJSON() as {
        prompt: string;
        previousOutfit?: typeof baseOutfit;
      };
      const fixture = workflowFixtures.find(
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
            status: "completed",
            warnings: [],
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
          lifecycle: "complete",
        },
      });
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
  const api = await installApiFixtures(page, true);

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

test("representative outfits produce six-view desktop and core mobile evidence", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  const api = await installApiFixtures(page, true);
  const capturedEvidence: Array<{
    prompt: string;
    view: string;
    viewport: "desktop" | "mobile";
    path: string;
  }> = [];

  for (const [caseIndex, requestedPrompt] of evidenceCases.entries()) {
    const prompt =
      requestedPrompt === "Wings-only revision"
        ? "Backpack and large white angel wings"
        : requestedPrompt;
    await page.goto("/");
    await page.locator("details").last().click();
    await page.locator("details input").fill(prompt);
    await page.locator("details button[type=submit]").click();
    await expect(page.getByTestId("outfit-result")).toBeVisible();
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
        view,
        viewport: "desktop",
        path,
      });
    }
    if (caseIndex < 4) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByTestId("camera-front").click();
      const path = `${evidenceRoot}/${slug}/mobile-front.png`;
      await preview.screenshot({ path });
      capturedEvidence.push({
        prompt: requestedPrompt,
        view: "front",
        viewport: "mobile",
        path,
      });
      await page.setViewportSize({ width: 1440, height: 900 });
    }
  }

  const expectedEvidenceCount = evidenceCases.length * evidenceViews.length + 4;
  expect(capturedEvidence).toHaveLength(expectedEvidenceCount);
  await writeFile(
    "test-results/visual-evidence.json",
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
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
