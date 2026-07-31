import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";

const root = new URL("../", import.meta.url);

async function loadEngine() {
  const page = await readFile(new URL("app/page.tsx", root), "utf8");
  const start = page.indexOf("type MarketBar =");
  const end = page.indexOf("function dateLabel");
  assert.ok(start >= 0 && end > start, "strategy source should be extractable without React UI code");

  const source = `${page.slice(start, end)}
globalThis.__signalForgeEngine = {
  INITIAL_MODEL,
  INITIAL_PAPER,
  createInitialPaper,
  MARKET_DATA,
  PAPER_STREAM,
  PAPER_STARTING_CASH,
  MAX_ENTRIES_PER_SESSION,
  RISK_PER_TRADE_FRACTION,
  DAILY_LOSS_LIMIT_FRACTION,
  scoreBar,
  runBacktest,
  advancePaperAccount,
  teacherAgreement,
  evaluateModel,
  teacherSeedModel,
};`;
  const javascript = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.None,
    },
  }).outputText;
  const context = {};
  vm.runInNewContext(javascript, context, { filename: "signal-forge-engine.js" });
  return context.__signalForgeEngine;
}

const engine = await loadEngine();
export { engine };

test("aggressive policy trades frequently without crossing its daily entry ceiling", () => {
  const sample = engine.MARKET_DATA.filter(
    (bar) => bar.date >= "2024-01-02" && bar.date <= "2024-03-29",
  );
  const result = engine.runBacktest(sample, engine.INITIAL_MODEL);

  assert.ok(result.tradesPerDay >= 6, `expected at least 6 completed trades per day, got ${result.tradesPerDay}`);
  assert.ok(result.tradesPerDay <= engine.MAX_ENTRIES_PER_SESSION);
  assert.ok(Number.isFinite(result.strategyReturn));
  assert.ok(Number.isFinite(result.maxDrawdown));
  assert.ok(result.totalFees >= 0);
  assert.ok(result.totalSlippage >= 0);
});

test("paper replay and backtest remain the same five-minute executor", () => {
  const session = engine.PAPER_STREAM;
  const backtest = engine.runBacktest(session, engine.INITIAL_MODEL, engine.PAPER_STARTING_CASH);
  let paper = { ...engine.INITIAL_PAPER, orders: [], equityHistory: [] };
  for (const bar of session) paper = engine.advancePaperAccount(paper, bar, engine.INITIAL_MODEL);
  const paperFinal = paper.cash + paper.shares * session.at(-1).close;

  assert.ok(Math.abs(paperFinal - backtest.finalValue) < 1e-7, `${paperFinal} !== ${backtest.finalValue}`);
  assert.ok(paper.entriesThisSession <= engine.MAX_ENTRIES_PER_SESSION);
});

test("custom paper balances preserve executor parity", () => {
  const startingCash = 1_000;
  const session = engine.PAPER_STREAM;
  const backtest = engine.runBacktest(session, engine.INITIAL_MODEL, startingCash);
  let paper = engine.createInitialPaper(startingCash);
  for (const bar of session) paper = engine.advancePaperAccount(paper, bar, engine.INITIAL_MODEL);
  const paperFinal = paper.cash + paper.shares * session.at(-1).close;

  assert.equal(paper.dailyStartEquity > 0, true);
  assert.ok(Math.abs(paperFinal - backtest.finalValue) < 1e-7, `${paperFinal} !== ${backtest.finalValue}`);
});

test("risk and teacher controls remain bounded", () => {
  const training = engine.MARKET_DATA.filter((bar) => bar.date >= "2023-01-02" && bar.date <= "2023-12-29");
  const agreement = engine.teacherAgreement(training, engine.INITIAL_MODEL);

  assert.equal(engine.RISK_PER_TRADE_FRACTION, 0.005);
  assert.equal(engine.DAILY_LOSS_LIMIT_FRACTION, 0.02);
  assert.ok(agreement >= 0 && agreement <= 1);
});
