# JITEM permanent retirement — 2026-10-22

Product decision: permanently remove JITEM: Derin Ağ. No redesign, successor, or new gameplay is included. Publication takes effect only after the closure PR is merged and the existing Cloudflare deployment is coordinated separately.

## Scope and reference audit

Base TarikLab main: `03bc9f4762233d395436cc22325e0c79f5cd4686`.
Published embed receipt and standalone source: `c09fd1a0c4c1ba586e0383d569a959c623162ca7`.
The original portal runtime SHA-256 receipt is inside the recovery package.

Removed JITEM's live catalogue entry, category membership, HTML5 play list entry, icon, TR/EN/PL catalogue/Resources copy, IHTILAL's JITEM recommendation, embed locale messaging, runtime chunks, images and embedded install assets. Removed its five dedicated build/browser/integration scripts and its obsolete chunk-specific noise exception. The original scripts and product/research/evidence files are in the recovery package.

`/oyna/jitem-derin-ag` redirects to the active catalogue before game lookup. The old static embed entry is a small no-script redirect with a readable TR/EN/PL fallback. It contains no game runtime. The root service worker intercepts retired URLs before any cache fallback: navigations return to the catalogue and asset requests receive 410. On activation it removes only same-origin JITEM URLs from root-owned `cete-offline-*` caches; it never deletes entire caches or accesses save storage. Other games' caches are retained.

## Retained dependencies and reuse decision

| Component | Actual consumer | Decision / licence |
| --- | --- | --- |
| `public/games/shared/pixi-adapter.js`, `public/vendor/pixi/pixi-8.21.0.min.mjs` | HANEDANIAN, Racon, archived İHTİLÂL/Kıyı Eşiği, TC SIM: DEVLET map capability | Retain exact existing files. Vendor is verified byte-identical to locked PixiJS 8.21.0, MIT. |
| `public/games/hanedanian/{map,map-pixi,map-factory}.js`, terrain/atlas scheduling, worker package | HANEDANIAN | Retain unchanged; no JITEM imports. |
| `public/games/shared/{management-desk,compact-navigation}.*` | TC SIM and other management games | Retain unchanged; no JITEM imports. |
| JITEM's `assets/atlas-pixi-Dilx3yA8.js` and sibling chunks | JITEM runtime only | Archive; repository-wide reference scan found no external game consumer. This is separate from the retained shared Pixi adapter/vendor. |
| JITEM atlas/model/Pixi/SVG source, data processing, visual assets and save helpers | No demonstrated external consumer | Preserve in the exact standalone snapshot; do not create a speculative shared copy. |
| JITEM historical catalogues, source records and research | JITEM historical reference | Preserve in recovery; do not copy into HANEDANIAN or TC SIM. |

All 324 tracked non-JITEM game/vendor files match the base commit's SHA-256 values. No active game's logic, artwork, translations, source data, worker, or save implementation is changed.
Portal code is All Rights Reserved. The upstream snapshot has no top-level licence grant. Archival does not grant new reuse rights. Existing third-party notices are retained; the JITEM-specific active-runtime notice is removed.

## Durable recovery and size

Recovery package: `jitem-recovery-2026-10-22.tar.xz`, stored in this Git directory outside production public assets. A dedicated `archive/jitem-recovery-20261022` Git branch retains the recovery-only commit independently of PR branch cleanup. Git history is not rewritten. Neither repository is deleted or put into GitHub archive mode.

The package contains all 187 upstream tracked files, the exact portal embed, original integration/build tooling, historical product/research/evidence material, source receipts, restore/save/reuse notes and an internal per-file SHA-256 manifest. Source snapshots retain original bytes. No node_modules, build cache, temporary logs or duplicate build directories are included. Compression is lossless XZ/LZMA2 at preset 9 extreme.

Uncompressed file payload: **4,106,094 bytes**. Compressed archive: **1,140,044 bytes** (72.24% smaller).
Archive SHA-256: `0947977077da691a7ea10678b4c4f16d484c1a769ee1463a91e165b38d47e405`.
Independent extraction verified **245 manifest entries**, all **187 upstream files**, and the original published runtime receipt. See `SHA256SUMS`, `archive-metrics.json`, and `README.md`.

Same-install, same-lock production comparison: public files **22,340,972 → 20,733,776 bytes**, saving **1,607,196 bytes**; public + server **27,719,980 → 26,102,418 bytes**, saving **1,617,562 bytes** (1.54 MiB). These are uncompressed build bytes, not a measured CDN transfer size. The archive does not ship in `.output/public`. See `build-metrics.json`.

## Saves and validation

The closure never reads, migrates, renames or deletes `jitem-derin-ag-v3`, `jitem-derin-ag-v3:bak`, or legacy `derin-ag-save-v1`. Both save version and schema version are 5; the primary key retains its historical v3 name. No user saves are collected. Exact-origin recovery instructions and the original parser/migration/backup implementation are included in the package.

Local validation: production build PASS; typecheck PASS; lint PASS (0 errors, 62 existing warnings); 185 targeted tests PASS. Source and production browser matrices each cover TR/EN/PL × 1280/390 px: 15 catalogue games, both legacy JITEM URLs, no JITEM runtime requests, new HANEDANIAN game/map and Pixi 8.21.0 load, new TC SIM game, and byte-identical primary/backup/legacy schema-5 save values. Browser console/page errors: none. Desktop/mobile screenshots were inspected. React changes remove unused effects/refs/state; navigation and accessible frame titles remain intact.

Required GitHub CI must pass before merge or deployment. ChatGPT coordinates merge and the existing Cloudflare publication. No deployment, new Worker, or Vercel action is part of this change.
