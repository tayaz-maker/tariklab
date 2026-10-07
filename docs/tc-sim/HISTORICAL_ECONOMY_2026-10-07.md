# TC SIM historical economy / canonical date wave

Accepted base: 7f7da9e57e0f004082bb3d1a7a09ff0d5ba3f98d (#135 + #136). No stylesheet, shell or navigation redesign.

## Audit and method

- Scenario dates were interpolated separately from the 48-turn year; event years used a third relative schedule. Birthday was the January rollover. `game-date.js` now owns civil date, displayed month/decision-week/year and birthday age. Four decision weeks per calendar month remain intentional (last week covers the remaining days); this is not an ISO-week simulation. Historical completion clamps once to 2030-01-01. Absolute turn deadlines and existing state keys are preserved.
- Existing saves anchor at their last historical civil date (current-era at their saved year/month/week), retain balances/deadlines, and derive a birth date consistent with saved age. That is a migration assumption, not recovered birth history.
- 2017-04-18 is a normal start, age 18, birth 1999-04-18. Existing current-era start remains 2027-01-01; it was not silently moved to the computer's date.
- World Bank FP.CPI.TOTL observations were checked against the live API on 2026-10-07. They are correct, but applying CPI to a 2025 wage gave 1999/2017 wages unrelated to the observed minimum wage. From 1999, all budget amounts now share the dated adult net minimum-wage scale (9000 internal units = period anchor). Pre-1999 retains the explicit CPI approximation. Old TL multiplies once by 1,000,000; 2005–2008 YTL, 2009+ TL. Large old-TL amounts read as millions.
- Income, rent, consumption, loan principal/payments, savings and business capital retain the same internal budget units. There is no denomination windfall or separate market exchange rate. Balances/debts are indexed simulation claims, not a simulation of nominal cash erosion. Rent, product and business prices are **modelled wage-budget ratios**, not claimed historical observations. Salaries beyond the anchor are job-relative models. 2026–2030 monetary display holds the last verified 2025 scale; future sector context is explicitly fiction, not a forecast.
- Existing cost-of-living drift now uses canonical elapsed years instead of a conflicting 52-turn year. Its 4% increment/1.5 cap is a game balance rule, not CPI. Late-life modifier remains unchanged.
- Basic consumption is already included in monthly expenses. Market grocery is explicitly extra shopping, preventing the UI from suggesting the basic basket must be paid twice.
- Market availability now filters the real catalogue; VHS/DVD/digital rentals and mobile calling/data packages have period-specific availability. Cutoffs model this game's access context, not exact national invention/adoption dates. Existing durables/save IDs stay intact.
- Existing business engine gains separate revenue/operating expenses, period demand/competition, bounded deterministic uncertainty, skill, fatigue, launch ramp and arrears pressure. Profitable sectors still have loss months. CPI uncertainty adjusts new game credit offers; already signed debt is unchanged. Coefficients are disclosed game rules, not historical bank APRs.

## Sources verified

- https://api.worldbank.org/v2/country/TUR/indicator/FP.CPI.TOTL?format=json&per_page=100
- https://www.csgb.gov.tr/Media/t2qlvwrg/asgari-%C3%BCcret-net-br%C3%BCt-i%C5%9Fverene-maliyet.pdf (dated adult net wage rows 1999–2025, including 58,948,065 old TL on 1999-04-18 and 1,404.06 TL in 2017)
- https://www.csgb.gov.tr/Media/f4xjys1e/2025-asgari-%C3%BCcret_.pdf (2025 net 22,104.67 TL)

## Example flow

Family home, initial market job, no discretionary shopping or debt yet:

| Start | Monthly income | Home contribution | Basic consumption | Monthly surplus | Repair-business setup |
|---|---:|---:|---:|---:|---:|
| 1999-04-18 | 58.95m old TL | 9.82m | 32.75m | 16.37m | 91.70m |
| 2017-04-18 | 1,404 TL | 234 TL | 780 TL | 390 TL | 2,184 TL |
| Current (2027, held 2025 scale) | 22,105 TL | 3,684 TL | 12,280 TL | 6,140 TL | 34,385 TL |

These are a coherent model budget, not an asserted survey of rents or shop prices. Targeted flows purchase extra groceries, borrow, start a repair business, settle monthly expenses/debt, cross birthdays, reload without duplicating settlement, and take both historical starts to 2030. All business types are checked for loss months. Existing adult-balanced long-run also passes.

Local Chromium download returned a truncated archive; do not mistake it for a product regression. Existing CI built-browser gate remains enabled. Production user visual/gameplay QA is pending.
