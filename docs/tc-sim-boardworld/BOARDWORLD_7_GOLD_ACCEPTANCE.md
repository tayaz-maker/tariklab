# Boardworld 7.0 Gold acceptance

Status: implementation and diagnostic verification; **not deployed or accepted**. Production remains Boardworld 6.0 (`d695119186cad42c079a911a60c372f201b3b64b`). Owner physical acceptance is separate.

Gold preserves the v6 save schema/slots and all established mechanics. Scope: guarded native cross-tab transactions, lossless save encoding with fewer allocations, production-only string sharing and bundling, stable locale indices, and removal of duplicate calendar renders. No new major features or original TC SIM runtime changes.

## Mandatory gates

| Gate | Status | Evidence requirement |
| --- | --- | --- |
| Initial TR gzip ≤205874 bytes; all-language aggregate ≤301836 bytes | NOT RUN on frozen candidate | Same gzip sum definition as 6.0, including generated runtime and compatibility URLs |
| Matched three-run p95 ≤23.4/23.4/24.0 ms at 1440/390/320 | NOT RUN | Complete interaction including Web Lock wait/save/render; raw samples and historical synchronous-boundary difference disclosed |
| Authentic v1–v5 + native v6 round trips | Diagnostic PASS; final NOT RUN | Migration matrix and exact state hashes; 80 legacy + 6 generated released6 fixtures |
| Stale writer, equal-revision forks, simultaneous current-client saves, async import | Diagnostic PASS; final NOT RUN | Byte-token validation inside origin-wide Web Lock; offline export retained |
| 18×365 + 730 days, deterministic persisted replay and invariants | NOT RUN | Final source hashes, all 19 life records, decisions/maintenance/zero-progress counts |
| Full repository JS/TS, typecheck, lint, production build, security checks | NOT RUN on frozen candidate | Commands, exits, warnings and exclusions separately recorded |
| Five built and five live Boardworld browser suites | NOT RUN | TR/EN/PL, widths 1440/390/320, keyboard/touch/reduced motion, all generated asset hashes |
| Original TC SIM and portal/save compatibility | NOT RUN | Full original browser matrix plus save/import/export/reload |
| Exact PR head CI, normal merge, exact main CI | NOT RUN | GitHub URLs and SHAs; never bypass a failing check |
| Existing Cloudflare Git deployment Ready/100% + live hashes | NOT RUN | Build/version/commit and both production origins |
| Owner physical acceptance | NOT RUN | Five checks in BOARDWORLD_7_MANUAL_PLAYTEST.md |

The source declaration of product version 7 does not increment the save schema. Historical Turkish prose remains unchanged and visibly identified as original content. Local gzip sums are not actual Cloudflare wire transfer. Automated strategy counts do not establish entertainment value.

See the machine evidence manifest, migration matrix, performance comparison, known issues and rollback procedure in this directory. A successful deployment must be described as **Gold candidate deployed, awaiting owner acceptance** until owner acceptance occurs.
