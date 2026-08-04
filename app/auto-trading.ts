import { getD1 } from "../db";

const BARS_PER_SESSION = 78;
const OPENING_RANGE_BARS = 3;
const LAST_ENTRY_BAR = 74;
const MAX_ENTRIES_PER_SESSION = 22;
const RISK_PER_TRADE = 0.005;
const DAILY_LOSS_LIMIT = 0.02;
const LOSS_COOLDOWN_BARS = 1;
const PAPER_STARTING_CASH = 25_000;

type LiveBar = {
  date: string; time: string; timestamp: string; barInSession: number;
  open: number; high: number; low: number; close: number; volume: number;
  ema9: number; ema21: number; ema50: number; rsi: number;
  upperBand: number; lowerBand: number; momentum: number; volatility: number;
  vwap: number; volumeRatio: number; atr: number; macd: number; macdSignal: number;
  adx: number; directionalIndex: number; openingHigh: number; openingLow: number;
  sessionHighBefore: number; sessionLowBefore: number; priorHigh: number; priorLow: number;
  priorClose: number; rollingHigh: number; rollingLow: number; bandWidthRatio: number;
  rangeExpansion: number; closeLocation: number; bodyStrength: number; obv: number; obvSlope: number;
  dailyTrend: number; dailyVolatility: number; dailyBreakout: number;
};

type RawBar = Pick<LiveBar, "date" | "time" | "timestamp" | "barInSession" | "open" | "high" | "low" | "close" | "volume">;
type RawDailyBar = { date: string; open: number; high: number; low: number; close: number; volume: number };
type DailyContext = Pick<LiveBar, "dailyTrend" | "dailyVolatility" | "dailyBreakout">;
type Model = Record<string, unknown>;
type AutoPaper = {
  cash: number; shares: number; avgPrice: number; positionOpenedAt: number;
  stopPrice: number; targetPrice: number; entrySetup: string; entryFees: number;
  entrySlippage: number; entryRisk: number; barsHeld: number; maxHoldBars: number;
  pendingEntry: Record<string, unknown> | null; currentSession: string;
  entriesThisSession: number; cooldownBars: number; dailyStartEquity: number;
  dailyLocked: boolean; lastBarTimestamp: string; realized: number;
  orders: Array<Record<string, unknown>>; equityHistory: Array<{ time: string; value: number }>;
};

type AutoTradeSummary = { marketDate: string; barsProcessed: number; usersProcessed: number; ordersCreated: number };
type YahooPayload = { chart?: { result?: Array<{ timestamp?: number[]; indicators?: { quote?: Array<{ open?: Array<number | null>; high?: Array<number | null>; low?: Array<number | null>; close?: Array<number | null>; volume?: Array<number | null> }> } }> } };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const finite = (value: unknown, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

function dateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return { date: `${part("year")}-${part("month")}-${part("day")}`, time: `${part("hour").replace(/^24$/, "00")}:${part("minute")}` };
}

function marketClock(now = new Date()) {
  const parts = dateParts(now);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "short" }).format(now);
  const [hour, minute] = parts.time.split(":").map(Number);
  return { date: parts.date, minutes: hour * 60 + minute, weekday };
}

function isWeekday(value: string) {
  return value !== "Sat" && value !== "Sun";
}

function rawBarsFromYahoo(payload: YahooPayload): RawBar[] {
  const result = payload.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  return (result?.timestamp ?? []).flatMap((timestamp, index) => {
    const open = quote?.open?.[index]; const high = quote?.high?.[index]; const low = quote?.low?.[index]; const close = quote?.close?.[index]; const volume = quote?.volume?.[index];
    if (![open, high, low, close].every((value) => typeof value === "number" && Number.isFinite(value)) || typeof volume !== "number" || !Number.isFinite(volume)) return [];
    const parts = dateParts(new Date(timestamp * 1000));
    const [hour, minute] = parts.time.split(":").map(Number);
    const minutesFromOpen = hour * 60 + minute - 570;
    if (minutesFromOpen < 0 || minutesFromOpen >= 390 || minutesFromOpen % 5 !== 0) return [];
    return [{ date: parts.date, time: parts.time, timestamp: `${parts.date}-${parts.time}`, barInSession: minutesFromOpen / 5, open: open as number, high: high as number, low: low as number, close: close as number, volume: Math.max(0, Math.round(volume)) }];
  });
}

function dailyBarsFromYahoo(payload: YahooPayload): RawDailyBar[] {
  const result = payload.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  return (result?.timestamp ?? []).flatMap((timestamp, index) => {
    const open = quote?.open?.[index]; const high = quote?.high?.[index]; const low = quote?.low?.[index]; const close = quote?.close?.[index]; const volume = quote?.volume?.[index];
    if (![open, high, low, close, volume].every((value) => typeof value === "number" && Number.isFinite(value))) return [];
    return [{ date: dateParts(new Date(timestamp * 1000)).date, open: open as number, high: high as number, low: low as number, close: close as number, volume: Math.max(0, Math.round(volume as number)) }];
  });
}

function buildDailyContext(dailyBars: RawDailyBar[]): Map<string, DailyContext> {
  const contexts = new Map<string, DailyContext>();
  const closes: number[] = [];
  const returns: number[] = [];
  let ema20 = 0;
  let ema50 = 0;
  let previousContext: DailyContext = { dailyTrend: 0, dailyVolatility: 0, dailyBreakout: 0 };
  for (const bar of [...dailyBars].sort((a, b) => a.date.localeCompare(b.date))) {
    const previousClose = closes.at(-1) ?? bar.close;
    const previousReturns = returns.slice(-20);
    const averageReturn = previousReturns.length ? previousReturns.reduce((sum, value) => sum + value, 0) / previousReturns.length : 0;
    const variance = previousReturns.length ? previousReturns.reduce((sum, value) => sum + (value - averageReturn) ** 2, 0) / previousReturns.length : 0;
    const priorWindow = closes.slice(-20);
    const priorHigh = priorWindow.length ? Math.max(...priorWindow) : bar.close;
    const priorLow = priorWindow.length ? Math.min(...priorWindow) : bar.close;
    contexts.set(bar.date, previousContext);
    ema20 = ema20 ? bar.close * (2 / 21) + ema20 * (19 / 21) : bar.close;
    ema50 = ema50 ? bar.close * (2 / 51) + ema50 * (49 / 51) : bar.close;
    const dailyReturn = previousClose ? bar.close / previousClose - 1 : 0;
    returns.push(dailyReturn);
    closes.push(bar.close);
    previousContext = {
      dailyTrend: clamp((ema20 - ema50) / Math.max(bar.close * 0.018, 0.01), -1, 1),
      dailyVolatility: clamp(Math.sqrt(variance) / 0.018, 0, 2),
      dailyBreakout: bar.close > priorHigh ? 0.7 : bar.close < priorLow ? -0.7 : 0,
    };
  }
  return contexts;
}

function enrichBars(raw: RawBar[], dailyBars: RawDailyBar[] = []): LiveBar[] {
  const dailyContext = buildDailyContext(dailyBars);
  const closes = raw.map((bar) => bar.close); const returns = closes.map((close, index) => index ? close / closes[index - 1] - 1 : 0);
  let fast = closes[0] ?? 0; let slow = fast; let medium = fast; let ema12 = fast; let ema26 = fast; let macdSignal = 0; let avgGain = 0; let avgLoss = 0; let atr = 0; let adx = 18; let plusDmAverage = 0; let minusDmAverage = 0;
  let activeSession = ""; let cumulativeTypicalVolume = 0; let cumulativeVolume = 0; let openingHigh = raw[0]?.high ?? 0; let openingLow = raw[0]?.low ?? 0; let sessionHigh = raw[0]?.open ?? 0; let sessionLow = raw[0]?.open ?? 0; let priorHigh = raw[0]?.high ?? 0; let priorLow = raw[0]?.low ?? 0; let priorClose = raw[0]?.open ?? 0; let obv = 0;
  const bandWidths: number[] = []; const signedVolumes: number[] = [];
  return raw.map((bar, index) => {
    fast = index ? bar.close * 0.2 + fast * 0.8 : bar.close; slow = index ? bar.close * (2 / 22) + slow * (20 / 22) : bar.close; medium = index ? bar.close * (2 / 51) + medium * (49 / 51) : bar.close; ema12 = index ? bar.close * (2 / 13) + ema12 * (11 / 13) : bar.close; ema26 = index ? bar.close * (2 / 27) + ema26 * (25 / 27) : bar.close;
    const macd = ema12 - ema26; macdSignal = index ? macd * 0.2 + macdSignal * 0.8 : macd; const change = index ? bar.close - closes[index - 1] : 0; const gain = Math.max(0, change); const loss = Math.max(0, -change);
    if (index < 14) { avgGain = (avgGain * index + gain) / (index + 1); avgLoss = (avgLoss * index + loss) / (index + 1); } else { avgGain = (avgGain * 13 + gain) / 14; avgLoss = (avgLoss * 13 + loss) / 14; }
    const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss); const bandWindow = closes.slice(Math.max(0, index - 19), index + 1); const mean = bandWindow.reduce((sum, value) => sum + value, 0) / bandWindow.length; const deviation = Math.sqrt(bandWindow.reduce((sum, value) => sum + (value - mean) ** 2, 0) / bandWindow.length); const returnWindow = returns.slice(Math.max(0, index - 19), index + 1); const returnMean = returnWindow.reduce((sum, value) => sum + value, 0) / returnWindow.length; const volatility = Math.sqrt(returnWindow.reduce((sum, value) => sum + (value - returnMean) ** 2, 0) / returnWindow.length);
    const previous = raw[Math.max(0, index - 1)]; const trueRange = index ? Math.max(bar.high - bar.low, Math.abs(bar.high - previous.close), Math.abs(bar.low - previous.close)) : bar.high - bar.low; const upMove = index ? bar.high - previous.high : 0; const downMove = index ? previous.low - bar.low : 0; const plusDm = upMove > downMove && upMove > 0 ? upMove : 0; const minusDm = downMove > upMove && downMove > 0 ? downMove : 0;
    if (index < 14) { atr = (atr * index + trueRange) / (index + 1); plusDmAverage = (plusDmAverage * index + plusDm) / (index + 1); minusDmAverage = (minusDmAverage * index + minusDm) / (index + 1); } else { atr = (atr * 13 + trueRange) / 14; plusDmAverage = (plusDmAverage * 13 + plusDm) / 14; minusDmAverage = (minusDmAverage * 13 + minusDm) / 14; }
    const plusDi = atr ? plusDmAverage / atr * 100 : 0; const minusDi = atr ? minusDmAverage / atr * 100 : 0; const dx = plusDi + minusDi ? Math.abs(plusDi - minusDi) / (plusDi + minusDi) * 100 : 0; adx = index < 14 ? (adx * index + dx) / (index + 1) : (adx * 13 + dx) / 14;
    if (bar.date !== activeSession) { if (activeSession && index > 0) { priorHigh = sessionHigh; priorLow = sessionLow; priorClose = raw[index - 1].close; } activeSession = bar.date; cumulativeTypicalVolume = 0; cumulativeVolume = 0; openingHigh = bar.high; openingLow = bar.low; sessionHigh = bar.open; sessionLow = bar.open; }
    const sessionHighBefore = sessionHigh; const sessionLowBefore = sessionLow; if (bar.barInSession < OPENING_RANGE_BARS) { openingHigh = bar.barInSession === 0 ? bar.high : Math.max(openingHigh, bar.high); openingLow = bar.barInSession === 0 ? bar.low : Math.min(openingLow, bar.low); }
    const typical = (bar.high + bar.low + bar.close) / 3; cumulativeTypicalVolume += typical * bar.volume; cumulativeVolume += bar.volume; const volumeWindow = raw.slice(Math.max(0, index - BARS_PER_SESSION), index); const averageVolume = volumeWindow.length ? volumeWindow.reduce((sum, value) => sum + value.volume, 0) / volumeWindow.length : bar.volume; const signedVolume = Math.sign(change) * bar.volume; obv += signedVolume; signedVolumes.push(signedVolume); const obvWindow = signedVolumes.slice(Math.max(0, signedVolumes.length - 8)); const obvSlope = clamp(obvWindow.reduce((sum, value) => sum + value, 0) / Math.max(1, averageVolume * obvWindow.length), -1, 1);
    const rollingWindow = raw.slice(Math.max(0, index - BARS_PER_SESSION), index); const rollingHigh = rollingWindow.length ? Math.max(...rollingWindow.map((value) => value.high)) : bar.high; const rollingLow = rollingWindow.length ? Math.min(...rollingWindow.map((value) => value.low)) : bar.low; const bandWidth = mean ? deviation * 4 / mean : 0; const previousBandWidths = bandWidths.slice(Math.max(0, bandWidths.length - BARS_PER_SESSION)); const averageBandWidth = previousBandWidths.length ? previousBandWidths.reduce((sum, value) => sum + value, 0) / previousBandWidths.length : Math.max(0.0001, bandWidth); const bandWidthRatio = clamp(bandWidth / Math.max(0.0001, averageBandWidth), 0.2, 3); bandWidths.push(bandWidth); const candleRange = Math.max(0.0001, bar.high - bar.low); const closeLocation = clamp((bar.close - bar.low) / candleRange * 2 - 1, -1, 1); const bodyStrength = clamp((bar.close - bar.open) / candleRange, -1, 1); sessionHigh = Math.max(sessionHigh, bar.high); sessionLow = Math.min(sessionLow, bar.low);
    const context = dailyContext.get(bar.date) ?? { dailyTrend: 0, dailyVolatility: 0, dailyBreakout: 0 };
    return { ...bar, ema9: fast, ema21: slow, ema50: medium, rsi, upperBand: mean + deviation * 2, lowerBand: mean - deviation * 2, momentum: index < 6 ? 0 : bar.close / closes[index - 6] - 1, volatility, vwap: cumulativeTypicalVolume / Math.max(1, cumulativeVolume), volumeRatio: clamp(bar.volume / Math.max(1, averageVolume), 0, 3), atr: Math.max(atr, bar.close * 0.0012), macd, macdSignal, adx, directionalIndex: clamp((plusDi - minusDi) / 38, -1, 1), openingHigh, openingLow, sessionHighBefore, sessionLowBefore, priorHigh, priorLow, priorClose, rollingHigh, rollingLow, bandWidthRatio, rangeExpansion: clamp(trueRange / Math.max(0.0001, atr), 0, 4), closeLocation, bodyStrength, obv, obvSlope, ...context };
  });
}

let liveStreamCache: { expiresAt: number; bars: LiveBar[] } | null = null;
async function getLivePaperStream() {
  if (liveStreamCache && liveStreamCache.expiresAt > Date.now()) return liveStreamCache.bars;
  const url = new URL("https://query1.finance.yahoo.com/v8/finance/chart/AAPL"); url.search = new URLSearchParams({ interval: "5m", range: "5d", includePrePost: "false", events: "div,splits" }).toString();
  const dailyUrl = new URL("https://query1.finance.yahoo.com/v8/finance/chart/AAPL"); dailyUrl.search = new URLSearchParams({ interval: "1d", range: "2y", includePrePost: "false", events: "div,splits" }).toString();
  const [response, dailyResponse] = await Promise.all([
    fetch(url, { headers: { accept: "application/json", "user-agent": "AxionTrades/1.0" } }),
    fetch(dailyUrl, { headers: { accept: "application/json", "user-agent": "AxionTrades/1.0" } }),
  ]);
  if (!response.ok) throw new Error(`Market data provider returned ${response.status}`);
  const payload = await response.json() as YahooPayload;
  const dailyPayload = dailyResponse.ok ? await dailyResponse.json() as YahooPayload : null;
  const raw = rawBarsFromYahoo(payload);
  if (!raw.length) throw new Error("Market data provider returned no regular-session bars");
  const latestDate = raw[raw.length - 1].date;
  const bars = enrichBars(raw, dailyPayload ? dailyBarsFromYahoo(dailyPayload) : []).filter((bar) => bar.date === latestDate);
  liveStreamCache = { expiresAt: Date.now() + 45_000, bars };
  return bars;
}

function normalizePaper(value: unknown, startingCash: number): AutoPaper {
  const paper = (value ?? {}) as Partial<AutoPaper>;
  return { cash: finite(paper.cash, startingCash), shares: Math.trunc(finite(paper.shares, 0)), avgPrice: Math.max(0, finite(paper.avgPrice, 0)), positionOpenedAt: Math.max(0, finite(paper.positionOpenedAt, 0)), stopPrice: Math.max(0, finite(paper.stopPrice, 0)), targetPrice: Math.max(0, finite(paper.targetPrice, 0)), entrySetup: typeof paper.entrySetup === "string" ? paper.entrySetup : "", entryFees: Math.max(0, finite(paper.entryFees, 0)), entrySlippage: Math.max(0, finite(paper.entrySlippage, 0)), entryRisk: Math.max(0, finite(paper.entryRisk, 0)), barsHeld: Math.max(0, Math.trunc(finite(paper.barsHeld, 0))), maxHoldBars: Math.max(1, Math.trunc(finite(paper.maxHoldBars, 9))), pendingEntry: paper.pendingEntry && typeof paper.pendingEntry === "object" ? paper.pendingEntry : null, currentSession: typeof paper.currentSession === "string" ? paper.currentSession : "", entriesThisSession: Math.max(0, Math.trunc(finite(paper.entriesThisSession, 0))), cooldownBars: Math.max(0, Math.trunc(finite(paper.cooldownBars, 0))), dailyStartEquity: Math.max(0, finite(paper.dailyStartEquity, startingCash)), dailyLocked: Boolean(paper.dailyLocked), lastBarTimestamp: typeof paper.lastBarTimestamp === "string" ? paper.lastBarTimestamp : "", realized: finite(paper.realized, 0), orders: Array.isArray(paper.orders) ? paper.orders.slice(0, 80) : [], equityHistory: Array.isArray(paper.equityHistory) ? paper.equityHistory.slice(-160) : [] };
}

function modelNumber(model: Model, key: string, fallback: number) { return finite(model[key], fallback); }
function scoreBar(bar: LiveBar, model: Model) {
  const atr = Math.max(bar.atr, bar.close * 0.0015); const trend = clamp((bar.ema9 - bar.ema21) / atr * 0.46 + (bar.ema21 - bar.ema50) / (atr * 1.4) * 0.22 + bar.directionalIndex * 0.22 + (bar.macd - bar.macdSignal) / (atr * 0.34) * 0.1, -1, 1); const momentum = clamp(bar.momentum / 0.014 * 0.58 + bar.bodyStrength * 0.25 + Math.sign(bar.macd - bar.macdSignal) * 0.17, -1, 1); const rsi = clamp((bar.rsi - 50) / 25, -1, 1); const vwap = clamp((bar.close - bar.vwap) / (atr * 1.15), -1, 1); const volume = clamp(bar.obvSlope * 0.56 + bar.bodyStrength * Math.max(0, bar.volumeRatio - 0.65) * 0.44, -1, 1); const breakout = bar.close > Math.max(bar.openingHigh, bar.rollingHigh) ? 0.75 : bar.close < Math.min(bar.openingLow, bar.rollingLow) ? -0.75 : 0; const meanReversion = clamp((50 - bar.rsi) / 28 - (bar.close - (bar.upperBand + bar.lowerBand) / 2) / Math.max(atr * 1.5, 0.01) * 0.25, -1, 1); const dailyTrend = clamp(bar.dailyTrend * 0.7 + bar.dailyBreakout * 0.3, -1, 1); const score = trend * modelNumber(model, "trend", 0.07) + dailyTrend * modelNumber(model, "trend", 0.07) * 0.28 + rsi * modelNumber(model, "rsi", 0.04) + momentum * modelNumber(model, "momentum", 0.1) + vwap * modelNumber(model, "vwap", 0.075) + volume * modelNumber(model, "volume", 0.045) + breakout * modelNumber(model, "orb", 0.15) + meanReversion * modelNumber(model, "levels", 0.09) + bar.bodyStrength * modelNumber(model, "pattern", 0.14) + Math.sign(bar.bodyStrength) * Math.max(0, bar.rangeExpansion - 0.8) * modelNumber(model, "volatility", 0.14);
  return { score: clamp(score * 1.45, -1, 1), trend };
}

function fillPrice(bar: LiveBar, reference: number, buying: boolean) { const spread = Math.max(0.01, reference * (0.000042 + Math.max(0, 1.08 - bar.volumeRatio) * 0.000042 + Math.max(0, bar.rangeExpansion - 1) * 0.000012)); return Math.max(0.01, reference + (buying ? spread / 2 : -spread / 2)); }
function fees(price: number, shares: number, sale: boolean) { return (sale ? price * shares * (20.6 / 1_000_000) : 0) + (sale ? Math.min(9.79, shares * 0.000195) : 0) + shares * 0.000003; }
function addOrder(paper: AutoPaper, order: Record<string, unknown>) { return [order, ...paper.orders].slice(0, 80); }

function advancePaper(paper: AutoPaper, bar: LiveBar, model: Model): AutoPaper {
  let next = { ...paper }; if (next.currentSession !== bar.date) next = { ...next, currentSession: bar.date, entriesThisSession: 0, cooldownBars: 0, dailyStartEquity: next.cash + next.shares * bar.open, dailyLocked: false, pendingEntry: null }; else if (next.cooldownBars > 0) next.cooldownBars -= 1;
  const scored = scoreBar(bar, model); const threshold = modelNumber(model, "threshold", 0.2) * 0.6; const sessionClose = bar.barInSession >= BARS_PER_SESSION - 1; let exitReason = ""; let exitPrice = bar.close;
  if (next.shares > 0) { if (bar.low <= next.stopPrice) { exitReason = "ATR risk stop"; exitPrice = Math.min(next.stopPrice, bar.open); } else if (bar.high >= next.targetPrice) { exitReason = "Risk / reward target"; exitPrice = next.targetPrice; } else if (sessionClose || next.barsHeld >= next.maxHoldBars || scored.score < -threshold) exitReason = sessionClose ? "Closing bell" : scored.score < -threshold ? "Confluence reversed" : "Time stop"; }
  else if (next.shares < 0) { if (bar.high >= next.stopPrice) { exitReason = "ATR risk stop"; exitPrice = Math.max(next.stopPrice, bar.open); } else if (bar.low <= next.targetPrice) { exitReason = "Risk / reward target"; exitPrice = next.targetPrice; } else if (sessionClose || next.barsHeld >= next.maxHoldBars || scored.score > threshold) exitReason = sessionClose ? "Closing bell" : scored.score > threshold ? "Confluence reversed" : "Time stop"; }
  if (next.shares !== 0 && exitReason) { const quantity = Math.abs(next.shares); const buying = next.shares < 0; const price = fillPrice(bar, exitPrice, buying); const exitFees = fees(price, quantity, !buying); const pnl = next.shares > 0 ? (price - next.avgPrice) * quantity - exitFees - next.entryFees : (next.avgPrice - price) * quantity - exitFees - next.entryFees; next = { ...next, cash: next.shares > 0 ? next.cash + price * quantity - exitFees : next.cash - price * quantity - exitFees, shares: 0, avgPrice: 0, positionOpenedAt: 0, stopPrice: 0, targetPrice: 0, entrySetup: "", entryFees: 0, entrySlippage: 0, entryRisk: 0, barsHeld: 0, maxHoldBars: 9, cooldownBars: pnl < 0 ? LOSS_COOLDOWN_BARS : 0, realized: next.realized + pnl, orders: addOrder(next, { id: `auto-${buying ? "cover" : "sell"}-${bar.timestamp}-${next.orders.length}`, time: `${bar.date} ${bar.time} ET`, side: buying ? "COVER" : "SELL", shares: quantity, price, fees: exitFees, slippage: Math.abs(price - exitPrice) * quantity, note: exitReason }) }; } else if (next.shares !== 0) next.barsHeld += 1;
  if (next.shares === 0 && next.cooldownBars === 0 && !next.dailyLocked && next.entriesThisSession < MAX_ENTRIES_PER_SESSION && bar.barInSession >= OPENING_RANGE_BARS - 1 && bar.barInSession < LAST_ENTRY_BAR && bar.volumeRatio > 0.38 && Math.abs(scored.score) > threshold) {
    const long = scored.score > 0; const confidence = Math.round(clamp(50 + Math.abs(scored.score) * 45, 50, 98)); const stopDistance = Math.max(bar.atr * (Math.abs(scored.trend) > 0.35 ? 0.82 : 0.65), bar.close * 0.0012); const confidenceScale = confidence >= 84 ? 1 : confidence >= 72 ? 0.99 : 0.72; const equity = Math.max(0, next.cash + next.shares * bar.open); const riskBudget = equity * RISK_PER_TRADE * confidenceScale; const allocation = equity * (long ? 0.97 : 0.9) * confidenceScale; const price = fillPrice(bar, bar.open, long); const quantity = Math.floor(Math.min(allocation / price, riskBudget / stopDistance)); const entryFees = fees(price, quantity, !long);
    const dailyAligned = long ? bar.dailyTrend >= -0.48 : bar.dailyTrend <= 0.48;
    if (dailyAligned && quantity > 0 && (long ? next.cash - price * quantity - entryFees >= -0.01 : true)) next = { ...next, cash: long ? next.cash - price * quantity - entryFees : next.cash + price * quantity - entryFees, shares: long ? quantity : -quantity, avgPrice: price, positionOpenedAt: Date.now(), stopPrice: long ? price - stopDistance : price + stopDistance, targetPrice: long ? price + stopDistance * 1.55 : price - stopDistance * 1.55, entrySetup: "Live ensemble auto-run", entryFees, entrySlippage: Math.abs(price - bar.open) * quantity, entryRisk: stopDistance, barsHeld: 0, maxHoldBars: Math.abs(scored.trend) > 0.35 ? 8 : 5, entriesThisSession: next.entriesThisSession + 1, orders: addOrder(next, { id: `auto-${long ? "buy" : "short"}-${bar.timestamp}-${next.orders.length}`, time: `${bar.date} ${bar.time} ET`, side: long ? "BUY" : "SHORT", shares: quantity, price, fees: entryFees, slippage: Math.abs(price - bar.open) * quantity, note: `Auto-run ensemble ${confidence}% confidence` }) };
  }
  const equity = next.cash + next.shares * bar.close; if (equity <= next.dailyStartEquity * (1 - DAILY_LOSS_LIMIT)) next.dailyLocked = true;
  return { ...next, pendingEntry: null, lastBarTimestamp: bar.timestamp, equityHistory: [...next.equityHistory, { time: bar.timestamp, value: equity }].slice(-160) };
}

function closedBarInSession(now = new Date()) { const clock = marketClock(now); if (clock.minutes < 570) return -1; return Math.min(BARS_PER_SESSION - 1, Math.floor((clock.minutes - 570) / 5) - 1); }

export async function runAutoPaperTrading(): Promise<AutoTradeSummary> {
  const clock = marketClock(); if (!isWeekday(clock.weekday) || clock.minutes < 570 || clock.minutes > 960) return { marketDate: clock.date, barsProcessed: 0, usersProcessed: 0, ordersCreated: 0 };
  const stream = await getLivePaperStream(); const bars = stream.filter((bar) => bar.date === clock.date && bar.barInSession <= closedBarInSession()); if (!bars.length) return { marketDate: clock.date, barsProcessed: 0, usersProcessed: 0, ordersCreated: 0 };
  const users = await getD1().prepare(`SELECT a.id, s.payload FROM accounts a INNER JOIN account_states s ON s.account_id = a.id WHERE JSON_EXTRACT(s.payload, '$.preferences.autoRun') = 1`).all<{ id: string; payload: string }>(); let usersProcessed = 0; let ordersCreated = 0;
  for (const user of users.results ?? []) { try { const state = JSON.parse(user.payload) as { paper?: unknown; model?: Model; preferences?: { paperStartingCash?: number; autoRun?: boolean } }; if (!state.preferences?.autoRun) continue; const startingCash = finite(state.preferences.paperStartingCash, PAPER_STARTING_CASH); let paper = normalizePaper(state.paper, startingCash); const previousOrders = paper.orders.length; const lastIndex = paper.lastBarTimestamp ? bars.findIndex((bar) => bar.timestamp === paper.lastBarTimestamp) : -1; const startIndex = lastIndex >= 0 ? lastIndex + 1 : 0; for (const bar of bars.slice(startIndex)) paper = advancePaper(paper, bar, state.model ?? {}); if (startIndex >= bars.length) continue; state.paper = paper; await getD1().prepare(`UPDATE account_states SET payload = ?, revision = revision + 1, updated_at = CURRENT_TIMESTAMP WHERE account_id = ?`).bind(JSON.stringify(state), user.id).run(); usersProcessed += 1; ordersCreated += Math.max(0, paper.orders.length - previousOrders); } catch (error) { console.error("Auto-run failed for account:", error); } }
  return { marketDate: clock.date, barsProcessed: bars.length, usersProcessed, ordersCreated };
}
