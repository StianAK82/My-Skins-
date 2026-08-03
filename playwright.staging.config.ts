import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./visual-tests",
  testMatch: "staging-provider.spec.ts",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    viewport: { width: 1440, height: 900 },
    colorScheme: "dark",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
