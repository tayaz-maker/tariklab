# TarikLab devam raporu —20 Ekim2026,18:14 Europe/Istanbul

## Yetki ve iş paylaşımı

Kullanıcının18:09 talimatı: **“CI kontrollerini bana bırak. Sen gerisini hallet.”** Bu andan sonra CI izlenmedi/poll edilmedi; başarısı bilinmeyen bir gate varsayılmadı. Kod, yerel doğrulama, production kanıtları, ayrı PR'lar ve bu devir kaydı tamamlandı. CI sonuçları bildirilince asistan sıradaki release/reconcile/production işlemlerini yürütür. Racon yayımlandı diye raporlanmaz.

## Son doğrulanan canonical main

`272c5ea08340de09e777ee60a03b0ccd4da96632` — Kıyı Eşiği#210 squash merge. Son kaynak/ref okumasında bu SHA doğrulandı. #112 eski kart taslağı donmuş, #131 kapalı. Üç aktif geliştirme PR'ı A#211/B#212/C#213; eski donmuş#112'ye dokunulmadı.

## Tamamlanan Wave1 karar release'i

#209 squash SHA `2472042f3e97d21c2cbf64fa47588505a972d369`. #208 main39435358096 ve #209 güncel-head özel39437407237/genel39437407260 PASS doğrulandıktan sonra merge edildi. Merge sonrası main39440135652 ve özel39440135674 PASS.

İki actual production origin kabulü39441728264 PASS: her host14 kesin dosya SHA-256,42 karar/save-reload,6 Bükücü gerçek slot satın alma/reload, özgün tam Bükücü kural/dört mod koşusu ve12 portal senaryosu. Chromium151.0.7922.34; TR/EN/PL×390/1280. www artefakt12273587976; Workers12273627536. İndirilen ZIP SHA'ları doğrulandı, seçili mobil/masaüstü ekranlar görsel incelendi. Tüm ham sonuçlar, sürüm, senaryo izleri ve dosya hash'leri `evidence/WAVE1_DECISION_RELEASE_RECEIPT_2026-10-20.json` içinde kalıcı. İlk yerel production girişimlerindeki yalnız proxy taşıma timeout'ları final kanıt sanılmadı; değiştirilmemiş testler GitHub-hosted Chromium'da iki gerçek hostta tamamen geçti.

## Kıyı Eşiği arşiv release'i

#210 tüm kendi güncel-head zorunlu CI/deployment kontrolleri PASS ve #209 kapanışı sonrası squash merge edildi. Arşiv ref `archive/kiyi-esigi-pre-retirement-20261020`, post-Wave1 SHA2472042'de oluşturuldu ve GitHub'dan geri okundu. Oyun motoru, kaynaklar, shared/Pixi, orijinal rotalar, primary/backup ve sekiz recovery slotu korundu. Aktif katalog/Kaynaklar/sitemap'ten çıkarıldı; eski rotada noindex arşiv bildirimi var.

Production39444737065 iki hostta PASS: her host16 kesin dosya hash'i,6 Kıyı ve6 İHTİLÂL mevcut save→hamle→reload senaryosu, sitemap dışlama ve JITEM SOURCE/runtime/portal sürekliliği. www artefakt12276215180; Workers12276420113. ZIP SHA'ları ve mobil/masaüstü ekranlar doğrulandı. Tam kanıt `evidence/KIYI_ARCHIVE_RELEASE_RECEIPT_2026-10-20.json` içinde. Proof branch `qa/kiyi-archive-release-20261020`, head `d84263f87f5ba59f575d6211ec3396e74d8a781a`.

İlk proof39444173050 başarısızdı: Workers güncelleme bitmeden eski credits sundu; ayrıca doğrulayıcı ham SW kaynağını build'in asset listesi eklediği çıktıyla kıyaslıyordu. Product testleri gevşetilmedi: proof artık aynı-commit build çalıştırıp üretilen SW'yi de kesin byte eşitliğiyle karşılaştırıyor. Workers'ın güncel credits'i de kesin eşleşti. Düzeltilmiş koşu PASS. Main CI39443993564'ün son sonucu18:09'dan beri kullanıcı takibindedir; bundan sonraki merge için sonucu gerekir.

## Racon paketleri — kod ve PR hazırlığı tamam, release bekliyor

| Paket | PR | Head | Base | Durum |
|---|---|---|---|---|
| A: ekonomi/bölge | #211 | c1aa3e6acd804fecf8bab9626cdfded33dfe4374 | main272c5ea | Açık,11 dosya; CI kullanıcıda |
| B: ekip/polis | #212 | d914d4145c5904e456799a8115be7bb6206cc2f0 | A branch'i | Taslak, yalnız10 dosya |
| C: dil/uzun koşu | #213 | e66a59e9e3a79c2f6383be9e2539b993ea924a7e | B branch'i | Taslak, yalnız11 dosya |

Kesin sıra A→B→C. B/C **geliştirme base'ine merge edilmez**. Önceki paket squash release ve main/production kabulü sonrası sıradaki branch canonical main'e uzlaştırılır, aynı PR main'e retarget edilir, oluşan yeni/current head'in tüm zorunlu kapıları PASS olunca squash edilir. Maksimum üç aktif geliştirme PR'ı korunur. Yerel/public/browser doğrulaması CI PASS yerine geçmez.

A'nın özel racon-quality CI39444107915'i devirden önce PASS görüldü. Genel39444107982 ve tc-job-start39444107874 kullanıcıda; sonradan izlenmedi. B/C draft CI'ları kullanıcı tarafından görülebilir.

A: uygun semt/şehir geliri tahmini,800 dirty→clean hareketinin transfer olarak gösterilmesi, haftalık mührün doğru süre korunması. B: injury/izin/askerlik durumu, retained manager assignment, kapalı polis teması ve geçerli haftalık tip, görünür/atomik kepenk bedeli ve loaded-state paper lifetime. C: manager/paper/save/nav/aria ve24 günlük atmosfer metninde render-only TR/EN/PL; Türkçe kayıt hikâyesi, RNG, fiyat/katsayı, format/anahtar/version ve mevcut UI/art korunur.

C'nin bc781136 checkpoint'inde literal kesilmiş271 renderer satırı vardı; B'den aynen kurtarıldı. Kurtarma branch'i `sol/racon-language-longrun-20261020` / `b003866054f07370d617f891d51928ffc235a8a2` korunur. En son birleşik kaynak checkpoint'i `sol/racon-integration-checkpoint-20261020` / `477e86a573902c61e47129b8c801e6eb14740a0a`; bu birleşik branch doğrudan release edilmez.

Birleşik temel:2335 test PASS,0 FAIL,1 mevcut koşullu skip; typecheck/build PASS, lint0 error. Final C124 odaklı test ve kaynak6/temiz-build6 TR/EN/PL×390/1280 dil senaryosu PASS; assignment, polis bedeli, canonical story/weather ve tam serialized gameplay reload karşılaştırılır; sadece normal savedAt zaman damgası değişebilir. Mevcut source/built viewport60, built region6, crew18 ve map47 kontrolleri PASS. Uzun koşuda eski üç profil,12 seed ve investor/high-risk için üçer seed determinism PASS. İleri yatırımcı başlangıcı açıkça özel fixture'dır; doğal kariyer başarısı iddia edilmez. Yeni denge katsayısı veya sanat yok.

## Production'a hazır doğrulama aracı

`tools/release-proof/prepare-racon-proof.py` ve yanındaki `racon-release-production.mjs` Racon A/B/C için gerçek source/test scriptlerini koruyan production proof Git tree girdilerini üretir. Tek fark ayrı transport kopyasında origin'in exact actual hosta alınmasıdır; assertion/timeout değişmez. Her stage aynı-commit tüm Racon dosyaları ve ortak bağımlılıklarının exact hash'lerini,6 bölge, B/C'de18 ekip-polis, C'de6 dil ve her stage6 portal/full save-reload senaryosunu koşar. Stage ve canonical SHA değerleri gerçek squash merge sonrası doldurulur. Racon production henüz çalıştırılmadı/sertifikalanmadı; kod henüz yayında değil.

## Diğer oyunlar ve ertelenenler

`GAME_QUALITY_CONTINUITY_2026-10-20_TR.md`,18 canlı oyunun mevcut kod/test/kanıt eşlemesini ve açık sınırları kaydeder. Eski19 Eylül audit'indeki HANEDANIAN float/welcome ve üretim önizlemesi gibi işlerin zaten düzeltilmiş olduğu kaynakta görüldü; yeniden yapılmadı. Yeni bütün-katalog fiziksel/human certification iddiası yok.

JITEM standalone main e1d5bf742d012ef9355f7d822fa31bc896cd7c8d tekrar doğrulandı; ADAPT yeniden yapılmaz. TC SIM beş paket DONE, yeniden açılmaz. Kart651/900 ve249 kalan, Anatomi Atlası, çizgi roman haritaları, site boyut/performans ve kapsam dışı TC SIM işleri ertelenmiş. DARBE-H→DARPE-H adı güncel katalog, HTML ve TR/EN/PL kaynaklarda henüz uygulanmamış; DONE denmez. Fiziksel QA UNKNOWN/kullanıcıya ait. Vercel için GitHub deployment sonucu ve actual-host kabulü kullanıldı; eski403 API kaydı güncel API READY iddiasına dönüştürülmedi.
