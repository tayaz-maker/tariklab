# Kıyı Eşiği — source note

Engineering note, not a licence claim and not a trademark clearance.

The playable page is `public/games/esik/`. It is a fictional coast of seven thresholds: pier, landing, stair, ramp, tunnel mouth, bridge joint, slope. Water is a filled shape, not a traced shoreline. Marks are rectangles, steps and a second stroke, not a geometric station alphabet.

The map is drawn by PixiJS (WebGL, MIT-licensed, vendored — see
`docs/TARIKLAB_PIXIJS_MAP_STATUS.md`) when the browser supports it, from a
`buildMapRenderModel(state)` render model in `map-model.js`. A browser
without WebGL, or any PixiJS load/init failure, falls back to the exact same
map drawn as SVG (`map-svg` logic in `app.js`) — no visitor is excluded and
no round-trip origin data changes.

No real city, station name, map tile, or third-party transit asset is used. Save key: `tariklab.kiyi-esigi.v1`. There is no audio.
