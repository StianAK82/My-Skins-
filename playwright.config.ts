import { defineConfig } from "@playwright/test";

/**
 * Runs against the already-running dev workflows (my-skins web on the
 * platform proxy at 127.0.0.1:80). Uses the Nix-provided Chromium with
 * SwiftShader so the Three.js WebGL canvas renders in headless mode.
 */
const NIX_CHROMIUM =
  process.env.PLAYWRIGHT_CHROMIUM_PATH ??
  "/nix/store/m7qi78k6711fpwnrm4r2kn4p3ga3jal9-ungoogled-chromium-123.0.6312.105/bin/chromium";

export default defineConfig({
  testDir: "./visual-tests",
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  outputDir: "test-results/playwright",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:80",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    colorScheme: "dark",
    launchOptions: {
      executablePath: NIX_CHROMIUM,
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
