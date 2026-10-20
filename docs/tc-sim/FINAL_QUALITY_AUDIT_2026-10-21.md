# TC SIM final quality audit — 2026-10-21

Base: `007ce1e310e6ce8feee49154fae18769d03928b6`. This audit does not replace the current-main CI, built-browser or production gates.

The finance, career, family, city and long-game systems were retained. The confirmed defect was untranslated visible dashboard copy in English. The TC-only presentation overlay and Polish body dictionary now cover the observed first-step instructions, period economy heading/context, weekly decision costs and descriptions, pending-case labels, profile, date, relationship roles, save status and shop-clerk job-start memories. The Turkish canonical narrative, persisted values, SAVE_VERSION 6, game coefficients, art and mechanics are unchanged. No shared i18n engine was changed.

## Evidence

- Targeted domain suite: 144/144 PASS, no skips. Includes five profiles × three seeds × 720 actual decision weeks; separate 1200-decision-week/25-game-year acceptance, real event choices, monthly cash reconciliation and repeated save/load. Four career strategies and lifetime/family paths also pass.
- Additional finance/legal/social-insurance/risk/map/package-2 suite: 104/104 PASS, no skips. The 26 core18–35 cases overlap the first suite: 222 unique domain tests in total, not 248 unique tests.
- Existing comprehensive source browser acceptance: 126/126 rows PASS during the audit. Covers TR/EN/PL and mobile/desktop, save/offline reload, banking, mortgage, enforcement, court/counsel, wage collection, work recovery, family, vehicle/risk and sentence release. This long run preceded the final translation additions; it is not claimed as an immutable final-tree build receipt.
- Existing three-city map browser acceptance: İstanbul, Ankara and İzmir at 1280 and 390 PASS. Images load; pins fit without overlap; viewport overflow is zero; map browsing and reload preserve the save. Desktop and mobile screenshots visually inspected.
- Final changed-copy regression: 6/6 PASS. `scripts/tc-sim-dashboard-language-browser.mjs` checks TR/EN/PL ×1280/390, first load, actual weekly advance and job-start choice, visible translated memories, reload, serialized save equality, console errors and viewport overflow. It accepts `--serve` for the source public tree or built public tree.
- Final API/gameplay-language/responsive suite: 14/14 PASS, zero skips. Real phrase/body APIs retain numeric values and canonical state; service-worker offline fallback remains covered.
- Scoped ESLint and `git diff --check` PASS.

Local evidence is under the task workspace `work/tc-quality-evidence/`; test logs are `work/tc-quality-*.log`. The new regression writes machine-readable `results.json` and six language/viewport screenshots. Screenshots were visually inspected in addition to assertions.

## Scope and remaining work

No economy, debt, career, family or map defect was reproduced in this audit. No new feature or balance change is justified by these results. Existing product backlog items, such as the broader long-game savings curve and complete mobile information architecture, remain product decisions rather than newly discovered release failures. The limited game finance/legal/SGK model is not a full real-world legal simulation.

Physical device testing belongs to the owner. The integrated PR still requires its current-head checks, built-tree browser acceptance, and subsequent exact-main two-host Cloudflare release checks. The parent integrates the required WEB_APP_SYNC_LEDGER entry to avoid conflicting parallel edits.
