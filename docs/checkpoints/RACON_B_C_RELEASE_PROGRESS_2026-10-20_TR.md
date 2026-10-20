# Racon B/C release continuation — 20 Ekim 2026

## SON DOĞRULANMIŞ DURUM — B production FAIL / C draft

Actual production proof39466070754 tamamlandı: www job118777693967 ve Workers job118777693760 FAILURE. İkisinde de kesin hata `exact deployed bytes: public/games/racon/index.html`; B kaynak byte'ları production'da yok. Test gevşetilmedi. Staging candidate PASS, public production FAIL ayrı tutulur. Guard önce anonim auth200/null doğrulamasını geçti; hata source parity aşamasındadır. B production kapanışı YAPILMADI. C merge edilmedi.

Native alternatif buildcafb829c-817b-46dc-af4b-e89c2aaf5c0d de FAILURE; hesabın loglarına erişim olmadığı için nedeni varsayılmıyor. Browser transport erişimi yok, ayrı Cloud Browser yalnız login ekranı sunuyor. Yeni giriş/token istenmedi. Bu somut engeller nedeniyle kalan production mutation yapılmış gibi gösterilemez.

## Son durum

- Cloudflare migration ve Racon A production kabulü CLOSED / PASS. Ayrıntı `CLOUDFLARE_MIGRATION_2026-10-20_TR.md`.
- Canonical main: `9b5a06e349131d912baee1a7bb5ba86ced4a9b1e` — B #212 squash merge.
- B staging kabulü PASS; **B production promotion/kapanışı yapılmadı**. En son görülen production hâlâ kabul edilmiş A version `1a0557a0` idi. www ve workers.dev aynı Worker'a bağlıdır.
- C #213, B main üzerine uzlaştırıldı ve aynı PR main'e retarget edildi; yeni head `8a9f2d3ea961e2c5ebe9de4e5a708b13e2e6d831`. Taslak, merge edilmedi. B production kapanışından önce C release yapılmaz.
- Kullanıcının son talimatıyla genel CI takibi kullanıcıya bırakıldı. Bu talimattan sonra main/C CI polling yapılmadı. Bu, FAIL/PENDING bir kontrolü PASS kabul etmek veya test kapısını kaldırmak değildir.

## B merge kanıtı

PR #212 head `72a40678568779d2b004144bd0d23b63ed5b987b`, parent A main `15ca52a07e504c7244556bd377012b842d998bf6`; exact tree `4523c43260e07bea267154f94a744e68ee640f90`.

Merge öncesi current-head doğrulandı:

- CI `39458757447`: bütün jobs ve aggregate build SUCCESS.
- TC job-start `39458757555`: SUCCESS.
- Racon quality `39458757612`: SUCCESS.
- Workers Builds: SUCCESS, preview build `73e0f4d1-d3ec-4b12-aa90-72a2d5654934`.
- Eski retarget concurrency run `39458755013` iptal edilmiş dependencies yüzünden aggregate failure içerir; kabul edilen sonuç değildir. Güncel run'ın PASS'i esas alındı. Aynı eski head koşuları kalite/TC history'sinde kalır.
- Vercel FAILURE: “Deployment rate limited — retry in 24 hours.” Görünür legacy hosting kotası; test başarısı gibi sunulmadı.

Expected-head guard ile squash merge sonucu B main `9b5a06e349131d912baee1a7bb5ba86ced4a9b1e`; tree aynı kaldı. B kapsamı 10 dosya, 146 ekleme / 19 silme idi.

Post-merge main koşuları: CI `39462047238`, TC `39462047566`. Kullanıcı CI takibini devralmadan önce TC www/workers SUCCESS; changes/build-core/campaign-balance/campaign-browser SUCCESS görülmüştü. Son genel browser işi sürüyordu. Sonraki nihai durum bu belge tarafından doğrulanmış sayılmaz; CI sahibi kullanıcıdır.

## B exact main staging kabulü

Cloudflare main build `3d3e844d-9f54-46f9-88aa-cb92bd01d8b1`, candidate version `de08ead6`, URL `https://de08ead6-tariklab.tayaz29.workers.dev`.

Run https://github.com/tayaz-maker/tariklab/actions/runs/39464279187 SUCCESS. QA branch `qa/racon-b-staging-20261020`, commit `9ea0cef574f6417ef208f04e9a4c98bf5aacb05b`; parent exact B main. Script yalnız bu exact candidate origin'ine izin verir. Bu origin'e giden izole Chromium testleri:

- 14 exact source file SHA-256 ve byte eşitliği.
- Orijinal region/weekly-seal suite: 6 vaka.
- Orijinal crew/police/shutter suite: 18 vaka.
- Portal iframe tam serialized save/reload: TR/EN/PL × 390/1280, 6 vaka.
- `/api/auth/get-session`: cookie/credential taşımayan anonim request, HTTP200 ve JSON null.

Transport kopyalarında yalnız test origin'i RACON_BASE ile yönlendirildi; assertions ve timeout'lar korunur. Dış host izni yalnız açıkça whitelist edilmiş kabul hedefine erişim içindir. Kaynak oyun testleri gevşetilmedi. Local terminalin dış erişim 403'leri site hatası olarak raporlanmadı; kabul gerçek runner Chromium'undan alındı.

Artifact `12283414834`, 11.263.876 byte, bağımsız indirildi ve ZIP SHA-256 doğrulandı:
`57d517ccad6365f4dcdf0f4a2496de4964a4907cb3d17ea73255bf1356203d2b`.

Seçilmiş mobile PL manager ve desktop EN shutter ekranları incelendi. Mekanik kabul PASS'tir; B görsellerinde kalan legacy Türkçe metinleri C ve sonraki korpus denetimi kapsamıdır. %100 TR/EN/PL korpus sertifikası verilmez. Machine-readable receipt `evidence/RACON_B_CANDIDATE_ACCEPTANCE_2026-10-20.json`.

## C hazırlığı

Önceki C remote head `e66a59e9e3a79c2f6383be9e2539b993ea924a7e`. Güncel B main üzerine aynı hazırlanmış C tree `6de5ef32710ed31860b319f18b78ec278e4588df` ile commit oluşturuldu. Remote branch `sol/racon-c-release-20261020`, expected-old-SHA force-with-lease ile `8a9f2d3ea961e2c5ebe9de4e5a708b13e2e6d831` üzerine alındı. Aynı #213 PR base main oldu; yeni diff 11 dosya, 372 ekleme / 23 silme. Yeni PR açılmadı; taslak korunur.

C yalnız manager sunumu / locale-aware uppercase / ARIA / save-status / paper ve günlük atmosfer metinleri ile uzun oyun test kapsamıdır. SAVE_VERSION, RNG, kayıt formatı/anahtarları ve mevcut manager mimarisi korunur. GTA-manager genişlemesi ayrı kalır. Investor long-run başlangıcı açıkça sentetik advanced fixture'dır; doğal kariyer kazanımı diye sunulmaz.

C'nin yeni head CI/Chromium sonucu bu checkpoint'te PASS ilan edilmez; kullanıcının CI takibindedir. B gerçek production kabulü ve C'nin bütün mandatory kapıları tamamlanmadan C merge/release yok.

## Mevcut araç engeli ve devam adımı

Önceki bağlı Chrome üzerinden Cloudflare dashboard, DNS ve release ayarları başarıyla değiştirildi; B exact main adayı da bu oturumda görüldü. Son kullanıcı mesajları sonrasında Browser aracı “originating browser context” erişim hatası vermeye başladı. Bu, Cloudflare hesabının çıkış yaptığının kanıtı değildir. Araç bağlantısı ile hesap girişi ayrı tutulur.

Cloud Browser'da doğrudan yetkili Cloudflare URL'si kontrol edildi; bu ayrı tarayıcı login ekranına yönlendi. Google auth state okunmadı, yeniden giriş/device flow/token istenmedi. Plugin Management keşfi Cloudflare için ek hesap yönetim aracı döndürmedi; görünen Cloudflare MCP araçları documentation kapsamındadır. Gizli değer veya browser credential okunarak çözüm aranmadı.

Bu nedenle B promotion yapılmış gibi raporlanamaz. Tarayıcı erişimi mevcut oturuma döndüğünde ve CI sahibi gerekli main kapılarını doğruladığında:

1. Worker Deployments'ta **exact main9b5a06e / build3d3e844d / candidate de08ead6** satırını promote et; başka QA/docs preview'sini seçme. A1a0557a0 rollback olarak kalsın.
2. `qa/racon-b-production-20261020` branch'ini hazırlanmış proof commit `e4033c9ac9f9ffd9fa8c4b65b1679d588eb0a133` üzerinde oluştur. Parent B main, tree `b113d05abc14a690ae247350dc3001da42cf8723`; www/workers actual production proof'u tetikler. Sonraki native promotion girişimi sonrası bu proof branch’i oluşturuldu; sonuç aşağıdaki son durum notunda ayrılır.
3. İki actual origin'de 14 hash + region/crew/portal + anonim SSR PASS; ZIP hash ve ekranları doğrula; B kapanış checkpoint'i oluştur.
4. C #213 yeni head mandatory CI/Chromium PASS ve B kapanışı sonrası ready/squash; yeni main kimliğine ait CF adayını aynı güvenli sırayla promote/accept et. C production generator'ı yeni squash SHA ile çalıştır; PR head'i main SHA sanma.

Yeniden üretilebilir release helper'ları `tools/release-proof/prepare-racon-proof.py` ve `racon-release-production.mjs` içinde güncellendi. Generator `b|c`, canonical main SHA ve ilgili source root alır. C dış-host guard için BROWSER_ALLOW_EXTERNAL_HOST=1 açıkça verilir; host whitelist ve bütün game assertions korunur.

## Kalite programı

18 canlı oyun için envanter, mekanik döngü, mevcut test kaynakları, kayıt sözleşmeleri, doğal final/çıkmaz, ekonomi/denge, dil/mobil/masaüstü/uzun oyun ve P0/P1/P2 bulgu formatı `ASTRA_18_GAME_AUDIT_READINESS_2026-10-20_TR.md` içinde hazırdır. Bu hazırlıktır; henüz yapılmamış tam audit'in PASS raporu değildir. TC beş paket, JITEM ADAPT ve arşivler korunur. Ertelenen kart/map/atlas/performance işleri başlatılmadı.


## Tarayıcıdan bağımsız native promotion yolu — başlatıldı

Mevcut Cloudflare Workers Builds managed credential'ı ile yalnız kabul edilmiş B versiyonunu promote eden operasyon branch'i hazırlandı: `release/cloudflare-b-verified-20261020`, commit `30d74d0271a7953fd750b40b8fc72fb0ced4ca6d`.

Bu branch main'e merge edilmez ve production source olarak deploy edilmez. Korunan mevcut npm build'in sonuna guard operasyonu eklenmiştir. Script mevcut managed token yalnız ortamda varsa, değerini loglamadan Cloudflare'ın kendi API'sine kullanır; yeni token/login yok. Önce exact canonical main kimliği, #212 merge SHA, B main CI39462047238 ve TC39462047566 completed/success durumu ve adayın14 SHA'sı eşleşmelidir. Ardından version prefix de08ead6 tekil full ID'ye çözülür; mevcut production yalnız kabul edilmiş A1a0557a0 veya zaten aynıB ise işlem yapılabilir. Beklenmeyen sürüm/split, değişenmain, pending/failCI, eksik credential veya hash farkında mutation yapılmaz. Yalnız immutable kabul edilmiş B version'ına100% deployment oluşturulur; route, DNS, binding, secret ve veri değiştirilmez.

Native build sonucu ve actual production kabulü henüz bu ek not tarafından PASS sayılmaz. Sonuç ayrıca kapanış bölümünde doğrulanmalıdır. Bu yol, tarayıcı transport sorunu için mevcut deployment credential'ının kendi hizmetinde kullanımıdır; credential alma/ifşa etme veya bir CI kapısını bypass etme değildir.


Native promotion build `cafb829c-817b-46dc-af4b-e89c2aaf5c0d` (commit30d74d0) GitHub Workers Builds check'inde FAILURE döndü. Check yalnız build linkini verdi, hata nedeni/log içeriği erişilebilir değil; eksik token veya CI sonucu varsayılmadı. Yayıma hiç ulaşmadığı da varsayılmamalı: guard promotion tamamlandıktan sonraki preview upload aşaması da fail etmiş olabilir. B exact actual-host acceptance bu nedenle `qa/racon-b-production-20261020` / e4033c9 üzerinde başlatıldı; source hash ve Chromium kanıtı olmadan production başarısı iddia edilmez. Credential değerleri açılmadı, yeni giriş istenmedi.
