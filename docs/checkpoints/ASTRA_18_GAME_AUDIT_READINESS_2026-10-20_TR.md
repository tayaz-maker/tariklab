# Astra Pro — 18 canlı oyun için kaynak temelli kalite denetimi hazırlığı

Bu belge denetim girdisidir; bütün mekaniklerin kusursuz olduğu veya insan/fiziksel cihaz kabulü anlamına gelmez. Canlı envanter `src/lib/games.ts` kaynağından çıkarıldı. Kaynak tabanı 15ca52a07e504c7244556bd377012b842d998bf6; Racon B/C henüz kabul kapılarına tabidir.

## Korunacak temel

- TC SIM beş paket ve JITEM ADAPT tekrar geliştirilmez; yalnız yeniden üretilmiş regresyon ele alınır.
- SAVE_VERSION, RNG, kullanıcı save anahtarları ve formatları korunur; mevcut oyunlar sıfırdan yazılmaz.
- İHTİLÂL ve Kıyı Eşiği aktif 18 oyundan ayrıdır; kaynaklar, rotalar ve kayıtlar arşivde korunur.
- Racon GTA-manager genişlemesi, A/B/C hata düzeltmelerinden ayrı ürün işidir.
- Kart 651/900, kalan 249; DARBE→DARPE, harita sanatı, Anatomi Atlası ve performans ertelenmiştir.

## Ortak production kanıtı ve sınırlar

Cloudflare Worker main15ca52a: 70 kesin dosya hash’i, TR/EN/PL × 390/1280 için 108 canlı rota, altışar İHTİLÂL/Kıyı kayıt-hamle-reload kabulü; orijinal Wave 1 dört oyunda 24 bozuk-save/depolama hatası senaryosu ve TC SIM orijinal suite 126 kayıt PASS (Workers artifact12281001981). www RUM/offline düzeltmesi sonrası final kabul ayrıca kaydedilecek. 108 rota testi giriş/render/taşma/console/asset/dil tercihi kontrolüdür; 108 tam oyun veya yüzde100 çeviri korpusu sertifikası değildir.

Fiziksel cihaz kabulü UNKNOWN / kullanıcıya ait. Kaynakta test bulunması mevcut testin yeniden koşulduğu anlamına gelmez; her bulgu exact SHA, komut, fixture ve FAIL→PASS kanıtıyla ayrılmalıdır.

## Oyun bazında denetim girdileri

### Çete Savaşları

- Rota: `/cete-savaslari`; kaynak: `src/game; src/components`.
- Mevcut döngü: Semt, itibar, nakit ve zaman yönetimi.
- Korunan iş/kanıt: Formül/saat/final/outcome ve gerçek eylem-kayıt akışları.
- Kaynakta bulunan kontrol dosyaları: Ortak testler ve standalone kanıtları üzerinden doğrula; yeni doğrulama varsayma..
- Denetle: gerçek başlangıç→anlamlı karar→save→reload; bozuk/eksik/eski sürüm kaydı ve quota/storage exception; doğal final ve çıkmazlar; ekonomi/denge; TR/EN/PL; 390/1280; deterministik uzun oyun.
- Eksik/hatalı mekanikler: henüz kapsamlı kaynak denetimiyle belirlenmedi. Bulguyu istekten veya eski audit metninden uydurma; mevcut kodla yeniden üret.
- Öncelik: doğrulanmış veri kaybı/kilitlenme P0; oynanış, ekonomi veya anlam bozan dil hatası P1; ikincil görsel/metin/ergonomi P2. Belirsizlik issue değil, denetim sorusudur.

### HANEDANIAN

- Rota: `/oyna/hanedanian`; kaynak: `public/games/hanedanian`.
- Mevcut döngü: Yerleşim, üretim kuyruğu, keşif, ordu ve hanedan.
- Korunan iş/kanıt: Gerçek SW/IndexedDB, önceki kayıt kurtarma, campaign ve soak.
- Kaynakta bulunan kontrol dosyaları: `scripts/hanedanian-ui.test.mjs`, `scripts/hanedanian-offline.test.mjs`, `scripts/hanedanian-ultra-browser.mjs`, `scripts/hanedanian-map.test.mjs`, `scripts/hanedanian-save.test.mjs`, `scripts/hanedanian-map-decisions.test.mjs`, `scripts/hanedanian-core.test.mjs`, `scripts/hanedanian-orders.test.mjs`, `scripts/hanedanian-logistics.test.mjs`, `scripts/hanedanian-map-pixi.test.mjs`, `scripts/hanedanian-browser.mjs`, `scripts/hanedanian-quality-browser.mjs`, `scripts/hanedanian-progression.test.mjs`, `scripts/hanedanian-outcome.test.mjs`, `scripts/hanedanian-redirect-browser.mjs`, `scripts/hanedanian-map-relief.test.mjs`, `scripts/hanedanian-redirect-transport.test.mjs`, `scripts/hanedanian-atlas-scheduler.test.mjs`.
- Denetle: gerçek başlangıç→anlamlı karar→save→reload; bozuk/eksik/eski sürüm kaydı ve quota/storage exception; doğal final ve çıkmazlar; ekonomi/denge; TR/EN/PL; 390/1280; deterministik uzun oyun.
- Eksik/hatalı mekanikler: henüz kapsamlı kaynak denetimiyle belirlenmedi. Bulguyu istekten veya eski audit metninden uydurma; mevcut kodla yeniden üret.
- Öncelik: doğrulanmış veri kaybı/kilitlenme P0; oynanış, ekonomi veya anlam bozan dil hatası P1; ikincil görsel/metin/ergonomi P2. Belirsizlik issue değil, denetim sorusudur.

### Racon Manager

- Rota: `/oyna/racon`; kaynak: `public/games/racon`.
- Mevcut döngü: Bölge ekonomisi, ekip, polis baskısı ve gecikmeli sonuçlar.
- Korunan iş/kanıt: A/B/C ayrı release zinciri; manager/save/RNG aynen korunur.
- Kaynakta bulunan kontrol dosyaları: `scripts/racon-network.test.mjs`, `scripts/racon-deferred.test.mjs`, `scripts/racon-overdue-closure.test.mjs`, `scripts/racon-longrun.mjs`, `scripts/racon-map-browser.mjs`, `scripts/racon-quality.test.mjs`, `scripts/racon-save-validation.test.mjs`, `scripts/racon-region-browser.mjs`, `scripts/racon-outcome.test.mjs`, `scripts/racon-map-consequences.test.mjs`, `scripts/racon-region-income.test.mjs`, `scripts/racon-apartman-content.test.mjs`, `scripts/racon-quality-browser.mjs`, `scripts/racon-final.test.mjs`.
- Denetle: gerçek başlangıç→anlamlı karar→save→reload; bozuk/eksik/eski sürüm kaydı ve quota/storage exception; doğal final ve çıkmazlar; ekonomi/denge; TR/EN/PL; 390/1280; deterministik uzun oyun.
- Eksik/hatalı mekanikler: henüz kapsamlı kaynak denetimiyle belirlenmedi. Bulguyu istekten veya eski audit metninden uydurma; mevcut kodla yeniden üret.
- Öncelik: doğrulanmış veri kaybı/kilitlenme P0; oynanış, ekonomi veya anlam bozan dil hatası P1; ikincil görsel/metin/ergonomi P2. Belirsizlik issue değil, denetim sorusudur.

### TC SIM

- Rota: `/oyna/tc-sim`; kaynak: `public/games/tc-sim`.
- Mevcut döngü: Haftalık hayat, iş, finans, sağlık ve sosyal sonuçlar.
- Korunan iş/kanıt: Beş paket DONE; SAVE_VERSION 6 ve V5/V6 korunur; yeniden geliştirme yok.
- Kaynakta bulunan kontrol dosyaları: `scripts/wave5-tc-sim-devlet-depth.test.mjs`, `scripts/tc-sim-package2-acceptance.test.mjs`, `scripts/tc-sim-map-visual.test.mjs`, `scripts/tc-sim-final-v1.test.mjs`, `scripts/tc-sim-askerlik.test.mjs`, `scripts/tc-sim-intimacy.test.mjs`, `scripts/tc-sim-work-recovery.test.mjs`, `scripts/tc-sim-mortgage-enforcement.test.mjs`, `scripts/tc-sim-vehicle-insurance.test.mjs`, `scripts/tc-sim-risk-layer.test.mjs`, `scripts/tc-sim-hardening.test.mjs`, `scripts/tc-sim-semt-emlak.test.mjs`, `scripts/tc-sim-mortgage.test.mjs`, `scripts/tc-sim-production-cache.test.mjs`, `scripts/tc-sim-partner-workplace-browser.mjs`, `scripts/tc-sim-depth-1.test.mjs`, `scripts/tc-sim-housing-net-worth.test.mjs`, `scripts/tc-sim-choice-summary.test.mjs`.
- Denetle: gerçek başlangıç→anlamlı karar→save→reload; bozuk/eksik/eski sürüm kaydı ve quota/storage exception; doğal final ve çıkmazlar; ekonomi/denge; TR/EN/PL; 390/1280; deterministik uzun oyun.
- Eksik/hatalı mekanikler: henüz kapsamlı kaynak denetimiyle belirlenmedi. Bulguyu istekten veya eski audit metninden uydurma; mevcut kodla yeniden üret.
- Öncelik: doğrulanmış veri kaybı/kilitlenme P0; oynanış, ekonomi veya anlam bozan dil hatası P1; ikincil görsel/metin/ergonomi P2. Belirsizlik issue değil, denetim sorusudur.

### Son Mahalle Bükücü

- Rota: `/games/bukucu/index.html`; kaynak: `public/games/bukucu`.
- Mevcut döngü: Semt/tapu/strateji ve dört oyun modu.
- Korunan iş/kanıt: Wave 1 gerçek slot satın alma, devam/yükleme ve RNG fixture korunur.
- Kaynakta bulunan kontrol dosyaları: `scripts/wave1-bukucu-browser.mjs`, `scripts/bukucu-silent.test.mjs`, `scripts/strategy-final.test.mjs`, `scripts/wave1-bukucu-fixture.test.mjs`.
- Denetle: gerçek başlangıç→anlamlı karar→save→reload; bozuk/eksik/eski sürüm kaydı ve quota/storage exception; doğal final ve çıkmazlar; ekonomi/denge; TR/EN/PL; 390/1280; deterministik uzun oyun.
- Eksik/hatalı mekanikler: henüz kapsamlı kaynak denetimiyle belirlenmedi. Bulguyu istekten veya eski audit metninden uydurma; mevcut kodla yeniden üret.
- Öncelik: doğrulanmış veri kaybı/kilitlenme P0; oynanış, ekonomi veya anlam bozan dil hatası P1; ikincil görsel/metin/ergonomi P2. Belirsizlik issue değil, denetim sorusudur.

### Labirent

- Rota: `/oyna/labirent`; kaynak: `public/games/labirent`.
- Mevcut döngü: Tohum ve zorluğa bağlı labirent çözümü.
- Korunan iş/kanıt: Çözülebilirlik, geçiş/duvar sınırı, determinism ve sonuç testleri.
- Kaynakta bulunan kontrol dosyaları: `scripts/tlab-labirent.test.mjs`.
- Denetle: gerçek başlangıç→anlamlı karar→save→reload; bozuk/eksik/eski sürüm kaydı ve quota/storage exception; doğal final ve çıkmazlar; ekonomi/denge; TR/EN/PL; 390/1280; deterministik uzun oyun.
- Eksik/hatalı mekanikler: henüz kapsamlı kaynak denetimiyle belirlenmedi. Bulguyu istekten veya eski audit metninden uydurma; mevcut kodla yeniden üret.
- Öncelik: doğrulanmış veri kaybı/kilitlenme P0; oynanış, ekonomi veya anlam bozan dil hatası P1; ikincil görsel/metin/ergonomi P2. Belirsizlik issue değil, denetim sorusudur.

### Tek Taş

- Rota: `/oyna/peg-solitaire`; kaynak: `public/games/peg-solitaire`.
- Mevcut döngü: Atlayarak taş azaltma ve bitiş değerlendirmesi.
- Korunan iş/kanıt: Geçerli hareket, sonuç ve tlab.tektas.v1 sözleşmesi.
- Kaynakta bulunan kontrol dosyaları: `scripts/tlab-tek-tas.test.mjs`.
- Denetle: gerçek başlangıç→anlamlı karar→save→reload; bozuk/eksik/eski sürüm kaydı ve quota/storage exception; doğal final ve çıkmazlar; ekonomi/denge; TR/EN/PL; 390/1280; deterministik uzun oyun.
- Eksik/hatalı mekanikler: henüz kapsamlı kaynak denetimiyle belirlenmedi. Bulguyu istekten veya eski audit metninden uydurma; mevcut kodla yeniden üret.
- Öncelik: doğrulanmış veri kaybı/kilitlenme P0; oynanış, ekonomi veya anlam bozan dil hatası P1; ikincil görsel/metin/ergonomi P2. Belirsizlik issue değil, denetim sorusudur.

### Satranç

- Rota: `/oyna/satranc`; kaynak: `public/games/satranc`.
- Mevcut döngü: Yasal hamleler, şah/mat/pat ve CPU.
- Korunan iş/kanıt: Rok, terfi, en passant ve stale worker iptali.
- Kaynakta bulunan kontrol dosyaları: `scripts/tlab-satranc.test.mjs`, `scripts/tlab-satranc-ai.test.mjs`.
- Denetle: gerçek başlangıç→anlamlı karar→save→reload; bozuk/eksik/eski sürüm kaydı ve quota/storage exception; doğal final ve çıkmazlar; ekonomi/denge; TR/EN/PL; 390/1280; deterministik uzun oyun.
- Eksik/hatalı mekanikler: henüz kapsamlı kaynak denetimiyle belirlenmedi. Bulguyu istekten veya eski audit metninden uydurma; mevcut kodla yeniden üret.
- Öncelik: doğrulanmış veri kaybı/kilitlenme P0; oynanış, ekonomi veya anlam bozan dil hatası P1; ikincil görsel/metin/ergonomi P2. Belirsizlik issue değil, denetim sorusudur.

### Amiral Battı

- Rota: `/oyna/amiral-batti`; kaynak: `public/games/amiral-batti`.
- Mevcut döngü: Filo yerleştirme, atış ve üç CPU zorluğu.
- Korunan iş/kanıt: Wave 1 nested bozuk-save kontrolü, no-cheat, final sonrası engel.
- Kaynakta bulunan kontrol dosyaları: `scripts/amiral-batti.test.mjs`.
- Denetle: gerçek başlangıç→anlamlı karar→save→reload; bozuk/eksik/eski sürüm kaydı ve quota/storage exception; doğal final ve çıkmazlar; ekonomi/denge; TR/EN/PL; 390/1280; deterministik uzun oyun.
- Eksik/hatalı mekanikler: henüz kapsamlı kaynak denetimiyle belirlenmedi. Bulguyu istekten veya eski audit metninden uydurma; mevcut kodla yeniden üret.
- Öncelik: doğrulanmış veri kaybı/kilitlenme P0; oynanış, ekonomi veya anlam bozan dil hatası P1; ikincil görsel/metin/ergonomi P2. Belirsizlik issue değil, denetim sorusudur.

### Kapı Nöbeti

- Rota: `/oyna/apartman`; kaynak: `public/games/apartman; public/games/next-wave`.
- Mevcut döngü: Bakım, kasa, güven ve haftalık/gecelik kararlar.
- Korunan iş/kanıt: Wave 1 doğru hedef onarımı ve bir kez uygulanan takip etkisi.
- Kaynakta bulunan kontrol dosyaları: `scripts/wave1-decision-repair.test.mjs`, `scripts/wave1-decision-browser.mjs`, `scripts/racon-apartman-content.test.mjs`.
- Denetle: gerçek başlangıç→anlamlı karar→save→reload; bozuk/eksik/eski sürüm kaydı ve quota/storage exception; doğal final ve çıkmazlar; ekonomi/denge; TR/EN/PL; 390/1280; deterministik uzun oyun.
- Eksik/hatalı mekanikler: henüz kapsamlı kaynak denetimiyle belirlenmedi. Bulguyu istekten veya eski audit metninden uydurma; mevcut kodla yeniden üret.
- Öncelik: doğrulanmış veri kaybı/kilitlenme P0; oynanış, ekonomi veya anlam bozan dil hatası P1; ikincil görsel/metin/ergonomi P2. Belirsizlik issue değil, denetim sorusudur.

### Kayıp Telefon

- Rota: `/oyna/kayip-telefon`; kaynak: `public/games/kayip-telefon; public/games/next-wave.js`.
- Mevcut döngü: Kanıt keşfi, bağlantı kurma ve teori üretme.
- Korunan iş/kanıt: Bozuk UI pointer kurtarma; reddedilen ham kaydı koruma.
- Kaynakta bulunan kontrol dosyaları: `scripts/wave1-pov-phone-save.test.mjs`, `scripts/wave1-save-browser.mjs`, `scripts/son100-pov.test.mjs`.
- Denetle: gerçek başlangıç→anlamlı karar→save→reload; bozuk/eksik/eski sürüm kaydı ve quota/storage exception; doğal final ve çıkmazlar; ekonomi/denge; TR/EN/PL; 390/1280; deterministik uzun oyun.
- Eksik/hatalı mekanikler: henüz kapsamlı kaynak denetimiyle belirlenmedi. Bulguyu istekten veya eski audit metninden uydurma; mevcut kodla yeniden üret.
- Öncelik: doğrulanmış veri kaybı/kilitlenme P0; oynanış, ekonomi veya anlam bozan dil hatası P1; ikincil görsel/metin/ergonomi P2. Belirsizlik issue değil, denetim sorusudur.

### Son 100 Gün

- Rota: `/oyna/son-100-gun`; kaynak: `public/games/son-100-gun`.
- Mevcut döngü: Son yüz günde sınırlı eylemler ve gecikmeli hayat sonuçları.
- Korunan iş/kanıt: Başarısız save doğru raporlanır; retry eylemi tekrar tüketmez.
- Kaynakta bulunan kontrol dosyaları: `scripts/son100-extreme-refoundation.test.mjs`, `scripts/wave1-pov-phone-save.test.mjs`, `scripts/wave1-save-browser.mjs`, `scripts/son100-two-actions-ui-regression.test.mjs`, `scripts/son100-pov.test.mjs`.
- Denetle: gerçek başlangıç→anlamlı karar→save→reload; bozuk/eksik/eski sürüm kaydı ve quota/storage exception; doğal final ve çıkmazlar; ekonomi/denge; TR/EN/PL; 390/1280; deterministik uzun oyun.
- Eksik/hatalı mekanikler: henüz kapsamlı kaynak denetimiyle belirlenmedi. Bulguyu istekten veya eski audit metninden uydurma; mevcut kodla yeniden üret.
- Öncelik: doğrulanmış veri kaybı/kilitlenme P0; oynanış, ekonomi veya anlam bozan dil hatası P1; ikincil görsel/metin/ergonomi P2. Belirsizlik issue değil, denetim sorusudur.

### TC SIM: DEVLET

- Rota: `/oyna/tc-sim-devlet`; kaynak: `public/games/tc-sim-devlet; public/games/next-wave`.
- Mevcut döngü: Dönem, kurum, politika, hazine ve toplumsal sonuçlar.
- Korunan iş/kanıt: Wave 1 sıfır hazine korunur; doğal final sonrası mutasyon engeli.
- Kaynakta bulunan kontrol dosyaları: `scripts/wave5-tc-sim-devlet-depth.test.mjs`, `scripts/wave5-tc-sim-devlet-final-integration.test.mjs`, `scripts/wave5-tc-sim-devlet-core-longrun.mjs`, `scripts/wave5-tc-sim-devlet-final-longrun.mjs`, `scripts/wave5-tc-sim-devlet-core-repair.test.mjs`, `scripts/wave5-tc-sim-devlet-content.test.mjs`, `scripts/wave5-tc-sim-devlet-rereview.test.mjs`, `scripts/wave5-tc-sim-devlet-longrun.mjs`, `scripts/wave5-tc-sim-devlet-review.test.mjs`.
- Denetle: gerçek başlangıç→anlamlı karar→save→reload; bozuk/eksik/eski sürüm kaydı ve quota/storage exception; doğal final ve çıkmazlar; ekonomi/denge; TR/EN/PL; 390/1280; deterministik uzun oyun.
- Eksik/hatalı mekanikler: henüz kapsamlı kaynak denetimiyle belirlenmedi. Bulguyu istekten veya eski audit metninden uydurma; mevcut kodla yeniden üret.
- Öncelik: doğrulanmış veri kaybı/kilitlenme P0; oynanış, ekonomi veya anlam bozan dil hatası P1; ikincil görsel/metin/ergonomi P2. Belirsizlik issue değil, denetim sorusudur.

### SON KÖY MANAGER

- Rota: `/oyna/son-koy-manager`; kaynak: `public/games/son-kasaba`.
- Mevcut döngü: Köy kaynakları, nüfus, olaylar ve sürdürülebilirlik.
- Korunan iş/kanıt: Wave 1 gerçek katalogla tarihçe sınırı; uzun kayıt yüklemesi.
- Kaynakta bulunan kontrol dosyaları: `scripts/son-kasaba-browser.mjs`, `scripts/son-koy-maintenance.test.mjs`, `scripts/life-town-save.test.mjs`, `scripts/son-kasaba.test.mjs`, `scripts/son-koy-command.test.mjs`, `scripts/wave1-town-save.test.mjs`.
- Denetle: gerçek başlangıç→anlamlı karar→save→reload; bozuk/eksik/eski sürüm kaydı ve quota/storage exception; doğal final ve çıkmazlar; ekonomi/denge; TR/EN/PL; 390/1280; deterministik uzun oyun.
- Eksik/hatalı mekanikler: henüz kapsamlı kaynak denetimiyle belirlenmedi. Bulguyu istekten veya eski audit metninden uydurma; mevcut kodla yeniden üret.
- Öncelik: doğrulanmış veri kaybı/kilitlenme P0; oynanış, ekonomi veya anlam bozan dil hatası P1; ikincil görsel/metin/ergonomi P2. Belirsizlik issue değil, denetim sorusudur.

### VETO-H!

- Rota: `/oyna/veto-h`; kaynak: `public/games/veto-h; public/games/duel-core`.
- Mevcut döngü: Seçim temalı kart düellosu.
- Korunan iş/kanıt: Ortak motor, save namespace, kural, denge, öğretici ve sanat fallback korunur.
- Kaynakta bulunan kontrol dosyaları: `scripts/duel-acceptance.test.mjs`, `scripts/duel-visible-art.test.mjs`, `scripts/duel-flow-copy.test.mjs`, `scripts/duel-inspector.test.mjs`, `scripts/duel-origin-proof.test.mjs`, `scripts/duel-browser.mjs`, `scripts/duel-art.test.mjs`, `scripts/duel-browser-scenarios.mjs`, `scripts/duel-hotfix.test.mjs`, `scripts/duel-expansion.test.mjs`, `scripts/duel-parity.test.mjs`, `scripts/duel-refinement.test.mjs`, `scripts/duel-onboarding.test.mjs`, `scripts/duel-mechanics.test.mjs`, `scripts/duel-release.test.mjs`, `scripts/duel-visible-art-browser.mjs`, `scripts/duel-core.test.mjs`.
- Denetle: gerçek başlangıç→anlamlı karar→save→reload; bozuk/eksik/eski sürüm kaydı ve quota/storage exception; doğal final ve çıkmazlar; ekonomi/denge; TR/EN/PL; 390/1280; deterministik uzun oyun.
- Eksik/hatalı mekanikler: henüz kapsamlı kaynak denetimiyle belirlenmedi. Bulguyu istekten veya eski audit metninden uydurma; mevcut kodla yeniden üret.
- Öncelik: doğrulanmış veri kaybı/kilitlenme P0; oynanış, ekonomi veya anlam bozan dil hatası P1; ikincil görsel/metin/ergonomi P2. Belirsizlik issue değil, denetim sorusudur.

### GETT-OH!

- Rota: `/oyna/gett-oh`; kaynak: `public/games/gett-oh; public/games/duel-core`.
- Mevcut döngü: Mahalle temalı kart düellosu.
- Korunan iş/kanıt: Tema bağımsızlığı ve özgün kart havuzu/namespace korunur.
- Kaynakta bulunan kontrol dosyaları: `scripts/duel-acceptance.test.mjs`, `scripts/duel-visible-art.test.mjs`, `scripts/duel-flow-copy.test.mjs`, `scripts/duel-inspector.test.mjs`, `scripts/duel-origin-proof.test.mjs`, `scripts/duel-browser.mjs`, `scripts/duel-art.test.mjs`, `scripts/duel-browser-scenarios.mjs`, `scripts/duel-hotfix.test.mjs`, `scripts/duel-expansion.test.mjs`, `scripts/duel-parity.test.mjs`, `scripts/duel-refinement.test.mjs`, `scripts/duel-onboarding.test.mjs`, `scripts/duel-mechanics.test.mjs`, `scripts/duel-release.test.mjs`, `scripts/duel-visible-art-browser.mjs`, `scripts/duel-core.test.mjs`.
- Denetle: gerçek başlangıç→anlamlı karar→save→reload; bozuk/eksik/eski sürüm kaydı ve quota/storage exception; doğal final ve çıkmazlar; ekonomi/denge; TR/EN/PL; 390/1280; deterministik uzun oyun.
- Eksik/hatalı mekanikler: henüz kapsamlı kaynak denetimiyle belirlenmedi. Bulguyu istekten veya eski audit metninden uydurma; mevcut kodla yeniden üret.
- Öncelik: doğrulanmış veri kaybı/kilitlenme P0; oynanış, ekonomi veya anlam bozan dil hatası P1; ikincil görsel/metin/ergonomi P2. Belirsizlik issue değil, denetim sorusudur.

### DARBE-H!

- Rota: `/oyna/darbe-h`; kaynak: `public/games/darbe-h; public/games/duel-core`.
- Mevcut döngü: Bürokratik gerilim temalı 300 kartlık düello.
- Korunan iş/kanıt: DARPE-H ad değişimi ve kalan kart üretimi ERTELİ; release edilmiş sanatı rastgele değiştirme.
- Kaynakta bulunan kontrol dosyaları: `scripts/darbe-h-balance.test.mjs`, `scripts/darbe-h.test.mjs`, `scripts/darbe-h-art.test.mjs`, `scripts/duel-acceptance.test.mjs`, `scripts/darbe-h-balance-closure.test.mjs`, `scripts/duel-visible-art.test.mjs`, `scripts/duel-flow-copy.test.mjs`, `scripts/duel-inspector.test.mjs`, `scripts/darbe-h-card-face.test.mjs`, `scripts/duel-origin-proof.test.mjs`, `scripts/duel-browser.mjs`, `scripts/duel-art.test.mjs`, `scripts/duel-browser-scenarios.mjs`, `scripts/duel-hotfix.test.mjs`, `scripts/duel-expansion.test.mjs`, `scripts/duel-parity.test.mjs`, `scripts/duel-refinement.test.mjs`, `scripts/duel-onboarding.test.mjs`.
- Denetle: gerçek başlangıç→anlamlı karar→save→reload; bozuk/eksik/eski sürüm kaydı ve quota/storage exception; doğal final ve çıkmazlar; ekonomi/denge; TR/EN/PL; 390/1280; deterministik uzun oyun.
- Eksik/hatalı mekanikler: henüz kapsamlı kaynak denetimiyle belirlenmedi. Bulguyu istekten veya eski audit metninden uydurma; mevcut kodla yeniden üret.
- Öncelik: doğrulanmış veri kaybı/kilitlenme P0; oynanış, ekonomi veya anlam bozan dil hatası P1; ikincil görsel/metin/ergonomi P2. Belirsizlik issue değil, denetim sorusudur.

### JITEM: Derin Ağ

- Rota: `/oyna/jitem-derin-ag`; kaynak: `public/games/jitem-derin-ag; tayaz-maker/jitem-derin-ag`.
- Mevcut döngü: Dosyalar, güç ilişkileri, aktörler ve gecikmeli ağ sonuçları.
- Korunan iş/kanıt: ADAPT DONE; canonical standalone e1d5bf7 ve runtime 31deba68… korunur.
- Kaynakta bulunan kontrol dosyaları: `scripts/jitem-integration.test.mjs`, `scripts/jitem-scroll-browser.mjs`.
- Denetle: gerçek başlangıç→anlamlı karar→save→reload; bozuk/eksik/eski sürüm kaydı ve quota/storage exception; doğal final ve çıkmazlar; ekonomi/denge; TR/EN/PL; 390/1280; deterministik uzun oyun.
- Eksik/hatalı mekanikler: henüz kapsamlı kaynak denetimiyle belirlenmedi. Bulguyu istekten veya eski audit metninden uydurma; mevcut kodla yeniden üret.
- Öncelik: doğrulanmış veri kaybı/kilitlenme P0; oynanış, ekonomi veya anlam bozan dil hatası P1; ikincil görsel/metin/ergonomi P2. Belirsizlik issue değil, denetim sorusudur.

## Önceden gözlenen dil kuyruğu

- Workers TC SIM PL giriş ekranında açıklama paragrafı Türkçe/Lehçe karışık göründü (`tc-sim-pl-390.png`, migration artifact12281001981). Bu, beş paketin yeniden açılması değildir; kapsamlı korpus denetimi için kaynakla doğrulanacak P1 adayıdır.
- DEVLET PL açıklamalarında EN fallback ve Kıyı arşivinde bazı EN etiketleri önceki continuity belgesinde kaydedildi. Geçerli kodu ve sözcük listesini tekrar doğrula.
- Racon A’nın Türkçe atmosfer/nav metinleri C kapsamındadır; C kabulünden önce bunları yeni mekanik açığı gibi raporlama.

## Astra teslim biçimi

Her oyunda: exact commit ve kaynak yolu; mevcut mekanik; kanıtlanmış hata veya eksik mekanik; tetikleyici/fixture; beklenen-gerçek sonuç; kullanıcı/save etkisi; test/Chromium kanıtı; P0/P1/P2; dar düzeltme önerisi; korunacak geçmiş iş. Bulgu olmayan alanı PASS diye doldurma. Önce kaynak denetimi ve rapor; ayrı yetki olmadan büyük geliştirme veya refactor başlatma.
