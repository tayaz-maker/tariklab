# Boardworld 7.0 Gold acceptance — BLOCKED, NOT RELEASED

The product source tested is `a46f37df605285e73fb5747431c75e4b937a6c03` (tree `b9c30d3aad93533db8ef4a2ecd2df9ff11d12f8a`). Production remains released6, merge `d695119186cad42c079a911a60c372f201b3b64b`. No Gold PR, merge, CI acceptance or deployment has occurred.

Gold preserves the v6 schema/slots, exact historical state and original TC SIM. Scope: byte-token checks inside Web Locks, lossless encoding allocations, production-only string sharing/bundling, stable locale indices, one calendar render, translated save status and numeric display precision.

| Gate | Status | Measured evidence |
| --- | --- | --- |
| Initial TR gzip ≤205874 bytes | PASS | 194150 bytes; released6 206624 |
| All-language aggregate gzip ≤301836 bytes | PASS | 300100 bytes; released6 339407 |
| Three-run p95 ≤23.4/23.4/24.0 ms | FAIL | Gold medians 29.0/28.0/28.1 ms at 1440/390/320; all raw runs retained |
| Full repository regression | PASS | 2894 JavaScript + 61 TypeScript, zero failures/cancellations/skips; population studies included |
| 18×365 + one 730-day life | PASS | 19 independently rerun lives, 7300 days, complete persisted shadow replay; action traces/counts and checkpoint save hashes match released6 |
| Legacy/native save coverage | PASS | 80 released-writer v1–v5 fixtures + 6 generated released6 fixtures; exact state preservation; six Gold→released6→Gold rollback-reader checks |
| Five Boardworld built browser suites | PASS after targeted harness rerun | Core/Living/Emergent/Society passed first frozen run; Deep initially read async save notice too early, then passed after awaiting its actual completion. First failure retained |
| Current-client cross-tab safety | PASS | Stale save, asynchronous import race, simultaneous writes, no-Web-Locks export-only; zero page exceptions |
| Original TC SIM browser matrix | PASS | 126/126 result rows, zero failure; original runtime unchanged |
| Typecheck/lint/build/auth invariant | PASS | 62 inherited lint warnings, zero errors; dev/build auth flag agrees |
| Dependency security audit | FAIL | 1 critical, 4 high, 17 moderate, 2 low package findings. Unadopted remediation clears high/critical but breaks two existing OAuth API types |
| Exact PR/main CI and Cloudflare Gold deploy | NOT RUN | Blocked by acceptance failures; no bypass |
| Owner physical acceptance | NOT RUN | Separate five-check manual script; no human acceptance claimed |

The game runtime did not change after the tested source was frozen. A subsequent test-only correction waits for the manual save notice before asserting/reloading; it changes no product behavior. Machine evidence distinguishes the original failed browser run from the successful rerun and identifies commands, exits and artifacts. This is not a single clean browser run or an accepted Gold release.

Local gzip sums include every generated module and compatibility stub; they are not Cloudflare wire transfer. Gold timing includes awaited lock/save/render and excludes paint. Historical synchronous timing alone cannot substitute for complete Gold interaction timing. Heap snapshots lack forced GC and are not peak/retained-memory measurements. Automated strategy counts do not establish entertainment value.

The critical Better Auth advisory requires Magic Link, which is not enabled here; OAuth Proxy is also absent. This applicability observation does not waive the full dependency audit. The attempted 1.7 upgrade removes `genericOAuthClient` and `signInWithOAuth2`, so it was not integrated into the live authentication path.

Before any future release, close both failed gates and verify the resulting candidate. Existing 6.0 tabs must export/reload before joining Gold because old JavaScript cannot participate in the new locking protocol. No new major feature, new Worker, new hosting integration or intermediate release was created.
