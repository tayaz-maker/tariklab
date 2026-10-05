# Real mesh proof — 2026-10-05

Separate route `/atlas/3d/`; existing `/atlas/yapi/` remains unchanged. This is a bounded torso proof, not completion of the user's full realistic anatomy atlas. No card/PR123 or final360 work.

## Data decision

Official BodyParts3D 4.0 PART-OF 99% archive, retrieved 2026-10-05; adult male reference. Official license page https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html updated 2025-02-27 specifies CC BY 4.0. Historical OBJ CC BY-SA headers are recorded, not hidden. Current attribution is visible in the product sources page and site Resources. Source IDs and SHA-256s, archive SHA, mapping SHA, transformations, actual counts and sizes are in `public/atlas/3d/models/manifest.json`.

Selected nine nonoverlapping FMA concept groups: rib cage, heart, right/left lungs, liver, stomach, right/left kidneys, diaphragm. 468 original source meshes, 678,908 triangles. Source PART-OF grouping includes substructures; these are not 468 separately selectable organs. Nine groups are selectable. Unit/axis conversion `(x,z,-y)/1000`, indexed triangles, recomputed vertex normals, gzip; no new anatomical shape or additional simplification. Source coordinates preserved when assembled. Exploded inventory and colors are artificial educational presentation.

Anatomy/translation independent review remains unassigned. Turkish-only proof; no claim of EN/PL localization. Female coverage is absent. HRA female reference organs are a possible later separately attributed dataset, not a license to label this male geometry female. No clinical accuracy or full-body claim.

Human Atlas https://github.com/ashemag/human-atlas and MIT license were inspected as interaction reference; no implementation or optimized mesh files copied. Original TarikLab layout and conversion pipeline. Three.js 0.180.0 from npm; MIT text retained; OrbitControls import rewritten to local module. No external runtime CDN, audio or continuous render loop.

## Interaction and budgets

Geometry is 6,218,304 compressed bytes in nine independently verified group chunks. No engine or geometry requested before explicit load. Entire optional offline package capped at 8 MiB; current measured size is recorded in `offline-manifest.json`. This larger optional proof does not alter foundation's 350 KiB gate. Scoped atomic hash-verified worker; no forced waiting-worker activation, other cache deletion, root worker or game save change.

Orbit/zoom, keyboard camera, system toggles, geometry ray picking versus drag, search by TR/English/FMA, isolation, front/side/back, assembled-to-grid slider, on-demand rendering, WebGL-loss notice and link to existing lightweight SVG atlas. Partial source coverage always visible.

## Reproduce

Download `partof_BP3D_4.0_obj_99.zip`, `partof_element_parts.txt` from the official download page to a scratch source directory as `parts.zip`, `elements.txt`; compare source hashes with manifest before processing. Run `python3 scripts/atlas-3d-convert.py SOURCE_DIR`, then `node scripts/atlas-3d-package.mjs`. Raw source archive is not committed or downloaded at runtime. Vendor version/license bundled.

Run `node --test scripts/atlas-3d.test.mjs`. Dedicated PR workflow builds the actual site, compares emitted proof files and uses real Chromium software WebGL at 1440/390/320 with screenshots and optional offline reinstall/reload. Software WebGL is not physical mobile GPU proof. Local headless Chrome aborts in this host environment; in-app browser rendered actual mesh geometry successfully. CI/browser acceptance pending at initial checkpoint; no successful render claimed from HTTP alone.

Repository transport: large models and engine files are stored as 48 KiB chunks under `assets/atlas-3d/`. The Vite plugin reconstructs and verifies every chunk and complete asset before public copying. Browser URLs, bytes, hashes and request counts remain unchanged. For a standalone static server, first run `node scripts/atlas-3d-assets.mjs`.
