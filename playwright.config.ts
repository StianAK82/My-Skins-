import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

/**
 * Runs against the already-running Vite preview. Playwright-managed Chromium
 * is the portable default; PLAYWRIGHT_CHROMIUM_PATH is an explicit override.
 */
export const PLAYWRIGHT_PREVIEW_URL = "http://127.0.0.1:4173";
export const PLAYWRIGHT_PREVIEW_COMMAND =
  "pnpm --filter @workspace/my-skins serve";

export function createPlaywrightConfig(
  environment: NodeJS.ProcessEnv = process.env,
) {
  const chromiumOverride = environment.PLAYWRIGHT_CHROMIUM_PATH?.trim();
  if (chromiumOverride && !existsSync(chromiumOverride)) {
    throw new Error(
      `PLAYWRIGHT_CHROMIUM_PATH does not exist: ${chromiumOverride}`,
    );
  }

  return defineConfig({
    testDir: "./visual-tests",
    timeout: 60_000,
    fullyParallel: false,
    retries: 0,
    reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
    outputDir: "test-results/playwright",
    webServer: {
      command: PLAYWRIGHT_PREVIEW_COMMAND,
      url: PLAYWRIGHT_PREVIEW_URL,
      reuseExistingServer: !environment.CI,
      timeout: 120_000,
    },
    use: {
      baseURL: environment.PLAYWRIGHT_BASE_URL ?? PLAYWRIGHT_PREVIEW_URL,
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1,
      colorScheme: "dark",
      trace: "retain-on-failure",
      screenshot: "only-on-failure",
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
}

export default createPlaywrightConfig();
