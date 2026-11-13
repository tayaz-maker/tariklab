# Boardworld 7.0 Gold — acceptance contract and evidence history

The final release decision, exact-head/main CI and deployed commit/version are recorded in [Gold PR #254](https://github.com/tayaz-maker/tariklab/pull/254) and its linked delivery evidence. This source document is prepared before the final candidate freeze: implementation checks and historical results below do not certify a later commit or a production deployment. Physical playtesting remains assigned to the owner.

The save protocol keeps authoritative slots and generation in one IndexedDB transaction, with a fresh generation/byte comparison under Web Locks and success only after commit. Every observed valid divergent slot is preserved for explicit recovery; an old tab cannot replace an existing Gold winner. Empty origins remain unclaimed until a validated life is loaded or saved. The prior Gold protocol's empty bookkeeping record can bootstrap a late legacy save; damaged claimed heads retain authoritative precedence. Immutable originals and the original TC SIM slot remain protected.

Reviewed implementation commits: Sol revision3 `b0c25495`/`66bc904d`, bounded validation cache `9d116ec5` (tested local `843bc0c`, identical tree), and empty-origin correction `b2ba2ce3` (tested local `3ba9630`, identical tree). The cache retains at most three exact validated envelope strings, never parsed state, a head or a generation. The localization correction translates current cash/need outcome labels while preserving already formatted numbers and saved prose.

Before final freeze, the unchanged independent empty-origin runner passed four source and four built scenarios on `3ba9630`, including an actual prior843 empty head, complete migrated UI state, exact original/archive bytes, TC preservation and save/reload. Its new seven-case CI gate also covers failed promotion and two queued first writers. These proofs supplement, and do not replace, final integrated acceptance.

Mandatory release gates on the final candidate are: 19 lives/7,300 days; all five Boardworld browser suites; original TC SIM regressions and the two explicitly excluded population cases; concurrent writers, old tabs, v1–v6 migration, rollback and recovery; TR/EN/PL and accessibility controls; build/typecheck/lint; all-dependency audit with zero high/critical findings; OAuth/session compatibility; exact-head and exact-main CI; fixed gzip and p95 budgets; existing Cloudflare Git publication; both-origin asset hashes and real-browser live save/upgrade checks. No failed, skipped or interrupted result may be promoted to PASS.

The latest fully collected earlier integration, `038de709`, passed 2,893 JavaScript and70 TypeScript CI tests, 513 Boardworld simulation tests, all19 lives/7,300days/64,064actions, and local TC126+45 cases. Life records, traces and checkpoint hashes matched released6 and `27f2e01` except elapsed timing. Its Deep suite failed late legacy discovery, and matched p95 medians29.6/26.9/27.8ms failed the unchanged23.4/23.4/24.0ms limits. It was not released. The cache-only diagnostic batch was interrupted after six retained runs when independent host load rose sharply; it is not timing acceptance. See `BOARDWORLD_7_FINALIZATION.json` for commit-bound implementation and historical proof references.

## Historical blocked candidates — retained, superseded evidence

On `27f2e01370e5854ba436633c7ab9d9ac8b15a4ba`, CI reproduced two successful concurrent writers instead of one success/one conflict. The first proposed fix, product `71006639` and identical product bytes at `5a0721dc`, silently adopted an already-open released6 tab's divergent stale action over the saved Gold winner. The source/built failure reports in `recovery/released6-stale-tab/`, the mandatory `boardworld-legacy-tab-browser.mjs` regression, and `recovery/concurrent-writer-blocker.json` remain historical evidence. Subsequent revision2 also lost a divergent backup behind a known primary and leaked Turkish in combined EN/PL manual-save feedback; revision3 corrects those cases, subject to final integrated gates.

Historical `27f2e01` checks passed2892 JavaScript+70 TypeScript tests in CI; two explicitly excluded population cases passed separately, for2894+70 total. Boardworld quality passed512 Node tests including19 lives/7300days, the build and five browser stages before its writer-race failure. Local checks passed five Boardworld suites,126 original TC SIM rows,45 historical rows,130 save/migration cases and9 released6 rollback fixtures. Its audit reported0 critical/0 high/14 moderate and27 auth/identity cases passed. Interrupted duplicate full-suite attempts were not passes. These results are not transferred to the integration.

Historical `27f2e01` timing includes a390px individual p95 of25.1ms, above the23.4ms budget, although its three-run390px median of23.0ms passes. Preserve that individual exceedance; it is not evidence that every run passed. Final integrated timing is pending.

## Historical `12b519c` evidence — not current Gold acceptance


Frozen product candidate `12b519c58b61e9de5074de5849e8a8c857f26646`, tree `bceae0875217321eaad2259519a463828f50e985`. This documentation-only evidence update does not change the tested product, harnesses, dependencies or build inputs. PR/main CI and production verification remain mandatory; this document does not claim a deployment or owner approval.

That historical candidate preserves schema6, canonical and historical slots, original prose, deterministic simulation and original TC SIM. It serializes current-client save transactions, reduces lossless encoding allocations, packs shared production strings/modules, retains locale indices, avoids a duplicate calendar render and completes translated save feedback/numeric presentation. Recovery also removes high/critical dependency findings while preserving registered OAuth callback URLs, account identity and valid sessions.

| Historical gate | Historical result | Evidence |
| --- | --- | --- |
| Initial TR gzip ≤205874 bytes | PASS | 194150; released6 206624 |
| All-language gzip ≤301836 bytes | PASS | 300100; released6 339407 |
| Fixed p95 ≤23.4/23.4/24.0ms | PASS | Three-run medians21.5/21.6/21.9 at1440/390/320; every individual Gold p95 passes |
| Complete repository regression | PASS | Initial 2894 JavaScript:2893pass/1stale-license-notice failure; generated documentation correction then3/3 affected tests pass. All70 TypeScript pass. No unresolved failure, cancellation or skip; nightly/population cases included |
| 18×365 +730-day replay | PASS |19 lives/7300days; complete persisted shadow replay; action traces/counts/checkpoint hashes match released6 |
| Authentic save fixtures | PASS |80 released-writer v1–v5 +6 released6 fixtures; exact state preserved |
| Gold→released6→Gold rollback | PASS |9 fixtures, including pending event and progressed legacy; actual released6 public action/save/reload |
| Five Boardworld built browser suites | PASS |Core,Deep,Living,Emergent,Society on exact frozen candidate |
| Concurrent/stale save safety | SUPERSEDED | Earlier PASS was invalidated by the later writer-race and released6 stale-tab failures above |
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

Six mature saves remain401114–434998→278229–304168bytes without deleting history. Full raw performance, memory, network, save and command evidence is in the JSON reports and `recovery/`. Earlier a46f37d/b33fd13 acceptance results are historical only, not counted as final integrated tests. The complete local JavaScript attempt was not a single clean run: its sole failure was stale seroval/zod versions in generated THIRD_PARTY_NOTICES.md. The generator changed four documentation lines; all three affected tests and the previously short-circuited70 TypeScript tests then passed. Product, simulation, dependencies and test sources did not change. Exact-head CI reruns the regression on the final documentation commit.

The historical current-client locking claim did not establish safe coexistence with already-open6.0 tabs; later failures and the integrated quarantine fix above supersede that claim. Browsers without the required Web Locks/IndexedDB protection remain export-only. In-flight OAuth/account-link flows begun before the upgrade must restart. Valid old sessions remain compatible; real owner Google/X sign-in and physical playtesting have not been performed. No new major feature, Worker or hosting integration was created. Post-Gold8/9 contracts are preparatory documentation only.
