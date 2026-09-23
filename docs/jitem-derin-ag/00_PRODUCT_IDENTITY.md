# JITEM: Derin Ağ

Product route: `/oyna/jitem-derin-ag`.

TarikLab is the product/deployment canonical. JITEM source lives upstream in
`tayaz-maker/jitem-derin-ag`; this repository stores only the built isolated
runtime under `public/games/jitem-derin-ag/`.

Current upstream SHA: `1e7c588a550c6515a62d505328478fa73fead2ab`.
Save key: `jitem-derin-ag-v3` · schema: `5`.

Sync source changes by merging upstream, building that exact SHA with base
`/games/jitem-derin-ag/`, syncing generated runtime/assets, then updating
`SOURCE.json`. Never edit compiled `assets/runtime.js` by hand.

Build from a clean upstream checkout at the recorded SHA, after `npm ci` so
the upstream lockfile decides React/Vite/Tailwind versions:
`node scripts/build-jitem-embed.mjs <jitem-derin-ag checkout> public/games/jitem-derin-ag`,
then restore `SOURCE.json` and update its `standaloneSha`.

- TR: `1986–1996. Dosyalar susmaz. Ağ büyür.`
- EN: `1986–1996. Files don't stay buried. The network grows.`
