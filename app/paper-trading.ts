// Shared paper trading logic for both client and server (Cloudflare Worker)
export const BAR_MINUTES = 5;
export const BARS_PER_SESSION = 78;
export const LAST_ENTRY_BAR = 70;
export const PAPER_SESSION_DATE = "2024-01-02";
export const PAPER_STARTING_CASH = 25_000;

export type MarketBar = {
  date: string;
  time: string;
  timestamp: string;
  barInSession: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ema9: number;
  ema21: number;
  ema50: number;
  rsi: number;
  upperBand: number;
  lowerBand: number;
  momentum: number;
  volatility: number;
  vwap: number;
  volumeRatio: number;
  atr: number;
  macd: number;
  macdSignal: number;
  adx: number;
  directionalIndex: number;
  openingHigh: number;
  openingLow: number;
  sessionHighBefore: number;
  sessionLowBefore: number;
  priorHigh: number;
  priorLow: number;
  priorClose: number;
  rollingHigh: number;
  rollingLow: number;
  bandWidthRatio: number;
  rangeExpansion: number;
  closeLocation: number;
  bodyStrength: number;
  obv: number;
  obvSlope: number;
};

export type ModelWeights = {
  trend: number;
  momentum: number;
  meanReversion: number;
  breakout: number;
  volume: number;
  emaFast: number;
  emaMedium: number;
  emaSlow: number;
  atrMult: number;
  maxHoldBars: number;
  rewardRisk: number;
  entryThreshold: number;
  dailyLossLimit: number;
  maxEntriesPerSession: number;
  cooldownBars: number;
  positionSizePct: number;
  stopLossAtrMult: number;
  takeProfitAtrMult: number;
  volumeThreshold: number;
  rsiOverbought: number;
  rsiOversold: number;
  macdThreshold: number;
  adxThreshold: number;
  bollingerThreshold: number;
  obvThreshold: number;
};

export type TradeSide = "BUY" | "SELL" | "SHORT" | "COVER";

export type FillKind = "market" | "limit" | "stop";

export type MarketRegime = "trend" | "range" | "reversal" | "squeeze";

export type StrategyAlgorithm = "ema-crossover" | "macd-momentum" | "rsi-mean-reversion" | "bollinger-breakout" | "volume-surge" | "orb-breakout" | "vwap-reclaim" | "key-level-test" | "ensemble";

export type PaperAccount = {
  cash: number;
  shares: number;
  avgPrice: number;
  positionOpenedAt: number;
  stopPrice: number;
  targetPrice: number;
  entrySetup: string;
  entryFees: number;
  entrySlippage: number;
  entryRisk: number;
  barsHeld: number;
  maxHoldBars: number;
  entriesThisSession: number;
  cooldownBars: number;
  dailyStartEquity: number;
  dailyLocked: boolean;
  currentSession: string;
  pendingEntry: PendingEntry | null;
  orders: PaperOrder[];
  equityHistory: EquityPoint[];
};

export type PendingEntry = {
  side: "LONG" | "SHORT";
  setup: string;
  confidence: number;
  stopAtr: number;
  rewardRisk: number;
  maxHoldBars: number;
  reason: string;
  signalPrice: number;
  signalAtr: number;
  signalTimestamp: string;
  regime: MarketRegime;
  algorithm: StrategyAlgorithm;
};

export type PaperOrder = {
  id: string;
  time: string;
  side: TradeSide;
  shares: number;
  price: number;
  fees: number;
  slippage: number;
  note: string;
};

export type EquityPoint = {
  time: string;
  value: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function finiteNumber(value: unknown, fallback: number): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function random(): number {
  return Math.random();
}

function scoreBar(
  bar: MarketBar,
  weights: ModelWeights,
  forEntry: boolean,
): { score: number; factors: Record<string, number> } {
  const factors: Record<string, number> = {};

  const trendScore =
    (bar.close > bar.ema9 ? 1 : -1) * weights.trend +
    (bar.close > bar.ema21 ? 1 : -1) * weights.trend * 0.5 +
    (bar.close > bar.ema50 ? 1 : -1) * weights.trend * 0.25;
  factors.trend = trendScore;

  const macdHist = bar.macd - bar.macdSignal;
  const momentumScore =
    (bar.momentum > 0 ? 1 : -1) * weights.momentum +
    (macdHist > 0 ? 1 : -1) * weights.momentum * 0.5;
  factors.momentum = momentumScore;

  const rsiPosition = (bar.rsi - 50) / 50;
  const meanReversionScore = -rsiPosition * weights.meanReversion;
  factors.meanReversion = meanReversionScore;

  const breakoutScore =
    (bar.close > bar.upperBand ? 1 : bar.close < bar.lowerBand ? -1 : 0) * weights.breakout;
  factors.breakout = breakoutScore;

  const volumeScore =
    (bar.volumeRatio > weights.volumeThreshold ? 1 : 0) * weights.volume;
  factors.volume = volumeScore;

  const score = trendScore + momentumScore + meanReversionScore + breakoutScore + volumeScore;
  return { score, factors };
}

function intradayEntryThreshold(weights: ModelWeights): number {
  return weights.entryThreshold;
}

function entryRiskPlan(
  signal: PendingEntry,
  cash: number,
  open: number,
): { stopDistance: number; riskBudget: number; allocation: number } {
  const stopDistance = signal.stopAtr * open * 0.01;
  const riskBudget = cash * 0.005;
  const allocation = cash * (signal.confidence / 100) * 0.97;
  return { stopDistance, riskBudget, allocation };
}

function executionFill(
  bar: MarketBar,
  side: TradeSide,
  price: number,
  quantity: number,
): { price: number; fees: number; slippage: number } {
  const spread = (bar.high - bar.low) * 0.01;
  const slippage = spread * 0.5 * (side === "BUY" ? 1 : -1);
  const fillPrice = price + slippage;
  const notional = quantity * fillPrice;
  const fees = notional * 0.0005 + 0.01;
  return { price: fillPrice, fees, slippage: Math.abs(slippage) };
}

// PAPER_STREAM - simplified for server-side (in production, fetch from KV or compute)
const PAPER_STREAM_CACHE: MarketBar[] | null = null;

export function getPaperStream(): MarketBar[] {
  if (PAPER_STREAM_CACHE) return PAPER_STREAM_CACHE;
  // In production, this would load from MARKET_DATA or KV
  // For now, return empty - the server would need the data
  return [];
}

export function advancePaperAccount(
  account: PaperAccount,
  bar: MarketBar,
  weights: ModelWeights,
): PaperAccount {
  let next: PaperAccount = { ...account };
  const newSession = next.currentSession !== bar.date;
  if (newSession) {
    next = {
      ...next,
      currentSession: bar.date,
      entriesThisSession: 0,
      cooldownBars: 0,
      dailyStartEquity: next.cash + next.shares * bar.open,
      dailyLocked: false,
      pendingEntry: null,
    };
  } else if (next.cooldownBars > 0) {
    next.cooldownBars -= 1;
  }

  if (next.pendingEntry && next.pendingEntry.signalTimestamp.slice(0, 10) !== bar.date) {
    next.pendingEntry = null;
  }

  if (next.pendingEntry && next.shares === 0 && bar.barInSession <= LAST_ENTRY_BAR) {
    const signal = next.pendingEntry;
    const { stopDistance, riskBudget, allocation } = entryRiskPlan(signal, next.cash, bar.open);
    const provisionalQuantity = Math.floor(Math.min(allocation / bar.open, riskBudget / stopDistance));
    if (provisionalQuantity > 0) {
      const side: TradeSide = signal.side === "LONG" ? "BUY" : "SHORT";
      const provisionalFill = executionFill(bar, side, bar.open, provisionalQuantity);
      const quantity = Math.floor(Math.min(allocation / provisionalFill.price, riskBudget / stopDistance));
      if (quantity > 0) {
        const fill = executionFill(bar, side, bar.open, quantity);
        const notional = quantity * fill.price;
        const cashChange = signal.side === "LONG" ? -(notional + fill.fees) : notional - fill.fees;
        if (signal.side === "SHORT" || next.cash + cashChange >= 0) {
          next = {
            ...next,
            cash: next.cash + cashChange,
            shares: signal.side === "LONG" ? quantity : -quantity,
            avgPrice: fill.price,
            positionOpenedAt: Date.now(),
            stopPrice: signal.side === "LONG" ? fill.price - stopDistance : fill.price + stopDistance,
            targetPrice: signal.side === "LONG"
              ? fill.price + stopDistance * signal.rewardRisk
              : fill.price - stopDistance * signal.rewardRisk,
            entrySetup: signal.setup,
            entryFees: fill.fees,
            entrySlippage: fill.slippage,
            entryRisk: stopDistance,
            barsHeld: 0,
            maxHoldBars: signal.maxHoldBars,
            entriesThisSession: next.entriesThisSession + 1,
            orders: [{
              id: `paper-${side.toLowerCase()}-${bar.timestamp}-${next.orders.length}`,
              time: `${bar.date} ${bar.time} ET`,
              side,
              shares: quantity,
              price: fill.price,
              fees: fill.fees,
              slippage: fill.slippage,
              note: signal.reason,
            }, ...next.orders],
          };
        }
      }
    }
    next.pendingEntry = null;
  }

  const scored = scoreBar(bar, weights, true);
  const threshold = intradayEntryThreshold(weights);
  const sessionClose = bar.barInSession === BARS_PER_SESSION - 1;
  const heldBars = next.shares === 0 ? 0 : next.barsHeld;
  let exitReason = "";
  let exitReference = 0;
  let exitKind: FillKind = "market";

  if (next.shares > 0) {
    if (bar.low <= next.stopPrice) {
      exitReason = next.stopPrice >= next.avgPrice ? "Protected stop" : "ATR risk stop";
      exitReference = Math.min(next.stopPrice, bar.open);
      exitKind = "stop";
    } else if (bar.high >= next.targetPrice) {
      exitReason = "Risk / reward target";
      exitReference = next.targetPrice;
      exitKind = "limit";
    } else if (sessionClose) {
      exitReason = "Closing bell";
      exitReference = bar.close;
    } else if (heldBars >= next.maxHoldBars) {
      exitReason = "Max hold reached";
      exitReference = bar.close;
    }
  } else if (next.shares < 0) {
    if (bar.high >= next.stopPrice) {
      exitReason = next.stopPrice <= next.avgPrice ? "Protected stop" : "ATR risk stop";
      exitReference = Math.max(next.stopPrice, bar.open);
      exitKind = "stop";
    } else if (bar.low <= next.targetPrice) {
      exitReason = "Risk / reward target";
      exitReference = next.targetPrice;
      exitKind = "limit";
    } else if (sessionClose) {
      exitReason = "Closing bell";
      exitReference = bar.close;
    } else if (heldBars >= next.maxHoldBars) {
      exitReason = "Max hold reached";
      exitReference = bar.close;
    }
  }

  if (exitReason) {
    const side: TradeSide = next.shares > 0 ? "SELL" : "BUY";
    const fill = executionFill(bar, side, exitReference, Math.abs(next.shares));
    const notional = Math.abs(next.shares) * fill.price;
    const cashChange = next.shares > 0 ? notional - fill.fees : -(notional + fill.fees);
    next = {
      ...next,
      cash: next.cash + cashChange,
      shares: 0,
      avgPrice: 0,
      positionOpenedAt: 0,
      stopPrice: 0,
      targetPrice: 0,
      entrySetup: "",
      entryFees: 0,
      entrySlippage: 0,
      entryRisk: 0,
      barsHeld: 0,
      maxHoldBars: 0,
      cooldownBars: 3,
      orders: [{
        id: `paper-${side.toLowerCase()}-${bar.timestamp}-${next.orders.length}`,
        time: `${bar.date} ${bar.time} ET`,
        side,
        shares: Math.abs(next.shares),
        price: fill.price,
        fees: fill.fees,
        slippage: fill.slippage,
        note: exitReason,
      }, ...next.orders],
    };
  } else if (next.shares !== 0) {
    next.barsHeld += 1;
  }

  if (!sessionClose && next.shares === 0 && next.entriesThisSession < 14 && next.cooldownBars === 0 && !next.dailyLocked) {
    const regime = detectRegime(bar);
    const signal = generateSignal(bar, weights, regime);
    if (signal && scored.score >= threshold) {
      next.pendingEntry = signal;
    }
  }

  next.equityHistory = [
    ...next.equityHistory,
    { time: bar.timestamp, value: next.cash + next.shares * bar.close },
  ].slice(-160);

  return next;
}

function detectRegime(bar: MarketBar): MarketRegime {
  const adx = bar.adx;
  const bandWidth = bar.bandWidthRatio;
  const trendStrength = Math.abs(bar.close - bar.ema50) / bar.ema50;

  if (adx > 25 && trendStrength > 0.02) return "trend";
  if (bandWidth < 0.05) return "squeeze";
  if (adx < 20 && trendStrength < 0.01) return "range";
  return "reversal";
}

function generateSignal(
  bar: MarketBar,
  weights: ModelWeights,
  regime: MarketRegime,
): PendingEntry | null {
  const scoreResult = scoreBar(bar, weights, true);
  if (scoreResult.score < weights.entryThreshold) return null;

  const side: "LONG" | "SHORT" = scoreResult.score > 0 ? "LONG" : "SHORT";
  const setup = `${regime}-${side.toLowerCase()}`;

  return {
    side,
    setup,
    confidence: Math.min(95, Math.abs(scoreResult.score) * 10 + 50),
    stopAtr: weights.atrMult,
    rewardRisk: weights.rewardRisk,
    maxHoldBars: weights.maxHoldBars,
    reason: `${regime} ${side} signal`,
    signalPrice: bar.close,
    signalAtr: bar.atr,
    signalTimestamp: bar.timestamp,
    regime,
    algorithm: "ensemble",
  };
}

export function createInitialPaper(startingCash = PAPER_STARTING_CASH): PaperAccount {
  return {
    cash: startingCash,
    shares: 0,
    avgPrice: 0,
    positionOpenedAt: 0,
    stopPrice: 0,
    targetPrice: 0,
    entrySetup: "",
    entryFees: 0,
    entrySlippage: 0,
    entryRisk: 0,
    barsHeld: 0,
    maxHoldBars: 0,
    entriesThisSession: 0,
    cooldownBars: 0,
    dailyStartEquity: startingCash,
    dailyLocked: false,
    currentSession: "",
    pendingEntry: null,
    orders: [],
    equityHistory: [],
  };
}
