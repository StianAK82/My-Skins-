import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const configUrl = pathToFileURL(resolve(process.cwd(), "../../playwright.config.ts")).href;
const importConfig = (override?: string) => spawnSync(
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
