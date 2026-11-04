# SOCIAL ENGINE — development candidate

An integrated, original Kıyıyaka browser game: isometric exploration, 100 local identities and 1,000 background citizens, careers, double-entry money transfers, relationships, housing, courses, causal missions, driving, combat, evidence-based police consequences and isolated IndexedDB saves.

**Status: development checkpoint, not Gold and not ready to merge. Production is explicitly locked by the user.** The original four specifications and all60 acceptance criteria remain unchanged. Additional contract obligations are being audited and implemented; passing a subset of tests does not waive them. Two separate human30-minute sessions and the specified reference-PC performance evidence are still required.

## Run and verify

Use the repository lockfile with Node22 or newer:

```sh
npm ci
node scripts/social-engine/build.mjs
node scripts/social-engine/serve.mjs
```

The isolated static preview is `http://127.0.0.1:8097/oyna/social-engine`. This wrapper tests the game, not TanStack integration. For the actual route, build with `VITE_SOCIAL_ENGINE_PREVIEW=1 VITE_PREVIEW_MODE=1 npm run build`, then run the generated Cloudflare worker locally on a separate port. The default production route remains disabled.

```sh
node scripts/social-engine/verify-unit.mjs
node --test scripts/social-engine-*.test.mjs
node --experimental-strip-types scripts/social-engine/simulate-365.mjs
node --experimental-strip-types scripts/social-engine/browser.mjs
SE_BROWSER=firefox node --experimental-strip-types scripts/social-engine/browser.mjs
SE_BROWSER=webkit node --experimental-strip-types scripts/social-engine/browser.mjs
node scripts/social-engine/persistence-browser.mjs
node scripts/social-engine/ui-browser.mjs
```

Browser binaries must be installed with Playwright; macOS uses installed Chrome by default. Override `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` and `PLAYWRIGHT_BROWSERS_PATH` as appropriate. Automated QA may use `?qa=1` to send validated commands and advance fixed ticks; this is recorded separately from unaccelerated human play.

## Ownership and evidence

Only `feature/social-engine-development` is owned by this task. See `ISOLATION.md`. Existing game source files and their save namespaces remain untouched. Common integration is the explicit new route, generated route registration, and two narrowly scoped ESLint excludes for this game's generated output/captured evidence. All authored Social Engine source and tests remain linted.

The independent Social Engine workflow adds no deployment credentials, merge action, production traffic change, or cancellation of another branch's CI. The shared catalogue and sync-ledger edits are held for a separate integration step because the parallel Boardworld agent owns edits there.

Evidence lives under `artifacts/social-engine/`; large traces/videos remain local or CI artifacts. `results.json` is the unabridged acceptance matrix. Evidence before a source revision is historical, not automatically proof of a later revision. `LIFECYCLE.md` describes mechanisms and limitations. `RECORDS_AND_JOURNAL.md` is the current schema5 contract and supersedes the older schema4 README beside the persistence source. `PLAYER_GUIDE.md` describes the playable controls and choices. `node scripts/social-engine/reconcile-acceptance.mjs` rebuilds the matrix from current source/asset evidence and the unchanged original catalogue. Original art provenance is in `ASSET_LICENSES.md`.

## Recovery and release lock

Manual slots1–3 and autosave use only IndexedDB `tariklab-social-engine`. Import rejects unknown future schemas, migration preserves original revision bytes, and checksum failure falls back to the prior valid revision. Export saves before switching development candidates.

Do not merge or deploy production. After mandatory implementation and evidence are complete, reconcile current main and shared files without overwriting the other agent, verify CI and an immutable preview, confirm the other agent's release is complete, and obtain explicit user approval. Only then may a separately authorized production promotion occur. Until then rollback means reverting the isolated preview or serving the prior immutable preview; no production state was changed.
