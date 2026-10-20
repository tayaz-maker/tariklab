# TC SIM D quality package — evidence reconciliation, 2026-10-21

Final integration candidate inspected: `a185e89905d99894c9d37ac8bb54a6fa113472f3` (`codex/master-quality-closure`). This is candidate evidence, not a current-main merge or two-host publication receipt. No master-quality source files were edited by this reconciliation.

## Current candidate acceptance

The final compiled candidate passed `scripts/tc-sim-dashboard-language-browser.mjs --serve .output/public --out ../tc-quality-evidence/screenshots/final-built-v2`: **6/6 PASS**, TR/EN/PL ×1280/390. The actual flow is load → advanceWeek → job_start/start → reload. Serialized saves are identical through reload, console/page errors and horizontal overflow are zero. Polish secondary navigation, Meet Mehmet and month-end projection labels are asserted, including expanded mobile navigation. The final English desktop and Polish mobile screenshots were visually inspected: readable controls and sections, preserved hierarchy, no overlapping panels or blank content.

The parent already executed the source6/6 acceptance after dictionary-generator closure and the observed Polish label corrections; it was not rerun here. Evidence for the built run is `work/tc-quality-final-built-v2.log` and `work/tc-quality-evidence/screenshots/final-built-v2/results.json`, plus six screenshots.

`git diff --name-only 007ce1e310e6ce8feee49154fae18769d03928b6..a185e89905d99894c9d37ac8bb54a6fa113472f3 -- public/games/tc-sim` is empty. Therefore the existing domain/long-game evidence is reused against unchanged TC game/engine assets; it is not falsely described as a newly executed full suite on the integration SHA. Presentation dictionary changes have separate current-source and current-built gates.

## Requirement-to-evidence map

| TC quality requirement | Existing executed evidence retained | Candidate status / limit |
|---|---|---|
| Economy, inflation, income/expense and debt accounting | period-economy, monthly-cash, finance-acceptance, core18–35; integer assets, receipts and cash conservation | PASS audited invariants; no coefficients or economic feature rewrite |
| Banks, credit, mortgage, seizure and enforcement | mortgage, credit-policy, bank-business, icra, court-evidence, wage-collection, finance release integration; corresponding real browser cases | PASS implemented game model; full real-world legal simulation is outside the existing contract |
| Housing, wealth and asset calculations | housing-net-worth and mortgage/enforcement; owned/rented exclusion and no duplicate debt/asset count | PASS; no save/property schema changes |
| Jobs, career, education, family and relationships | core18–35, household, lifetime, real-life expansion, package2 and detained-career-actions; real job-start browser acceptance | PASS existing state/action gates and continuity |
| District choice, rent, risk and travel differences | city-life, semt-emlak, risk/criminal-justice/disengagement suites; city and district-risk browser cases | PASS existing costs, weekly gates, consequences and save preservation |
| Ankara, İstanbul and İzmir maps | existing three-city desktop1280/mobile390 browser acceptance, six city/viewport checks; loaded assets and fitting/nonoverlapping pins | PASS; screenshots inspected, no new map generation |
| Weekly decisions, month-end and long games | five profiles × three seeds ×720 actual weeks; separate1200-decision-week/25-game-year acceptance, four distinct career strategies, lifetime paths | PASS conservation, real choices and bounded execution; not universal human balance approval |
| Legal/illegal consequences | enforcement/court/compulsory wage and risk/criminal/sentence/disengagement module/browser cases | PASS modeled consequences; not a new law/justice feature package |
| TR/EN presentation plus retained PL | actual phrase/body API tests, generator source closure, final source6/6 (parent) and built6/6 (this run) | PASS changed visible copy and tested flow; no claim of rewriting all authored narrative |
| Old saves, offline reload and mobile screens | V5/V6 domain fixtures; existing source browser126/126 including actual offline reload; final built save equality; shell measurements15 menus ×1440/390/320,45 rows with max overflow0 | PASS measured contracts. Physical device testing remains owner work |

The domain totals are222 unique tests: the executed144-case set plus104-case set share26 core18–35 cases. Do not report248 unique tests. The broad source browser run passed126 rows before final translation additions and is not an immutable final-built receipt. The final changed-copy built matrix above closes that distinction. No obsolete checkpoint SHA was used as current main.

## Existing backlog reconciliation

- UI-001 broad mobile polish: the old statement that no final navigation pass existed is superseded for the measured current layout by45 zero-overflow shell measurements and current built390 acceptance. This does not claim every future content combination or physical device was tested. No current blocking layout defect was reproduced; a redesign is not justified by the evidence.
- UI-002 navigation density: horizontally accessible/expandable navigation is the existing design. The audit verifies access and no page overflow; Polish expanded mobile labels now have an explicit final-source/built guard. A different information architecture remains a product choice, not a reproduced blocker.
- UI-010 long-game money abundance: existing four strategies remain distinct and bounded, while finance long runs preserve liabilities and cash accounting. Broader goal/content-driven balance tuning remains a product backlog item; the audit supplies no evidence for changing coefficients now.
- UI-003 relationship explanation polish: existing short explanations remain. Richer explanations are optional polish, not a newly reproduced functionality failure.
- UI-007 generic ledger reason: already marked closed; no reopening or duplicate implementation.

No new TC mechanism, feature, art, card or refactor is required by this audit. Required remaining release work is parent-owned current-head CI/built verification and exact-main two-host Cloudflare acceptance after integration. Those release gates must not be replaced by these local results.
