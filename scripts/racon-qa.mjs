#!/usr/bin/env node
/**
 * Racon Manager otomatik QA.
 *
 *   node scripts/racon-qa.mjs
 *   RACON_FILE=public/games/racon/index.html node scripts/racon-qa.mjs
 *
 * Üç şey yapar:
 *  1) OYUN İÇİ TEST — window.__raconTest() çıktısını okur.
 *  2) DÜZEN — 1280x800 / 844x390 yatay ve 360x640 dikeyde ölçü doğrular.
 *  3) GEZİNTİ — bütün ekranları dolaşır, konsol hatası toplar.
 *
 * Çıkış kodu: 0 = temiz, 1 = en az bir sorun.
 */
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import process from "node:process";

const file = process.env.RACON_FILE || "public/games/racon/index.html";
const url = process.env.RACON_URL || "file://" + path.resolve(file);
const sorunlar = [];
const not = (m) => sorunlar.push(m);

const exe = process.env.RACON_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const browser = await chromium.launch({
  headless: true,
  ...(fs.existsSync(exe) ? { executablePath: exe } : {}),
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
/* Determinizm: yeni oyun seed'i sabit. RACON_SEED ile değiştirilebilir. */
const seed = Number(process.env.RACON_SEED || 4242);
await ctx.addInitScript((s) => { window.__raconSeedSabit = s; }, seed);
const page = await ctx.newPage();
const konsol = [];
page.on("console", (m) => m.type() === "error" && konsol.push(m.text()));
page.on("pageerror", (e) => konsol.push("pageerror: " + e.message));

await page.goto(url);
await page.waitForTimeout(300);

// 1) oyun içi test
const testVar = await page.evaluate(() => typeof window.__raconTest === "function");
if (!testVar) not("window.__raconTest yok");
else {
  const r = await page.evaluate(() => window.__raconTest());
  if (!Array.isArray(r)) not("__raconTest dizi döndürmedi: " + JSON.stringify(r));
  else if (r.length) r.forEach((x) => not("__raconTest: " + (typeof x === "string" ? x : JSON.stringify(x))));
}

// oyunu oynanır hale getir (menü → yeni oyun)
await page.reload();
await page.waitForTimeout(200);
async function oyunaDon(pg) {
  await pg.reload();
  await pg.waitForTimeout(250);
  await pg.locator('button:has-text("Devam")').first().click().catch(() => {});
  await pg.waitForTimeout(300);
  const nav = await pg.locator(".navbtn").count();
  if (!nav) not("oyuna dönülemedi (menüde takılı)");
}

async function acikKarariCoz(pg, max = 16) {
  for (let i = 0; i < max; i++) {
    const rnd = pg.locator('[data-act="rnd-karar"]').first();
    if (await rnd.count()) {
      await rnd.click({ force: true }).catch(() => {});
      await pg.waitForTimeout(220);
      continue;
    }
    const sahneEylemi = pg.locator(".scene button:not([disabled])").first();
    if (await sahneEylemi.count()) {
      await sahneEylemi.click({ force: true }).catch(() => {});
      await pg.waitForTimeout(180);
      continue;
    }
    const modal = pg.locator("#modal button:not([disabled])").first();
    if (await modal.count()) {
      await modal.click({ force: true }).catch(() => {});
      await pg.waitForTimeout(180);
      continue;
    }
    const acik = await pg.evaluate(() => !!document.querySelector(".scene, #modal:not([hidden])"));
    if (!acik) return true;
    await pg.waitForTimeout(220);
  }
  return false;
}

async function sahneyiBitir(pg) {
  return acikKarariCoz(pg);
}

async function oyunaGir(pg) {
  await pg.locator('[data-go="nick"]').first().click().catch(() => {});
  await pg.waitForTimeout(150);
  await pg.locator("#lakap").fill("Test").catch(() => {});
  await pg.locator('[data-go="origin"]').first().click().catch(() => {});
  await pg.waitForTimeout(150);
  /* "koy" seçilir: tam kadro (3 adam) ile başlar, "hapis" (1 adam) gibi
     ince kadroya bağlı testleri (randevu vb.) rastgele kırmasın diye. */
  await pg.locator('[data-act="origin"][data-id="koy"]').click().catch(() => {});
  await pg.waitForTimeout(200);
  for (let i = 0; i < 5; i++) {
    const n = pg.locator("#menu-night button:not([disabled])").first();
    if (!(await n.count())) break;
    await n.click().catch(() => {});
    await pg.waitForTimeout(180);
  }
  await pg.waitForTimeout(200);
}
await oyunaGir(page);
const oyundaMi = await page.evaluate(() => !!document.querySelector(".navbtn"));
if (!oyundaMi) not("yeni oyun akışı tamamlanamadı (menüde takılı)");

// 2) düzen — yatay
for (const [w, h] of [[1280, 800], [844, 390]]) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(150);
  const m = await page.evaluate(() => ({
    yatay: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    dikey: document.documentElement.scrollHeight > document.documentElement.clientHeight + 1,
    app: !!document.querySelector("#app") && getComputedStyle(document.querySelector("#app")).display !== "none",
    nav: !!document.querySelector(".nav"),
    stage: !!document.querySelector(".stage"),
    side: !!document.querySelector(".side"),
    kucukHedef: [...document.querySelectorAll("button:not([disabled])")]
      .filter((b) => b.offsetParent !== null && b.getBoundingClientRect().height > 0 &&
        b.getBoundingClientRect().height < (window.innerHeight <= 520 ? 31 : 39)).length,
  }));
  if (m.yatay) not(`${w}x${h}: sayfa yatay kayıyor`);
  if (m.dikey) not(`${w}x${h}: sayfa dikey kayıyor`);
  if (!m.app) not(`${w}x${h}: #app görünmüyor`);
  if (!(m.nav && m.stage && m.side)) not(`${w}x${h}: üç sütundan biri yok`);
  if (m.kucukHedef) not(`${w}x${h}: 40px altı ${m.kucukHedef} dokunma hedefi`);
}

// 3) düzen — dikey telefonda oyun oynanır (kilit kaldırıldı, alt şerit menü)
await page.setViewportSize({ width: 360, height: 640 });
await page.waitForTimeout(250);
const dikey = await page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const nav = q(".nav");
  const app = q("#app");
  return {
    app: app ? getComputedStyle(app).display !== "none" : false,
    rotate: q("#rotate") ? getComputedStyle(q("#rotate")).display !== "none" : false,
    navH: nav ? Math.round(nav.getBoundingClientRect().height) : 0,
    navAlt: nav ? Math.round(nav.getBoundingClientRect().bottom) : 0,
    vh: document.documentElement.clientHeight,
    yatayKaydi: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
  };
});
if (!dikey.app) not("360x640 dikey: oyun görünmüyor");
if (dikey.rotate) not("360x640 dikey: eski çevirme kilidi hâlâ çıkıyor");
if (dikey.navH < 30) not("360x640 dikey: alt menü şeridi çöktü (" + dikey.navH + "px)");
if (dikey.navAlt > dikey.vh + 1) not("360x640 dikey: alt menü ekranın dışına taşıyor");
if (dikey.yatayKaydi) not("360x640 dikey: sayfa yatay kayıyor");

// 4) gezinti — bütün ekranlar
await page.setViewportSize({ width: 1280, height: 800 });
await page.waitForTimeout(150);
const navlar = await page.locator(".navbtn:not([disabled])").count();
if (navlar < 8) not(`sol nav'da ${navlar} açık düğme var, 8 bekleniyordu`);
for (let i = 0; i < navlar; i++) {
  await page.locator(".navbtn:not([disabled])").nth(i).click().catch(() => {});
  await page.waitForTimeout(80);
  const bos = await page.evaluate(() => (document.querySelector(".stage")?.textContent || "").trim().length < 3);
  if (bos) not(`nav ${i}: orta sahne boş kaldı`);
}

// 5) çift İlerlet tek gün (durum localStorage'dan okunur)
const gun = () => page.evaluate(() => { try { const j = JSON.parse(localStorage.getItem("racon_v1")); return j ? j.week * 7 + j.day : null; } catch (e) { return null; } });
await page.locator(".navbtn:not([disabled])").first().click().catch(() => {});
const gunOnce = await gun();
if (gunOnce === null) not("kayıttan gün okunamadı (çift İlerlet testi yapılamadı)");
else {
  const il = page.locator('#btn-ilerlet').first();
  if (!(await il.count())) not("İLERLET düğmesi bulunamadı");
  else {
    await il.click({ force: true }).catch(() => {});
    await il.click({ force: true }).catch(() => {});
    await page.waitForTimeout(900);
    const gunSonra = await gun();
    if (gunSonra === gunOnce) not("İlerlet gün ilerletmedi");
    else if (gunSonra - gunOnce > 1) not(`çift İlerlet ${gunSonra - gunOnce} gün yedi`);
  }
}

// 5b) fuzz — rastgele tıklama, çökme ve bozuk kayıt avı
for (let i = 0; i < 80; i++) {
  const btns = page.locator('.stage button:not([disabled]), .side button:not([disabled])');
  const n = await btns.count();
  if (!n) { await page.locator(".navbtn:not([disabled])").first().click().catch(() => {}); continue; }
  await btns.nth(Math.floor(Math.random() * n)).click({ timeout: 1500 }).catch(() => {});
  await page.waitForTimeout(40);
  if (i % 10 === 9) {
    const bozuk = await page.evaluate(() => {
      try { const j = JSON.parse(localStorage.getItem("racon_v1")); if (!j) return null;
        const d = [];
        if (j.dosya < 0 || j.dosya > 100) d.push("dosya " + j.dosya);
        for (const k of ["korku", "saygi", "nam", "racon"]) if (j.rep[k] < 0 || j.rep[k] > 100) d.push(k + " " + j.rep[k]);
        if (j.kasa < 0) d.push("kasa " + j.kasa);
        if (j.rep.korku >= 70 && j.rep.saygi >= 70) d.push("korku+saygı ikisi 70+");
        return d.length ? d.join(", ") : null;
      } catch (e) { return "kayıt bozuldu"; }
    });
    if (bozuk) not("fuzz: " + bozuk);
    const nav = await page.locator(".navbtn:not([disabled])").count();
    if (nav < 8) { await page.locator(".navbtn").first().click().catch(() => {}); }
  }
}

// 7) uzun koşu — RACON_LONG=1 ile 150 gün ilerlet, tıkanma/patlama ara
if (process.env.RACON_LONG) {
  const oku = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem("racon_v1")); } catch (e) { return null; } });
  let sonGun = null, takili = 0;
  for (let t = 0; t < 150; t++) {
    await page.locator("#btn-ilerlet").click({ force: true }).catch(() => {});
    await page.waitForTimeout(220);
    // sahne veya modal açıldıysa kapat / ilk seçeneği seç
    for (let k = 0; k < 12; k++) {
      const acik = page.locator('#modal button:not([disabled]), .sahne button:not([disabled]), .stage button:not([disabled])').first();
      const sahneVar = await page.evaluate(() => !!document.querySelector("#modal button, .sahne button"));
      if (!sahneVar) break;
      await acik.click({ force: true, timeout: 1000 }).catch(() => {});
      await page.waitForTimeout(80);
    }
    if (t % 15 === 14) {
      const j = await oku();
      if (!j) { not("uzun koşu: kayıt okunamadı (tık " + t + ")"); break; }
      const g = j.week * 7 + j.day;
      if (g === sonGun) { takili++; if (takili > 1) { not("uzun koşu: oyun " + t + ". tıkta tıkandı (gün ilerlemiyor)"); break; } }
      else takili = 0;
      sonGun = g;
      const d = [];
      if (j.dosya < 0 || j.dosya > 100) d.push("dosya " + j.dosya);
      for (const k of ["korku", "saygi", "nam", "racon"]) if (j.rep[k] < 0 || j.rep[k] > 100) d.push(k + " " + j.rep[k]);
      if (j.kasa < 0) d.push("kasa " + j.kasa);
      if (j.calendar.length > 200) d.push("takvim şişti: " + j.calendar.length);
      if (j.inbox.length > 300) d.push("inbox şişti: " + j.inbox.length);
      if (j.evidence.length > 400) d.push("delil şişti: " + j.evidence.length);
      if (d.length) { not("uzun koşu (tık " + t + "): " + d.join(", ")); break; }
    }
  }
  const son = await oku();
  if (son) console.log(`uzun koşu sonu: H${son.week} G${son.day} · kasa ${son.kasa} · dosya ${son.dosya} · kademe ${son.stage} · takvim ${son.calendar.length} · delil ${son.evidence.length} · adam ${son.men.filter((m) => m.durum !== "olu").length}`);
}

// 8) modül testi — kaydı üst kademeye çek, ekonomi/hayat/sezon kâğıtlarını sına
if (process.env.RACON_LONG) {
  await page.evaluate(() => {
    const j = JSON.parse(localStorage.getItem("racon_v1"));
    j.stage = "baba"; j.kasa = 300000; j.rep.nam = 40; j.week = 11;
    localStorage.setItem("racon_v1", JSON.stringify(j));
  });
  await page.reload();
  await page.waitForTimeout(250);
  await page.locator('button:has-text("Devam")').first().click().catch(() => {});
  await page.waitForTimeout(250);

  const oku2 = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem("racon_v1")); } catch (e) { return null; } });
  for (let t = 0; t < 32; t++) {
    await page.locator("#btn-ilerlet").click({ force: true }).catch(() => {});
    await page.waitForTimeout(460);
    for (let k = 0; k < 6; k++) {
      const modal = await page.evaluate(() => !!document.querySelector("#modal button"));
      if (!modal) break;
      await page.locator("#modal button").first().click({ force: true }).catch(() => {});
      await page.waitForTimeout(70);
    }
  }
  const j2 = await oku2();
  if (!j2) not("modül testi: kayıt okunamadı");
  else {
    const kinds = [...new Set(j2.inbox.map((x) => x.kind).filter(Boolean))];
    console.log("modül: kâğıt türleri [" + kinds.join(",") + "] · kasa " + j2.kasa +
      " · hafta " + j2.week + " · defter " + j2.defter.length);
    if (j2.week < 12) not("modül: 32 tıkta hafta ilerlemedi (" + j2.week + ")");
    if (!j2.defter.length) not("modül: kasa defteri boş kaldı");
    if (j2.dosya < 0 || j2.dosya > 100) not("modül: dosya sınır dışı " + j2.dosya);
    if (j2.kasa < 0) not("modül: kasa negatif " + j2.kasa);
  }

  // her ekran boş sahne bırakmadan açılıyor mu
  const navIds = await page.evaluate(() =>
    [...document.querySelectorAll(".navbtn[data-id]")].map((b) => b.dataset.id));
  for (const id of navIds) {
    await page.locator(`.navbtn[data-id="${id}"]`).first().click().catch(() => {});
    await page.waitForTimeout(120);
    const txt = await page.evaluate(() => (document.querySelector(".stage")?.textContent || "").trim());
    if (txt.length < 3) not("modül: " + id + " ekranı boş açıldı");
  }
}

await oyunaDon(page);

// 9) mobil düzen — dikey telefon ve kısa yatay
for (const [w, h, ad] of [[390, 800, "dikey 390x800"], [844, 346, "yatay 844x346"]]) {
  await page.setViewportSize({ width: w, height: h });
  await page.waitForTimeout(250);
  const m = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const r = (s) => (q(s) ? q(s).getBoundingClientRect() : null);
    const meta = q(".top .meta");
    const nav = q(".nav");
    const side = q(".side");
    return {
      metaWrap: meta ? meta.getBoundingClientRect().height > 30 : false,
      navH: nav ? Math.round(nav.getBoundingClientRect().height) : 0,
      navBos: nav ? nav.children.length : 0,
      sideY: side ? Math.round(side.getBoundingClientRect().y) : null,
      sideX: side ? Math.round(side.getBoundingClientRect().x) : null,
      vh: document.documentElement.clientHeight,
      vw: document.documentElement.clientWidth,
      yatayKaydi: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      togVar: !!q('[data-act="navdetay"]'),
      kucukHedef: [...document.querySelectorAll(".navbtn:not([disabled])")]
        .filter((b) => b.getBoundingClientRect().height > 0 && b.getBoundingClientRect().height < 32).length
    };
  });
  if (m.yatayKaydi) not(ad + ": sayfa yatay kayıyor");
  if (m.metaWrap) not(ad + ": üst şerit künyesi satır atlıyor");
  if (m.navH < 30) not(ad + ": menü şeridi çöktü (" + m.navH + "px)");
  if (m.navBos < 5) not(ad + ": menüde yalnız " + m.navBos + " öğe var");
  if (!m.togVar) not(ad + ": detay/kısa düğmesi yok");
  const sideGizli = m.sideY === null || m.sideY >= m.vh - 2 || m.sideX >= m.vw - 2;
  if (!sideGizli) not(ad + ": kapalı yan panel ekrana sızıyor (x=" + m.sideX + " y=" + m.sideY + ")");
  if (m.kucukHedef) not(ad + ": " + m.kucukHedef + " menü düğmesi 32px altında");

  // Mobilde toggle gizlidir: etiketler erişilebilir kalır. Geniş görünümde toggle çalışır.
  const navSunumu = await page.evaluate(() => {
    const toggle = document.querySelector('[data-act="navdetay"]');
    const label = document.querySelector(".navbtn span");
    return {
      toggleVisible: !!toggle && getComputedStyle(toggle).display !== "none",
      labelVisible: !!label && getComputedStyle(label).display !== "none",
    };
  });
  if (navSunumu.toggleVisible) {
    const etiketOnce = navSunumu.labelVisible;
    await page.locator('[data-act="navdetay"]').first().click();
    await page.waitForTimeout(250);
    const etiketSonra = await page.evaluate(() => {
      const sp = document.querySelector(".navbtn span");
      return sp ? getComputedStyle(sp).display !== "none" : null;
    });
    if (etiketOnce === etiketSonra) not(ad + ": detay/kısa geçişi etiketleri değiştirmedi");
    await page.locator('[data-act="navdetay"]').first().click();
    await page.waitForTimeout(200);
  } else if (!navSunumu.labelVisible) {
    not(ad + ": mobil nav etiketleri görünmüyor");
  }
}
await page.setViewportSize({ width: 1280, height: 800 });
await page.waitForTimeout(200);

// 10) lig / fikstür / kâğıt eylemleri
await oyunaDon(page);
{
  const oku = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem("racon_v1")); } catch (e) { return null; } });
  let j = await oku();
  if (!j || !j.lig) not("lig: state yok");
  else {
    if (j.lig.ekipler.length < 4) not("lig: sıralamada " + j.lig.ekipler.length + " ekip var");
    if (j.lig.fikstur.length < 8) not("lig: fikstür " + j.lig.fikstur.length + " randevu");
    if (j.lig.hedefler.length !== 3) not("lig: hedef sayısı " + j.lig.hedefler.length);
  }
  // randevu haftasına ilerle
  let randevu = null;
  for (let t = 0; t < 24 && !randevu; t++) {
    await page.locator("#btn-ilerlet").click({ force: true }).catch(() => {});
    await page.waitForTimeout(460);
    await acikKarariCoz(page, 6);
    j = await oku();
    randevu = (j.calendar || []).filter((c) => c.strip === "randevu" && c.status === "bekler")[0];
  }
  if (!randevu) not("lig: 24 günde takvime randevu düşmedi");
  else {
    await page.locator('.navbtn[data-id="olaylar"]').click().catch(() => {});
    await page.waitForTimeout(200);
    const satir = page.locator(".list button.row").filter({ hasText: /randevu verdi/i }).first();
    if (!(await satir.count())) not("lig: randevu kâğıdı olaylarda yok");
    else {
      await satir.click().catch(() => {});
      await page.waitForTimeout(200);
      const tarz = await page.evaluate(() => [...document.querySelectorAll('[data-act="randevu-git"]')].length);
      if (tarz !== 4) not("lig: randevu kâğıdında " + tarz + " gidiş tarzı var (4 bekleniyor)");
      const once = await oku();
      await page.locator('[data-act="randevu-git"][data-tarz="kapi"]').first().click().catch(() => {});
      if (!(await sahneyiBitir(page))) not("lig: randevu sahnesi kapanmadı");
      const sonra = await oku();
      const fikstur = (sonra.lig.fikstur || []).find((f) => f.calId === randevu.id);
      const takvim = (sonra.calendar || []).find((c) => c.id === randevu.id);
      if (!fikstur?.sonuc) not("lig: seçilen randevu çözülmedi (sonuç yazılmadı)");
      if (takvim?.status !== "bitti") not("lig: seçilen randevu takvimde kapanmadı");
      if (JSON.stringify(once.rep) === JSON.stringify(sonra.rep) && once.kasa === sonra.kasa) {
        not("lig: randevu sonucu hiçbir değeri değiştirmedi");
      }
    }
  }
  // sıralama ekranı
  await page.locator('.navbtn[data-id="siralama"]').click().catch(() => {});
  await page.waitForTimeout(250);
  const st = await page.evaluate(() => ({
    txt: document.querySelector(".stage")?.textContent || "",
    satir: document.querySelectorAll(".lig-row").length
  }));
  if (!/Mahalle sıralaması/.test(st.txt)) not("lig: sıralama ekranı açılmadı");
  if (st.satir < 5) not("lig: tabloda " + st.satir + " satır var");
  if (!/Amcanın hedefi/.test(st.txt)) not("lig: hedef kartı yok");
  if (!/Randevu takvimi/.test(st.txt)) not("lig: randevu takvimi kartı yok");

  // hedefsiz bilgi kâğıdında ölü düğme kalmasın
  await page.locator('.navbtn[data-id="olaylar"]').click().catch(() => {});
  await page.waitForTimeout(200);
  const bos = await page.evaluate(() => {
    const j2 = JSON.parse(localStorage.getItem("racon_v1"));
    const it = (j2.inbox || []).filter((x) => !x.kapali && !x.href && !x.calId && !x.siparis && !x.kind)[0];
    return it ? it.id : null;
  });
  if (bos) {
    await page.locator(`.list button.row[data-id="${bos}"]`).first().click().catch(() => {});
    await page.waitForTimeout(200);
    const dugme = await page.evaluate(() =>
      [...document.querySelectorAll(".sheet .acts button")].map((b) => b.textContent.trim()));
    if (dugme.length !== 2) not("kâğıt: hedefsiz kâğıtta " + dugme.length + " düğme var (2 bekleniyor: Okundu+Ağza bırak): " + dugme.join(","));
    if (dugme.length) {
      await page.locator(".sheet .acts button").first().click().catch(() => {});
      await page.waitForTimeout(200);
      const kaldiMi = await page.evaluate((id) => {
        const j3 = JSON.parse(localStorage.getItem("racon_v1"));
        const x = (j3.inbox || []).filter((y) => y.id === id)[0];
        return x ? !!x.kapali : null;
      }, bos);
      if (!kaldiMi) not("kâğıt: 'kaldır' kâğıdı kapatmadı");
    }
  }
}

await oyunaDon(page);

// 11) FM halkaları: haftalık hazırlık, süreli sipariş, kadro seçimi, rakip raporu
{
  const oku = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem("racon_v1")); } catch (e) { return null; } });
  const kagitAc = async (re) => {
    await page.locator('.navbtn[data-id="olaylar"]').click().catch(() => {});
    await page.waitForTimeout(150);
    const r = page.locator(".list button.row").filter({ hasText: re }).first();
    if (!(await r.count())) return false;
    await r.click().catch(() => {});
    await page.waitForTimeout(200);
    return true;
  };

  // haftalık hazırlık kâğıdı gelmeli ve gerçekten etki etmeli
  let haz = false;
  for (let t = 0; t < 10 && !haz; t++) {
    haz = await kagitAc(/Haftanın hazırlığı/);
    if (!haz) { await page.locator("#btn-ilerlet").click({ force: true }).catch(() => {}); await page.waitForTimeout(460); }
  }
  if (!haz) not("hazırlık: haftalık hazırlık kâğıdı gelmedi");
  else {
    const secenek = await page.evaluate(() => [...document.querySelectorAll('[data-act="hazirlik"]')].length);
    if (secenek !== 3) not("hazırlık: " + secenek + " seçenek var (3 bekleniyor)");
    const once = await oku();
    await page.locator('[data-act="hazirlik"][data-tip="kahve"]').first().click().catch(() => {});
    await page.waitForTimeout(300);
    const sonra = await oku();
    const g0 = once.men.reduce((a, m) => a + m.gonul, 0);
    const g1 = sonra.men.reduce((a, m) => a + m.gonul, 0);
    if (g1 <= g0) not("hazırlık: kahve gönülleri artırmadı (" + g0 + " -> " + g1 + ")");
  }

  // sipariş takvime süreli düşmeli
  let j = await oku();
  let sip = (j.calendar || []).filter((c) => c.ref && c.ref.siparis)[0];
  for (let t = 0; t < 12 && !sip; t++) {
    await page.locator("#btn-ilerlet").click({ force: true }).catch(() => {});
    await page.waitForTimeout(460);
    j = await oku();
    sip = (j.calendar || []).filter((c) => c.ref && c.ref.siparis)[0];
  }
  if (!sip) not("sipariş: takvime son gün düşmedi");
  else if (!/Sipariş: /.test(sip.title)) not("sipariş: takvim başlığı beklenenden farklı (" + sip.title + ")");

  // randevu kâğıdında rakip raporu ve kadro seçimi
  let rnd = null;
  for (let t = 0; t < 24 && !rnd; t++) {
    j = await oku();
    rnd = (j.calendar || []).filter((c) => c.strip === "randevu" && c.status === "bekler")[0];
    if (rnd) break;
    await page.locator("#btn-ilerlet").click({ force: true }).catch(() => {});
    await page.waitForTimeout(460);
    await acikKarariCoz(page, 6);
  }
  if (!rnd) not("randevu: 24 günde randevu çıkmadı");
  else if (!(await kagitAc(/randevu verdi/))) not("randevu: kâğıt olaylarda yok");
  else {
    const rapor = await page.evaluate(() => document.querySelector(".sheet")?.textContent || "");
    if (!/güçlü|denk|zayıf/.test(rapor)) not("randevu: rakip raporu yok");
    if (!/Senin gücün \d+ · onlarınki \d+/.test(rapor)) not("randevu: güç kıyası yazmıyor");
    const kutu = await page.locator("[data-rman]").count();
    if (!kutu) not("randevu: kadro seçimi yok");
    const tercih = page.locator('[data-act="randevu-git"]:not([disabled])').first();
    if (!(await tercih.count())) not("randevu: gidilecek açık tarz yok");
    else await tercih.click();
    if (!(await sahneyiBitir(page))) not("randevu: sahne kapanmadı");
    const sonra = await oku();
    const fikstur = (sonra.lig.fikstur || []).find((f) => f.calId === rnd.id);
    const takvim = (sonra.calendar || []).find((c) => c.id === rnd.id);
    if (!fikstur?.sonuc) not("randevu: seçilen fikstüre sonuç yazılmadı");
    if (takvim?.status !== "bitti") not("randevu: seçilen takvim kaydı kapanmadı");
  }
}

await oyunaDon(page);

// 12) kadro derinliği · randevu sahnesi · emniyet · rozet
{
  const oku = () => page.evaluate(() => { try { return JSON.parse(localStorage.getItem("racon_v1")); } catch (e) { return null; } });
  const kagitAc = async (re) => {
    await page.locator('.navbtn[data-id="olaylar"]').click().catch(() => {});
    await page.waitForTimeout(140);
    const r = page.locator(".list button.row").filter({ hasText: re }).first();
    if (!(await r.count())) return false;
    await r.click().catch(() => {});
    await page.waitForTimeout(180);
    return true;
  };

  // KADRO: kahvede ara -> aday kâğıdı -> pazarlık -> tut
  await page.evaluate(() => {
    const x = JSON.parse(localStorage.getItem("racon_v1"));
    x.kasa = 40000;
    localStorage.setItem("racon_v1", JSON.stringify(x));
  });
  await page.reload();
  await page.waitForTimeout(250);
  await page.locator('button:has-text("Devam")').first().click().catch(() => {});
  await page.waitForTimeout(300);
  await page.locator('.navbtn[data-id="adamlar"]').click().catch(() => {});
  await page.waitForTimeout(200);
  const kadro0 = (await oku()).men.length;
  if (!(await page.locator('[data-act="adam-ara"]').count())) not("kadro: 'adam ara' düğmesi yok");
  await page.locator('[data-act="adam-ara"]').first().click().catch(() => {});
  await page.waitForTimeout(300);
  if (!(await kagitAc(/iş arıyor/))) not("kadro: aday kâğıdı gelmedi");
  else {
    const acikId = await page.evaluate(() => {
      const b = document.querySelector('[data-act="aday-pazarlik"]');
      if (!b) return null;
      const j = JSON.parse(localStorage.getItem("racon_v1"));
      const it = (j.inbox || []).filter((x) => x.id === b.dataset.id)[0];
      return it ? it.aday : null;
    });
    const bul = (st) => (st.adaylar || []).filter((a) => a.id === acikId)[0];
    const p0 = bul(await oku());
    await page.locator('[data-act="aday-pazarlik"]').first().click().catch(() => {});
    await page.waitForTimeout(250);
    const p1 = bul(await oku());
    if (p0 && p1 && p1.pesin >= p0.pesin) not("kadro: pazarlık peşinatı düşürmedi");
    await kagitAc(/iş arıyor/);
    if (await page.locator('[data-act="aday-al"]:not([disabled])').count()) {
      await page.locator('[data-act="aday-al"]').first().click().catch(() => {});
      await page.waitForTimeout(300);
      const son = await oku();
      if (son.men.length <= kadro0) not("kadro: adam tutulunca kadro büyümedi (" + kadro0 + " -> " + son.men.length + ")");
      if (son.kasa >= 40000) not("kadro: adam bedava geldi");
    } else not("kadro: 'Tut' düğmesi ₺40.000 kasayla bile kapalı");
  }

  // RANDEVU SAHNESİ — fikstürü bugüne çekip tek ilerletmede randevuyu aç
  await page.evaluate(() => {
    const x = JSON.parse(localStorage.getItem("racon_v1"));
    const f = (x.lig.fikstur || []).filter((y) => !y.sonuc)[0];
    if (f) {
      (x.lig.fikstur || []).forEach((y) => { if (y !== f && y.week === x.week) y.week = x.week + 1; });
      f.week = x.week;
      f.day = Math.min(7, x.day + 1);
      f.calId = "";
    }
    localStorage.setItem("racon_v1", JSON.stringify(x));
  });
  await page.reload();
  await page.waitForTimeout(250);
  await page.locator('button:has-text("Devam")').first().click().catch(() => {});
  await page.waitForTimeout(300);
  let rnd = null, j = await oku();
  for (let t = 0; t < 3 && !rnd; t++) {
    await page.locator("#btn-ilerlet").click({ force: true }).catch(() => {});
    await page.waitForTimeout(460);
    j = await oku();
    rnd = (j.calendar || []).filter((c) => c.strip === "randevu" && c.status === "bekler")[0];
  }
  if (!rnd) not("sahne: randevu çıkmadı");
  else if (!(await kagitAc(/randevu verdi/))) not("sahne: randevu kâğıdı yok");
  else {
    await page.locator('[data-act="randevu-git"][data-tarz="kapi"]').first().click().catch(() => {});
    await page.waitForTimeout(1300);
    const kararlar = await page.evaluate(() => [...document.querySelectorAll('[data-act="rnd-karar"]')].length);
    const satir = await page.evaluate(() => document.querySelectorAll(".log p").length);
    if (satir < 2) not("sahne: satır yazılmadı");
    if (kararlar !== 3) not("sahne: orta karar " + kararlar + " seçenek (3 bekleniyor)");
    await page.locator('[data-act="rnd-karar"][data-k="bas"]').first().click().catch(() => {});
    await page.waitForTimeout(4000);
    const sonra = await oku();
    if (!(sonra.lig.fikstur || []).some((f) => f.sonuc)) not("sahne: sonuç yazılmadı");
    const acikMi = await page.evaluate(() => !!document.querySelector('[data-act="rnd-karar"]'));
    if (acikMi) not("sahne: bitmesine rağmen kapanmadı");
  }

  // EMNİYET: komiser, baskın, iddianame
  await page.evaluate(() => {
    const x = JSON.parse(localStorage.getItem("racon_v1"));
    for (let i = 0; i < 34; i++) x.evidence.push({ id: "ev_qa" + i, kind: "kamera", streetId: x.streetHome, week: x.week, weight: 3 });
    localStorage.setItem("racon_v1", JSON.stringify(x));
  });
  await page.reload();
  await page.waitForTimeout(250);
  await page.locator('button:has-text("Devam")').first().click().catch(() => {});
  await page.waitForTimeout(300);
  let baskin = false, kom = null;
  for (let t = 0; t < 22; t++) {
    await page.locator("#btn-ilerlet").click({ force: true }).catch(() => {});
    await page.waitForTimeout(430);
    await acikKarariCoz(page, 6);
    j = await oku();
    if (j.komiser) kom = j.komiser;
    if ((j.inbox || []).some((x) => /Baskın|İddianame/.test(x.title))) { baskin = true; break; }
  }
  if (!kom) not("emniyet: dosya yükseldiği halde komiser çıkmadı");
  if (!baskin) not("emniyet: dosya 90+ iken 22 günde baskın/iddianame olmadı");
  await page.locator('.navbtn[data-id="emniyet"]').click().catch(() => {});
  await page.waitForTimeout(250);
  const em = await page.evaluate(() => document.querySelector(".stage")?.textContent || "");
  if (!/Baskın riski/.test(em)) not("emniyet: baskın riski kartı yok");
  if (kom && !/Bağlılık/.test(em)) not("emniyet: komiser kartı yok");

  // ROZET + SEZON GEÇMİŞİ
  await page.locator('.navbtn[data-id="siralama"]').click().catch(() => {});
  await page.waitForTimeout(250);
  const sr = await page.evaluate(() => document.querySelector(".stage")?.textContent || "");
  if (!/Rozetler/.test(sr)) not("rozet: kart yok");
  const rz = Object.keys((await oku()).lig.rozet || {}).length;
  if (!rz) not("rozet: hiç rozet kazanılmadı");
}

// 6) kayıt
const kayit = await page.evaluate(() => {
  try { const s = localStorage.getItem("racon_v1"); return s ? JSON.parse(s).kind : null; } catch (e) { return "bozuk"; }
});
if (kayit !== "racon_v1") not("localStorage racon_v1 yazılmadı (bulunan: " + kayit + ")");

konsol.forEach((k) => not("konsol: " + k));

await browser.close();
if (sorunlar.length) {
  console.log("SORUN (" + sorunlar.length + "):");
  sorunlar.forEach((s) => console.log(" - " + s));
  process.exit(1);
}
console.log("Racon QA temiz.");
