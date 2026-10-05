# SND-011 — bounded CPU scene feasibility

**2026-10-05 · self-review: REJECT_FOR_PRODUCTION · root visual review: REJECT_FOR_PRODUCTION · accepted 0/300.** One render, no cosmetic retry or expansion. No application, source card, engine, save, public asset, dependency or production changes.

The exact card is **Sandık Çantası**: battle-destruction protection with −200 OP every Standby Phase. A worn, serviceable bag and blank envelopes are an authored durability/upkeep metaphor; no new equipment, reward or numerical effect is asserted in the scene. Exact source fields and hash are in `parameters.json`.

This attempt differs technically from the rejected flat/vector probes: original three-dimensional cloth/strap/buckle volumes are intersected with perspective rays; eight sampled area-light shadow rays and one specular reflection calculate illumination. NumPy/Pillow only; Numba was unavailable. No external renderer, downloaded model/texture, AI imagery, screenshot, tracing, text or real symbol. The root-reported official Blender checksum HTTP403 was not retried through another client or host.

**Measured:** 768×512, 17.617 s, peak RSS 182,948 KiB; PNG 252,866 B. Canonical 576×384 reduction: 192,017 B. Exact output hashes and counters are in `measurement.json`; both PNGs remain outside git under `/workspace/screenshots/veto-cpu-scene-proof/`. Canonical aspect is preserved; actual DOM crop was not tested. No GPU or production-performance claim.

**Why rejected (self and root independently viewed both PNGs):** spatial overlap, cast shadows and the object are legible, but the bag remains too rigid/box-like; repetitive weave and wood bands create aliasing/moiré; leather handles and wall lack convincing material variation; the timber reflection is too sharp for the surface. This does not meet the requested realistic cinematic collectible-card standard. A different renderer has not by itself solved art direction or material realism. Do not multiply this scene into a deck.

**Validation:** three ray-intersection sanity cases (timber hit, bag hit, sky miss), finite distances/normals, exact source record/hash, and measured <180 s / <8 GiB limits passed. These checks establish technical reproducibility boundaries only, not visual acceptance. Rendering uses one primary sample per pixel and a single reflection, not converged Monte Carlo path tracing or simulated fabric.

Reproduce with the command in `parameters.json`. All authored generator/parameter/provenance/measurement files are retained here; no PNG/WebP, model, texture or build output is part of the commit. Any later method requires a separate bounded decision; this failed candidate is complete as evidence only.
