# Racon Manager — neighbourhood network map (originality review)

Engineering review for the implementation gate. Not legal advice. Not counsel sign-off.

| Risk | Rating | Control in this change |
|---|---|---|
| Real city or street map | Avoided | The map is a schematic: six nodes on a 3×2 (wide) or 2×3 (narrow) ring, from each street's existing `komsular` list. No coordinates, outlines, tiles or geography. The page says: "Şema; gerçek konum ya da ölçek değil." A test fails on map-provider names or coordinate fields. |
| Third-party map art or another game's map language | Avoided | Plain CSS boxes and SVG lines drawn in code. No image, icon set or font file. Control is shown by a text label and border style (solid / dashed / dotted), not a borrowed visual system. |
| Sports-management screen skeleton (legacy finding 4 in `TRADEMARK_CLEARANCE.md`) | Not changed by this PR | This change only replaces the map screen. The rest of the Racon shell still needs the separate overall-appearance review recorded in the clearance log. |
| Street names | Existing product data | The six street labels already ship in `canonStreets()`. This change adds no new place names. Whether real district names may stay in a fictional crime setting is still a counsel question, recorded here and not assumed. |

The four decisions (Koru, Yatırım, Çekil, İlişki kur), their costs, durations and effects are original rules written for this change (`public/games/racon/network.js`).
