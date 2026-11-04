# SOCIAL ENGINE performance evidence

No release performance gate is inferred from a build, a screenshot, or a short smoke. Evidence below records the actual measured candidate, hardware and duration. The specified four-core reference PC and two real human playtests remain unverified.

## Thirty-minute development baseline

Evidence: `artifacts/social-engine/performance/2026-11-03T17-32-07-826Z/report.json`, compressed per-minute samples, captured build/source manifests, and `harness-and-build-verification.json`.

- Actual duration: 30.0038 minutes; 107,987 independent requestAnimationFrame intervals.
- Engine: `1.0.0-candidate.1`; build manifest SHA-256 `e256e39b1603ec746024536721f235c965258172dd081de4a18a4e6115172da8`.
- Host: Apple M2, eight logical CPUs, 16 GiB RAM, macOS, native Chrome 156, 1920×1080, DPR 1, headless. CDP identifies ANGLE Metal / Apple M2; software SwiftShader was not forced.
- Frame intervals: p50 16.70 ms; p95 16.70 ms; p99 16.80 ms.
- Main-thread long-task duration / observed duration: 0.0000316623 (0.00317%).
- Main-page JavaScript heap after forced GC: linear slope 0.07191 MiB/min.
- Persistent population: 100 local + 1,000 background NPCs; zero recorded browser errors.
- The scenario issued ordinary movement, shopping, dialogue, work, vehicle and rest commands in real time. It did not use the QA tick-step command or edit authoritative state.

This older candidate was stopped after preserving its complete thirty-minute checkpoint to avoid simultaneous GPU contention. The originally configured 120-minute target was **not completed**; report status is `STOPPED_EARLY`. This is baseline evidence, not a result for a later candidate. Main-page heap excludes the simulation worker and GPU/process memory. Global worker CPU samples in this older collector were taken at one-second intervals, so they are not a complete tick-cost distribution. Legacy regression and development jobs overlapped portions of this run.

## Current collector

`scripts/social-engine/performance.mjs` captures its own source, exact source and build manifests, loaded response-body SHA-256 hashes, hardware metadata, and minute-by-minute raw samples. It runs the actual 10 Hz worker clock and writes durable 30-, 60- and 120-minute checkpoints. It separately collects main-page and simulation-worker JavaScript heaps before/after CDP GC, actual worker tick-cost samples, render-preparation samples and independent frame intervals. Command roundtrip is explicitly labelled as command latency; it is not presented as IPC transport time.

GPU memory, total browser process memory, reference-PC results and human playability remain unverified. Current projections instrument actual cross-isolate IPC delivery separately. Native200%browser zoom and real tab visibility are tested by the separate native-browser harness. A stopped run retains its measured elapsed time and never becomes a completed two-hour soak. The collector leaves acceptance statuses unverified; the acceptance audit must compare the original criteria with the completed, correctly attributed evidence.

## Renderer choice

A same-scene, same-100-sprite Canvas2D/Pixi benchmark was executed before selection. Both measured p95 frame intervals of 17.40 ms; Canvas2D submission CPU p95 was 0.10 ms and Pixi 0.20 ms. This does not demonstrate a Pixi speed advantage. Pixi was selected for the existing repository dependency, sprite batching, atlas texture management, depth ordering and scene lifecycle. The benchmark's bundled gzip size was 170,930 bytes, not the final complete game payload.

Renderer CPU preparation excludes GPU execution. Short renderer/context-loss smoke results validate restoration and basic drawing only; they do not satisfy thirty-minute performance, two-hour memory or human-playtest criteria.

## Reproduction

With the independently built candidate served locally, run `SE_BASE=http://127.0.0.1:8097 SE_PERF_MINUTES=120 node scripts/social-engine/performance.mjs`. Chrome defaults to the installed macOS executable; set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` on another host. Keep the runtime source/build immutable, record competing work, and review the exact manifest and engine version before using the results. Raw measurements and checkpoints are written under `artifacts/social-engine/performance/<run-id>/`.

## Candidate 4 — scope and continuity correction

The current frozen game is manifest fbe14c6260d3e7796eafe0fd4b944a52abf49ebadff4bfcc5aad4d2c7fa50027. The 21:24 UTC run’s first 30 minutes were continuous (107,671 frame intervals, p95 16.70 ms). Its six later gaps prevent a 60- or 120-minute conclusion. See the raw run, continuity-audit.json and ADR-022. OS-level Chrome process footprint samples 661–766 MiB exceeded the device-dependent 600 MiB target. Hardware reference and dedicated GPU allocation remain unverified. New collectors validate sustained fixed-tick progress in addition to elapsed time.

Do not run native-browser.mjs on the user’s display. For local automation use the standalone chromium-headless-shell executable; the native-window checks belong on an independently authorized QA host.
