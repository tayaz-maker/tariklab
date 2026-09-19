import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const read = (relative) => readFileSync(join(root, relative), "utf8");

await import("../public/i18n/tlab-i18n.js");
const I = globalThis.tlabI18n;

test("i18n runtime exists with stable language key", () => {
  assert.equal(I.KEY, "tariklab.language");
  assert.ok(typeof I.t === "function");
  assert.ok(typeof I.phrase === "function");
  assert.ok(typeof I.setLang === "function");
});

test("EN dictionary covers required portal and common keys", () => {
  const required = [
    "portal.lab",
    "portal.games",
    "portal.soon",
    "portal.sources",
    "portal.back",
    "footer.rights",
    "common.save",
    "common.load",
    "common.delete",
    "common.newGame",
    "common.howTo",
    "common.close",
    "nw.meetingNight",
    "devlet.reported",
    "devlet.known",
    "devlet.impl",
  ];
  for (const key of required) {
    assert.ok(I.EN[key], `missing EN key ${key}`);
    assert.equal(I.EN[key].includes(key), false, `raw key leaked in ${key}`);
  }
});

test("catalog EN covers every current public game slug", () => {
  const slugs = [...read("src/lib/games.ts").matchAll(/slug: "([^"]+)"/g)].map((match) => match[1]);
  assert.equal(slugs.length, 18);
  for (const slug of slugs) {
    assert.ok(I.CATALOG_EN[slug], slug);
    assert.ok(I.CATALOG_EN[slug].subtitle.length > 8, slug);
  }
});

test("legacy Hanedan catalog requests use the canonical HANEDANIAN translation", () => {
  assert.equal(I.CATALOG_EN.hanedan, I.CATALOG_EN.hanedanian);
  I.setLang("en");
  try {
    const canonical = I.catalogEntry("hanedanian", "HANEDANIAN", "Yeni strateji");
    const legacy = I.catalogEntry("hanedan", "Çete Savaşları: Hanedan", "Eski açıklama");
    assert.deepEqual(legacy, canonical);
    assert.equal(legacy.title, "HANEDANIAN");
  } finally {
    I.setLang("tr");
  }
});

test("TR fallback is used when language is Turkish", () => {
  I.setLang("tr");
  assert.equal(I.t("portal.soon", "Yakında"), "Yakında");
  assert.equal(I.phrase("Kaydet"), "Kaydet");
});

test("EN mode translates known phrases and falls back safely", () => {
  I.setLang("en");
  assert.equal(I.t("portal.soon", "Yakında"), "Coming Soon");
  assert.equal(I.phrase("Kaydet"), "Save");
  assert.equal(I.phrase("___missing_phrase___"), "___missing_phrase___");
  I.setLang("tr");
});

test("language switch does not invent a gameplay save key", () => {
  const src = read("public/i18n/tlab-i18n.js");
  assert.match(src, /tariklab\.language/);
  assert.doesNotMatch(src, /tariklab\.nextwave\..*language/);
  assert.doesNotMatch(src, /cete-save.*language/);
});

test("Next Wave and classics load the shared i18n script", () => {
  for (const file of [
    "public/games/apartman/index.html",
    "public/games/son-100-gun/index.html",
    "public/games/kayip-telefon/index.html",
    "public/games/tc-sim-devlet/index.html",
    "public/games/amiral-batti/index.html",
    "public/games/labirent/index.html",
    "public/games/peg-solitaire/index.html",
    "public/games/satranc/index.html",
    "public/games/tc-sim/index.html",
    "public/games/racon/index.html",
    "public/games/hanedan/legacy.html",
    "public/games/bukucu/index.html",
    "public/credits.html",
  ]) {
    assert.match(read(file), /\/i18n\/tlab-i18n\.js/, file);
  }
});

test("portal keeps canonical Turkish strings in source", () => {
  const portal = read("src/components/portal/portal-home.tsx");
  assert.match(portal, /Yakında/);
  assert.match(portal, /Tüm hakları saklıdır/);
  assert.match(portal, /Oyun Laboratuvarı/);
  assert.match(portal, /Kaynaklar/);
  assert.match(portal, /LanguageToggle/);
});

test("Çete help keeps canonical Turkish sections", () => {
  const help = read("src/components/game/help-panel.tsx");
  for (const term of ["İcraat", "Tezgâh", "Emniyet", "kıdem", "kayıt slotun", "Nasıl Oynanır"]) {
    assert.ok(help.includes(term), term);
  }
});

test("credits English pack exists and Amiral Battı stays credited", () => {
  assert.match(read("public/credits.html"), /Amiral Battı/);
  assert.match(read("public/credits.html"), /Tarık Halil Ayaz/);
  assert.match(JSON.stringify(I.CREDITS_EN), /Amiral Battı/);
  assert.match(I.CREDITS_EN.legal, /All rights reserved/);
});

test("service worker versions i18n assets", () => {
  const sw = read("public/sw.js");
  assert.match(sw, /cete-offline-v4/);
  assert.match(sw, /\/i18n\/deep-en\.js/);
  assert.match(sw, /\/i18n\/deep-en-final\.js/);
  assert.match(sw, /\/i18n\//);
});

test("Son 100 Gün still has 18 scenario names for EN phrase coverage", () => {
  const data = read("public/games/next-wave/son100-data.js");
  const names = [
    "Borç toparlanması",
    "Aile bakımı",
    "İş penceresi",
    "Beden hesabı",
    "Taşınma",
    "İlişki onarımı",
    "Yalnızlık / çevre",
    "İşsiz toparlanma",
    "Tezgâh denemesi",
    "Sınav / başvuru",
    "Düğün yükü",
    "Aile borcu",
    "Kira krizi",
    "Bakım nöbeti",
    "Tükenmişlik",
    "Yeni şehir",
    "Tebliğ / itiraz",
    "Yan iş / proje",
  ];
  for (const name of names) {
    assert.ok(data.includes(name), name);
    assert.equal(I.PHRASE[name] && I.PHRASE[name].length > 2, true, `EN phrase for ${name}`);
  }
});

test("i18n files exist on disk", () => {
  assert.equal(existsSync(join(root, "public/i18n/tlab-i18n.js")), true);
  assert.equal(existsSync(join(root, "public/i18n/boot.js")), true);
  assert.equal(existsSync(join(root, "public/i18n/deep-en.js")), true);
  assert.equal(existsSync(join(root, "public/i18n/deep-en-final.js")), true);
  assert.equal(existsSync(join(root, "src/lib/i18n.ts")), true);
  assert.equal(existsSync(join(root, "src/lib/i18n-phrases.ts")), true);
});
