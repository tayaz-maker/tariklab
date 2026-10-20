# TC SIM release and maintenance handoff

Release commit: `133dbbd1912b91f651d474f2e14331e31d7becfe`. Runtime/source tree: `d4b5f47835dc30e66f2a54dbac5030575b46acf5`. Final acceptance: **RELEASE COMPLETE — SOFTWARE QA PASS**, 2026-10-20. This documentation checkpoint does not change the production release SHA.

## Completed game scope

| Package | Accepted mechanisms | Result |
|---|---|---|
| 1 Finance | Integer-TL debt/asset conservation; owned-home valuation; actual monthly cash summary; bank separation, credit record/capacity, interest/amortization, restructuring/default; mortgage → enforcement → compulsory home sale and remaining debt/surplus; wage collection; source-backed court/evidence/counsel/objection; observed SGK service and retirement links without a second net-salary deduction | DONE |
| 2 Life and career | Existing education/skill/career continuity; health/stress/recovery; custody work/commute/experience/decision gates; temporary incapacity, recovery and return; salary paid once and service credited only for observed work | DONE |
| 3 Social/illegal life | NPC memory, friend debt/delayed collection, kept/broken promises, trust/reputation; no new offers from deceased NPCs; risky-network disengagement; investigation/detention separate from final conviction; evidence/verdict, bounded sentence, criminal record, job/social consequences and reentry | DONE |
| 4 City/transport/UI | Existing district/map/rent/customer/commute/moving/mother-visit systems preserved; explained bounded voluntary-shortcut risk; actual work fuel, insurance-premium/upkeep split without duplicate budget charges; chronological life history, goals and weekly time/energy controls | DONE |
| 5 Final QA | Canonical domain/guard tests, long game, save/reload, language/viewport Chromium and both production hosts | DONE — software scope |

## Exact acceptance evidence

- Canonical 785/785 PASS, zero failures/cancellations/skips, including the 17 long-game cases. Command and measured result are in `TC-SIM-FINAL-QA.md`; avoid adding overlapping test counts.
- Five economic profiles × three seeds × 720 real weeks; one 1200-week / 25-game-year middle-income timeline; one real job-loss/default/compulsory-sale chain. Quarterly save/reload, no mid-run cash/health/clock resets. Full outcomes: `TC-SIM-FINAL-LONG-GAME-2026-10-20.json`. Scripted rest-oriented scenarios do not certify every possible strategy or full economic realism.
- TR/EN/PL × 1280/390 targeted Chromium, additional 1440/390/320/reduced-motion flows, actual offline save/reload: www 126/126 and Workers 126/126. Artifact IDs 12256451607 and 12255461641. Browser workflow: https://github.com/tayaz-maker/tariklab/actions/runs/39402406277 (attempt 1 SUCCESS).
- Main required CI: https://github.com/tayaz-maker/tariklab/actions/runs/39402406300 (attempt 1 SUCCESS). All current-candidate check runs SUCCESS, including aggregate build.
- Lint, typecheck and build PASS. Vercel READY at release SHA; both production hosts match all ten guarded SHA-256 fingerprints, including life.js, wealth.js and locations.js. Evidence: `TC-SIM-FINAL-PRODUCTION-HASHES-2026-10-20.json`.

## Boundaries and retained limitations

Physical-device QA **UNKNOWN**, user-owned. Vehicle damage, claims, indemnity and real insurance-policy coverage **NOT IMPLEMENTED**; only premiums/budget accounting accepted. Full statutory courts/criminal law/SGK contribution and employer-law simulation **NOT CLAIMED**. Detention alone is not conviction or a criminal record. Tested TR/EN/PL flows do not assert an exhaustive translation of every legacy string. Comic map art remains a deferred art decision, not newly produced acceptance evidence.

## Maintenance rules

Keep SAVE_VERSION 6 and V5/V6 compatibility; do not bump versions or rewrite schemas without a justified migration. Preserve D0 debt conservation, owned-asset/debt single counting, integer TL, actual-ledger versus forecast separation, one month-close/payment per period and no duplicate consequences after reload. Do not erase liabilities to make tests pass.

Reuse existing engines/UI. A future bugfix should first add a deterministic failing reproduction, then the smallest correction, relevant domain/save tests and genuine browser verification. Retain the full 62-source frozen guard inventory; update its hash only after checking that all protected changes are approved. Never weaken tests/required CI, force push, or merge a pending/failed candidate.

For deployment investigations, compare the exact candidate's ten guarded assets on www and Workers before browser execution. Separate stale deployment/cache/route issues from game regressions; preserve bounded readiness and rerun only a proven failed job after its workflow completes. No unmeasured speed/performance claims. Every future runtime release requires exact head CI PASS and post-merge main/production verification.

## Next TarikLab work

TC SIM feature development is closed. Next: inspect JITEM's canonical upstream `tayaz-maker/jitem-derin-ag`, build/sync contract and compatible IHTILAL systems. Never hand-edit compiled JITEM runtime. Transfer only compatible, original mechanics; preserve JITEM design and save contracts. IHTILAL removal from live catalogue/Resources is contingent on a verified transfer and a durable GitHub archive; do not delete historical source. Racon Manager follows; Kıyı Eşiği requires reuse assessment before archival. Cards, Anatomy Atlas and site size/performance optimization stay deferred. No unrelated game implementation is authorized by this handoff alone beyond the user's explicit next-game task.
