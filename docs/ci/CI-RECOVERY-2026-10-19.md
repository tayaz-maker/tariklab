# CI readiness recovery — 2026-10-19

Baseline: canonical e96a207200d0d4383f7fc64ee4d4ef2ba8cfd4a6. Raw five-run job/step timestamps: CI-RECOVERY-2026-10-19.json. Running/cancelled samples are not completed performance measurements.

| Run / attempt 1 | State at snapshot | build-core s | browser-regression s | campaign-browser s | campaign-balance s |
|---|---|---:|---:|---:|---:|
|39302932373 main|running|in progress|in progress|384|235|
|39302863218 PR191|running|in progress|in progress|252|236|
|39302170530 prior PR191|cancelled|299 (cancelled)|306 (cancelled)|216|230|
|39300291147 PR190|success|754|957|247|127|
|39300129378 prior PR190|cancelled|63 (cancelled)|67 (cancelled)|65 (cancelled)|64 (cancelled)|

Queue = job.started_at − job.created_at: normally2–3s; one campaign-balance sample51s. Workflow-to-first-job provisioning is separate. Successful PR190 npm test551s, duel stress153s; sequential browser Wave1 215s, Cete205s, Duel83s, sitewide198s, TC historical190s. Later timestamps show steps advancing: pending is not a hang. Cancelled runs correctly failed the aggregate gate; it is preserved.

## Proven failures and narrow correction

- Earlier PR188 log: Nitro waitForPort uses20×500ms. Cold npx Wrangler ready about18s after launch, after proxy failure. The outer HTTP poll cannot repair that dead proxy. CI built preview now launches the exact cloudflare-module Wrangler command from build metadata directly through the existing app-env wrapper. Unsupported presets/commands reject. HTTP200 readiness bounded90s, each request2s, dead process fails immediately. Actual SSR/Worker build and all browser cases remain.
- Canonical TC Workers browser18:30:14Z fetched app cc40ef6a… (exact52e57f0), expected b7b9bff3… (e96a207); build was still deploying. Later live check matched all7 canonical fingerprints. Workflow now waits at most300s for all7 exact candidate files before Chromium, each request3s. Browser repeats its original fail-closed assertion. Stale content never counts as success.

## Repeated work, cache and parallelism

PR uses built Chromium; main retains both production hosts. Full npm tests overlap targeted TC workflow tests deliberately at distinct boundaries; none removed. Shared i18n/script paths conservatively select other games; narrowing without dependency proof risks coverage. npm cache already exists; npm ci7–12s, build6–8s, preinstalled Chromium installation0s in these samples: not the dominant cost.

Serial independent browser families are a next parallelization candidate, requiring a separate before/after trial for runner CPU, ports, artifacts and required-job contracts. No browser/historical/long simulation/nightly-manual HANEDANIAN soak moved or removed here. No required names, branch protection, full test command, routing condition, cache, gameplay, asset or save change.

## Validation and limits

Readiness/exact-fingerprint/routing/required-gate regressions32/32PASS: late readiness beyond10s, dead process, bounded failure, late false success, unsupported preset and stale→7matching files. Typecheck/buildPASS. Lint, real built-preview and Chromium evidence remain gates. No speedup claimed: no completed after-run yet. This patch targets proven false failures/retry waste; measured execution-time reduction remains UNKNOWN.

Local real-command probe: cold npx installed Wrangler4.151.2 and reached its CLI after about23s, beyond the old10s proxy limit. This container then rejected uv_interface_addresses; the helper failed on child exit at about28s. This is NOT a successful preview/browser or after-speed measurement. Healthy GitHub Chromium is required. Lint/typecheck/build and32 targeted testsPASS.
