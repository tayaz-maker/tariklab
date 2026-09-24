// Renders TarikLab's share images and the JITEM backdrops from code only:
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

// Seeded contour-like strokes: no real geography.
function contours(w, h, seed) {
  const r = rng(seed);
  const paths = [];
  for (let i = 0; i < 26; i += 1) {
    const y0 = (i / 26) * h;
    let d = `M0 ${y0.toFixed(1)}`;
    for (let x = 0; x <= w; x += 64)
      d += ` L${x} ${(y0 + Math.sin(x / 180 + i) * 28 + (r() - 0.5) * 22).toFixed(1)}`;
    paths.push(
      `<path d="${d}" fill="none" stroke="#2a3a44" stroke-width="1" opacity="${0.35 + r() * 0.4}"/>`,
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${paths.join("")}</svg>`;
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
  {
    out: "public/games/jitem-derin-ag/og.jpg",
    w: 1200,
    h: 630,
    bg: "radial-gradient(900px 600px at 70% 40%, #1a2530, #07090c 72%)",
    body: `<div class="abs">${contours(1200, 630, 3)}</div><div class="abs">${network(1200, 630, 19, { nodes: 30 })}</div>
      <div style="position:absolute;left:80px;top:170px;font:600 26px system-ui,sans-serif;letter-spacing:8px;color:#c9a86a">1986–1996</div>
      <div style="position:absolute;left:74px;top:210px;font-size:124px;letter-spacing:-1px">JITEM</div>
      <div style="position:absolute;left:80px;top:360px;font-size:62px;color:#d8cdb4">Derin Ağ</div>
      <div style="position:absolute;left:82px;top:452px;font:400 24px system-ui,sans-serif;color:#9aa6ae">Kaynaklı kayıtlar · ilişki ağı · asimetrik bilgi</div>`,
  },
  {
    out: "public/games/jitem-derin-ag/x-banner.jpg",
    w: 1200,
    h: 264,
    bg: "linear-gradient(90deg, #07090c, #16202a 55%, #07090c)",
    body: `<div class="abs">${network(1200, 264, 23, { nodes: 18 })}</div>
      <div style="position:absolute;left:64px;top:52px;font-size:96px">JITEM</div>
      <div style="position:absolute;left:380px;top:80px;font-size:52px;color:#d8cdb4">Derin Ağ</div>
      <div style="position:absolute;left:384px;top:152px;font:600 22px system-ui,sans-serif;letter-spacing:7px;color:#c9a86a">1986–1996</div>`,
  },
  {
    out: "public/games/jitem-derin-ag/images/map.jpg",
    w: 1792,
    h: 1008,
    bg: "radial-gradient(1400px 900px at 50% 45%, #15202a, #06080b 75%)",
    body: `<div class="abs">${contours(1792, 1008, 5)}</div><div class="abs">${network(1792, 1008, 29, { nodes: 46 })}</div>`,
  },
  {
    out: "public/games/jitem-derin-ag/images/office.jpg",
    w: 1792,
    h: 1008,
    bg: "radial-gradient(700px 520px at 62% 30%, #3a3222, #0b0a08 70%)",
    body: `<div class="abs">${(() => {
      const r = rng(41);
      let s = "";
      for (let i = 0; i < 18; i += 1) {
        const x = 180 + r() * 1300,
          y = 380 + r() * 520,
          w = 220 + r() * 180,
          h = 150 + r() * 90,
          a = (r() - 0.5) * 14;
        s += `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;transform:rotate(${a}deg);background:linear-gradient(#d8cdb4,#b9ab8c);opacity:${0.18 + r() * 0.3};border-top:10px solid #8a6a36"></div>`;
      }
      return s;
    })()}</div><div class="abs" style="background:linear-gradient(transparent 55%, #0b0a08)"></div>`,
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
