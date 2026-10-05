# GETT RCN-001 — rejected surface study

- Branch: `astra/gett-surface-study`, base `be160c95`.
- Status: **REJECTED — 0 production cards accepted.** No application assets changed.
- Scene: an original older adult woman serves tea at a counter, with original geometric objects and one pendant key light. No reference person, pose, composition, logo, text, photo, model or texture is copied.
- Method: original Bézier masks, analytic relief surfaces, normal-derived lighting, seeded material grain; offline Python only. Outputs contain no text.
- Two passes: first exposed repeated cloth bands and inflated facial forms; second replaced periodic folds with localized relief and reduced facial exaggeration. It still fails the requested cinematic-realistic standard.
- Unresolved: head reads as a modeled doll, wrist/finger articulation is rigid, cloth lacks credible drape, shallow room materials resemble a miniature set. More shader detail would not fix the underlying original shape modeling.
- Parent and author inspected actual 400×300 pixels; author also inspected 160×120. This is model review, not a human anatomy/art review.
- WebP/PNG files are ignored local rejected-review evidence only; no render is tracked in this checkpoint tree. Do not import them into `public/`, manifests or offline bundles.
- Reproduce: `python3 scripts/card-art/gett-surface-study.py`; Python, NumPy, Pillow and SciPy are existing local tooling, not added runtime dependencies.
- Verify: `python3 scripts/card-art/gett-surface-study.test.py`. Tests regenerate missing renders in a disposable temporary directory and compare the recorded hashes. Technical tests do not certify realism.
- All render output is generated locally and ignored; no full build/browser suite was run because runtime remains byte-identical. No production/browser/PWA/CI claim.
