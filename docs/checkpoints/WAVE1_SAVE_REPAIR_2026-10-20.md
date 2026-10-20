# Wave 1 — save repair development checkpoint

Base: `a31c85940f1fa5e54b68ca4887dfdc5631a072ff` (JITEM #206 merged). Branch: `astra/wave1-save-repair-20261020`. Independent companion: `astra/wave1-decision-repair-20261020`.

## Changes and fail-first evidence

| Game | Root cause and minimal repair | Before → after |
|---|---|---|
| SON KÖY | `sim.js` rejected legitimate event/seen histories after 45 entries. Both limits now use the existing event catalog size; all existing event validation remains. | 5 failing new tests → 5 passing; balanced/rural/industry 24-month campaigns retain 76/79/73 events and roundtrip after every action/month. Existing v1/v2 long saves retained. |
| SON 100 GÜN | `pov-app.js` swallowed storage errors and rendered the current day as last saved. Write/delete return real results; last successful day, failure and storage-only retry are shown in TR/EN/PL. Replay format unchanged. | Combined Son100/Phone tests: 18 failures + 4 controls → 22 passes. Quota/security failures, first save, later save, retry without another decision, delete failure covered. |
| KAYIP TELEFON | Unknown/locked `ui.app` reached the renderer unchecked. `ensurePhoneState` normalizes recoverable app/tab/link pointers while preserving case progress. Unrecoverable saves remain rejected and their raw bytes remain stored. | v1/v2 progress, discovered items, links, pins and endings preserved; actual renderer no longer throws. |
| AMİRAL BATTI | `resume` trusted version/phase without nested validation. Pure v1 `validateMatch` guards fleet/shot/log/phase consistency. Invalid/hotseat data is retained until explicit New CPU game. Hotseat is disabled with localized explanation; three CPU difficulties retained. | 18 failures + 5 controls → 24 new passes; 9 existing engine tests pass. Every saved half-turn in 9 complete CPU games validates without mutation. Browser also proved and fixed hidden placement controls overridden by `.toolbar`. |
| SON MAHALLE BÜKÜCÜ | QA seeded `smb.v1` after legacy migration had already completed, and optional Continue hid missing fixtures. QA now seeds real slot 1 + active slot and asserts actual loading; first-boot migration remains a separate test. | 4 failures → 4 passes. Chromium exposed two additional obsolete test fixtures: saved RNG replaces Math.random stubs; the exact two-sided balance row replaces old text. Assertions strengthened; game runtime unchanged. |

Runtime files: `public/games/son-kasaba/sim.js`, `public/games/son-100-gun/pov-app.js`, `public/games/next-wave/kayip-deduction.js`, `public/games/amiral-batti/{index.html,js/app.js,js/engine.js}`. Test files: `scripts/bukucu-qa.mjs`, `scripts/wave1-{town-save,pov-phone-save,amiral-save,bukucu-fixture}.test.mjs`, `scripts/wave1-save-browser.mjs`.

## Verified gates

- Targeted Node suite: **101/101 PASS**, zero skipped. Command below.
- Full lint: **PASS**, zero errors; pre-existing repository warnings remain. Typecheck: **PASS**. Clean canonical Cloudflare build: **PASS**; no database connection/migration attempted.
- Real Chromium **153.0.8010.0**: four repaired games × TR/EN/PL × 390/1280 = **24/24 source + 24/24 clean-built PASS**. Visible actions, storage failure/retry, retained corrupt bytes, CPU reload, zero console/runtime errors, zero horizontal overflow. Desktop/mobile screenshots inspected.
- Bükücü source and built: existing complete scenario suite plus CPU/hot/hot3/hot4 **4/4 campaigns finished per environment**; **6/6 locale/viewport purchase/save/reload cases per environment**.
- Actual npm-dev portal wrappers `/oyna/son-koy-manager`, `/oyna/son-100-gun`, `/oyna/kayip-telefon`: **18/18 PASS** for visible iframe/menu, locale, overflow and runtime.
- Source/built byte equality checked for every changed runtime file plus current JITEM source receipt. Nitro retains old public assets on incremental builds here: archive the old generated `.output` directory before rebuilding; do not manually copy assets into a build.
- Locale results establish preserved behavior/fallback, not complete translation coverage. Existing untranslated Bükücü/other authored strings remain outside this fix.
- Canonical SSR built preview is **not certified locally**: Wrangler is unavailable and the bounded preview attempt timed out. Built static game acceptance is independent and passed. No production deployment or live acceptance claim.
- Repository `npm test` completed with **2239 Node + 61 TypeScript PASS**, zero failures; one existing opt-in DARBE-H closure test was skipped by its unchanged default condition. No tests or skip rules were removed/relaxed. This broad run started before the JITEM-only main fast-forward; final focused tests/build/browser above were rerun on `a31c859`. Remote exact-head CI remains a separate required gate.

```sh
node --test scripts/wave1-*.test.mjs scripts/son-kasaba.test.mjs scripts/son100-pov.test.mjs scripts/wave3-kayip-deduction.test.mjs scripts/amiral-batti.test.mjs
npm run lint
npm run typecheck
env -u DATABASE_URL -u GROK_STRICT_MIGRATE npm run build
node scripts/wave1-save-browser.mjs --serve public --label source
node scripts/wave1-save-browser.mjs --serve .output/public --label built
# Against a real HTTP static/dev server, not file:// (i18n uses root-relative URLs):
BUKUCU_URL=http://127.0.0.1:8080/games/bukucu/ node scripts/bukucu-qa.mjs --games 1 --steps 6000
```

Browser runner accepts `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`; CI can use standard Playwright Chromium. Evidence from this session is under `wave1-evidence/` outside the checkout and `/workspace/screenshots/wave1-save/{source,built}/results.json`; failing baseline logs are retained separately from final green runs.

## Integration and rollback

No overlap with #206's six JITEM/ledger files, #131's TC SIM files, or #112's art proof files. No JITEM, İHTİLÂL, Racon, TC SIM release, shared ledger, route/catalog, artwork or dependency changes. Existing save keys/formats unchanged; raw invalid Amiral/Phone data is not silently overwritten.

Final PR-slot check: Sol opened draft #207 (`archive/ihtilal-retirement-20261020`, head `7dac1eb6acc807389e0f56ff5adaaa3f045d963d`). Its 23 changed files do not overlap this branch, but its shared i18n/portal changes require browser revalidation after merge. #207/#131/#112 occupy all three slots. Publish tested branches only; open no new PR and do not modify/close those existing PRs.

Sol owns release/merge/deployment. After a slot becomes available, open the save repair PR first, then the independent decision PR when capacity permits. Reconcile with current main, run required CI on the actual head and certify canonical built portal/live behavior before release. No merge/deployment in this checkpoint.

Rollback via a dedicated revert, preserving all local saves. **Do not restore SON KÖY's 45-entry reader cap** when rolling back unrelated behavior: long legitimate saves must remain readable. Do not delete save keys or introduce a downgrade migration.
