# TC SIM final QA — canonical checkpoint

Candidate: `133dbbd1912b91f651d474f2e14331e31d7becfe`; tree `d4b5f47835dc30e66f2a54dbac5030575b46acf5`. Date: 2026-10-20 UTC.

**Release decision: PENDING final main CI. Do not declare TC SIM RELEASE COMPLETE yet.**

## Completed canonical checks

- 785/785 domain and CI-guard tests PASS, zero failures/skips. Includes finance, mortgage, enforcement, court, health, education, career, retirement, social memory, reputation, criminal record distinctions, custody/reentry, cities, fuel, insurance premiums, V5/V6 normalization and SAVE_VERSION 6.
- Included long-game acceptance: five economic profiles × three seeds × 720 actual weeks, one complete 1200-week / 25-game-year timeline, and job loss → mortgage default → compulsory sale with living arrears retained: 17/17 PASS. Quarterly real save/load; no mid-run money, health or clock resets. The 25-year run uses the middle-income profile; do not imply all five profiles were each tested for 25 years. These scripted rest-oriented profiles are regression evidence, not proof of every possible player strategy or full economic realism.
- Lint, typecheck and production build PASS. Local first invocation lacked the worktree dependency link; linking the existing dependencies resolved the environment issue without source changes.
- Vercel www READY at the candidate SHA. Both www and Workers serve exact canonical SHA-256 bytes for all ten guarded assets, including the three finance modules. Workers identity is proven through candidate asset hashes and the SHA-bound workflow, not an invented provider deployment ID.
- Existing service-worker cache and offline fallback domain tests PASS. Production Chromium workflow 39402406277 attempt 1 completed SUCCESS at this exact candidate. Both www and Workers artifacts report 126/126 PASS, failure=null, ten exact fingerprints each, and 22 rows per host containing preserved offline save facts. The tested TR/EN/PL × 1280/390 flows, reload, offline fallback and browser interactions PASS. Desktop TR 1280 and mobile PL 390 screenshots were visually inspected; the legitimate rent event is visible and operable within the viewport. These are tested flow translations, not a claim that every legacy screen string has been exhaustively localized.

## Remaining release gates

- Main CI: https://github.com/tayaz-maker/tariklab/actions/runs/39402406300
- Production Chromium, www and Workers: **PASS** https://github.com/tayaz-maker/tariklab/actions/runs/39402406277
- Results and desktop/mobile screenshots inspected. Main build-core remains in deterministic Duel stress (500 per theme); browser-regression remains in responsive/interaction regression across 16 live routes. Campaign browser and balance PASS. Close Package 4 and Package 5 only after all required current-candidate jobs PASS. No retry is requested while jobs are progressing. No gameplay patch is justified by a PENDING result.

## Explicit limitations

Physical-device QA: **UNKNOWN**, user-owned. Insurance claims/damage/indemnity: **not implemented**. Full statutory criminal-law and SGK simulation: **not claimed**. Existing game-scope financial/legal mechanisms remain accepted. No new feature, asset optimization, card generation or Atlas work was performed.

Machine-readable long-game outcomes: `TC-SIM-FINAL-LONG-GAME-2026-10-20.json`. Production fingerprint evidence: `TC-SIM-FINAL-PRODUCTION-HASHES-2026-10-20.json`.
