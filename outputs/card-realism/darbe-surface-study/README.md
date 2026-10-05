# DRB-001 surface study — REJECTED

Owner: Astra / darbe_cinematic_surface. Base: `be160c95eb5283e5ed2ce8bf139ef7aa714d329d`.
B1 preserved: no production artwork, frame, data, engine, save, localization, card dimensions or UI behavior changed. This is an isolated failed art study, **0 accepted cards**.

The recovered approved reference was inspected for light/material/anatomy quality. Its pixels, composition, people, typography and institutional details are not inputs to this generator. The study authors an older civilian man aligning an archive file at an angled counter, with a left task lamp, paper contact and a side-profile view.

Source method: original cubic Bézier contours, analytical surface gradients and seeded microdetail; no photos, external geometry, image-generation plate, font, CDN or runtime renderer. Run `python3 scripts/card-art/darbe-surface-study.py` to reproduce the SVG and manifest. Inkscape 1.2 renders it at 480×320 and 240×160; no application or GPU test is implied.

Two iterations were inspected. First render: 66,006-byte SVG, waxy face, level gaze, stiff pose, incorrect torso/counter overlap. Second: 62,583-byte SVG, head aimed at the file and one occlusion corrected. The material and anatomy shortcomings remain. Stop after this second attempt; do not recolor or bulk-expand this system.

**Art decision: REJECTED / productionEligible=false.** The image remains vector-illustrative, with hard planar face transitions, stiff fingers, limited fabric volume and repeated shelf shapes. It fails the user's cinematic-realistic premium threshold despite technically valid XML and a small byte size. It must not be labeled approved, integrated into a 300-card set, or used as a substitute for finished artwork.

Technical tests: `python3 scripts/card-art/darbe-surface-study.test.py` checks determinism, aspect/byte budget, absence of remote/embedded assets and visible lettering, local paint references, description semantics and output isolation. These tests do **not** certify realistic anatomy, artistic originality as a legal guarantee, card UI accessibility, browser behavior, physical GPU, save compatibility or offline integration.

Local generated SVG/PNG files are ignored. `measurements.json` retains their hashes/dimensions without publishing rejected assets. No new dependencies or lockfile changes. No build/full-game suite run because there is no application change.

Next meaningful option requires authored anatomical/material detail at a substantially different level, not another filter, head tilt or triangle count increase. B7 remains unresolved; this checkpoint supplies no basis to approve the other 299 DARBE cards.
