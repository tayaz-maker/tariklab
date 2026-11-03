# Boardworld 7.0 Gold — BLOCKED, NOT RELEASED

**Current release status: BLOCKED.** PR #254 remains draft and production remains6.0. CI on `27f2e01370e5854ba436633c7ab9d9ac8b15a4ba` reproduced two successful concurrent writers instead of one success/one conflict. Proposed fix PR #255 adds atomic IndexedDB fencing, but independent source and production-built review of its product commit `71006639` found a second critical defect: an already-open released6 tab can write a different stale action, which the next Gold load silently adopts over the successfully saved Gold winner. Exportability of the old fork passes; preservation of the Gold winner fails. PR #255's reviewed head `5a0721dc` has identical product bytes. Do not integrate or publish this version as accepted.

The new `boardworld-legacy-tab-browser.mjs` reproduces that loss using the exact released6 module graph and public save/engine APIs. Its mandatory CI gate and explicit immutable released6 fetch do not alter product code. Source/built failure reports are in `recovery/released6-stale-tab/`. The earlier current-client failure remains in `recovery/concurrent-writer-blocker.json`.

Fresh independent checks on `27f2e01` (not acceptance of the proposed fix): CI passed2892 JavaScript+70 TypeScript tests; the two explicitly excluded population tests passed separately, for2894+70 total with no fabricated single local clean run. Boardworld quality passed512 Node tests including19 lives/7300days, production build and all five browser stages before the writer-race failure. Fresh local browser checks also passed all five Boardworld suites,126 original TC SIM rows and45 historical rows. Save/migration checks passed130 cases and9 released6 rollback fixtures. Audit has0 critical/0 high/14 moderate findings;27 auth/identity cases pass. Final integrated candidate, matched timing, exact-head/main release CI and live Gold verification remain pending. Interrupted duplicate local full-suite attempts are not counted as passes.

## Historical pre-blocker evidence — not current Gold acceptance


Frozen product candidate `12b519c58b61e9de5074de5849e8a8c857f26646`, tree `bceae0875217321eaad2259519a463828f50e985`. This documentation-only evidence update does not change the tested product, harnesses, dependencies or build inputs. PR/main CI and production verification remain mandatory; this document does not claim a deployment or owner approval.

Gold preserves schema6, canonical and historical slots, original prose, deterministic simulation and original TC SIM. It serializes current-client save transactions, reduces lossless encoding allocations, packs shared production strings/modules, retains locale indices, avoids a duplicate calendar render and completes translated save feedback/numeric presentation. Recovery also removes high/critical dependency findings while preserving registered OAuth callback URLs, account identity and valid sessions.

| Gate | Result | Evidence |
| --- | --- | --- |
| Initial TR gzip ≤205874 bytes | PASS | 194150; released6 206624 |
| All-language gzip ≤301836 bytes | PASS | 300100; released6 339407 |
| Fixed p95 ≤23.4/23.4/24.0ms | PASS | Three-run medians21.5/21.6/21.9 at1440/390/320; every individual Gold p95 passes |
| Complete repository regression | PASS | Initial 2894 JavaScript:2893pass/1stale-license-notice failure; generated documentation correction then3/3 affected tests pass. All70 TypeScript pass. No unresolved failure, cancellation or skip; nightly/population cases included |
| 18×365 +730-day replay | PASS |19 lives/7300days; complete persisted shadow replay; action traces/counts/checkpoint hashes match released6 |
| Authentic save fixtures | PASS |80 released-writer v1–v5 +6 released6 fixtures; exact state preserved |
| Gold→released6→Gold rollback | PASS |9 fixtures, including pending event and progressed legacy; actual released6 public action/save/reload |
| Five Boardworld built browser suites | PASS |Core,Deep,Living,Emergent,Society on exact frozen candidate |
| Concurrent/stale save safety | PASS |Gold Web Locks, delayed storage events, asynchronous import race, simultaneous saves and export-only fallback |
| Original TC SIM | PASS |126-row built browser matrix;45 historical browser cases |
| Portal/other games | PASS |926 responsive result rows, zero errors;6 built save cases |
| Typecheck/lint/build/auth invariant | PASS |62 inherited warnings, zero errors |
| All-dependency audit | PASS high/critical gate |0critical/0high;14moderate tooling lineage findings remain |
| OAuth compatibility | PASS automated |Actual Better Auth handler tests; callback/state/PKCE, identity, session cookies, signed bearer, popup, replay/CSRF rejection; unchanged database schema |
| Cloudflare feature preview | PASS |Candidate12b519c, build e626ca73-8543-4cf8-a15d-566672a311cb, preview3e969f40 Ready; actual npm10 clean install/build passed |
| Exact-head PR/main CI | NOT RUN here |Must pass before production; see PR checks and final delivery artifact |
| Production delivery/live suites | NOT RUN here |Existing Git integration only; final manifest must record actual main SHA/version and both origins |
| Owner physical acceptance | NOT RUN |Explicitly retained by owner; five checks in manual playtest document |

Performance scope is the fixed numeric master-contract budgets. Fresh matched5 medians16.0/15.0/15.4 and6 medians16.1/15.7/15.5 are faster than Gold. Gold's safe lock/save/render completion is included, paint is excluded. This is not a relative speed-improvement claim. No game runtime optimization was introduced during recovery; the original loaded-machine failures remain retained. All nine paired version/runs were measured serially with the same Apple M2, Chrome156.0.8078.80, workload20/39/20, outside cloud-synced storage; no outliers were removed. Local gzip sums are not production network transfer. Heap snapshots have no forced GC and are not peak/retained-memory measurements.

Six mature saves remain401114–434998→278229–304168bytes without deleting history. Full raw performance, memory, network, save and command evidence is in the JSON reports and `recovery/`. Earlier a46f37d/b33fd13 acceptance results are historical only, not counted as these newly executed tests. The complete local JavaScript attempt was not a single clean run: its sole failure was stale seroval/zod versions in generated THIRD_PARTY_NOTICES.md. The generator changed four documentation lines; all three affected tests and the previously short-circuited70 TypeScript tests then passed. Product, simulation, dependencies and test sources did not change. Exact-head CI reruns the regression on the final documentation commit.

Existing6.0 tabs must export/reload before joining Gold; old JavaScript cannot participate in the new locking protocol. Browsers without Web Locks are explicitly export-only. In-flight OAuth/account-link flows begun before the upgrade must restart. Valid old sessions remain compatible; real owner Google/X sign-in and physical playtesting have not been performed. No new major feature, Worker or hosting integration was created. Post-Gold8/9 contracts are preparatory documentation only.
