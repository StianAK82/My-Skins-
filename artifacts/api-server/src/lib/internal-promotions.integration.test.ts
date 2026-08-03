import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const serviceUrl = new URL("./internal-promotions.ts", import.meta.url);
const migrationUrl = new URL(
  "../../../../lib/db/migrations/0007_internal_promotion_campaigns.sql",
  import.meta.url,
);

test("redemption transaction is serializable and locks the campaign before grants", async () => {
  const source = await readFile(serviceUrl, "utf8");
  assert.match(source, /BEGIN ISOLATION LEVEL SERIALIZABLE/);
  const lock = source.indexOf("FOR UPDATE");
  const grant = source.indexOf("INSERT INTO entitlement_transactions");
  const redemption = source.indexOf(
    "INSERT INTO internal_promotion_redemptions",
  );
  assert.ok(lock > 0 && grant > lock && redemption > grant);
});

test("campaign and per-user limits are evaluated while campaign lock is held", async () => {
  const source = await readFile(serviceUrl, "utf8");
  assert.match(source, /current_redemption_projection\s*>=/);
  assert.match(
    source,
    /count\(\*\)::int count FROM internal_promotion_redemptions/,
  );
});

test("redemption schema prevents idempotency replay and records every ledger id", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /idempotency_key text NOT NULL UNIQUE/);
  assert.match(sql, /ledger_transaction_ids uuid\[\] NOT NULL/);
  assert.match(sql, /current_redemption_projection integer NOT NULL DEFAULT 0/);
});

test("campaigns store only a fixed-size code hash and versioned configuration", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(
    sql,
    /normalized_code_hash text NOT NULL UNIQUE CHECK \(length\(normalized_code_hash\)=64\)/,
  );
  assert.match(sql, /configuration_version integer NOT NULL DEFAULT 1/);
  assert.doesNotMatch(sql, /\bcode text\b/);
});

test("promotion reversal appends ledger reversal rather than updating a balance", async () => {
  const source = await readFile(serviceUrl, "utf8");
  assert.match(source, /'CHARGEBACK_REVERSAL'/);
  assert.doesNotMatch(
    source,
    /UPDATE users SET credits|UPDATE user_profiles SET ai_credits/i,
  );
});
