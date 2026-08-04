const DEFAULT_SITES_BACKEND = "https://axion-trades.alexshmulevich1.workers.dev";

export function usesSitesProxy() {
  return process.env.VERCEL === "1";
}

function noStoreJson(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
      "x-content-type-options": "nosniff",
    },
  });
}

function isTrustedProxyWrite(request: Request) {
  if (request.method === "GET" || request.method === "HEAD") return true;
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const originHost = new URL(origin).host;
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0].trim();
    return originHost === forwardedHost || originHost === new URL(request.url).host;
  } catch {
    return false;
  }
}

export async function proxySitesRequest(request: Request) {
  if (!isTrustedProxyWrite(request)) {
    return noStoreJson({ error: "Request origin was rejected." }, 403);
  }

  const token = process.env.AXION_TRADES_SITES_TOKEN;
  if (!token) {
    const backend = process.env.AXION_TRADES_BACKEND_URL ?? DEFAULT_SITES_BACKEND;
    if (!backend.includes("workers.dev")) return noStoreJson({ error: "The account bridge is not configured." }, 503);
  }

  const incomingUrl = new URL(request.url);
  const backend = process.env.AXION_TRADES_BACKEND_URL ?? DEFAULT_SITES_BACKEND;
  const target = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, backend);
  const headers = new Headers();
  for (const name of ["accept", "accept-language", "content-type", "cookie", "user-agent"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (token) headers.set("OAI-Sites-Authorization", `Bearer ${token}`);

  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer(),
      cache: "no-store",
      redirect: "manual",
    });
    const responseHeaders = new Headers();
    for (const name of ["cache-control", "clear-site-data", "content-type", "x-content-type-options"]) {
      const value = upstream.headers.get(name);
      if (value) responseHeaders.set(name, value);
    }
    responseHeaders.set("cache-control", "no-store");
    const upstreamHeaders = upstream.headers as Headers & { getSetCookie?: () => string[] };
    const cookies = upstreamHeaders.getSetCookie?.() ?? [];
    if (cookies.length) {
      for (const cookie of cookies) responseHeaders.append("set-cookie", cookie);
    } else {
      const cookie = upstream.headers.get("set-cookie");
      if (cookie) responseHeaders.append("set-cookie", cookie);
    }
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("axion-trades account proxy failed", error);
    return noStoreJson({ error: "The account service is temporarily unavailable." }, 503);
  }
}
