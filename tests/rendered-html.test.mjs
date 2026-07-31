import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("builds the complete Signal Forge application", async () => {
  await access(new URL("../dist/server/index.js", import.meta.url));

  const [page, layout, styles] = await Promise.all([
    source("app/page.tsx"),
    source("app/layout.tsx"),
    source("app/globals.css"),
  ]);

  assert.match(layout, /Persistent Trading Research Lab/);
  assert.match(page, /Forge Policy v3/);
  assert.match(page, /HINDSIGHT TEACHER/);
  assert.match(page, /Unseen holdout/);
  assert.match(page, /Portfolio history/);
  assert.match(page, /Switch to.*mode/);
  assert.match(page, /Five-minute multi-strategy ensemble/);
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
  assert.match(page, /Mean reversion/);
  assert.match(page, /Volume breakout/);
  assert.match(page, /EMA 9 \/ 21 \/ 50/);
  assert.match(page, /OBV flow/);
  assert.match(page, /ATR risk stop/);
  assert.match(page, /positiveWeekRate/);
  assert.match(page, /function migrateModel/);
  assert.match(page, /minLength=\{8\}/);
  assert.match(page, /8\+ characters/);
  assert.match(page, /\[A-Za-z0-9\]\(\?:\[A-Za-z0-9_\]\|-\)\{2,23\}/);
  assert.match(page, /setTheme\("light"\)/);
  assert.match(layout, /data-theme="light"/);
  assert.match(layout, /og-liquid\.png/);
  assert.doesNotMatch(layout, /next\/font/);
  assert.match(styles, /light-first liquid glass/);
  assert.match(styles, /backdrop-filter: blur\(28px\) saturate\(165%\)/);
  assert.doesNotMatch(page, /SkeletonPreview/);
});

test("includes durable per-user checkpoint storage", async () => {
  const [route, schema, hosting, migration, auth, database] = await Promise.all([
    source("app/api/state/route.ts"),
    source("db/schema.ts"),
    source(".openai/hosting.json"),
    source("drizzle/0001_lethal_morlocks.sql"),
    source("app/account-auth.ts"),
    source("db/index.ts"),
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
  assert.match(auth, /PASSWORD_ITERATIONS = 100_000/);
  assert.match(auth, /rejects PBKDF2 counts above 100,000/);
  assert.match(auth, /password.length < 8/);
  assert.match(auth, /HttpOnly; SameSite=Strict/);
  assert.match(auth, /authRateLimited/);
  assert.match(database, /ensureAccountSchema/);
  assert.match(database, /CREATE TABLE IF NOT EXISTS accounts/);
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
  assert.match(page, /const MAX_ENTRIES_PER_SESSION = 14/);
  assert.match(page, /const RISK_PER_TRADE_FRACTION = 0\.005/);
  assert.match(page, /const DAILY_LOSS_LIMIT_FRACTION = 0\.02/);
  assert.match(page, /function pendingEntryForBar/);
  assert.match(page, /function entryRiskPlan/);
  assert.match(page, /function executionFill/);
  assert.match(page, /function advancePaperAccount/);
  assert.match(page, /advancePaperAccount\(account, bar, model\)/);
  assert.match(page, /pendingEntry\.signalTimestamp/);
  assert.match(page, /const SEC_FEE_RATE = 20\.6/);
  assert.match(page, /const FINRA_TAF_PER_SHARE = 0\.000195/);
  assert.match(page, /totalSlippage/);
  assert.match(page, /pnl < 0 \? LOSS_COOLDOWN_BARS : 0/);
  assert.doesNotMatch(page, /window\.localStorage/);
});
