# Supplemental archive production acceptance — 2026-10-21

Target after package A: main `f7da2f1854a0ab04cef571ca5537e6d9011ea942` (#219). Local source archive extraction/hash validation (77 entries) already passed in this turn and is not repeated.

The existing Cloudflare production workflow covers Racon, active-game post-release suites, original IHTILAL runtime smoke on www and Kıyı save-hotfix scenarios on both hosts. It does not cover all three archive portal/Resources statuses, sitemap retirement or the unpublished lossless archive package. Therefore `scripts/archive-production-acceptance.mjs` supplements only those missing archive gates, reusing `archiveAcceptance`, `coastArchiveAcceptance` and `bukucuArchiveAcceptance` unchanged.

Required invocation after exact-main CI/TC and Workers publication PASS:

```sh
ARCHIVE_RELEASE_SHA=<exact-current-main> ARCHIVE_PRODUCTION_OUT=../archive-production-v2 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=<available-chrome> node scripts/archive-production-acceptance.mjs
```

The script checks exact current-main mandatory release guards, then real Chromium on www and Workers. Per host: 66 exact current-main public source/Resources/sitemap hashes, private source tar.xz HTTP404, all three retired routes absent from active sitemap, and18 fresh-context archive TR/EN/PL×390/1280 cases preserving legacy saves/backups/recovery slots, original progression and reload. Portal/Resources links remain absent and localized archive notices/noindex contract remain visible. No real user storage, historical data or game source is mutated.

Results are written under `work/archive-production-v2/receipt.json` and per-game browser JSON/screenshots. The receipt records the exact accepted main and rechecks that main did not move during acceptance. A changed main requires reassociating source/receipt with the new canonical SHA, not treating an earlier checkpoint as current.

## Production result

Exact-main `f7da2f1854a0ab04cef571ca5537e6d9011ea942` PASS on both `www.tariklab.com` and `tariklab.tayaz29.workers.dev`. Each host:66 exact deployed public hashes,18 archive language/viewport/save cases, all three retired sitemap entries absent, private source package HTTP404. Total36 original archive cases PASS; portal/Resources archive visibility, original saves/backups/recovery slots, action/reload and noindex contracts preserved. Main was re-read unchanged after completion. All three www desktop/mobile archive screenshots were visually inspected.

Detailed receipt and screenshots: `work/archive-production-v2/receipt.json`, `www/`, `workers/`; log `work/archive-production-v2-run.log`. This supplements the main Cloudflare production workflow; it does not replace active-game post-release checks. No product source change was required.
