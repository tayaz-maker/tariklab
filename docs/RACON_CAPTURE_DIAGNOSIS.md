# Racon mobile fullPage capture — source diagnosis

2026-10-05 · Owner Astra · Branch `astra/racon-capture-diagnosis` · PR none. Repository `tayaz-maker/tariklab`; clean source/base HEAD `dfbab3f15b74df5336fecf9f7d4247184cbb9222` (#115 merge), root tree `83c5e87a9193bb13b68ac0ae45e7728fc63ee8e6`. This is a source-supported diagnosis, **not a runtime-confirmed user overflow bug**. The C3/P1 verification gap remains open; no app, gate or global status document changes.

## Observed evidence

Existing production export root: `/workspace/scratch/f69805d9a14c/evidence-release-115`. Both hosts' 390 Pixi before/after/map PNGs are **730×844**; their 320 SVG captures are **621×844**. The additional right strip is entirely RGB **(26,23,20)**, with no painted game controls. Existing `results.json` records HTML/stage scroll widths of **390/390** and **320/320** at before/outcome, but has no map-capture layout sample. These are existing artifacts, not fresh browser results.

| Exact screenshot | PNG dimensions | SHA-256 |
| --- | --- | --- |
| `www/racon-390-pixi-map.png` | 730×844 | `a0b109cd8d34972a3454f419dbb78c7372b1771c7720433efa7fb0b9cfcc9c3e` |
| `workers/racon-320-svg-map.png` | 621×844 | `a1ad883a96737d751c7220a3439a702940b368f671062562324d08c06d6aa2b8` |

## Source-supported mechanism

[`public/games/racon/index.html:473`](https://github.com/tayaz-maker/tariklab/blob/dfbab3f15b74df5336fecf9f7d4247184cbb9222/public/games/racon/index.html#L473) gives the closed absolute `.side` drawer `width:min(340px,94%)`, `translateX(100%)`, `visibility:hidden` and `pointer-events:none`. Its predicted right edge is **390+340=730** and **320+300.8=620.8→621**, matching both captures. HTML/body use `overflow:hidden` (24–25); the map uses `width:100%;contain:layout paint` (510–511). Drawer geometry is therefore the stronger explanation than Pixi/SVG surface width.

[`scripts/wave1-outcome-browser.mjs:25–26`](https://github.com/tayaz-maker/tariklab/blob/dfbab3f15b74df5336fecf9f7d4247184cbb9222/scripts/wave1-outcome-browser.mjs#L25) checks `documentElement.scrollWidth` and stage/card widths, then captures `fullPage:true`; trust-layer capture at line 90 has no adjacent layout assertion. Installed Playwright **1.62.1**, `playwright-core/lib/coreBundle.js:21233–21256`, computes full-page width as **MAX(body.scrollWidth, documentElement.scrollWidth, body.offsetWidth, documentElement.offsetWidth, body.clientWidth, documentElement.clientWidth)**. Missing body metrics can explain a passing HTML-width assertion alongside a wider PNG; runtime body width has not yet been observed.

Source Git blob IDs: Racon HTML `52005ede2e9a71adc27aeecf40fa3e4145355aae`; Wave1 runner `93cc14283682000c22d2692b939f59a2ebde43f6`. Inspected local Playwright bundle SHA-256: `9393fa79e1c67c74edc26b610d65a4f7ed73d345a762465cc88340a33a2454ac` (installed-code evidence, not proof of the production CI dependency instance).

## Minimal real-browser probe — pending

1. Repeat the existing saved-state/trust-layer flow at **390×844 Pixi and 320×844 SVG**, reduced motion, on both production hosts. Immediately before capture record all six MAX inputs above; `innerWidth`, `visualViewport.width/offsetLeft`, root/app/stage scroll positions and widths; map bounds; drawer bounds, transform, visibility and pointer-events. Assert map fits stage and HTML/stage widths fit the viewport.
2. Capture **viewport-only and fullPage** images without masking styles; verify actual PNG dimensions and remeasure after capture. Test closed-drawer hit detection at several in-viewport right-edge points: neither `elementFromPoint` nor its target ancestor may belong to the hidden drawer.
3. Record root `scrollX/scrollY`, call `scrollTo(1000000, originalY)`, observe after an animation frame, then restore the original coordinates and assert restoration. Separately attempt ordinary horizontal input over the map and record root/visual-viewport/stage movement; programmatic scrolling alone does not prove a user-visible bug.
4. Use the real **Panel** button to open then close the drawer, retaining the same save and viewport. Compare metrics and fullPage widths: **730→390→730 / 621→320→621** is the source-predicted result. This tests the cause without app edits, screenshot-style overrides or weakened acceptance. Unexpected width, hit-test or user-scroll behavior needs its own bounded repro before classification.

No browser was launched, no physical GPU claim was made, and the known local Chromium SIGSEGV was not retried. No new product bug, fix, PASS or completed C3 review is claimed.
