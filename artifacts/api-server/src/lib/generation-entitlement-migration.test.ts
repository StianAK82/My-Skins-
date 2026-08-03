import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../../../lib/db/migrations/0006_generation_entitlement_ledger.sql",
  import.meta.url,
);

test("ledger migration enforces append-only accounting and free-first uniqueness", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /entitlement_one_free_first_per_user/);
  assert.match(sql, /idempotency_key text NOT NULL UNIQUE/);
  assert.match(sql, /BEFORE UPDATE OR DELETE ON entitlement_transactions/);
});

test("reservation migration enforces one request, generation and finalization", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /generation_id text NOT NULL UNIQUE/);
  assert.match(sql, /generation_request_once_per_user/);
  assert.match(sql, /finalization_transaction_id uuid UNIQUE/);
  assert.match(sql, /status='ACTIVE' AND finalization_transaction_id IS NULL/);
});

test("durable replay projection has mutually exclusive terminal payloads", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /CREATE TABLE generation_request_results/);
  assert.match(sql, /state IN \('IN_PROGRESS','COMPLETED','FAILED'\)/);
  assert.match(sql, /state='COMPLETED' AND response IS NOT NULL AND safe_error IS NULL/);
  assert.match(sql, /state='FAILED' AND response IS NULL AND safe_error IS NOT NULL/);
});
