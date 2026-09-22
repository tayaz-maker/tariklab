// Generates every DARBE-H! logo variant from one geometry, then rasterizes the
// PNG sizes with the preinstalled Chromium. Pure paths: no fonts, no filters,
// so the SVGs render identically everywhere and stay tiny.
// Usage: node docs/darbe-h/visual-system/tools/build-logo.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "logo");
mkdirSync(OUT, { recursive: true });

export const INK = "#121820"; // ink navy, the table
export const PAPER = "#efe6d2"; // dossier paper
export const SEAL = "#c8463c"; // stamp crimson
export const BRASS = "#c4a574"; // telex brass

// Mark geometry on a 512 grid. Seal ring + a geometric "D" (the dossier
// tab corner is the chamfer) + one diagonal crack that cuts both: the
// stamp that breaks the order. The crack is a mask so it is a real cut-out.
const RING = { r: 204, w: 34 };
const PERF = { r: 166, w: 7, dash: "3 13" };
const D_PATH =
  "M166 132H282L362 212V300L282 380H166Z M224 190V322H256L304 274V238L256 190Z";
const CRACK = "384,40 272,238 330,254 136,480";

function crackMask(id, width) {
  return `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512"><rect width="512" height="512" fill="#fff"/><polyline points="${CRACK}" fill="none" stroke="#000" stroke-width="${width}" stroke-linejoin="miter" stroke-miterlimit="8"/></mask>`;
}

function markGroup({ ring = SEAL, d = PAPER, perf = true, maskId = "dh-crack", crack = 20 } = {}) {
  return [
    `<defs>${crackMask(maskId, crack)}</defs>`,
    `<g mask="url(#${maskId})">`,
    `<circle cx="256" cy="256" r="${RING.r}" fill="none" stroke="${ring}" stroke-width="${RING.w}"/>`,
    perf
      ? `<circle cx="256" cy="256" r="${PERF.r}" fill="none" stroke="${ring}" stroke-width="${PERF.w}" stroke-dasharray="${PERF.dash}" opacity=".7"/>`
      : "",
    `<path fill="${d}" fill-rule="evenodd" d="${D_PATH}"/>`,
    `</g>`,
  ].join("");
}

const svg = (viewBox, body, title = "DARBE-H!") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" role="img" aria-label="${title}"><title>${title}</title>${body}</svg>\n`;

// 1. Mark, transparent background (header on dark, portal hero).
const mark = svg("0 0 512 512", markGroup());

// 2. App icon: rounded ink tile, brass hairline, mark at 86 %.
const icon = svg(
  "0 0 512 512",
  `<rect width="512" height="512" rx="112" fill="${INK}"/>` +
    `<rect x="14" y="14" width="484" height="484" rx="100" fill="none" stroke="${BRASS}" stroke-opacity=".35" stroke-width="4"/>` +
    `<g transform="translate(256 256) scale(.86) translate(-256 -256)">${markGroup({ maskId: "dh-crack-i" })}</g>`,
);

// 3. Maskable: full-bleed ink, mark inside the 80 % safe circle (r 205).
const maskable = svg(
  "0 0 512 512",
  `<rect width="512" height="512" fill="${INK}"/>` +
    `<g transform="translate(256 256) scale(.72) translate(-256 -256)">${markGroup({ maskId: "dh-crack-m" })}</g>`,
);

// 4. Favicon: drops the perforation and thickens the cut so 16 px stays a
// ring + D + slash instead of mush.
const favicon = svg(
  "0 0 512 512",
  `<rect width="512" height="512" rx="96" fill="${INK}"/>` +
    `<g transform="translate(256 256) scale(.94) translate(-256 -256)">${markGroup({ perf: false, maskId: "dh-crack-f", crack: 34 })}</g>`,
);

// 5. Single-colour glyph (currentColor) for inline UI and the portal tile.
const glyph = svg("0 0 512 512", markGroup({ ring: "currentColor", d: "currentColor", perf: false, maskId: "dh-crack-g", crack: 26 }));

// 6. Wordmark: condensed stencil capitals on a 56-unit cap height. The
// hyphen and bang carry the seal colour; everything else is paper.
const LETTERS = {
  D: { w: 36, d: "M0 0H22L36 14V42L22 56H0Z M10 10V46H18L26 38V18L18 10Z" },
  A: { w: 36, d: "M0 56L12 0H24L36 56H26L23.4 44H12.6L10 56Z M14.8 34H21.2L18 17Z" },
  R: { w: 36, d: "M0 0H26L35 9V24L27 31L36 56H25L18 33H10V56H0Z M10 10V24H23L25 22V12L23 10Z" },
  B: { w: 36, d: "M0 0H26L34 8V21L29 26.5L36 33V48L28 56H0Z M10 10V22H22L24 20V12L22 10Z M10 32V46H24L26 44V35L23 32Z" },
  E: { w: 32, d: "M0 0H32V10H10V23H27V33H10V46H32V56H0Z" },
  "-": { w: 20, d: "M0 24H20V33H0Z", seal: true },
  H: { w: 36, d: "M0 0H10V23H26V0H36V56H26V33H10V56H0Z" },
  "!": { w: 12, d: "M0 0H12L9.5 40H2.5Z M1 46H11V56H1Z", seal: true },
};
function wordmarkPaths(text, { gap = 6, fill = PAPER, seal = SEAL } = {}) {
  let x = 0;
  const parts = [];
  for (const ch of text) {
    const l = LETTERS[ch];
    parts.push(`<path transform="translate(${x} 0)" fill="${l.seal ? seal : fill}" fill-rule="evenodd" d="${l.d}"/>`);
    x += l.w + gap;
  }
  return { body: parts.join(""), width: x - gap };
}
const wm = wordmarkPaths("DARBE-H!");
const wordmark = svg(`-4 -4 ${wm.width + 8} 64`, wm.body);
const wmMono = wordmarkPaths("DARBE-H!", { fill: "currentColor", seal: "currentColor" });
const wordmarkMono = svg(`-4 -4 ${wmMono.width + 8} 64`, wmMono.body);

// 7. Horizontal lockup for the in-game header and the portal card:
// mark (80 high) + wordmark (cap 40) with a brass rule under the name.
const lockScale = 40 / 56;
const lockW = 80 + 18 + wm.width * lockScale;
const lockup = svg(
  `0 0 ${Math.ceil(lockW)} 80`,
  `<g transform="scale(${80 / 512})">${markGroup({ maskId: "dh-crack-l" })}</g>` +
    `<g transform="translate(98 12) scale(${lockScale})">${wm.body}</g>` +
    `<rect x="98" y="66" width="${(wm.width * lockScale).toFixed(1)}" height="3" fill="${BRASS}" opacity=".55"/>`,
);

const files = {
  "darbe-h-mark.svg": mark,
  "darbe-h-icon.svg": icon,
  "darbe-h-maskable.svg": maskable,
  "darbe-h-favicon.svg": favicon,
  "darbe-h-glyph.svg": glyph,
  "darbe-h-wordmark.svg": wordmark,
  "darbe-h-wordmark-mono.svg": wordmarkMono,
  "darbe-h-lockup.svg": lockup,
};
for (const [name, body] of Object.entries(files)) writeFileSync(join(OUT, name), body);

// Portal tile glyph in the existing game-icons.tsx idiom (64 grid, 2px
// currentColor strokes), so the catalogue stays one icon family.
writeFileSync(
  join(OUT, "portal-game-icon.tsx.txt"),
  `"darbe-h": <><circle cx="32" cy="32" r="24"/><path d="M24 19h13l9 9v8l-9 9H24z"/><path d="M47 8 35 30l7 2-20 26" strokeWidth={3}/></>,\n`,
);

// PNG exports.
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();
const pngs = [
  ["darbe-h-icon.svg", "darbe-h-icon-192.png", 192],
  ["darbe-h-icon.svg", "darbe-h-icon-512.png", 512],
  ["darbe-h-maskable.svg", "darbe-h-maskable-512.png", 512],
  ["darbe-h-icon.svg", "darbe-h-apple-touch-180.png", 180],
  ["darbe-h-favicon.svg", "darbe-h-favicon-32.png", 32],
];
for (const [src, out, size] of pngs) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${files[src].replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`,
  );
  await page.screenshot({ path: join(OUT, out), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
}
await browser.close();
console.log("wrote", Object.keys(files).length, "svg +", pngs.length, "png to", OUT);
