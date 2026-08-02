"use client";

import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  BookOpenCheck,
  BrainCircuit,
  BriefcaseBusiness,
  Bell,
  CalendarRange,
  Check,
  ChevronDown,
  Cloud,
  CloudOff,
  Clock3,
  Cpu,
  CreditCard,
  Database,
  DollarSign,
  FlaskConical,
  Gauge,
  GraduationCap,
  History,
  Info,
  Layers3,
  LockKeyhole,
  LogOut,
  Moon,
  Pause,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  Save,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Target,
  Trophy,
  TrendingDown,
  TrendingUp,
  UserRound,
  Zap,
} from "lucide-react";
import {
  type FormEvent,
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

type ModelWeights = {
  trend: number;
  rsi: number;
  momentum: number;
  volatility: number;
  vwap: number;
  volume: number;
  orb: number;
  pullback: number;
  squeeze: number;
  levels: number;
  pattern: number;
  threshold: number;
};

type Position = "LONG" | "SHORT" | "FLAT";
type TradeSide = "BUY" | "SELL" | "SHORT" | "COVER";
type WorkspaceMode = "sandbox" | "live" | null;
type ActiveView = "chart" | "train" | "paper" | "guide" | "settings" | "account";
type LaunchView = "chart" | "train" | "paper";
type MarketRegime = "TREND" | "SQUEEZE" | "RANGE";
type StrategyAlgorithm = "Trend following" | "Momentum" | "Mean reversion" | "Volume breakout";
type AccountUser = { id: string; username: string };
type AvatarPreset = "mint" | "ocean" | "violet" | "sunset" | "graphite" | "rose";

type UserProfile = {
  displayName: string;
  avatarPreset: AvatarPreset;
};

type LabPreferences = {
  paperStartingCash: number;
  launchView: LaunchView;
  animations: boolean;
  autoRun: boolean;
};

type PendingEntry = {
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

type Trade = {
  id: string;
  date: string;
  time: string;
  timestamp: string;
  side: TradeSide;
  price: number;
  shares: number;
  value: number;
  fees: number;
  slippage: number;
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
  averageWeekReturn: number;
  positiveWeekRate: number;
  totalFees: number;
  totalSlippage: number;
  averageSpread: number;
};

type PaperOrder = {
  id: string;
  time: string;
  side: TradeSide;
  shares: number;
  price: number;
  fees: number;
  slippage: number;
  note: string;
};

type PaperAccount = {
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
  pendingEntry: PendingEntry | null;
  currentSession: string;
  entriesThisSession: number;
  cooldownBars: number;
  dailyStartEquity: number;
  dailyLocked: boolean;
  lastBarTimestamp: string;
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
  version: 7;
  theme: "light" | "dark";
  model: ModelWeights;
  trainingEpoch: number;
  trainingRuns: TrainingRun[];
  paper: PaperAccount;
  range: { start: string; end: string };
  profile: UserProfile;
  preferences: LabPreferences;
};

const STARTING_CAPITAL = 10_000;
const PAPER_STARTING_CASH = 25_000;
const TRAINING_START = "2023-01-02";
const TRAINING_END = "2023-12-29";
const DATA_START = TRAINING_START;
const DATA_END = "2026-07-29";
const BACKTEST_MIN = "2024-01-02";
const DEFAULT_START = "2024-01-02";
const DEFAULT_END = "2025-12-31";
const STATE_VERSION = 7;
const MODEL_STATE_VERSION = 6;
const BAR_MINUTES = 5;
const BARS_PER_SESSION = 78;
const OPENING_RANGE_BARS = 3;
const LAST_ENTRY_BAR = 72;
const MAX_ENTRIES_PER_SESSION = 14;
const RISK_PER_TRADE_FRACTION = 0.005;
const DAILY_LOSS_LIMIT_FRACTION = 0.02;
const LOSS_COOLDOWN_BARS = 1;
const SEC_FEE_RATE = 20.6 / 1_000_000;
const FINRA_TAF_PER_SHARE = 0.000195;
const FINRA_TAF_MAX = 9.79;
const CAT_FEE_PER_SHARE = 0.000003;

const INITIAL_MODEL: ModelWeights = {
  // Shrunk 60% toward the best isolated-2023 validation checkpoint to reduce search overfit.
  trend: 0.07168061222484356,
  rsi: 0.04368061222484357,
  momentum: 0.10347403922806399,
  volatility: 0.14242461163470482,
  vwap: 0.07540162858738356,
  volume: 0.09629939527566583,
  orb: 0.14922675137115206,
  pullback: 0.05380814946210659,
  squeeze: 0.03276045916863267,
  levels: 0.09181760420301565,
  pattern: 0.13942613661958776,
  threshold: 0.20138767231814566,
};

const INITIAL_PROFILE: UserProfile = {
  displayName: "",
  avatarPreset: "mint",
};

const INITIAL_PREFERENCES: LabPreferences = {
  paperStartingCash: PAPER_STARTING_CASH,
  launchView: "chart",
  animations: true,
  autoRun: false,
};

function createInitialPaper(startingCash = PAPER_STARTING_CASH): PaperAccount {
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
  maxHoldBars: 9,
  pendingEntry: null,
  currentSession: "",
  entriesThisSession: 0,
  cooldownBars: 0,
  dailyStartEquity: startingCash,
  dailyLocked: false,
  lastBarTimestamp: "",
  realized: 0,
  orders: [],
  equityHistory: [],
  };
}

const INITIAL_PAPER = createInitialPaper();

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

function initialsFromName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length > 1) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return (parts[0] || "SF").slice(0, 2).toUpperCase();
}

type FillKind = "market" | "stop" | "limit";

function regulatoryFees(side: TradeSide, shares: number, price: number) {
  const sale = side === "SELL" || side === "SHORT";
  const secFee = sale ? shares * price * SEC_FEE_RATE : 0;
  const tafFee = sale ? Math.min(FINRA_TAF_MAX, shares * FINRA_TAF_PER_SHARE) : 0;
  const catFee = shares * CAT_FEE_PER_SHARE;
  return secFee + tafFee + catFee;
}

function estimatedSpread(bar: MarketBar, referencePrice = bar.close) {
  const edgeOfSession = bar.barInSession < 3 || bar.barInSession > 73 ? 1.35 : 1;
  const volumePenalty = clamp(1.08 - bar.volumeRatio, 0, 1) * 0.42;
  const volatilityPenalty = clamp(bar.rangeExpansion - 0.9, 0, 2.5) * 0.12;
  const spreadBps = (0.42 + volumePenalty + volatilityPenalty) * edgeOfSession;
  return Math.max(0.01, referencePrice * spreadBps / 10_000);
}

function executionFill(
  bar: MarketBar,
  side: TradeSide,
  referencePrice: number,
  shares: number,
  kind: FillKind = "market",
) {
  const spread = estimatedSpread(bar, referencePrice);
  const participation = shares / Math.max(1, bar.volume);
  const impactBps = kind === "limit"
    ? 0
    : clamp(0.03 + Math.sqrt(participation) * 6 + Math.max(0, bar.rangeExpansion - 1) * 0.05, 0.03, 3.5);
  const adversePerShare = kind === "limit"
    ? 0
    : spread / 2 + referencePrice * impactBps / 10_000;
  const paysUp = side === "BUY" || side === "COVER";
  const price = Math.max(0.01, referencePrice + (paysUp ? adversePerShare : -adversePerShare));
  return {
    price,
    fees: regulatoryFees(side, shares, price),
    slippage: Math.abs(price - referencePrice) * shares,
    spread,
  };
}

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
    | "ema9"
    | "ema21"
    | "ema50"
    | "rsi"
    | "upperBand"
    | "lowerBand"
    | "momentum"
    | "volatility"
    | "vwap"
    | "volumeRatio"
    | "atr"
    | "macd"
    | "macdSignal"
    | "adx"
    | "directionalIndex"
    | "openingHigh"
    | "openingLow"
    | "sessionHighBefore"
    | "sessionLowBefore"
    | "priorHigh"
    | "priorLow"
    | "priorClose"
    | "rollingHigh"
    | "rollingLow"
    | "bandWidthRatio"
    | "rangeExpansion"
    | "closeLocation"
    | "bodyStrength"
    | "obv"
    | "obvSlope"
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

      const regimeRoll = random();
      const regime = regimeRoll < 0.42 ? "trend" : regimeRoll < 0.68 ? "reversal" : regimeRoll < 0.84 ? "squeeze" : "range";
      const direction = sessionReturn === 0 ? (random() > 0.5 ? 1 : -1) : Math.sign(sessionReturn);
      if (regime === "trend") sessionReturn += direction * (0.004 + random() * 0.006);
      if (regime === "reversal") sessionReturn += direction * (0.002 + random() * 0.004);
      if (regime === "squeeze") sessionReturn += direction * (0.005 + random() * 0.007);
      if (regime === "range") sessionReturn *= 0.28;

      const gap = (random() - 0.5) * 0.008;
      const sessionOpen = previousClose * (1 + gap);
      let intradayPrice = sessionOpen;

      for (let barInSession = 0; barInSession < BARS_PER_SESSION; barInSession += 1) {
        const totalMinutes = 570 + barInSession * BAR_MINUTES;
        const hour = Math.floor(totalMinutes / 60);
        const minute = totalMinutes % 60;
        const time = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
        const open = intradayPrice;
        const progress = barInSession / (BARS_PER_SESSION - 1);
        const openingPulse = barInSession < 6
          ? direction * (0.00012 + random() * 0.0002) + (random() - 0.5) * 0.0009
          : 0;
        const closingPulse = barInSession > 73 ? (random() - 0.5) * 0.00115 : 0;
        const microWave = Math.sin(session * 0.7 + barInSession * 0.23) * (regime === "range" ? 0.00052 : 0.00023);
        const noiseScale = regime === "squeeze" && barInSession < 18 ? 0.00056 : 0.00142;
        const microNoise = (random() - 0.5) * (noiseScale - Math.min(progress, 1 - progress) * 0.00034);
        const meanReversion = ((sessionOpen - open) / sessionOpen) * (regime === "range" ? 0.024 : 0.006);
        let structure = 0;
        if (regime === "trend") {
          structure = direction * 0.00008;
          if (barInSession === 18 || barInSession === 50) structure -= direction * 0.00075;
          if (barInSession === 20 || barInSession === 52) structure += direction * 0.00048;
        } else if (regime === "reversal") {
          structure = barInSession < 12
            ? -direction * 0.00034
            : barInSession < 60
              ? direction * 0.00018
              : direction * 0.00004;
        } else if (regime === "squeeze") {
          structure = barInSession < 18
            ? -((open - sessionOpen) / sessionOpen) * 0.035
            : barInSession === 18
              ? direction * 0.0017
              : direction * 0.0001;
        } else {
          structure = -((open - sessionOpen) / sessionOpen) * 0.018;
        }
        const driftShare = regime === "range" ? sessionReturn / 156 : sessionReturn / 96;
        const barReturn = driftShare + structure + openingPulse + closingPulse + microWave + microNoise + meanReversion;
        const close = Math.max(18, open * (1 + barReturn));
        const range = 0.00038 + random() * 0.00108;
        const high = Math.max(open, close) * (1 + range * (0.35 + random() * 0.6));
        const low = Math.min(open, close) * (1 - range * (0.35 + random() * 0.6));
        const uShape = Math.pow(Math.abs(progress - 0.5) * 2, 1.5);
        const catalystVolume =
          (regime === "trend" && barInSession < 6) ||
          (regime === "squeeze" && barInSession === 18) ||
          (regime === "reversal" && barInSession === 12)
            ? 1.45
            : 1;
        const volume = Math.round(
          320_000 * (0.82 + uShape * 2.1) * (0.72 + random() * 0.72) * (1 + Math.abs(barReturn) * 105) * catalystVolume,
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
  let medium = closes[0];
  let ema12 = closes[0];
  let ema26 = closes[0];
  let macdSignal = 0;
  let avgGain = 0;
  let avgLoss = 0;
  let atr = 0;
  let smoothedPlusDm = 0;
  let smoothedMinusDm = 0;
  let adx = 18;
  let activeSession = "";
  let cumulativeTypicalVolume = 0;
  let cumulativeVolume = 0;
  let openingHigh = raw[0].high;
  let openingLow = raw[0].low;
  let runningSessionHigh = raw[0].open;
  let runningSessionLow = raw[0].open;
  let priorHigh = raw[0].high;
  let priorLow = raw[0].low;
  let priorClose = raw[0].open;
  let obv = 0;
  const bandWidths: number[] = [];
  const signedVolumes: number[] = [];

  return raw.map((bar, index) => {
    fast = index === 0 ? bar.close : bar.close * 0.2 + fast * 0.8;
    slow = index === 0 ? bar.close : bar.close * (2 / 22) + slow * (20 / 22);
    medium = index === 0 ? bar.close : bar.close * (2 / 51) + medium * (49 / 51);
    ema12 = index === 0 ? bar.close : bar.close * (2 / 13) + ema12 * (11 / 13);
    ema26 = index === 0 ? bar.close : bar.close * (2 / 27) + ema26 * (25 / 27);
    const macd = ema12 - ema26;
    macdSignal = index === 0 ? macd : macd * 0.2 + macdSignal * 0.8;
    const change = index === 0 ? 0 : bar.close - closes[index - 1];
    const signedVolume = index === 0 ? 0 : Math.sign(change) * bar.volume;
    obv += signedVolume;
    signedVolumes.push(signedVolume);
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

    const previousBar = raw[Math.max(0, index - 1)];
    const trueRange = index === 0
      ? bar.high - bar.low
      : Math.max(bar.high - bar.low, Math.abs(bar.high - previousBar.close), Math.abs(bar.low - previousBar.close));
    const upMove = index === 0 ? 0 : bar.high - previousBar.high;
    const downMove = index === 0 ? 0 : previousBar.low - bar.low;
    const plusDm = upMove > downMove && upMove > 0 ? upMove : 0;
    const minusDm = downMove > upMove && downMove > 0 ? downMove : 0;
    if (index < 14) {
      atr = (atr * index + trueRange) / (index + 1);
      smoothedPlusDm = (smoothedPlusDm * index + plusDm) / (index + 1);
      smoothedMinusDm = (smoothedMinusDm * index + minusDm) / (index + 1);
    } else {
      atr = (atr * 13 + trueRange) / 14;
      smoothedPlusDm = (smoothedPlusDm * 13 + plusDm) / 14;
      smoothedMinusDm = (smoothedMinusDm * 13 + minusDm) / 14;
    }
    const plusDi = atr === 0 ? 0 : (smoothedPlusDm / atr) * 100;
    const minusDi = atr === 0 ? 0 : (smoothedMinusDm / atr) * 100;
    const dx = plusDi + minusDi === 0 ? 0 : (Math.abs(plusDi - minusDi) / (plusDi + minusDi)) * 100;
    adx = index < 14 ? (adx * index + dx) / (index + 1) : (adx * 13 + dx) / 14;
    const directionalIndex = clamp((plusDi - minusDi) / 38, -1, 1);

    if (bar.date !== activeSession) {
      if (activeSession) {
        priorHigh = runningSessionHigh;
        priorLow = runningSessionLow;
        priorClose = raw[index - 1].close;
      }
      activeSession = bar.date;
      cumulativeTypicalVolume = 0;
      cumulativeVolume = 0;
      openingHigh = bar.high;
      openingLow = bar.low;
      runningSessionHigh = bar.open;
      runningSessionLow = bar.open;
    }
    const sessionHighBefore = runningSessionHigh;
    const sessionLowBefore = runningSessionLow;
    if (bar.barInSession < OPENING_RANGE_BARS) {
      openingHigh = bar.barInSession === 0 ? bar.high : Math.max(openingHigh, bar.high);
      openingLow = bar.barInSession === 0 ? bar.low : Math.min(openingLow, bar.low);
    }
    const typical = (bar.high + bar.low + bar.close) / 3;
    cumulativeTypicalVolume += typical * bar.volume;
    cumulativeVolume += bar.volume;
    const volumeWindow = raw.slice(Math.max(0, index - BARS_PER_SESSION), index);
    const averageVolume = volumeWindow.length
      ? volumeWindow.reduce((sum, value) => sum + value.volume, 0) / volumeWindow.length
      : bar.volume;
    const obvWindow = signedVolumes.slice(Math.max(0, signedVolumes.length - 8));
    const obvSlope = clamp(
      obvWindow.reduce((sum, value) => sum + value, 0) /
        Math.max(1, averageVolume * obvWindow.length),
      -1,
      1,
    );
    const rollingWindow = raw.slice(Math.max(0, index - BARS_PER_SESSION), index);
    const rollingHigh = rollingWindow.length ? Math.max(...rollingWindow.map((value) => value.high)) : bar.high;
    const rollingLow = rollingWindow.length ? Math.min(...rollingWindow.map((value) => value.low)) : bar.low;
    const bandWidth = mean === 0 ? 0 : (deviation * 4) / mean;
    const priorBandWidths = bandWidths.slice(Math.max(0, bandWidths.length - BARS_PER_SESSION));
    const averageBandWidth = priorBandWidths.length
      ? priorBandWidths.reduce((sum, value) => sum + value, 0) / priorBandWidths.length
      : Math.max(0.0001, bandWidth);
    const bandWidthRatio = clamp(bandWidth / Math.max(0.0001, averageBandWidth), 0.2, 3);
    bandWidths.push(bandWidth);
    const candleRange = Math.max(0.0001, bar.high - bar.low);
    const closeLocation = clamp(((bar.close - bar.low) / candleRange) * 2 - 1, -1, 1);
    const bodyStrength = clamp((bar.close - bar.open) / candleRange, -1, 1);

    runningSessionHigh = Math.max(runningSessionHigh, bar.high);
    runningSessionLow = Math.min(runningSessionLow, bar.low);

    return {
      ...bar,
      ema9: fast,
      ema21: slow,
      ema50: medium,
      rsi,
      upperBand: mean + deviation * 2,
      lowerBand: mean - deviation * 2,
      momentum: index < 6 ? 0 : bar.close / closes[index - 6] - 1,
      volatility,
      vwap: cumulativeTypicalVolume / Math.max(1, cumulativeVolume),
      volumeRatio: clamp(bar.volume / Math.max(1, averageVolume), 0, 3),
      atr,
      macd,
      macdSignal,
      adx,
      directionalIndex,
      openingHigh,
      openingLow,
      sessionHighBefore,
      sessionLowBefore,
      priorHigh,
      priorLow,
      priorClose,
      rollingHigh,
      rollingLow,
      bandWidthRatio,
      rangeExpansion: clamp(trueRange / Math.max(0.0001, atr), 0, 4),
      closeLocation,
      bodyStrength,
      obv,
      obvSlope,
    };
  });
}

const MARKET_DATA = generateMarketData();
const TRAINING_DATA = MARKET_DATA.filter(
  (bar) => bar.date >= TRAINING_START && bar.date <= TRAINING_END,
);
const PAPER_SESSION_DATE = MARKET_DATA[MARKET_DATA.length - 1]?.date ?? DATA_END;
const PAPER_STREAM = MARKET_DATA.filter((bar) => bar.date === PAPER_SESSION_DATE);

function scoreBar(bar: MarketBar, weights: ModelWeights, explain = true) {
  const atrUnit = Math.max(bar.atr, bar.close * 0.0015);
  const emaDirection = clamp((bar.ema9 - bar.ema21) / atrUnit, -1, 1);
  const structuralDirection = clamp((bar.ema21 - bar.ema50) / (atrUnit * 1.45), -1, 1);
  const macdDirection = clamp((bar.macd - bar.macdSignal) / (atrUnit * 0.34), -1, 1);
  const trend = clamp(
    emaDirection * 0.38 + structuralDirection * 0.24 + bar.directionalIndex * 0.22 + macdDirection * 0.16,
    -1,
    1,
  );
  const trendRegime = clamp((bar.adx - 17) / 19, 0, 1);
  const regime: MarketRegime = bar.bandWidthRatio < 0.76
    ? "SQUEEZE"
    : trendRegime >= 0.42
      ? "TREND"
      : "RANGE";
  const rsiTrend = clamp((bar.rsi - 50) / 23, -1, 1);
  const rsiReversion = clamp((50 - bar.rsi) / 27, -1, 1);
  const rsiEdge = regime === "RANGE" ? rsiReversion : rsiTrend;
  const momentum = clamp(
    bar.momentum / 0.014 * 0.56 + bar.bodyStrength * 0.25 + macdDirection * 0.19,
    -1,
    1,
  );
  const volatility = clamp(
    Math.sign(bar.bodyStrength || momentum) * (bar.rangeExpansion - 0.85) * 0.62,
    -1,
    1,
  );
  const vwap = clamp((bar.close - bar.vwap) / (atrUnit * 1.15), -1, 1);
  const volume = clamp(
    bar.obvSlope * 0.58 + bar.bodyStrength * Math.max(0, bar.volumeRatio - 0.62) * 0.42,
    -1,
    1,
  );

  let orb = 0;
  if (bar.barInSession >= OPENING_RANGE_BARS && bar.barInSession <= 18) {
    if (bar.close > bar.openingHigh) {
      orb = clamp(
        (bar.close - bar.openingHigh) / atrUnit * 0.82 + bar.closeLocation * 0.24 + Math.max(0, bar.volumeRatio - 1) * 0.2,
        0,
        1,
      );
    } else if (bar.close < bar.openingLow) {
      orb = -clamp(
        (bar.openingLow - bar.close) / atrUnit * 0.82 - bar.closeLocation * 0.24 + Math.max(0, bar.volumeRatio - 1) * 0.2,
        0,
        1,
      );
    }
  }

  const longTrend = trend > 0.16 && bar.ema9 >= bar.ema21;
  const shortTrend = trend < -0.16 && bar.ema9 <= bar.ema21;
  const touchedLongValue = bar.low <= Math.max(bar.ema9, bar.vwap) * 1.0015;
  const touchedShortValue = bar.high >= Math.min(bar.ema9, bar.vwap) * 0.9985;
  const pullback = longTrend && touchedLongValue && bar.close > bar.ema9 && bar.close > bar.vwap && bar.bodyStrength > 0.08
    ? clamp(0.48 + bar.closeLocation * 0.28 + Math.max(0, bar.volumeRatio - 0.8) * 0.18, 0, 1)
    : shortTrend && touchedShortValue && bar.close < bar.ema9 && bar.close < bar.vwap && bar.bodyStrength < -0.08
      ? -clamp(0.48 - bar.closeLocation * 0.28 + Math.max(0, bar.volumeRatio - 0.8) * 0.18, 0, 1)
      : 0;

  const squeezePressure = clamp((1.18 - bar.bandWidthRatio) * 0.95, 0, 1);
  const squeeze = clamp(
    Math.sign(bar.bodyStrength || momentum) *
      squeezePressure *
      clamp((bar.rangeExpansion - 0.78) * 0.72, 0, 1) *
      (0.65 + Math.max(0, bar.volumeRatio - 0.8) * 0.25),
    -1,
    1,
  );

  const supportTouched = bar.low <= Math.max(bar.priorLow, bar.rollingLow) * 1.0025 || bar.low <= bar.sessionLowBefore * 1.0015;
  const resistanceTouched = bar.high >= Math.min(bar.priorHigh, bar.rollingHigh) * 0.9975 || bar.high >= bar.sessionHighBefore * 0.9985;
  const longRejection = supportTouched && bar.closeLocation > 0.28 && bar.bodyStrength > 0;
  const shortRejection = resistanceTouched && bar.closeLocation < -0.28 && bar.bodyStrength < 0;
  const levelBreakout = bar.close > Math.max(bar.priorHigh, bar.rollingHigh)
    ? clamp((bar.close - Math.max(bar.priorHigh, bar.rollingHigh)) / atrUnit, 0, 1)
    : bar.close < Math.min(bar.priorLow, bar.rollingLow)
      ? -clamp((Math.min(bar.priorLow, bar.rollingLow) - bar.close) / atrUnit, 0, 1)
      : 0;
  const levels = longRejection
    ? clamp(0.52 + bar.closeLocation * 0.34, 0, 1)
    : shortRejection
      ? -clamp(0.52 - bar.closeLocation * 0.34, 0, 1)
      : levelBreakout;
  const pattern = clamp(
    bar.bodyStrength * 0.62 + bar.closeLocation * 0.25 + Math.sign(bar.bodyStrength) * Math.max(0, bar.rangeExpansion - 1) * 0.18,
    -1,
    1,
  );

  const bandMid = (bar.upperBand + bar.lowerBand) / 2;
  const halfBand = Math.max(atrUnit * 0.72, (bar.upperBand - bar.lowerBand) / 2);
  const bandStretch = clamp((bar.close - bandMid) / halfBand, -1.6, 1.6);
  const vwapStretch = clamp((bar.close - bar.vwap) / (atrUnit * 1.45), -1.4, 1.4);
  const lowerBandRejection = bar.low <= bar.lowerBand * 1.001 && bar.closeLocation > 0.18;
  const upperBandRejection = bar.high >= bar.upperBand * 0.999 && bar.closeLocation < -0.18;
  const rejection = lowerBandRejection ? 0.24 : upperBandRejection ? -0.24 : pattern * 0.07;
  const meanReversion = clamp(
    -bandStretch * 0.36 - vwapStretch * 0.22 + rsiReversion * 0.25 + rejection,
    -1,
    1,
  );
  const breakout = clamp(
    orb * 0.36 + levelBreakout * 0.26 + squeeze * 0.2 + volume * 0.18,
    -1,
    1,
  );
  const trendFollowing = clamp(
    trend * 0.48 + vwap * 0.18 + pullback * 0.22 + pattern * 0.12,
    -1,
    1,
  );
  const momentumEngine = clamp(
    momentum * 0.4 + rsiTrend * 0.18 + macdDirection * 0.17 + volume * 0.16 + pattern * 0.09,
    -1,
    1,
  );
  const algorithms = {
    trendFollowing,
    momentum: momentumEngine,
    meanReversion,
    breakout,
  };
  const algorithmEntries: Array<[StrategyAlgorithm, number]> = [
    ["Trend following", trendFollowing],
    ["Momentum", momentumEngine],
    ["Mean reversion", meanReversion],
    ["Volume breakout", breakout],
  ];
  algorithmEntries.sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  const algorithm = algorithmEntries[0][0];

  const factors = {
    trend,
    rsi: rsiEdge,
    momentum,
    volatility,
    vwap,
    volume,
    orb,
    pullback,
    squeeze,
    levels,
    pattern,
  };
  const rawScore =
    trend * weights.trend +
    rsiEdge * weights.rsi +
    momentum * weights.momentum +
    volatility * weights.volatility +
    vwap * weights.vwap +
    volume * weights.volume +
    orb * weights.orb +
    pullback * weights.pullback +
    squeeze * weights.squeeze +
    levels * weights.levels +
    pattern * weights.pattern;

  const regimeScore = regime === "TREND"
    ? trendFollowing * 0.44 + momentumEngine * 0.3 + breakout * 0.2 + meanReversion * 0.06
    : regime === "SQUEEZE"
      ? breakout * 0.48 + momentumEngine * 0.28 + trendFollowing * 0.18 + meanReversion * 0.06
      : meanReversion * 0.5 + breakout * 0.18 + momentumEngine * 0.16 + trendFollowing * 0.16;

  const direction = Math.sign(rawScore * 0.58 + regimeScore * 0.42);
  const directionalFactors = [
    trend,
    rsiEdge,
    momentum,
    vwap,
    volume,
    orb,
    pullback,
    squeeze,
    levels,
    pattern,
    trendFollowing,
    momentumEngine,
    meanReversion,
    breakout,
  ];
  const confluence = direction === 0
    ? 0
    : directionalFactors.filter((factor) => Math.sign(factor) === direction && Math.abs(factor) >= 0.16).length;
  const agreementBoost = 0.8 + Math.min(7, confluence) * 0.055;
  const score = clamp((rawScore * 1.28 + regimeScore * 0.72) * agreementBoost, -1, 1);
  let setup = "Multi-signal confluence";
  if (explain) {
    const labels: Array<[keyof typeof factors, string]> = [
      ["orb", "Opening range breakout"],
      ["pullback", "VWAP / EMA pullback"],
      ["squeeze", "Bollinger squeeze"],
      ["levels", "Key-level reaction"],
      ["momentum", "Momentum continuation"],
      ["trend", "EMA / ADX trend"],
      ["vwap", "VWAP alignment"],
      ["volume", "Volume confirmation"],
      ["pattern", "Confirmation candle"],
      ["rsi", "RSI regime signal"],
      ["volatility", "Range expansion"],
    ];
    labels.sort((a, b) => Math.abs(factors[b[0]] * weights[b[0]]) - Math.abs(factors[a[0]] * weights[a[0]]));
    setup = labels[0][1];
  }

  return {
    score,
    factors,
    algorithms,
    algorithm,
    confluence,
    regime,
    setup,
    stopAtr: regime === "SQUEEZE" ? 0.9 : regime === "TREND" ? 0.82 : 0.65,
    rewardRisk: regime === "SQUEEZE" ? 1.85 : regime === "TREND" ? 1.55 : 1.15,
  };
}

function intradayEntryThreshold(weights: ModelWeights) {
  return clamp(weights.threshold * 0.68, 0.12, 0.2);
}

function pendingEntryForBar(
  bar: MarketBar,
  weights: ModelWeights,
  scored: ReturnType<typeof scoreBar>,
): PendingEntry | null {
  const algorithmStrength = Math.max(
    Math.abs(scored.algorithms.trendFollowing),
    Math.abs(scored.algorithms.momentum),
    Math.abs(scored.algorithms.meanReversion),
    Math.abs(scored.algorithms.breakout),
  );
  if (
    bar.barInSession < OPENING_RANGE_BARS - 1 ||
    bar.barInSession >= LAST_ENTRY_BAR ||
    bar.volumeRatio <= 0.48 ||
    algorithmStrength < 0.2 ||
    scored.confluence < 2 ||
    !(
      Math.abs(scored.factors.orb) >= 0.16 ||
      Math.abs(scored.factors.pullback) >= 0.16 ||
      Math.abs(scored.factors.squeeze) >= 0.13 ||
      Math.abs(scored.factors.levels) >= 0.22 ||
      Math.abs(scored.algorithms.meanReversion) >= 0.3 ||
      Math.abs(scored.algorithms.breakout) >= 0.24 ||
      Math.abs(scored.algorithms.momentum) >= 0.3 ||
      scored.confluence >= 4
    )
  ) return null;

  const threshold = intradayEntryThreshold(weights);
  const dynamicThreshold = threshold * (bar.barInSession >= 66 ? 1.08 : bar.barInSession >= 30 && bar.barInSession <= 48 ? 1.03 : 1);
  const side = scored.score > dynamicThreshold
    ? "LONG"
    : scored.score < -dynamicThreshold
      ? "SHORT"
      : null;
  if (!side) return null;
  return {
    side,
    setup: scored.setup,
    confidence: Math.round(clamp(48 + Math.abs(scored.score) * 35 + scored.confluence * 3.2, 50, 98)),
    stopAtr: scored.stopAtr,
    rewardRisk: scored.rewardRisk,
    maxHoldBars: scored.regime === "TREND" ? 8 : scored.regime === "SQUEEZE" ? 7 : 4,
    reason: `${scored.algorithm} / ${scored.setup} / ${scored.regime.toLowerCase()} / ${scored.confluence} confirmations`,
    signalPrice: bar.close,
    signalAtr: bar.atr,
    signalTimestamp: bar.timestamp,
    regime: scored.regime,
    algorithm: scored.algorithm,
  };
}

function entryRiskPlan(signal: PendingEntry, equity: number, referencePrice: number) {
  const stopDistance = Math.max(signal.signalAtr * signal.stopAtr, referencePrice * 0.0012);
  const allocationFraction = signal.regime === "RANGE" ? 0.9 : signal.regime === "SQUEEZE" ? 0.95 : 0.97;
  return {
    stopDistance,
    riskBudget: Math.max(0, equity) * RISK_PER_TRADE_FRACTION,
    allocation: Math.max(0, equity) * allocationFraction,
  };
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
      averageWeekReturn: 0,
      positiveWeekRate: 0,
      totalFees: 0,
      totalSlippage: 0,
      averageSpread: 0,
    };
  }

  let cash = startingCapital;
  let shares = 0;
  let entryPrice = 0;
  let entryIndex = -1;
  let entryRisk = 0;
  let stopPrice = 0;
  let targetPrice = 0;
  let maxHoldBars = 9;
  let entryFees = 0;
  let pendingEntry: PendingEntry | null = null;
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
  let dailyStartEquity = startingCapital;
  let dailyLocked = false;
  let completedSessions = 0;
  let weekStartEquity = startingCapital;
  let totalFees = 0;
  let totalSlippage = 0;
  let spreadTotal = 0;
  let fillCount = 0;
  const sessions = new Set<string>();
  const weeklyReturns: number[] = [];
  const trades: Trade[] = [];
  const equity: number[] = [];
  const scores: number[] = [];
  const provisionalHoldShares = startingCapital / data[0].open;
  const holdEntry = executionFill(data[0], "BUY", data[0].open, provisionalHoldShares);
  const holdShares = startingCapital / (holdEntry.price + CAT_FEE_PER_SHARE);
  const holdExit = executionFill(data[data.length - 1], "SELL", data[data.length - 1].close, holdShares);
  const holdFinalValue = holdShares * holdExit.price - holdExit.fees;
  const buyHoldEquity = collectSeries
    ? data.map((bar, index) => index === data.length - 1 ? holdFinalValue : holdShares * bar.close)
    : [];

  data.forEach((bar, index) => {
    sessions.add(bar.date);
    if (bar.date !== currentSession) {
      if (currentSession) {
        completedSessions += 1;
        if (completedSessions % 5 === 0) {
          weeklyReturns.push(previousEquity / weekStartEquity - 1);
          weekStartEquity = previousEquity;
        }
      }
      currentSession = bar.date;
      entriesThisSession = 0;
      cooldownBars = 0;
      dailyStartEquity = cash + shares * bar.open;
      dailyLocked = false;
    }
    if (cooldownBars > 0) cooldownBars -= 1;

    if (pendingEntry && pendingEntry.signalTimestamp.slice(0, 10) !== bar.date) {
      pendingEntry = null;
    }
    if (pendingEntry && shares === 0 && bar.barInSession <= LAST_ENTRY_BAR) {
      const { stopDistance, riskBudget, allocation } = entryRiskPlan(pendingEntry, cash, bar.open);
      const provisionalQuantity = Math.floor(Math.min(allocation / bar.open, riskBudget / stopDistance));
      if (provisionalQuantity > 0) {
        const side: TradeSide = pendingEntry.side === "LONG" ? "BUY" : "SHORT";
        const provisionalFill = executionFill(bar, side, bar.open, provisionalQuantity);
        const quantity = Math.floor(Math.min(allocation / provisionalFill.price, riskBudget / stopDistance));
        if (quantity > 0) {
          const fill = executionFill(bar, side, bar.open, quantity);
          const notional = quantity * fill.price;
          const cashChange = pendingEntry.side === "LONG" ? -(notional + fill.fees) : notional - fill.fees;
          if (pendingEntry.side === "SHORT" || cash + cashChange >= 0) {
            cash += cashChange;
            shares = pendingEntry.side === "LONG" ? quantity : -quantity;
            entryPrice = fill.price;
            entryIndex = index;
            entryRisk = stopDistance;
            stopPrice = pendingEntry.side === "LONG" ? fill.price - stopDistance : fill.price + stopDistance;
            targetPrice = pendingEntry.side === "LONG"
              ? fill.price + stopDistance * pendingEntry.rewardRisk
              : fill.price - stopDistance * pendingEntry.rewardRisk;
            maxHoldBars = pendingEntry.maxHoldBars;
            entryFees = fill.fees;
            entriesThisSession += 1;
            if (pendingEntry.side === "LONG") longEntries += 1;
            else shortEntries += 1;
            totalFees += fill.fees;
            totalSlippage += fill.slippage;
            spreadTotal += fill.spread;
            fillCount += 1;
            if (collectTrades) trades.push({
              id: `${side.toLowerCase()}-${bar.timestamp}-${index}`,
              date: bar.date,
              time: bar.time,
              timestamp: bar.timestamp,
              side,
              price: fill.price,
              shares: quantity,
              value: pendingEntry.side === "LONG" ? notional + fill.fees : notional - fill.fees,
              fees: fill.fees,
              slippage: fill.slippage,
              pnl: null,
              confidence: pendingEntry.confidence,
              reason: pendingEntry.reason,
            });
          }
        }
      }
      pendingEntry = null;
    }

    const scored = scoreBar(bar, weights, collectTrades);
    const score = scored.score;
    latestScore = score;
    if (collectSeries) scores.push(score);
    const confidence = Math.round(clamp(48 + Math.abs(score) * 35 + scored.confluence * 3.2, 50, 98));
    const heldBars = entryIndex >= 0 ? index - entryIndex : 0;
    const sessionClose = bar.barInSession === BARS_PER_SESSION - 1;
    const threshold = intradayEntryThreshold(weights);
    let exitReason = "";
    let exitReference = 0;
    let exitKind: FillKind = "market";

    if (shares > 0) {
      const stopHit = bar.low <= stopPrice;
      const targetHit = bar.high >= targetPrice;
      if (stopHit) {
        exitReason = stopPrice >= entryPrice ? "Protected stop" : "ATR risk stop";
        exitReference = Math.min(stopPrice, bar.open);
        exitKind = "stop";
      } else if (targetHit) {
        exitReason = "Risk / reward target";
        exitReference = targetPrice;
        exitKind = "limit";
      } else if (sessionClose) {
        exitReason = "Closing bell";
        exitReference = bar.close;
      } else if (heldBars >= maxHoldBars) {
        exitReason = "Time stop";
        exitReference = bar.close;
      } else if (score < -threshold * 0.72 && scored.confluence >= 3) {
        exitReason = "Confluence reversed";
        exitReference = bar.close;
      } else if (heldBars >= 1) {
        if (bar.high >= entryPrice + entryRisk) stopPrice = Math.max(stopPrice, entryPrice * 1.0002);
        stopPrice = Math.max(stopPrice, bar.close - bar.atr * (scored.regime === "TREND" ? 0.78 : 0.62));
      }
    } else if (shares < 0) {
      const stopHit = bar.high >= stopPrice;
      const targetHit = bar.low <= targetPrice;
      if (stopHit) {
        exitReason = stopPrice <= entryPrice ? "Protected stop" : "ATR risk stop";
        exitReference = Math.max(stopPrice, bar.open);
        exitKind = "stop";
      } else if (targetHit) {
        exitReason = "Risk / reward target";
        exitReference = targetPrice;
        exitKind = "limit";
      } else if (sessionClose) {
        exitReason = "Closing bell";
        exitReference = bar.close;
      } else if (heldBars >= maxHoldBars) {
        exitReason = "Time stop";
        exitReference = bar.close;
      } else if (score > threshold * 0.72 && scored.confluence >= 3) {
        exitReason = "Confluence reversed";
        exitReference = bar.close;
      } else if (heldBars >= 1) {
        if (bar.low <= entryPrice - entryRisk) stopPrice = Math.min(stopPrice, entryPrice * 0.9998);
        stopPrice = Math.min(stopPrice, bar.close + bar.atr * (scored.regime === "TREND" ? 0.78 : 0.62));
      }
    }

    if (shares > 0 && exitReason) {
      const quantity = shares;
      const fill = executionFill(bar, "SELL", exitReference, quantity, exitKind);
      const notional = quantity * fill.price;
      const proceeds = notional - fill.fees;
      const pnl = (fill.price - entryPrice) * quantity - fill.fees - entryFees;
      cash += proceeds;
      totalFees += fill.fees;
      totalSlippage += fill.slippage;
      spreadTotal += fill.spread;
      fillCount += 1;
      exits += 1;
      totalHoldBars += heldBars;
      if (pnl > 0) wins += 1;
      if (collectTrades) trades.push({
        id: `sell-${bar.timestamp}-${index}`,
        date: bar.date,
        time: bar.time,
        timestamp: bar.timestamp,
        side: "SELL",
        price: fill.price,
        shares: quantity,
        value: proceeds,
        fees: fill.fees,
        slippage: fill.slippage,
        pnl,
        confidence,
        reason: exitReason,
      });
      shares = 0;
      entryPrice = 0;
      entryIndex = -1;
      entryRisk = 0;
      stopPrice = 0;
      targetPrice = 0;
      entryFees = 0;
      cooldownBars = pnl < 0 ? LOSS_COOLDOWN_BARS : 0;
    } else if (shares < 0 && exitReason) {
      const quantity = Math.abs(shares);
      const fill = executionFill(bar, "COVER", exitReference, quantity, exitKind);
      const notional = quantity * fill.price;
      const cost = notional + fill.fees;
      const pnl = (entryPrice - fill.price) * quantity - fill.fees - entryFees;
      cash -= cost;
      totalFees += fill.fees;
      totalSlippage += fill.slippage;
      spreadTotal += fill.spread;
      fillCount += 1;
      exits += 1;
      totalHoldBars += heldBars;
      if (pnl > 0) wins += 1;
      if (collectTrades) trades.push({
        id: `cover-${bar.timestamp}-${index}`,
        date: bar.date,
        time: bar.time,
        timestamp: bar.timestamp,
        side: "COVER",
        price: fill.price,
        shares: quantity,
        value: cost,
        fees: fill.fees,
        slippage: fill.slippage,
        pnl,
        confidence,
        reason: exitReason,
      });
      shares = 0;
      entryPrice = 0;
      entryIndex = -1;
      entryRisk = 0;
      stopPrice = 0;
      targetPrice = 0;
      entryFees = 0;
      cooldownBars = pnl < 0 ? LOSS_COOLDOWN_BARS : 0;
    } else if (
      shares === 0 &&
      !pendingEntry &&
      cooldownBars === 0 &&
      !dailyLocked &&
      entriesThisSession < MAX_ENTRIES_PER_SESSION
    ) {
      pendingEntry = pendingEntryForBar(bar, weights, scored);
    }

    const portfolioValue = cash + shares * bar.close;
    if (collectSeries) equity.push(portfolioValue);
    peak = Math.max(peak, portfolioValue);
    maxDrawdown = Math.min(maxDrawdown, portfolioValue / peak - 1);
    if (portfolioValue <= dailyStartEquity * (1 - DAILY_LOSS_LIMIT_FRACTION)) dailyLocked = true;
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
  const buyHoldReturn = holdFinalValue / startingCapital - 1;
  const returnDeviation = Math.sqrt(returnSquaredDelta / Math.max(1, returnCount));
  if (weeklyReturns.length < Math.ceil(sessions.size / 5)) {
    weeklyReturns.push(finalValue / weekStartEquity - 1);
  }
  const averageWeekReturn = weeklyReturns.reduce((sum, value) => sum + value, 0) / Math.max(1, weeklyReturns.length);
  const positiveWeekRate = weeklyReturns.filter((value) => value > 0).length / Math.max(1, weeklyReturns.length);
  const entryThreshold = intradayEntryThreshold(weights);
  const signal = latestScore > entryThreshold ? "BUY" : latestScore < -entryThreshold ? "SHORT" : "HOLD";

  return {
    finalValue,
    strategyReturn,
    buyHoldReturn,
    alpha: strategyReturn - buyHoldReturn,
    maxDrawdown,
    sharpe: returnDeviation === 0 ? 0 : (averageReturn / returnDeviation) * Math.sqrt(252 * BARS_PER_SESSION),
    winRate: exits === 0 ? 0 : wins / exits,
    trades,
    equity,
    buyHoldEquity,
    scores,
    signal,
    confidence: Math.round(clamp(50 + Math.abs(latestScore) * 45, 50, 98)),
    longEntries,
    shortEntries,
    roundTrips: exits,
    tradesPerDay: exits / Math.max(1, sessions.size),
    averageHoldBars: exits === 0 ? 0 : totalHoldBars / exits,
    averageWeekReturn,
    positiveWeekRate,
    totalFees,
    totalSlippage,
    averageSpread: fillCount === 0 ? 0 : spreadTotal / fillCount,
  };
}

function appendPaperMark(account: PaperAccount, bar: MarketBar): PaperAccount {
  return {
    ...account,
    lastBarTimestamp: bar.timestamp,
    orders: account.orders.slice(0, 80),
    equityHistory: [
      ...account.equityHistory,
      { time: bar.timestamp, value: account.cash + account.shares * bar.close },
    ].slice(-160),
  };
}

function advancePaperAccount(
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
      exitReason = "Time stop";
      exitReference = bar.close;
    } else if (scored.score < -threshold * 0.72 && scored.confluence >= 3) {
      exitReason = "Confluence reversed";
      exitReference = bar.close;
    } else if (heldBars >= 1) {
      const protectedStop = bar.high >= next.avgPrice + next.entryRisk
        ? Math.max(next.stopPrice, next.avgPrice * 1.0002)
        : next.stopPrice;
      next.stopPrice = Math.max(protectedStop, bar.close - bar.atr * (scored.regime === "TREND" ? 0.78 : 0.62));
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
      exitReason = "Time stop";
      exitReference = bar.close;
    } else if (scored.score > threshold * 0.72 && scored.confluence >= 3) {
      exitReason = "Confluence reversed";
      exitReference = bar.close;
    } else if (heldBars >= 1) {
      const protectedStop = bar.low <= next.avgPrice - next.entryRisk
        ? Math.min(next.stopPrice, next.avgPrice * 0.9998)
        : next.stopPrice;
      next.stopPrice = Math.min(protectedStop, bar.close + bar.atr * (scored.regime === "TREND" ? 0.78 : 0.62));
    }
  }

  if (next.shares !== 0 && exitReason) {
    const quantity = Math.abs(next.shares);
    const side: TradeSide = next.shares > 0 ? "SELL" : "COVER";
    const fill = executionFill(bar, side, exitReference, quantity, exitKind);
    const notional = quantity * fill.price;
    const pnl = next.shares > 0
      ? (fill.price - next.avgPrice) * quantity - fill.fees - next.entryFees
      : (next.avgPrice - fill.price) * quantity - fill.fees - next.entryFees;
    next = {
      ...next,
      cash: next.shares > 0 ? next.cash + notional - fill.fees : next.cash - notional - fill.fees,
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
      maxHoldBars: 9,
      cooldownBars: pnl < 0 ? LOSS_COOLDOWN_BARS : 0,
      realized: next.realized + pnl,
      orders: [{
        id: `paper-${side.toLowerCase()}-${bar.timestamp}-${next.orders.length}`,
        time: `${bar.date} ${bar.time} ET`,
        side,
        shares: quantity,
        price: fill.price,
        fees: fill.fees,
        slippage: fill.slippage,
        note: exitReason,
      }, ...next.orders],
    };
  } else if (
    next.shares === 0 &&
    !next.pendingEntry &&
    next.cooldownBars === 0 &&
    !next.dailyLocked &&
    next.entriesThisSession < MAX_ENTRIES_PER_SESSION
  ) {
    next.pendingEntry = pendingEntryForBar(bar, weights, scored);
  } else if (next.shares !== 0) {
    next.barsHeld += 1;
  }

  const equity = next.cash + next.shares * bar.close;
  if (equity <= next.dailyStartEquity * (1 - DAILY_LOSS_LIMIT_FRACTION)) next.dailyLocked = true;
  return appendPaperMark(next, bar);
}

function oracleAction(data: MarketBar[], index: number): Position {
  const futureBars: MarketBar[] = [];
  for (let offset = 1; offset <= 4 && index + offset < data.length; offset += 1) {
    if (data[index + offset].date !== data[index].date) break;
    futureBars.push(data[index + offset]);
  }
  if (futureBars.length === 0) return "FLAT";
  const entry = data[index].close;
  const longOpportunity = Math.max(...futureBars.map((bar) => bar.high / entry - 1));
  const shortOpportunity = Math.max(...futureBars.map((bar) => entry / bar.low - 1));
  const minimumMove = 0.0024;
  if (longOpportunity > minimumMove && longOpportunity > shortOpportunity + 0.0005) return "LONG";
  if (shortOpportunity > minimumMove && shortOpportunity > longOpportunity + 0.0005) return "SHORT";
  return "FLAT";
}

function policyAction(bar: MarketBar, weights: ModelWeights): Position {
  const score = scoreBar(bar, weights, false).score;
  const threshold = intradayEntryThreshold(weights);
  if (score > threshold) return "LONG";
  if (score < -threshold) return "SHORT";
  return "FLAT";
}

function teacherAgreement(data: MarketBar[], weights: ModelWeights) {
  if (data.length < 30) return 0;
  const classTotals: Record<Position, number> = { LONG: 0, SHORT: 0, FLAT: 0 };
  const classMatches: Record<Position, number> = { LONG: 0, SHORT: 0, FLAT: 0 };
  for (let index = 22; index < data.length - 5; index += 1) {
    const teacher = oracleAction(data, index);
    const policy = policyAction(data[index], weights);
    classTotals[teacher] += 1;
    if (teacher === policy) classMatches[teacher] += 1;
  }
  const recalls = (["LONG", "SHORT", "FLAT"] as Position[])
    .filter((label) => classTotals[label] > 0)
    .map((label) => classMatches[label] / classTotals[label]);
  return recalls.length === 0 ? 0 : recalls.reduce((sum, value) => sum + value, 0) / recalls.length;
}

function splitForTraining(data: MarketBar[]) {
  const sessions = [...new Set(data.map((bar) => bar.date))];
  const splitSessionIndex = Math.max(
    20,
    Math.min(sessions.length - 10, Math.floor(sessions.length * 0.72)),
  );
  const validationStart = sessions[splitSessionIndex] ?? sessions[sessions.length - 1] ?? "";
  return {
    trainingData: data.filter((bar) => bar.date < validationStart),
    validationData: data.filter((bar) => bar.date >= validationStart),
  };
}

function evaluateModel(data: MarketBar[], weights: ModelWeights) {
  const { trainingData, validationData } = splitForTraining(data);
  const trainingResult = runBacktest(trainingData, weights, STARTING_CAPITAL, false);
  const validationResult = runBacktest(validationData, weights, STARTING_CAPITAL, false);
  const agreement = teacherAgreement(trainingData, weights);
  const turnoverPenalty = Math.max(0, validationResult.tradesPerDay - 14);
  const undertradingPenalty = Math.max(0, 6 - validationResult.tradesPerDay);
  const cadenceReward = Math.min(10, validationResult.tradesPerDay) * 0.0022;
  const objective =
    validationResult.strategyReturn * 0.58 +
    validationResult.alpha * 0.42 +
    validationResult.averageWeekReturn * 1.4 +
    validationResult.positiveWeekRate * 0.025 +
    validationResult.sharpe * 0.012 -
    Math.abs(validationResult.maxDrawdown) * 0.38 +
    trainingResult.strategyReturn * 0.1 +
    agreement * 0.08 -
    turnoverPenalty * 0.012 -
    undertradingPenalty * 0.012 +
    cadenceReward;

  return { objective, agreement, trainingResult, validationResult };
}

function teacherSeedModel(data: MarketBar[], current: ModelWeights): ModelWeights {
  const totals = {
    trend: 0,
    rsi: 0,
    momentum: 0,
    volatility: 0,
    vwap: 0,
    volume: 0,
    orb: 0,
    pullback: 0,
    squeeze: 0,
    levels: 0,
    pattern: 0,
  };
  let examples = 0;
  for (let index = 22; index < data.length - 5; index += 1) {
    const teacher = oracleAction(data, index);
    const target = teacher === "LONG" ? 1 : teacher === "SHORT" ? -1 : 0;
    const factors = scoreBar(data[index], current, false).factors;
    totals.trend += factors.trend * target;
    totals.rsi += factors.rsi * target;
    totals.momentum += factors.momentum * target;
    totals.volatility += factors.volatility * target;
    totals.vwap += factors.vwap * target;
    totals.volume += factors.volume * target;
    totals.orb += factors.orb * target;
    totals.pullback += factors.pullback * target;
    totals.squeeze += factors.squeeze * target;
    totals.levels += factors.levels * target;
    totals.pattern += factors.pattern * target;
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
    orb: Math.max(0.02, totals.orb / examples),
    pullback: Math.max(0.02, totals.pullback / examples),
    squeeze: Math.max(0.015, totals.squeeze / examples),
    levels: Math.max(0.015, totals.levels / examples),
    pattern: Math.max(0.015, totals.pattern / examples),
  };
  const sum = Object.values(learned).reduce((total, value) => total + value, 0);
  const blend = 0.34;
  return normalizeModel({
    trend: current.trend * (1 - blend) + (learned.trend / sum) * blend,
    rsi: current.rsi * (1 - blend) + (learned.rsi / sum) * blend,
    momentum: current.momentum * (1 - blend) + (learned.momentum / sum) * blend,
    volatility: current.volatility * (1 - blend) + (learned.volatility / sum) * blend,
    vwap: current.vwap * (1 - blend) + (learned.vwap / sum) * blend,
    volume: current.volume * (1 - blend) + (learned.volume / sum) * blend,
    orb: current.orb * (1 - blend) + (learned.orb / sum) * blend,
    pullback: current.pullback * (1 - blend) + (learned.pullback / sum) * blend,
    squeeze: current.squeeze * (1 - blend) + (learned.squeeze / sum) * blend,
    levels: current.levels * (1 - blend) + (learned.levels / sum) * blend,
    pattern: current.pattern * (1 - blend) + (learned.pattern / sum) * blend,
    threshold: current.threshold * 0.8 + INITIAL_MODEL.threshold * 0.2,
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
    levels: true,
    rsi: true,
    trades: true,
  });

  const requestedBars = viewport === "ALL" ? data.length : viewport === "1M" ? BARS_PER_SESSION * 22 : viewport === "2W" ? BARS_PER_SESSION * 10 : BARS_PER_SESSION * 5;
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
      const drawAverage = (key: "ema9" | "ema21" | "ema50", color: string, width = 1.6) => {
        context.beginPath();
        visible.forEach((bar, index) => {
          if (index === 0) context.moveTo(x(index), yPrice(bar[key]));
          else context.lineTo(x(index), yPrice(bar[key]));
        });
        context.strokeStyle = color;
        context.lineWidth = width;
        context.stroke();
      };
      drawAverage("ema9", "#f0c66b");
      drawAverage("ema21", "#a99cf6");
      drawAverage("ema50", "rgba(79,167,232,0.72)", 1.15);
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

    if (layers.levels) {
      const drawSessionLevel = (
        key: "openingHigh" | "openingLow" | "priorHigh" | "priorLow",
        color: string,
        dash: number[],
      ) => {
        context.beginPath();
        visible.forEach((bar, index) => {
          if (index === 0 || visible[index - 1].date !== bar.date) context.moveTo(x(index), yPrice(bar[key]));
          else context.lineTo(x(index), yPrice(bar[key]));
        });
        context.setLineDash(dash);
        context.strokeStyle = color;
        context.lineWidth = 1;
        context.stroke();
        context.setLineDash([]);
      };
      drawSessionLevel("openingHigh", "rgba(240,198,107,0.62)", [5, 4]);
      drawSessionLevel("openingLow", "rgba(240,198,107,0.62)", [5, 4]);
      drawSessionLevel("priorHigh", "rgba(169,156,246,0.34)", [2, 5]);
      drawSessionLevel("priorLow", "rgba(169,156,246,0.34)", [2, 5]);
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
          <span className="legend-swatch double" /> EMA 9 / 21 / 50
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
          className={layers.levels ? "legend-chip active" : "legend-chip"}
          onClick={() => toggleLayer("levels")}
          type="button"
        >
          <span className="legend-swatch levels" /> ORB / key levels
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
          aria-label="AAPL intraday candlestick chart with EMA 9, 21, and 50, VWAP, Bollinger Bands, opening range, key levels, RSI, ADX and OBV-informed policy score, volume, and trade markers"
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
              <span>ADX <b>{hoverBar.adx.toFixed(1)}</b></span>
              <span>OBV flow <b>{hoverBar.obvSlope >= 0 ? "+" : ""}{hoverBar.obvSlope.toFixed(2)}</b></span>
              <span>ORB <b>{hoverBar.openingLow.toFixed(2)}–{hoverBar.openingHigh.toFixed(2)}</b></span>
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

function PortfolioChart({ history, theme, baseline }: { history: PaperAccount["equityHistory"]; theme: "light" | "dark"; baseline: number }) {
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
    const values = history.length > 1 ? history.map((point) => point.value) : [baseline, baseline];
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
  }, [baseline, history, revision, theme]);

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
    orb: clamp(finiteNumber(model.orb, INITIAL_MODEL.orb), 0.02, 0.7),
    pullback: clamp(finiteNumber(model.pullback, INITIAL_MODEL.pullback), 0.02, 0.65),
    squeeze: clamp(finiteNumber(model.squeeze, INITIAL_MODEL.squeeze), 0.015, 0.55),
    levels: clamp(finiteNumber(model.levels, INITIAL_MODEL.levels), 0.015, 0.5),
    pattern: clamp(finiteNumber(model.pattern, INITIAL_MODEL.pattern), 0.015, 0.5),
  };
  const sum = Object.values(raw).reduce((total, item) => total + item, 0);
  return {
    trend: raw.trend / sum,
    rsi: raw.rsi / sum,
    momentum: raw.momentum / sum,
    volatility: raw.volatility / sum,
    vwap: raw.vwap / sum,
    volume: raw.volume / sum,
    orb: raw.orb / sum,
    pullback: raw.pullback / sum,
    squeeze: raw.squeeze / sum,
    levels: raw.levels / sum,
    pattern: raw.pattern / sum,
    threshold: clamp(finiteNumber(model.threshold, INITIAL_MODEL.threshold), 0.16, 0.3),
  };
}

function migrateModel(value: unknown, version: number): ModelWeights {
  const saved = normalizeModel(value);
  if (version >= MODEL_STATE_VERSION) return saved;
  const keep = 0.35;
  return normalizeModel({
    trend: saved.trend * keep + INITIAL_MODEL.trend * (1 - keep),
    rsi: saved.rsi * keep + INITIAL_MODEL.rsi * (1 - keep),
    momentum: saved.momentum * keep + INITIAL_MODEL.momentum * (1 - keep),
    volatility: saved.volatility * keep + INITIAL_MODEL.volatility * (1 - keep),
    vwap: saved.vwap * keep + INITIAL_MODEL.vwap * (1 - keep),
    volume: saved.volume * keep + INITIAL_MODEL.volume * (1 - keep),
    orb: saved.orb * keep + INITIAL_MODEL.orb * (1 - keep),
    pullback: saved.pullback * keep + INITIAL_MODEL.pullback * (1 - keep),
    squeeze: saved.squeeze * keep + INITIAL_MODEL.squeeze * (1 - keep),
    levels: saved.levels * keep + INITIAL_MODEL.levels * (1 - keep),
    pattern: saved.pattern * keep + INITIAL_MODEL.pattern * (1 - keep),
    threshold: saved.threshold * keep + INITIAL_MODEL.threshold * (1 - keep),
  });
}

function normalizeProfile(value: unknown): UserProfile {
  const profile = (value ?? {}) as Partial<UserProfile>;
  const avatarPresets: AvatarPreset[] = ["mint", "ocean", "violet", "sunset", "graphite", "rose"];
  return {
    displayName: typeof profile.displayName === "string" ? profile.displayName.trim().slice(0, 32) : "",
    avatarPreset: avatarPresets.includes(profile.avatarPreset as AvatarPreset)
      ? profile.avatarPreset as AvatarPreset
      : INITIAL_PROFILE.avatarPreset,
  };
}

function normalizePreferences(value: unknown): LabPreferences {
  const preferences = (value ?? {}) as Partial<LabPreferences>;
  const launchView: LaunchView = preferences.launchView === "train" || preferences.launchView === "paper"
    ? preferences.launchView
    : "chart";
  return {
    paperStartingCash: clamp(
      Math.round(finiteNumber(preferences.paperStartingCash, PAPER_STARTING_CASH)),
      100,
      1_000_000,
    ),
    launchView,
    animations: preferences.animations !== false,
    autoRun: preferences.autoRun === true,
  };
}

function normalizePaper(value: unknown, startingCash = PAPER_STARTING_CASH): PaperAccount {
  const paper = (value ?? {}) as Partial<PaperAccount>;
  const pending = paper.pendingEntry && typeof paper.pendingEntry === "object"
    ? paper.pendingEntry as PendingEntry
    : null;
  return {
    cash: finiteNumber(paper.cash, startingCash),
    shares: Math.trunc(finiteNumber(paper.shares, 0)),
    avgPrice: Math.max(0, finiteNumber(paper.avgPrice, 0)),
    positionOpenedAt: Math.max(0, finiteNumber(paper.positionOpenedAt, 0)),
    stopPrice: Math.max(0, finiteNumber(paper.stopPrice, 0)),
    targetPrice: Math.max(0, finiteNumber(paper.targetPrice, 0)),
    entrySetup: typeof paper.entrySetup === "string" ? paper.entrySetup : "",
    entryFees: Math.max(0, finiteNumber(paper.entryFees, 0)),
    entrySlippage: Math.max(0, finiteNumber(paper.entrySlippage, 0)),
    entryRisk: Math.max(0, finiteNumber(paper.entryRisk, 0)),
    barsHeld: Math.max(0, Math.trunc(finiteNumber(paper.barsHeld, 0))),
    maxHoldBars: Math.max(1, Math.trunc(finiteNumber(paper.maxHoldBars, 9))),
    pendingEntry: pending && (pending.side === "LONG" || pending.side === "SHORT")
      ? {
          side: pending.side,
          setup: typeof pending.setup === "string" ? pending.setup : "Multi-signal confluence",
          confidence: clamp(finiteNumber(pending.confidence, 50), 0, 100),
          stopAtr: Math.max(0.1, finiteNumber(pending.stopAtr, 0.9)),
          rewardRisk: Math.max(0.5, finiteNumber(pending.rewardRisk, 1.5)),
          maxHoldBars: Math.max(1, Math.trunc(finiteNumber(pending.maxHoldBars, 9))),
          reason: typeof pending.reason === "string" ? pending.reason : "Saved five-minute signal",
          signalPrice: Math.max(0.01, finiteNumber(pending.signalPrice, 1)),
          signalAtr: Math.max(0.01, finiteNumber(pending.signalAtr, 0.5)),
          signalTimestamp: typeof pending.signalTimestamp === "string" ? pending.signalTimestamp : "",
          regime: pending.regime === "TREND" || pending.regime === "SQUEEZE" || pending.regime === "RANGE"
            ? pending.regime
            : "RANGE",
          algorithm: pending.algorithm === "Trend following" ||
            pending.algorithm === "Momentum" ||
            pending.algorithm === "Mean reversion" ||
            pending.algorithm === "Volume breakout"
              ? pending.algorithm
              : "Trend following",
        }
      : null,
    currentSession: typeof paper.currentSession === "string" ? paper.currentSession : "",
    entriesThisSession: Math.max(0, Math.trunc(finiteNumber(paper.entriesThisSession, 0))),
    cooldownBars: Math.max(0, Math.trunc(finiteNumber(paper.cooldownBars, 0))),
    dailyStartEquity: Math.max(0, finiteNumber(paper.dailyStartEquity, startingCash)),
    dailyLocked: Boolean(paper.dailyLocked),
    lastBarTimestamp: typeof paper.lastBarTimestamp === "string" ? paper.lastBarTimestamp : "",
    realized: finiteNumber(paper.realized, 0),
    orders: Array.isArray(paper.orders)
      ? paper.orders.slice(0, 80).map((order) => ({
          ...order,
          fees: Math.max(0, finiteNumber(order.fees, 0)),
          slippage: Math.max(0, finiteNumber(order.slippage, 0)),
        }))
      : [],
    equityHistory: Array.isArray(paper.equityHistory) ? paper.equityHistory.slice(-120) : [],
  };
}

function normalizePersistedState(value: unknown): PersistedLabState | null {
  if (!value || typeof value !== "object") return null;
  const state = value as Partial<PersistedLabState>;
  const range = state.range;
  const savedVersion = Math.trunc(finiteNumber(state.version, 1));
  const preferences = normalizePreferences(state.preferences);
  return {
    version: STATE_VERSION,
    theme: state.theme === "light" || state.theme === "dark" ? state.theme : "light",
    model: migrateModel(state.model, savedVersion),
    trainingEpoch: Math.max(0, Math.trunc(finiteNumber(state.trainingEpoch, 1840))),
    trainingRuns: Array.isArray(state.trainingRuns) ? state.trainingRuns.slice(0, 40) : [],
    paper: normalizePaper(state.paper, preferences.paperStartingCash),
    range: range &&
      typeof range.start === "string" &&
      typeof range.end === "string" &&
      range.start >= BACKTEST_MIN &&
      range.end <= DATA_END &&
      range.start < range.end
      ? range
      : { start: DEFAULT_START, end: DEFAULT_END },
    profile: normalizeProfile(state.profile),
    preferences,
  };
}

export default function Home() {
  const [draftStart, setDraftStart] = useState(DEFAULT_START);
  const [draftEnd, setDraftEnd] = useState(DEFAULT_END);
  const [range, setRange] = useState({ start: DEFAULT_START, end: DEFAULT_END });
  const [viewport, setViewport] = useState<"ALL" | "1M" | "2W" | "5D">("2W");
  const [activeView, setActiveView] = useState<ActiveView>("chart");
  const [backtestTab, setBacktestTab] = useState<"chart" | "performance" | "trades">("chart");
  const [trainingTab, setTrainingTab] = useState<"run" | "checkpoints" | "policy">("run");
  const [portfolioTab, setPortfolioTab] = useState<"account" | "orders" | "automation">("account");
  const [theme, setTheme] = useState<"light" | "dark">("light");
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
  const [accountStatus, setAccountStatus] = useState<"loading" | "anonymous" | "authenticated">("loading");
  const [accountUser, setAccountUser] = useState<AccountUser | null>(null);
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [clock, setClock] = useState<Date | null>(null);
  const [paperActive, setPaperActive] = useState(false);
  const [replayMode, setReplayMode] = useState(false);
  const [paperPrice, setPaperPrice] = useState(PAPER_STREAM[0]?.open ?? MARKET_DATA[MARKET_DATA.length - 1].close);
  const [paperBarIndex, setPaperBarIndex] = useState(0);
  const [paper, setPaper] = useState<PaperAccount>({ ...INITIAL_PAPER });
  const [profile, setProfile] = useState<UserProfile>({ ...INITIAL_PROFILE });
  const [preferences, setPreferences] = useState<LabPreferences>({ ...INITIAL_PREFERENCES });
  const [profileNameDraft, setProfileNameDraft] = useState("");
  const [avatarDraft, setAvatarDraft] = useState<AvatarPreset>(INITIAL_PROFILE.avatarPreset);
  const [capitalDraft, setCapitalDraft] = useState(String(PAPER_STARTING_CASH));
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [toast, setToast] = useState("");
  const saveTimerRef = useRef<number | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const filteredData = useMemo(
    () => MARKET_DATA.filter((bar) => bar.date >= range.start && bar.date <= range.end),
    [range],
  );
  const result = useMemo(() => runBacktest(filteredData, model), [filteredData, model]);
  const sessionCount = useMemo(() => new Set(filteredData.map((bar) => bar.date)).size, [filteredData]);
  const trainingEvaluation = useMemo(
    () => (TRAINING_DATA.length >= BARS_PER_SESSION * 30 ? evaluateModel(TRAINING_DATA, model) : null),
    [model],
  );
  const latest = filteredData[filteredData.length - 1] ?? MARKET_DATA[MARKET_DATA.length - 1];
  const previous = filteredData[filteredData.length - 2] ?? latest;
  const dayMove = latest.close / previous.close - 1;
  const latestDecision = useMemo(() => scoreBar(latest, model), [latest, model]);
  const latestFactors = latestDecision.factors;
  const marketClock = getMarketClock(clock);
  const paperValue = paper.cash + paper.shares * paperPrice;
  const paperPnl = paperValue - preferences.paperStartingCash;
  const paperPosition: Position = paper.shares > 0 ? "LONG" : paper.shares < 0 ? "SHORT" : "FLAT";
  const paperUnrealized =
    paper.shares > 0
      ? (paperPrice - paper.avgPrice) * paper.shares
      : paper.shares < 0
        ? (paper.avgPrice - paperPrice) * Math.abs(paper.shares)
        : 0;
  const validationResult = trainingEvaluation?.validationResult ?? result;
  const currentTeacherAgreement = trainingEvaluation?.agreement ?? 0;
  const trainingSplit = useMemo(() => splitForTraining(TRAINING_DATA), []);
  const trainingSplitCount = trainingSplit.trainingData.length;
  const trainingSessionCount = useMemo(() => new Set(TRAINING_DATA.map((bar) => bar.date)).size, []);

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
      setTheme("light");
      setThemeReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!themeReady) return;
    document.documentElement.dataset.theme = theme;
  }, [theme, themeReady]);

  useEffect(() => {
    document.documentElement.dataset.motion = preferences.animations ? "full" : "reduced";
  }, [preferences.animations]);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) setProfileMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [profileMenuOpen]);

  useEffect(() => {
    let cancelled = false;
    const loadSession = async () => {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        const body = await response.json() as { user?: AccountUser | null };
        if (!response.ok) throw new Error("Account service unavailable");
        if (cancelled) return;
        if (body.user) {
          setAccountUser(body.user);
          setAccountStatus("authenticated");
        } else {
          setAccountStatus("anonymous");
        }
      } catch {
        if (!cancelled) {
          setAccountStatus("anonymous");
          setAuthError("Account storage is temporarily unavailable. You can retry in a moment.");
        }
      }
    };
    void loadSession();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (accountStatus !== "authenticated" || !accountUser) {
      return;
    }
    let cancelled = false;
    const loadPersistentState = async () => {
      setSyncStatus("loading");
      try {
        const response = await fetch("/api/state", { cache: "no-store" });
        if (response.status === 401) {
          setAccountUser(null);
          setAccountStatus("anonymous");
          return;
        }
        if (!response.ok) throw new Error("State load failed");
        const body = (await response.json()) as { state?: unknown };
        const saved = normalizePersistedState(body.state);
        if (!cancelled && saved) {
          setModel(saved.model);
          setTheme(saved.theme);
          setTrainingEpoch(saved.trainingEpoch);
          setTrainingRuns(saved.trainingRuns);
          setPaper(saved.paper);
          setProfile(saved.profile);
          setProfileNameDraft(saved.profile.displayName || accountUser.username);
          setAvatarDraft(saved.profile.avatarPreset);
          setPreferences(saved.preferences);
          setCapitalDraft(String(saved.preferences.paperStartingCash));
          setActiveView(saved.preferences.launchView);
          setRange(saved.range);
          setDraftStart(saved.range.start);
          setDraftEnd(saved.range.end);
          const savedBarIndex = PAPER_STREAM.findIndex((bar) => bar.timestamp === saved.paper.lastBarTimestamp);
          const nextIndex = savedBarIndex < 0 ? 0 : Math.min(PAPER_STREAM.length, savedBarIndex + 1);
          setPaperBarIndex(nextIndex);
          setPaperPrice(savedBarIndex < 0
            ? (PAPER_STREAM[0]?.open ?? MARKET_DATA[MARKET_DATA.length - 1].close)
            : PAPER_STREAM[savedBarIndex].close);
        } else if (!cancelled) {
          const newProfile = { ...INITIAL_PROFILE, displayName: accountUser.username };
          setProfile(newProfile);
          setProfileNameDraft(newProfile.displayName);
          setAvatarDraft(newProfile.avatarPreset);
          setPreferences({ ...INITIAL_PREFERENCES });
          setCapitalDraft(String(INITIAL_PREFERENCES.paperStartingCash));
          setPaper(createInitialPaper(INITIAL_PREFERENCES.paperStartingCash));
        }
        if (!cancelled) {
          setSyncStatus("saved");
          setHydrated(true);
        }
      } catch {
        if (!cancelled) setSyncStatus("offline");
      }
    };
    void loadPersistentState();
    return () => {
      cancelled = true;
    };
  }, [accountStatus, accountUser]);

  // Poll for server-side updates when auto-run is enabled
  useEffect(() => {
    if (!hydrated || accountStatus !== "authenticated" || !accountUser || !preferences.autoRun) return;
    let cancelled = false;
    const pollInterval = window.setInterval(async () => {
      if (cancelled) return;
      try {
        const response = await fetch("/api/state", { cache: "no-store" });
        if (!response.ok) return;
        const body = (await response.json()) as { state?: unknown };
        const saved = normalizePersistedState(body.state);
        if (!saved || cancelled) return;
        // Only update paper state to avoid overwriting local UI changes
        setPaper(saved.paper);
        setPreferences(saved.preferences);
        const savedBarIndex = PAPER_STREAM.findIndex((bar) => bar.timestamp === saved.paper.lastBarTimestamp);
        const nextIndex = savedBarIndex < 0 ? 0 : Math.min(PAPER_STREAM.length, savedBarIndex + 1);
        setPaperBarIndex(nextIndex);
        setPaperPrice(savedBarIndex < 0
          ? (PAPER_STREAM[0]?.open ?? MARKET_DATA[MARKET_DATA.length - 1].close)
          : PAPER_STREAM[savedBarIndex].close);
      } catch {
        // Silent fail - will retry on next interval
      }
    }, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(pollInterval);
    };
  }, [hydrated, accountStatus, accountUser, preferences.autoRun]);

  useEffect(() => {
    if (!hydrated || accountStatus !== "authenticated" || !accountUser) return;
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(async () => {
      setSyncStatus("saving");
      const state: PersistedLabState = {
        version: STATE_VERSION,
        theme,
        model,
        trainingEpoch,
        trainingRuns: trainingRuns.slice(0, 40),
        paper,
        range,
        profile,
        preferences,
      };
      try {
        const response = await fetch("/api/state", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ state }),
        });
        if (response.status === 401) {
          setAccountUser(null);
          setAccountStatus("anonymous");
          setWorkspaceMode(null);
          throw new Error("Session expired");
        }
        if (!response.ok) throw new Error("State save failed");
        setSyncStatus("saved");
      } catch {
        setSyncStatus("offline");
      }
    }, 700);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [accountStatus, accountUser, hydrated, model, paper, preferences, profile, range, theme, trainingEpoch, trainingRuns]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!paperActive || (!marketClock.isOpen && !replayMode)) return;
    if (paperBarIndex >= PAPER_STREAM.length) return;
    const delay = replayMode ? 850 : BAR_MINUTES * 60 * 1000;
    const timer = window.setTimeout(() => {
      const bar = PAPER_STREAM[paperBarIndex];
      setPaper((account) => advancePaperAccount(account, bar, model));
      setPaperPrice(bar.close);
      setPaperBarIndex((index) => index + 1);
      if (paperBarIndex === PAPER_STREAM.length - 1) {
        setPaperActive(false);
        setReplayMode(false);
        setToast("Sandbox session complete / every five-minute candle processed");
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [marketClock.isOpen, model, paperActive, paperBarIndex, replayMode]);

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (authBusy) return;
    setAuthBusy(true);
    setAuthError("");
    try {
      const response = await fetch(`/api/auth/${authMode}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: authUsername, password: authPassword }),
      });
      const body = await response.json() as { user?: AccountUser; error?: string };
      if (!response.ok || !body.user) throw new Error(body.error || "Sign in failed.");
      setModel(INITIAL_MODEL);
      setTrainingEpoch(1840);
      setTrainingRuns([]);
      setPreferences({ ...INITIAL_PREFERENCES });
      setCapitalDraft(String(INITIAL_PREFERENCES.paperStartingCash));
      setProfile({ ...INITIAL_PROFILE, displayName: body.user.username });
      setProfileNameDraft(body.user.username);
      setAvatarDraft(INITIAL_PROFILE.avatarPreset);
      setPaper(createInitialPaper(INITIAL_PREFERENCES.paperStartingCash));
      setRange({ start: DEFAULT_START, end: DEFAULT_END });
      setDraftStart(DEFAULT_START);
      setDraftEnd(DEFAULT_END);
      setPaperBarIndex(0);
      setPaperPrice(PAPER_STREAM[0]?.open ?? MARKET_DATA[MARKET_DATA.length - 1].close);
      setHydrated(false);
      setAccountUser(body.user);
      setAccountStatus("authenticated");
      setWorkspaceMode(null);
      setAuthPassword("");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Sign in failed.");
    } finally {
      setAuthBusy(false);
    }
  };

  const signOut = async () => {
    setPaperActive(false);
    setReplayMode(false);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setAccountUser(null);
      setAccountStatus("anonymous");
      setWorkspaceMode(null);
      setHydrated(false);
      setSyncStatus("loading");
      setModel(INITIAL_MODEL);
      setTrainingEpoch(1840);
      setTrainingRuns([]);
      setPreferences({ ...INITIAL_PREFERENCES });
      setProfile({ ...INITIAL_PROFILE });
      setProfileNameDraft("");
      setAvatarDraft(INITIAL_PROFILE.avatarPreset);
      setCapitalDraft(String(INITIAL_PREFERENCES.paperStartingCash));
      setProfileMenuOpen(false);
      setPaper(createInitialPaper(INITIAL_PREFERENCES.paperStartingCash));
      setPaperBarIndex(0);
      setPaperPrice(PAPER_STREAM[0]?.open ?? MARKET_DATA[MARKET_DATA.length - 1].close);
    }
  };

  const applyRange = () => {
    if (!draftStart || !draftEnd || draftStart >= draftEnd) {
      setRangeError("Choose an end date after the start date.");
      return;
    }
    if (draftStart < BACKTEST_MIN) {
      setRangeError(`Backtests begin ${BACKTEST_MIN}. The entire 2023 tape is reserved for training.`);
      return;
    }
    const bars = MARKET_DATA.filter(
      (bar) => bar.date >= draftStart && bar.date <= draftEnd,
    );
    const count = new Set(bars.map((bar) => bar.date)).size;
    if (count < 5) {
      setRangeError("Use at least five market days for a complete trading-week replay.");
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
    if (TRAINING_DATA.length < BARS_PER_SESSION * 30) {
      setToast("The isolated 2023 training tape is unavailable");
      return;
    }

    setActiveView("train");
    setTraining(true);
    setTrainingProgress(0);
    const trainingStartedAt = Date.now();
    const startingEpoch = trainingEpoch;
    const { trainingData } = splitForTraining(TRAINING_DATA);
    let bestModel = { ...model };
    const baseline = evaluateModel(TRAINING_DATA, bestModel);
    let bestEvaluation = baseline;
    let bestObjective = baseline.objective;

    const teacherSeed = teacherSeedModel(trainingData, model);
    const teacherSeedEvaluation = evaluateModel(TRAINING_DATA, teacherSeed);
    if (teacherSeedEvaluation.objective > bestObjective) {
      bestModel = teacherSeed;
      bestEvaluation = teacherSeedEvaluation;
      bestObjective = teacherSeedEvaluation.objective;
    }

    const maxEpochs = 30;
    let epochsCompleted = 0;
    for (let epoch = 1; epoch <= maxEpochs; epoch += 1) {
      epochsCompleted = epoch;
      const temperature = 0.2 * (1 - epoch / maxEpochs) + 0.018;
      for (let candidateIndex = 0; candidateIndex < 4; candidateIndex += 1) {
        const raw = {
          trend: clamp(bestModel.trend + (Math.random() - 0.5) * temperature, 0.03, 0.78),
          rsi: clamp(bestModel.rsi + (Math.random() - 0.5) * temperature, 0.02, 0.52),
          momentum: clamp(bestModel.momentum + (Math.random() - 0.5) * temperature, 0.02, 0.62),
          volatility: clamp(bestModel.volatility + (Math.random() - 0.5) * temperature, 0.01, 0.34),
          vwap: clamp(bestModel.vwap + (Math.random() - 0.5) * temperature, 0.02, 0.58),
          volume: clamp(bestModel.volume + (Math.random() - 0.5) * temperature, 0.01, 0.38),
          orb: clamp(bestModel.orb + (Math.random() - 0.5) * temperature, 0.02, 0.62),
          pullback: clamp(bestModel.pullback + (Math.random() - 0.5) * temperature, 0.02, 0.58),
          squeeze: clamp(bestModel.squeeze + (Math.random() - 0.5) * temperature, 0.015, 0.48),
          levels: clamp(bestModel.levels + (Math.random() - 0.5) * temperature, 0.015, 0.44),
          pattern: clamp(bestModel.pattern + (Math.random() - 0.5) * temperature, 0.015, 0.44),
          threshold: clamp(bestModel.threshold + (Math.random() - 0.5) * 0.032, 0.16, 0.3),
        };
        const sum =
          raw.trend + raw.rsi + raw.momentum + raw.volatility + raw.vwap + raw.volume +
          raw.orb + raw.pullback + raw.squeeze + raw.levels + raw.pattern;
        const candidate: ModelWeights = {
          trend: raw.trend / sum,
          rsi: raw.rsi / sum,
          momentum: raw.momentum / sum,
          volatility: raw.volatility / sum,
          vwap: raw.vwap / sum,
          volume: raw.volume / sum,
          orb: raw.orb / sum,
          pullback: raw.pullback / sum,
          squeeze: raw.squeeze / sum,
          levels: raw.levels / sum,
          pattern: raw.pattern / sum,
          threshold: raw.threshold,
        };
        const candidateEvaluation = evaluateModel(TRAINING_DATA, candidate);
        if (candidateEvaluation.objective > bestObjective) {
          bestObjective = candidateEvaluation.objective;
          bestModel = candidate;
          bestEvaluation = candidateEvaluation;
        }
      }

      if (epoch % 2 === 0 || epoch === maxEpochs) {
        setTrainingProgress(Math.round((epoch / maxEpochs) * 100));
        setTrainingEpoch(startingEpoch + epoch);
        await new Promise<void>((resolve) => window.setTimeout(resolve, 12));
      }
      if (
        bestEvaluation.validationResult.alpha > 0.035 &&
        bestEvaluation.agreement > 0.54 &&
        epoch > 12
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
        range: { start: TRAINING_START, end: TRAINING_END },
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
  }, [model, training, trainingEpoch]);

  const resetPaper = () => {
    setPaper(createInitialPaper(preferences.paperStartingCash));
    setPaperBarIndex(0);
    setPaperPrice(PAPER_STREAM[0]?.open ?? MARKET_DATA[MARKET_DATA.length - 1].close);
    setPaperActive(false);
    setReplayMode(false);
    setToast(`Paper account reset to ${money(preferences.paperStartingCash)}`);
  };

  const applyPaperStartingCash = () => {
    const parsed = Number(capitalDraft.replace(/[$,\s]/g, ""));
    if (!Number.isFinite(parsed) || parsed < 100 || parsed > 1_000_000) {
      setToast("Choose a sandbox balance from $100 to $1,000,000");
      return;
    }
    const nextCapital = Math.round(parsed);
    setPreferences((current) => ({ ...current, paperStartingCash: nextCapital }));
    setCapitalDraft(String(nextCapital));
    setPaper(createInitialPaper(nextCapital));
    setPaperBarIndex(0);
    setPaperPrice(PAPER_STREAM[0]?.open ?? MARKET_DATA[MARKET_DATA.length - 1].close);
    setPaperActive(false);
    setReplayMode(false);
    setToast(`Sandbox balance set to ${money(nextCapital)} / portfolio reset`);
  };

  const saveProfile = () => {
    const displayName = profileNameDraft.trim().slice(0, 32) || accountUser?.username || "Axion Trades";
    setProfile({ displayName, avatarPreset: avatarDraft });
    setProfileNameDraft(displayName);
    setToast("Profile saved to your account");
  };

  const openAccountView = (view: "account" | "settings") => {
    setProfileMenuOpen(false);
    setWorkspaceMode("sandbox");
    setActiveView(view);
  };

  const factors = [
    { label: "Opening range", value: latestFactors.orb, weight: model.orb, color: "mint" },
    { label: "VWAP / EMA pullback", value: latestFactors.pullback, weight: model.pullback, color: "blue" },
    { label: "Bollinger squeeze", value: latestFactors.squeeze, weight: model.squeeze, color: "violet" },
    { label: "Key levels", value: latestFactors.levels, weight: model.levels, color: "amber" },
    { label: "EMA trend", value: latestFactors.trend, weight: model.trend, color: "mint" },
    { label: "Momentum", value: latestFactors.momentum, weight: model.momentum, color: "amber" },
    { label: "RSI edge", value: latestFactors.rsi, weight: model.rsi, color: "violet" },
    { label: "VWAP", value: latestFactors.vwap, weight: model.vwap, color: "blue" },
    { label: "Volume", value: latestFactors.volume, weight: model.volume, color: "mint" },
    { label: "Volatility", value: latestFactors.volatility, weight: model.volatility, color: "blue" },
    { label: "Candle confirmation", value: latestFactors.pattern, weight: model.pattern, color: "violet" },
  ];
  const strategyEngines = [
    { label: "Trend following", value: latestDecision.algorithms.trendFollowing, detail: "EMA 9/21/50 · ADX · VWAP" },
    { label: "Momentum", value: latestDecision.algorithms.momentum, detail: "MACD · RSI · price impulse" },
    { label: "Mean reversion", value: latestDecision.algorithms.meanReversion, detail: "Bollinger stretch · VWAP · rejection" },
    { label: "Volume breakout", value: latestDecision.algorithms.breakout, detail: "ORB · levels · OBV flow" },
  ];

  const accountDisplayName = profile.displayName || accountUser?.username || "Axion Trades";
  const accountInitials = initialsFromName(accountDisplayName);
  const avatarPresets: Array<{ id: AvatarPreset; label: string }> = [
    { id: "mint", label: "Mint" },
    { id: "ocean", label: "Ocean" },
    { id: "violet", label: "Violet" },
    { id: "sunset", label: "Sunset" },
    { id: "graphite", label: "Graphite" },
    { id: "rose", label: "Rose" },
  ];

  const renderProfileMenu = () => (
    <div className={`profile-menu-wrap ${profileMenuOpen ? "open" : ""}`} ref={profileMenuRef}>
      <button
        className="profile-trigger"
        type="button"
        aria-haspopup="menu"
        aria-expanded={profileMenuOpen}
        aria-label={`Open account menu for ${accountDisplayName}`}
        onClick={() => setProfileMenuOpen((open) => !open)}
      >
        <span className="avatar profile-avatar" data-avatar={profile.avatarPreset}>{accountInitials}</span>
        <ChevronDown size={13} aria-hidden="true" />
      </button>
      {profileMenuOpen && (
        <div className="profile-menu" role="menu" aria-label="Account menu">
          <div className="profile-menu-identity">
            <span className="avatar profile-menu-avatar" data-avatar={profile.avatarPreset}>{accountInitials}</span>
            <div><strong>{accountDisplayName}</strong><small>@{accountUser?.username}</small></div>
            <span className={`menu-sync-dot ${syncStatus}`} title={syncStatus} />
          </div>
          <div className="profile-menu-group">
            <button role="menuitem" type="button" onClick={() => openAccountView("account")}><UserRound size={15} /><span><strong>Account</strong><small>Profile and connections</small></span></button>
            <button role="menuitem" type="button" onClick={() => openAccountView("settings")}><Settings size={15} /><span><strong>Settings</strong><small>Balance and preferences</small></span></button>
          </div>
          <div className="profile-menu-group secondary">
            <button role="menuitem" type="button" onClick={() => { setProfileMenuOpen(false); setWorkspaceMode(null); }}><FlaskConical size={15} /><span><strong>Switch environment</strong><small>Sandbox or empty Live</small></span></button>
            <button className="menu-signout" role="menuitem" type="button" onClick={() => void signOut()}><LogOut size={15} /><span><strong>Sign out</strong><small>End this protected session</small></span></button>
          </div>
        </div>
      )}
    </div>
  );

  if (accountStatus === "loading") {
    return (
      <main className="gateway-shell" aria-busy="true">
        <div className="gateway-loading" role="status" aria-live="polite">
          <span className="brand-mark gateway-brand-mark" aria-hidden="true" />
          <span className="skeleton-line headline" />
          <span className="skeleton-line medium" />
          <div className="gateway-loading-grid"><i /><i /></div>
          <small>Opening your private workspace...</small>
        </div>
      </main>
    );
  }

  if (accountStatus === "anonymous") {
    return (
      <main className="gateway-shell">
        <header className="gateway-header">
          <a className="brand" href="#account" aria-label="Axion Trades account">
            <span className="brand-mark" aria-hidden="true" />
            <span>Axion <b>Trades</b></span>
            <em>LAB</em>
          </a>
          <button className="theme-toggle" type="button" onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")} aria-label="Toggle color theme">
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </header>
        <section className="auth-gateway" id="account">
          <div className="auth-story">
            <span className="view-kicker">PRIVATE RESEARCH WORKSPACE</span>
            <h1>One account. One isolated trading lab.</h1>
            <p>Your model weights, checkpoints, backtest dates, paper portfolio, and order history follow your username instead of staying on one browser.</p>
            <div className="auth-proof-grid">
              <div><LockKeyhole size={17} /><span><strong>Protected session</strong><small>HTTP-only cookie and throttled sign-in</small></span></div>
              <div><Database size={17} /><span><strong>Account-backed state</strong><small>No trading state stored in localStorage</small></span></div>
              <div><FlaskConical size={17} /><span><strong>Sandbox first</strong><small>Fake money and simulated AAPL data only</small></span></div>
            </div>
          </div>
          <form className="auth-card" onSubmit={submitAuth}>
            <div className="auth-card-heading">
              <span className="auth-icon"><UserRound size={19} /></span>
              <div><span>{authMode === "login" ? "Welcome back" : "Create your lab"}</span><h2>{authMode === "login" ? "Sign in" : "Create account"}</h2></div>
            </div>
            <div className="auth-tabs" role="tablist" aria-label="Account action">
              <button className={authMode === "login" ? "active" : ""} type="button" onClick={() => { setAuthMode("login"); setAuthError(""); }}>Sign in</button>
              <button className={authMode === "register" ? "active" : ""} type="button" onClick={() => { setAuthMode("register"); setAuthError(""); }}>New account</button>
            </div>
            <label className="auth-field" htmlFor="auth-username">
              <span>Username</span>
              <input id="auth-username" name="username" autoComplete="username" minLength={3} maxLength={24} pattern={"[A-Za-z0-9](?:[A-Za-z0-9_]|-){2,23}"} required value={authUsername} onChange={(event) => setAuthUsername(event.target.value)} placeholder="your_username" />
            </label>
            <label className="auth-field" htmlFor="auth-password">
              <span>Password</span>
              <input id="auth-password" name="password" type="password" autoComplete={authMode === "login" ? "current-password" : "new-password"} minLength={8} maxLength={128} required value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="8+ characters" />
            </label>
            {authError && <div className="auth-error" role="alert"><Info size={14} /> {authError}</div>}
            <button className="primary-button auth-submit" type="submit" disabled={authBusy}>
              {authBusy ? <RefreshCw className="spin" size={15} /> : <LockKeyhole size={15} />}
              {authBusy ? "Securing session..." : authMode === "login" ? "Open workspace" : "Create private workspace"}
            </button>
            <small className="auth-disclaimer">No email verification yet. Use a unique password; account recovery and MFA are not available in this prototype.</small>
          </form>
        </section>
      </main>
    );
  }

  if (workspaceMode === null) {
    return (
      <main className="gateway-shell mode-shell">
        <header className="gateway-header">
          <a className="brand" href="#mode" aria-label="Axion Trades mode selection"><span className="brand-mark" aria-hidden="true" /><span>Axion <b>Trades</b></span><em>LAB</em></a>
          <div className="gateway-account-actions">
            <button className="theme-toggle" type="button" onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")} aria-label="Toggle color theme">{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}</button>
            {renderProfileMenu()}
          </div>
        </header>
        <section className="mode-gateway" id="mode">
          <div className="mode-heading"><span className="view-kicker">CHOOSE AN ENVIRONMENT</span><h1>Where do you want to work?</h1><p>Mode is selected fresh on every visit. Your account data stays attached to your account.</p></div>
          <div className="mode-grid">
            <button className="mode-card sandbox" type="button" onClick={() => setWorkspaceMode("sandbox")}>
              <span className="mode-card-icon"><FlaskConical size={23} /></span><small>READY</small><h2>Sandbox</h2><p>Train on isolated 2023 data, backtest 2024 onward, and replay five-minute paper trading with fake money.</p><strong>Enter sandbox <ArrowUpRight size={15} /></strong>
            </button>
            <button className="mode-card live" type="button" onClick={() => setWorkspaceMode("live")}>
              <span className="mode-card-icon"><Radio size={23} /></span><small>EMPTY</small><h2>Live</h2><p>A clean broker workspace with no connection, market feed, positions, orders, or real-money controls.</p><strong>Open empty live mode <ArrowUpRight size={15} /></strong>
            </button>
          </div>
          <div className="mode-footnote"><ShieldCheck size={14} /> Sandbox activity can never submit a real order.</div>
        </section>
      </main>
    );
  }

  if (workspaceMode === "live") {
    return (
      <main className="app-shell refined-shell live-empty-shell">
        <header className="topbar refined-topbar live-empty-topbar">
          <a className="brand" href="#live"><span className="brand-mark" aria-hidden="true" /><span>Axion <b>Trades</b></span><em>LIVE</em></a>
          <div className="live-mode-pill"><span /> Live workspace</div>
          <div className="top-actions">
            <button className="theme-toggle" type="button" onClick={() => setTheme((current) => current === "dark" ? "light" : "dark")} aria-label="Toggle color theme">{theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}</button>
            <button className="icon-text-button" type="button" onClick={() => setWorkspaceMode(null)}>Switch mode</button>
            {renderProfileMenu()}
          </div>
        </header>
        <section className="live-empty" id="live">
          <div className="live-empty-orbit"><Radio size={27} /></div>
          <span className="view-kicker">NO BROKER CONNECTED</span>
          <h1>Live mode is intentionally empty.</h1>
          <p>No live quote feed, brokerage credentials, positions, or order route has been configured. Nothing here can place a trade.</p>
          <div className="live-empty-stats"><div><span>Buying power</span><strong>--</strong></div><div><span>Open positions</span><strong>0</strong></div><div><span>Orders</span><strong>0</strong></div></div>
          <button className="primary-button" type="button" onClick={() => setWorkspaceMode("sandbox")}><FlaskConical size={15} /> Go to Sandbox</button>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell refined-shell">
      <header className="topbar refined-topbar">
        <a className="brand" href="#workspace" aria-label="Axion Trades home">
          <span className="brand-mark" aria-hidden="true" />
          <span>Axion <b>Trades</b></span>
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
          <button id="tab-guide" role="tab" aria-selected={activeView === "guide"} aria-controls="panel-guide" className={activeView === "guide" ? "active" : ""} type="button" onClick={() => setActiveView("guide")}>
            <BookOpenCheck size={15} /> <span>Guide</span>
          </button>
        </nav>

        <div className="top-actions">
          <div className={`sync-pill ${syncStatus}`} title="Account storage status">
            {syncStatus === "offline" ? <CloudOff size={14} /> : syncStatus === "saving" ? <Save size={14} /> : <Cloud size={14} />}
            <span>{syncStatus === "loading" ? "Loading" : syncStatus === "saving" ? "Saving" : syncStatus === "offline" ? "Offline" : "Account saved"}</span>
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
          {renderProfileMenu()}
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
              <p>Five-minute multi-strategy ensemble / trend, momentum, reversion, breakouts / flat by 4:00 PM</p>
            </div>
          </div>

          <div className={"hero-signal " + result.signal.toLowerCase()}>
            <span className="hero-signal-icon"><BrainCircuit size={20} /></span>
            <div>
              <span>Policy action</span>
              <strong>{result.signal}</strong>
              <small>{result.confidence}% / {latestDecision.setup}</small>
            </div>
          </div>

          <div className="range-builder">
            <div className="range-builder-title">
              <span><CalendarRange size={17} /></span>
              <div><strong>Replay unseen years</strong><small>2024 onward / never used for training</small></div>
            </div>
            <div className="range-fields">
              <label htmlFor="start-date">
                <span>From</span>
                <input
                  id="start-date"
                  type="date"
                  min={BACKTEST_MIN}
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
                  min={BACKTEST_MIN}
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
                <span>Average simulated week</span>
                <strong className={result.averageWeekReturn >= 0 ? "positive" : "negative"}>{percent(result.averageWeekReturn)}</strong>
                <small>{Math.round(result.positiveWeekRate * 100)}% positive / {result.tradesPerDay.toFixed(1)} trades daily</small>
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
                <p>Aggressive research cadence with regime selection, bounded risk, and no overnight positions.</p>
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
              <span><Target size={14} /> {latestDecision.regime.toLowerCase()} / {latestDecision.confluence} confirmations</span>
              <span><Gauge size={14} /> 0.5% risk ceiling / {MAX_ENTRIES_PER_SESSION} entries max</span>
              <span><ShieldCheck size={14} /> Next-bar fills / fees / spread / slippage</span>
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
                  <div><span>Positive weeks</span><strong>{(result.positiveWeekRate * 100).toFixed(0)}%</strong></div>
                  <div><span>Average week</span><strong>{percent(result.averageWeekReturn)}</strong></div>
                  <div><span>Trades per day</span><strong>{result.tradesPerDay.toFixed(1)}</strong></div>
                  <div><span>Average hold</span><strong>{Math.round(result.averageHoldBars * BAR_MINUTES)}m</strong></div>
                  <div><span>Closed positions</span><strong>{result.roundTrips}</strong></div>
                  <div><span>Regulatory fees</span><strong>{money(result.totalFees, 2)}</strong></div>
                  <div><span>Estimated slippage</span><strong>{money(result.totalSlippage, 2)}</strong></div>
                  <div><span>Average modeled spread</span><strong>{money(result.averageSpread, 3)}</strong></div>
                  <div><span>Execution interval</span><strong>{BAR_MINUTES} minutes</strong></div>
                  <div><span>Per-trade risk ceiling</span><strong>$5 per $1,000</strong></div>
                  <div><span>Daily circuit breaker</span><strong>{(DAILY_LOSS_LIMIT_FRACTION * 100).toFixed(0)}%</strong></div>
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
                  <thead><tr><th>Date</th><th>Action</th><th>Fill price</th><th>Shares</th><th>Fees</th><th>Profit / loss</th><th>Confidence</th><th>Why</th></tr></thead>
                  <tbody>
                    {result.trades.slice().reverse().slice(0, 50).map((trade) => (
                      <tr key={trade.id}>
                        <td>{dateLabel(trade.date, trade.time)}</td>
                        <td><span className={trade.side === "BUY" || trade.side === "COVER" ? "side-tag buy" : "side-tag sell"}>{trade.side}</span></td>
                        <td>{money(trade.price, 2)}</td>
                        <td>{trade.shares}</td>
                        <td>{money(trade.fees, 2)}</td>
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
                    <p>Only 2023 can train the policy. Its first 72% teaches; its final 28% validates. Backtests start in 2024 and never enter this loop.</p>
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
                        <h3>Forge Policy v3 / epoch {trainingEpoch}</h3>
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
                    <h3>Four engines, one regime-aware decision</h3>
                    <p>Trend following, momentum, mean reversion, and volume breakouts compete on every closed candle. The current regime decides how much each engine matters.</p>
                    <div className="strategy-engine-grid">
                      {strategyEngines.map((engine) => (
                        <div className="strategy-engine" key={engine.label}>
                          <div><span>{engine.label}</span><strong className={engine.value > 0.08 ? "positive" : engine.value < -0.08 ? "negative" : ""}>{engine.value > 0.08 ? "LONG" : engine.value < -0.08 ? "SHORT" : "NEUTRAL"}</strong></div>
                          <div className="engine-track"><i className={engine.value >= 0 ? "positive" : "negative"} style={{ width: `${Math.max(5, Math.abs(engine.value) * 100)}%` }} /></div>
                          <small>{engine.detail}</small>
                        </div>
                      ))}
                    </div>
                    <h4 className="engine-factor-heading">Eleven causal indicators</h4>
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
                      <p>For each 2023 candle, the teacher compares the best long and short excursion over the next four five-minute candles. Those future-aware labels guide training only.</p>
                    </div>
                    <div className="teacher-score">
                      <span>Policy agreement</span>
                      <strong>{(currentTeacherAgreement * 100).toFixed(0)}%</strong>
                    </div>
                  </article>

                  <article className="split-card">
                    <div className="split-card-heading">
                      <div><BookOpenCheck size={17} /><span>Walk-forward split</span></div>
                      <small>{trainingSessionCount} days / {TRAINING_DATA.length} candles / 2023 only</small>
                    </div>
                    <div className="split-rail" aria-label="Training and holdout split">
                      <span style={{ width: `${TRAINING_DATA.length ? trainingSplitCount / TRAINING_DATA.length * 100 : 72}%` }}>Teacher training</span>
                      <span>Unseen holdout</span>
                    </div>
                    <p>The split is made on whole trading days with no overlapping candles. The selected 2024+ backtest range remains completely separate.</p>
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
                <p>The same five-minute policy, next-bar fills, costs, and risk rules as Backtest. Everything is saved to your account.</p>
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
                  <div className={paperPnl >= 0 ? "paper-pnl positive" : "paper-pnl negative"}><span>Total result</span><strong>{percent(paperPnl / preferences.paperStartingCash, 2)}</strong><small>{money(paperPnl, 2)}</small></div>
                </div>

                <div className="paper-stats refined-paper-stats">
                  <div><span>Available cash</span><strong>{money(paper.cash, 2)}</strong></div>
                  <div><span>AAPL position</span><strong>{Math.abs(paper.shares)} shares</strong></div>
                  <div><span>Unrealized P&amp;L</span><strong className={paperUnrealized >= 0 ? "positive" : "negative"}>{money(paperUnrealized, 2)}</strong></div>
                  <div><span>Practice price</span><strong>{money(paperPrice, 2)}</strong></div>
                </div>

                <div className="portfolio-performance">
                  <div><span>Portfolio history</span><small>{paper.equityHistory.length ? `${paper.equityHistory.length} saved marks` : "Starts when the bot runs"}</small></div>
                  <PortfolioChart history={paper.equityHistory} theme={theme} baseline={preferences.paperStartingCash} />
                </div>
                </>}

                {portfolioTab === "automation" && <div className="automation-view">
                <div className="paper-market-card">
                  <span className={marketClock.isOpen ? "paper-market-icon open" : "paper-market-icon"}><Clock3 size={18} /></span>
                  <div>
                    <strong>{marketClock.isOpen ? "Market session is open" : marketClock.label}</strong>
                    <p>{paperActive ? (marketClock.isOpen ? "Four strategy engines are checking trend, momentum, mean reversion, breakouts, volume flow, and risk." : replayMode ? "A compressed demo session is replaying the same policy now." : "The bot will wake automatically at the opening bell.") : "Start the bot and it will wait safely for the next open."}</p>
                  </div>
                </div>

                <div className="paper-actions refined-paper-actions">
                  <button className={paperActive ? "primary-button stop" : "primary-button"} type="button" onClick={() => setPaperActive((active) => !active)}>
                    {paperActive ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
                    {paperActive ? "Pause paper bot" : "Start paper bot"}
                  </button>
                  {!marketClock.isOpen && (
                    <button className={replayMode ? "secondary-button active" : "secondary-button"} type="button" onClick={() => {
                      if (!replayMode && paperBarIndex >= PAPER_STREAM.length) {
                        setPaper(createInitialPaper(preferences.paperStartingCash));
                        setPaperBarIndex(0);
                        setPaperPrice(PAPER_STREAM[0]?.open ?? paperPrice);
                      }
                      setReplayMode((active) => !active);
                      setPaperActive(true);
                    }}>
                      <Activity size={15} /> {replayMode ? "Stop replay" : "Replay a session"}
                    </button>
                  )}
                  <button className="secondary-button reset-paper" type="button" onClick={resetPaper}><RotateCcw size={15} /> Reset</button>
                </div>
                <div className="automation-rules">
                  <div><span>Decision interval</span><strong>Every five-minute candle</strong></div>
                  <div><span>Replay progress</span><strong>{Math.min(paperBarIndex, PAPER_STREAM.length)} / {PAPER_STREAM.length} candles</strong></div>
                  <div><span>Position policy</span><strong>4 engines / up to {MAX_ENTRIES_PER_SESSION} entries</strong></div>
                  <div><span>Risk exits</span><strong>0.5% ceiling / ATR stop / 1.15–1.85R</strong></div>
                  <div><span>After a stopped trade</span><strong>One-bar reset, then resumes</strong></div>
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
                        <span>{money(order.price, 2)}<small>{money(order.fees, 2)} fees</small></span>
                      </div>
                    ))
                  )}
                </div>
                <div className="paper-disclosure"><Database size={14} /> Portfolio and order history are saved. Prices and fills remain simulated.</div>
              </aside>}
            </div>
          </section>
        )}

        {activeView === "settings" && (
          <section className="panel focused-workspace settings-workspace" id="settings">
            <div className="workspace-heading settings-heading">
              <div>
                <span className="view-kicker">WORKSPACE SETTINGS</span>
                <h2>Make the sandbox yours</h2>
                <p>Control the fake-money account, launch behavior, appearance, and motion without changing the trading policy.</p>
              </div>
              <span className="settings-saved"><Save size={13} /> {syncStatus === "saved" ? "Saved to account" : syncStatus === "saving" ? "Saving changes" : "Changes sync automatically"}</span>
            </div>

            <div className="settings-grid">
              <article className="settings-card capital-settings-card">
                <div className="settings-card-heading">
                  <span className="settings-card-icon mint"><DollarSign size={18} /></span>
                  <div><small>SANDBOX WALLET</small><h3>Starting balance</h3><p>Choose how much fake cash every fresh paper session begins with.</p></div>
                </div>

                <div className="capital-preview">
                  <span>Next reset</span>
                  <strong>{money(Number(capitalDraft.replace(/[$,\s]/g, "")) || preferences.paperStartingCash)}</strong>
                  <small>Current portfolio value {money(paperValue, 2)}</small>
                </div>

                <div className="capital-presets" aria-label="Starting balance presets">
                  {[1_000, 5_000, 10_000, 25_000, 100_000].map((amount) => (
                    <button className={Number(capitalDraft) === amount ? "active" : ""} type="button" key={amount} onClick={() => setCapitalDraft(String(amount))}>{money(amount)}</button>
                  ))}
                </div>

                <label className="settings-field" htmlFor="paper-capital">
                  <span>Custom amount</span>
                  <div><DollarSign size={15} /><input id="paper-capital" type="number" inputMode="numeric" min={100} max={1_000_000} step={100} value={capitalDraft} onChange={(event) => setCapitalDraft(event.target.value)} /></div>
                  <small>$100 minimum / $1,000,000 maximum</small>
                </label>

                <div className="capital-impact">
                  <div><span>Risk ceiling per trade</span><strong>{money(preferences.paperStartingCash * RISK_PER_TRADE_FRACTION, 2)}</strong><small>0.5% of starting balance</small></div>
                  <div><span>Daily loss lock</span><strong>{money(preferences.paperStartingCash * DAILY_LOSS_LIMIT_FRACTION, 2)}</strong><small>2% from session start</small></div>
                </div>

                <div className="settings-warning"><Info size={14} /><span>Applying a new balance clears the current fake positions, orders, and portfolio chart. It does not reset training.</span></div>
                <button className="primary-button settings-apply" type="button" onClick={applyPaperStartingCash}><RefreshCw size={15} /> Apply balance &amp; reset portfolio</button>
              </article>

              <div className="settings-stack">
                <article className="settings-card">
                  <div className="settings-card-heading compact-heading">
                    <span className="settings-card-icon violet"><Sparkles size={17} /></span>
                    <div><small>INTERFACE</small><h3>Appearance</h3></div>
                  </div>
                  <div className="setting-row">
                    <div><strong>Color mode</strong><small>Light is the default for new accounts.</small></div>
                    <div className="setting-segmented" aria-label="Color mode">
                      <button className={theme === "light" ? "active" : ""} type="button" onClick={() => setTheme("light")}><Sun size={14} /> Light</button>
                      <button className={theme === "dark" ? "active" : ""} type="button" onClick={() => setTheme("dark")}><Moon size={14} /> Dark</button>
                    </div>
                  </div>
                  <div className="setting-row">
                    <div><strong>Interface motion</strong><small>Turns decorative movement and transitions on or off.</small></div>
                    <button className={`switch-control ${preferences.animations ? "on" : ""}`} type="button" role="switch" aria-checked={preferences.animations} onClick={() => setPreferences((current) => ({ ...current, animations: !current.animations }))}><span /></button>
                  </div>
                  <div className="setting-row">
                    <div><strong>Auto-run paper bot</strong><small>Automatically start the paper bot at market open (9:30 ET) and stop at close (16:00 ET), even when your device is off.</small></div>
                    <button className={`switch-control ${preferences.autoRun ? "on" : ""}`} type="button" role="switch" aria-checked={preferences.autoRun} onClick={() => setPreferences((current) => ({ ...current, autoRun: !current.autoRun }))}><span /></button>
                  </div>
                </article>

                <article className="settings-card">
                  <div className="settings-card-heading compact-heading">
                    <span className="settings-card-icon blue"><SlidersHorizontal size={17} /></span>
                    <div><small>WORKFLOW</small><h3>Startup workspace</h3></div>
                  </div>
                  <p className="setting-intro">The page you see first after your saved account data loads.</p>
                  <div className="launch-options">
                    {([
                      ["chart", "Backtest", "Replay unseen dates"],
                      ["train", "Training", "Open the learning lab"],
                      ["paper", "Portfolio", "Open paper trading"],
                    ] as Array<[LaunchView, string, string]>).map(([view, label, detail]) => (
                      <button className={preferences.launchView === view ? "active" : ""} type="button" key={view} onClick={() => setPreferences((current) => ({ ...current, launchView: view }))}><span><strong>{label}</strong><small>{detail}</small></span>{preferences.launchView === view && <Check size={14} />}</button>
                    ))}
                  </div>
                </article>

                <article className="settings-card muted-setting-card">
                  <div className="settings-card-heading compact-heading">
                    <span className="settings-card-icon graphite"><Bell size={17} /></span>
                    <div><small>NOTIFICATIONS</small><h3>Market-open reminders</h3></div>
                  </div>
                  <p>Browser reminders will arrive after a real quote service exists. Nothing can be enabled in this sandbox build.</p>
                  <button className="secondary-button" type="button" disabled>Coming later</button>
                </article>
              </div>
            </div>
          </section>
        )}

        {activeView === "account" && (
          <section className="panel focused-workspace account-workspace" id="account-profile">
            <div className="workspace-heading account-heading">
              <div>
                <span className="view-kicker">YOUR ACCOUNT</span>
                <h2>Identity, access, and connections</h2>
                <p>Personalize the profile attached to this private lab. Trading data stays isolated under your sign-in.</p>
              </div>
              <span className="account-plan"><Sparkles size={13} /> Research sandbox</span>
            </div>

            <div className="account-grid">
              <article className="account-profile-card">
                <div className="profile-hero">
                  <span className="avatar account-hero-avatar" data-avatar={avatarDraft}>{initialsFromName(profileNameDraft || accountDisplayName)}</span>
                  <div><small>PROFILE PREVIEW</small><h3>{profileNameDraft || accountDisplayName}</h3><p>@{accountUser?.username} / Axion Trades member</p></div>
                </div>

                <div className="account-form-grid">
                  <label className="account-field" htmlFor="profile-display-name"><span>Display name</span><input id="profile-display-name" maxLength={32} value={profileNameDraft} onChange={(event) => setProfileNameDraft(event.target.value)} placeholder={accountUser?.username} /><small>Shown in the account menu; your sign-in ID does not change.</small></label>
                  <label className="account-field locked-field" htmlFor="profile-username"><span>Username</span><div><LockKeyhole size={14} /><input id="profile-username" value={accountUser?.username ?? ""} readOnly /></div><small>Username changes are locked in this prototype.</small></label>
                </div>

                <div className="avatar-picker-heading"><div><strong>Profile photo style</strong><small>Pick a private, account-synced avatar.</small></div><span>{avatarPresets.find((item) => item.id === avatarDraft)?.label}</span></div>
                <div className="avatar-picker" aria-label="Profile photo styles">
                  {avatarPresets.map((preset) => (
                    <button className={avatarDraft === preset.id ? "active" : ""} type="button" key={preset.id} onClick={() => setAvatarDraft(preset.id)} aria-label={`Use ${preset.label} profile style`}>
                      <span className="avatar" data-avatar={preset.id}>{initialsFromName(profileNameDraft || accountDisplayName)}</span>
                      {avatarDraft === preset.id && <Check size={12} />}
                    </button>
                  ))}
                </div>

                <button className="primary-button profile-save-button" type="button" onClick={saveProfile}><Save size={15} /> Save profile</button>
              </article>

              <div className="account-side-stack">
                <article className="account-detail-card connection-card">
                  <div className="account-card-top"><span className="settings-card-icon blue"><CreditCard size={17} /></span><span className="coming-pill">NOT CONNECTED</span></div>
                  <h3>Payments &amp; brokerage</h3>
                  <p>There is no payment processor, brokerage link, or real-money route in this build.</p>
                  <div className="connection-placeholder"><CreditCard size={18} /><span><strong>Connect payment method</strong><small>Disabled until billing is built</small></span><LockKeyhole size={14} /></div>
                  <button className="secondary-button disabled-connection" type="button" disabled><CreditCard size={14} /> Connect payment</button>
                </article>

                <article className="account-detail-card">
                  <div className="account-card-top"><span className="settings-card-icon mint"><ShieldCheck size={17} /></span><span className="healthy-pill">PROTECTED</span></div>
                  <h3>Account security</h3>
                  <div className="account-detail-list">
                    <div><span>Session</span><strong>HTTP-only cookie</strong></div>
                    <div><span>Password</span><strong>Salted slow hash</strong></div>
                    <div><span>Account ID</span><strong>{accountUser?.id.slice(0, 8)}...</strong></div>
                  </div>
                  <button className="secondary-button" type="button" disabled>Change password / coming soon</button>
                </article>

                <article className="account-detail-card account-data-card">
                  <div><Database size={17} /><span><strong>Your lab travels with you</strong><small>Profile, settings, model, dates, checkpoints, paper portfolio, and orders are saved under @{accountUser?.username}.</small></span></div>
                  <button className="text-button" type="button" onClick={() => openAccountView("settings")}>Open settings <ArrowUpRight size={14} /></button>
                </article>
              </div>
            </div>
          </section>
        )}

        {activeView === "guide" && (
          <section className="panel focused-workspace guide-workspace" id="panel-guide" role="tabpanel" aria-labelledby="tab-guide">
            <div className="workspace-heading guide-heading">
              <div>
                <span className="view-kicker">SYSTEM GUIDE</span>
                <h2>How Axion Trades actually works</h2>
                <p>The exact data boundaries, learning loop, order timing, cost assumptions, account model, and limits—without marketing language.</p>
              </div>
              <span className="training-status"><ShieldCheck size={14} /> Sandbox only</span>
            </div>

            <div className="guide-flow" aria-label="Trading system sequence">
              <div><span>01</span><strong>Five-minute candle closes</strong><small>Only known OHLCV and indicators</small></div>
              <i />
              <div><span>02</span><strong>Policy scores the setup</strong><small>Long, short, or no action</small></div>
              <i />
              <div><span>03</span><strong>Next candle executes</strong><small>Open price plus modeled costs</small></div>
              <i />
              <div><span>04</span><strong>Risk engine manages it</strong><small>Stop, target, reversal, time, close</small></div>
            </div>

            <div className="guide-grid">
              <article>
                <span className="guide-number">01</span>
                <h3>Separate years prevent leakage</h3>
                <p><b>Training is fixed to Jan–Dec 2023.</b> Whole trading days are split 72/28 into teacher training and unseen validation. The date picker begins in 2024, so a backtest candle cannot become a training example.</p>
                <div className="guide-boundary"><span>2023</span><strong>Train + validate</strong><i /><span>2024–2026</span><strong>Backtest only</strong></div>
              </article>

              <article>
                <span className="guide-number">02</span>
                <h3>The teacher is training-only</h3>
                <p>During training, a hindsight teacher labels whether long, short, or flat would have been best over the next four candles (20 minutes). Class-balanced agreement prevents the many flat candles from rewarding a policy that simply does nothing. Only a better validation checkpoint replaces the saved model.</p>
              </article>

              <article>
                <span className="guide-number">03</span>
                <h3>Four strategies, eleven causal signals</h3>
                <p>Trend following uses EMA 9/21/50, MACD, ADX, and VWAP. Momentum combines RSI, MACD, impulse, and volume. Mean reversion reads Bollinger/VWAP stretch and rejection candles. Breakouts require ORB or key levels plus OBV-informed volume flow.</p>
              </article>

              <article>
                <span className="guide-number">04</span>
                <h3>Backtest and Sandbox share execution</h3>
                <p>Both read one five-minute candle at a time, call the same scoring and pending-entry functions, and fill a new signal only at the next candle’s open. Both use up to 97% of available buying power, cap planned stop risk at 0.5% of equity ($5 per $1,000), allow {MAX_ENTRIES_PER_SESSION} entries, pause one bar after a loss, lock after a 2% daily decline, and finish flat.</p>
              </article>

              <article className="guide-wide">
                <span className="guide-number">05</span>
                <h3>What a simulated fill includes</h3>
                <div className="cost-assumption-grid">
                  <div><span>Broker commission</span><strong>$0.00</strong><small>Assumes commission-free U.S. online stock orders</small></div>
                  <div><span>SEC sale fee</span><strong>$20.60 / $1M</strong><small>Applied to sells and short sales</small></div>
                  <div><span>FINRA TAF</span><strong>$0.000195 / share</strong><small>Sale-side, capped at $9.79</small></div>
                  <div><span>CAT fee</span><strong>$0.000003 / share</strong><small>Modeled on every side</small></div>
                  <div><span>Spread</span><strong>Dynamic</strong><small>Wider near open/close and in thin/volatile bars</small></div>
                  <div><span>Market impact</span><strong>Dynamic</strong><small>Adverse move based on order participation and volatility</small></div>
                </div>
                <p className="guide-note">Targets are treated as limit fills; market and stop orders pay adverse spread and impact. A stop is a trigger, not a guaranteed $5 fill, so gaps can exceed the planned loss. Taxes, borrow availability, hard-to-borrow fees, halts, partial fills, and broker-specific pricing are not modeled.</p>
              </article>

              <article>
                <span className="guide-number">06</span>
                <h3>Your account owns the state</h3>
                <p>Usernames are normalized. Passwords are salted and slow-hashed; raw passwords are never stored. Session tokens are random, only their hashes enter the database, and the browser receives a secure HTTP-only cookie. Model, checkpoints, selected dates, portfolio, and orders are stored under the signed-in account.</p>
              </article>

              <article>
                <span className="guide-number">07</span>
                <h3>What “Live” means today</h3>
                <p>Live mode is deliberately blank. It has no quote vendor, broker API, credentials, positions, or order route. Sandbox uses synthetic AAPL-like data, not historical AAPL candles, and cannot prove future profitability or place a real trade.</p>
              </article>
            </div>

            <div className="guide-actions">
              <button className="primary-button" type="button" onClick={() => setActiveView("chart")}><BarChart3 size={15} /> Open Backtest</button>
              <button className="secondary-button" type="button" onClick={() => setWorkspaceMode(null)}>Change mode</button>
              <button className="text-button" type="button" onClick={() => void signOut()}><LogOut size={14} /> Sign out {accountUser?.username}</button>
            </div>
          </section>
        )}

        <footer className="app-footer refined-footer">
          <div><ShieldCheck size={14} /> Research sandbox only. Never fund it with borrowed or family money.</div>
          <span>Synthetic regime tape—not historical AAPL returns / saved checkpoints and portfolio</span>
        </footer>
      </div>

      {toast && <div className="toast"><Check size={15} /> {toast}</div>}
    </main>
  );
}
