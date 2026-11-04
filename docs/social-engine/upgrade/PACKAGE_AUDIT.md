# Verified uploaded package audit

- ZIP opens; 27 entries; ~1.65 MB uncompressed. Contains compiled JS/CSS/worker, 2 PNG sprite sheets, JSON map/atlas, `start.mjs`, README, guide and metadata. Does NOT contain original TypeScript source, tests or repository history.
- `CANDIDATE.json` states `PACKAGED_NOT_RELEASED`; branch `feature/social-engine-development`; runtime SHA `bc81a02487544403d29a3d176246d651e2b60a1d`. This does not verify remote GitHub status.
- Map JSON schemaVersion 1, `name: Kıyıyaka`, 64×64 units. Screenshot makes district label visually dominant despite SOCIAL ENGINE branding. User explicitly wants SOCIAL ENGINE as game name.
- User reports sideways-moving cars, synchronized groups of pedestrians, poor motion and many other defects. Reproduce each in source/browser; screenshot alone cannot prove implementation root cause.
- Historical developer claims: 203 tests passed; 50/60 acceptance criteria; 10 unverified; Firefox day-180 save/read 3.98s vs 1s target; 2 human playtests, low-end hardware, two-hour soak and full repo tests missing. Independently rerun, do not assume validity.
- Local URL `127.0.0.1` is not TarikLab production. Package does not automatically deploy.
