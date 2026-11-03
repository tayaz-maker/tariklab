# Boardworld 6.0 continuation — implementation incomplete

This checkpoint is not a 6.0 release report. The full user contract is preserved in `BOARDWORLD_6_CONTRACT.md` (SHA256 `fc24f8a5d21b70d2d736cab4de0156c478efe9220c2cf45a75b94a4aa47cee7f`). Continue within the authorized scope without routine permission requests. Previous 5.0 results are not verification of 6.0.

## Integrated implementation

The local branch is `feature/boardworld-gold-preparation`, based on released main `78ec4ee339051840037e48e80f4b07518d5a1424`. Recheck remote main before publishing.

- `50fc30b` implements schema 6, pure migration from versions 1–5, canonical `tariklab.boardworld.v6` and backup, read-only legacy slots, immutable original-v5 archive, and default checksum-protected compact dictionary exports. Statements that migration or the codec remain unintegrated are obsolete.
- `958585f` adds scoped NPC needs, constrained regional supply/price feedback and recovery descriptions. It fixes the actual day-58 calendar invariant found by the new endurance pilot: an accepted free contact with an empty calendar ID must not enter a meeting-reschedule chain. The legal `calendar:accept:cal-4` reproducer is retained in task-workspace `work/bw6-gold-failure-state.json` and `work/bw6-gold-failure-action.json`; a permanent focused regression covers the fix.
- `5fbd2832` additionally removes the legacy NPC support fallback in version 6 because that fallback could select a recipient using undisclosed private cash. `47f49188` updates the retained flow/society tests' current-version expectations.
- `6e562fa` commits genuine 5.0 fixtures, provenance and v5-to-v6 save regressions, without production module changes.
- `3ec59c7f` implements the UI/payload checkpoint, and `809fe850` wires production packing into the standard build. Consult `work/bw6-ui-handoff.md` for its actual results. Reported packed initial/all-language gzip bytes remain above the contract targets; do not claim that gate passed. Rebuild after any subsequent runtime change.

## Authentic saves and migration coverage

A fresh frozen snapshot was extracted from `78ec4ee`: 33 game files plus two original controllers, with archive and per-file hashes in task-workspace `work/bw6-baseline/`. Six real 365-day runs generated 25 authentic envelopes: three fresh starts, 15 progressed states and seven active project/calendar/enterprise/household/causal/invitation/knowledge states. Six public-action traces are committed. No state, money, skills or time were patched. `scripts/fixtures/boardworld/v5-provenance.json` binds all fixture bytes, trace prefixes and the original persistence writer. Only the writer's engine import is retargeted to the current strict legacy validator. These captures prove provenance, not fresh performance results.

Passed command:

```sh
node --test scripts/boardworld-save.test.mjs scripts/boardworld-v6-save.test.mjs scripts/boardworld-save-codec.test.mjs
```

**123/123 passed, zero failures/skips**, recorded in task-workspace `work/bw6-save-regression.log`: 110 retained save cases, 11 new v5/v6 cases and two codec cases. Current-version/key/message expectations were updated to 6; original fixture assertions remain. Coverage includes exact old fields/history/RNG, pure idempotent migration, smaller mature saves, authentic stale-v5 writer interleavings, immediate protected promotion, immutable archive bytes, quota/silent-write failures, canonical recovery priority, malformed checksums/dictionaries, fresh mutable loads and safe legacy extensions. This is a focused result, not whole-repository acceptance.

## Endurance harness

`scripts/boardworld-gold-scenarios.mjs` extends the existing legal-action controller. Entrepreneur origins without restart's initial skills/tools first earn repair qualifications and startup savings through retail, buy tools, give notice and resign explicitly. All three origins passed a 40-day pilot and opened a business by day 11 (restart on day 1). No setup patches occur in endurance.

`scripts/boardworld-gold-acceptance.test.mjs` contains 18 distinct 365-day cases (three origins × three strategies × two seeds) and one 730-day career case:

```sh
BOARDWORLD_GOLD_REPORT=../bw6-gold-matrix.json node --test scripts/boardworld-gold-acceptance.test.mjs
```

Every action checks input immutability and state validity. A shadow replay exports/imports every 37 turns and compares the full state each turn. Checkpoints at days 30/90/180/365 (plus 540/730) record meaningful decisions, maintenance, zero-time actions, delayed effects, NPC autonomy, finances, goals and save growth. Completed delayed effects must reject an immediate retry without changing state. Population conservation, bounded offers/feed/history and nonnegative enterprise stock/capital are checked throughout. Strategy assertions retain actual work, promotions, certification, household bills/chores, meetings, business stock costs and earned revenue.

**The final integrated matrix passed 19/19, with zero failures/skips.** Its 18 annual lives used 2,470–3,711 legal actions each and produced 261,708–303,245-byte compact saves. The 730-day career life used 5,064 actions, resolved 118 delayed effects and retained a 284,214-byte compact save. All process-start runtime hashes still matched after the run. Full focused results and checkpoints are in [BOARDWORLD_6_ENDURANCE.md](./BOARDWORLD_6_ENDURANCE.md) and [BOARDWORLD_6_ENDURANCE.json](./BOARDWORLD_6_ENDURANCE.json). Raw task-workspace files are `work/bw6-gold-final.log` and `.json`.

The earlier candidate also passed 19 cases but imported the pre-privacy-fix graph; it is superseded by the final run. The failed day-58 pilot is not counted as a pass. Correctness wall times include desktop suspension/concurrent work and are not performance evidence. Two additional real-action batch/manual tests passed: entire authoritative state matches, with only the explicitly asserted batch summary revision/log and diagnostics differing.

The six existing restart-year tests remain intact. CI should shard expensive origin/730-day cases deliberately while preserving every assertion; adding all 19 to one existing 30-minute quality job risks a timeout. A test-name pattern can select each origin without changing the test implementation.

## Remaining release gates

1. Preserve the passing 19-case matrix, its exact source hashes and the two independent batch/manual regressions. Rerun affected cases if authoritative runtime changes. The current policies retain debt despite high bank balances; this limitation is explicit in the endurance report. Integrate any remaining agent adversarial tests.
2. Integrate remaining agent tests and browser version/key/asset adaptations without deleting coverage. Run the complete repository suite, typecheck, lint and final production build. Previous 5.0 `2886/2886` is not a 6.0 result.
3. Freshly compare frozen 5 and final 6 on the same hardware/browser/workload in three serial repeats. Measure actual initial network requests, gzip totals, handler p95, compact save sizes and quota behavior. There is no final matched performance result in this checkpoint.
4. Verify TR/EN/PL, mobile/keyboard/reduced-motion, original TC SIM, stale writers from versions 1–5 and final built/live hashes. Publish the measurable 7.0 closure list. Do not label 6.0 Gold.
5. After critical gates pass, create the PR, obtain exact-head CI, merge normally, use the existing guarded Cloudflare Git build, and independently verify production commit/version/100% traffic and live gameplay. Retry an existing timed-out build only after exact-main CI succeeds. Do not weaken the guard, create a Worker, invent a hook or touch Vercel.

No 6.0 PR, merge or production release is claimed here. Root's remote checkpoint `00f49bef7e3be5972c0c63fadf21fefa375d022e` has the same tree as local `50fc30b`; later local changes still require publication. Last verified 5.0 production was build `6e5c96fb-7024-4300-8c19-f3872d5cb72e`, version `667cf702-b68c-443c-9996-9bac6503e3bb`. Recheck current production before relying on that historical evidence.
