# Upgrade issue register
| ID | Severity | Reproduction / evidence | Acceptance |
|---|---|---|---|
| TR-01 | P1 | Supplied report: cars appear to slide sideways. Static screenshot cannot prove velocity. | Compare captured screen travel and vehicle nose in all directions and eight turns. |
| NPC-01 | P1 | Reported pedestrian packs; baseline renderer shares an animation clock. | Per-agent phases, valid paths, legal crossings, non-overlap and no prolonged waits in crowded playback. |
| UI-01 | P1 | Prior gameplay capture visibly emphasizes the district over the game. | SOCIAL ENGINE dominant; district secondary at both target sizes. |
| JOB-01 | P1 | Baseline START_SHIFT assigns a timer and pays on expiry; retail and mechanics both rely on waiting. The posted wage can differ from the actual wage. | Distinct actionable work orders with finite goods, actual accounts, truthful pay and persistence. |
| PERF-01 | P1 | Prior 180-day Firefox save/read p95 3.98s under contention. Historical only. | Repeat on immutable upgrade across engines; report cost by phase. |
| SAVE-01 | P0 gate | New simulation rules may change the meaning of an outstanding old auto-journal. | Authentic previous snapshot plus nonempty tail on changed rules; no inferred compatibility. |

Candidate 99d9148: normal controls on the built Worker cover creation, conversation, screen-right movement, save export, reload and persistent balances/location. Real v6 import displays the historical arrival text with DARAMCIK; internal IDs and the signed source export are unchanged. Two careers pass physical work-order E2E. The traffic corner changed data representation: verify full old-world digest *before* conversion and compare all migrated fields with an independent oracle.

Fixed incidental defects: a late conversation reply could close a newly opened panel; work orders disappeared when starting a shift; interior service access could require exiting the building; application branding and stored old narrative disagreed; four frames made rounded corner travel jump between axis headings; all traffic was painted yellow despite persisted vehicle colors. The release bundler initially dropped Pixi texture registration; real startup failed, then passed after the explicit registration fix. Automated waits now observe the worker's completed projection instead of guessing the duration of a 610-tick shift.

Release blockers remain independently traceable: the 180-day Firefox roundtrip measured p95 3211ms versus 1000ms target, two human playtests were deferred, and physical low-end measurements are absent. Check current logs for endurance, exact-head CI and traffic recording; neither a screenshot nor an in-progress run is a PASS.
