# SND-001 surface study — REJECTED, not production art

- B3: approved reference pixels inspected for quality only; no reference pixels, logos, text, person or composition copied into the generator.
- Original scene: older fictional clerk, side profile, paper sorting across a daylight room; procedural SVG contours/material gradients/seeded surface marks.
- B7: **FAIL**. Polygonal facial planes, drawn eyelids, exaggerated ear/head relationship, stiff raised fingers and banded cloth folds remain stylized. This does not meet cinematic-realistic reference quality.
- Root and author separately opened the 576 px render; author also opened 192 px. These are model visual inspections, not human or browser/GPU certification.
- B10: source-only probe, six targeted tests PASS (determinism, SVG budget/dimensions, no text/external input, local IDs, explicit rejection, source dependencies). No gameplay/runtime file changed.
- Measurements: SVG 56,061 B; deterministic gzip 11,082 B; local 576×384 quality-90 WebP 17,614 B. Byte compliance does not establish visual acceptance.
- Reproduce: `node scripts/card-art/veto-surface-study.mjs`; `python3 scripts/card-art/veto-surface-study-render.py`; `node --test scripts/card-art/veto-surface-study.test.mjs`.
- Failed SVG/PNG/WebP renders stay locally ignored; only authored source, tests and compact provenance are versioned. No production manifest or offline bundle includes this study.
- `artAccepted: false`; eligible rollout **0/300**. No cosmetic second pass and no 300-card template expansion.
- Next path requires materially better original anatomy, continuous form/material shading and physically credible hand contact; density or texture alone will not resolve this failure.
