# Root offline registration — saved audit, 2026-10-21

User requested save/merge/report before further development. This checkpoint saves a confirmed defect; **no production fix has been implemented**.

- Audit branch: `codex/root-offline-quality-2026-10-21`.
- Baseline canonical source/build: `007ce1e310e6ce8feee49154fae18769d03928b6`.
- Read-only baseline build server: `http://127.0.0.1:8093`, owned by the parallel catalogue audit.
- Browser: installed Google Chrome, Playwright, a separate new context per game. No manual service-worker registration, no visit to Çete or Hanedanian before the measurement.

## Confirmed results

| Fresh wrapper visit | Root worker after rendered game + bounded 5-second controller wait | Actual offline wrapper reload |
|---|---|---|
| `/oyna/racon` | **FAIL** — registrations `[]`, no controller | **FAIL** — `net::ERR_INTERNET_DISCONNECTED` |
| `/oyna/peg-solitaire` | **FAIL** — registrations `[]`, no controller | **FAIL** — `net::ERR_INTERNET_DISCONNECTED` |

The child frame source was respectively `/games/racon/index.html` and `/games/peg-solitaire/index.html`. It had rendered more than 50 text characters before the controller measurement. These failures are separate from the master acceptance harness's stale/about:blank frame-binding bug.

Exact baseline output:

```json
{"slug":"racon","ready":false,"registrations":[],"frame":"/games/racon/index.html","offlineError":"page.reload: net::ERR_INTERNET_DISCONNECTED"}
{"slug":"peg-solitaire","ready":false,"registrations":[],"frame":"/games/peg-solitaire/index.html","offlineError":"page.reload: net::ERR_INTERNET_DISCONNECTED"}
```

## Source diagnosis

- `src/components/game/offline-ready.tsx` registers the existing `/sw.js` only after the Çete game mounts; `src/components/game/game-app.tsx` is its sole importer.
- `src/routes/__root.tsx` does not register the root worker. `/oyna/$slug` wrappers do not mount OfflineReady.
- `public/games/hanedanian/app.js` separately registers `/sw.js` and its own scoped worker. Visiting Hanedanian first can therefore mask the missing root registration on later games in that context.
- The existing root worker already owns navigation/runtime caching. Its policies, cache names, user saves and artwork were not modified by this audit.

## Pending narrow fix and acceptance

**PENDING**: extract/share the existing guarded root-worker registration with an invisible root lifecycle component; preserve the Çete install hint and game-chunk prefetch only on Çete. Do not introduce another worker or eagerly preload games. Confirm fresh-context Racon and a classic wrapper offline reload, restored visible language/game content, and unchanged saves/cache sentinels against a real built server. Keep all release guards.

**PENDING separate Hanedanian dependency diagnosis**: its scoped worker handles only its package FILES. Requests it does not intercept go to the network; a root worker's cache does not automatically act as a second service-worker fallback for an iframe controlled by the more specific Hanedanian worker. Therefore adding Polish runtime only to root SHELL may not fix missing `/i18n/pl-body.js` or the game's Polish dictionary under offline scoped control. Verify the existing package dependency closure before changing it. No Hanedanian source was edited here.

Local evidence: task workspace `work/offline-quality-baseline.log`; original audit harness saved as `work/offline-quality-baseline-scratch.mjs`. No new test/build/CI/deployment is running for this checkpoint. The independent TC localization fix is committed separately as `aa8f4a8a2cb70bae7804d02939d51b5f3034df4b`.
