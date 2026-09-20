import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

const root = new URL("../", import.meta.url).pathname;
const read = (relative) => readFileSync(join(root, relative), "utf8");

function loadI18n() {
  const context = {
    localStorage: {
      getItem: () => "en",
      setItem() {},
    },
    addEventListener() {},
    document: undefined,
  };
  vm.runInNewContext(read("public/i18n/tlab-i18n.js"), context);
  vm.runInNewContext(read("public/i18n/deep-en.js"), context);
  vm.runInNewContext(read("public/i18n/deep-en-final.js"), context);
  vm.runInNewContext(read("public/i18n/expansion-en.js"), context);
  return context.tlabI18n;
}

function grab(src, keys) {
  const found = new Set();
  for (const k of keys) {
    const re = new RegExp(`${k}:\\s*"([^"]+)"`, "g");
    let m;
    while ((m = re.exec(src))) found.add(m[1]);
  }
  return [...found];
}

const I = loadI18n();
I.setLang("en");

const LIVE = [
  "cete-savaslari",
  "hanedan",
  "racon",
  "tc-sim",
  "bukucu",
  "labirent",
  "peg-solitaire",
  "satranc",
  "amiral-batti",
  "son-kasaba",
  "veto-h",
  "gett-oh",
  "apartman",
  "kayip-telefon",
  "son-100-gun",
  "tc-sim-devlet",
  "ihtilal",
  "darbe-h",
];

test("deep-en overlay exists and extends PHRASE", () => {
  assert.equal(existsSync(join(root, "public/i18n/deep-en.js")), true);
  assert.equal(existsSync(join(root, "public/i18n/deep-en-final.js")), true);
  assert.ok(I.DEEP_EN);
  assert.ok(I.DEEP_EN_FINAL);
  assert.ok(Object.keys(I.DEEP_EN).length > 400);
  assert.ok(Object.keys(I.DEEP_EN_FINAL).length > 400);
  assert.equal(I.phrase("Toplantı Gecesi"), "Meeting Night");
  assert.equal(I.phrase("Uzun Gölge"), "Long Shadow");
  assert.equal(I.phrase("Yönetimi Devral"), "Take Management");
  assert.equal(I.phrase("Devleti Devral"), "Take the State");
  assert.equal(I.phrase("Bu telefon senin değil."), "This phone is not yours.");
  assert.equal(I.phrase("YÖNETİMİ DEVRAL"), "TAKE MANAGEMENT");
  assert.equal(I.phrase("100 GÜNÜ BAŞLAT"), "BEGIN 100 DAYS");
});

test("required EN keys missing = 0", () => {
  const required = I.requiredEnKeys;
  const missing = required.filter((key) => !I.EN[key] || I.EN[key].includes(key));
  assert.equal(missing.length, 0, missing.join(", "));
});

test("catalog EN covers 18 LIVE games including İhtilâl and DARBE-H!", () => {
  assert.equal(LIVE.length, 18);
  for (const slug of LIVE) {
    assert.ok(I.CATALOG_EN[slug], slug);
    assert.ok(I.CATALOG_EN[slug].subtitle.length > 8, slug);
  }
  assert.match(I.CATALOG_EN.ihtilal.subtitle, /archive does not forget/i);
});

test("Next Wave deep titles have EN phrases", () => {
  const files = [
    "public/games/next-wave/apartman-data.js",
    "public/games/next-wave/son100-data.js",
    "public/games/next-wave/kayip-data.js",
    "public/games/next-wave/devlet-data.js",
  ];
  const missing = [];
  for (const file of files) {
    const strings = grab(read(file), ["title", "name", "label", "goal", "intent"]);
    for (const s of strings) {
      const en = I.phrase(s);
      if (en === s && /[çğıöşüÇĞİÖŞÜ]/.test(s) && !/^[A-ZÇĞİÖŞÜÂ][a-zçğıöşüâ'’]+(?: [A-ZÇĞİÖŞÜÂ][a-zçğıöşüâ'’]+)+$/.test(s)) {
        missing.push(`${file}: ${s}`);
      }
    }
  }
  assert.equal(missing.length, 0, missing.slice(0, 12).join(" | "));
});

test("Hayat and DEVLET help describe current shells", () => {
  assert.match(I.HELP_EN["tc-sim-devlet"], /Advance Month/);
  assert.match(I.HELP_EN["tc-sim-devlet"], /reported/i);
  assert.doesNotMatch(I.HELP_EN["tc-sim-devlet"], /in-game period selector/i);
});

test("Turkish canonical strings remain in source", () => {
  assert.match(read("src/components/portal/portal-home.tsx"), /Yakında/);
  assert.match(read("public/games/apartman/app.js"), /YÖNETİMİ DEVRAL/);
  assert.match(read("public/games/tc-sim-devlet/app.js"), /DEVLETİ DEVRAL/);
  assert.match(read("public/games/next-wave/apartman-data.js"), /Asansör ses yapıyor/);
});

test("language preference key is isolated from gameplay saves", () => {
  assert.match(read("public/i18n/tlab-i18n.js"), /tariklab\.language/);
  assert.doesNotMatch(read("public/games/next-wave/shared/runtime.js"), /tariklab\.language/);
});

test("Next Wave shells wrap data through loc and load deep-en", () => {
  for (const file of [
    "public/games/apartman/app.js",
    "public/games/son-100-gun/app.js",
    "public/games/kayip-telefon/app.js",
    "public/games/tc-sim-devlet/app.js",
  ]) {
    assert.match(read(file), /\bloc\b/, file);
  }
  for (const file of [
    "public/games/apartman/index.html",
    "public/games/tc-sim/index.html",
    "public/games/racon/index.html",
  ]) {
    assert.match(read(file), /\/i18n\/deep-en\.js/, file);
    assert.match(read(file), /\/i18n\/deep-en-final\.js/, file);
  }
});

test("DEVLET does not leak raw foreign/policy-debt keys", () => {
  const src = read("public/games/tc-sim-devlet/app.js");
  assert.match(src, /function ax\(/);
  assert.doesNotMatch(src, /key\.replaceAll\("_", " "\)/);
});

test("Kayıp Telefon thread slang has EN phrases", () => {
  for (const line of [
    "nerdesin ya",
    "müşteri 16:00ı bekliyo",
    "annene söyleme",
    "bu maili dışarı taşıma",
  ]) {
    const en = I.phrase(line);
    assert.notEqual(en, line, line);
  }
});

test("TC SIM catalog and help critical strings have EN", () => {
  for (const line of [
    "Market Çalışanı",
    "Paylaşımlı Ev",
    "Her hafta 6 zaman/odak bloğun var (sağlığın kritikse 3'e düşer). İş, eğitim, aile ve sosyal hayat aynı bütçeyi paylaşır; haftayı erken kapatabilir, yorgunluk ve ertelenen sonuçları göze alabilirsin. Maaş, kira ve düzenli giderler ay sonunda otomatik işler.",
    "Mütevazı",
    "Dertleş",
  ]) {
    const en = I.phrase(line);
    assert.notEqual(en, line, line);
  }
});

test("Çete job and shop copy has EN phrases", () => {
  for (const line of [
    "Pavyon Çıkışı Sarhoş Soyma",
    "Torba Tutma ve Köşe Başları",
    "Hayalet Canik TP9",
    "Tek köşe",
  ]) {
    const en = I.phrase(line);
    assert.notEqual(en, line, line);
  }
});
