import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("builds the complete Signal Forge application", async () => {
  await access(new URL("../dist/server/index.js", import.meta.url));

  const [page, layout] = await Promise.all([
    source("app/page.tsx"),
    source("app/layout.tsx"),
  ]);

  assert.match(layout, /Persistent Trading Research Lab/);
  assert.match(page, /Forge Policy v2/);
  assert.match(page, /HINDSIGHT TEACHER/);
  assert.match(page, /Unseen holdout/);
  assert.match(page, /Portfolio history/);
  assert.match(page, /Switch to.*mode/);
  assert.match(page, /30-minute ensemble/);
  assert.match(page, /flat by 4:00 PM/i);
  assert.match(page, /intradayEntryThreshold/);
  assert.match(page, /tradesPerDay/);
  assert.match(page, /Backtest sections/);
  assert.match(page, /Training sections/);
  assert.match(page, /Portfolio sections/);
  assert.match(page, /Opening range breakout/);
  assert.match(page, /VWAP \/ EMA pullback/);
  assert.match(page, /Bollinger squeeze/);
  assert.match(page, /ATR risk stop/);
  assert.match(page, /positiveWeekRate/);
  assert.match(page, /function migrateModel/);
  assert.doesNotMatch(page, /SkeletonPreview/);
});

test("includes durable per-user checkpoint storage", async () => {
  const [route, schema, hosting, migration] = await Promise.all([
    source("app/api/state/route.ts"),
    source("db/schema.ts"),
    source(".openai/hosting.json"),
    source("drizzle/0000_good_johnny_storm.sql"),
  ]);

  assert.match(hosting, /"d1": "DB"/);
  assert.match(schema, /tradingStates/);
  assert.match(schema, /userEmail/);
  assert.match(route, /getChatGPTUser/);
  assert.match(route, /onConflictDoUpdate/);
  assert.match(route, /MAX_STATE_BYTES/);
  assert.match(migration, /CREATE TABLE `trading_states`/);
});

test("keeps future-aware labels out of the live policy", async () => {
  const page = await source("app/page.tsx");

  assert.match(page, /function oracleAction/);
  assert.match(page, /function teacherSeedModel/);
  assert.match(page, /function splitForTraining/);
  assert.match(page, /function policyAction/);
  assert.match(page, /Hindsight labels are training-only/);
  assert.match(page, /A weaker run can never replace it/);
});
