import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const tradingStates = sqliteTable("trading_states", {
  userEmail: text("user_email").primaryKey(),
  payload: text("payload").notNull(),
  revision: integer("revision").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  passwordIterations: integer("password_iterations").notNull().default(600_000),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const accountSessions = sqliteTable(
  "account_sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("account_sessions_account_idx").on(table.accountId),
    index("account_sessions_expires_idx").on(table.expiresAt),
  ],
);

export const accountStates = sqliteTable("account_states", {
  accountId: text("account_id")
    .primaryKey()
    .references(() => accounts.id, { onDelete: "cascade" }),
  payload: text("payload").notNull(),
  revision: integer("revision").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const authRateLimits = sqliteTable("auth_rate_limits", {
  keyHash: text("key_hash").primaryKey(),
  attempts: integer("attempts").notNull().default(0),
  windowStartedAt: integer("window_started_at").notNull(),
  blockedUntil: integer("blocked_until").notNull().default(0),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
