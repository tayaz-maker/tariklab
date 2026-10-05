# HANEDANIAN canonical-HTML offline repair

2026-10-05; release blocker after #110 merge `562831dba3b16be2a0bc8b2aec2e613eb1b80f45`.

- Main run `37246439763`, job `111565191391`: www Wave1 9/9 passed; Workers failed on the first HANEDANIAN1440 reload with `net::ERR_FAILED` at `scripts/wave1-outcome-browser.mjs:82`. Artifact `11319313487` retains the exact failure. This was not a 25-minute timeout.
- A read-only HTTP check at 00:31:09Z confirmed Workers `/games/hanedanian/index.html` returns307 with `Location: /games/hanedanian/`.
- The old worker stored the followed HTML Response unchanged. Its redirect URL list remains attached in CacheStorage; the Fetch Standard's service-worker response checks reject that response when navigation's redirect mode is not follow. Reference: https://fetch.spec.whatwg.org/#http-fetch (accessed2026-10-05).
- Narrow repair: only redirected HTML is reconstructed before the atomic cache write. Body stream, status, status text and headers are preserved. Nonredirected HTML and all non-HTML responses retain their metadata. No request is skipped or retried; no save, engine, content, renderer or dependency changes.
- Native local HTTP regression first failed on the old worker, then passed. It checks a real followed redirect, non-ASCII/binary body bytes, status203/custom status text, all headers and non-HTML/native response preservation. Offline/version tests17/17, targeted ESLint, typecheck and production build passed.
- `hanedanian-redirect` CI serves only its own local HTTP fixture. The immutable old worker must reproduce a real reload failure; the fixed built worker must reload online and offline, retain an actual queued construction save and preserve the exact HTML hash/header. Diagnostic JSON, screenshots and Playwright traces are uploaded. No external production URL or Cloud Browser workaround is used by this fixture.
- Browser regression and fresh required CI are pending at PR creation. No production PASS is claimed. #111 stays blocked until this release repair and two-host proof close.
- Package version changes automatically through the existing build hash. Existing sessions keep their complete old package until game clients close; no forced activation, cache-wide wipe or user-save deletion is introduced. A full old-cache migration matrix remains part of the later final360 review.

First local browser fixture run `37248296093` / job `111570511270` failed before the baseline navigation assertion: scoped worker activation was not observed within30s. Artifact `11320175343` contains a trace, but no install error was recorded. This is not proof that the proposed repair works. One telemetry-only follow-up records worker lifecycle/errors, HTTP completion and bounded failure cache/controller snapshots; all assertions/timeouts and product code remain unchanged. If that second fixture attempt fails, preserve the repro/options checkpoint instead of guessing another patch.

## Renewed, controlled transport experiment

The second run `37248756789` / job `111571847240` also stopped before reload. Its snapshot shows the HAN worker still installing, no HAN package cache, and an activated root worker. The first three package fetches reached the local server and its responses finished; the remaining package requests did not reach it. Server completion does not establish browser body consumption. No worker exception was captured. Neither browser baseline-negative nor patched-positive behavior has been proved by these two runs.

The user subsequently authorized another measured release-fix experiment. Only the local fixture transport changes: textual responses use real gzip when `Accept-Encoding` permits it, with the encoded `Content-Length` and `Vary: Accept-Encoding`. Baseline and patched workers receive the same transport policy. The source bytes, workers, 30-second installation bound, redirect, exact cached HTML hash, expected baseline error, online/offline reload and actual save assertions remain unchanged. The header-only `Promise.all` installation pattern and response backpressure are a hypothesis, not an established cause; a passing gzip run alone would not establish causality.

Every server request records accepted encodings, response headers, decoded/encoded byte lengths and SHA-256 values, plus completion/abort state. Headers are set with `setHeader` so the recorded values reflect the actual response. The root `/` and `/cete-savaslari` 404 deviation is deliberately retained and labelled in the report: the static build has no SSR portal index. No empty substitute shell is invented, and changing a second experimental variable would prevent a narrow transport comparison. This local experiment is not a complete production-server parity test.

The transport helper has native local HTTP tests that read raw wire bytes rather than an automatically decoded fetch response. Run the controlled check once after a fresh build:

```sh
node --test scripts/hanedanian-redirect-transport.test.mjs scripts/hanedanian-offline.test.mjs scripts/offline-sw-plugin.test.mjs
npm run build
node scripts/hanedanian-redirect-browser.mjs
```

Browser acceptance remains pending. No production code, lifecycle rule, assertion, timeout, save schema or dependency changes are part of this experiment.

## A1: finish each download before the package barrier

Gzip run `37253284481` also stalled before reload with the HAN worker installing and no HAN cache. Its artifact `11321516836` confirms real gzip for HTML/CSS/JavaScript, but the same first three package requests were the only ones observed. Gzip did not resolve the local setup failure; no further compression experiment is proposed.

Under renewed A1 authorization, the next change drains `response.clone().arrayBuffer()` inside each download task, before the outer `Promise.all` completes. Fetch resolving at headers is insufficient to establish that a response body has finished. Draining a clone lets a body-limited request pool advance while leaving the original native response cacheable, including its URL/type and non-HTML redirect metadata. The existing HTML-only redirect normalization remains separate. CacheStorage is still opened for the new package only after every body and MIME/status check succeeds; an error while reading a body must leave an existing complete package untouched. No save store, activation policy or cleanup scope changes.

A controlled unit regression models three outstanding downloads, releasing a permit only when a native multi-chunk `ReadableStream` reaches EOF. It must show the unchanged worker stalls, while the patched worker completes all 19 assets without an early cache write. A separate late-body failure checks the existing package is preserved. This model tests the code's behavior under the measured condition; it is not a claim that every Chromium build uses exactly three permits.

The regression was run before editing the worker: 14 existing offline tests passed and both new body tests failed on the bounded stall. With the one-line drain added, the offline/version/transport group passes **23/23**, including native redirected HTML bytes/status/headers and non-HTML URL/type preservation. The unit deadline allows two seconds for loaded CI workers; no browser timeout is extended. This is unit evidence only, not a browser or production PASS.

Primary context: Chromium's [install-throttling browser tests](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/content/browser/service_worker/service_worker_browsertest.cc) explicitly exercise `ThrottleInstalling` and `ThrottleInstallingWithCacheAddAll`, configuring a two-request test limit. The [2020 worker-dev discussion](https://groups.google.com/a/chromium.org/g/worker-dev/c/y8b7V1waNK4) describes a three-request issue and a temporary feature disablement; it does not establish today's default. These sources support investigating throttling, while the local browser result remains the acceptance gate.

Payload budget measured from the exact 19 current package files: **400,445 bytes** decoded in total; largest file **89,147 bytes**. Cloning can buffer the original branch while the temporary array buffer is consumed, so this adds package-sized transient data. Two payload-sized copies would be 800,890 bytes (about 782 KiB), excluding browser/stream/cache overhead; actual peak memory is not measured and this is not a heap ceiling. This deliberately bounded package contains no remote or dynamically enumerated asset set. Browser and production closure remain pending.

The browser repro now isolates the redirect defect by reducing only the archived worker's `FILES` declaration to the single real HTML response. Its original fetch handler is unchanged. It must cache a redirected response with the exact HTML bytes, then fail an actual reload with `net::ERR_FAILED`. This is explicitly a minimized baseline, not a passing full old install. The candidate must still install all 19 assets, reload online and offline, and retain the real construction save. Existing browser deadlines and failure assertions are unchanged.

`hanedanian-release-smoke.mjs` requires the exact built SW SHA-256 before testing three fresh browser contexts (1440/390/320). It records a real farm command/manual save/export and two reloads, preserved queue/seed/paused clock, complete 19-file cache, normalized HTML, zero console/page/network/HTTP errors and zero horizontal overflow, with screenshots and traces. Vercel's direct `index.html` HTTP200 and Workers' canonical directory redirect are both legitimate: the observed initial URL must remain stable across reloads. No production save is cleared. The PR workflow checks the Workers candidate; main checks both public production hosts after normal gated merge. A provider preview is never labelled production evidence. Vercel preview authentication remains enabled.
