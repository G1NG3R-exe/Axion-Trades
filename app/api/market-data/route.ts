type YahooChartResponse = {
  chart?: {
    error?: { description?: string } | null;
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: Array<number | null>;
          high?: Array<number | null>;
          low?: Array<number | null>;
          close?: Array<number | null>;
          volume?: Array<number | null>;
        }>;
      };
    }>;
  };
};

function numberAt(values: Array<number | null> | undefined, index: number) {
  const value = values?.[index];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const symbol = new URL(request.url).searchParams.get("symbol")?.toUpperCase() || "AAPL";
  if (!/^[A-Z.-]{1,12}$/.test(symbol)) {
    return Response.json({ error: "Unsupported symbol" }, { status: 400 });
  }

  const upstreamUrl = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  upstreamUrl.search = new URLSearchParams({
    interval: "5m",
    range: "5d",
    includePrePost: "false",
    events: "div,splits",
  }).toString();

  try {
    const upstream = await fetch(upstreamUrl, {
      headers: { accept: "application/json", "user-agent": "AxionTrades/1.0" },
    });
    if (!upstream.ok) {
      return Response.json({ error: `Market data provider returned ${upstream.status}` }, { status: 502 });
    }

    const payload = await upstream.json() as YahooChartResponse;
    const result = payload.chart?.result?.[0];
    const quote = result?.indicators?.quote?.[0];
    const timestamps = result?.timestamp ?? [];
    const bars = timestamps.flatMap((timestamp, index) => {
      const date = new Date(timestamp * 1000);
      const dateParts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(date);
      const timeParts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).formatToParts(date);
      const part = (parts: Intl.DateTimeFormatPart[], type: string) => parts.find((item) => item.type === type)?.value ?? "";
      const sessionDate = `${part(dateParts, "year")}-${part(dateParts, "month")}-${part(dateParts, "day")}`;
      const time = `${part(timeParts, "hour")}:${part(timeParts, "minute")}`;
      const [hour, minute] = time.split(":").map(Number);
      const minutesFromOpen = (hour * 60 + minute) - (9 * 60 + 30);
      const open = numberAt(quote?.open, index);
      const high = numberAt(quote?.high, index);
      const low = numberAt(quote?.low, index);
      const close = numberAt(quote?.close, index);
      const volume = numberAt(quote?.volume, index);
      if (
        !open || !high || !low || !close || volume === null ||
        minutesFromOpen < 0 || minutesFromOpen > 390 || minutesFromOpen % 5 !== 0
      ) return [];
      const barInSession = minutesFromOpen / 5;
      return [{
        date: sessionDate,
        time,
        timestamp: `${sessionDate}-${time}`,
        barInSession,
        open,
        high,
        low,
        close,
        volume: Math.max(0, Math.round(volume)),
      }];
    });

    if (!bars.length) return Response.json({ error: "Market data provider returned no regular-session bars" }, { status: 502 });
    return Response.json(
      { symbol, source: "Yahoo Finance", fetchedAt: new Date().toISOString(), bars },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Market data request failed" },
      { status: 502 },
    );
  }
}
