# Preserve main publication while removing CI bottlenecks

Cloudflare continues to watch `main`, build through its existing Git integration,
and run `npm run deploy:cloudflare`. The exact-main three-workflow guard, its
17 × 45-second wait, required check names, package ceilings and production
configuration are unchanged. No hook, credential, release branch, paid runner or
manual Wrangler deployment is part of this implementation.

The successful main run at `a5ac07a1` measured 43m25 for Boardworld: 24m37 in
unit tests and 13m16 in the three consecutive LW2 browser scripts. General CI
also serialized the whole Gold file on one worker (21m59), while its nested
Social Engine wrapper took 16m14. TC ran its browser families consecutively for
12m12. These are measured GitHub runner times.

The correction distributes independent work while preserving its acceptance:

- Four cost-balanced unit workers execute every selected file. Gold's 19 lives
  and Emergent's six annual lives are independent catalog entries, with their
  existing assertion bodies, seeds, durations and public-action replays intact.
  The focused Emergent cases run once. Local unfiltered `node --test` continues
  to register the complete suites.
- Each worker runs at most two child processes. General CI runs the original
  complete nested Social Engine wrapper on its own standard Ubuntu runner with
  Node 22. The wrapper, its 32 discovered files, 23 required-file checks, real
  test-count floor and all zero-failure/skip/cancellation assertions are unchanged.
- Boardworld builds once. Independent regression and continuous-generation
  browser workers consume the same workflow's sealed artifact, check its exact
  commit and all file hashes before execution, and recheck hashes afterward.
  Every pre-existing browser command, including all 20 stale-cache races,
  remains mandatory. TC similarly reuses one exact artifact across four
  independent browser groups.
- The generation harness removes repeated full-state IPC and redundant tab
  selection, while retaining ordinary visible clicks, durable-save/revision
  waits, every action trace, reload, milestone, natural death and heir assertion.
  It does not inject state, advance time outside UI actions or force clicks.

The remaining single-case bottleneck was the worker test's Node-specific
contextified global object. Its bundled worker executed far more slowly than the
same simulation in an ordinary JavaScript realm. The test harness now creates a
separate VM realm with `vm.constants.DONT_CONTEXTIFY`, then installs exactly the
same mocked timers, messaging and other host bindings. Node documents this mode
as an ordinary global object without the extra contextification wrapper, supported
by the deployed Node 22 version:
[Node VM context documentation](https://nodejs.org/docs/latest-v22.x/api/vm.html#vmconstantsdont_contextify).
No production simulation code changes. All six worker test bodies—including the
100,000 worker ticks, 100,000 reference ticks, command ordering, snapshots, journal
checks and final canonical equality—remain byte-identical. A parity test freezes
the released wrapper and worker assertion-body hashes.

`boardworld`, `build` and `TC job-start / built` remain the protected check
contexts. Their unconditional final gates reject failed, cancelled, skipped,
missing or malformed dependencies. Unit receipts are SHA-bound; coverage
rejects missing/duplicate/unexpected workloads, zero executed tests and failed
or cancelled cases. The 730 original successful Boardworld test names are frozen
from main job `132554020668` in `scripts/boardworld-ci-baseline.json` and must each
actually pass once. New tests cannot compensate for an omitted old test. Merged
endurance evidence requires exactly 19 Gold and six Emergent lives, matching
runtime/controller/harness fingerprints and no duplicates.

Hosted candidate `b52a973a` verified all 730 original Boardworld tests, all 1,377
generation actions, every milestone, the day-1501 estate and all 48 runtime assets
against the shipped journey. Boardworld finished in 7m58 and TC in 7m00. Merely
isolating the nested wrapper or changing its runner left inadequate timing margin,
so neither trial was merged. The faithful VM harness correction addresses the
measured single-case cause; unnecessary nested-file sharding and the ARM runner
trial are absent from the final implementation.

The short ABBA VM experiment retained identical canonical snapshots, interleaved
commands, zero worker errors and cadence: ordinary separate globals took about
1.0–1.2 seconds versus 7.1–7.5 seconds with contextified globals. The full Node22.23.5 worker run passed all six unchanged tests in107.03 seconds
(106.17 seconds for the complete paired100000-tick case), with zero failures,
skips, cancellations or TODOs. The complete protected PR checks, exact-main
checks, automatic
Cloudflare Git build and both production origins remain required before this CI
correction is reported as verified. Queue delays and genuine provider/test
failures still fail closed; no publication is inferred from a local timing result.
