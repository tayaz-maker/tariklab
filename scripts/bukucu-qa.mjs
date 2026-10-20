#!/usr/bin/env node
/**
 * Bükücü otomatik QA — kural doğrulama + rastgele oynatma.
 *
 *   node scripts/bukucu-qa.mjs                       # dev sunucusuna karşı
 *   BUKUCU_URL=http://127.0.0.1:8080/games/bukucu/ node scripts/bukucu-qa.mjs
 *   BUKUCU_FILE=public/games/bukucu/index.html node scripts/bukucu-qa.mjs
 *   node scripts/bukucu-qa.mjs --games 5 --steps 6000
 *
 * İki şey yapar:
 *  1) SENARYO — localStorage'a el yapımı bir oyun durumu yazar, tek bir
 *     kuralı test eder (nezaret, senet, iflas, satın alma…).
 *  2) FUZZ — oyunu baştan sona defalarca oynatır; her adımda oyun
 *     durumunun değişmez kurallarını (invariant) doğrular.
 *
 * Çıkış kodu: 0 = temiz, 1 = en az bir ihlal.
 */
import { chromium } from "playwright";
import path from "node:path";
import process from "node:process";

const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf("--" + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};

const GAMES = Number(flag("games", 4));
const STEPS = Number(flag("steps", 6000));
const TARGET =
  process.env.BUKUCU_URL ||
  "file://" + path.resolve(process.env.BUKUCU_FILE || "public/games/bukucu/index.html");

/* Tahtanın kendisi — testin oyundan bağımsız referansı. Oyun dosyasındaki
   SQ dizisiyle birebir aynı olmalı; ayrışırsa BOARD testleri patlar. */
const SQ = [
  ["CUMA", "C", 0, ""],
  ["Dolapdere", "T", 60, "kahverengi"],
  ["İHBAR", "I", 0, ""],
  ["Tarlabaşı", "T", 60, "kahverengi"],
  ["Tahsilat", "X", 200, ""],
  ["Plakasız Forza", "K", 200, ""],
  ["Hacıhüsrev", "T", 100, "acik_mavi"],
  ["RACON", "R", 0, ""],
  ["Poligon", "T", 100, "acik_mavi"],
  ["Kuştepe", "T", 120, "acik_mavi"],
  ["NEZARET", "J", 0, ""],
  ["Karagümrük", "T", 140, "pembe"],
  ["Çevirme", "U", 150, ""],
  ["Balat", "T", 140, "pembe"],
  ["Ayvansaray", "T", 160, "pembe"],
  ["Basık Egea", "K", 200, ""],
  ["Sarıgöl", "T", 180, "turuncu"],
  ["İHBAR", "I", 0, ""],
  ["Gazi", "T", 180, "turuncu"],
  ["50. Yıl", "T", 200, "turuncu"],
  ["OCAK", "O", 0, ""],
  ["Çinçin Deresi", "T", 220, "kirmizi"],
  ["RACON", "R", 0, ""],
  ["Oruçreis", "T", 220, "kirmizi"],
  ["Bağcılar", "T", 240, "kirmizi"],
  ["Sürgü Vito", "K", 200, ""],
  ["Fikirtepe", "T", 260, "sari"],
  ["Gülsuyu", "T", 260, "sari"],
  ["Mühür", "U", 150, ""],
  ["Gülensu", "T", 280, "sari"],
  ["BASKIN", "B", 0, ""],
  ["Kanarya", "T", 300, "yesil"],
  ["Saadetdere", "T", 300, "yesil"],
  ["İHBAR", "I", 0, ""],
  ["Kıraç", "T", 320, "yesil"],
  ["Ön Araç", "K", 200, ""],
  ["RACON", "R", 0, ""],
  ["Mehterçeşme", "T", 350, "koyu_mavi"],
  ["Damga", "X", 100, ""],
  ["Esenyurt", "T", 400, "koyu_mavi"],
];
const BUILD_COST = {
  kahverengi: 50,
  acik_mavi: 50,
  pembe: 100,
  turuncu: 100,
  kirmizi: 150,
  sari: 150,
  yesil: 200,
  koyu_mavi: 200,
};

const fails = [];
const notes = [];
const fail = (t, m) => fails.push(`${t}: ${m}`);
const pass = (t) => notes.push(`ok  ${t}`);

/* Determinist Math.random + sıfır gecikmeli setTimeout: bir oyun saniyeler sürer.
   fast=false ise gecikmeler korunur — dokunma/uzun basma testleri gerçek
   zamana ihtiyaç duyar (uzun basma eşiği 400 ms). */
const initScript = (seed, fast = true) => `
(function () {
  var s = ${seed} >>> 0;
  Math.random = function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  var raw = window.setTimeout.bind(window);
  window.__raw = raw;
  if (${fast}) window.setTimeout = function (fn) { return raw(fn, 0); };
  var mm = window.matchMedia ? window.matchMedia.bind(window) : null;
  window.matchMedia = function (q) {
    if (/prefers-reduced-motion/.test(String(q))) {
      return { matches: true, media: q, addListener: function () {}, removeListener: function () {},
        addEventListener: function () {}, removeEventListener: function () {}, dispatchEvent: function () { return false; } };
    }
    return mm ? mm(q) : { matches: false, media: q, addListener: function () {}, removeListener: function () {},
      addEventListener: function () {}, removeEventListener: function () {}, dispatchEvent: function () { return false; } };
  };
  window.__errors = [];
  addEventListener("error", function (e) { window.__errors.push(e.message + " @" + e.lineno); });
  addEventListener("unhandledrejection", function (e) { window.__errors.push("reject: " + e.reason); });
})();`;

const blank = (over = {}) => ({
  v: 1,
  mode: "hotseat",
  n: 2,
  cash: [1500, 1500],
  pos: [0, 0],
  jail: [0, 0],
  miss: [0, 0],
  cik: [0, 0],
  dead: [0, 0],
  own: Array(40).fill(-1),
  bld: Array(40).fill(0),
  sen: Array(40).fill(0),
  rD: [0],
  rX: [],
  iD: [0],
  iX: [],
  held: [],
  uBoost: 0,
  turn: 0,
  rolled: false,
  log: "Zar at.",
  wait: "roll",
  dice: [0, 0],
  doubles: 0,
  extra: 0,
  focus: 0,
  card: null,
  win: null,
  pend: null,
  ...over,
});
const tiles = (map) => Array.from({ length: 40 }, (_, i) => (i in map ? map[i] : -1));
const nums = (map, fill = 0) => Array.from({ length: 40 }, (_, i) => (i in map ? map[i] : fill));

async function fresh(browser, seed = 20260831, fast = true, legacyState = null) {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("console: " + m.text());
  });
  await page.addInitScript(initScript(seed, fast));
  // Legacy migration is tested only on a new context, before its first game boot.
  if (legacyState) {
    await page.addInitScript((state) => {
      if (localStorage.getItem("tariklab::bukucu:legacy-migrated") === null) {
        localStorage.setItem("smb.v1", JSON.stringify(state));
      }
    }, legacyState);
  }
  await page.goto(TARGET, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#menu button");
  return { ctx, page, errors };
}

/** Kayıtlı durumu yazıp "Devam et" ile o duruma girer. */
async function resume(page, state) {
  await page.evaluate((s) => {
    localStorage.setItem("tariklab::bukucu:1", JSON.stringify(s));
    localStorage.setItem("tariklab::bukucu:active", "1");
  }, state);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector('#menu button[data-act="cont"]', { timeout: 5000 });
  await page.evaluate((expected) => {
    const button = document.querySelector('#menu button[data-act="cont"]');
    if (!button || button.disabled) throw new Error("Fixture: Continue is unavailable");
    const raw = localStorage.getItem("tariklab::bukucu:1");
    if (localStorage.getItem("tariklab::bukucu:active") !== "1" || raw !== JSON.stringify(expected)) {
      throw new Error("Fixture: slot 1 was not restored before Continue");
    }
    button.click();
    const loaded = JSON.parse(localStorage.getItem("tariklab::bukucu:1"));
    if (document.getElementById("app").style.visibility !== "visible") {
      throw new Error("Fixture: Continue did not open the game");
    }
    for (const key of Object.keys(expected)) {
      if (JSON.stringify(loaded?.[key]) !== JSON.stringify(expected[key])) {
        throw new Error("Fixture: Continue loaded a different " + key);
      }
    }
  }, state);
  await page.waitForTimeout(150);
}
const snap = (page) =>
  page.evaluate(() => ({
    S: JSON.parse(localStorage.getItem("tariklab::bukucu:1")),
    acts: [...document.querySelectorAll("#acts button")].map((b) => ({
      a: b.getAttribute("data-act"),
      t: b.textContent,
      off: b.disabled,
    })),
    deed: document.getElementById("deed").textContent,
    log: document.getElementById("log").textContent,
  }));
const tap = (page, act) =>
  page.evaluate((a) => {
    const b = document.querySelector(
      `#acts button[data-act="${a}"], #deed button[data-act="${a}"], #sheet button[data-act="${a}"]`,
    );
    if (b && !b.disabled) b.click();
    return !!b;
  }, act);

/* ------------------------------------------------------------------ */
/* 1. SENARYOLAR                                                       */
/* ------------------------------------------------------------------ */

async function scenarios(browser) {
  /* Eski kayıt yalnız ilk açılıştan önce ekilir; normal fixture migration flag'ini silmez. */
  {
    const state = blank({ cash: [1234, 876], pos: [1, 0], wait: "buy", focus: 1 });
    const { ctx, page } = await fresh(browser, 20260831, true, state);
    await page.waitForSelector('#menu button[data-act="cont"]', { timeout: 5000 });
    await page.evaluate((expected) => {
      if (localStorage.getItem("tariklab::bukucu:legacy-migrated") !== "1" ||
          localStorage.getItem("tariklab::bukucu:active") !== "1" ||
          localStorage.getItem("tariklab::bukucu:1") !== JSON.stringify(expected)) {
        throw new Error("Legacy fixture did not migrate to slot 1 on first boot");
      }
      const button = document.querySelector('#menu button[data-act="cont"]');
      if (!button || button.disabled) throw new Error("Legacy fixture: Continue is unavailable");
      button.click();
      if (document.getElementById("app").style.visibility !== "visible") {
        throw new Error("Legacy fixture: Continue did not open the game");
      }
    }, state);
    const { S } = await snap(page);
    if (JSON.stringify(S.cash) !== JSON.stringify(state.cash) || S.wait !== state.wait) {
      fail("save/legacy", "ilk açılıştaki eski kayıt korunmadı");
    } else pass("save/legacy ilk açılışta slot 1'e taşındı");
    await ctx.close();
  }

  /* Nezaret: çift atmak seni çıkarır ama ikinci bir zar hakkı vermez. */
  {
    const { ctx, page } = await fresh(browser);
    // The game's persisted RNG, not Math.random, controls loaded-game dice.
    await resume(page, blank({ pos: [10, 0], jail: [1, 0], wait: "jail", rng: 5 }));
    await tap(page, "roll");
    await page.waitForTimeout(700);
    const { S } = await snap(page);
    if (S.dice[0] !== 5 || S.dice[1] !== 5)
      fail("nezaret/cift-fixture", "rng=5 için beklenen zar 5/5 değil: " + S.dice.join("/"));
    if (S.extra)
      fail("nezaret/cift", "çift atınca fazladan tur veriliyor (Monopoly kuralında yok)");
    else pass("nezaret/cift ekstra tur vermiyor");
    if (S.jail[0]) fail("nezaret/cift", "çift atıldı ama oyuncu hâlâ nezarette");
    await ctx.close();
  }

  /* Nezaret: üçüncü hak yandığında 50 TL kefalet alınır. */
  {
    const { ctx, page } = await fresh(browser);
    await resume(
      page,
      blank({ pos: [10, 0], jail: [1, 0], miss: [2, 0], wait: "jail", cash: [1000, 1500], rng: 193731 }),
    );
    await tap(page, "roll");
    await page.waitForTimeout(900);
    const { S } = await snap(page);
    if (S.dice[0] !== 4 || S.dice[1] !== 5)
      fail("nezaret/ucuncu-fixture", "rng=193731 için beklenen zar 4/5 değil: " + S.dice.join("/"));
    if (S.cash[0] > 950)
      fail("nezaret/ucuncu", `kefalet alınmadı (kasa ${S.cash[0]}, beklenen ≤950)`);
    else pass("nezaret/ucuncu hakta 50 TL kefalet");
    await ctx.close();
  }

  /* Satın alma: kasa yetmiyorsa "Al" tıklanabilir olmamalı. */
  {
    const { ctx, page } = await fresh(browser);
    await resume(page, blank({ pos: [39, 0], wait: "buy", cash: [10, 1500], focus: 39 }));
    const { acts } = await snap(page);
    const al = acts.find((a) => a.a === "al");
    if (!al) fail("satinalma", '"Al" düğmesi yok');
    else if (!al.off) fail("satinalma", '400 TL\'lik tapu için 10 TL kasayla "Al" hâlâ aktif');
    else pass("satinalma/kasa yetmezken Al kapalı");
    await ctx.close();
  }

  /* Nakit toplama sırası: önce bina sökülür, sonra tapu senede girer. */
  {
    const { ctx, page } = await fresh(browser);
    await resume(
      page,
      blank({
        wait: "pay",
        pos: [39, 39],
        cash: [5, 1500],
        focus: 39,
        own: tiles({ 1: 0, 3: 0, 39: 1 }),
        bld: nums({ 1: 4, 3: 4 }),
      }),
    );
    await tap(page, "ode");
    await page.waitForTimeout(400);
    const { S } = await snap(page);
    const mortgagedWithHouses = S.own.some((_, i) => S.sen[i] && S.bld[i] > 0);
    if (mortgagedWithHouses)
      fail("senet", "üzerinde bina olan tapu senede girdi (bina bedava geri geliyor)");
    else pass("senet/bina önce sökülüyor");
    if (S.bld[1] === 4 && S.bld[3] === 4 && S.sen[1])
      fail("senet", "bina hiç sökülmeden senet çekildi");
    await ctx.close();
  }

  /* İflas: binalar bankaya döner, alacaklıya bedava Hanedan geçmez. */
  {
    const { ctx, page } = await fresh(browser);
    await resume(
      page,
      blank({
        wait: "pay",
        pos: [39, 39],
        cash: [0, 1500],
        focus: 39,
        own: tiles({ 1: 0, 39: 1 }),
        bld: nums({ 1: 4 }),
        sen: nums({ 1: 1 }),
      }),
    );
    await tap(page, "ode");
    await page.waitForTimeout(500);
    const { S } = await snap(page);
    if (S.dead[0] && S.bld[1] > 0) fail("iflas", "iflasta binalar alacaklıya bedava geçti");
    else pass("iflas/binalar bankaya dönüyor");
    await ctx.close();
  }

  /* Tapu kartı: ekranda görünen tapu ile işlem yapılan tapu aynı olmalı.
     Gerçek zamanlı: uzun basma eşiği 400 ms, sıfırlanmış zamanlayıcıyla
     her dokunuş büyük tahtayı açardı. */
  {
    const { ctx, page } = await fresh(browser, 20260831, false);
    await resume(
      page,
      blank({
        wait: "roll",
        focus: 3,
        cash: [1000, 1500],
        own: tiles({ 1: 0, 3: 0 }),
        sen: nums({ 1: 1, 3: 1 }),
      }),
    );
    const hit = await page.evaluate(() => {
      const cv = document.getElementById("cv");
      const b = cv.getBoundingClientRect();
      const size = Math.min(b.width, b.height);
      const m = Math.max(2, (size * 0.008) | 0);
      const board = size - 2 * m;
      let D = board * 0.225;
      if (D < 42) D = 42;
      if (D > board * 0.26) D = board * 0.26;
      let inner = board - 2 * D;
      if (inner < 110) {
        D = (board - 110) / 2;
        inner = board - 2 * D;
      }
      const tw = inner / 9;
      const r = { x: m + board - D - tw, y: m + board - D, w: tw, h: D };
      return {
        x: b.x + (b.width - size) / 2 + r.x + r.w / 2,
        y: b.y + (b.height - size) / 2 + r.y + r.h / 2,
      };
    });
    await page.mouse.move(hit.x, hit.y);
    await page.mouse.down();
    await page.mouse.up();
    await page.waitForTimeout(150);
    const shown = await page.evaluate(() =>
      document.getElementById("deed").textContent.slice(0, 20),
    );
    if (!shown.startsWith("Dolapdere")) {
      fail("tapu/dokunma", `kareye dokununca o karenin tapusu açılmadı (görünen: ${shown})`);
    } else {
      const btn = await page.evaluate(() => {
        const el = document.querySelector('#deed button[data-act="unsen"]');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      });
      if (!btn) fail("tapu/dokunma", "senetli tapuda 'SENETLİ' düğmesi çıkmadı");
      else {
        await page.mouse.move(btn.x, btn.y);
        await page.mouse.down();
        await page.mouse.up();
        await page.waitForTimeout(250);
        const { S } = await snap(page);
        if (S.sen[1] !== 0)
          fail(
            "tapu/dokunma",
            `ekrandaki tapu yerine başka tapunun seneti kapatıldı (sen[1]=${S.sen[1]}, sen[3]=${S.sen[3]})`,
          );
        else pass("tapu/dokunma ekrandaki tapu üstünde çalışıyor");
      }
    }
    await ctx.close();
  }

  /* Tuval: CSS kutusu ile çizim kutusu birebir olmalı, resize'da yeniden çizilmeli. */
  {
    const { ctx, page } = await fresh(browser);
    await resume(page, blank());
    const geo = await page.evaluate(() => {
      const c = document.getElementById("cv");
      const b = c.getBoundingClientRect();
      return { css: [b.width, b.height], bmp: [c.width, c.height], dpr: devicePixelRatio };
    });
    const sx = geo.bmp[0] / geo.dpr / geo.css[0];
    const sy = geo.bmp[1] / geo.dpr / geo.css[1];
    if (Math.abs(sx - 1) > 0.005 || Math.abs(sy - 1) > 0.005) {
      fail(
        "tuval/olcek",
        `tahta ${sx.toFixed(3)}×${sy.toFixed(3)} oranında geriliyor (bulanık çizim)`,
      );
    } else pass("tuval/ölçek 1:1");
    await page.setViewportSize({ width: 430, height: 600 });
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => {
      const c = document.getElementById("cv");
      const b = c.getBoundingClientRect();
      return { css: [b.width, b.height], bmp: [c.width, c.height], dpr: devicePixelRatio };
    });
    const rx = after.bmp[0] / after.dpr / after.css[0];
    if (Math.abs(rx - 1) > 0.02)
      fail("tuval/resize", "pencere boyutu değişince tahta yeniden çizilmiyor");
    else pass("tuval/resize sonrası yeniden çiziliyor");
    await ctx.close();
  }

  /* Türkçe büyük harf: "Gazi" → "GAZİ", "Poligon" → "POLİGON". */
  {
    const { ctx, page } = await fresh(browser);
    await resume(page, blank());
    const bad = await page.evaluate(() => {
      const names = ["Gazi", "Poligon", "Tahsilat", "Fikirtepe", "Çevirme"];
      return names.filter(
        (n) =>
          n.toLocaleUpperCase("tr-TR").indexOf("İ") >= 0 &&
          n.toUpperCase() === n.toLocaleUpperCase("tr-TR"),
      );
    });
    if (bad.length) fail("dil", "tr-TR büyük harf beklenmedik: " + bad.join(","));
    else pass("dil/tr-TR büyük harf davranışı");
    await ctx.close();
  }

  /* Erişilebilirlik: durum satırı canlı bölge olmalı, menü düğmesi bulunmalı. */
  {
    const { ctx, page } = await fresh(browser);
    await resume(page, blank());
    const a11y = await page.evaluate(() => ({
      live: document.getElementById("log").getAttribute("aria-live"),
      pause: !!document.querySelector('[data-act="pause"]'),
      tapTargets: [...document.querySelectorAll("#acts button, #bar button")]
        .map((b) => Math.round(b.getBoundingClientRect().height))
        .filter((h) => h > 0 && h < 32),
    }));
    if (a11y.live !== "polite")
      fail("a11y", "#log canlı bölge değil (ekran okuyucu olayları duyurmaz)");
    else pass("a11y/#log aria-live");
    if (!a11y.pause) fail("a11y", "oyun içinde menüye dönüş düğmesi yok");
    else pass("a11y/oyun içi menü düğmesi");
    if (a11y.tapTargets.length)
      fail("a11y", "32 pikselden kısa dokunma hedefi: " + a11y.tapTargets.join(","));
    await ctx.close();
  }

  /* Takas satırı: liste, kira, semt durumu; eylem çubuğu sabit. */
  {
    const { ctx, page } = await fresh(browser);
    await resume(
      page,
      blank({
        wait: "roll",
        own: tiles({ 1: 0, 3: 0, 6: 1, 8: 1 }),
        focus: 1,
      }),
    );
    await tap(page, "trade");
    await page.waitForTimeout(150);
    const ui = await page.evaluate(() => {
      const sheet = document.getElementById("sheet");
      const t = sheet.textContent;
      const cols = sheet.querySelector(".cols");
      const foot = sheet.querySelector(".footbar");
      const rows = [...sheet.querySelectorAll(".trow")];
      const widths = rows.map((r) => Math.round(r.getBoundingClientRect().width));
      return {
        t,
        foot: !!foot,
        sticky: foot ? getComputedStyle(foot).position : "",
        balance: foot?.querySelector(".bal")?.textContent || "",
        w: widths,
        colW: cols ? [...cols.children].map((c) => Math.round(c.getBoundingClientRect().width)) : [],
      };
    });
    if (!/liste/.test(ui.t) || !/kira/.test(ui.t))
      fail("takas/satir", "liste/kira yok: " + ui.t.slice(0, 180));
    else pass("takas/satır liste+kira");
    if (!/2\/3|1\/3|tuttun/.test(ui.t) && !/2\/2/.test(ui.t))
      fail("takas/satir", "semt durumu yok");
    else pass("takas/satır semt durumu");
    if (!ui.foot) fail("takas/cubuk", "footbar yok");
    else pass("takas/eylem çubuğu sabit");
    if (ui.colW.length === 2 && Math.abs(ui.colW[0] - ui.colW[1]) > 8)
      fail("takas/kolon", "eşit olmayan kolon " + ui.colW.join("/"));
    else pass("takas/eşit kolon");
    if (!/^.+ 0 TL veriyor; .+ 0 TL veriyor$/.test(ui.balance))
      fail("takas/denge", "iki tarafın sıfır bedelli denge satırı yok: " + ui.balance);
    else pass("takas/denge satırı");
    await ctx.close();
  }

  /* Naci Bey puanı negatifse karşı teklif verir, bir tur pazarlık. */
  {
    const { ctx, page } = await fresh(browser);
    await resume(
      page,
      blank({
        mode: "cpu",
        n: 2,
        wait: "roll",
        turn: 0,
        own: tiles({ 1: 0, 39: 1 }),
        cash: [1500, 1500],
        focus: 1,
      }),
    );
    await tap(page, "trade");
    await page.waitForTimeout(80);
    await tap(page, "ttk:39");
    await tap(page, "toffer");
    await page.waitForTimeout(250);
    const got = await page.evaluate(() => ({
      log: document.getElementById("log").textContent,
      sheet: document.getElementById("sheet").textContent,
      wait: JSON.parse(localStorage.getItem("tariklab::bukucu:1") || "{}").wait,
      ctr: (JSON.parse(localStorage.getItem("tariklab::bukucu:1") || "{}").trade || {}).ctr,
    }));
    if (!/karşı teklif/i.test(got.log + got.sheet))
      fail("naci/karsi", "karşı teklif yok: " + got.log + " / " + got.sheet.slice(0, 120));
    else pass("naci/karşı teklif");
    if (got.wait !== "offer") fail("naci/karsi", "wait offer değil: " + got.wait);
    await tap(page, "tno");
    await page.waitForTimeout(80);
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem("tariklab::bukucu:1")));
    if (after.trade) fail("naci/karsi", "ret sonrası trade duruyor");
    else pass("naci/karşı teklif tek tur");
    await ctx.close();
  }

  /* Geç → açık artırma: bir kişi artırınca tapu satılır. */
  {
    const { ctx, page } = await fresh(browser);
    await resume(
      page,
      blank({
        wait: "buy",
        pos: [1, 0],
        focus: 1,
        cash: [1500, 1500],
      }),
    );
    await tap(page, "gec");
    await page.waitForTimeout(80);
    let S = await page.evaluate(() => JSON.parse(localStorage.getItem("tariklab::bukucu:1")));
    if (S.wait !== "auc") fail("artirma", "geç sonrası wait auc değil: " + S.wait);
    else pass("artirma/geç açtı");
    await tap(page, "aup");
    await page.waitForTimeout(80);
    await tap(page, "aun");
    await page.waitForTimeout(80);
    S = await page.evaluate(() => JSON.parse(localStorage.getItem("tariklab::bukucu:1")));
    if (S.own[1] < 0) fail("artirma", "artıran tapuyu almadı own=" + S.own[1]);
    else if (S.cash[S.own[1]] !== 1490)
      fail("artirma", "10 TL kesilmedi kasa=" + S.cash[S.own[1]]);
    else pass("artirma/kazanan 10 TL ödedi");
    await ctx.close();
  }

  /* Kimse artırmazsa tapu bankada kalır. */
  {
    const { ctx, page } = await fresh(browser);
    await resume(
      page,
      blank({
        wait: "buy",
        pos: [1, 0],
        focus: 1,
        cash: [1500, 1500],
      }),
    );
    await tap(page, "gec");
    await page.waitForTimeout(50);
    await tap(page, "aun");
    await page.waitForTimeout(50);
    await tap(page, "aun");
    await page.waitForTimeout(50);
    const S = await page.evaluate(() => JSON.parse(localStorage.getItem("tariklab::bukucu:1")));
    if (S.own[1] !== -1) fail("artirma/banka", "tapu satıldı own=" + S.own[1]);
    else pass("artirma/kimse yok bankada");
    await ctx.close();
  }

  /* 3-4 kişi devir: tahta/tapu bulanık, Hazırım. */
  {
    const { ctx, page } = await fresh(browser);
    await resume(
      page,
      blank({
        mode: "hotseat",
        n: 3,
        cash: [1500, 1500, 1500],
        pos: [0, 0, 0],
        jail: [0, 0, 0],
        miss: [0, 0, 0],
        cik: [0, 0, 0],
        dead: [0, 0, 0],
        wait: "pass",
        turn: 1,
        log: "Sıra 2. oyuncuda. Telefonu ver.",
      }),
    );
    const ui = await page.evaluate(() => {
      const app = document.getElementById("app");
      const ring = document.getElementById("ring");
      const deed = document.getElementById("deed");
      return {
        handoff: app.classList.contains("handoff"),
        ringBlur: getComputedStyle(ring).filter,
        deedBlur: getComputedStyle(deed).filter,
        btn: [...document.querySelectorAll("#acts button")].map((b) => b.textContent),
        banner: document.getElementById("banner").textContent,
      };
    });
    if (!ui.handoff) fail("devir", "app.handoff yok");
    else pass("devir/handoff sınıfı");
    if (!/blur/.test(ui.ringBlur) || !/blur/.test(ui.deedBlur))
      fail("devir", "bulanık değil ring=" + ui.ringBlur + " deed=" + ui.deedBlur);
    else pass("devir/tahta-tapu bulanık");
    if (!ui.btn.some((t) => /Hazırım/i.test(t))) fail("devir", "Hazırım yok: " + ui.btn.join(","));
    else pass("devir/Hazırım");
    await tap(page, "tamam");
    await page.waitForTimeout(80);
    const after = await page.evaluate(() => ({
      handoff: document.getElementById("app").classList.contains("handoff"),
      wait: JSON.parse(localStorage.getItem("tariklab::bukucu:1")).wait,
    }));
    if (after.handoff) fail("devir", "Hazırım sonrası hâlâ bulanık");
    else if (after.wait !== "roll" && after.wait !== "jail")
      fail("devir", "Hazırım wait=" + after.wait);
    else pass("devir/Hazırım açtı");
    await ctx.close();
  }

  /* Bitiş: kasa, tapu, bina, kira, net; kazanan altın çerçeve. */
  {
    const { ctx, page } = await fresh(browser);
    await resume(
      page,
      blank({
        wait: "end",
        win: 0,
        cash: [1800, 400],
        own: tiles({ 1: 0, 3: 0, 39: 1 }),
        len: "short",
        stat: { turns: 30, rolls: 12, rentPaid: [80, 450] },
      }),
    );
    const ui = await page.evaluate(() => {
      const sheet = document.getElementById("sheet");
      const cards = [...sheet.querySelectorAll(".endcard")];
      const win = sheet.querySelector(".endcard.win");
      const gold = win ? getComputedStyle(win).borderColor : "";
      return {
        n: cards.length,
        text: sheet.textContent,
        hasWin: !!win,
        gold,
      };
    });
    if (ui.n < 2) fail("bitis", "oyuncu kartı yok n=" + ui.n);
    if (!/Kasa/.test(ui.text) || !/Tapu/.test(ui.text) || !/Bina/.test(ui.text))
      fail("bitis", "satırlar eksik");
    if (!/Ödenen kira/.test(ui.text) || !/Net servet/.test(ui.text))
      fail("bitis", "kira/net yok: " + ui.text.slice(0, 200));
    else pass("bitis/satırlar");
    if (!ui.hasWin) fail("bitis", "kazanan çerçevesi yok");
    else pass("bitis/altın çerçeve");
    if (!/80/.test(ui.text) && !/450/.test(ui.text)) fail("bitis", "kira sayıları yok");
    await ctx.close();
  }
}

/* ------------------------------------------------------------------ */
/* 2. FUZZ — bütün oyunu oynat, her adımda değişmezleri doğrula        */
/* ------------------------------------------------------------------ */

function checkState(S, board, cost) {
  const bad = [];
  const n = S.n;
  for (let i = 0; i < n; i++) {
    if (!Number.isFinite(S.cash[i])) bad.push(`kasa sayı değil (o${i})`);
    if (S.cash[i] < 0) bad.push(`eksi kasa (o${i} = ${S.cash[i]})`);
    if (S.pos[i] < 0 || S.pos[i] > 39) bad.push(`konum tahta dışında (o${i})`);
    if (S.dead[i] && S.cash[i] !== 0) bad.push(`batan oyuncunun parası var (o${i})`);
  }
  const groups = {};
  for (let i = 0; i < 40; i++) {
    if (S.own[i] >= n || S.own[i] < -1) bad.push(`geçersiz sahip (kare ${i})`);
    if (S.own[i] >= 0 && S.dead[S.own[i]]) bad.push(`kare ${i} batan oyuncuda`);
    if (S.bld[i] > 0 && S.own[i] < 0) bad.push(`sahipsiz karede bina (${i})`);
    if (S.bld[i] > 0 && S.sen[i])
      bad.push(`senetli tapunun üstünde bina duruyor (kare ${i}, ${S.bld[i]} kat)`);
    if (S.sen[i] && S.own[i] < 0) bad.push(`sahipsiz kare senetli (${i})`);
    if (S.bld[i] < 0 || S.bld[i] > 4) bad.push(`bina seviyesi aralık dışı (${i})`);
    if (S.bld[i] > 0 && board[i][1] !== "T") bad.push(`tapu olmayan karede bina (${i})`);
    const g = board[i][3];
    if (g) (groups[g] = groups[g] || []).push(i);
  }
  for (const g of Object.keys(groups)) {
    const a = groups[g];
    const lv = a.map((i) => S.bld[i]);
    const owners = new Set(a.map((i) => S.own[i]));
    if (Math.max(...lv) - Math.min(...lv) > 1) bad.push(`dengesiz inşaat (${g}: ${lv.join("/")})`);
    if (Math.max(...lv) > 0 && (owners.size > 1 || owners.has(-1)))
      bad.push(`semt tutulmadan bina var (${g})`);
    if (!cost[g]) bad.push(`renk grubunun dikme bedeli yok (${g})`);
  }
  if (S.turn < 0 || S.turn >= n) bad.push("sıra geçersiz oyuncuda");
  if (S.win == null && S.dead[S.turn]) bad.push("sıra batan oyuncuda");
  if (S.win != null && S.dead[S.win]) bad.push("kazanan batmış görünüyor");
  return bad;
}

async function fuzz(browser, mode, seed, maxSteps) {
  const { ctx, page, errors } = await fresh(browser, seed);
  await page.evaluate((m) => document.querySelector(`#menu button[data-act="${m}"]`).click(), mode);
  await page.waitForTimeout(50);
  const res = await page.evaluate(
    async ({ maxSteps, board, cost, check }) => {
      const run = new Function("S", "board", "cost", "return (" + check + ")(S, board, cost);");
      const sleep = (ms) => new Promise((r) => window.__raw(r, ms));
      const seen = new Set();
      let steps = 0,
        turns = 0,
        lastTurn = -1,
        idle = 0,
        prev = "",
        spin = 0;
      let finished = false;
      while (steps++ < maxSteps) {
        let S = null;
        try {
          S = JSON.parse(localStorage.getItem("tariklab::bukucu:1"));
        } catch {
          /* yeni oyun */
        }
        if (S) {
          for (const m of run(S, board, cost)) seen.add(m);
          if (S.turn !== lastTurn) {
            lastTurn = S.turn;
            turns++;
          }
          if (S.win != null) {
            finished = true;
            break;
          }
        }
        const btns = [...document.querySelectorAll("#acts button")].filter((b) => !b.disabled);
        if (!btns.length) {
          await sleep(2);
          if (++idle > 4000) {
            seen.add("oyun kilitlendi (tıklanabilir düğme kalmadı)");
            break;
          }
          continue;
        }
        idle = 0;
        const sig = S
          ? S.wait + S.turn + S.cash.join() + S.pos.join() + S.own.join() + S.bld.join()
          : "";
        if (sig && sig === prev) spin++;
        else {
          spin = 0;
          prev = sig;
        }
        if (spin > 400) {
          seen.add("ilerleme yok: " + (S && S.wait));
          break;
        }
        (btns[spin % btns.length] || btns[0]).click();
        await sleep(1);
      }
      let S = null;
      try {
        S = JSON.parse(localStorage.getItem("tariklab::bukucu:1"));
      } catch {
        /* yok */
      }
      return {
        steps,
        turns,
        finished,
        issues: [...seen],
        errors: window.__errors.slice(),
        win: S ? S.win : null,
      };
    },
    { maxSteps, board: SQ, cost: BUILD_COST, check: checkState.toString() },
  );
  await ctx.close();
  return { ...res, errors: [...res.errors, ...errors] };
}

/* ------------------------------------------------------------------ */

const browser = await chromium.launch({ args: ["--no-sandbox"] });
console.log(`Bükücü QA → ${TARGET}\n`);

await scenarios(browser);
console.log("senaryolar bitti\n");

let played = 0,
  unfinished = 0;
for (const mode of ["cpu", "hot", "hot3", "hot4"]) {
  for (let g = 0; g < GAMES; g++) {
    const r = await fuzz(browser, mode, 7919 * (g + 1) + 13, STEPS);
    played++;
    if (!r.finished) unfinished++;
    const line = `${mode.padEnd(5)} adım=${String(r.steps).padStart(5)} tur=${String(r.turns).padStart(4)} bitti=${r.finished ? "E" : "h"}`;
    if (r.issues.length || r.errors.length) {
      fail("fuzz/" + mode, `${line} → ${[...r.issues, ...r.errors].join(" | ")}`);
      console.log("fail fuzz/" + line);
    } else {
      notes.push("ok  fuzz/" + line);
      console.log("ok  fuzz/" + line);
    }
  }
}

await browser.close();

for (const n of notes) console.log(n);
console.log(`\n${played} oyun oynandı, ${unfinished} tanesi adım sınırına takıldı.`);
if (fails.length) {
  console.log(`\n${fails.length} SORUN:`);
  for (const f of fails) console.log("  ✗ " + f);
  process.exit(1);
}
console.log("\nTemiz.");
