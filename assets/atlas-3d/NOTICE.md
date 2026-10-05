# Third-party notices — 3D proof

BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International.

- Official license: https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html (updated 2025-02-27; checked 2026-10-05).
- License text: https://creativecommons.org/licenses/by/4.0/
- Data: BodyParts3D 4.0 PART-OF 99% OBJ archive, adult male reference. Source identifiers, hashes and archive provenance: `public/atlas/3d/models/manifest.json`.
- Adaptations by TarikLab: nine concept groups, indexed triangle conversion, coordinate/unit conversion `(x,z,-y)/1000`, recalculated normals, binary packing and gzip. Colors and exploded placement are educational presentation. Historical OBJ headers use CC BY-SA 2.1 Japan; the current official distribution page specifies CC BY 4.0.

Three.js 0.180.0: Copyright © 2010-2025 three.js authors; MIT License. Full license: `public/atlas/3d/vendor/THREE-LICENSE.txt`. The vendored OrbitControls import points to the local engine module. Engine bytes are compressed and chunked only for repository storage; build restoration is lossless.

Human Atlas (https://github.com/ashemag/human-atlas) was an interaction reference. No implementation or optimized geometry from that project is included.

The `.part` files in this directory store portions of the above model and engine assets. `manifest.json` identifies their original runtime paths and SHA-256 hashes. `scripts/atlas-3d-assets.mjs` verifies and reconstructs them before the website build. See the website's `/atlas/3d/sources.html` for user-facing scope and attribution.
