# JITEM: Derin Ağ — permanent retirement recovery package

Retired 2026-10-22. This is historical recovery material, not an active game or a development plan.

## Provenance and recovery

Exact portal commit: `03bc9f4762233d395436cc22325e0c79f5cd4686`.
Exact standalone commit: `c09fd1a0c4c1ba586e0383d569a959c623162ca7`.
`SOURCE.json` includes the original portal runtime SHA-256 receipt and source versions.
`upstream/` contains all 187 tracked files at that standalone commit: code, lockfile,
historical catalogues, sources, artwork, tests and original documentation.
`portal/` contains the exact published integration, original build helper, portal
product/research documents and original integration/QA sources. No dependencies,
build caches, temporary logs or generated duplicate build directories are included.

1. Extract with `tar -xJf jitem-recovery-2026-10-22.tar.xz -C recovery`.
2. In the extracted root, run `shasum -a 256 -c SHA256SUMS` before using files.
3. Use Node 22 and `cd upstream && npm ci`. The lockfile fixes the dependencies.
4. To reconstruct the portal embed, from the extracted root run:
   `node portal/scripts/build-jitem-embed.mjs upstream recovered-embed`.
5. For a byte-exact restore of the old published embed, use
   `portal/public/games/jitem-derin-ag/` rather than rebuilding it. The complete
   original asset graph is preserved; its per-file hashes are in SHA256SUMS.
6. To restore the complete historical portal use the retained Git commit above
   from tayaz-maker/tariklab. Reinstating publication requires a separate product
   decision. Do not copy JITEM research into other games.

## Save compatibility

Origin-scoped localStorage primary: `jitem-derin-ag-v3`; backup: `jitem-derin-ag-v3:bak`.
Legacy key: `derin-ag-save-v1`. Save version 5, schema version 5 (the primary key still ends in v3).
JSON envelope: `{version, schemaVersion, state, replayMeta}`; `state` includes its
own version/schemaVersion, deterministic world/event/AI seeds and RNG cursor.
The authoritative parser/migrator is `upstream/src/game/sim/save.ts`; safe backup
rotation/hydration is in `upstream/src/game/store.ts`. Future schemas are rejected,
not overwritten. Original recovery tests are retained in `upstream/scripts/save-recovery.test.ts`.
The closure never reads, migrates, resets, renames or deletes these values. On
recovery, use the same origin and export raw primary/backup/legacy values before
opening any runtime. An archive on a different origin cannot access old saves.
User save contents are not collected in this package. Browser/site-data deletion
by a user is outside the closure's preservation behavior.

## Reuse and licences

HANEDANIAN uses `public/games/shared/pixi-adapter.js` and the MIT-licensed
`public/vendor/pixi/pixi-8.21.0.min.mjs` plus its own map-pixi/map/SVG infrastructure;
all remain unchanged in TarikLab. TC SIM uses its own modules and the retained
shared management-desk and compact-navigation helpers, not the JITEM embed.
The JITEM `atlas-pixi-Dilx3yA8.js` chunk is private to its own runtime graph;
no other portal game imports it. Its source atlas/model/Pixi and SVG implementation,
visuals, deterministic data processing, offline/save helpers, and historical
research/source records remain here. No demonstrated external consumer needs a
new shared copy, so none is promoted or duplicated into other games.
Portal licence is All Rights Reserved (`portal/LICENSE`). Upstream has no top-level
licence grant. Preservation under the owner's instruction does not create a new
public reuse licence. Third-party dependencies retain their own licences; PixiJS
is MIT. Review original ownership/provenance before any future redistribution.
