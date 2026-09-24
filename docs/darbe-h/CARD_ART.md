# DARBE-H! / GETT-OH! card art pass

Presentation only. No deck, mechanic or balance change. VETO-H! assets not regenerated. İHTİLÂL untouched.

## Identity

| Theme | Face | Slot |
|---|---|---|
| VETO-H! | existing 576×384 webp, campaign night | unchanged |
| GETT-OH! | 400×300 webp, Istanbul night | `RCN-285` placeholder replaced in pack |
| DARBE-H! | 400×560 SVG, illustrated crisis interiors | `public/games/darbe-h/assets/cards/DRB-NNN.svg` |

DARBE class language: Görevli / Emirname / İhtar. Faces are series-first illustrated interiors (lamp-lit desks, telex rooms, briefing corridors, archive stacks) with perspective, lighting pools and object storytelling — not a shared collage template with swapped labels. L5+ heavier frame, auxiliary wax `YD`. Readable at 360px.

## Naming

```
/games/darbe-h/assets/cards/DRB-NNN.svg
/games/gett-oh/assets/cards/RCN-NNN.webp   (unpack from scripts/duel-art-packs)
```

## GETT RCN-285

Was a 1×1 WebP in `gett-oh-24`. Replacement is 400×300 VP8, Çelişen Tanık, night-street. Source of truth is the pack (cards/ is gitignored). Manifest sha/bytes updated.

## Regenerate DARBE faces

```
node scripts/build-darbe-h-card-art.mjs
node scripts/build-darbe-h-art.mjs
```

Drop-in: `THEME_META["darbe-h"].art.kind = "svg"` and `cardArt()` picks `.svg` vs `.webp`. Lazy `loading="lazy"` on duel-core `<img>` is unchanged.
