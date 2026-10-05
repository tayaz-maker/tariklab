#!/usr/bin/env node
// Human visual-QA sampler for a card-art pack.
//
//   npm run art:gallery -- --pack <dir> [--out dir] [--per-class 4] [--all] [--shots]
//
// Builds a self-contained gallery (index.html + copied images) sampling every
// game by scene class (character/object/location/event/action/institution),
// with the card name and effect beside each image and a checklist for
// anatomy, scene variety, name-scene fit, readability and forbidden real
// people / logos / text. --shots captures it at 320, 390 and 1440 px wide.
// The automated gate never marks art quality as PASS; this page is where a
// person decides, and its exported JSON is the sign-off release.mjs expects.
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { GAMES, validateGame, finalizeReport, releaseIdFor } from "./lib.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(`--${n}`) ? args[args.indexOf(`--${n}`) + 1] : d);
const packRoot = resolve(opt("pack", ""));
const outDir = resolve(opt("out", join(repoRoot, "artifacts/card-art-gallery")));
const perClass = Number(opt("per-class", 4));
const all = args.includes("--all");
const CHECKS = [
  ["anatomy", "Anatomi doğal (el/yüz/uzuv)"],
  ["variety", "Sahne/poz diğer kartlardan farklı"],
  ["fit", "Kart adı ve etkisiyle uyumlu"],
  ["readable", "Kart boyutunda okunur"],
  ["clean", "Gerçek kişi, logo, bayrak, üniforma, yazı yok"],
];

const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

// Even spread across the id range inside each scene class, so samples are not all early ids.
function sample(cards) {
  if (all) return cards;
  const groups = new Map();
  for (const c of cards) {
    const k = c.sceneClass || "unknown";
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  }
  const picked = [];
  for (const list of groups.values()) {
    const n = Math.min(perClass, list.length);
    for (let i = 0; i < n; i++) picked.push(list[Math.floor((i * list.length) / n)]);
  }
  return picked.sort((a, b) => a.id.localeCompare(b.id));
}

mkdirSync(join(outDir, "img"), { recursive: true });
const results = Object.keys(GAMES).map((game) => validateGame({ repoRoot, packRoot, game }));
const report = finalizeReport(results, { packLabel: packRoot, decodeMode: "gallery" });
const sections = [];
for (const r of results) {
  const spec = GAMES[r.game];
  const present = r.cards.filter((c) => c.sha256);
  const passAll = report.games[r.game].manifestPass === 300;
  const releaseId = passAll ? releaseIdFor(present) : null;
  const tiles = sample(present).map((c) => {
    const file = `${r.game}-${c.id}.webp`;
    copyFileSync(
      join(packRoot, "public/games", r.game, "assets/cards", `${c.id}.webp`),
      join(outDir, "img", file),
    );
    const source = r.cards.find((x) => x.id === c.id);
    const checks = CHECKS.map(
      ([k, label]) => `<label><input type="checkbox" data-check="${k}"> ${esc(label)}</label>`,
    ).join("");
    return `<figure class="tile ${c.status}" data-game="${r.game}" data-id="${c.id}">
  <img src="img/${file}" width="${spec.width}" height="${spec.height}" alt="${esc(c.name)}" loading="lazy" style="aspect-ratio:${spec.width}/${spec.height}">
  <figcaption><b>${c.id}</b> · ${esc(c.name)} <span class="tag">${esc(c.kind)} · ${esc(c.sceneClass)}</span>
  <span class="gate">${c.status === "manifest-pass" ? "manifest-pass (kalite değil)" : `REJECTED: ${esc(source.reasons.join("; "))}`}</span>
  <fieldset>${checks}<label><input type="checkbox" data-check="reject"> <b>Reddet</b></label></fieldset></figcaption>
</figure>`;
  });
  sections.push(`<section data-game="${r.game}" data-release="${releaseId || ""}">
<h2>${r.game} — ${report.games[r.game].manifestPass}/300 manifest-pass · ${spec.width}×${spec.height} · ${releaseId ? `release ${releaseId}` : "release yok (300/300 değil)"}</h2>
<div class="grid g-${r.game}">${tiles.join("\n")}</div></section>`);
}

const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kart Sanatı QA</title><style>
:root{--bg:#f4f1ea;--fg:#1d1b18;--mut:#6b655c;--card:#fff;--bad:#a3261b;--line:#d9d3c7}
@media (prefers-color-scheme:dark){:root{--bg:#141311;--fg:#ece8df;--mut:#a39d92;--card:#1f1d1a;--bad:#ff7a6b;--line:#3a3631}}
*{box-sizing:border-box}body{margin:0;padding:16px;background:var(--bg);color:var(--fg);font:14px/1.4 system-ui,sans-serif}
header{max-width:1400px;margin:0 auto 16px}h1{font-size:20px;margin:0 0 6px}p{color:var(--mut);margin:4px 0}
section{max-width:1400px;margin:0 auto 32px}h2{font-size:16px;border-bottom:1px solid var(--line);padding-bottom:6px}
.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr))}
.g-darbe-h{grid-template-columns:repeat(auto-fill,minmax(min(100%,200px),1fr))}
.tile{margin:0;background:var(--card);border:1px solid var(--line);border-radius:8px;overflow:hidden}
.tile img{display:block;width:100%;height:auto}.tile.rejected{border-color:var(--bad)}
figcaption{padding:8px;display:grid;gap:4px}.tag{color:var(--mut);font-size:12px}.gate{font-size:12px;color:var(--mut)}.rejected .gate{color:var(--bad)}
fieldset{border:0;padding:0;margin:4px 0 0;display:grid;gap:2px;font-size:12px}
button{cursor:pointer;font:inherit;padding:8px 12px;border-radius:6px;border:1px solid var(--line);background:var(--card);color:var(--fg)}
pre{white-space:pre-wrap;word-break:break-all;font-size:12px}
</style></head><body><header><h1>Kart sanatı görsel QA örneklemi</h1>
<p>${esc(report.line)} · manifest-pass yalnız bütünlük kontrolüdür; sanat kalitesi kararı bu sayfada bir insan tarafından verilir.</p>
<p>Örnekleme: her oyunda sahne sınıfı başına ${all ? "tüm kartlar" : `${perClass} kart`} (insan/nesne/mekân/olay/eylem/kurum), ID aralığına yayılmış.</p>
<button id="export">İmza JSON'u üret</button><pre id="out"></pre></header>
${sections.join("\n")}
<script>
document.getElementById("export").onclick = () => {
  const out = [];
  for (const s of document.querySelectorAll("section")) {
    const tiles = [...s.querySelectorAll(".tile")];
    const failed = tiles.filter((t) => t.querySelector('[data-check="reject"]').checked || [...t.querySelectorAll('[data-check]:not([data-check="reject"])')].some((c) => !c.checked)).map((t) => t.dataset.id);
    out.push({ game: s.dataset.game, releaseId: s.dataset.release || null, verdict: s.dataset.release && !failed.length ? "PASS" : "FAIL", sampled: tiles.length, failed, reviewer: "", date: new Date().toISOString().slice(0, 10) });
  }
  document.getElementById("out").textContent = JSON.stringify(out, null, 2);
};
</script></body></html>`;
writeFileSync(join(outDir, "index.html"), html);
console.log(`gallery: ${join(outDir, "index.html")}`);

if (args.includes("--shots")) {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch(
    process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  );
  for (const width of [320, 390, 1440]) {
    const page = await browser.newPage({ viewport: { width, height: width < 800 ? 844 : 900 } });
    await page.goto(`file://${join(outDir, "index.html")}`);
    await page.evaluate(() =>
      Promise.all(
        [...document.images].map((i) => ((i.loading = "eager"), i.decode().catch(() => null))),
      ),
    );
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    await page.screenshot({
      path: join(outDir, `gallery-${width}.png`),
      fullPage: width !== 1440 ? false : true,
    });
    console.log(`shot ${width}px (horizontal overflow ${overflow}px)`);
    await page.close();
  }
  await browser.close();
}
