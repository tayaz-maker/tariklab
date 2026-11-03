# Boardworld 6 paired persistence benchmark

This comparison isolates the save format on the same six authentic released
Boardworld 5 states after 365 complete days (displayed day366). It does not compare
different simulated histories or substitute for the new v6 endurance matrix.

The baseline module graph is extracted from the exact released commit
`78ec4ee339051840037e48e80f4b07518d5a1424` and every archived game source is checked
against `scripts/fixtures/boardworld/v5-provenance.json`. Each v6 state differs from
its v5 source only in `version: 6`. The benchmark asserts exact original-state
immutability, lossless migration, and exact export/import round-trips. It uses the
canonical released writer output on both sides, excluding the fixture file's one
trailing newline.

## Reproduction

Run the deterministic byte/integrity checks while other verification is active:

```sh
node scripts/boardworld-v6-save-benchmark.mjs --check --out /tmp/boardworld6-save-bytes.json
```

Run timing separately on an otherwise idle machine:

```sh
node --expose-gc scripts/boardworld-v6-save-benchmark.mjs --out /tmp/boardworld6-save-paired.json
```

The timed mode performs three repeats of ten exports and ten imports per version
and state, with three warmups, alternating version order, and explicit GC before
each batch. Deep equality assertions and gzip encoding stay outside timed
intervals. The JSON records all three trial summaries, aggregate median/p95,
source hashes, runtime dirty status, Node/OS/CPU and before/after system load.
The UTF16 payload size excludes storage keys and browser-specific overhead.

## Verified byte comparison

| Strategy / seed      | v5 UTF8 bytes | v6 UTF8 bytes |    Reduction | v5 gzip9 bytes | v6 gzip9 bytes |
| -------------------- | ------------: | ------------: | -----------: | -------------: | -------------: |
| Career / 2026        |       417,004 |       288,471 |       30.82% |         33,315 |         32,108 |
| Career / 91373       |       418,796 |       289,865 |       30.79% |         33,308 |         32,205 |
| Social / 2026        |       433,285 |       303,264 |       30.01% |         34,949 |         33,875 |
| Social / 91373       |       434,998 |       304,168 |       30.08% |         35,109 |         34,014 |
| Entrepreneur / 2026  |       401,114 |       278,229 |       30.64% |         31,317 |         30,512 |
| Entrepreneur / 91373 |       402,093 |       278,902 |       30.64% |         31,290 |         30,633 |
| **Total**            | **2,507,290** | **1,742,899** | **30.4867%** |    **199,288** |    **193,347** |

All six states preserve the complete stored history, ledger, identity, commitments
and RNG. No records are removed to achieve this reduction. Gzip's aggregate
reduction is 2.9811%; it already compresses much of the repeated prose. These gzip
values describe save-file compression, not first-load game assets or network
transfer. Browser localStorage writes use the compact JSON, not gzip.

## Three-repeat timing result

Measured at `2026-11-02T07:20:24.753Z` on Apple M2, arm64, macOS Darwin 25.6.0,
Node v24.21.0, with explicit GC. The locally launched correctness suites and the
auditor's final matrix had finished. Before/after OS load is retained in the
[complete trial artifact](benchmarks/v6-save-paired.json). Runtime files were clean
at source commit `9f479370c936f977fd3b57dcf206f5d9392b861d`; their exact hashes are
also retained. Each cell below is **median / p95 milliseconds**, over 30 samples
(three repeats of ten).

| State                |   v5 export |   v6 export |   v5 import |    v6 import |
| -------------------- | ----------: | ----------: | ----------: | -----------: |
| Career / 2026        | 4.90 / 5.99 | 5.54 / 9.43 | 4.44 / 5.57 | 7.19 / 12.68 |
| Career / 91373       | 4.57 / 5.98 | 5.22 / 9.42 | 4.08 / 5.41 | 6.88 / 12.82 |
| Social / 2026        | 4.74 / 6.16 | 5.20 / 9.68 | 4.22 / 5.59 | 7.08 / 12.81 |
| Social / 91373       | 4.93 / 6.29 | 5.43 / 9.69 | 4.35 / 5.71 | 7.09 / 12.22 |
| Entrepreneur / 2026  | 4.63 / 6.18 | 5.39 / 9.36 | 4.06 / 5.67 | 6.68 / 12.30 |
| Entrepreneur / 91373 | 4.44 / 5.89 | 4.88 / 9.17 | 4.02 / 5.43 |  6.36 / 9.40 |

The smaller format has a measured CPU cost: median export adds 0.44–0.76 ms and
median import adds 2.35–2.86 ms on these paired states. This is an explicit storage
versus decoding tradeoff. Browser interaction p95, first-load network transfer,
and actual newly simulated v6 save growth remain separate acceptance measurements.
Correctness-run wall time includes desktop suspension and is not used here as
performance evidence. No latency improvement is claimed from byte reduction alone.
