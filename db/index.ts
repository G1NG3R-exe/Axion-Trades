import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

let accountSchemaReady: Promise<void> | null = null;

export function getDb() {
  const binding = getD1();

  return drizzle(binding, { schema });
}

export function getD1() {
  const binding = (env as unknown as { DB?: Parameters<typeof drizzle>[0] }).DB;

  if (!binding) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return binding;
}

/**
 * Sites can attach a fresh D1 database before deployment migrations have run.
 * Keep account setup idempotent so the first request repairs that state instead
 * of turning registration into a permanent 503.
 */
export function ensureAccountSchema() {
  if (accountSchemaReady) return accountSchemaReady;

  const d1 = getD1();
  accountSchemaReady = d1
    .batch([
      d1.prepare(`CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY NOT NULL,
        username TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        password_iterations INTEGER DEFAULT 600000 NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`),
      d1.prepare("CREATE UNIQUE INDEX IF NOT EXISTS accounts_username_unique ON accounts (username)"),
      d1.prepare(`CREATE TABLE IF NOT EXISTS account_sessions (
        token_hash TEXT PRIMARY KEY NOT NULL,
        account_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      )`),
      d1.prepare("CREATE INDEX IF NOT EXISTS account_sessions_account_idx ON account_sessions (account_id)"),
      d1.prepare("CREATE INDEX IF NOT EXISTS account_sessions_expires_idx ON account_sessions (expires_at)"),
      d1.prepare(`CREATE TABLE IF NOT EXISTS account_states (
        account_id TEXT PRIMARY KEY NOT NULL,
        payload TEXT NOT NULL,
        revision INTEGER DEFAULT 1 NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      )`),
      d1.prepare(`CREATE TABLE IF NOT EXISTS auth_rate_limits (
        key_hash TEXT PRIMARY KEY NOT NULL,
        attempts INTEGER DEFAULT 0 NOT NULL,
        window_started_at INTEGER NOT NULL,
        blocked_until INTEGER DEFAULT 0 NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
      )`),
    ])
    .then(() => undefined)
    .catch((error: unknown) => {
      accountSchemaReady = null;
      throw error;
    });

  return accountSchemaReady;
}
