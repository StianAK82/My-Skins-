import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

/**
 * Runs against the already-running Vite preview. Playwright-managed Chromium
 * is the portable default; PLAYWRIGHT_CHROMIUM_PATH is an explicit override.
 */
const chromiumOverride = process.env.PLAYWRIGHT_CHROMIUM_PATH?.trim();
if (chromiumOverride && !existsSync(chromiumOverride)) {
  throw new Error(`PLAYWRIGHT_CHROMIUM_PATH does not exist: ${chromiumOverride}`);
}

export default defineConfig({
  testDir: "./visual-tests",
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  outputDir: "test-results/playwright",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4173",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: "dark",
    launchOptions: {
      ...(chromiumOverride ? { executablePath: chromiumOverride } : {}),
      args: [
        "--no-sandbox",
        "--use-gl=angle",
        "--use-angle=swiftshader",
        "--enable-unsafe-swiftshader",
        "--disable-gpu-sandbox",
      ],
    },
  },
});
