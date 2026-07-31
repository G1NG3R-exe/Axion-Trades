import { env } from "cloudflare:workers";
import { ensureAccountSchema, getD1 } from "../db";

export type AccountUser = {
  id: string;
  username: string;
};

export type AccountSession = {
  user: AccountUser;
  tokenHash: string;
};

export const PASSWORD_ITERATIONS = 600_000;
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX_ATTEMPTS = 5;
const encoder = new TextEncoder();

function ownedBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function randomToken(byteLength: number) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

async function applyPepper(bytes: Uint8Array) {
  const pepper = (env as unknown as { AUTH_PEPPER?: string }).AUTH_PEPPER;
  if (!pepper) return bytes;
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, ownedBuffer(bytes));
  return new Uint8Array(signature);
}

async function derivePassword(password: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: ownedBuffer(salt), iterations },
    key,
    256,
  );
  return applyPepper(new Uint8Array(bits));
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export async function createPasswordRecord(password: string) {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const hash = await derivePassword(password, salt, PASSWORD_ITERATIONS);
  return {
    hash: bytesToBase64Url(hash),
    salt: bytesToBase64Url(salt),
    iterations: PASSWORD_ITERATIONS,
  };
}

export async function verifyPassword(
  password: string,
  storedHash: string,
  storedSalt: string,
  iterations: number,
) {
  try {
    const candidate = await derivePassword(password, base64UrlToBytes(storedSalt), iterations);
    return constantTimeEqual(candidate, base64UrlToBytes(storedHash));
  } catch {
    return false;
  }
}

export function normalizeUsername(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function credentialError(username: string, password: unknown) {
  if (!/^[a-z0-9][a-z0-9_-]{2,23}$/.test(username)) {
    return "Use 3-24 lowercase letters, numbers, underscores, or hyphens.";
  }
  if (typeof password !== "string" || password.length < 8 || password.length > 128) {
    return "Use a password between 8 and 128 characters.";
  }
  return null;
}

function cookieName(request: Request) {
  return new URL(request.url).protocol === "https:" ? "__Host-sf_session" : "sf_session";
}

function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return null;
}

export function sessionCookie(request: Request, token: string) {
  const secure = new URL(request.url).protocol === "https:";
  return `${cookieName(request)}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_TTL_SECONDS}${secure ? "; Secure" : ""}`;
}

export function expiredSessionCookie(request: Request) {
  const secure = new URL(request.url).protocol === "https:";
  return `${cookieName(request)}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? "; Secure" : ""}`;
}

export function noStoreJson(body: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("cache-control", "no-store");
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("x-content-type-options", "nosniff");
  return new Response(JSON.stringify(body), { ...init, headers });
}

export function isTrustedWrite(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const originHost = new URL(origin).host;
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0].trim();
    const requestHost = new URL(request.url).host;
    return originHost === forwardedHost || originHost === requestHost;
  } catch {
    return false;
  }
}

export async function createSession(request: Request, user: AccountUser) {
  await ensureAccountSchema();
  const d1 = getD1();
  const token = randomToken(32);
  const tokenHash = await sha256(token);
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  await d1.batch([
    d1.prepare("DELETE FROM account_sessions WHERE expires_at <= ?").bind(Date.now()),
    d1.prepare("INSERT INTO account_sessions (token_hash, account_id, expires_at) VALUES (?, ?, ?)")
      .bind(tokenHash, user.id, expiresAt),
  ]);
  return { token, cookie: sessionCookie(request, token) };
}

export async function getAccountSession(request: Request): Promise<AccountSession | null> {
  await ensureAccountSchema();
  const token = readCookie(request, cookieName(request));
  if (!token || token.length < 32 || token.length > 128) return null;
  const tokenHash = await sha256(token);
  const row = await getD1()
    .prepare(
      `SELECT a.id, a.username
       FROM account_sessions s
       INNER JOIN accounts a ON a.id = s.account_id
       WHERE s.token_hash = ? AND s.expires_at > ?
       LIMIT 1`,
    )
    .bind(tokenHash, Date.now())
    .first<{ id: string; username: string }>();
  return row ? { user: { id: row.id, username: row.username }, tokenHash } : null;
}

export async function deleteSession(tokenHash: string) {
  await ensureAccountSchema();
  await getD1().prepare("DELETE FROM account_sessions WHERE token_hash = ?").bind(tokenHash).run();
}

async function rateLimitKey(request: Request, username: string) {
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  return sha256(`${username}|${ip}`);
}

export async function authRateLimited(request: Request, username: string) {
  await ensureAccountSchema();
  const keyHash = await rateLimitKey(request, username);
  const row = await getD1()
    .prepare("SELECT attempts, window_started_at, blocked_until FROM auth_rate_limits WHERE key_hash = ? LIMIT 1")
    .bind(keyHash)
    .first<{ attempts: number; window_started_at: number; blocked_until: number }>();
  return Boolean(row && row.blocked_until > Date.now());
}

export async function recordAuthFailure(request: Request, username: string) {
  await ensureAccountSchema();
  const d1 = getD1();
  const keyHash = await rateLimitKey(request, username);
  const now = Date.now();
  const row = await d1
    .prepare("SELECT attempts, window_started_at FROM auth_rate_limits WHERE key_hash = ? LIMIT 1")
    .bind(keyHash)
    .first<{ attempts: number; window_started_at: number }>();
  const inWindow = row && now - row.window_started_at < AUTH_WINDOW_MS;
  const attempts = inWindow ? row.attempts + 1 : 1;
  const windowStartedAt = inWindow ? row.window_started_at : now;
  const blockedUntil = attempts >= AUTH_MAX_ATTEMPTS ? now + AUTH_WINDOW_MS : 0;
  await d1
    .prepare(
      `INSERT INTO auth_rate_limits (key_hash, attempts, window_started_at, blocked_until, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key_hash) DO UPDATE SET
         attempts = excluded.attempts,
         window_started_at = excluded.window_started_at,
         blocked_until = excluded.blocked_until,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(keyHash, attempts, windowStartedAt, blockedUntil)
    .run();
}

export async function clearAuthFailures(request: Request, username: string) {
  await ensureAccountSchema();
  const keyHash = await rateLimitKey(request, username);
  await getD1().prepare("DELETE FROM auth_rate_limits WHERE key_hash = ?").bind(keyHash).run();
}

export async function performDummyPasswordCheck(password: string) {
  const salt = new Uint8Array(16);
  salt.fill(71);
  await derivePassword(password, salt, PASSWORD_ITERATIONS);
}
