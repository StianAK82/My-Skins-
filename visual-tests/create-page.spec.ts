import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";

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
