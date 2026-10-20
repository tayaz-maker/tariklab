# Root offline completion — 2026-10-21

Implemented on `codex/root-offline-quality-2026-10-21`, based on `007ce1e310e6ce8feee49154fae18769d03928b6` plus the saved audit `ef8a19767172e096eb5fb30e1674d43208bcc357`. The parent integrates this narrow fix onto its verified current main; this older base is not a production-release target.

## Confirmed defects and resulting behavior

Fresh browser contexts visiting Racon or Peg previously had no root service-worker registration; actual offline wrapper reload failed with `ERR_INTERNET_DISCONNECTED` (saved prior audit evidence, not repeated).

The existing guarded `/sw.js` registration now runs through an invisible root lifecycle component and is shared with Çete's existing OfflineReady. Çete alone retains its install prompt and game-panel prefetch. No service worker, install UI, eager game prefetch or save format was added.

The real built Cloudflare preview exposed a second defect: `/games/racon/index.html` redirects to `/games/racon/`. Offline the original index URL could miss the cached canonical document and receive the portal fallback, producing the portal's 404 page inside the iframe. The existing network-first cache now stores redirected navigation bodies without redirect history and, for an offline `/games/*/index.html` miss, checks only the matching canonical directory URL with its original query. Successful fresh network responses remain usable if cache persistence fails. Cache names, deletion rules, network-first/stale policies, retired-product guards and the Hanedanian independent atomic package are unchanged.

## Executed evidence

- **PASS** final source game matrix: Racon/Peg × TR/EN/PL ×1280/390, 12/12 fresh contexts. A real built root shell serves unmodified source game/i18n files through the test proxy; the development PROD guard was not weakened.
- **PASS** final built matrix: same 12/12 cases against the actual compiled Cloudflare Worker through the existing `ci-built-preview.mjs`. The exported CI helper started and stopped its own production preview successfully.
- Each case separately checks fresh automatic root registration without a prior Çete/Hanedanian visit, no Çete install UI, warm wrapper/game/locale cache readiness, actual offline root wrapper reload HTTP200, a real loaded iframe, unchanged selected-language menu, unchanged local storage and an unrelated cache sentinel, and real offline gameplay. Racon creates and resumes a genuine save; Peg retains its existing best-score record and makes a valid offline jump. Peg active-board persistence is not claimed.
- Browser console and uncaught errors: zero. Root and iframe horizontal overflow: zero. Source and built desktop/mobile screenshots visually inspected.
- **PASS** 12 targeted service-worker tests: redirected response body/header/status preservation, exact query-preserving canonical cache lookup, unrelated fallback retention, successful network response despite cache-write failure, existing build manifest injection, retired-product preservation and TC cache contracts.
- **PASS** `npm run build`, `npm run typecheck`, scoped ESLint and `git diff --check`.
- **PASS** source/build equality for the unchanged Racon entry, Peg entry and Peg runtime; generated built SW contains the intended canonical-navigation fix.

The source/built locale comparison verifies retention of existing presentation, not a new global translation rewrite. Physical-device testing remains separate.

## Durable regression and release ownership

`scripts/root-offline-registration-browser.mjs` exports `rootOfflineRegistrationBrowser` for a running candidate and `rootOfflineRegistrationCI` for the existing compiled Worker. The latter is imported at the end of `scripts/sitewide-responsive.mjs`, so the current responsive CI command also exercises production-only registration. It writes artifacts under the existing screenshots directory; no workflow file or guard was changed. `ROOT_OFFLINE_PORT` optionally overrides its default isolated port8106.

Reproduce directly:

```sh
node scripts/root-offline-registration-browser.mjs --base-url http://127.0.0.1:8098 --out ../offline-quality-built
node scripts/root-offline-registration-browser.mjs --base-url http://127.0.0.1:8098 --source-public public --out ../offline-quality-source
```

Use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` when supplying local Chrome. Task evidence: `work/offline-quality-source-final/results.json`, `work/offline-quality-built-final/results.json`, their twelve screenshots each, `work/offline-quality-built-before.log`, and `work/offline-quality-{build,typecheck,lint,sw-regression}.log`.

No PR/push/merge/deployment was performed by this subtask. Parent owns current-main integration, WEB_APP_SYNC_LEDGER, required CI, exact built-byte gates and final two-host Cloudflare acceptance. Candidate preview8098 remains available for the parallel master harness; no further builds will alter its accepted bytes during that check.
