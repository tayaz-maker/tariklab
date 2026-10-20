# TarikLab devam checkpoint — 20 Ekim 2026

## Tamamlanan release

PR #209 squash merge edildi: `2472042f3e97d21c2cbf64fa47588505a972d369`. Önce #208 main CI39435358096 ve #209 güncel-head özel39437407237/genel39437407260 kontrolleri PASS doğrulandı. Merge sonrası main CI39440135652 ve özel kabul39440135674 PASS.

Gerçek iki production hostundaki kabul run39441728264 PASS: her hostta14 kesin dosya SHA-256,42 karar/save-reload senaryosu,6 Bükücü gerçek slot satın alma/reload senaryosu, özgün tam Bükücü kural/dört mod koşusu ve12 portal senaryosu. Chromium151.0.7922.34; TR/EN/PL,390/1280. www artefakt12273587976 SHA256b8fc3c7b63c77d4b4d4fd4fbba07d7ed4f78b2a4bbf018bf29c7d5b7cf4dd794; Workers12273627536 SHA2560ca1137afed89a34ae85a326128dda0172c1265979494e21382a631c75267e9c. İki artefakt indirildi, SHA'ları doğrulandı ve seçili mobil/masaüstü ekranlar görsel incelendi. Ham sonuçlar ve14 dosya hash'i `evidence/WAVE1_DECISION_RELEASE_RECEIPT_2026-10-20.json` içinde korunur. Yerel ilk erişimlerde yalnız proxy taşıma zaman aşımları vardı; değiştirilmemiş testler GitHub-hosted Chromium'da iki gerçek hostta bütünüyle geçti. Fiziksel cihaz QA UNKNOWN.

## Devam eden arşiv release'i

PR #210 tüm güncel-head kapıları PASS sonrası squash merge edildi. Canonical main `272c5ea08340de09e777ee60a03b0ccd4da96632`. Arşiv ref `archive/kiyi-esigi-pre-retirement-20261020`, post-Wave1 `2472042` SHA'sında oluşturuldu ve GitHub'dan geri okundu. Oyun motorları/kaynaklar/kayıtlar ve güvenli eski rotalar korundu; aktif katalog/Kaynaklar/sitemap'ten çıkarıldı. Main CI39443993564 ve ayrı iki-host production kabulü devam ediyor. Production proof branch `qa/kiyi-archive-release-20261020`, head `4c60a5e40a8011f6eb1a185bcef4de4a4f6c2af3`. Bu kapılar bitmeden Racon A merge edilmez.

## Hazırlanan Racon

A PR #211, head `c1aa3e6acd804fecf8bab9626cdfded33dfe4374`, base272c5ea; yalnız11 dosya, ekonomi/bölge tahmini ve haftalık mühür. CI sürüyor. B ve C ayrı sırada yayınlanacak. Birleşik A/B/C hazırlığı `sol/racon-integration-checkpoint-20261020` / `ffe9c645ecec9f00d9a80c910132f180ccf0c31d` üzerinde korunuyor; bu birleşik branch doğrudan merge edilmez. C checkpoint bc781136 içindeki literal kesilmiş271 renderer satırı B'den aynen onarıldı; kurtarma branch'i `sol/racon-language-longrun-20261020` / `b003866054f07370d617f891d51928ffc235a8a2`.

Birleşik hazırlık:2335 test PASS,0 FAIL, mevcut1 koşullu skip; typecheck/build PASS, lint0 error; kaynak/build altışar dil, built6 bölge,18 ekip-polis,60 ekran,47 harita kabulü PASS. Son gözlenen günlük atmosfer metinlerinin24 satırlık EN/PL kapanışı ayrıca kaynak6 PASS aldı; temiz build kabulü ve checkpoint güncellemesi sürüyor. C ekonomi katsayısı/format değiştirmez; determinism PASS, ileri yatırımcı başlangıcı açıkça ayrı fixture olarak işaretlidir.

## Korunan kısıtlar ve sonraki işlem

#112 dondurulmuş taslak, #131 kapalı. TC SIM beş paket DONE. JITEM standalone main e1d5bf742d012ef9355f7d822fa31bc896cd7c8d tekrar doğrulandı; ADAPT yeniden yapılmaz. Kart651/900 ve249 kalan, Anatomi Atlası, çizgi roman haritaları ve site boyut/performans işleri ertelenmiş. DARBE-H→DARPE-H adı güncel katalog, HTML ve TR/EN/PL kaynaklarda henüz uygulanmamış; DONE denmez. Eski19 Eylül audit'indeki HANEDANIAN float/welcome gibi işleri mevcut kod zaten düzeltmiş; yeniden uygulanmaz.

Kesin sıra: Kıyı main+production PASS → A tüm kapılar+merge+main/production → B → tamamlanan C → yalnız kanıtlanmış kalan oyun eksikleri. FAIL/PENDING merge yok; test/koruma bypass yok.
