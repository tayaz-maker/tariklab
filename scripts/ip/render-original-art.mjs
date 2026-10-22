// Renders TarikLab's share images from code only:
// inline SVG, CSS gradients and a seeded PRNG. No reference image, photo,
// font file or third-party asset is read. Re-run to reproduce byte-similar
// output: `node scripts/ip/render-original-art.mjs` (needs Playwright + Chromium).
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";

const mark = readFileSync(new URL("../../public/brand/app-mark.svg", import.meta.url), "utf8");

function rng(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

// A seeded network of nodes and links, drawn as SVG.
function network(w, h, seed, { nodes = 34, color = "#c9a86a", faint = "#3b4a56" } = {}) {
  const r = rng(seed);
  const pts = Array.from({ length: nodes }, () => [Math.round(r() * w), Math.round(r() * h)]);
  const lines = [];
  pts.forEach((p, i) => {
    const near = pts
      .map((q, j) => [j, (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2])
      .filter(([j]) => j !== i)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 2);
    for (const [j] of near) if (j > i) lines.push([p, pts[j]]);
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${lines
    .map(
      ([a, b], k) =>
        `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${k % 5 ? faint : color}" stroke-width="${k % 5 ? 1.2 : 2}" stroke-dasharray="${k % 3 ? "0" : "6 5"}"/>`,
    )
    .join(
      "",
    )}${pts.map((p, k) => `<circle cx="${p[0]}" cy="${p[1]}" r="${k % 6 ? 3 : 6}" fill="${k % 6 ? faint : color}"/>`).join("")}</svg>`;
}

const page = (w, h, body, bg) => `<!doctype html><html><head><style>
  html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:${bg};font-family:Georgia,"Times New Roman",serif;color:#efe6cf}
  .abs{position:absolute;inset:0}
</style></head><body>${body}</body></html>`;

const jobs = [
  {
    out: "public/og.jpg",
    w: 1200,
    h: 630,
    bg: "radial-gradient(900px 520px at 22% 30%, #22302a, #0c100e 70%)",
    body: `<div class="abs" style="opacity:.55">${network(1200, 630, 7, { nodes: 20, color: "#c9a86a", faint: "#2f3b35" })}</div>
      <div style="position:absolute;left:84px;top:150px;width:220px;height:220px">${mark.replace("<svg", '<svg width="220" height="220"')}</div>
      <div style="position:absolute;left:340px;top:176px;font-size:112px;letter-spacing:-2px">TarikLab</div>
      <div style="position:absolute;left:346px;top:318px;font:600 30px system-ui,sans-serif;letter-spacing:6px;color:#c9a86a">OYUN LABORATUVARI</div>
      <div style="position:absolute;left:346px;top:372px;font:400 26px system-ui,sans-serif;color:#b9b09a">20 oyun · tarayıcıda · sessiz</div>`,
  },
  {
    out: "public/x-banner.jpg",
    w: 1200,
    h: 264,
    bg: "linear-gradient(90deg, #0c100e, #1b2621 60%, #0c100e)",
    body: `<div class="abs" style="opacity:.45">${network(1200, 264, 11, { nodes: 14, color: "#c9a86a", faint: "#2f3b35" })}</div>
      <div style="position:absolute;left:60px;top:42px;width:180px;height:180px">${mark.replace("<svg", '<svg width="180" height="180"')}</div>
      <div style="position:absolute;left:276px;top:58px;font-size:92px">TarikLab</div>
      <div style="position:absolute;left:282px;top:176px;font:600 24px system-ui,sans-serif;letter-spacing:5px;color:#c9a86a">OYUN LABORATUVARI</div>`,
  },
];

const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium",
  args: ["--no-sandbox"],
});
for (const job of jobs) {
  const p = await browser.newPage({ viewport: { width: job.w, height: job.h } });
  await p.setContent(page(job.w, job.h, job.body, job.bg));
  writeFileSync(
    new URL(`../../${job.out}`, import.meta.url),
    await p.screenshot({ type: "jpeg", quality: 84 }),
  );
  console.log(job.out, `${job.w}x${job.h}`);
  await p.close();
}
await browser.close();
