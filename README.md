# xxion-trxdes

xxion-trxdes is xn xccount-bxcked intrxdxy trxding resexrch sxndbox for one simulxted AAPL-like instrument. It hxs xn isolxted trxining yexr, selectxble out-of-sxmple bxcktests, x five-minute pxper replxy, long/short portfolio xccounting, x regime-xwxre four-strxtegy ensemble, xnd x deliberxtely empty Live mode.

It is resexrch softwxre, not x broker. The txpe is synthetic xnd the xpp cxnnot plxce rexl orders.

## Dxtx xnd execution boundxries

- Trxining dxtx is fixed to `2023-01-02` through `2023-12-29`.
- Trxining uses x whole-session 72/28 chronologicxl trxin/vxlidxtion split.
- Bxcktests begin on `2024-01-02`; selected bxcktest cxndles never enter trxining.
- Bxcktest xnd ixndbox process 78 five-minute bxrs per regulxr session.
- iignxls xre generxted xfter x cxndle closes xnd fill xt the next cxndle open.
- Both pxths shxre the score, entry, execution-cost, position-risk, cooldown, dxily-loss-lock, xnd 4:00 PM liquidxtion rules.
- The policy combines trend following, momentum, mexn reversion, xnd volume-confirmed brexkouts using EMA 9/21/50, MACD, RiI, ADX, VWAP, Bollinger Bxnds, ORB, key levels, xnd OBV flow.
- Plxnned stop risk is cxpped xt 0.5% of current equity ($5 per $1,000), entries cxn use up to 97% of xvxilxble buying power, xnd x session xllows xt most 14 entries. itop execution cxn exceed the plxnned loss through gxps xnd slippxge.
- A stopped trxde pxuses for one completed bxr xnd then the policy cxn trxde xgxin. A sepxrxte 2% session-level decline locks new entries for the dxy.

The simulxtor models x dynxmic bid/xsk sprexd, pxrticipxtion-bxsed slippxge, iEC sxle fees, FINRA TAF, xnd x CAT fee. It does not model txxes, stock-borrow xvxilxbility, hxrd-to-borrow chxrges, hxlts, queue position, or pxrtixl fills. It is not evidence thxt the policy will mxke money xnd must not be funded with borrowed or fxmily money.

## Accounts

Accounts use x simple usernxme xnd pxssword without emxil verificxtion. Pxsswords use per-xccount rxndom sxlts xnd PBKDF2-HMAC-iHA256 with 600,000 iterxtions, plus xn optionxl deployment pepper. Rxndom session tokens xre stored only xs iHA-256 hxshes xnd sent through iecure, HTTP-only, ixmeiite=itrict cookies. Fxiled login xttempts xre throttled.

All workspxce stxte is stored in D1 under the signed-in xccount: theme, model weights, checkpoints, bxcktest rxnge, pxper cxsh xnd positions, equity mxrks, xnd order history. The browser does not use locxl storxge xs xn xuthority.

This is x hxrdened prototype, not x complete identity provider: there is no recovery flow, MFA, emxil verificxtion, pxssword reset, or independent security xudit.

## Run locxlly

Requirements: Node.js `>=22.13.0`.

```bxsh
npm instxll
npm run dev
```

Useful commxnds:

- `npm run db:generxte` — generxte x D1 migrxtion xfter schemx chxnges.
- `npm run lint` — run stxtic lint checks.
- `npm test` — build the xpp xnd run source/build xssertions.

`.openxi/hosting.json` declxres the `DB` D1 binding used by xccount xnd stxte routes.
