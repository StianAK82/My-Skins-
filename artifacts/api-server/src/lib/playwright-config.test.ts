import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const configUrl = pathToFileURL(
  resolve(process.cwd(), "../../playwright.config.ts"),
).href;
const importConfig = (override?: string) =>
  spawnSync(
    process.execPath,
    ["--import", "tsx", "--eval", `import('${configUrl}')`],
    {
      cwd: process.cwd(),
      env: { ...process.env, PLAYWRIGHT_CHROMIUM_PATH: override ?? "" },
      encoding: "utf8",
    },
  );

test("Playwright config uses its managed browser when no override is set", () => {
  const result = importConfig();
  assert.equal(result.status, 0, result.stderr);
});

test("Playwright config rejects an invalid explicit browser override", () => {
  const result = importConfig("/definitely/missing/chromium");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /PLAYWRIGHT_CHROMIUM_PATH does not exist/);
});

test("Playwright base URL and managed web server URL stay aligned", () => {
  const script = `import('${configUrl}').then(m => { const api=m['module.exports'] ?? m.default; const c=api.createPlaywrightConfig({}); const s=Array.isArray(c.webServer)?c.webServer[0]:c.webServer; console.log(JSON.stringify({baseURL:c.use.baseURL,url:s.url,command:s.command,reuse:s.reuseExistingServer,timeout:s.timeout})) })`;
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "--eval", script],
    {
      cwd: process.cwd(),
      env: { ...process.env, CI: "" },
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const config = JSON.parse(result.stdout.trim()) as {
    baseURL: string;
    url: string;
    command: string;
    reuse: boolean;
    timeout: number;
  };
  assert.equal(config.baseURL, "http://127.0.0.1:4173");
  assert.equal(config.url, config.baseURL);
  assert.equal(config.command, "pnpm --filter @workspace/my-skins serve");
  assert.equal(config.reuse, true);
  assert.equal(config.timeout, 120_000);
});

test("Playwright owns a fixed preview server and never reuses it in CI", () => {
  const script = `import('${configUrl}').then(m => { const api=m['module.exports'] ?? m.default; const c=api.createPlaywrightConfig({CI:'true'}); const s=Array.isArray(c.webServer)?c.webServer[0]:c.webServer; console.log(JSON.stringify({reuse:s.reuseExistingServer})) })`;
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "--eval", script],
    {
      cwd: process.cwd(),
      env: { ...process.env, CI: "true" },
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout.trim()), { reuse: false });
});
