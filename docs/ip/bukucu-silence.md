# Bükücü — silence note

Engineering record, not a licence claim.

On 2026-09-24 the generated tones in `public/games/bukucu/index.html` were removed: no `AudioContext`, no audio file, no sound toggle, and no `navigator.vibrate` call. The game runs silent. `flyCash` remains a text chip, not a sound.

The unrecorded PNG icons were removed and replaced with a hand-written `icon.svg` (register A015). Repo-wide silence is guarded by `scripts/silence.test.mjs`.
