# Racon Manager production quality — 2026-10-08

Baseline: fetched origin/main `a1c5123a4f979aa6a773970e0f65773b91d3ca43` (#148), matched READY production alias before work. Canonical game is `public/games/racon`, embedded by `/oyna/racon`. Historical archive audit is not a current defect list.

| Status | Existing system and evidence |
|---|---|
| DONE | Daily actions, crew availability/wages/loyalty/memories, bonds, appointments, inheritance, rival pressure/budget, blood feuds, evidence decay, 13-week campaign goals, endings and save slots exist. |
| DONE | Map has real protect/invest/withdraw/relations orders, neighbour waves, control-dependent income and rival capture. 24 conditional story chains already link decisions to delayed consequences. |
| PARTIAL | Paid story choices concealed their costs. Cash screen omitted investment income and lawyer/front/succession expenses, understating commitments. |
| BROKEN | Poor players could receive paid story benefits; negative dossier consequences were ignored. Retreat still paid job bonuses. Lost streets retained investments; pending echoes could race and rewind the next chapter. |
| MISSING | Intercity organisation/endgame expansions remain locked in the existing design. No speculative expansion is included in this wave. |

## Changes

- Canonical choice validation gates both UI actions and content entry point. Insufficient money leaves the state unchanged; closed papers cannot reward twice. Prices appear on paid options with the existing disabled-action explanation.
- Signed evidence effects survive recalculation/save. Pending chain echoes gate the next chapter; old numerical callbacks cannot rewind saved progress.
- Withdrawal earns no completion bonus or territory progress. Capture destroys completed and pending investments, including appointment losses and campaign loss.
- Weekly cash outlook explains regular income, all fixed expenses and net flow, includes doubled succession wages, and excludes uncertain jobs/raids/one-off payments. Front capacity now counts in the overflow warning.
- Existing warm paper/ink palette, art, routes, content, schema and shared engine remain. No other game runtime changed; audio stays off.

## Verification

- 80 targeted Node tests (73 existing plus 7 focused regressions): PASS locally. Includes every paid content choice, exact payment/replay after save, negative evidence, delayed chapter order, withdrawal, investment capture and cash accounting.
- Typecheck and build: PASS locally. Scoped CI repeats tests, long runs, typecheck/build and real Chromium browser checks on the reviewed head.
- Existing long-run harness: three policies repeated deterministically, up to 730 days; balanced reaches week 105 with 3 streets/₺4,056, aggressive ends at week 32 with succession failure, passive ends at week 40 after campaign target failure. Twelve additional 365-day seeded runs complete. Finite/bounded state and save/reload checks pass. This is evidence against these specific regressions, not proof of perfect balance.
- Browser gate: five widths (320/360/390/430/1440), all 12 available menus, story payment and saved result, crew/map/cash screenshots; existing map suite checks WebGL/SVG and real context loss, keyboard, orders and reload. Final CI/artifact/release evidence belongs to PR.

## Limits

No new strategy engine, asset redesign or locked late-game expansion. Existing campaign volatility and irreversible endings remain. Live visual/gameplay acceptance belongs to the owner. Stop after production READY and brief technical smoke; no next game or 360° audit.
