import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const read = (relative) => readFileSync(join(root, relative), "utf8");

const OBSOLETE_TERMS = [
  "hoangsonww",
  "Son Nguyen",
  "OMerkel",
  "Oliver Merkel",
  "oakmac",
  "Chris Oakman",
  "chessboard.js",
  "chess.js",
  "jQuery",
  "/licenses/",
];

test("credits.html kaldırılmış Classics bağımlılıklarını içermez", () => {
  const html = read("public/credits.html");
  for (const term of OBSOLETE_TERMS) {
    assert.equal(html.includes(term), false, `credits.html hâlâ "${term}" içeriyor`);
  }
});

test("credits.html güncel yaratıcı bilgisini ve gerekli grupları taşır", () => {
  const html = read("public/credits.html");
  assert.match(html, /Tarık Halil Ayaz/);
  assert.match(html, /Tarık, annesinin oğludur\./);
  assert.match(read("public/i18n/tlab-i18n.js"), /Tarık is his mother's son\./);
  assert.match(html, /TLab Classics/);
  assert.match(html, /Labirent/);
  assert.match(html, /Tek Taş/);
  assert.match(html, /Satranç/);
  assert.match(html, /TC SIM/);
  assert.match(html, /Bükücü/);
  assert.match(html, /HANEDANIAN/);
});

test("resources catalog stays aligned with the canonical game catalog", () => {
  const catalog = read("src/lib/games.ts");
  const html = read("public/credits.html");
  const en = read("public/i18n/tlab-i18n.js");
  const games = [
    ...catalog.matchAll(
      /\{\s*slug: "([^"]+)",[\s\S]*?title: "([^"]+)",[\s\S]*?status: "(live|soon)",[\s\S]*?href: (?:"([^"]+)"|null),[\s\S]*?\}/g,
    ),
  ].map((m) => ({ slug: m[1], title: m[2], status: m[3], href: m[4] || null }));
  assert.equal(games.length, 18);
  assert.equal(games.filter((g) => g.status === "live").length, 18);
  assert.deepEqual(
    games.filter((g) => g.status === "soon").map((g) => g.slug),
    [],
  );
  assert.match(html, /data-live-count="18" data-soon-count="0"/);
  for (const game of games) {
    assert.match(html, new RegExp(`data-game="${game.slug}" data-status="${game.status}"`));
    assert.ok(html.includes(`data-route="${game.href}"`), `${game.slug} route must match catalog`);
    assert.ok(html.includes(`href="${game.href}"`), `${game.slug} needs a usable link`);
    assert.ok(en.includes(game.title), `${game.title} needs English resources coverage`);
    assert.ok(en.includes(`href="${game.href}"`), `${game.slug} needs an English route`);
  }
});

test("resources describes current products and technical contract in both languages", () => {
  const tr = read("public/credits.html");
  const en = read("public/i18n/tlab-i18n.js");
  for (const term of [
    "Extreme Last 100 Days",
    "Uzun Gölge",
    "üç yerel slot",
    "Türkçe ve İngilizce",
    "telefon, tablet ve masaüstü",
  ])
    assert.match(tr, new RegExp(term));
  for (const term of [
    "Extreme Last 100 Days",
    "Long Shadows",
    "three local slots",
    "Turkish and English",
    "phone, tablet and desktop",
  ])
    assert.match(en, new RegExp(term));
});

test("credits linki portal ana sayfasında hâlâ çalışır durumda", () => {
  const html = read("src/components/portal/portal-home.tsx");
  assert.match(html, /href="\/credits\.html"/);
  assert.match(html, /Tüm hakları saklıdır/);
});

test("TC SIM footer'ı tam isim kullanır ve yardım kontrolü kabloludur", () => {
  const app = read("public/games/tc-sim/js/app.js");
  assert.match(app, /Tarık Halil Ayaz/);
  assert.equal(app.includes("Oyun tasarımı ve özgün içerik: Tarık.<"), false);
  assert.match(app, /import \{ renderHelpModal \} from "\.\/help\.js/);
  assert.match(app, /id="help-open"/);
  assert.match(app, /helpOpen = false/);
  const help = read("public/games/tc-sim/js/help.js");
  assert.match(help, /id="help-close"/);
});

test("Çete Savaşları HUD'una gerçek bir yardım kontrolü bağlanmış", () => {
  const hud = read("src/components/game/hud.tsx");
  assert.match(hud, /HelpPanel/);
  const panel = read("src/components/game/help-panel.tsx");
  assert.match(panel, /Nasıl Oynanır/);
  assert.match(panel, /DialogContent/);
  // Yardım metni gerçek mekanik terimlerini kullanmalı, jenerik olmamalı.
  for (const term of ["İcraat", "Tezgâh", "Emniyet", "kıdem", "kayıt slotun"]) {
    assert.ok(panel.includes(term), `help-panel.tsx "${term}" içermeli`);
  }
});

test("Hanedan'da yardım kontrolü hem başlıkta hem oyun içinde erişilebilir", () => {
  const html = read("public/games/hanedan/legacy.html");
  assert.match(html, /data-act":"help"/);
  assert.match(html, /function openHelp/);
  assert.match(html, /var HELP = \[/);
  // readOnly listesine eklenmiş olmalı: sezon kapansa/baskın sürse de erişilebilir.
  const readOnlyLine = html.match(/var readOnly = \[[^\]]*\];/)?.[0] ?? "";
  assert.match(readOnlyLine, /"help"/);
  // İçerik gerçek mekanikleri adlandırmalı.
  for (const term of ["Taht", "sözleşme", "Kefalet", "Sezon", "kicker"]) {
    assert.ok(html.includes(term), `Hanedan yardımı "${term}" içermeli`);
  }
  assert.match(html, /Tarık Halil Ayaz/);
});

test("Son Mahalle Bükücü'nün mevcut Nasıl Oynanır'ı eksik konuları da kapsar", () => {
  const html = read("public/games/bukucu/index.html");
  assert.match(html, /var RULES = \[/);
  assert.match(html, /data-act="pause"/);
  for (const term of ["Naci Bey", "Batma", "Kayıt", "Açık artırma", "Takas", "Nezaret", "Senet"]) {
    assert.ok(html.includes(term), `Bükücü RULES "${term}" içermeli`);
  }
  assert.match(html, /Tarık Halil Ayaz/);
});

test("Racon Manager kilitli kalır: mevcut yardım/menü mantığı bozulmamış", () => {
  const html = read("public/games/racon/index.html");
  assert.match(html, /data-act="yardim-ac"/);
  assert.match(html, /Tarık Halil Ayaz/);
});

test("TLab Classics telif satırları hâlâ tutarlı ve tam isim kullanıyor", () => {
  for (const game of ["labirent", "peg-solitaire", "satranc", "amiral-batti"]) {
    const html = read(`public/games/${game}/index.html`);
    assert.match(html, /© 2026 TarikLab\. Tüm hakları saklıdır\./);
    assert.match(html, /Tarık Halil Ayaz/);
    assert.match(html, /Klasik oyun kuralları üzerindeki hak iddiası/);
  }
});

test("credits distinguishes independent Classics from shipping application dependencies", () => {
  const html = read("public/credits.html");
  const dependencies = JSON.parse(read("package.json")).dependencies;
  for (const [pkg, label] of [
    ["react", "React"],
    ["zustand", "Zustand"],
    ["@tanstack/react-router", "TanStack Router"],
    ["@radix-ui/react-dialog", "Radix UI"],
    ["lucide-react", "Lucide"],
    ["zod", "Zod"],
  ]) {
    assert.ok(dependencies[pkg], `${pkg} is a shipped dependency`);
    assert.ok(html.includes(label), `${label} is credited`);
  }
  assert.match(read("src/game/store.ts"), /from "zustand"/);
  assert.match(read("src/components/game/game-shell.tsx"), /from "react"/);
  assert.doesNotMatch(html, /hiçbir oyun/);
  assert.doesNotMatch(html, /Çete Savaşları —[^<]*bağımlılığı yok/);
});
