# Racon A release kapanışı — 20 Ekim 2026, 18:35 Europe/Istanbul

## Sonuç: yayın kapısı BLOCKED, sonraki merge yapılmadı

Güncel main: `15ca52a07e504c7244556bd377012b842d998bf6`. #211 squash merge doğrulandı; yeniden uygulanmadı. Kaynak ağacı `95d6eebb0cf5b7d33e29f24d41e88d6152a3e171`.

Main CI **39448854353** ve TC job-start **39448854330**, bu kaydın son sorgusunda IN_PROGRESS. PASS iddiası yok. GitHub Workers build kontrolü SUCCESS. Vercel commit status **FAILURE**: **“Deployment rate limited — retry in 24 hours.”** Status oluşturulma zamanı 2026-10-20T15:29:19Z. Hesap planı, limit veya protection değiştirilmedi; deploy zorlanmadı.

Vercel connector list_deployments(sha=main, limit=5) başarılı döndü ve sıfır deployment gösterdi; bu tur Vercel API 403 alınmadı.

## Gerçek production dosya teşhisi

www üzerinde aynı commit'e ait 14 dosyadan **11'i eşleşiyor, 3'ü eşleşmiyor**:
- public/games/racon/index.html
- public/i18n/tlab-i18n.js
- public/i18n/pl/racon.json

Üç sunulan SHA-256 da önceki canonical main `272c5ea08340de09e777ee60a03b0ccd4da96632` kaynaklarıyla birebir eşleşti. Dolayısıyla www üzerinde Racon A henüz doğrulanmış/yayınlanmış sayılamaz. Tam kaynak/sunulan hash'ler eşlik eden JSON'da.

Workers'a bu workspace HTTP istemcisinden 14 isteğin tamamı 403 döndü. Bu, origin'in bozuk olduğuna kanıt değildir; hash/Chromium kabulü olarak da sayılamaz. Önceki turdaki gibi GitHub-hosted proof gerektiğinde kullanılacak.

A'nın production Chromium koşusu **çalıştırılmadı**: istenen sıra gereği main zorunlu kapıları PASS olmadan acceptance başlatılmadı. Hazır proof commit `7457e2aa71069199f1d1c86933fa5e529eb8f616`, parent gerçek main; workflow yalnız `qa/racon-a-production-20261020` push'unda çalışır. Henüz branch oluşturulmadı, dolayısıyla production run/artifact/PASS iddiası yok. Mevcut tools/release-proof araçları ve bütün assertion/timeout'lar korundu.

## B / C durumu

#212 taslak, head `d914d4145c5904e456799a8115be7bb6206cc2f0`, base hâlâ A geliştirme branch'i. #213 taslak, head `e66a59e9e3a79c2f6383be9e2539b993ea924a7e`, base hâlâ B geliştirme branch'i. İkisi de merge/retarget edilmedi; A kapanmadan sıraya atlanmadı.

Beklerken B yerelde main15ca52a üzerine temiz cherry-pick ile uzlaştırıldı: yerel `f5f7458`, ağacı `4523c43260e07bea267154f94a744e68ee640f90`; hazırlanmış uzak B ağacıyla birebir aynı. Yeniden geliştirme yok.

Bu ağaçta 102 Racon hedefli test PASS, 0 FAIL/skip; typecheck ve production build PASS; source18 + built18 ekip/polis gerçek Chromium senaryosu TR/EN/PL × 390/1280 PASS. Yaralanma/izin/askerlik, retained manager, fakir/zengin koruma bedeli ve reload senaryoları mevcut driver ile doğrulandı. Seçili built mobil/desktop ekranları görsel incelendi. B'deki mevcut Türkçe atmosfer/nav/save metinleri C kapsamındadır; bu mekanik kabul tam dil korpusu sertifikası değildir. İlk test komutu repo dışı cwd nedeniyle ENOENT verdi; doğru repo cwd'sinde değiştirilmemiş tüm 102 test geçti. Ürün/test değişikliği gerekmedi.

## Devam ve rollback

1. Main CI39448854353 ve TC39448854330 gerçek sonuçlarını al; FAIL/PENDING varsa sonraki merge yok.
2. Vercel'in bildirdiği kota engeli kalkmadan aynı deploy'u tekrar tekrar tetikleme. API başarılı boş liste, mevcut FAILURE ve eski www hash'leri açıkça kayıtlıdır. Ücretli plan/limit değişikliği yapılmadı.
3. Exact main'i iki production origin'e yayımla/doğrula; hazır A proof commit'inden allowlisted QA branch'ini oluştur, 14 exact hash +6 region/weekly seal +6 portal/save-reload kabulünü al. Başarılı artifact'leri SHA-256 ile doğrulayıp checkpoint'e ekle.
4. A kapanınca B'yi aynı #212 içinde canonical main'e uzlaştır/retarget/ready yap, yeni head'in tam kapıları PASS olunca squash; main ve iki-host production kapanışı. Sonra C#213 aynı sıra.
5. Bu engel nedeniyle Racon sonrası kalite PR'ı başlatılmadı; GAME_QUALITY_CONTINUITY_2026-10-20_TR.md kuyruğu korundu.

Rollback öncesi referans: A öncesi main272c5ea; A commit15ca52a. Save format/version/anahtar değişmedi; B/C henüz main'de değil. www zaten önceki runtime dosyalarını sunuyor, bu tur hiçbir rollback uygulanmadı. Gerekirse #211'in gerçek diff'ini revert eden küçük PR ve aynı CI/production kapıları kullanılır; main force-reset veya kayıt silme yok.

17:20 ve 18:14 handoff'lar, #209/#210 kanıtları, İHTİLÂL/Kıyı arşivleri ve TC SIM/JITEM tamamlanmış kapsamları korunur.
