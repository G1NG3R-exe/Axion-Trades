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
  assert.match(page, /Five-minute ensemble/);
  assert.match(page, /flat by 4:00 PM/i);
  assert.match(page, /intradayEntryThreshold/);
  assert.match(page, /tradesPerDay/);
  assert.match(page, /Backtest sections/);
  assert.match(page, /Training sections/);
  assert.match(page, /Portfolio sections/);
  assert.match(page, /SYSTEM GUIDE/);
  assert.match(page, /Live mode is intentionally empty/);
  assert.match(page, /Create private workspace/);
  assert.match(page, /Opening range breakout/);
  assert.match(page, /VWAP \/ EMA pullback/);
  assert.match(page, /Bollinger squeeze/);
  assert.match(page, /ATR risk stop/);
  assert.match(page, /positiveWeekRate/);
  assert.match(page, /function migrateModel/);
  assert.doesNotMatch(page, /SkeletonPreview/);
});

test("includes durable per-user checkpoint storage", async () => {
  const [route, schema, hosting, migration, auth] = await Promise.all([
    source("app/api/state/route.ts"),
    source("db/schema.ts"),
    source(".openai/hosting.json"),
    source("drizzle/0001_lethal_morlocks.sql"),
    source("app/account-auth.ts"),
  ]);

  assert.match(hosting, /"d1": "DB"/);
  assert.match(schema, /accounts/);
  assert.match(schema, /accountSessions/);
  assert.match(schema, /accountStates/);
  assert.match(route, /getAccountSession/);
  assert.match(route, /account_states/);
  assert.match(route, /MAX_STATE_BYTES/);
  assert.match(migration, /CREATE TABLE `accounts`/);
  assert.match(migration, /CREATE TABLE `account_sessions`/);
  assert.match(migration, /CREATE TABLE `account_states`/);
  assert.match(auth, /PASSWORD_ITERATIONS = 600_000/);
  assert.match(auth, /HttpOnly; SameSite=Strict/);
  assert.match(auth, /authRateLimited/);
});

test("keeps future-aware labels out of the live policy", async () => {
  const page = await source("app/page.tsx");

  assert.match(page, /function oracleAction/);
  assert.match(page, /function teacherSeedModel/);
  assert.match(page, /function splitForTraining/);
  assert.match(page, /function policyAction/);
  assert.match(page, /Hindsight labels are training-only/);
  assert.match(page, /A weaker run can never replace it/);
  assert.match(page, /const TRAINING_START = "2023-01-02"/);
  assert.match(page, /const BACKTEST_MIN = "2024-01-02"/);
  assert.match(page, /evaluateModel\(TRAINING_DATA/);
});

test("uses one realistic five-minute executor for backtest and paper", async () => {
  const page = await source("app/page.tsx");

  assert.match(page, /const BAR_MINUTES = 5/);
  assert.match(page, /const BARS_PER_SESSION = 78/);
  assert.match(page, /function pendingEntryForBar/);
  assert.match(page, /function executionFill/);
  assert.match(page, /function advancePaperAccount/);
  assert.match(page, /advancePaperAccount\(account, bar, model\)/);
  assert.match(page, /pendingEntry\.signalTimestamp/);
  assert.match(page, /const SEC_FEE_RATE = 20\.6/);
  assert.match(page, /const FINRA_TAF_PER_SHARE = 0\.000195/);
  assert.match(page, /totalSlippage/);
  assert.doesNotMatch(page, /window\.localStorage/);
});
