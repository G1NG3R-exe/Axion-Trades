"use client";

import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bot,
  BrainCircuit,
  CalendarRange,
  Check,
  CircleDollarSign,
  Clock3,
  Cpu,
  Database,
  Gauge,
  Info,
  Layers3,
  Pause,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  WalletCards,
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
};

type ModelWeights = {
  trend: number;
  rsi: number;
  momentum: number;
  volatility: number;
  threshold: number;
};

type Trade = {
  id: string;
  date: string;
  side: "BUY" | "SELL";
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
  signal: "BUY" | "HOLD" | "SELL";
  confidence: number;
};

type PaperOrder = {
  id: string;
  time: string;
  side: "BUY" | "SELL";
  shares: number;
  price: number;
  note: string;
};

type PaperAccount = {
  cash: number;
  shares: number;
  avgPrice: number;
  realized: number;
  orders: PaperOrder[];
};

const STARTING_CAPITAL = 10_000;
const PAPER_STARTING_CASH = 25_000;
const DATA_START = "2020-01-02";
const DATA_END = "2026-07-29";
const DEFAULT_START = "2024-01-02";
const DEFAULT_END = "2025-12-31";

const INITIAL_MODEL: ModelWeights = {
  trend: 0.49,
  rsi: 0.18,
  momentum: 0.24,
  volatility: 0.09,
  threshold: 0.24,
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
    "ema9" | "ema21" | "rsi" | "upperBand" | "lowerBand" | "momentum" | "volatility"
  >[] = [];
  const cursor = new Date(`${DATA_START}T12:00:00Z`);
  const lastDate = new Date(`${DATA_END}T12:00:00Z`);
  let previousClose = 73.41;
  let session = 0;

  while (cursor <= lastDate) {
    const weekday = cursor.getUTCDay();
    if (weekday !== 0 && weekday !== 6) {
      const trendRegime = Math.sin(session / 58) > -0.18 ? 0.00115 : -0.0017;
      const longDrift = 0.00042 + 0.00028 * Math.sin(session / 210);
      const pulse = 0.00135 * Math.sin(session / 17) + 0.0008 * Math.sin(session / 41);
      const noise = (random() - 0.5) * 0.027;
      let dailyReturn = longDrift + trendRegime + pulse + noise;
      if (session % 233 === 0 && session > 0) dailyReturn -= 0.052;
      if (session % 311 === 0 && session > 0) dailyReturn += 0.043;

      const gap = (random() - 0.5) * 0.009;
      const open = previousClose * (1 + gap);
      const close = Math.max(18, previousClose * (1 + dailyReturn));
      const range = 0.006 + random() * 0.017;
      const high = Math.max(open, close) * (1 + range * (0.45 + random() * 0.55));
      const low = Math.min(open, close) * (1 - range * (0.4 + random() * 0.5));
      const volume = Math.round(
        48_000_000 * (0.72 + random() * 0.76) * (1 + Math.abs(dailyReturn) * 7.5),
      );

      raw.push({
        date: cursor.toISOString().slice(0, 10),
        open,
        high,
        low,
        close,
        volume,
      });
      previousClose = close;
      session += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const closes = raw.map((bar) => bar.close);
  const returns = closes.map((close, index) =>
    index === 0 ? 0 : close / closes[index - 1] - 1,
  );
  let fast = closes[0];
  let slow = closes[0];
  let avgGain = 0;
  let avgLoss = 0;

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

    const bandStart = Math.max(0, index - 19);
    const window = closes.slice(bandStart, index + 1);
    const mean = window.reduce((sum, value) => sum + value, 0) / window.length;
    const deviation = Math.sqrt(
      window.reduce((sum, value) => sum + (value - mean) ** 2, 0) / window.length,
    );

    const returnWindow = returns.slice(Math.max(0, index - 13), index + 1);
    const returnMean =
      returnWindow.reduce((sum, value) => sum + value, 0) / returnWindow.length;
    const volatility = Math.sqrt(
      returnWindow.reduce((sum, value) => sum + (value - returnMean) ** 2, 0) /
        returnWindow.length,
    );

    return {
      ...bar,
      ema9: fast,
      ema21: slow,
      rsi,
      upperBand: mean + deviation * 2,
      lowerBand: mean - deviation * 2,
      momentum:
        index < 10 ? 0 : bar.close / closes[Math.max(0, index - 10)] - 1,
      volatility,
    };
  });
}

const MARKET_DATA = generateMarketData();

function scoreBar(bar: MarketBar, weights: ModelWeights) {
  const trend = clamp(((bar.ema9 - bar.ema21) / bar.close) * 45, -1, 1);
  const rsiEdge = clamp((52 - bar.rsi) / 28, -1, 1);
  const momentum = clamp(bar.momentum / 0.055, -1, 1);
  const volatility = clamp((0.017 - bar.volatility) / 0.017, -1, 1);
  const score =
    trend * weights.trend +
    rsiEdge * weights.rsi +
    momentum * weights.momentum +
    volatility * weights.volatility;

  return {
    score: clamp(score, -1, 1),
    factors: { trend, rsi: rsiEdge, momentum, volatility },
  };
}

function runBacktest(
  data: MarketBar[],
  weights: ModelWeights,
  startingCapital = STARTING_CAPITAL,
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
    };
  }

  let cash = startingCapital;
  let shares = 0;
  let entryPrice = 0;
  let peak = startingCapital;
  let maxDrawdown = 0;
  const trades: Trade[] = [];
  const equity: number[] = [];
  const scores: number[] = [];
  const dailyReturns: number[] = [];
  const holdShares = startingCapital / data[0].close;
  const buyHoldEquity = data.map((bar) => holdShares * bar.close);
  let previousEquity = startingCapital;
  let wins = 0;
  let exits = 0;

  data.forEach((bar, index) => {
    const { score } = scoreBar(bar, weights);
    scores.push(score);
    const confidence = Math.round(50 + Math.min(0.49, Math.abs(score)) * 100);
    const canTrade = index > 22;

    if (
      canTrade &&
      shares === 0 &&
      score > weights.threshold &&
      bar.ema9 > bar.ema21 &&
      bar.rsi < 76
    ) {
      const fill = bar.close * 1.0006;
      const quantity = Math.floor((cash * 0.97 - 1) / fill);
      if (quantity > 0) {
        const cost = quantity * fill + 1;
        cash -= cost;
        shares = quantity;
        entryPrice = fill;
        trades.push({
          id: `buy-${bar.date}-${index}`,
          date: bar.date,
          side: "BUY",
          price: fill,
          shares: quantity,
          value: cost,
          pnl: null,
          confidence,
          reason: bar.rsi < 48 ? "Trend + RSI recovery" : "Momentum crossover",
        });
      }
    } else if (
      canTrade &&
      shares > 0 &&
      (score < -weights.threshold * 0.52 ||
        (bar.ema9 < bar.ema21 && bar.rsi > 42) ||
        bar.rsi > 78)
    ) {
      const fill = bar.close * 0.9994;
      const proceeds = shares * fill - 1;
      const pnl = (fill - entryPrice) * shares - 2;
      cash += proceeds;
      exits += 1;
      if (pnl > 0) wins += 1;
      trades.push({
        id: `sell-${bar.date}-${index}`,
        date: bar.date,
        side: "SELL",
        price: fill,
        shares,
        value: proceeds,
        pnl,
        confidence,
        reason: bar.rsi > 78 ? "Overbought guardrail" : "Risk-off signal",
      });
      shares = 0;
      entryPrice = 0;
    }

    const portfolioValue = cash + shares * bar.close;
    equity.push(portfolioValue);
    peak = Math.max(peak, portfolioValue);
    maxDrawdown = Math.min(maxDrawdown, portfolioValue / peak - 1);
    if (index > 0) dailyReturns.push(portfolioValue / previousEquity - 1);
    previousEquity = portfolioValue;
  });

  const finalValue = cash + shares * data[data.length - 1].close;
  const strategyReturn = finalValue / startingCapital - 1;
  const buyHoldReturn = buyHoldEquity[buyHoldEquity.length - 1] / startingCapital - 1;
  const averageReturn =
    dailyReturns.reduce((sum, value) => sum + value, 0) /
    Math.max(1, dailyReturns.length);
  const returnDeviation = Math.sqrt(
    dailyReturns.reduce((sum, value) => sum + (value - averageReturn) ** 2, 0) /
      Math.max(1, dailyReturns.length),
  );
  const latestScore = scores[scores.length - 1];
  const signal =
    latestScore > weights.threshold
      ? "BUY"
      : latestScore < -weights.threshold * 0.52
        ? "SELL"
        : "HOLD";

  return {
    finalValue,
    strategyReturn,
    buyHoldReturn,
    alpha: strategyReturn - buyHoldReturn,
    maxDrawdown,
    sharpe: returnDeviation === 0 ? 0 : (averageReturn / returnDeviation) * Math.sqrt(252),
    winRate: exits === 0 ? 0 : wins / exits,
    trades,
    equity,
    buyHoldEquity,
    scores,
    signal,
    confidence: Math.round(50 + Math.min(0.49, Math.abs(latestScore)) * 100),
  };
}

function dateLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
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
}: {
  data: MarketBar[];
  result: BacktestResult;
  viewport: "ALL" | "1Y" | "6M" | "3M";
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [revision, setRevision] = useState(0);
  const [hovered, setHovered] = useState<number | null>(null);
  const [layers, setLayers] = useState({
    averages: true,
    bands: true,
    rsi: true,
    trades: true,
  });

  const requestedBars = viewport === "ALL" ? data.length : viewport === "1Y" ? 252 : viewport === "6M" ? 126 : 63;
  const offset = Math.max(0, data.length - requestedBars);
  const visible = data.slice(offset);
  const visibleScores = result.scores.slice(offset);
  const tradeByDate = useMemo(
    () => new Map(result.trades.map((trade) => [trade.date, trade])),
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
      context.strokeStyle = "rgba(255,255,255,0.07)";
      context.beginPath();
      context.moveTo(left, y + 0.5);
      context.lineTo(width - right + 6, y + 0.5);
      context.stroke();
      const value = priceMax - ((priceMax - priceMin) / 4) * line;
      context.fillStyle = "rgba(198,205,213,0.65)";
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

    if (layers.trades) {
      visible.forEach((bar, index) => {
        const trade = tradeByDate.get(bar.date);
        if (!trade) return;
        const markerY =
          trade.side === "BUY" ? yPrice(bar.low) + 12 : yPrice(bar.high) - 12;
        context.fillStyle = trade.side === "BUY" ? "#62d6b6" : "#f17875";
        context.beginPath();
        if (trade.side === "BUY") {
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

    context.strokeStyle = "rgba(255,255,255,0.08)";
    context.beginPath();
    context.moveTo(left, oscTop);
    context.lineTo(width - right + 6, oscTop);
    context.stroke();

    [30, 50, 70].forEach((value) => {
      const y = yRsi(value);
      context.setLineDash(value === 50 ? [2, 5] : [4, 5]);
      context.strokeStyle = value === 50 ? "rgba(255,255,255,0.06)" : "rgba(240,198,107,0.13)";
      context.beginPath();
      context.moveTo(left, y);
      context.lineTo(width - right + 6, y);
      context.stroke();
      context.setLineDash([]);
      context.fillStyle = "rgba(198,205,213,0.48)";
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
      const date = new Date(`${visible[index].date}T12:00:00Z`);
      const text = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }).format(date);
      context.fillStyle = "rgba(198,205,213,0.48)";
      context.textAlign = label === 0 ? "left" : label === labelCount - 1 ? "right" : "center";
      context.fillText(text, x(index), height - 7);
    }

    if (hovered !== null && visible[hovered]) {
      const crossX = x(hovered);
      context.setLineDash([3, 4]);
      context.strokeStyle = "rgba(255,255,255,0.23)";
      context.beginPath();
      context.moveTo(crossX, priceTop);
      context.lineTo(crossX, oscBottom);
      context.stroke();
      context.setLineDash([]);
      context.fillStyle = "#dfe5e1";
      context.beginPath();
      context.arc(crossX, yPrice(visible[hovered].close), 3, 0, Math.PI * 2);
      context.fill();
    }
  }, [visible, visibleScores, layers, hovered, revision, tradeByDate]);

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
  const hoverTrade = hoverBar ? tradeByDate.get(hoverBar.date) : null;

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
          <span className="trade-dots"><i /><i /></span> AI trades
        </button>
        <span className="legend-chip static"><span className="legend-swatch score" /> AI score</span>
      </div>
      <div className="chart-frame" ref={frameRef}>
        <canvas
          ref={canvasRef}
          onPointerMove={pointerMove}
          onPointerLeave={() => setHovered(null)}
          aria-label="AAPL candlestick chart with EMA, Bollinger Bands, RSI, AI score, volume, and trade markers"
          role="img"
        />
        {hoverBar && (
          <div
            className={hovered !== null && hovered > visible.length * 0.66 ? "chart-tooltip left" : "chart-tooltip"}
          >
            <div className="tooltip-date">
              <span>{dateLabel(hoverBar.date)}</span>
              {hoverTrade && <b className={hoverTrade.side === "BUY" ? "buy" : "sell"}>{hoverTrade.side}</b>}
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
              <span>Vol <b>{compact(hoverBar.volume)}</b></span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EquityChart({ result }: { result: BacktestResult }) {
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
    drawLine(result.buyHoldEquity, "rgba(169,156,246,0.46)");
    drawLine(result.equity, "#62d6b6", true);
  }, [result, revision]);

  return (
    <div className="equity-canvas" ref={wrapRef}>
      <canvas ref={canvasRef} aria-label="Strategy equity compared with buy and hold" role="img" />
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "positive" | "negative" | "neutral";
  icon: React.ReactNode;
}) {
  return (
    <article className="metric-card">
      <div className="metric-heading">
        <span>{label}</span>
        <span className="metric-icon">{icon}</span>
      </div>
      <div className={`metric-value ${tone}`}>{value}</div>
      <p>{detail}</p>
    </article>
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
      ? "Reading market regimes"
      : progress < 52
        ? "Testing indicator weights"
        : progress < 78
          ? "Measuring risk and drawdown"
          : "Selecting the best checkpoint";

  return (
    <div className="training-live" role="status" aria-live="polite">
      <div className="training-live-header">
        <div className="training-live-icon"><BrainCircuit size={22} /></div>
        <div>
          <span>Live training</span>
          <h2>{phase}</h2>
          <p>The model is replaying this date range and keeping changes that improve the score.</p>
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

export default function Home() {
  const [draftStart, setDraftStart] = useState(DEFAULT_START);
  const [draftEnd, setDraftEnd] = useState(DEFAULT_END);
  const [range, setRange] = useState({ start: DEFAULT_START, end: DEFAULT_END });
  const [viewport, setViewport] = useState<"ALL" | "1Y" | "6M" | "3M">("6M");
  const [activeView, setActiveView] = useState<"chart" | "train" | "paper">("chart");
  const [model, setModel] = useState(INITIAL_MODEL);
  const [isRunning, setIsRunning] = useState(false);
  const [rangeError, setRangeError] = useState("");
  const [training, setTraining] = useState(false);
  const [trainingProgress, setTrainingProgress] = useState(100);
  const [trainingEpoch, setTrainingEpoch] = useState(1840);
  const [clock, setClock] = useState<Date | null>(null);
  const [paperActive, setPaperActive] = useState(false);
  const [replayMode, setReplayMode] = useState(false);
  const [paperPrice, setPaperPrice] = useState(MARKET_DATA[MARKET_DATA.length - 1].close);
  const [paper, setPaper] = useState<PaperAccount>({
    cash: PAPER_STARTING_CASH,
    shares: 0,
    avgPrice: 0,
    realized: 0,
    orders: [],
  });
  const [toast, setToast] = useState("");
  const tickRef = useRef(0);

  const filteredData = useMemo(
    () => MARKET_DATA.filter((bar) => bar.date >= range.start && bar.date <= range.end),
    [range],
  );
  const result = useMemo(() => runBacktest(filteredData, model), [filteredData, model]);
  const latest = filteredData[filteredData.length - 1] ?? MARKET_DATA[MARKET_DATA.length - 1];
  const previous = filteredData[filteredData.length - 2] ?? latest;
  const dayMove = latest.close / previous.close - 1;
  const latestFactors = scoreBar(latest, model).factors;
  const marketClock = getMarketClock(clock);
  const paperValue = paper.cash + paper.shares * paperPrice;
  const paperPnl = paperValue - PAPER_STARTING_CASH;

  useEffect(() => {
    setClock(new Date());
    const timer = window.setInterval(() => setClock(new Date()), 1000);
    const saved = window.localStorage.getItem("signal-forge-paper-account");
    if (saved) {
      try {
        setPaper(JSON.parse(saved) as PaperAccount);
      } catch {
        window.localStorage.removeItem("signal-forge-paper-account");
      }
    }
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    window.localStorage.setItem("signal-forge-paper-account", JSON.stringify(paper));
  }, [paper]);

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
        const wave = Math.sin(tickRef.current / 3.2) * 0.0011;
        const noise = (Math.random() - 0.5) * 0.0025;
        const nextPrice = Math.max(1, currentPrice * (1 + wave + noise));
        if (tickRef.current % 6 === 0) {
          const liveScore = clamp(
            result.scores[result.scores.length - 1] + Math.sin(tickRef.current / 5) * 0.28,
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
            if (account.shares === 0 && liveScore > 0.38) {
              const shares = Math.max(1, Math.floor(Math.min(12, (account.cash * 0.22) / nextPrice)));
              const cost = shares * nextPrice + 1;
              if (cost > account.cash) return account;
              return {
                ...account,
                cash: account.cash - cost,
                shares,
                avgPrice: nextPrice,
                orders: [
                  {
                    id: `paper-buy-${Date.now()}`,
                    time,
                    side: "BUY",
                    shares,
                    price: nextPrice,
                    note: liveScore > 0.62 ? "High-conviction trend" : "Signal crossover",
                  },
                  ...account.orders,
                ].slice(0, 8),
              };
            }
            if (account.shares > 0 && liveScore < -0.3) {
              const proceeds = account.shares * nextPrice - 1;
              const realized = (nextPrice - account.avgPrice) * account.shares - 2;
              return {
                ...account,
                cash: account.cash + proceeds,
                shares: 0,
                avgPrice: 0,
                realized: account.realized + realized,
                orders: [
                  {
                    id: `paper-sell-${Date.now()}`,
                    time,
                    side: "SELL",
                    shares: account.shares,
                    price: nextPrice,
                    note: "Risk-off threshold",
                  },
                  ...account.orders,
                ].slice(0, 8),
              };
            }
            return account;
          });
        }
        return nextPrice;
      });
    }, 1800);
    return () => window.clearInterval(timer);
  }, [paperActive, replayMode, marketClock.isOpen, result.scores]);

  const applyRange = () => {
    if (!draftStart || !draftEnd || draftStart >= draftEnd) {
      setRangeError("Choose an end date after the start date.");
      return;
    }
    const count = MARKET_DATA.filter(
      (bar) => bar.date >= draftStart && bar.date <= draftEnd,
    ).length;
    if (count < 35) {
      setRangeError("Use at least 35 trading sessions so the indicators can warm up.");
      return;
    }
    setRangeError("");
    setActiveView("chart");
    setIsRunning(true);
    window.setTimeout(() => {
      setRange({ start: draftStart, end: draftEnd });
      setIsRunning(false);
      setToast(`Backtest complete · ${count} sessions`);
    }, 520);
  };

  const trainModel = useCallback(async () => {
    if (training || filteredData.length < 35) return;
    setActiveView("train");
    setTraining(true);
    setTrainingProgress(0);
    const trainingStartedAt = Date.now();
    let bestModel = { ...model };
    let bestResult = runBacktest(filteredData, bestModel);
    let bestObjective = bestResult.strategyReturn - Math.abs(bestResult.maxDrawdown) * 0.22;
    const maxEpochs = 110;

    for (let epoch = 1; epoch <= maxEpochs; epoch += 1) {
      const temperature = 0.18 * (1 - epoch / maxEpochs) + 0.025;
      for (let candidateIndex = 0; candidateIndex < 9; candidateIndex += 1) {
        const raw = {
          trend: clamp(bestModel.trend + (Math.random() - 0.5) * temperature, 0.03, 0.78),
          rsi: clamp(bestModel.rsi + (Math.random() - 0.5) * temperature, 0.02, 0.52),
          momentum: clamp(bestModel.momentum + (Math.random() - 0.5) * temperature, 0.02, 0.62),
          volatility: clamp(bestModel.volatility + (Math.random() - 0.5) * temperature, 0.01, 0.34),
          threshold: clamp(bestModel.threshold + (Math.random() - 0.5) * 0.06, 0.12, 0.46),
        };
        const sum = raw.trend + raw.rsi + raw.momentum + raw.volatility;
        const candidate: ModelWeights = {
          trend: raw.trend / sum,
          rsi: raw.rsi / sum,
          momentum: raw.momentum / sum,
          volatility: raw.volatility / sum,
          threshold: raw.threshold,
        };
        const candidateResult = runBacktest(filteredData, candidate);
        const objective =
          candidateResult.strategyReturn -
          Math.abs(candidateResult.maxDrawdown) * 0.22 +
          candidateResult.alpha * 0.18;
        if (objective > bestObjective) {
          bestObjective = objective;
          bestModel = candidate;
          bestResult = candidateResult;
        }
      }
      if (epoch % 4 === 0 || epoch === maxEpochs) {
        setTrainingProgress(Math.round((epoch / maxEpochs) * 100));
        setTrainingEpoch((current) => current + 4);
        await new Promise<void>((resolve) => window.setTimeout(resolve, 12));
      }
      if (bestResult.alpha > 0.035 && epoch > 28) break;
    }

    const minimumLiveState = 1600;
    const remainingLiveTime = minimumLiveState - (Date.now() - trainingStartedAt);
    if (remainingLiveTime > 0) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, remainingLiveTime));
    }

    setModel(bestModel);
    setTrainingProgress(100);
    setTraining(false);
    setToast(
      bestResult.alpha > 0
        ? `Training target reached · ${percent(bestResult.alpha)} alpha`
        : "Training complete · target not reached on this window",
    );
  }, [filteredData, model, training]);

  const resetPaper = () => {
    setPaper({ cash: PAPER_STARTING_CASH, shares: 0, avgPrice: 0, realized: 0, orders: [] });
    setPaperPrice(MARKET_DATA[MARKET_DATA.length - 1].close);
    setPaperActive(false);
    setReplayMode(false);
    setToast("Paper account reset to $25,000");
  };

  const factors = [
    { label: "EMA trend", value: latestFactors.trend, weight: model.trend, color: "mint" },
    { label: "Momentum", value: latestFactors.momentum, weight: model.momentum, color: "amber" },
    { label: "RSI edge", value: latestFactors.rsi, weight: model.rsi, color: "violet" },
    { label: "Volatility", value: latestFactors.volatility, weight: model.volatility, color: "blue" },
  ];

  return (
    <main className="app-shell refined-shell">
      <header className="topbar refined-topbar">
        <a className="brand" href="#workspace" aria-label="Signal Forge home">
          <span className="brand-mark"><Sparkles size={17} strokeWidth={2.1} /></span>
          <span>Signal <b>Forge</b></span>
          <em>LAB</em>
        </a>

        <div className="top-actions">
          <div className="market-status refined-market-status">
            <span className={marketClock.isOpen ? "status-dot live" : "status-dot"} />
            <span><b>{marketClock.label}</b><small>{marketClock.time}</small></span>
          </div>
          <button
            className="paper-account-shortcut"
            type="button"
            onClick={() => setActiveView("paper")}
          >
            <WalletCards size={15} />
            Paper {money(paperValue)}
          </button>
          <div className="avatar" aria-label="Paper trading account">AS</div>
        </div>
      </header>

      <div className="dashboard refined-dashboard" id="workspace">
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
              <p>Daily candles / Forge PPO v18 / trained on one stock</p>
            </div>
          </div>

          <div className={"hero-signal " + result.signal.toLowerCase()}>
            <span className="hero-signal-icon"><BrainCircuit size={20} /></span>
            <div>
              <span>AI signal</span>
              <strong>{result.signal}</strong>
              <small>{result.confidence}% confidence</small>
            </div>
          </div>

          <div className="range-builder">
            <div className="range-builder-title">
              <span><CalendarRange size={17} /></span>
              <div><strong>Test the strategy</strong><small>Choose a historical window</small></div>
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
                <span>Strategy earned</span>
                <strong>{percent(result.strategyReturn)}</strong>
                <small>{money(result.finalValue)} final value</small>
              </div>
              <div className="outcome-item">
                <span>If you just held</span>
                <strong>{percent(result.buyHoldReturn)}</strong>
                <small>Same stock, same dates</small>
              </div>
              <div className="outcome-item">
                <span>Strategy difference</span>
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

        <nav className="workspace-tabs" role="tablist" aria-label="Trading lab views">
          <button
            id="tab-chart"
            role="tab"
            aria-selected={activeView === "chart"}
            aria-controls="panel-chart"
            className={activeView === "chart" ? "active" : ""}
            type="button"
            onClick={() => setActiveView("chart")}
          >
            <BarChart3 size={17} />
            <span><strong>Chart</strong><small>Price, indicators & trades</small></span>
          </button>
          <button
            id="tab-train"
            role="tab"
            aria-selected={activeView === "train"}
            aria-controls="panel-train"
            className={activeView === "train" ? "active" : ""}
            type="button"
            onClick={() => setActiveView("train")}
          >
            <BrainCircuit size={17} />
            <span><strong>Train AI</strong><small>Weights & learning progress</small></span>
            {training && <i className="tab-live-dot" />}
          </button>
          <button
            id="tab-paper"
            role="tab"
            aria-selected={activeView === "paper"}
            aria-controls="panel-paper"
            className={activeView === "paper" ? "active" : ""}
            type="button"
            onClick={() => setActiveView("paper")}
          >
            <WalletCards size={17} />
            <span><strong>Paper trade</strong><small>Fake money, market hours</small></span>
            {paperActive && <i className="tab-live-dot" />}
          </button>
        </nav>

        {activeView === "chart" && (
          <section className="panel focused-workspace chart-workspace" id="panel-chart" role="tabpanel" aria-labelledby="tab-chart">
            <div className="workspace-heading">
              <div>
                <span className="view-kicker">BACKTEST REPLAY</span>
                <h2>See what the model saw</h2>
                <p>Every indicator and AI trade is aligned to the same price timeline.</p>
              </div>
              <div className="timeframe-control" role="group" aria-label="Chart viewport">
                {(["ALL", "1Y", "6M", "3M"] as const).map((item) => (
                  <button
                    type="button"
                    key={item}
                    className={viewport === item ? "active" : ""}
                    onClick={() => setViewport(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="chart-summary-line">
              <span><Activity size={14} /> {filteredData.length} market sessions</span>
              <span><ArrowUpRight size={14} /> {result.trades.length} executed orders</span>
              <span><ShieldCheck size={14} /> Fees and slippage included</span>
            </div>

            {isRunning ? (
              <div className="chart-loading-state" role="status" aria-live="polite">
                <div className="chart-loading-top"><span className="skeleton-line short" /><span className="skeleton-line medium" /></div>
                <div className="chart-loading-canvas"><i /><i /><i /><i /><i /><i /></div>
                <span>Replaying {draftStart} through {draftEnd}...</span>
              </div>
            ) : (
              <MarketChart data={filteredData} result={result} viewport={viewport} />
            )}

            <div className="chart-help">
              <div>
                <Info size={16} />
                <p><strong>How to read this:</strong> green and red triangles are the AI&apos;s buys and sells. The colored lines are the exact signals used to make each decision.</p>
              </div>
              <button className="text-button" type="button" onClick={() => setActiveView("train")}>
                See how the AI decides <ArrowUpRight size={14} />
              </button>
            </div>

            <div className="below-chart-grid">
              <article className="compact-equity">
                <div className="compact-section-heading">
                  <div><span>Portfolio growth</span><strong>{money(result.finalValue)}</strong></div>
                  <span className={result.alpha >= 0 ? "alpha-badge positive" : "alpha-badge negative"}>{percent(result.alpha)} vs hold</span>
                </div>
                <div className="equity-legend"><span><i className="strategy" /> Strategy</span><span><i className="hold" /> Buy & hold</span></div>
                <EquityChart result={result} />
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
                  <div><span>Round trips</span><strong>{Math.floor(result.trades.length / 2)}</strong></div>
                  <div><span>Risk score</span><strong>{result.sharpe.toFixed(2)}</strong></div>
                </div>
              </article>
            </div>

            <details className="trade-drawer">
              <summary>
                <span><Layers3 size={16} /> Recent AI trades</span>
                <small>{result.trades.length} orders in this backtest</small>
              </summary>
              <div className="table-wrap refined-table">
                <table>
                  <thead><tr><th>Date</th><th>Action</th><th>Fill price</th><th>Shares</th><th>Profit / loss</th><th>Confidence</th><th>Why</th></tr></thead>
                  <tbody>
                    {result.trades.slice().reverse().slice(0, 10).map((trade) => (
                      <tr key={trade.id}>
                        <td>{dateLabel(trade.date)}</td>
                        <td><span className={trade.side === "BUY" ? "side-tag buy" : "side-tag sell"}>{trade.side}</span></td>
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
            </details>
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
                    <span className="view-kicker">MODEL TRAINING</span>
                    <h2>Teach the AI on this date range</h2>
                    <p>It tests new indicator weights and keeps the strongest risk-adjusted checkpoint.</p>
                  </div>
                  <span className={result.alpha > 0 ? "training-status success" : "training-status"}>
                    {result.alpha > 0 ? <Check size={14} /> : <Target size={14} />}
                    {result.alpha > 0 ? "Goal reached" : "Needs improvement"}
                  </span>
                </div>

                <div className="training-layout">
                  <article className="training-overview">
                    <div className="training-result-hero">
                      <div className="training-model-mark"><Cpu size={22} /></div>
                      <div>
                        <span>Current checkpoint</span>
                        <h3>Forge PPO / epoch {trainingEpoch}</h3>
                        <p>Objective: finish above buy & hold without taking excessive risk.</p>
                      </div>
                    </div>

                    <div className="comparison-block">
                      <div className="comparison-label"><span>Strategy</span><strong>{percent(result.strategyReturn)}</strong></div>
                      <div className="comparison-track strategy"><i style={{ width: Math.round(clamp(Math.max(0, result.strategyReturn) / Math.max(0.1, result.strategyReturn, result.buyHoldReturn) * 100, 6, 100)) + "%" }} /></div>
                      <div className="comparison-label"><span>Buy & hold</span><strong>{percent(result.buyHoldReturn)}</strong></div>
                      <div className="comparison-track hold"><i style={{ width: Math.round(clamp(Math.max(0, result.buyHoldReturn) / Math.max(0.1, result.strategyReturn, result.buyHoldReturn) * 100, 6, 100)) + "%" }} /></div>
                    </div>

                    <div className="training-objective-card">
                      <div>
                        <span>Distance from goal</span>
                        <strong className={result.alpha >= 0 ? "positive" : "negative"}>{percent(result.alpha)}</strong>
                      </div>
                      <p>{result.alpha >= 0 ? "This checkpoint already clears the benchmark." : "Retraining will search nearby policies for a better result."}</p>
                    </div>

                    <button className="primary-button train-cta" type="button" onClick={trainModel}>
                      <Zap size={16} />
                      Start live training
                    </button>
                    <small className="safe-note"><ShieldCheck size={13} /> Training only changes this simulation. It cannot place real orders.</small>
                  </article>

                  <article className="model-explanation">
                    <span className="view-kicker">WHAT THE AI USES</span>
                    <h3>Four signals shape every decision</h3>
                    <p>Longer bars have more influence. The score shows whether each signal currently pushes toward buying or selling.</p>
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
                  </article>
                </div>

                <div className="checkpoint-strip">
                  <div><Gauge size={17} /><span><small>Confidence</small><strong>{result.confidence}%</strong></span></div>
                  <div><ShieldCheck size={17} /><span><small>Max drawdown</small><strong>{percent(result.maxDrawdown)}</strong></span></div>
                  <div><Target size={17} /><span><small>Win rate</small><strong>{(result.winRate * 100).toFixed(0)}%</strong></span></div>
                  <button className="text-button" type="button" onClick={() => setActiveView("chart")}>View result on chart <ArrowUpRight size={14} /></button>
                </div>
              </>
            )}
          </section>
        )}

        {activeView === "paper" && (
          <section className="panel focused-workspace paper-workspace" id="panel-paper" role="tabpanel" aria-labelledby="tab-paper">
            <div className="workspace-heading">
              <div>
                <span className="view-kicker">PAPER TRADING</span>
                <h2>Let the model practice with fake money</h2>
                <p>The bot follows New York market hours and never connects to a brokerage.</p>
              </div>
              <span className={paperActive ? "bot-state armed" : "bot-state"}><Radio size={12} /> {paperActive ? (marketClock.isOpen || replayMode ? "Running" : "Armed for open") : "Stopped"}</span>
            </div>

            <div className="paper-layout">
              <article className="paper-account-card">
                <div className="paper-account-top">
                  <div><span>Paper account value</span><strong>{money(paperValue, 2)}</strong></div>
                  <div className={paperPnl >= 0 ? "paper-pnl positive" : "paper-pnl negative"}><span>Total result</span><strong>{percent(paperPnl / PAPER_STARTING_CASH, 2)}</strong><small>{money(paperPnl, 2)}</small></div>
                </div>

                <div className="paper-stats refined-paper-stats">
                  <div><span>Available cash</span><strong>{money(paper.cash, 2)}</strong></div>
                  <div><span>AAPL held</span><strong>{paper.shares} shares</strong></div>
                  <div><span>Practice price</span><strong>{money(paperPrice, 2)}</strong></div>
                </div>

                <div className="paper-market-card">
                  <span className={marketClock.isOpen ? "paper-market-icon open" : "paper-market-icon"}><Clock3 size={18} /></span>
                  <div>
                    <strong>{marketClock.isOpen ? "Market session is open" : marketClock.label}</strong>
                    <p>{paperActive ? (marketClock.isOpen ? "The model is checking every simulated tick for a trade." : replayMode ? "A demo session is replaying now." : "The bot will wake automatically at the opening bell.") : "Start the bot and it will wait safely for the next open."}</p>
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
              </article>

              <aside className="paper-activity-card">
                <div className="paper-activity-heading">
                  <div><span className="view-kicker">RECENT ACTIVITY</span><h3>Paper orders</h3></div>
                  <span>{paper.orders.length}</span>
                </div>
                <div className="paper-order-list">
                  {paper.orders.length === 0 ? (
                    <div className="empty-paper-orders">
                      <Bot size={24} />
                      <strong>No paper trades yet</strong>
                      <p>Start the bot or replay a session to watch decisions appear here.</p>
                    </div>
                  ) : (
                    paper.orders.slice(0, 6).map((order) => (
                      <div className="paper-order" key={order.id}>
                        <span className={order.side === "BUY" ? "order-icon buy" : "order-icon sell"}>{order.side === "BUY" ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}</span>
                        <div><strong>{order.side} {order.shares} AAPL</strong><small>{order.note} / {order.time}</small></div>
                        <span>{money(order.price, 2)}</span>
                      </div>
                    ))
                  )}
                </div>
                <div className="paper-disclosure"><Info size={14} /> Prices and fills are simulated for learning; this is not live market data.</div>
              </aside>
            </div>
          </section>
        )}

        <footer className="app-footer refined-footer">
          <div><ShieldCheck size={14} /> Research sandbox only. No real orders or guaranteed returns.</div>
          <span>Deterministic AAPL training tape / local paper account</span>
        </footer>
      </div>

      {toast && <div className="toast"><Check size={15} /> {toast}</div>}
    </main>
  );
}
