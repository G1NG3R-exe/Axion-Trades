"use client";

import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BookOpenCheck,
  BrainCircuit,
  BriefcaseBusiness,
  CalendarRange,
  Check,
  Cloud,
  CloudOff,
  Clock3,
  Cpu,
  Database,
  Gauge,
  GraduationCap,
  History,
  Info,
  Layers3,
  Moon,
  Pause,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  Save,
  ShieldCheck,
  Sun,
  Target,
  Trophy,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type MarketBar = {
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
  rsi: number;
  upperBand: number;
  lowerBand: number;
  momentum: number;
  volatility: number;
  vwap: number;
  volumeRatio: number;
};

type ModelWeights = {
  trend: number;
  rsi: number;
  momentum: number;
  volatility: number;
  vwap: number;
  volume: number;
  threshold: number;
};

type Position = "LONG" | "SHORT" | "FLAT";

type Trade = {
  id: string;
  date: string;
  time: string;
  timestamp: string;
  side: "BUY" | "SELL" | "SHORT" | "COVER";
  price: number;
  shares: number;
  value: number;
  pnl: number | null;
  confidence: number;
  reason: string;
};

type BacktestResult = {
  finalValue: number;
  strategyReturn: number;
  buyHoldReturn: number;
  alpha: number;
  maxDrawdown: number;
  sharpe: number;
  winRate: number;
  trades: Trade[];
  equity: number[];
  buyHoldEquity: number[];
  scores: number[];
  signal: "BUY" | "HOLD" | "SHORT";
  confidence: number;
  longEntries: number;
  shortEntries: number;
  roundTrips: number;
  tradesPerDay: number;
  averageHoldBars: number;
};

type PaperOrder = {
  id: string;
  time: string;
  side: "BUY" | "SELL" | "SHORT" | "COVER";
  shares: number;
  price: number;
  note: string;
};

type PaperAccount = {
  cash: number;
  shares: number;
  avgPrice: number;
  positionOpenedAt: number;
  realized: number;
  orders: PaperOrder[];
  equityHistory: Array<{ time: string; value: number }>;
};

type TrainingRun = {
  id: string;
  completedAt: string;
  range: { start: string; end: string };
  epochs: number;
  improved: boolean;
  validationReturn: number;
  validationAlpha: number;
  validationDrawdown: number;
  teacherAgreement: number;
  objectiveDelta: number;
};

type PersistedLabState = {
  version: 3;
  model: ModelWeights;
  trainingEpoch: number;
  trainingRuns: TrainingRun[];
  paper: PaperAccount;
  range: { start: string; end: string };
};

const STARTING_CAPITAL = 10_000;
const PAPER_STARTING_CASH = 25_000;
const DATA_START = "2020-01-02";
const DATA_END = "2026-07-29";
const DEFAULT_START = "2024-01-02";
const DEFAULT_END = "2025-12-31";
const STATE_VERSION = 3;

const INITIAL_MODEL: ModelWeights = {
  trend: 0.29,
  rsi: 0.14,
  momentum: 0.23,
  volatility: 0.08,
  vwap: 0.17,
  volume: 0.09,
  threshold: 0.19,
};

const INITIAL_PAPER: PaperAccount = {
  cash: PAPER_STARTING_CASH,
  shares: 0,
  avgPrice: 0,
  positionOpenedAt: 0,
  realized: 0,
  orders: [],
  equityHistory: [],
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const money = (value: number, digits = 0) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);

const percent = (value: number, digits = 1) =>
  `${value >= 0 ? "+" : ""}${(value * 100).toFixed(digits)}%`;

const compact = (value: number) =>
  new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);

const seededRandom = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};


function generateMarketData(): MarketBar[] {
  const random = seededRandom(7241994);
  const raw: Omit<
    MarketBar,
    "ema9" | "ema21" | "rsi" | "upperBand" | "lowerBand" | "momentum" | "volatility" | "vwap" | "volumeRatio"
  >[] = [];
  const cursor = new Date(`${DATA_START}T12:00:00Z`);
  const lastDate = new Date(`${DATA_END}T12:00:00Z`);
  let previousClose = 73.41;
  let session = 0;

  while (cursor <= lastDate) {
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      const sessionDate = cursor.toISOString().slice(0, 10);
      const trendRegime = Math.sin(session / 58) > -0.18 ? 0.0009 : -0.00115;
      const longDrift = 0.0003 + 0.00022 * Math.sin(session / 210);
      const pulse = 0.0012 * Math.sin(session / 17) + 0.00065 * Math.sin(session / 41);
      let sessionReturn = longDrift + trendRegime + pulse + (random() - 0.5) * 0.021;
      if (session % 233 === 0 && session > 0) sessionReturn -= 0.045;
      if (session % 311 === 0 && session > 0) sessionReturn += 0.038;

      const gap = (random() - 0.5) * 0.008;
      const sessionOpen = previousClose * (1 + gap);
      let intradayPrice = sessionOpen;

      for (let barInSession = 0; barInSession < 13; barInSession += 1) {
        const totalMinutes = 570 + barInSession * 30;
        const hour = Math.floor(totalMinutes / 60);
        const minute = totalMinutes % 60;
        const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
        const open = intradayPrice;
        const progress = barInSession / 12;
        const openingPulse = barInSession < 2 ? (random() - 0.5) * 0.0042 : 0;
        const closingPulse = barInSession > 10 ? (random() - 0.5) * 0.0032 : 0;
        const microWave = Math.sin(session * 0.7 + barInSession * 1.35) * 0.00105;
        const microNoise = (random() - 0.5) * (0.0052 - Math.min(progress, 1 - progress) * 0.0018);
        const meanReversion = ((sessionOpen - open) / sessionOpen) * 0.045;
        const barReturn = sessionReturn / 13 + openingPulse + closingPulse + microWave + microNoise + meanReversion;
        const close = Math.max(18, open * (1 + barReturn));
        const range = 0.0012 + random() * 0.0031;
        const high = Math.max(open, close) * (1 + range * (0.35 + random() * 0.6));
        const low = Math.min(open, close) * (1 - range * (0.35 + random() * 0.6));
        const uShape = Math.pow(Math.abs(progress - 0.5) * 2, 1.5);
        const volume = Math.round(
          1_900_000 * (0.82 + uShape * 2.1) * (0.72 + random() * 0.72) * (1 + Math.abs(barReturn) * 42),
        );

        raw.push({
          date: sessionDate,
          time,
          timestamp: `${sessionDate}-${time}`,
          barInSession,
          open,
          high,
          low,
          close,
          volume,
        });
        intradayPrice = close;
      }

      previousClose = intradayPrice;
      session += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const closes = raw.map((bar) => bar.close);
  const returns = closes.map((close, index) => index === 0 ? 0 : close / closes[index - 1] - 1);
  let fast = closes[0];
  let slow = closes[0];
  let avgGain = 0;
  let avgLoss = 0;
  let activeSession = "";
  let cumulativeTypicalVolume = 0;
  let cumulativeVolume = 0;

  return raw.map((bar, index) => {
    fast = index === 0 ? bar.close : bar.close * 0.2 + fast * 0.8;
    slow = index === 0 ? bar.close : bar.close * (2 / 22) + slow * (20 / 22);
    const change = index === 0 ? 0 : bar.close - closes[index - 1];
    const gain = Math.max(0, change);
    const loss = Math.max(0, -change);
    if (index < 14) {
      avgGain = (avgGain * index + gain) / (index + 1);
      avgLoss = (avgLoss * index + loss) / (index + 1);
    } else {
      avgGain = (avgGain * 13 + gain) / 14;
      avgLoss = (avgLoss * 13 + loss) / 14;
    }
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);

    const bandWindow = closes.slice(Math.max(0, index - 19), index + 1);
    const mean = bandWindow.reduce((sum, value) => sum + value, 0) / bandWindow.length;
    const deviation = Math.sqrt(
      bandWindow.reduce((sum, value) => sum + (value - mean) ** 2, 0) / bandWindow.length,
    );
    const returnWindow = returns.slice(Math.max(0, index - 19), index + 1);
    const returnMean = returnWindow.reduce((sum, value) => sum + value, 0) / returnWindow.length;
    const volatility = Math.sqrt(
      returnWindow.reduce((sum, value) => sum + (value - returnMean) ** 2, 0) / returnWindow.length,
    );

    if (bar.date !== activeSession) {
      activeSession = bar.date;
      cumulativeTypicalVolume = 0;
      cumulativeVolume = 0;
    }
    const typical = (bar.high + bar.low + bar.close) / 3;
    cumulativeTypicalVolume += typical * bar.volume;
    cumulativeVolume += bar.volume;
    const volumeWindow = raw.slice(Math.max(0, index - 26), index);
    const averageVolume = volumeWindow.length
      ? volumeWindow.reduce((sum, value) => sum + value.volume, 0) / volumeWindow.length
      : bar.volume;

    return {
      ...bar,
      ema9: fast,
      ema21: slow,
      rsi,
      upperBand: mean + deviation * 2,
      lowerBand: mean - deviation * 2,
      momentum: index < 6 ? 0 : bar.close / closes[index - 6] - 1,
      volatility,
      vwap: cumulativeTypicalVolume / Math.max(1, cumulativeVolume),
      volumeRatio: clamp(bar.volume / Math.max(1, averageVolume), 0, 3),
    };
  });
}

const MARKET_DATA = generateMarketData();

function scoreBar(bar: MarketBar, weights: ModelWeights) {
  const trend = clamp(((bar.ema9 - bar.ema21) / bar.close) * 130, -1, 1);
  const rsiEdge = clamp((50 - bar.rsi) / 24, -1, 1);
  const momentum = clamp(bar.momentum / 0.018, -1, 1);
  const volatility = clamp((0.006 - bar.volatility) / 0.006, -1, 1);
  const vwap = clamp(((bar.close - bar.vwap) / bar.close) * 150, -1, 1);
  const volume = clamp((bar.volumeRatio - 1) * 0.72, -1, 1);
  const score =
    trend * weights.trend +
    rsiEdge * weights.rsi +
    momentum * weights.momentum +
    volatility * weights.volatility +
    vwap * weights.vwap +
    volume * weights.volume;

  return {
    score: clamp(score, -1, 1),
    factors: { trend, rsi: rsiEdge, momentum, volatility, vwap, volume },
  };
}

function intradayEntryThreshold(weights: ModelWeights) {
  return clamp(weights.threshold * 0.45, 0.065, 0.105);
}


function runBacktest(
  data: MarketBar[],
  weights: ModelWeights,
  startingCapital = STARTING_CAPITAL,
  collectTrades = true,
  collectSeries = collectTrades,
): BacktestResult {
  if (data.length < 2) {
    return {
      finalValue: startingCapital,
      strategyReturn: 0,
      buyHoldReturn: 0,
      alpha: 0,
      maxDrawdown: 0,
      sharpe: 0,
      winRate: 0,
      trades: [],
      equity: [startingCapital],
      buyHoldEquity: [startingCapital],
      scores: [0],
      signal: "HOLD",
      confidence: 50,
      longEntries: 0,
      shortEntries: 0,
      roundTrips: 0,
      tradesPerDay: 0,
      averageHoldBars: 0,
    };
  }

  let cash = startingCapital;
  let shares = 0;
  let entryPrice = 0;
  let entryIndex = -1;
  let peak = startingCapital;
  let maxDrawdown = 0;
  let previousEquity = startingCapital;
  let wins = 0;
  let exits = 0;
  let longEntries = 0;
  let shortEntries = 0;
  let totalHoldBars = 0;
  let latestScore = 0;
  let returnCount = 0;
  let averageReturn = 0;
  let returnSquaredDelta = 0;
  let currentSession = "";
  let entriesThisSession = 0;
  let cooldownBars = 0;
  const sessions = new Set<string>();
  const trades: Trade[] = [];
  const equity: number[] = [];
  const scores: number[] = [];
  const holdShares = startingCapital / data[0].close;
  const buyHoldEquity = collectSeries ? data.map((bar) => holdShares * bar.close) : [];

  const commission = (notional: number) => 0.35 + notional * 0.00002;
  const factorReason = (bar: MarketBar) => {
    const factors = scoreBar(bar, weights).factors;
    const labels: Array<[keyof typeof factors, string]> = [
      ["trend", "EMA trend"],
      ["rsi", "RSI reversal"],
      ["momentum", "Momentum"],
      ["vwap", "VWAP displacement"],
      ["volume", "Volume expansion"],
      ["volatility", "Volatility regime"],
    ];
    labels.sort((a, b) => Math.abs(factors[b[0]]) - Math.abs(factors[a[0]]));
    return `${labels[0][1]} setup`;
  };

  data.forEach((bar, index) => {
    sessions.add(bar.date);
    if (bar.date !== currentSession) {
      currentSession = bar.date;
      entriesThisSession = 0;
      cooldownBars = 0;
    }
    if (cooldownBars > 0) cooldownBars -= 1;

    const scored = scoreBar(bar, weights);
    const score = scored.score;
    latestScore = score;
    if (collectSeries) scores.push(score);
    const confidence = Math.round(50 + Math.min(0.49, Math.abs(score)) * 100);
    const longReturn = shares > 0 && entryPrice > 0 ? bar.close / entryPrice - 1 : 0;
    const shortReturn = shares < 0 && entryPrice > 0 ? entryPrice / bar.close - 1 : 0;
    const heldBars = entryIndex >= 0 ? index - entryIndex : 0;
    const sessionClose = bar.barInSession === 12;

    if (
      shares > 0 &&
      (sessionClose || longReturn >= 0.0065 || longReturn <= -0.0048 || heldBars >= 2 || score < -0.015)
    ) {
      const fill = bar.close * 0.9998;
      const notional = shares * fill;
      const fee = commission(notional);
      const proceeds = notional - fee;
      const pnl = (fill - entryPrice) * shares - fee - commission(shares * entryPrice);
      cash += proceeds;
      exits += 1;
      totalHoldBars += heldBars;
      if (pnl > 0) wins += 1;
      if (collectTrades) trades.push({
        id: `sell-${bar.timestamp}-${index}`,
        date: bar.date,
        time: bar.time,
        timestamp: bar.timestamp,
        side: "SELL",
        price: fill,
        shares,
        value: proceeds,
        pnl,
        confidence,
        reason: sessionClose ? "Closing bell" : longReturn >= 0.0065 ? "Profit target" : longReturn <= -0.0048 ? "Risk stop" : heldBars >= 2 ? "Time stop" : "Signal reversed",
      });
      shares = 0;
      entryPrice = 0;
      entryIndex = -1;
      cooldownBars = 1;
    } else if (
      shares < 0 &&
      (sessionClose || shortReturn >= 0.0065 || shortReturn <= -0.0048 || heldBars >= 2 || score > 0.015)
    ) {
      const quantity = Math.abs(shares);
      const fill = bar.close * 1.0002;
      const notional = quantity * fill;
      const fee = commission(notional);
      const cost = notional + fee;
      const pnl = (entryPrice - fill) * quantity - fee - commission(quantity * entryPrice);
      cash -= cost;
      exits += 1;
      totalHoldBars += heldBars;
      if (pnl > 0) wins += 1;
      if (collectTrades) trades.push({
        id: `cover-${bar.timestamp}-${index}`,
        date: bar.date,
        time: bar.time,
        timestamp: bar.timestamp,
        side: "COVER",
        price: fill,
        shares: quantity,
        value: cost,
        pnl,
        confidence,
        reason: sessionClose ? "Closing bell" : shortReturn >= 0.0065 ? "Profit target" : shortReturn <= -0.0048 ? "Risk stop" : heldBars >= 2 ? "Time stop" : "Signal reversed",
      });
      shares = 0;
      entryPrice = 0;
      entryIndex = -1;
      cooldownBars = 1;
    } else if (
      index > 30 &&
      shares === 0 &&
      cooldownBars === 0 &&
      entriesThisSession < 6 &&
      bar.barInSession >= 1 &&
      bar.barInSession <= 10 &&
      bar.volumeRatio > 0.4
    ) {
      const entryThreshold = intradayEntryThreshold(weights);
      const portfolioValue = cash;
      const allocation = portfolioValue * 0.46;
      if (score > entryThreshold) {
        const fill = bar.close * 1.0002;
        const quantity = Math.floor(allocation / fill);
        if (quantity > 0) {
          const notional = quantity * fill;
          const fee = commission(notional);
          const cost = notional + fee;
          if (cost <= cash) {
            cash -= cost;
            shares = quantity;
            entryPrice = fill;
            entryIndex = index;
            entriesThisSession += 1;
            longEntries += 1;
            if (collectTrades) trades.push({
              id: `buy-${bar.timestamp}-${index}`,
              date: bar.date,
              time: bar.time,
              timestamp: bar.timestamp,
              side: "BUY",
              price: fill,
              shares: quantity,
              value: cost,
              pnl: null,
              confidence,
              reason: collectTrades ? factorReason(bar) : "Indicator setup",
            });
          }
        }
      } else if (score < -entryThreshold) {
        const fill = bar.close * 0.9998;
        const quantity = Math.floor(allocation / fill);
        if (quantity > 0) {
          const notional = quantity * fill;
          const fee = commission(notional);
          const proceeds = notional - fee;
          cash += proceeds;
          shares = -quantity;
          entryPrice = fill;
          entryIndex = index;
          entriesThisSession += 1;
          shortEntries += 1;
          if (collectTrades) trades.push({
            id: `short-${bar.timestamp}-${index}`,
            date: bar.date,
            time: bar.time,
            timestamp: bar.timestamp,
            side: "SHORT",
            price: fill,
            shares: quantity,
            value: proceeds,
            pnl: null,
            confidence,
            reason: collectTrades ? factorReason(bar) : "Indicator setup",
          });
        }
      }
    }

    const portfolioValue = cash + shares * bar.close;
    if (collectSeries) equity.push(portfolioValue);
    peak = Math.max(peak, portfolioValue);
    maxDrawdown = Math.min(maxDrawdown, portfolioValue / peak - 1);
    if (index > 0) {
      const barReturn = portfolioValue / previousEquity - 1;
      returnCount += 1;
      const delta = barReturn - averageReturn;
      averageReturn += delta / returnCount;
      returnSquaredDelta += delta * (barReturn - averageReturn);
    }
    previousEquity = portfolioValue;
  });

  const finalValue = cash + shares * data[data.length - 1].close;
  const strategyReturn = finalValue / startingCapital - 1;
  const buyHoldReturn = data[data.length - 1].close / data[0].close - 1;
  const returnDeviation = Math.sqrt(returnSquaredDelta / Math.max(1, returnCount));
  const entryThreshold = intradayEntryThreshold(weights);
  const signal = latestScore > entryThreshold ? "BUY" : latestScore < -entryThreshold ? "SHORT" : "HOLD";

  return {
    finalValue,
    strategyReturn,
    buyHoldReturn,
    alpha: strategyReturn - buyHoldReturn,
    maxDrawdown,
    sharpe: returnDeviation === 0 ? 0 : (averageReturn / returnDeviation) * Math.sqrt(252 * 13),
    winRate: exits === 0 ? 0 : wins / exits,
    trades,
    equity,
    buyHoldEquity,
    scores,
    signal,
    confidence: Math.round(50 + Math.min(0.49, Math.abs(latestScore)) * 100),
    longEntries,
    shortEntries,
    roundTrips: exits,
    tradesPerDay: exits / Math.max(1, sessions.size),
    averageHoldBars: exits === 0 ? 0 : totalHoldBars / exits,
  };
}

function oracleAction(data: MarketBar[], index: number): Position {
  let futureIndex = index;
  for (let offset = 1; offset <= 4 && index + offset < data.length; offset += 1) {
    if (data[index + offset].date !== data[index].date) break;
    futureIndex = index + offset;
  }
  if (futureIndex <= index) return "FLAT";
  const futureReturn = data[futureIndex].close / data[index].close - 1;
  if (futureReturn > 0.0025) return "LONG";
  if (futureReturn < -0.0025) return "SHORT";
  return "FLAT";
}

function policyAction(bar: MarketBar, weights: ModelWeights): Position {
  const score = scoreBar(bar, weights).score;
  const threshold = intradayEntryThreshold(weights);
  if (score > threshold) return "LONG";
  if (score < -threshold) return "SHORT";
  return "FLAT";
}

function teacherAgreement(data: MarketBar[], weights: ModelWeights) {
  if (data.length < 30) return 0;
  let matched = 0;
  let total = 0;
  for (let index = 22; index < data.length - 4; index += 1) {
    const teacher = oracleAction(data, index);
    const policy = policyAction(data[index], weights);
    matched += teacher === policy ? 1 : 0;
    total += 1;
  }
  return total === 0 ? 0 : matched / total;
}

function splitForTraining(data: MarketBar[]) {
  const splitIndex = Math.max(70, Math.floor(data.length * 0.72));
  return {
    trainingData: data.slice(0, Math.min(splitIndex, data.length - 30)),
    validationData: data.slice(Math.max(0, Math.min(splitIndex, data.length - 30) - 22)),
  };
}

function evaluateModel(data: MarketBar[], weights: ModelWeights) {
  const { trainingData, validationData } = splitForTraining(data);
  const trainingResult = runBacktest(trainingData, weights, STARTING_CAPITAL, false);
  const validationResult = runBacktest(validationData, weights, STARTING_CAPITAL, false);
  const agreement = teacherAgreement(trainingData, weights);
  const turnoverPenalty = Math.max(0, trainingResult.roundTrips / Math.max(1, trainingData.length / 13) - 4.2);
  const undertradingPenalty = Math.max(0, 1.5 - validationResult.tradesPerDay);
  const cadenceReward = Math.min(2.5, validationResult.tradesPerDay) * 0.008;
  const objective =
    validationResult.strategyReturn * 0.52 +
    validationResult.alpha * 0.38 +
    validationResult.sharpe * 0.018 -
    Math.abs(validationResult.maxDrawdown) * 0.32 +
    trainingResult.strategyReturn * 0.12 +
    agreement * 0.12 -
    turnoverPenalty * 0.015 -
    undertradingPenalty * 0.03 +
    cadenceReward;

  return { objective, agreement, trainingResult, validationResult };
}

function teacherSeedModel(data: MarketBar[], current: ModelWeights): ModelWeights {
  const totals = { trend: 0, rsi: 0, momentum: 0, volatility: 0, vwap: 0, volume: 0 };
  let examples = 0;
  for (let index = 22; index < data.length - 4; index += 1) {
    const teacher = oracleAction(data, index);
    const target = teacher === "LONG" ? 1 : teacher === "SHORT" ? -1 : 0;
    const factors = scoreBar(data[index], current).factors;
    totals.trend += factors.trend * target;
    totals.rsi += factors.rsi * target;
    totals.momentum += factors.momentum * target;
    totals.volatility += factors.volatility * target;
    totals.vwap += factors.vwap * target;
    totals.volume += factors.volume * target;
    examples += 1;
  }

  if (examples === 0) return current;
  const learned = {
    trend: Math.max(0.02, totals.trend / examples),
    rsi: Math.max(0.02, totals.rsi / examples),
    momentum: Math.max(0.02, totals.momentum / examples),
    volatility: Math.max(0.01, totals.volatility / examples),
    vwap: Math.max(0.02, totals.vwap / examples),
    volume: Math.max(0.01, totals.volume / examples),
  };
  const sum = learned.trend + learned.rsi + learned.momentum + learned.volatility + learned.vwap + learned.volume;
  const blend = 0.34;
  return normalizeModel({
    trend: current.trend * (1 - blend) + (learned.trend / sum) * blend,
    rsi: current.rsi * (1 - blend) + (learned.rsi / sum) * blend,
    momentum: current.momentum * (1 - blend) + (learned.momentum / sum) * blend,
    volatility: current.volatility * (1 - blend) + (learned.volatility / sum) * blend,
    vwap: current.vwap * (1 - blend) + (learned.vwap / sum) * blend,
    volume: current.volume * (1 - blend) + (learned.volume / sum) * blend,
    threshold: current.threshold * 0.8 + 0.18 * 0.2,
  });
}

function dateLabel(date: string, time?: string) {
  const day = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
  return time ? `${day} / ${time} ET` : day;
}

function getMarketClock(now: Date | null) {
  if (!now) {
    return { isOpen: false, label: "Syncing market clock", time: "--:-- ET" };
  }
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  const weekday = parts.weekday;
  const isWeekday = !["Sat", "Sun"].includes(weekday);
  const isOpen = isWeekday && minutes >= 570 && minutes < 960;
  let label = "Market closed";
  if (isOpen) label = "Market open";
  else if (isWeekday && minutes < 570) label = "Opens today · 9:30 ET";
  else if (weekday === "Fri" || weekday === "Sat") label = "Opens Monday · 9:30 ET";
  else label = "Opens next session · 9:30 ET";

  return {
    isOpen,
    label,
    time: `${parts.hour}:${parts.minute}:${parts.second} ET`,
  };
}

function MarketChart({
  data,
  result,
  viewport,
  theme,
}: {
  data: MarketBar[];
  result: BacktestResult;
  viewport: "ALL" | "1M" | "2W" | "5D";
  theme: "light" | "dark";
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [revision, setRevision] = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);
  const [layers, setLayers] = useState({
    averages: true,
    vwap: true,
    bands: true,
    rsi: true,
    trades: true,
  });

  const requestedBars = viewport === "ALL" ? data.length : viewport === "1M" ? 13 * 22 : viewport === "2W" ? 13 * 10 : 13 * 5;
  const offset = Math.max(0, data.length - requestedBars);
  const visible = data.slice(offset);
  const visibleScores = result.scores.slice(offset);
  const tradeByTimestamp = useMemo(
    () => new Map(result.trades.map((trade) => [trade.timestamp, trade])),
    [result.trades],
  );

  useEffect(() => {
    if (!frameRef.current) return;
    const observer = new ResizeObserver(() => setRevision((value) => value + 1));
    observer.observe(frameRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame || visible.length < 2) return;
    const width = Math.max(320, frame.clientWidth);
    const height = Math.max(390, frame.clientHeight);
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    const isLight = theme === "light";
    const gridColor = isLight ? "rgba(22, 35, 31, 0.09)" : "rgba(255,255,255,0.07)";
    const softGridColor = isLight ? "rgba(22, 35, 31, 0.07)" : "rgba(255,255,255,0.06)";
    const axisColor = isLight ? "rgba(41, 57, 52, 0.60)" : "rgba(198,205,213,0.65)";
    const mutedAxisColor = isLight ? "rgba(41, 57, 52, 0.48)" : "rgba(198,205,213,0.48)";

    const left = 12;
    const right = 64;
    const plotWidth = width - left - right;
    const priceTop = 30;
    const priceBottom = height * 0.69;
    const volumeTop = priceBottom + 10;
    const volumeBottom = height * 0.79;
    const oscTop = height * 0.835;
    const oscBottom = height - 28;
    const candleStep = plotWidth / Math.max(1, visible.length - 1);
    const candleWidth = clamp(candleStep * 0.62, 1.25, 7);
    const prices = visible.flatMap((bar) => [
      bar.high,
      bar.low,
      layers.bands ? bar.upperBand : bar.high,
      layers.bands ? bar.lowerBand : bar.low,
    ]);
    const priceMin = Math.min(...prices) * 0.985;
    const priceMax = Math.max(...prices) * 1.015;
    const maxVolume = Math.max(...visible.map((bar) => bar.volume));
    const x = (index: number) => left + index * candleStep;
    const yPrice = (price: number) =>
      priceTop + ((priceMax - price) / (priceMax - priceMin)) * (priceBottom - priceTop);
    const yRsi = (rsi: number) => oscTop + ((100 - rsi) / 100) * (oscBottom - oscTop);
    const yScore = (score: number) =>
      oscTop + ((1 - score) / 2) * (oscBottom - oscTop);

    context.font = "11px var(--font-geist-mono), monospace";
    context.lineWidth = 1;
    for (let line = 0; line <= 4; line += 1) {
      const y = priceTop + ((priceBottom - priceTop) / 4) * line;
      context.strokeStyle = gridColor;
      context.beginPath();
      context.moveTo(left, y + 0.5);
      context.lineTo(width - right + 6, y + 0.5);
      context.stroke();
      const value = priceMax - ((priceMax - priceMin) / 4) * line;
      context.fillStyle = axisColor;
      context.textAlign = "left";
      context.fillText(`$${value.toFixed(value > 100 ? 0 : 1)}`, width - right + 12, y + 4);
    }

    if (layers.bands) {
      context.beginPath();
      visible.forEach((bar, index) => {
        if (index === 0) context.moveTo(x(index), yPrice(bar.upperBand));
        else context.lineTo(x(index), yPrice(bar.upperBand));
      });
      for (let index = visible.length - 1; index >= 0; index -= 1) {
        context.lineTo(x(index), yPrice(visible[index].lowerBand));
      }
      context.closePath();
      const bandGradient = context.createLinearGradient(0, priceTop, 0, priceBottom);
      bandGradient.addColorStop(0, "rgba(87, 215, 190, 0.10)");
      bandGradient.addColorStop(1, "rgba(87, 215, 190, 0.015)");
      context.fillStyle = bandGradient;
      context.fill();

      ["upperBand", "lowerBand"].forEach((key) => {
        context.beginPath();
        visible.forEach((bar, index) => {
          const value = bar[key as "upperBand" | "lowerBand"];
          if (index === 0) context.moveTo(x(index), yPrice(value));
          else context.lineTo(x(index), yPrice(value));
        });
        context.strokeStyle = "rgba(87, 215, 190, 0.25)";
        context.stroke();
      });
    }

    visible.forEach((bar, index) => {
      const bullish = bar.close >= bar.open;
      const color = bullish ? "#62d6b6" : "#f17875";
      context.strokeStyle = color;
      context.fillStyle = color;
      context.beginPath();
      context.moveTo(x(index), yPrice(bar.high));
      context.lineTo(x(index), yPrice(bar.low));
      context.stroke();
      const bodyTop = yPrice(Math.max(bar.open, bar.close));
      const bodyBottom = yPrice(Math.min(bar.open, bar.close));
      context.globalAlpha = bullish ? 0.88 : 0.82;
      context.fillRect(
        x(index) - candleWidth / 2,
        bodyTop,
        candleWidth,
        Math.max(1.25, bodyBottom - bodyTop),
      );
      context.globalAlpha = 1;

      const volumeHeight = (bar.volume / maxVolume) * (volumeBottom - volumeTop);
      context.fillStyle = bullish ? "rgba(98,214,182,0.22)" : "rgba(241,120,117,0.20)";
      context.fillRect(
        x(index) - candleWidth / 2,
        volumeBottom - volumeHeight,
        candleWidth,
        volumeHeight,
      );
    });

    if (layers.averages) {
      const drawAverage = (key: "ema9" | "ema21", color: string) => {
        context.beginPath();
        visible.forEach((bar, index) => {
          if (index === 0) context.moveTo(x(index), yPrice(bar[key]));
          else context.lineTo(x(index), yPrice(bar[key]));
        });
        context.strokeStyle = color;
        context.lineWidth = 1.6;
        context.stroke();
      };
      drawAverage("ema9", "#f0c66b");
      drawAverage("ema21", "#a99cf6");
      context.lineWidth = 1;
    }

    if (layers.vwap) {
      context.beginPath();
      visible.forEach((bar, index) => {
        if (index === 0) context.moveTo(x(index), yPrice(bar.vwap));
        else context.lineTo(x(index), yPrice(bar.vwap));
      });
      context.strokeStyle = "#4fa7e8";
      context.lineWidth = 1.35;
      context.stroke();
      context.lineWidth = 1;
    }

    if (layers.trades) {
      visible.forEach((bar, index) => {
        const trade = tradeByTimestamp.get(bar.timestamp);
        if (!trade) return;
        const isBuyAction = trade.side === "BUY" || trade.side === "COVER";
        const markerY =
          isBuyAction ? yPrice(bar.low) + 12 : yPrice(bar.high) - 12;
        context.fillStyle = isBuyAction ? "#35b993" : "#e3605c";
        context.beginPath();
        if (isBuyAction) {
          context.moveTo(x(index), markerY - 7);
          context.lineTo(x(index) - 5, markerY + 2);
          context.lineTo(x(index) + 5, markerY + 2);
        } else {
          context.moveTo(x(index), markerY + 7);
          context.lineTo(x(index) - 5, markerY - 2);
          context.lineTo(x(index) + 5, markerY - 2);
        }
        context.closePath();
        context.fill();
      });
    }

    context.strokeStyle = gridColor;
    context.beginPath();
    context.moveTo(left, oscTop);
    context.lineTo(width - right + 6, oscTop);
    context.stroke();

    [30, 50, 70].forEach((value) => {
      const y = yRsi(value);
      context.setLineDash(value === 50 ? [2, 5] : [4, 5]);
      context.strokeStyle = value === 50 ? softGridColor : "rgba(209,155,43,0.20)";
      context.beginPath();
      context.moveTo(left, y);
      context.lineTo(width - right + 6, y);
      context.stroke();
      context.setLineDash([]);
      context.fillStyle = mutedAxisColor;
      context.textAlign = "left";
      context.fillText(String(value), width - right + 12, y + 4);
    });

    if (layers.rsi) {
      context.beginPath();
      visible.forEach((bar, index) => {
        if (index === 0) context.moveTo(x(index), yRsi(bar.rsi));
        else context.lineTo(x(index), yRsi(bar.rsi));
      });
      context.strokeStyle = "#a99cf6";
      context.lineWidth = 1.35;
      context.stroke();
    }

    context.beginPath();
    visibleScores.forEach((score, index) => {
      if (index === 0) context.moveTo(x(index), yScore(score));
      else context.lineTo(x(index), yScore(score));
    });
    context.strokeStyle = "rgba(98,214,182,0.82)";
    context.lineWidth = 1.25;
    context.stroke();
    context.lineWidth = 1;

    const labelCount = width < 650 ? 3 : 5;
    for (let label = 0; label < labelCount; label += 1) {
      const index = Math.round((visible.length - 1) * (label / (labelCount - 1)));
      const bar = visible[index];
      const date = new Date(`${bar.date}T12:00:00Z`);
      const day = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }).format(date);
      const text = `${day} ${bar.time}`;
      context.fillStyle = mutedAxisColor;
      context.textAlign = label === 0 ? "left" : label === labelCount - 1 ? "right" : "center";
      context.fillText(text, x(index), height - 7);
    }

    if (hovered !== null && visible[hovered]) {
      const crossX = x(hovered);
      context.setLineDash([3, 4]);
      context.strokeStyle = isLight ? "rgba(22,35,31,0.30)" : "rgba(255,255,255,0.23)";
      context.beginPath();
      context.moveTo(crossX, priceTop);
      context.lineTo(crossX, oscBottom);
      context.stroke();
      context.setLineDash([]);
      context.fillStyle = isLight ? "#24332e" : "#dfe5e1";
      context.beginPath();
      context.arc(crossX, yPrice(visible[hovered].close), 3, 0, Math.PI * 2);
      context.fill();
    }
  }, [visible, visibleScores, layers, hovered, revision, tradeByTimestamp, theme]);

  const pointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current || visible.length < 2) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const left = 12;
    const right = 64;
    const relative = clamp(event.clientX - rect.left - left, 0, rect.width - left - right);
    const index = Math.round((relative / (rect.width - left - right)) * (visible.length - 1));
    setHovered(index);
  };

  const hoverBar = hovered === null ? null : visible[hovered];
  const hoverTrade = hoverBar ? tradeByTimestamp.get(hoverBar.timestamp) : null;

  const toggleLayer = (key: keyof typeof layers) =>
    setLayers((current) => ({ ...current, [key]: !current[key] }));

  return (
    <div className="chart-module">
      <div className="chart-legend" aria-label="Chart layers">
        <button
          className={layers.averages ? "legend-chip active" : "legend-chip"}
          onClick={() => toggleLayer("averages")}
          type="button"
        >
          <span className="legend-swatch double" /> EMA 9 / 21
        </button>
        <button
          className={layers.vwap ? "legend-chip active" : "legend-chip"}
          onClick={() => toggleLayer("vwap")}
          type="button"
        >
          <span className="legend-swatch vwap" /> VWAP
        </button>
        <button
          className={layers.bands ? "legend-chip active" : "legend-chip"}
          onClick={() => toggleLayer("bands")}
          type="button"
        >
          <span className="legend-swatch band" /> Bollinger 20
        </button>
        <button
          className={layers.rsi ? "legend-chip active" : "legend-chip"}
          onClick={() => toggleLayer("rsi")}
          type="button"
        >
          <span className="legend-swatch rsi" /> RSI 14
        </button>
        <button
          className={layers.trades ? "legend-chip active" : "legend-chip"}
          onClick={() => toggleLayer("trades")}
          type="button"
        >
          <span className="trade-dots"><i /><i /></span> Policy trades
        </button>
        <span className="legend-chip static"><span className="legend-swatch score" /> Policy score</span>
      </div>
      <div className="chart-frame" ref={frameRef}>
        <canvas
          ref={canvasRef}
          onPointerMove={pointerMove}
          onPointerLeave={() => setHovered(null)}
          aria-label="AAPL intraday candlestick chart with EMA, VWAP, Bollinger Bands, RSI, policy score, volume, and trade markers"
          role="img"
        />
        {hoverBar && (
          <div
            className={hovered !== null && hovered > visible.length * 0.66 ? "chart-tooltip left" : "chart-tooltip"}
          >
            <div className="tooltip-date">
              <span>{dateLabel(hoverBar.date, hoverBar.time)}</span>
              {hoverTrade && <b className={hoverTrade.side === "BUY" || hoverTrade.side === "COVER" ? "buy" : "sell"}>{hoverTrade.side}</b>}
            </div>
            <div className="tooltip-values">
              <span>O <b>{hoverBar.open.toFixed(2)}</b></span>
              <span>H <b>{hoverBar.high.toFixed(2)}</b></span>
              <span>L <b>{hoverBar.low.toFixed(2)}</b></span>
              <span>C <b>{hoverBar.close.toFixed(2)}</b></span>
            </div>
            <div className="tooltip-values muted">
              <span>RSI <b>{hoverBar.rsi.toFixed(1)}</b></span>
              <span>Score <b>{visibleScores[hovered ?? 0]?.toFixed(2)}</b></span>
              <span>VWAP <b>{hoverBar.vwap.toFixed(2)}</b></span>
              <span>Vol <b>{compact(hoverBar.volume)} / {hoverBar.volumeRatio.toFixed(1)}x</b></span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EquityChart({ result, theme }: { result: BacktestResult; theme: "light" | "dark" }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!wrapRef.current) return;
    const observer = new ResizeObserver(() => setRevision((value) => value + 1));
    observer.observe(wrapRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap || result.equity.length < 2) return;
    const width = wrap.clientWidth;
    const height = wrap.clientHeight;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    const left = 3;
    const right = 4;
    const top = 8;
    const bottom = height - 8;
    const values = [...result.equity, ...result.buyHoldEquity];
    const min = Math.min(...values) * 0.985;
    const max = Math.max(...values) * 1.015;
    const x = (index: number) => left + (index / (result.equity.length - 1)) * (width - left - right);
    const y = (value: number) => top + ((max - value) / (max - min)) * (bottom - top);

    const drawLine = (series: number[], color: string, fill = false) => {
      context.beginPath();
      series.forEach((value, index) => {
        if (index === 0) context.moveTo(x(index), y(value));
        else context.lineTo(x(index), y(value));
      });
      context.strokeStyle = color;
      context.lineWidth = fill ? 2 : 1.2;
      context.stroke();
      if (fill) {
        context.lineTo(x(series.length - 1), bottom);
        context.lineTo(left, bottom);
        context.closePath();
        const gradient = context.createLinearGradient(0, top, 0, bottom);
        gradient.addColorStop(0, "rgba(98,214,182,0.20)");
        gradient.addColorStop(1, "rgba(98,214,182,0.00)");
        context.fillStyle = gradient;
        context.fill();
      }
    };
    drawLine(result.buyHoldEquity, theme === "light" ? "rgba(104,87,190,0.55)" : "rgba(169,156,246,0.46)");
    drawLine(result.equity, theme === "light" ? "#168b70" : "#62d6b6", true);
  }, [result, revision, theme]);

  return (
    <div className="equity-canvas" ref={wrapRef}>
      <canvas ref={canvasRef} aria-label="Strategy equity compared with buy and hold" role="img" />
    </div>
  );
}

function PortfolioChart({ history, theme }: { history: PaperAccount["equityHistory"]; theme: "light" | "dark" }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!wrapRef.current) return;
    const observer = new ResizeObserver(() => setRevision((value) => value + 1));
    observer.observe(wrapRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const width = Math.max(220, wrap.clientWidth);
    const height = Math.max(86, wrap.clientHeight);
    const ratio = window.devicePixelRatio || 1;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    const values = history.length > 1 ? history.map((point) => point.value) : [PAPER_STARTING_CASH, PAPER_STARTING_CASH];
    const min = Math.min(...values) * 0.998;
    const max = Math.max(...values) * 1.002;
    const spread = Math.max(1, max - min);
    const x = (index: number) => 2 + (index / Math.max(1, values.length - 1)) * (width - 4);
    const y = (value: number) => 8 + ((max - value) / spread) * (height - 16);
    context.beginPath();
    values.forEach((value, index) => index === 0 ? context.moveTo(x(index), y(value)) : context.lineTo(x(index), y(value)));
    context.strokeStyle = theme === "light" ? "#168b70" : "#62d6b6";
    context.lineWidth = 2;
    context.stroke();
    context.lineTo(width - 2, height);
    context.lineTo(2, height);
    context.closePath();
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, theme === "light" ? "rgba(22,139,112,0.18)" : "rgba(98,214,182,0.18)");
    gradient.addColorStop(1, "rgba(98,214,182,0)");
    context.fillStyle = gradient;
    context.fill();
  }, [history, revision, theme]);

  return (
    <div className="portfolio-canvas" ref={wrapRef}>
      <canvas ref={canvasRef} aria-label="Paper portfolio value history" role="img" />
    </div>
  );
}


function TrainingSkeleton({
  progress,
  epoch,
}: {
  progress: number;
  epoch: number;
}) {
  const phase =
    progress < 24
      ? "Studying the hindsight teacher"
      : progress < 52
        ? "Searching causal policies"
        : progress < 78
          ? "Testing on the unseen window"
          : "Saving the best checkpoint";

  return (
    <div className="training-live" role="status" aria-live="polite">
      <div className="training-live-header">
        <div className="training-live-icon"><BrainCircuit size={22} /></div>
        <div>
          <span>Live training</span>
          <h2>{phase}</h2>
          <p>Teacher guidance shapes the search, but the checkpoint is accepted only if it holds up out of sample.</p>
        </div>
        <strong>{progress}%</strong>
      </div>
      <div className="live-progress" aria-label={`Training ${progress}% complete`}>
        <i style={{ width: `${progress}%` }} />
      </div>
      <div className="training-skeleton-grid" aria-hidden="true">
        <div className="skeleton-card large">
          <div className="skeleton-line short" />
          <div className="skeleton-line headline" />
          <div className="skeleton-chart-block">
            <i /><i /><i /><i /><i /><i /><i />
          </div>
        </div>
        <div className="skeleton-card">
          <div className="skeleton-line short" />
          <div className="skeleton-line medium" />
          <div className="skeleton-line full" />
          <div className="skeleton-line full" />
          <div className="skeleton-line medium" />
        </div>
      </div>
      <div className="training-live-footer">
        <span><span className="live-dot" /> Epoch {epoch}</span>
        <span>No real orders are placed</span>
      </div>
    </div>
  );
}

function finiteNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeModel(value: unknown): ModelWeights {
  const model = (value ?? {}) as Partial<ModelWeights>;
  const raw = {
    trend: clamp(finiteNumber(model.trend, INITIAL_MODEL.trend), 0.02, 0.85),
    rsi: clamp(finiteNumber(model.rsi, INITIAL_MODEL.rsi), 0.02, 0.65),
    momentum: clamp(finiteNumber(model.momentum, INITIAL_MODEL.momentum), 0.02, 0.72),
    volatility: clamp(finiteNumber(model.volatility, INITIAL_MODEL.volatility), 0.01, 0.5),
    vwap: clamp(finiteNumber(model.vwap, INITIAL_MODEL.vwap), 0.02, 0.65),
    volume: clamp(finiteNumber(model.volume, INITIAL_MODEL.volume), 0.01, 0.45),
  };
  const sum = raw.trend + raw.rsi + raw.momentum + raw.volatility + raw.vwap + raw.volume;
  return {
    trend: raw.trend / sum,
    rsi: raw.rsi / sum,
    momentum: raw.momentum / sum,
    volatility: raw.volatility / sum,
    vwap: raw.vwap / sum,
    volume: raw.volume / sum,
    threshold: clamp(finiteNumber(model.threshold, INITIAL_MODEL.threshold), 0.1, 0.38),
  };
}

function normalizePaper(value: unknown): PaperAccount {
  const paper = (value ?? {}) as Partial<PaperAccount>;
  return {
    cash: finiteNumber(paper.cash, PAPER_STARTING_CASH),
    shares: Math.trunc(finiteNumber(paper.shares, 0)),
    avgPrice: Math.max(0, finiteNumber(paper.avgPrice, 0)),
    positionOpenedAt: Math.max(0, finiteNumber(paper.positionOpenedAt, 0)),
    realized: finiteNumber(paper.realized, 0),
    orders: Array.isArray(paper.orders) ? paper.orders.slice(0, 80) : [],
    equityHistory: Array.isArray(paper.equityHistory) ? paper.equityHistory.slice(-120) : [],
  };
}

function normalizePersistedState(value: unknown): PersistedLabState | null {
  if (!value || typeof value !== "object") return null;
  const state = value as Partial<PersistedLabState>;
  const range = state.range;
  return {
    version: STATE_VERSION,
    model: normalizeModel(state.model),
    trainingEpoch: Math.max(0, Math.trunc(finiteNumber(state.trainingEpoch, 1840))),
    trainingRuns: Array.isArray(state.trainingRuns) ? state.trainingRuns.slice(0, 40) : [],
    paper: normalizePaper(state.paper),
    range:
      range && typeof range.start === "string" && typeof range.end === "string"
        ? range
        : { start: DEFAULT_START, end: DEFAULT_END },
  };
}

export default function Home() {
  const [draftStart, setDraftStart] = useState(DEFAULT_START);
  const [draftEnd, setDraftEnd] = useState(DEFAULT_END);
  const [range, setRange] = useState({ start: DEFAULT_START, end: DEFAULT_END });
  const [viewport, setViewport] = useState<"ALL" | "1M" | "2W" | "5D">("2W");
  const [activeView, setActiveView] = useState<"chart" | "train" | "paper">("chart");
  const [backtestTab, setBacktestTab] = useState<"chart" | "performance" | "trades">("chart");
  const [trainingTab, setTrainingTab] = useState<"run" | "checkpoints" | "policy">("run");
  const [portfolioTab, setPortfolioTab] = useState<"account" | "orders" | "automation">("account");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [themeReady, setThemeReady] = useState(false);
  const [model, setModel] = useState(INITIAL_MODEL);
  const [isRunning, setIsRunning] = useState(false);
  const [rangeError, setRangeError] = useState("");
  const [training, setTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(100);
  const [trainingEpoch, setTrainingEpoch] = useState(1840);
  const [trainingRuns, setTrainingRuns] = useState<TrainingRun[]>([]);
  const [syncStatus, setSyncStatus] = useState<"loading" | "saving" | "saved" | "offline">("loading");
  const [hydrated, setHydrated] = useState(false);
  const [clock, setClock] = useState<Date | null>(null);
  const [paperActive, setPaperActive] = useState(false);
  const [replayMode, setReplayMode] = useState(false);
  const [paperPrice, setPaperPrice] = useState(MARKET_DATA[MARKET_DATA.length - 1].close);
  const [paper, setPaper] = useState<PaperAccount>({ ...INITIAL_PAPER });
  const [toast, setToast] = useState("");
  const tickRef = useRef(0);
  const saveTimerRef = useRef<number | null>(null);

  const filteredData = useMemo(
    () => MARKET_DATA.filter((bar) => bar.date >= range.start && bar.date <= range.end),
    [range],
  );
  const result = useMemo(() => runBacktest(filteredData, model), [filteredData, model]);
  const sessionCount = useMemo(() => new Set(filteredData.map((bar) => bar.date)).size, [filteredData]);
  const trainingEvaluation = useMemo(
    () => (filteredData.length >= 260 ? evaluateModel(filteredData, model) : null),
    [filteredData, model],
  );
  const latest = filteredData[filteredData.length - 1] ?? MARKET_DATA[MARKET_DATA.length - 1];
  const previous = filteredData[filteredData.length - 2] ?? latest;
  const dayMove = latest.close / previous.close - 1;
  const latestFactors = scoreBar(latest, model).factors;
  const marketClock = getMarketClock(clock);
  const paperValue = paper.cash + paper.shares * paperPrice;
  const paperPnl = paperValue - PAPER_STARTING_CASH;
  const paperPosition: Position = paper.shares > 0 ? "LONG" : paper.shares < 0 ? "SHORT" : "FLAT";
  const paperUnrealized =
    paper.shares > 0
      ? (paperPrice - paper.avgPrice) * paper.shares
      : paper.shares < 0
        ? (paper.avgPrice - paperPrice) * Math.abs(paper.shares)
        : 0;
  const validationResult = trainingEvaluation?.validationResult ?? result;
  const currentTeacherAgreement = trainingEvaluation?.agreement ?? 0;
  const trainingSplitCount = Math.max(0, Math.min(Math.max(70, Math.floor(filteredData.length * 0.72)), filteredData.length - 30));

  useEffect(() => {
    const immediate = window.setTimeout(() => setClock(new Date()), 0);
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    return () => {
      window.clearTimeout(immediate);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedTheme = window.localStorage.getItem("signal-forge-theme");
      const nextTheme =
        savedTheme === "light" || savedTheme === "dark"
          ? savedTheme
          : window.matchMedia("(prefers-color-scheme: light)").matches
            ? "light"
            : "dark";
      setTheme(nextTheme);
      setThemeReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!themeReady) return;
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("signal-forge-theme", theme);
  }, [theme, themeReady]);

  useEffect(() => {
    let cancelled = false;
    const loadPersistentState = async () => {
      setSyncStatus("loading");
      try {
        const response = await fetch("/api/state", { cache: "no-store" });
        if (!response.ok) throw new Error("State load failed");
        const body = (await response.json()) as { state?: unknown };
        const saved = normalizePersistedState(body.state);
        if (!cancelled && saved) {
          setModel(saved.model);
          setTrainingEpoch(saved.trainingEpoch);
          setTrainingRuns(saved.trainingRuns);
          setPaper(saved.paper);
          setRange(saved.range);
          setDraftStart(saved.range.start);
          setDraftEnd(saved.range.end);
        }
        if (!cancelled) setSyncStatus("saved");
      } catch {
        if (!cancelled) setSyncStatus("offline");
      } finally {
        if (!cancelled) setHydrated(true);
      }
    };
    void loadPersistentState();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(async () => {
      setSyncStatus("saving");
      const state: PersistedLabState = {
        version: STATE_VERSION,
        model,
        trainingEpoch,
        trainingRuns: trainingRuns.slice(0, 40),
        paper,
        range,
      };
      try {
        const response = await fetch("/api/state", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ state }),
        });
        if (!response.ok) throw new Error("State save failed");
        setSyncStatus("saved");
      } catch {
        setSyncStatus("offline");
      }
    }, 700);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [hydrated, model, paper, range, trainingEpoch, trainingRuns]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!paperActive || (!marketClock.isOpen && !replayMode)) return;
    const timer = window.setInterval(() => {
      tickRef.current += 1;
      setPaperPrice((currentPrice) => {
        const wave = Math.sin(tickRef.current / 2.4) * 0.0016;
        const noise = (Math.random() - 0.5) * 0.0031;
        const nextPrice = Math.max(1, currentPrice * (1 + wave + noise));
        if (tickRef.current % 2 === 0) {
          const liveScore = clamp(
            result.scores[result.scores.length - 1] +
              Math.sin(tickRef.current / 3.1) * 0.43 +
              Math.sin(tickRef.current / 1.7) * 0.16,
            -1,
            1,
          );
          setPaper((account) => {
            const time = new Intl.DateTimeFormat("en-US", {
              hour: "numeric",
              minute: "2-digit",
              second: "2-digit",
              timeZone: "America/New_York",
            }).format(new Date());
            const threshold = intradayEntryThreshold(model);
            const equity = account.cash + account.shares * nextPrice;
            const quantity = Math.max(1, Math.floor((equity * 0.46) / nextPrice));
            const stamp = Date.now();
            const longReturn = account.shares > 0 && account.avgPrice > 0 ? nextPrice / account.avgPrice - 1 : 0;
            const shortReturn = account.shares < 0 && account.avgPrice > 0 ? account.avgPrice / nextPrice - 1 : 0;
            const timedExit = account.positionOpenedAt > 0 && stamp - account.positionOpenedAt >= 8_000;

            const remember = (next: PaperAccount) => ({
              ...next,
              orders: next.orders.slice(0, 80),
              equityHistory: [
                ...next.equityHistory,
                { time: new Date().toISOString(), value: next.cash + next.shares * nextPrice },
              ].slice(-120),
            });

            if (account.shares === 0 && liveScore > threshold) {
              const cost = quantity * nextPrice + 1;
              if (cost > account.cash) return remember(account);
              return remember({
                ...account,
                cash: account.cash - cost,
                shares: quantity,
                avgPrice: nextPrice,
                positionOpenedAt: stamp,
                orders: [{ id: `paper-buy-${stamp}`, time, side: "BUY", shares: quantity, price: nextPrice, note: "Policy opened a long" }, ...account.orders],
              });
            }
            if (account.shares === 0 && liveScore < -threshold) {
              const proceeds = quantity * nextPrice - 1;
              return remember({
                ...account,
                cash: account.cash + proceeds,
                shares: -quantity,
                avgPrice: nextPrice,
                positionOpenedAt: stamp,
                orders: [{ id: `paper-short-${stamp}`, time, side: "SHORT", shares: quantity, price: nextPrice, note: "Policy opened a short" }, ...account.orders],
              });
            }
            if (account.shares > 0 && (liveScore < -0.015 || longReturn >= 0.0065 || longReturn <= -0.0048 || timedExit)) {
              const proceeds = account.shares * nextPrice - 1;
              const realized = (nextPrice - account.avgPrice) * account.shares - 2;
              return remember({
                ...account,
                cash: account.cash + proceeds,
                shares: 0,
                avgPrice: 0,
                positionOpenedAt: 0,
                realized: account.realized + realized,
                orders: [{ id: `paper-sell-${stamp}`, time, side: "SELL", shares: account.shares, price: nextPrice, note: longReturn >= 0.0065 ? "Profit target" : longReturn <= -0.0048 ? "Risk stop" : timedExit ? "Time stop" : "Signal reversed" }, ...account.orders],
              });
            }
            if (account.shares < 0 && (liveScore > 0.015 || shortReturn >= 0.0065 || shortReturn <= -0.0048 || timedExit)) {
              const coverShares = Math.abs(account.shares);
              const cost = coverShares * nextPrice + 1;
              const realized = (account.avgPrice - nextPrice) * coverShares - 2;
              return remember({
                ...account,
                cash: account.cash - cost,
                shares: 0,
                avgPrice: 0,
                positionOpenedAt: 0,
                realized: account.realized + realized,
                orders: [{ id: `paper-cover-${stamp}`, time, side: "COVER", shares: coverShares, price: nextPrice, note: shortReturn >= 0.0065 ? "Profit target" : shortReturn <= -0.0048 ? "Risk stop" : timedExit ? "Time stop" : "Signal reversed" }, ...account.orders],
              });
            }
            return remember(account);
          });
        }
        return nextPrice;
      });
    }, 1800);
    return () => window.clearInterval(timer);
  }, [paperActive, replayMode, marketClock.isOpen, model, result.scores]);

  useEffect(() => {
    if (marketClock.isOpen || replayMode || paper.shares === 0) return;
    const timer = window.setTimeout(() => {
      setPaper((account) => {
        if (account.shares === 0) return account;
        const quantity = Math.abs(account.shares);
        const time = "4:00 PM";
        const stamp = Date.now();
        if (account.shares > 0) {
          const proceeds = quantity * paperPrice - 1;
          const realized = (paperPrice - account.avgPrice) * quantity - 2;
          return {
            ...account,
            cash: account.cash + proceeds,
            shares: 0,
            avgPrice: 0,
            positionOpenedAt: 0,
            realized: account.realized + realized,
            orders: [{ id: `paper-close-${stamp}`, time, side: "SELL", shares: quantity, price: paperPrice, note: "Closing bell / no overnight risk" }, ...account.orders].slice(0, 80),
          };
        }
        const cost = quantity * paperPrice + 1;
        const realized = (account.avgPrice - paperPrice) * quantity - 2;
        return {
          ...account,
          cash: account.cash - cost,
          shares: 0,
          avgPrice: 0,
          positionOpenedAt: 0,
          realized: account.realized + realized,
          orders: [{ id: `paper-cover-close-${stamp}`, time, side: "COVER", shares: quantity, price: paperPrice, note: "Closing bell / no overnight risk" }, ...account.orders].slice(0, 80),
        };
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [marketClock.isOpen, paper.shares, paperPrice, replayMode]);

  const applyRange = () => {
    if (!draftStart || !draftEnd || draftStart >= draftEnd) {
      setRangeError("Choose an end date after the start date.");
      return;
    }
    const bars = MARKET_DATA.filter(
      (bar) => bar.date >= draftStart && bar.date <= draftEnd,
    );
    const count = new Set(bars.map((bar) => bar.date)).size;
    if (count < 10) {
      setRangeError("Use at least 10 market days so the intraday indicators can warm up.");
      return;
    }
    setRangeError("");
    setActiveView("chart");
    setIsRunning(true);
    window.setTimeout(() => {
      setRange({ start: draftStart, end: draftEnd });
      setIsRunning(false);
      setToast(`Backtest complete / ${count} days / ${bars.length} candles`);
    }, 520);
  };


  const trainModel = useCallback(async () => {
    if (training) return;
    if (filteredData.length < 260) {
      setToast("Training needs at least 20 market days for a holdout window");
      return;
    }

    setActiveView("train");
    setTraining(true);
    setTrainingProgress(0);
    const trainingStartedAt = Date.now();
    const startingEpoch = trainingEpoch;
    const { trainingData } = splitForTraining(filteredData);
    let bestModel = { ...model };
    const baseline = evaluateModel(filteredData, bestModel);
    let bestEvaluation = baseline;
    let bestObjective = baseline.objective;

    const teacherSeed = teacherSeedModel(trainingData, model);
    const teacherSeedEvaluation = evaluateModel(filteredData, teacherSeed);
    if (teacherSeedEvaluation.objective > bestObjective) {
      bestModel = teacherSeed;
      bestEvaluation = teacherSeedEvaluation;
      bestObjective = teacherSeedEvaluation.objective;
    }

    const maxEpochs = 90;
    let epochsCompleted = 0;
    for (let epoch = 1; epoch <= maxEpochs; epoch += 1) {
      epochsCompleted = epoch;
      const temperature = 0.2 * (1 - epoch / maxEpochs) + 0.018;
      for (let candidateIndex = 0; candidateIndex < 10; candidateIndex += 1) {
        const raw = {
          trend: clamp(bestModel.trend + (Math.random() - 0.5) * temperature, 0.03, 0.78),
          rsi: clamp(bestModel.rsi + (Math.random() - 0.5) * temperature, 0.02, 0.52),
          momentum: clamp(bestModel.momentum + (Math.random() - 0.5) * temperature, 0.02, 0.62),
          volatility: clamp(bestModel.volatility + (Math.random() - 0.5) * temperature, 0.01, 0.34),
          vwap: clamp(bestModel.vwap + (Math.random() - 0.5) * temperature, 0.02, 0.58),
          volume: clamp(bestModel.volume + (Math.random() - 0.5) * temperature, 0.01, 0.38),
          threshold: clamp(bestModel.threshold + (Math.random() - 0.5) * 0.04, 0.11, 0.34),
        };
        const sum = raw.trend + raw.rsi + raw.momentum + raw.volatility + raw.vwap + raw.volume;
        const candidate: ModelWeights = {
          trend: raw.trend / sum,
          rsi: raw.rsi / sum,
          momentum: raw.momentum / sum,
          volatility: raw.volatility / sum,
          vwap: raw.vwap / sum,
          volume: raw.volume / sum,
          threshold: raw.threshold,
        };
        const candidateEvaluation = evaluateModel(filteredData, candidate);
        if (candidateEvaluation.objective > bestObjective) {
          bestObjective = candidateEvaluation.objective;
          bestModel = candidate;
          bestEvaluation = candidateEvaluation;
        }
      }

      if (epoch % 5 === 0 || epoch === maxEpochs) {
        setTrainingProgress(Math.round((epoch / maxEpochs) * 100));
        setTrainingEpoch(startingEpoch + epoch);
        await new Promise<void>((resolve) => window.setTimeout(resolve, 12));
      }
      if (
        bestEvaluation.validationResult.alpha > 0.035 &&
        bestEvaluation.agreement > 0.54 &&
        epoch > 45
      ) break;
    }

    setTrainingProgress(96);
    const minimumLiveState = 1800;
    const remainingLiveTime = minimumLiveState - (Date.now() - trainingStartedAt);
    if (remainingLiveTime > 0) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, remainingLiveTime));
    }

    const improved = bestObjective > baseline.objective + 0.000001;
    if (improved) setModel(bestModel);
    setTrainingEpoch(startingEpoch + epochsCompleted);
    setTrainingRuns((current) => [
      {
        id: `run-${Date.now()}`,
        completedAt: new Date().toISOString(),
        range: { ...range },
        epochs: epochsCompleted,
        improved,
        validationReturn: bestEvaluation.validationResult.strategyReturn,
        validationAlpha: bestEvaluation.validationResult.alpha,
        validationDrawdown: bestEvaluation.validationResult.maxDrawdown,
        teacherAgreement: bestEvaluation.agreement,
        objectiveDelta: Math.max(0, bestObjective - baseline.objective),
      },
      ...current,
    ].slice(0, 40));
    setTrainingProgress(100);
    setTraining(false);
    setToast(
      improved
        ? `Checkpoint saved / ${percent(bestEvaluation.validationResult.alpha)} holdout alpha`
        : "Training complete / current checkpoint remains stronger",
    );
  }, [filteredData, model, range, training, trainingEpoch]);

  const resetPaper = () => {
    setPaper({ ...INITIAL_PAPER, orders: [], equityHistory: [] });
    setPaperPrice(MARKET_DATA[MARKET_DATA.length - 1].close);
    setPaperActive(false);
    setReplayMode(false);
    setToast("Paper account reset to $25,000");
  };

  const factors = [
    { label: "EMA trend", value: latestFactors.trend, weight: model.trend, color: "mint" },
    { label: "Momentum", value: latestFactors.momentum, weight: model.momentum, color: "amber" },
    { label: "RSI edge", value: latestFactors.rsi, weight: model.rsi, color: "violet" },
    { label: "VWAP", value: latestFactors.vwap, weight: model.vwap, color: "blue" },
    { label: "Volume", value: latestFactors.volume, weight: model.volume, color: "mint" },
    { label: "Volatility", value: latestFactors.volatility, weight: model.volatility, color: "blue" },
  ];

  return (
    <main className="app-shell refined-shell">
      <header className="topbar refined-topbar">
        <a className="brand" href="#workspace" aria-label="Signal Forge home">
          <span className="brand-mark"><Activity size={17} strokeWidth={2.1} /></span>
          <span>Signal <b>Forge</b></span>
          <em>SIM</em>
        </a>

        <nav className="primary-nav" role="tablist" aria-label="Primary workspace">
          <button id="tab-chart" role="tab" aria-selected={activeView === "chart"} aria-controls="panel-chart" className={activeView === "chart" ? "active" : ""} type="button" onClick={() => setActiveView("chart")}>
            <BarChart3 size={15} /> <span>Backtest</span>
          </button>
          <button id="tab-train" role="tab" aria-selected={activeView === "train"} aria-controls="panel-train" className={activeView === "train" ? "active" : ""} type="button" onClick={() => setActiveView("train")}>
            <BrainCircuit size={15} /> <span>Training</span>{training && <i className="nav-live-dot" />}
          </button>
          <button id="tab-paper" role="tab" aria-selected={activeView === "paper"} aria-controls="panel-paper" className={activeView === "paper" ? "active" : ""} type="button" onClick={() => setActiveView("paper")}>
            <BriefcaseBusiness size={15} /> <span>Portfolio</span>{paperActive && <i className="nav-live-dot" />}
          </button>
        </nav>

        <div className="top-actions">
          <div className={`sync-pill ${syncStatus}`} title="Cloud checkpoint status">
            {syncStatus === "offline" ? <CloudOff size={14} /> : syncStatus === "saving" ? <Save size={14} /> : <Cloud size={14} />}
            <span>{syncStatus === "loading" ? "Loading" : syncStatus === "saving" ? "Saving" : syncStatus === "offline" ? "Offline" : "Saved"}</span>
          </div>
          <div className="market-status refined-market-status">
            <span className={marketClock.isOpen ? "status-dot live" : "status-dot"} />
            <span><b>{marketClock.label}</b><small>{marketClock.time}</small></span>
          </div>
          <button
            className="theme-toggle"
            type="button"
            onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            className="paper-account-shortcut"
            type="button"
            onClick={() => setActiveView("paper")}
          >
            <BriefcaseBusiness size={15} />
            {money(paperValue)}
          </button>
          <div className="avatar" aria-label="Paper trading account">AS</div>
        </div>
      </header>

      <div className="dashboard refined-dashboard" id="workspace">
        {activeView === "chart" && (
          <>
        <section className="command-center">
          <div className="instrument-focus">
            <div className="ticker-logo">A</div>
            <div className="instrument-copy">
              <div className="instrument-labels">
                <span>AAPL</span>
                <small>NASDAQ / SIMULATED DATA</small>
              </div>
              <div className="instrument-price">
                <h1>Apple Inc.</h1>
                <strong>{money(latest.close, 2)}</strong>
                <span className={dayMove >= 0 ? "price-change positive" : "price-change negative"}>
                  {dayMove >= 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                  {percent(dayMove, 2)}
                </span>
              </div>
              <p>30-minute candles / same-day long and short / flat by 4:00 PM</p>
            </div>
          </div>

          <div className={"hero-signal " + result.signal.toLowerCase()}>
            <span className="hero-signal-icon"><BrainCircuit size={20} /></span>
            <div>
              <span>Policy action</span>
              <strong>{result.signal}</strong>
              <small>{result.confidence}% confidence</small>
            </div>
          </div>

          <div className="range-builder">
            <div className="range-builder-title">
              <span><CalendarRange size={17} /></span>
              <div><strong>Replay history</strong><small>Choose a clean test window</small></div>
            </div>
            <div className="range-fields">
              <label htmlFor="start-date">
                <span>From</span>
                <input
                  id="start-date"
                  type="date"
                  min={DATA_START}
                  max={DATA_END}
                  value={draftStart}
                  onChange={(event) => setDraftStart(event.target.value)}
                />
              </label>
              <span className="range-divider">to</span>
              <label htmlFor="end-date">
                <span>To</span>
                <input
                  id="end-date"
                  type="date"
                  min={DATA_START}
                  max={DATA_END}
                  value={draftEnd}
                  onChange={(event) => setDraftEnd(event.target.value)}
                />
              </label>
            </div>
            <button className="primary-button run-button" type="button" onClick={applyRange} disabled={isRunning}>
              {isRunning ? <RefreshCw className="spin" size={16} /> : <Play size={15} fill="currentColor" />}
              {isRunning ? "Running test..." : "Run backtest"}
            </button>
          </div>
        </section>

        {rangeError && <div className="inline-error" role="alert"><Info size={15} /> {rangeError}</div>}

        <section className="outcome-strip" aria-label="Backtest results" aria-live="polite">
          {isRunning ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div className="outcome-item outcome-loading" key={index}>
                <span className="skeleton-line short" />
                <span className="skeleton-line headline" />
                <span className="skeleton-line medium" />
              </div>
            ))
          ) : (
            <>
              <div className="outcome-item primary">
                <span>Policy return</span>
                <strong>{percent(result.strategyReturn)}</strong>
                <small>{money(result.finalValue)} final value</small>
              </div>
              <div className="outcome-item">
                <span>Day-trade frequency</span>
                <strong>{result.tradesPerDay.toFixed(1)} / day</strong>
                <small>{result.roundTrips} closed positions</small>
              </div>
              <div className="outcome-item">
                <span>Excess return</span>
                <strong className={result.alpha >= 0 ? "positive" : "negative"}>{percent(result.alpha)}</strong>
                <small>{result.alpha >= 0 ? "Ahead of buy & hold" : "Behind buy & hold"}</small>
              </div>
              <div className="outcome-item">
                <span>Worst portfolio dip</span>
                <strong>{percent(result.maxDrawdown)}</strong>
                <small>{result.sharpe.toFixed(2)} Sharpe ratio</small>
              </div>
            </>
          )}
        </section>
          </>
        )}

        {activeView === "chart" && (
          <section className="panel focused-workspace chart-workspace" id="panel-chart" role="tabpanel" aria-labelledby="tab-chart">
            <div className="workspace-heading">
              <div>
                <span className="view-kicker">INTRADAY BACKTEST</span>
                <h2>Day-trading replay</h2>
                <p>Frequent same-day opportunities on 30-minute candles, with no overnight positions.</p>
              </div>
              {backtestTab === "chart" && <div className="timeframe-control" role="group" aria-label="Chart viewport">
                {(["ALL", "1M", "2W", "5D"] as const).map((item) => (
                  <button
                    type="button"
                    key={item}
                    className={viewport === item ? "active" : ""}
                    onClick={() => setViewport(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>}
            </div>

            <nav className="page-subtabs" aria-label="Backtest sections">
              <button className={backtestTab === "chart" ? "active" : ""} type="button" onClick={() => setBacktestTab("chart")}>Chart</button>
              <button className={backtestTab === "performance" ? "active" : ""} type="button" onClick={() => setBacktestTab("performance")}>Performance</button>
              <button className={backtestTab === "trades" ? "active" : ""} type="button" onClick={() => setBacktestTab("trades")}>Trades <span>{result.roundTrips}</span></button>
            </nav>

            {backtestTab === "chart" && <>
            <div className="chart-summary-line">
              <span><Activity size={14} /> {sessionCount} days / {filteredData.length} intraday candles</span>
              <span><TrendingUp size={14} /> {result.longEntries} longs</span>
              <span><TrendingDown size={14} /> {result.shortEntries} shorts</span>
              <span><ShieldCheck size={14} /> Fees and slippage included</span>
            </div>

            {isRunning ? (
              <div className="chart-loading-state" role="status" aria-live="polite">
                <div className="chart-loading-top"><span className="skeleton-line short" /><span className="skeleton-line medium" /></div>
                <div className="chart-loading-canvas"><i /><i /><i /><i /><i /><i /></div>
                <span>Replaying {draftStart} through {draftEnd}...</span>
              </div>
            ) : (
              <MarketChart data={filteredData} result={result} viewport={viewport} theme={theme} />
            )}

            <div className="chart-help">
              <div>
                <Info size={16} />
                <p><strong>How to read this:</strong> green markers are buys or covers; red markers are sells or short entries. The policy never sees future candles.</p>
              </div>
              <button className="text-button" type="button" onClick={() => setActiveView("train")}>
                See how the policy learns <ArrowUpRight size={14} />
              </button>
            </div>
            </>}

            {backtestTab === "performance" && <div className="below-chart-grid performance-view">
              <article className="compact-equity">
                <div className="compact-section-heading">
                  <div><span>Portfolio growth</span><strong>{money(result.finalValue)}</strong></div>
                  <span className={result.alpha >= 0 ? "alpha-badge positive" : "alpha-badge negative"}>{percent(result.alpha)} vs hold</span>
                </div>
                <div className="equity-legend"><span><i className="strategy" /> Strategy</span><span><i className="hold" /> Buy & hold</span></div>
                <EquityChart result={result} theme={theme} />
              </article>

              <article className="plain-summary">
                <span className="view-kicker">PLAIN-LANGUAGE RESULT</span>
                <h3>{result.alpha >= 0 ? "The model beat simply holding." : "Buy and hold stayed ahead."}</h3>
                <p>
                  {result.alpha >= 0
                    ? "The strategy stepped out during weaker periods and captured enough of the recoveries to finish ahead after simulated costs."
                    : "The model avoided some losses, but it also missed enough upside that holding the stock produced the stronger result."}
                </p>
                <div className="plain-stats">
                  <div><span>Winning exits</span><strong>{(result.winRate * 100).toFixed(0)}%</strong></div>
                  <div><span>Trades per day</span><strong>{result.tradesPerDay.toFixed(1)}</strong></div>
                  <div><span>Average hold</span><strong>{Math.round(result.averageHoldBars * 30)}m</strong></div>
                  <div><span>Closed positions</span><strong>{result.roundTrips}</strong></div>
                </div>
              </article>
            </div>}

            {backtestTab === "trades" && <details className="trade-drawer" open>
              <summary>
                <span><Layers3 size={16} /> Recent policy trades</span>
                <small>{result.trades.length} orders in this backtest</small>
              </summary>
              <div className="table-wrap refined-table">
                <table>
                  <thead><tr><th>Date</th><th>Action</th><th>Fill price</th><th>Shares</th><th>Profit / loss</th><th>Confidence</th><th>Why</th></tr></thead>
                  <tbody>
                    {result.trades.slice().reverse().slice(0, 50).map((trade) => (
                      <tr key={trade.id}>
                        <td>{dateLabel(trade.date, trade.time)}</td>
                        <td><span className={trade.side === "BUY" || trade.side === "COVER" ? "side-tag buy" : "side-tag sell"}>{trade.side}</span></td>
                        <td>{money(trade.price, 2)}</td>
                        <td>{trade.shares}</td>
                        <td className={trade.pnl === null ? "muted-cell" : trade.pnl >= 0 ? "positive-cell" : "negative-cell"}>{trade.pnl === null ? "Entry" : money(trade.pnl)}</td>
                        <td>{trade.confidence}%</td>
                        <td>{trade.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>}
          </section>
        )}

        {activeView === "train" && (
          <section className="panel focused-workspace train-workspace" id="panel-train" role="tabpanel" aria-labelledby="tab-train">
            {training ? (
              <TrainingSkeleton progress={trainingProgress} epoch={trainingEpoch} />
            ) : (
              <>
                <div className="workspace-heading">
                  <div>
                    <span className="view-kicker">LEARNING LOOP</span>
                    <h2>Teacher-guided, judged out of sample</h2>
                    <p>The first 72% teaches the policy. The final 28% decides whether a checkpoint is worth saving.</p>
                  </div>
                  <span className={validationResult.alpha > 0 ? "training-status success" : "training-status"}>
                    {validationResult.alpha > 0 ? <Check size={14} /> : <Target size={14} />}
                    {validationResult.alpha > 0 ? "Holdout ahead" : "Searching"}
                  </span>
                </div>

                <nav className="page-subtabs" aria-label="Training sections">
                  <button className={trainingTab === "run" ? "active" : ""} type="button" onClick={() => setTrainingTab("run")}>Train</button>
                  <button className={trainingTab === "checkpoints" ? "active" : ""} type="button" onClick={() => setTrainingTab("checkpoints")}>Checkpoints <span>{trainingRuns.length}</span></button>
                  <button className={trainingTab === "policy" ? "active" : ""} type="button" onClick={() => setTrainingTab("policy")}>Policy</button>
                </nav>

                {(trainingTab === "run" || trainingTab === "policy") && <div className="training-layout single">
                  {trainingTab === "run" &&
                  <article className="training-overview">
                    <div className="training-result-hero">
                      <div className="training-model-mark"><Cpu size={22} /></div>
                      <div>
                        <span>Current checkpoint</span>
                        <h3>Forge Policy v2 / epoch {trainingEpoch}</h3>
                        <p>Saved across sessions. A weaker run can never replace it.</p>
                      </div>
                    </div>

                    <div className="comparison-block">
                      <div className="comparison-label"><span>Holdout policy</span><strong>{percent(validationResult.strategyReturn)}</strong></div>
                      <div className="comparison-track strategy"><i style={{ width: Math.round(clamp(Math.max(0, validationResult.strategyReturn) / Math.max(0.1, validationResult.strategyReturn, validationResult.buyHoldReturn) * 100, 6, 100)) + "%" }} /></div>
                      <div className="comparison-label"><span>Holdout buy &amp; hold</span><strong>{percent(validationResult.buyHoldReturn)}</strong></div>
                      <div className="comparison-track hold"><i style={{ width: Math.round(clamp(Math.max(0, validationResult.buyHoldReturn) / Math.max(0.1, validationResult.strategyReturn, validationResult.buyHoldReturn) * 100, 6, 100)) + "%" }} /></div>
                    </div>

                    <div className="training-objective-card">
                      <div>
                        <span>Distance from goal</span>
                        <strong className={validationResult.alpha >= 0 ? "positive" : "negative"}>{percent(validationResult.alpha)}</strong>
                      </div>
                      <p>{validationResult.alpha >= 0 ? "This checkpoint clears the benchmark on data it did not train on." : "Training will search nearby policies and keep the current one unless validation improves."}</p>
                    </div>

                    <button className="primary-button train-cta" type="button" onClick={trainModel}>
                      <Zap size={16} />
                      Train another checkpoint
                    </button>
                    <small className="safe-note"><ShieldCheck size={13} /> Hindsight labels are training-only. They are never available to the paper bot.</small>
                  </article>}

                  {trainingTab === "policy" &&
                  <article className="model-explanation">
                    <span className="view-kicker">CAUSAL POLICY</span>
                    <h3>Six inputs, no future leakage</h3>
                    <p>The teacher can see future prices, but the saved policy can only use indicators available on that candle.</p>
                    <div className="refined-factor-list">
                      {factors.map((factor) => {
                        const contribution = factor.value * factor.weight;
                        return (
                          <div className="refined-factor" key={factor.label}>
                            <div>
                              <span>{factor.label}</span>
                              <strong className={contribution >= 0 ? "positive" : "negative"}>{contribution >= 0 ? "+" : ""}{contribution.toFixed(2)}</strong>
                            </div>
                            <div className="factor-track"><i className={factor.color} style={{ width: Math.max(8, factor.weight * 100) + "%" }} /></div>
                            <small>{Math.round(factor.weight * 100)}% influence</small>
                          </div>
                        );
                      })}
                    </div>
                  </article>}
                </div>}

                {trainingTab === "policy" && <div className="learning-grid">
                  <article className="teacher-card">
                    <div className="teacher-card-icon"><GraduationCap size={21} /></div>
                    <div>
                      <span className="view-kicker">HINDSIGHT TEACHER</span>
                      <h3>Shows the best direction after the fact</h3>
                      <p>For each training candle, the teacher labels the next four intraday candles as long, short, or flat. Those future-aware labels guide learning only.</p>
                    </div>
                    <div className="teacher-score">
                      <span>Policy agreement</span>
                      <strong>{(currentTeacherAgreement * 100).toFixed(0)}%</strong>
                    </div>
                  </article>

                  <article className="split-card">
                    <div className="split-card-heading">
                      <div><BookOpenCheck size={17} /><span>Walk-forward split</span></div>
                      <small>{sessionCount} days / {filteredData.length} candles</small>
                    </div>
                    <div className="split-rail" aria-label="Training and holdout split">
                      <span style={{ width: `${filteredData.length ? trainingSplitCount / filteredData.length * 100 : 72}%` }}>Teacher training</span>
                      <span>Unseen holdout</span>
                    </div>
                    <p>The model studies the earlier period. The later period stays hidden until scoring, which reduces backtest overfitting.</p>
                  </article>
                </div>}

                {trainingTab === "checkpoints" && <section className="training-history standalone-history" aria-label="Saved training history">
                  <div className="training-history-heading">
                    <div><History size={17} /><span><strong>Checkpoint history</strong><small>Persisted to your account</small></span></div>
                    <span>{trainingRuns.filter((run) => run.improved).length} saved</span>
                  </div>
                  {trainingRuns.length === 0 ? (
                    <div className="training-history-empty">Run training once to create the first durable checkpoint record.</div>
                  ) : (
                    <div className="training-run-list">
                      {trainingRuns.slice(0, 4).map((run) => (
                        <div className="training-run" key={run.id}>
                          <span className={run.improved ? "run-icon saved" : "run-icon"}>{run.improved ? <Trophy size={14} /> : <ShieldCheck size={14} />}</span>
                          <div><strong>{run.improved ? "Checkpoint saved" : "Checkpoint kept"}</strong><small>{new Date(run.completedAt).toLocaleString()} / {run.epochs} epochs</small></div>
                          <div><span>Holdout</span><strong className={run.validationAlpha >= 0 ? "positive" : "negative"}>{percent(run.validationAlpha)}</strong></div>
                          <div><span>Teacher</span><strong>{(run.teacherAgreement * 100).toFixed(0)}%</strong></div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>}

                {trainingTab === "run" && <div className="checkpoint-strip">
                  <div><Gauge size={17} /><span><small>Policy confidence</small><strong>{result.confidence}%</strong></span></div>
                  <div><ShieldCheck size={17} /><span><small>Holdout drawdown</small><strong>{percent(validationResult.maxDrawdown)}</strong></span></div>
                  <div><Target size={17} /><span><small>Teacher agreement</small><strong>{(currentTeacherAgreement * 100).toFixed(0)}%</strong></span></div>
                  <button className="text-button" type="button" onClick={() => setActiveView("chart")}>View result on chart <ArrowUpRight size={14} /></button>
                </div>}
              </>
            )}
          </section>
        )}

        {activeView === "paper" && (
          <section className="panel focused-workspace paper-workspace" id="panel-paper" role="tabpanel" aria-labelledby="tab-paper">
            <div className="workspace-heading">
              <div>
                <span className="view-kicker">PORTFOLIO SIMULATOR</span>
                <h2>Practice long and short with fake money</h2>
                <p>Cash, positions, P&amp;L, and every order are saved to your account.</p>
              </div>
              <span className={paperActive ? "bot-state armed" : "bot-state"}><Radio size={12} /> {paperActive ? (marketClock.isOpen || replayMode ? "Running" : "Armed for open") : "Stopped"}</span>
            </div>

            <nav className="page-subtabs" aria-label="Portfolio sections">
              <button className={portfolioTab === "account" ? "active" : ""} type="button" onClick={() => setPortfolioTab("account")}>Account</button>
              <button className={portfolioTab === "orders" ? "active" : ""} type="button" onClick={() => setPortfolioTab("orders")}>Orders <span>{paper.orders.length}</span></button>
              <button className={portfolioTab === "automation" ? "active" : ""} type="button" onClick={() => setPortfolioTab("automation")}>Automation</button>
            </nav>

            <div className="paper-layout single">
              {portfolioTab !== "orders" &&
              <article className="paper-account-card">
                {portfolioTab === "account" && <>
                <div className="paper-account-top">
                  <div><span>Net liquidation value</span><strong>{money(paperValue, 2)}</strong><small className={`position-pill ${paperPosition.toLowerCase()}`}>{paperPosition}</small></div>
                  <div className={paperPnl >= 0 ? "paper-pnl positive" : "paper-pnl negative"}><span>Total result</span><strong>{percent(paperPnl / PAPER_STARTING_CASH, 2)}</strong><small>{money(paperPnl, 2)}</small></div>
                </div>

                <div className="paper-stats refined-paper-stats">
                  <div><span>Available cash</span><strong>{money(paper.cash, 2)}</strong></div>
                  <div><span>AAPL position</span><strong>{Math.abs(paper.shares)} shares</strong></div>
                  <div><span>Unrealized P&amp;L</span><strong className={paperUnrealized >= 0 ? "positive" : "negative"}>{money(paperUnrealized, 2)}</strong></div>
                  <div><span>Practice price</span><strong>{money(paperPrice, 2)}</strong></div>
                </div>

                <div className="portfolio-performance">
                  <div><span>Portfolio history</span><small>{paper.equityHistory.length ? `${paper.equityHistory.length} saved marks` : "Starts when the bot runs"}</small></div>
                  <PortfolioChart history={paper.equityHistory} theme={theme} />
                </div>
                </>}

                {portfolioTab === "automation" && <div className="automation-view">
                <div className="paper-market-card">
                  <span className={marketClock.isOpen ? "paper-market-icon open" : "paper-market-icon"}><Clock3 size={18} /></span>
                  <div>
                    <strong>{marketClock.isOpen ? "Market session is open" : marketClock.label}</strong>
                    <p>{paperActive ? (marketClock.isOpen ? "The saved policy is checking each simulated tick for a long, short, or exit." : replayMode ? "A demo session is replaying now." : "The bot will wake automatically at the opening bell.") : "Start the bot and it will wait safely for the next open."}</p>
                  </div>
                </div>

                <div className="paper-actions refined-paper-actions">
                  <button className={paperActive ? "primary-button stop" : "primary-button"} type="button" onClick={() => setPaperActive((active) => !active)}>
                    {paperActive ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
                    {paperActive ? "Pause paper bot" : "Start paper bot"}
                  </button>
                  {!marketClock.isOpen && (
                    <button className={replayMode ? "secondary-button active" : "secondary-button"} type="button" onClick={() => { setReplayMode((active) => !active); setPaperActive(true); }}>
                      <Activity size={15} /> {replayMode ? "Stop replay" : "Replay a session"}
                    </button>
                  )}
                  <button className="secondary-button reset-paper" type="button" onClick={resetPaper}><RotateCcw size={15} /> Reset</button>
                </div>
                <div className="automation-rules">
                  <div><span>Decision interval</span><strong>Every simulated 30m candle</strong></div>
                  <div><span>Position policy</span><strong>Long / short / flat</strong></div>
                  <div><span>Risk exits</span><strong>Target, stop, 2-candle time exit</strong></div>
                  <div><span>Overnight risk</span><strong>Always flat by 4:00 PM</strong></div>
                </div>
                </div>}
              </article>}

              {portfolioTab === "orders" &&
              <aside className="paper-activity-card">
                <div className="paper-activity-heading">
                  <div><span className="view-kicker">RECENT ACTIVITY</span><h3>Paper orders</h3></div>
                  <span>{paper.orders.length}</span>
                </div>
                <div className="paper-order-list">
                  {paper.orders.length === 0 ? (
                    <div className="empty-paper-orders">
                      <BriefcaseBusiness size={24} />
                      <strong>No portfolio activity yet</strong>
                      <p>Start the simulator or replay a session to watch durable orders appear here.</p>
                    </div>
                  ) : (
                    paper.orders.slice(0, 40).map((order) => (
                      <div className="paper-order" key={order.id}>
                        <span className={order.side === "BUY" || order.side === "COVER" ? "order-icon buy" : "order-icon sell"}>{order.side === "BUY" || order.side === "COVER" ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}</span>
                        <div><strong>{order.side} {order.shares} AAPL</strong><small>{order.note} / {order.time}</small></div>
                        <span>{money(order.price, 2)}</span>
                      </div>
                    ))
                  )}
                </div>
                <div className="paper-disclosure"><Database size={14} /> Portfolio and order history are saved. Prices and fills remain simulated.</div>
              </aside>}
            </div>
          </section>
        )}

        <footer className="app-footer refined-footer">
          <div><ShieldCheck size={14} /> Research sandbox only. No real orders or guaranteed returns.</div>
          <span>Deterministic AAPL tape / account-saved checkpoints and portfolio</span>
        </footer>
      </div>

      {toast && <div className="toast"><Check size={15} /> {toast}</div>}
    </main>
  );
}
