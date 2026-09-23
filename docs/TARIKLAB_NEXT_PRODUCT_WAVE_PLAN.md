# TarikLab — Sonraki Ürün Dalgası Planı

Tarih: 2026-09-23 · Durum: **yalnızca plan. Bu PR'da uygulama yok.**

## Genel kurallar

- Kayıt anahtarları, isimler, kaynaklar ve mevcut formatlar korunur.
  - İstisna: İHTİLÂL'de yeniden kurulum serbesttir.
  - Eski kayıtlar ya taşınır ya da açık bir mesajla "eski sürüm" diye işaretlenir.
- Her oyun ayrı, güncel `main` tabanlı PR olur.
- Her PR merge edilmeden önce şunları geçer:
  - typecheck, lint, test, production build
  - 390 px ve masaüstü browser QA
  - production doğrulaması
- Ölçülebilir kabul ölçütleri otomatik testle, ya da `scripts/` altındaki browser
  betikleriyle kanıtlanır. Dış oyun testi (`docs/TARIKLAB_EXTERNAL_PLAYTEST_KIT.md`)
  gerçek katılımcı geldiğinde ek kanıt olur. Buradaki hedefler ona bağlı değildir.
- **Performans çizgisi (HANEDANIAN):** kampanya başlangıcı ve dünya→yakın geçişi
  için "aynı makinede, aynı koşulda `main` ile A/B" kuralı geçerli. Hiçbir PR bu iki
  ölçümü kötüleştiremez.

Önerilen sıra:

1. SON KÖY (küçük, hızlı kazanım)
2. JITEM
3. HANEDANIAN
4. TC SIM / DEVLET / Racon (ortak "karar → sonuç" kalıbı)
5. İHTİLÂL (en büyük iş, en son)

---

## 1. JITEM: Derin Ağ

**Bugünkü oyuncu deneyimi.**
- "Sessiz" yöntem operasyonel olarak baskın. `planning.ts`
  (`applyPlanConsequences`, `tickPlans`) sessiz planın riskini, getirisine göre
  çok düşük tutuyor. Oyuncu hep aynı yöntemi seçince risk/ödül kararı ortadan
  kalkıyor.
- Temel hamle yöntem seçimini hiç dikkate almıyor. Yöntem, yalnızca plan
  katmanında anlam taşıyor.
- `sim/objectives.ts` içindeki hedeflerin ödülü yok: tamamlamak oyuncunun
  durumunu değiştirmiyor. Tur ritmi "hedef → hamle → sonuç" yerine
  "hamle → hamle" gibi akıyor.
- Masa (`SidePanel.tsx`) önizlemenin üstünde aynı açıklamayı birkaç satırda
  tekrarlıyor. Asıl karar bilgisi aşağıda kalıyor.

**Ürün hedefi.** Her tur, en az iki anlamlı seçenek arasında bir risk/ödül kararı
olsun. Hedefler tamamlandığında hissedilir bir kazanç versin.

**Olası dosyalar.**
- `src/sim/planning.ts`
- `src/sim/objectives.ts`
- `src/sim/edges.ts` (kırılgan/sıcak/mühürlü sinyaller)
- `src/components/SidePanel.tsx`
- TarikLab tarafında vendor-sync

**Kabul ölçütleri.**
- Bot matrisi (≥ 6 politika × 20 tohum):
  - Hiçbir tek yöntemin kazanma oranı, en iyi alternatifinden 10 puandan fazla
    yüksek değil.
  - "Hep sessiz" politikası artık tek başına en iyi strateji değil.
- Temel hamle yöntemi dikkate alıyor. Aynı hamlenin yöntemleri arasında en az bir
  sonuç alanında (ısı, güven, bağımlılık) ölçülebilir fark var; birim testle
  kanıtlanır.
- Her hedefin tanımlı bir ödülü var. Hedef tamamlanınca ödül tam bir kez
  uygulanıyor (kaydet/yükle dahil test).
- Masada önizlemeden önce, 1440 px'de karar bilgisi ilk ekranda görünüyor.
  Tekrarlanan açıklama satırları tek satıra iniyor (browser betiği ile ölçülür).
- Mevcut kayıtlar yükleniyor, göç testi geçiyor.

---

## 2. HANEDANIAN

**Bugünkü oyuncu deneyimi.**
- #69 ile harita bir karar aracına dönüşmeye başladı: katmanlar, bölge
  varlığı, gelen tehdit çipi, yerleşim menzili ve rota.
- Ama harita hâlâ çoğunlukla bir şeyi "gösteriyor", karşılaştırmıyor. İki aday
  yerleşim yeri arasında neden birinin daha iyi olduğunu (kaynak, savunma,
  bölge hedefi) oyuncu kendisi çıkarmak zorunda.
- Kampanya başlangıcında 50 ms'yi aşan bir ana-thread görevi var (bakım dalgası
  M1'de ölçülüyor).

**Ürün hedefi.** Harita, "nereye yerleşmeliyim / neyi savunmalıyım / hangi bölgeye
odaklanmalıyım" sorularını tek bakışta cevaplasın. Performans da korunsun.

**Olası dosyalar.** Hepsi `public/games/hanedanian/` altında:
- `mapintel.js` (site puanlama)
- `map.js` (katman çizimi; atlas'a dokunmadan)
- `app.js` (inceleyici bağlamı)
- `campaign.js` (bölge hedefleri)
- `scripts/hanedanian-map-decisions.test.mjs`

**Kabul ölçütleri.**
- Yerleşim adayları gerekçeli bir puan taşıyor (kaynak çeşitliliği, en yakın
  rakip mesafesi, bölge hedefi katkısı).
  - Puan ve gerekçe, motorun kurallarıyla birim testte tutarlı.
  - Geçersiz bir yer asla "iyi" puan almıyor; 3 tohumda tüm karolarda eşdeğerlik
    testi var.
- Gelen tehdit için "varış süresi < savunma hazırlık süresi" durumu haritada ve
  çipte ayrıca işaretleniyor; testle doğrulanır.
- Harita katmanları atlas'ı sıfırlamıyor ve atlas işi kuyruğa eklemiyor
  (mevcut test genişletilir).
- Performans:
  - Kampanya başlangıcı ve dünya→yakın geçişi, aynı makinede `main` ile A/B'de
    kötüleşmiyor.
  - Dünya→yakın geçişinde ≥ 50 ms uzun görev sayısı artmıyor.
- 390 px: katman paneli ve bağlam kartı inceleyici sayfasıyla çakışmıyor, yatay
  taşma yok.

---

## 3. İHTİLÂL

**Bugünkü oyuncu deneyimi.**
- Kimlik güçlü. Önizle-sonra-oyna akışı ve rakibin hamle izi iyi
  (`TARIKLAB_FULL_HUMAN_GAME_AUDIT.md`).
- Kullanıcı, oyunun mantığını ve döngüsünü zayıf buluyor. Yeniden kurulum kabul
  edilebilir.
- Aşağıdaki iki madde **henüz ölçülmedi, doğrulanacak hipotezlerdir**. İşin ilk
  adımı, bunları tohumlu maç simülasyonu ile ölçmektir:
  - Çekirdek döngü (dosya → masa → nüfuz → kilit → Hüküm) sığ olabilir. Bir
    masanın kilidi az sayıda hamlede belirleniyor olabilir.
  - Maç sonu raporu (`report.js`) olayları sıralıyor. Sonucu hangi kararların
    belirlediği ise okunmuyor olabilir.

**Ürün hedefi.** Oyuncu maç sonunda "şu üç kararım yüzünden kazandım/kaybettim"
diyebilsin. Her turda ertelenmiş sonucu olan en az bir seçenek bulunsun.

**Olası dosyalar.** Hepsi `public/games/ihtilal/` altında:
- `engine.js` (kural çekirdeği; gerekirse yeni `rules/` modülü)
- `cards.js`, `decks.js` (kart ekonomisi)
- `ai.js`
- `report.js` (nedensel özet)
- `briefing.js`, `app.js`
- `save.js` (yeni kayıt sürümü + eski kayıt politikası)

**Kabul ölçütleri.**
- Kurallar tek bir belgede (`docs/ihtilal/RULES.md`) yazılı. Motor her kuralı
  isimli bir fonksiyonla uyguluyor, her kuralın birim testi var.
- Denge matrisi (≥ 1.000 maç, arşetip × arşetip, koltuk dengeli):
  - Hiçbir arşetip %60'ın üstünde kazanmıyor.
  - Ortalama maç uzunluğu hedef banda giriyor (tur sayısı belgede sabitlenir).
- Maç sonu raporu, sonucu en çok etkileyen üç kararı sayısal katkısıyla
  listeliyor. Katkı hesabı testle doğrulanıyor.
- Her turda en az bir "gecikmeli etki" seçeneği sunuluyor
  (tohumlu simülasyonla ≥ %90 tur).
- Eski kayıtlar açık bir mesajla ele alınıyor, sessizce bozulmuyor.
  Mobil tahta 390 px'de tek sütun kalıyor.

---

## 4. SON KÖY MANAGER

**Bugünkü oyuncu deneyimi.**
- Oyun ekranının üstünde iki başlık var ve aynı bilgiyi tekrarlıyorlar
  (`son-kasaba/app.js`):
  - `topbar town-command`: köy adı, AY x/24, Bütçe, Nüfus, Borç, Kapasite, kayıt,
    Menü, AYI KAPAT
  - hemen altında `town-masthead`: yine AY x/24, köy adı, Bütçe, Nüfus, Borç
- Bu durum, dar ekranda üst menüyü taşırıyor ve asıl içeriği (bölüm gezintisi,
  panel) aşağı itiyor.

**Ürün hedefi.**
- Üstte tek, kompakt bir komuta çubuğu olsun. Her sayı bir kez görünsün.
- Masthead yalnızca kimliği (ad + kimlik cümlesi) taşısın.
- Üst menü 390 px'de tek satırda veya düzenli iki satırda kalsın.

**Olası dosyalar.** Hepsi `public/games/son-kasaba/` altında:
- `app.js` (başlık şablonu)
- `style.css` (`town-command`, `town-masthead`, `town-totals`)
- `presentation.js`
- `scripts/son-kasaba-browser.mjs`

**Kabul ölçütleri.**
- Oyun ekranında Bütçe, Nüfus, Borç ve AY değerleri DOM'da tam bir kez
  görünüyor (browser betiği sayar).
- 390 px'de:
  - üst çubuk yüksekliği ≤ 96 px
  - yatay taşma yok
  - "AYI KAPAT" ilk ekranda görünür ve ≥ 44 px dokunma hedefi
- 1440 px'de üst çubuk tek satır. Bölüm gezintisi ilk ekranda görünüyor.
- TR/EN metinleri ve kayıt anahtarları değişmedi; mevcut testler geçiyor.

---

## 5. TC SIM

**Bugünkü oyuncu deneyimi.**
- Haftalık kararlar yıllarca süren sonuçlar doğuruyor ve "Hayat Dosyası" izleri
  var.
- Ama bir kararın sonucu karar anında öne çıkmıyor. Sonuç ortaya çıktığında da
  hangi karardan geldiği ana akışta görünmüyor.
- Uzun vadeli bir hedef (ör. "35 yaşında ev sahibi ol") oyuncuya sunulmuyor.

**Ürün hedefi.** Formatı bozmadan her kararın bir "beklenen etki" satırı olsun.
Her gecikmeli sonuç, kaynağını tek tıkla göstersin. Oyuncu isteğe bağlı bir hayat
hedefi seçebilsin.

**Olası dosyalar.** Hepsi `public/games/tc-sim/js/` altında:
- `app.js`
- `time.js`
- `life-depth.js`
- `life-content.js`
- `weekly-feedback.js`
- `help.js`

**Kabul ölçütleri.**
- Her karar kartında beklenen etki satırı var ve motorun gerçek etkisiyle
  tutarlı (tüm kararlar için test).
- Gecikmeli her olay, kaynak kararın kimliğini taşıyor; arayüzde bağlantı
  gösteriliyor (4 gecikmeli zincir için test).
- İsteğe bağlı hedef:
  - ilerleme göstergesi var
  - hedef başarı veya başarısızlıkla tam bir kez sonuçlanıyor
  - kaydet/yükle testi geçiyor
- V6 kayıtları göçle yükleniyor.

---

## 6. TC SIM: DEVLET

**Bugünkü oyuncu deneyimi.**
- Güçlü giriş ve derin bir makro motor var (kurumlar, ekonomi, toplum).
- Ama politika etkileri birçok göstergeye küçük paylar halinde dağılıyor.
  Oyuncu bir yıl sonra hangi politikanın neyi değiştirdiğini ayırt etmekte
  zorlanıyor.
- Dönem hedefleri var ama sonuç ekranı kararları hedeflere bağlamıyor.

**Ürün hedefi.** Her yıl sonunda "bu yıl en çok etki eden üç politikan" ve bunların
hedeflere katkısı gösterilsin. Politika önizlemesi ile gerçekleşen etki yan yana
görünsün.

**Olası dosyalar.** Hepsi `public/games/tc-sim-devlet/` altında:
- `app.js`
- `desk.js`
- `presentation.js`
- motor modülleri (etki izleme)

**Kabul ölçütleri.**
- Yıl sonu özeti, en etkili üç politikayı ölçülen katkısıyla listeliyor
  (katkı hesabı testli).
- Önizleme ve gerçekleşen etki arasındaki sapma belirli bir bandın içinde
  (mevcut önizleme-doğruluk testleri genişletilir).
- Dönem hedefi ekranı, her hedefe katkı yapan kararları gösteriyor.
- Mevcut kayıtlar yükleniyor. 1923–2030 büyük kampanya matrisi geçiyor.

---

## 7. Racon Manager

**Bugünkü oyuncu deneyimi.**
- Korku / Saygı / Nam / Racon değerleri değişiyor ama bir görevin sonucu bu
  değerlere neden o kadar yansıdığı açık değil.
- Kademe hedefi uzak ve tek boyutlu.

**Ürün hedefi.**
- Her görev sonucu kısa bir "neden" satırı taşısın (hangi adam, hangi risk,
  hangi değer).
- Bir sonraki kademeye giden yol, somut ara hedeflerle görünsün.

**Olası dosyalar.**
- `public/games/racon/content.js` ve paylaşılan next-wave çalışma zamanı
  (`public/games/next-wave/shared/runtime.js`, `next-wave.js`)
- İlgili testler: `scripts/*racon*`

**Kabul ölçütleri.**
- Her görev sonucunda değer değişimleri ve nedeni tek satırda gösteriliyor (tüm
  görev türleri için test).
- Kademe ekranında en az üç ara hedef var. İlerleme, motordaki değerlerle birebir
  tutarlı.
- Bot politika matrisinde hiçbir tek emir türü baskın değil (en iyi alternatiften
  ≤ 10 puan fark).
- Mevcut kayıtlar yükleniyor.

---

## Bu dalganın dışında

- Mac Dock / native PWA testi
- Yeni oyun eklenmesi
- Tamamlanmış özelliklerin yeniden yapılması
