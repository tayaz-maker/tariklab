# VETO-H! content sync

Approved VETO-H! print data and card art live in the private
`tayaz-maker/tariklab-content` repo. This website **bundles** copies:

- authored cards: `public/games/veto-h/source-cards.json`
- illustrations: drawn from code by `scripts/duel-card-art/compose.mjs`,
  rendered by `scripts/build-duel-card-art.mjs`, transported in
  `scripts/duel-art-packs/veto-h-*.json` and unpacked to
  `public/games/veto-h/assets/cards/{id}.webp` (the earlier AI card art was
  removed on 2026-09-24; card art is no longer synced from the content repo)
- portal background: CSS gradients in `src/styles.css` (the old
  `prism-spectrum.webp` with an unrecorded creator was removed on 2026-09-24)

Do not treat App `catalog.json` as authored source. Effects stay in
`designs.js` / `expansion.js`. Sync never deletes games, routes, or saves.

Native/Godot is **paused**. Web remains the active surface. Meaningful
website changes (content, art, rules, presentation) must be appended to
[docs/WEB_APP_SYNC_LEDGER.md](../WEB_APP_SYNC_LEDGER.md) for later standalone
native follow-up. Web does not wait for native.

```bash
node ../tariklab-content/tools/sync-web.mjs --content ../tariklab-content --web .
node scripts/duel-art-pack.mjs veto-h
node ../tariklab-content/tools/parity.mjs --content ../tariklab-content --web . --app ../tariklab-app
```
