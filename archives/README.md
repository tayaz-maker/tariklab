# Preserved games — 2026-10-21

`retired-games-2026-10-21.tar.xz` is a deterministic, lossless tar archive compressed with LZMA2 preset 9 extreme. It contains 77 original files from exact main `007ce1e310e6ce8feee49154fae18769d03928b6`: Bükücü, İHTİLÂL, Kıyı Eşiği, provenance, their localization runtime and shared dependencies. `MANIFEST.json` records every path, size and SHA-256 plus the archive hash. It contains no user data or secrets.

The named Git reference `archive/bukucu-pre-retirement-20261021` preserves the entire last live tree and was independently read back before retirement. Existing İHTİLÂL and Kıyı archive references and immutable manifests remain unchanged.

Source payload: 5,018,304 bytes. Tar: 5,089,280 bytes. Compressed: 677,052 bytes (86.51% smaller than the source files, 86.70% smaller than tar). The package lives outside `public/` and does not ship as a static download. Runtime copies required by existing archive routes, old-save recovery and historical tests remain byte-identical. Shared files used by active games remain in place. These are archived games, absent from the live catalog and Resources, never relisted as active products.

## Verify and restore

Run `python3 scripts/verify-game-archive.py`. It decompresses the archive, verifies the archive hash and checks each safe, regular tar entry against the manifest. No extraction or file replacement occurs.

For an offline/source recovery copy, create a **new empty directory**, then extract the verified tar.xz there with Python's `tarfile` or `tar -xJf`. Serve the restored `public/` tree from the same origin when resuming browser saves. Saves belong to the original origin, so a different local origin will not inherit production storage. Copy/export existing saves through their existing recovery flows first; never clear browser storage. Bükücü retains `smb.v1`, `tariklab::bukucu:1..3`, active-slot and migration keys. İHTİLÂL retains solo/legacy backups; Kıyı retains its primary, backup and eight recovery slots. No save schema or key is converted.

Do not extract over the active checkout, republish archived products, or overwrite updated shared assets. The Git reference can also recover any file omitted from this narrow source package.
