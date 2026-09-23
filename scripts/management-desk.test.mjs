import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { JOBS } from "../public/games/tc-sim/js/catalog.js";
import { EDUCATION_PATHS } from "../public/games/tc-sim/js/education.js";
import { NETWORK_CAST } from "../public/games/tc-sim/js/network.js";
import { MARKET } from "../public/games/tc-sim/js/wealth.js";
import { POLICIES, EVENTS, REGIONS, FOREIGN_AXES } from "../public/games/next-wave/devlet-data.js";
import { deskEnglish } from "../public/games/tc-sim/js/desk.js";

// Donmuş taban: içerik/simülasyon kaynakları yalnız bilinçli bir ürün kararıyla
// değişir. Taban en son "Nasıl Oynanır" kapanışında yenilendi: paylaşılan
// runtime'a yapılandırılmış yardım bölümleri (helpSections/helpPanel) eklendi ve
// DEVLET'in tek paragraflık yardımı bu bölümlere taşındı. 2026-09-14'te onaylı
// ilk depth dalgası yalnız next-wave.js içindeki Apartman state/simülasyonunu
// değiştirdi. 2026-09-15 Wave 2, aynı dosyadaki Son 100 Gün save doğrulaması ve
// v2 başlangıç state'ini bilinçli olarak değiştirdi; TC SIM ve DEVLET kaynakları
// bu turda hâlâ donmuş durumda. 2026-09-15 Wave 3 yalnız aynı orkestratördeki
// Kayıp Telefon state/action yönlendirmesini V2 deduction modülüne taşıdı;
// TC SIM ve DEVLET davranışı değişmedi. 2026-09-15 Wave 4, yalnız TC SIM'e
// sürümlü life-depth state'i, nedensel arklar ve Hayat Dosyası ekledi.
// 2026-09-16 Wave 4 content-max, life-content.js kataloğunu ve events/time
// kancalarını ekledi; engine math, save v6 ve DEVLET kaynakları donmuş kaldı.
// 2026-09-16 Wave 4 kapanış denetimi life-content.js içinde iki hedefli düzeltme
// yaptı: ölü/ayrılmış aktör kapısı ve Hayat Dosyası iz önceliği.
// 2026-09-17 kapanış entegrasyonu yalnız bağlama duyarlı partner/iş/konut
// callback'lerine due-time revalidation ekledi; frozen ekonomi ve yaşam matematiği değişmedi.
// 2026-09-17 late-life mini patch yalnız life-content.js kataloğuna 65+ authored
// düğüm, zincir, gecikmeli geri dönüş ve dosya izi ekledi; motor matematiği değişmedi.
// Wave 5 yalnız TC SIM: DEVLET'in ayrı causal foundation katmanını ve mevcut
// DEVLET kernel entegrasyonunu değiştirir; TC SIM yaşam matematiğine dokunmaz.
// Wave 5 final core entegrasyonu DEVLET'te entropy recovery, weighted crisis
// selection ve karar kapasitesi açıklamasını bilinçli olarak güncelledi.
// Wave 5 content-max, TC SIM: DEVLET'e devlet-content.js kataloğunu ve
// next-wave.js / devlet-sim.js / presentation.js kancalarını ekler; fiscal
// causality, entropy recovery, crisis/form math, save V2 ve 2002 POLICIES/EVENTS
// sayıları donmuş kalır. Overlay kadrolar flavor-only; içerik seçimi 2 politika
// kotasını tüketmez.
test("frozen baseline: all 37 content, simulation, persistence and projection sources are byte-identical", () => {
  const files = readdirSync("public/games/tc-sim/js")
    .filter(f => f.endsWith(".js") && !["app.js", "desk.js"].includes(f))
    .map(f => `public/games/tc-sim/js/${f}`)
    .concat(["public/games/next-wave.js", "public/games/next-wave/devlet-data.js", "public/games/next-wave/devlet-sim.js", "public/games/next-wave/shared/runtime.js", "public/games/tc-sim-devlet/presentation.js"]).sort();
  assert.equal(files.length, 37);
  const hash = createHash("sha256");
  for (const file of files) hash.update(file).update(readFileSync(file));
  // Re-pinned for the DEVLET maps PR: next-wave.js (geo dispatch + month
  // tick), devlet-sim.js (beginDecisionMonth extracted, behaviour unchanged)
  // and presentation.js (regions/foreign screens render the maps).
  assert.equal(hash.digest("hex"), "1c962734cdaa964fb9e3b394941a71e8141f0e5aee70f581e6bf1eece33a64a2");
});
test("accepted content counts remain intact", () => {
  assert.equal(JOBS.length, 58);
  assert.equal(EDUCATION_PATHS.length, 18);
  assert.equal(NETWORK_CAST.length, 41); // 40 + kardeş
  assert.equal(Object.keys(MARKET).length, 53);
  assert.equal(POLICIES["2002"].length, 48);
  assert.equal(EVENTS["2002"].length, 62);
  assert.equal(REGIONS.length, 7);
  assert.equal(FOREIGN_AXES.length, 8);
});
test("desk boundary cannot dispatch actions, read hidden state or persist UI", () => {
  for (const file of ["public/games/shared/management-desk.js", "public/games/tc-sim/js/desk.js", "public/games/tc-sim-devlet/desk.js"]) {
    const source = readFileSync(file, "utf8");
    assert.doesNotMatch(source, /localStorage|sessionStorage|\.actual\b|session\.act|\.setUI\(|JSON\.stringify|\.click\(/);
  }
  const app = readFileSync("public/games/tc-sim-devlet/app.js", "utf8");
  assert.doesNotMatch(app, /session\.setUI\(/);
  assert.match(app, /selectedScreen = button\.dataset\.screen; session\.render\(\)/);
});
test("desk display translations preserve financial numbers and source strings", () => {
  assert.equal(deskEnglish("Çalışma hayatı"), "Working life");
  assert.equal(deskEnglish("KİŞİ DOSYASI"), "Person file");
  assert.equal(deskEnglish("Otomatik kaydedildi. (9 KB)"), "Autosaved. (9 KB)");
  const original = "Enerji -5 · Stres +3 · ₺9.000";
  assert.equal(deskEnglish(original), "Energy -5 · Stress +3 · ₺9.000");
  assert.equal(original, "Enerji -5 · Stres +3 · ₺9.000");
});
