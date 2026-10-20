# Wave 1 — decision repair development checkpoint

Base: `a31c85940f1fa5e54b68ca4887dfdc5631a072ff` (JITEM #206 merged). Branch: `astra/wave1-decision-repair-20261020`. Independent companion: `astra/wave1-save-repair-20261020`.

## Exact runtime scope

- `public/games/next-wave/devlet-sim.js`: `tickDevlet` uses `actual.treasury ?? 50`, preserving a legitimate zero. Move terminal guard before hydration; guard direct `applyPolicy`. No economic coefficients, other numeric fallback behavior, DNA, balance or content changed.
- `public/games/next-wave.js`: block current-run DEVLET actions before settlement after campaign end; retain explicit new scenario choices. For Kapı Nöbeti, prefer the focused open issue's system, retain the existing first-open fallback, use that system consistently for closure/cheap repair and delayed investment. Only unmarked/open follow-ups consume their due effect; existing due/closed records do not repay it after reload.
- `public/games/next-wave/devlet-content.js`: guard direct content choice and settlement after final.
- `public/games/tc-sim-devlet/presentation.js`: final dossier choices are disabled; dossier remains visible.
- New tests: `scripts/wave1-decision-repair.test.mjs`, `scripts/wave1-decision-browser.mjs`.

Four runtime files, **16 additions / 7 deletions**. No `devlet-depth.js` change. Save keys, schema versions, UI structure, existing content and game identity retained. This is the separate DEVLET game, not the completed TC SIM release.

## Acceptance evidence

- Final scoped regression file on unchanged baseline: **13 FAIL + 2 positive controls**; repaired source: **15/15 PASS**. Natural spending exhausts treasury; natural 48-turn final has an active dossier; direct APIs and dispatch remain byte-identical after terminal actions/reload. Positive economy and closing-month settlement remain unchanged.
- Final targeted existing/new suite: **159/159 PASS**, zero skipped (command below).
- Lint/typecheck and clean canonical build: **PASS**, zero lint errors; existing unrelated warnings remain.
- Source Chromium: **42/42 PASS** (7 behaviors × TR/EN/PL × 390/1280). Treasury, natural final, focused water/roof × cheap/durable repairs, and once-only follow-up versus a control at weeks 2/3/4 after repeated reloads.
- Clean-built Chromium: **42/42 PASS**, with identical start/end SHA-256 manifests for all five served modules matching current source. Results: `/workspace/screenshots/wave1-decision/built-final/results.json`; the earlier mixed/stale build run is not acceptance evidence.
- No console/runtime errors or horizontal overflow in passing cells. Representative desktop/mobile screenshots inspected. Existing locale fallback retained; this is not full translation certification.
- Canonical SSR built preview remains a separate gate: local Cloudflare preview lacks Wrangler. Static built game tests do not certify production deployment.

```sh
node --test scripts/wave1-decision-repair.test.mjs scripts/devlet*.test.mjs scripts/wave5-tc-sim-devlet*.test.mjs scripts/racon-apartman-content.test.mjs scripts/next-wave*.test.mjs
npm run lint
npm run typecheck
env -u DATABASE_URL -u GROK_STRICT_MIGRATE npm run build
node scripts/wave1-decision-browser.mjs --serve public --label source
node scripts/wave1-decision-browser.mjs --serve .output/public --label built-final
```

For a fresh build, move the old generated `.output` aside first: this Nitro configuration can retain old public assets. Browser runner accepts `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` and `WAVE1_BASE` for an actual server. Evidence logs are outside the checkout under `wave1-evidence/`: `decision-before-corrected.log`, `decision-after.log`, `decision-targeted-final.log`, `decision-browser-source.log`, `decision-browser-built-final.log`.

## Integration / release / rollback

No changed-file overlap with Sol's #206 or old #131/#112. No JITEM/İHTİLÂL/Racon, TC SIM completed release, shared ledger, dependency or route changes. Main was fast-forwarded from `cfa6d8c` to `a31c859` without conflict. Both Wave 1 branches are independent.

Final capacity check: #207 (Sol's IHTILAL archive, head `7dac1eb6acc807389e0f56ff5adaaa3f045d963d`), #131 and #112 are open. #207's 23 changed files have no exact path overlap, but change shared i18n/portal dependencies. Both Wave 1 branches therefore remain queued with no new PR; leave existing PRs untouched. Open save repair first when a slot is free, then this independent branch when capacity permits. Sol owns release. Reconcile with current main, recheck shared browser behavior and require exact-head CI before merge; no merge/deploy is included in this checkpoint.

Rollback via targeted revert with no save migration/deletion. Retain consumed due/closed status meaning so rollback does not reapply historic penalties; retain terminal guards and zero-safe treasury reading when reverting unrelated changes. Existing saves remain valid v1/v2.
