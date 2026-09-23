# Portal categories and install identity

Continues PR #56 at `0c372fa8974ee9207d06f54e303e1c6f12b72b71`.

The nineteen live games are grouped by what they actually are, in four shelves. The old *Yönetim & Strateji* shelf held nine games that mixed map and power strategy with life and management sims.

| Shelf | Games | Why together |
| --- | --- | --- |
| Strateji & Güç | Çete Savaşları, HANEDANIAN, Racon, Bükücü, TC SIM DEVLET | You grow and hold territory, turf or a state. |
| Hayat & Yönetim | TC SIM, Apartman, Son Köy, Son 100 Gün | You run people over time: one life, one building, one village, one hundred days. |
| Dosya & Soruşturma | Kayıp Telefon, İHTİLAL, JITEM | You read the record, connect evidence and decide. |
| Kart & Masa | VETO-H!, GETT-OH!, DARBE-H!, Satranç, Amiral Battı, Tek Taş, Labirent | Short table sessions: the three card duels and the four classic board and puzzle games. |

Shelves hold 3–7 games (`scripts/portal-categories.test.mjs` keeps it that way). Cards keep their route, identity and status. New unclassified live entries remain visible in the first group until assigned; they cannot silently disappear.

**Small icons.** At 16–32 px the install monogram's glyph fills only about half the tile, and on a dark tab bar the tile edge disappears. `favicon.svg` therefore uses the same TL mark scaled 1.45× (glyph ≈ 74 % of the tile) with a faint light edge. `favicon.ico` (16/32/48, rendered from that SVG) answers the root `/favicon.ico` request that browsers and embedded game documents make, which used to 404. The PWA, Dock and apple-touch icons are unchanged, since large sizes read well and the maskable safe zone must be kept.

**Colours.** The page `theme-color`, the manifest `theme_color` and the manifest `background_color` are all the page background `#080706`, so the install splash, the standalone title bar and the page no longer disagree. The icon tile stays `#111713`.

Install identity uses TarikLab consistently, one manifest link, a high-contrast TL monogram, 192/512 PNG icons, a separate safe-zone maskable 512 icon and a 180 apple-touch icon. The platform branding injector remains intact and recognizes an already-present manifest/apple icon. App id/start URL/scope stay `/`, preserving installed app identity.

Real Chromium checks: one manifest selected with no parsing errors, correct name/icons/scope, desktop and 390px portal without horizontal overflow or page errors. [Desktop](portal-desktop.webp), [mobile](portal-mobile.webp), [actual icon in browser](pwa-icon-browser.webp). Targeted category/PWA tests, build/typecheck and changed-file lint passed.

Mac Dock and the native macOS install dialog cannot be exercised in this Linux browser environment. Existing installations may retain their icon until the browser refreshes the manifest.
