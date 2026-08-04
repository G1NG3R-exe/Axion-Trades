import { runAutoPaperTrading } from "../../../auto-trading";
import { noStoreJson } from "../../../account-auth";
import { usesSitesProxy } from "../../sites-proxy";
import { env as workerEnv } from "cloudflare:workers";

export const dynamic = "force-dynamic";

function cronSecret() {
  const value = process.env.CRON_SECRET ?? (workerEnv as unknown as { CRON_SECRET?: string }).CRON_SECRET;
  return typeof value === "string" ? value.trim() : "";
}

function secretMatches(request: Request) {
  const secret = cronSecret();
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}` || request.headers.get("x-axion-cron-secret") === secret;
}

async function proxyCronRequest(request: Request) {
  const secret = cronSecret();
  const token = process.env.AXION_TRADES_SITES_TOKEN;
  const backend = process.env.AXION_TRADES_BACKEND_URL ?? "https://axion-trades.alexshmulevich1.workers.dev";
  if (!secret) return noStoreJson({ error: "CRON_SECRET is not configured." }, { status: 503 });
  const incoming = new URL(request.url);
  const target = new URL(`${incoming.pathname}${incoming.search}`, backend);
  const headers = new Headers({ authorization: `Bearer ${secret}`, "x-axion-cron-secret": secret });
  if (token) headers.set("OAI-Sites-Authorization", `Bearer ${token}`);
  try {
    const upstream = await fetch(target, { method: "GET", headers, cache: "no-store" });
    return new Response(upstream.body, { status: upstream.status, headers: { "cache-control": "no-store", "content-type": upstream.headers.get("content-type") ?? "application/json" } });
  } catch {
    return noStoreJson({ error: "The auto-trading backend is unavailable." }, { status: 503 });
  }
}

export async function GET(request: Request) {
  if (usesSitesProxy()) {
    if (!secretMatches(request)) return noStoreJson({ error: "Unauthorized cron request." }, { status: 401 });
    return proxyCronRequest(request);
  }
  if (!secretMatches(request)) return noStoreJson({ error: "Unauthorized cron request." }, { status: 401 });
  try { return noStoreJson({ ok: true, ...(await runAutoPaperTrading()) }); }
  catch (error) { return noStoreJson({ error: error instanceof Error ? error.message : "Auto-trading run failed." }, { status: 500 }); }
}
