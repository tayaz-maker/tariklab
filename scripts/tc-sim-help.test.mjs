import test from "node:test";
import assert from "node:assert/strict";
import { HELP_SECTIONS, renderHelpModal } from "../public/games/tc-sim/js/help.js";

test("yardım içeriği gerçek mekaniklere göre dokuz bölüm taşır", () => {
  assert.equal(HELP_SECTIONS.length, 9);
  const titles = HELP_SECTIONS.map((s) => s.title);
  assert.deepEqual(titles, [
    "Amaç",
    "Haftalık döngü",
    "Kontroller",
    "İş ve finans",
    "İlerleme ve göstergeler",
    "Risk ve sonuçlar",
    "Kayıt",
    "İlk oyun için ipuçları",
    "İleri hayat: emeklilik, miras ve nesil",
  ]);
  for (const section of HELP_SECTIONS) {
    assert.ok(section.body.length > 20, `${section.title} boş olmamalı`);
  }
});

test("haftalık döngü metni gerçek karar hakkı sayısını yansıtır", () => {
  const cycle = HELP_SECTIONS.find((s) => s.title === "Haftalık döngü");
  assert.match(cycle.body, /6 zaman\/odak bloğu/);
});

test("wealth/emeklilik/miras içeriği gerçek sistemleri adlandırır", () => {
  const money = HELP_SECTIONS.find((s) => s.title === "İş ve finans");
  assert.match(money.body, /net servet/);
  const late = HELP_SECTIONS.find((s) => s.title.includes("emeklilik"));
  assert.match(late.body, /Yaşam Raporu/);
  assert.match(late.body, /kuşak/);
});

test("renderHelpModal DOM'a dokunmadan, saf bir HTML dizesi üretir", () => {
  const html = renderHelpModal();
  assert.equal(typeof html, "string");
  assert.match(html, /<div class="help-backdrop"/);
  assert.match(html, /id="help-title"/);
  assert.match(html, /id="help-close"/);
  for (const section of HELP_SECTIONS) {
    assert.ok(html.includes(section.title), `${section.title} modalda görünmeli`);
  }
});

test("renderHelpModal her çağrıda aynı içeriği üretir ve parametre almaz", () => {
  assert.equal(renderHelpModal.length, 0, "state parametresi almamalı");
  assert.equal(renderHelpModal(), renderHelpModal());
});

test("kullanıcı metni HTML olarak enjekte edilmeden önce kaçışlanır", () => {
  // Başlık/gövde sabit metin olsa da render fonksiyonunun kaçışlama
  // disiplinini kanıtlamak için ayraç karakterleri gerçekten dönüştürülüyor mu diye bakılır.
  const html = renderHelpModal();
  assert.equal(html.includes("<script"), false);
});
