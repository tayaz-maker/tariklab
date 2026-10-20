# TC SIM final QA — canonical checkpoint

Candidate: `133dbbd1912b91f651d474f2e14331e31d7becfe`; tree `d4b5f47835dc30e66f2a54dbac5030575b46acf5`. Date: 2026-10-20 UTC.

**RELEASE COMPLETE — SOFTWARE QA PASS. Package 4 DONE; Package 5 DONE within the documented software acceptance scope.**

## Completed canonical checks

- 785/785 domain and CI-guard tests PASS, zero failures/skips. Includes finance, mortgage, enforcement, court, health, education, career, retirement, social memory, reputation, criminal record distinctions, custody/reentry, cities, fuel, insurance premiums, V5/V6 normalization and SAVE_VERSION 6.
- Included long-game acceptance: five economic profiles × three seeds × 720 actual weeks, one complete 1200-week / 25-game-year timeline, and job loss → mortgage default → compulsory sale with living arrears retained: 17/17 PASS. Quarterly real save/load; no mid-run money, health or clock resets. The 25-year run uses the middle-income profile; do not imply all five profiles were each tested for 25 years. These scripted rest-oriented profiles are regression evidence, not proof of every possible player strategy or full economic realism.
- Lint, typecheck and production build PASS. Local first invocation lacked the worktree dependency link; linking the existing dependencies resolved the environment issue without source changes.
- Vercel www READY at the candidate SHA. Both www and Workers serve exact canonical SHA-256 bytes for all ten guarded assets, including the three finance modules. Workers identity is proven through candidate asset hashes and the SHA-bound workflow, not an invented provider deployment ID.
- Existing service-worker cache and offline fallback domain tests PASS. Production Chromium workflow 39402406277 attempt 1 completed SUCCESS at this exact candidate. Both www and Workers artifacts report 126/126 PASS, failure=null, ten exact fingerprints each, and 22 rows per host containing preserved offline save facts. The tested TR/EN/PL × 1280/390 flows, reload, offline fallback and browser interactions PASS. Desktop TR 1280 and mobile PL 390 screenshots were visually inspected; the legitimate rent event is visible and operable within the viewport. These are tested flow translations, not a claim that every legacy screen string has been exhaustively localized.

## Final release gates — all PASS

- Main CI 39402406300 attempt 1: completed SUCCESS on the exact candidate. Commit checks build, build-core, browser-regression, campaign-browser, campaign-balance, changes and Workers Builds all completed SUCCESS.
- Production Chromium 39402406277 attempt 1: completed SUCCESS; TC job-start / www and TC job-start / workers PASS. Each host has 126 passing cases, 10 matching fingerprints and 22 offline-save rows. Results and desktop/mobile screenshots inspected.
- No tests were rerun for final closure; the unchanged candidate retains the 785/785 canonical result, 17 included long-game cases and successful lint/typecheck/build.

Evidence: https://github.com/tayaz-maker/tariklab/actions/runs/39402406300 and https://github.com/tayaz-maker/tariklab/actions/runs/39402406277. Detailed browser case inventory: `TC-SIM-FINAL-CHROMIUM-2026-10-20.json`.

## Explicit limitations

Physical-device QA: **UNKNOWN**, user-owned. Insurance claims/damage/indemnity: **not implemented**. Full statutory criminal-law and SGK simulation: **not claimed**. Existing game-scope financial/legal mechanisms remain accepted. No new feature, asset optimization, card generation or Atlas work was performed.

Machine-readable long-game outcomes: `TC-SIM-FINAL-LONG-GAME-2026-10-20.json`. Production fingerprint evidence: `TC-SIM-FINAL-PRODUCTION-HASHES-2026-10-20.json`.
