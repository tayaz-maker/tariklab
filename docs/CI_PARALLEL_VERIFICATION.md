# Preserve main publication while removing serial CI bottlenecks

Cloudflare continues to watch `main`, build through its existing Git integration,
and run `npm run deploy:cloudflare`. The exact-main three-workflow guard, its
17 × 45-second wait, required check names, package ceilings and production
configuration are unchanged. No hook, credential, release branch or manual
Wrangler deployment is part of this implementation.

The successful main run at `a5ac07a1` measured 43m25 for Boardworld: 24m37 in
unit tests, 13m16 in the three consecutive LW2 browser scripts and the remaining
time in build/other browsers. General CI also serialized the whole Gold file
on one worker (21m59), while its nested Social Engine wrapper competed with
other CPU-intensive files (16m14 for that wrapper). TC ran its independent
browser families consecutively for a 12m12 job. These are measured GitHub
runner times, not estimates from a developer workstation.

The correction distributes independent work while preserving its acceptance:

- Four cost-balanced unit workers execute every selected file. Gold's 19 lives
  and Emergent's six annual lives are independent catalog entries, with their
  existing assertion bodies, seeds, durations and public-action replays intact.
  The focused Emergent cases run once. Local unfiltered `node --test` continues
  to register the complete suites.
- Each worker runs at most two child processes. General CI runs the unchanged
  nested Social Engine wrapper on its own worker and caps browser fan-out at
  four. It does not edit any Social Engine implementation or test wrapper.
- Boardworld builds once. Independent regression and continuous-generation
  browser workers consume the same workflow's sealed artifact, check its exact
  commit and all file hashes before execution, and recheck hashes afterward.
  Every pre-existing browser command, including all 20 stale-cache races,
  remains mandatory. TC similarly reuses one exact artifact across its three
  independent browser groups.
- The generation harness removes repeated full-state IPC and redundant tab
  selection, while retaining ordinary visible clicks, durable-save/revision
  waits, every action trace, reload, milestone, natural death and heir assertion.
  It does not inject state, advance time outside UI actions or force clicks.

`boardworld`, `build` and `TC job-start / built` remain the protected check
contexts. Their unconditional final gates reject failed, cancelled, skipped,
missing or malformed dependencies. Unit receipts are SHA-bound; coverage
rejects missing/duplicate/unexpected workloads, zero executed tests and failed
or cancelled cases. The 730 original successful Boardworld test names are
frozen from main job `132554020668` in `scripts/boardworld-ci-baseline.json` and
must each actually pass once. New tests cannot compensate for an omitted old
test. Merged endurance evidence requires exactly 19 Gold and six Emergent
lives, matching runtime/controller/harness fingerprints and no duplicates.

Focused gate, partition, artifact and command-parity tests pass locally. An
82-action browser profile measured about 37% less harness overhead; 390 real
actions exactly matched the verified full journey before local host suspension
interrupted the run. That partial result is not a full generation pass or proof
of hosted timing. The complete protected PR checks, exact-main checks, automatic
Cloudflare Git build and both production origins must pass before this CI
correction is reported as verified. Queue delays and genuine test/provider
failures still fail closed; no successful deployment is inferred from a build
starting or from a local timing estimate.
