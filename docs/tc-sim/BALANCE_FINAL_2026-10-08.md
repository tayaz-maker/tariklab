# TC SIM gameplay balance / dashboard final pass

Baseline main 3b6130f3b7e0f075f670775e39394d5cb5788860, #137–143 all merged and #143 production READY verified. Existing shell/styles/palette, economy/history data, body, family and city systems preserved. No other games or new engine.

## Measured defects and narrow corrections
- Arrears conversion credited the entire cash shortfall even when only part fit in the debt cap. At cash -90,000 and arrears 300,000 this created 80,000 of net worth. Credit now equals recorded debt only. Overflow stays a negative cash obligation, survives saves, and cannot finance discretionary purchases. No debt forgiveness, new field or migration. Mandatory losses can still produce negative cash; clamping it would recreate the exploit.
- Local/home moves and business setup/expansion previously cost the same one slot as a small social action. They now cost two; intercity moves three. Existing integer weekly budget remains. Repeated home moves and repeated identical business management decisions in one week are blocked. Existing event-specific costs are preserved.
- Business staffing included the owner, but turnover only credited employees' productive contribution. Owner production now uses the same 16,000 turnover unit; business rent has a 2,100 base before capacity and district factors. This prevents the owner from being effectively unproductive without making a workshop nearly rent-free. These are game-balance assumptions, not sourced historical turnover/rent claims. Supply, wages, taxes, crises, loan repayment, bankruptcy and monthly idempotence remain in the same engine.
- Dashboard retains last completed week's existing feedback while other notices change (session-only, cleared on load/new life). Long-term arc metrics stay accessible in a disclosure; city label reads the actual city. Canonical geometry/tokens/CSS unchanged.

## Long runs
`node scripts/tc-sim-balance-probe.mjs` uses production actions/events and periodic save/load. No replenished cash or reset health during play. Business probes explicitly seed initial capital and choose whether to retain employment; reserve policy holds six months of next-scale wages plus a living buffer before expanding. A separate rushed policy demonstrates the cost of insufficient reserves. Seeded histories are regression evidence, not population probabilities.

Results in BALANCE_RESULTS_2026-10-08.json use indexed budget units, **not nominal TL**:
- 520 weeks: strained worker -10,600 cash; balanced worker 398,970; career-focused 891,480; education/career 856,930. Savings are -0.079 / 2.969 / 6.633 / 6.376 annual baseline-cost multiples. Existing wage paths unchanged.
- Family: 520 weeks, actual birth in week 123, valid child/partner and save state.
- 480 weeks, standalone founder with 30,000: 59,696 or 17,234 worth (two seeds). No automatic fortune.
- 500,000 with reserves: 2,026,609 or 1,649,206 worth; 38/47 loss months. Rushed expansion: -1,359,501.
- 5,000,000 capital: 2,796,531 or 10,011,575. Capital is not a profit guarantee.
- Employed founder, 30,000: 549,418 after three years; 8,082,092 after ten, reaching scale 7 through six paid expansions and staffing. High wealth is possible with sustained income, retained reserves and reinvestment.
- 1999 founder: 54,611 after 480 weeks; historical dates and existing market model retained.

FX/gold: all available instruments tested at 1999/2002/2005/2017/2025/2030 dates with ten same-date buy/sell round trips, fees, overselling/invalid input, insufficient cash and save normalization. No same-date profit; historical observation dates and pricing unchanged. Existing investment/debt/property tests retained.

Targeted regression, full TC tests, build/typecheck and built-browser gate required before FAST MERGE. Final comprehensive mobile QA deferred. Production visual/gameplay acceptance USER PENDING. Stop after exact-main production READY and technical smoke.
