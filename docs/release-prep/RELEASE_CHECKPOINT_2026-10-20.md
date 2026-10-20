# JITEM release checkpoint — 2026-10-20

## Confirmed
- JITEM #26 squash merged: 37c5416e7a49b2ecc998f0d1071a7484d6e508c0.
- Tested head: 2657665d6a5574ffb6ae106bb5db054e6453fa05; exact same tree 46e716106437a435b39f7c5f775a525e1ee8deed as merged main.
- 288/288 tests, lint/typecheck/build PASS; 7 atlas + 8 product + 12 support Chromium cases. Run 39414832356, artifact 12261440776, desktop/mobile screenshots reviewed.
- TarikLab #205: release/jitem-support-payoff-20261020; head 418b859abc4ddfaf57224b1a1079f33c4e7ba833; base 27beb9c1827ba893916aceb173c9109cf503d0d4.
- Build changes only runtime.js among generated files. 30 built game files byte-identical to copied product tree; SOURCE.json is the 31st receipt. Local integration tests 2/2 PASS.
- #205 Vercel status and Workers Builds PASS. CI 39415805136 still in progress at 11:42 UTC: changes/campaign-browser/campaign-balance success; build-core npm test and browser-regression still running. DO NOT MERGE while pending or failed.
- Existing other development PRs: TarikLab #131 and #112. No additional development PR was opened; total remains 3 including #205.

## Exact next steps
1. Fetch fresh #205 head/base/main and all checks. If all current-head CI PASS, squash merge using expected head 418b859abc4ddfaf57224b1a1079f33c4e7ba833.
2. Record new TarikLab canonical SHA, CI, Vercel, Workers.
3. Verify live SOURCE.json and full 31-file SHA-256 manifest against merged build.
4. Production Chromium QA branches (test code only, no PRs or runtime changes):
   - qa/release26-production-proof-20261020, run 39416117487: exact www hashes, 12 relationship-memory + 12 support positive/negative control + 8 product cases; separate Workers Chromium access classification.
   - qa/release26-capacity-proof-20261020, run 39416469968: 4 TR/EN × 390/1280 cases; exact resource vectors, exhaust capacity, blocked extra collection, next period, reload.
   Both runs are bounded waiting for exact live SOURCE SHA. If readiness times out before #205 release, rerun only the failed jobs after deployment. Do not mistake readiness timeout for game regression.
5. Inspect actual results and mobile/desktop screenshots; retain Workers access as separate from gameplay.
6. Save final evidence and updated independent prep branch against canonical main.

## Access observations
www SOURCE currently still #25 (1171d15...). www credits.html 200 and both IHTILAL/esik LIVE links preserved. www /oyna/esik and /oyna/ihtilal HTTP 200. Workers shell returned HTTP 200 from one request, but Workers static SOURCE.json returned HTTP 403 from another. Workers browser/gameplay is NOT certified. Do not weaken protections.

## Independent preparation
prep/archive-inventory-20261020 (remote tip d043075ecf2f61f5cb14eb48e29789f1245971aa) holds safe plan plus file inventory (15 esik, 29 ihtilal, 24 racon source/test files). Further local docs add portal Resources linkage and text-reference candidates. No game removal. Existing old transfer-gate document is not approval of Astra's incoming handoff. No transfer code until that handoff is accepted; do not write Astra branches.
