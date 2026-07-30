import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";

test("production database import fails with a typed configuration error", () => {
  const result = spawnSync(process.execPath, ["--import", "tsx", "--eval", "import('@workspace/db')"], {
    cwd: process.cwd(), env: { ...process.env, DATABASE_URL: "" }, encoding: "utf8",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /DatabaseConfigurationError/);
  assert.match(result.stderr, /DATABASE_URL must be set/);
});
