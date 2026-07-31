# Signal Forge

Signal Forge is an account-backed intraday trading research sandbox for one simulated AAPL-like instrument. It has an isolated training year, selectable out-of-sample backtests, a five-minute paper replay, long/short portfolio accounting, and a deliberately empty Live mode.

It is research software, not a broker. The tape is synthetic and the app cannot place real orders.

## Data and execution boundaries

- Training data is fixed to `2023-01-02` through `2023-12-29`.
- Training uses a whole-session 72/28 chronological train/validation split.
- Backtests begin on `2024-01-02`; selected backtest candles never enter training.
- Backtest and Sandbox process 78 five-minute bars per regular session.
- Signals are generated after a candle closes and fill at the next candle open.
- Both paths share the score, entry, execution-cost, position-risk, cooldown, daily-loss-lock, and 4:00 PM liquidation rules.

The simulator models a dynamic bid/ask spread, participation-based slippage, SEC sale fees, FINRA TAF, and a CAT fee. It does not model taxes, stock-borrow availability, hard-to-borrow charges, halts, queue position, or partial fills.

## Accounts

Accounts use a simple username and password without email verification. Passwords use per-account random salts and PBKDF2-HMAC-SHA256 with 600,000 iterations, plus an optional deployment pepper. Random session tokens are stored only as SHA-256 hashes and sent through Secure, HTTP-only, SameSite=Strict cookies. Failed login attempts are throttled.

All workspace state is stored in D1 under the signed-in account: theme, model weights, checkpoints, backtest range, paper cash and positions, equity marks, and order history. The browser does not use local storage as an authority.

This is a hardened prototype, not a complete identity provider: there is no recovery flow, MFA, email verification, password reset, or independent security audit.

## Run locally

Requirements: Node.js `>=22.13.0`.

```bash
npm install
npm run dev
```

Useful commands:

- `npm run db:generate` — generate a D1 migration after schema changes.
- `npm run lint` — run static lint checks.
- `npm test` — build the app and run source/build assertions.

`.openai/hosting.json` declares the `DB` D1 binding used by account and state routes.
