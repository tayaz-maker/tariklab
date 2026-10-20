# TC SIM Package 4 canonical acceptance

Candidate: `133dbbd1912b91f651d474f2e14331e31d7becfe`
Source tree: `d4b5f47835dc30e66f2a54dbac5030575b46acf5`
Checkpoint date: 2026-10-20 UTC. Status: **automated domain acceptance PASS; final main CI gate PENDING**. Package 4 is not declared DONE while those gates run.

| Area | Canonical evidence | Status |
|---|---|---|
| District visibility and voluntary illicit risk | district-risk, risk-layer, map/semt tests; bounded +1/+2 authored game rule; residence alone creates no offence | PASS |
| Fuel, insurance premium, commute | vehicle-fuel, vehicle-insurance, wealth, monthly cash and work-recovery tests; observed travel only, no duplicate fare/premium | PASS |
| Moving, mother visits, maps | Existing location, quarters, map and city acceptance preserved | PASS |
| Life history, goals, weekly time and recovery | Existing depth-2/depth-4, education, decision and life tests | PASS |
| V5/V6, SAVE_VERSION 6, save/reload and finance | Full canonical TC suite, frozen 62-source guard and long-game acceptance | PASS |
| www / Workers released assets | Exact SHA-256 matches for all 10 guarded files on each host, including life.js, wealth.js and locations.js | PASS |
| TR/EN/PL × 1280/390 Chromium, offline reload | Canonical production workflow 39402406277 SUCCESS; www 126/126 and Workers 126/126, desktop/mobile screenshots inspected | PASS |
| Main required CI | Workflow 39402406300 still running at checkpoint | PENDING |
| Physical devices | User-owned acceptance | UNKNOWN |

Canonical local command: `node --test scripts/tc-sim*.test.mjs scripts/management-desk.test.mjs scripts/ci-readiness.test.mjs scripts/ci-browser-routing.test.mjs`: **785/785 PASS**, zero failed/cancelled/skipped; 51.57 seconds. This includes 17 long-game tests; do not add them again to the total. Lint, typecheck and build PASS. No runtime, save, UI, map or asset changes were made for this acceptance.

Boundary: insurance premiums are game-budget accounting. Damage, claims, indemnity and real policy coverage are **not implemented**. No real district crime-rate or full statutory law/SGK simulation is claimed.
