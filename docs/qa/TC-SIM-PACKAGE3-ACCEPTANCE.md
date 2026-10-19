# TC SIM Package 3 canonical acceptance

Canonical: `1c387189ef7e5955cd8bd4b8ac1f4bc6def0051f`; tree `91d88cbb7c260869185531f09fd6a915687ba168`, 2026-10-19 UTC. Supersedes preparation checkpoint `39ae78f` on `chore/tc-sim-package3-acceptance-plan`.

## Canonical evidence

- Social, promise, memory, reputation, risk, final verdict, custody/reentry, V5/V6, finance and frozen-source tests: **156/156 PASS**, no skipped tests.
- Real long-game acceptance **17/17 PASS**: five economic profiles × three seeds ×720 weeks; 25 game years =1200 decision weeks; mortgage enforcement preserves living-cost arrears. Quarterly reload, integer TL, asset/debt and service invariants remain tested.
- Released #197 head `c8ecd1740cf7c0fc4220b3ac48bb6df9dc90338f`: CI `39323950652` and Chromium `39323950720` PASS. Artifact `12221307586`, results.json PASS with108 result rows, including TR/EN/PL ×1280/390 verdict, custody/release and disengagement. No overlay bypass.
- Vercel www READY on canonical SHA. Workers HTTP200 bytes match canonical criminal-justice.js, risk-layer.js, life.js and icra.js.
- At this checkpoint main CI `39327169682` is queued and production browser `39327169701` is running. These are not recorded as PASS.

## Decision and boundaries

| Area | State | Evidence / limitation |
|---|---|---|
| NPC memory, promises, delayed friend debt, trust, circle reputation | DONE | Social 3C/3D, depth, promise and liveness tests; exact-once/reload retained |
| Investigation / detention / final authored verdict distinction | DONE | Criminal-justice tests; health, detention and old saves do not invent convictions |
| Criminal record, bounded job consequence, lawful reentry | DONE | Source-backed history persists after reentry; liabilities retained |
| Repeat final fight verdict → custody → release | PARTIAL | Work/pay/service/pending jobs tested; final-custody stall attendance regression found below |
| Adult illegal choices and lawful disengagement | DONE | Existing risk choices; 13 clean weeks, no cash reward or erased history/debt |
| Complete statutory criminal law / all offences | PARTIAL | Authored fight-case game model; two-week repeat sentence is game policy, not a statutory claim |
| Physical devices | UNKNOWN | User-owned acceptance |

**Package 3 remains PARTIAL until the narrow regression repair and release gates pass.** Do not close it merely because the original targeted subset passed.

## Proven regression / repair checkpoint

A canonical reproduction opens a stall, resolves two final fight verdicts, confirms active custody, then calls tendShop: it incorrectly succeeds. The old stall gate checked only pretrial detainedUntil. The repair reuses existing isDetained, retaining army handling, delegation, prices, text, save fields and financial accounting.

V5/V6 regressions fail before the fix and pass after it: no cash/time/attention mutation while serving; attendance resumes after release. Existing TR/EN/PL ×1280/390 Chromium court scenarios add a disabled stall check and a real post-release visit. Legitimate social follow-up is resolved before navigation.

Repaired-source local verification: **199/199 targeted PASS**, **17/17 long-game PASS**, lint0 errors (62 existing warnings), typecheck/build PASS. Browser syntax/domain fixture checked; new actual Chromium and required CI remain pending gates. SAVE_VERSION6 remains unchanged.

## Package 4 preparation only

Existing locations.js, quarters.js, life.js and 3B/semt/map tests already implement district rent/living/travel modifiers, sector demand, moving costs, mother-visit distance, vehicle commute and map coordinates. Existing city subset **41/41 PASS**. Ankara already has Çankaya/Batıkent; İzmir Konak/Bornova. Inspect actual presentation/causality gaps after Package 3 closes; do not rebuild these systems. No new art, financial feature or UI redesign in this repair.
