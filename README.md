# Axion Trades

Axion Trades (Signal Forge) is a trading-research sandbox for exploring a simulated, AAPL-like instrument. It provides backtesting, a five-minute paper-trading replay, account-backed workspaces, and model configuration in a single application.

> **Simulation only.** This project does not connect to a broker, place orders, or provide investment advice. Market data and execution are simulated; results are not evidence that a strategy will be profitable.

## What it includes

- A React, TypeScript, Next.js/Vinext application built with Vite.
- Research and evaluation flows that keep training data separate from selected out-of-sample backtests.
- Paper-trading accounts with simulated positions, fills, fees, slippage, risk controls, and end-of-session liquidation.
- Username/password authentication, persisted account state, and Cloudflare D1 storage via Drizzle.
- A Cloudflare Worker entry point, including a scheduled paper-trading handler.

## Requirements

- Windows PowerShell (or a comparable shell)
- Git
- Node.js 22.13.0 or newer
- npm (included with Node.js)

Verify your installation:

```powershell
node --version
npm --version
```

## Local setup

Clone the repository and install dependencies from the lockfile:

```powershell
git clone https://github.com/G1NG3R-exe/Axion-Trades.git
cd Axion-Trades
npm ci
```

If PowerShell blocks `npm.ps1`, use `npm.cmd` instead:

```powershell
npm.cmd ci
npm.cmd run dev
```

Start the development server:

```powershell
npm run dev
```

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run the local Vinext development server. |
| `npm run build` | Build the application. |
| `npm run start` | Start the built Vinext application. |
| `npm run lint` | Run ESLint. |
| `npm test` | Build, then run the Node test suite. |
| `npm run db:generate` | Generate a Drizzle migration after schema changes. |

## Project layout

| Path | Purpose |
| --- | --- |
| `app/` | Application pages, API routes, authentication, and paper-trading logic. |
| `db/` | D1 database access and Drizzle schema. |
| `drizzle/` | Versioned SQL migrations. Keep these in source control. |
| `worker/` | Cloudflare Worker entry point and scheduled handler. |
| `build/` | Vite/Sites integration. |
| `public/` | Static assets. |
| `tests/` | Node-based build and strategy tests. |

## Configuration and secrets

The Cloudflare D1 binding is named `DB` and is declared in `.openai/hosting.json`. Deployments require the `AUTH_PEPPER` runtime secret.

Depending on the deployment target, the application may also use:

- `SIGNAL_FORGE_SITES_TOKEN`
- `SIGNAL_FORGE_BACKEND_URL`

Do not commit or share `.env.local`, `cookies.txt`, tokens, passwords, API keys, or authentication secrets. Generated and local-only directories, including `node_modules/`, `.next/`, `dist/`, `.vercel/`, `.wrangler/`, `.vinext/`, `outputs/`, and `work/`, should remain untracked.

## Deployment

This repository contains Cloudflare and Vercel configuration. Choose one target deliberately before deploying:

- **Cloudflare:** requires Wrangler account access, a D1 database binding named `DB`, migrations from `drizzle/`, and the `AUTH_PEPPER` secret.
- **Vercel:** requires Vercel access and any applicable environment variables listed above.

Before deploying, decide whether to reuse the existing D1 database or provision a new one. Never replace a database or run migrations against production unintentionally.

## Current validation note

Run `npm run lint` and `npm test` after changing the project. At the time this README was written, the application build succeeds, but the committed test files and lint configuration contain pre-existing source corruption that needs repair before those checks can pass cleanly.
