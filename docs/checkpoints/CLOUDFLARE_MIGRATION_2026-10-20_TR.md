# TarikLab — Cloudflare migration / Racon A CLOSED — 20 Ekim 2026

## Sonuç ve canonical mimari

Migration ve Racon A gerçek production kabulü PASS. A kaynak SHA'sı `15ca52a07e504c7244556bd377012b842d998bf6`; sonraki B/C release SHA ve kabulü ayrı release checkpoint'inde izlenir.

`https://www.tariklab.com` ile `https://tariklab.tayaz29.workers.dev` **aynı mevcut tariklab Worker'ına ve aynı sürüme** gider. İki bağımsız hosting/deployment değildir. Yeni Worker oluşturulmadı; alan adı transfer edilmedi; ücretli plana geçilmedi.

## Doğrulanmış kaynak ve mevcut altyapı

- A main CI39448854353 ve TC39448854330 SUCCESS. Mevcut required test kapıları korunur.
- GitHub main başlangıçta protected=false, rulesets=[]; hiçbir protection/required check kaldırılmadı. Bu oturumun release kapıları açıkça zorunlu tutulur; olmadığı halde GitHub branch protection varmış gibi raporlanmaz.
- Vercel status FAILURE: “Deployment rate limited — retry in 24 hours.” Legacy hosting kotasıdır; kod/test başarısı yerine konmadı, gizlenmedi.
- Hesap `1c23838a8ed57b3cabd47e117b6ebb62`, mevcut Worker `tariklab`.
- Git entegrasyonu `tayaz-maker/tariklab`, production main, root /, build `npm run build`.
- Mevcut Nitro `cloudflare-module` çıktısı `.output/server/wrangler.json`, `index.mjs`, `nodejs_compat`, ASSETS `../public`; server route/oyun portalı korunur.
- Aynı A main build'inde 1.676 statik dosya, 98.070.160 byte; en büyük dosya 9.107.446 byte. Free sınırı 20.000 dosya, 25 MiB/dosya; sınır aşımı yok. Workers Free runtime için 100.000 request/gün ve 10 ms CPU/invocation geçerlidir; static asset istekleri ücretsiz/sınırsızdır. Yük/stres kapasite sertifikası iddia edilmez. Resmi kaynaklar: https://developers.cloudflare.com/workers/platform/limits/ ve https://developers.cloudflare.com/workers/platform/pricing/ .
- `BETTER_AUTH_SECRET` ve `DATABASE_URL` mevcut encrypted runtime secret adlarıdır; değerleri okunmadı/değişmedi. Supabase `https://omzpbtqdycimveepkylz.supabase.co` korunur. Yerel oyun save'leri aynı www origin'de kalır; Supabase cloud-save yalnız oturum varken çalışır. DB/veri migration yapılmadı.

## DNS, TLS ve rollback

Worker staging kabulü geçmeden DNS değişmedi. Önceki www CNAME `9505bdd839309649.vercel-dns-017.com`, DNS only, TTL Auto idi. Artık Cloudflare-managed custom domain `www.tariklab.com` mevcut tariklab Worker'ına bağlıdır.

Apex A önce 76.76.21.21 / DNS only idi; şimdi 192.0.2.0 / Proxied / Auto. Enabled Single Redirect “TarikLab apex to canonical HTTPS www”: `(http.host eq "tariklab.com")` → `concat("https://www.tariklab.com", http.request.uri.path)`, 308, preserve-query=true. HTTP/HTTPS apex için `/oyna/racon?migration=1` path/query korunarak doğrulandı. Always Use HTTPS enabled; HTTP www, 301 ile aynı HTTPS www path/query'ye gider. Aktif Universal/managed edge sertifikaları görüldü.

MX/SPF/DKIM ve `_vercel` TXT korundu. Vercel projesi silinmedi. Proje repo eşlemesi `cete-savaslari`/`prj_iVuPdLt6iPcAa39B8zbwV4xWwrG1` bulundu; proje detay erişimi403 scope hatası döndü. Otomatik Vercel tetikleyicileri bu yüzden değiştirilmedi. Git'i ayırma veya preview deploy kapatma seçeneği değerlendirildi; Cloudflare release bunlara bağımlı değildir.

- A kabul edilen sürüm: `1a0557a0`, build `96dea54e-80f7-4a81-8c24-6ee30b451490`.
- Pre-A rollback: main `272c5ea08340de09e777ee60a03b0ccd4da96632`, sürüm `8ed58b71`, build `0ef3d6dc-ac72-4a03-9d79-155d176069da`.
- Sonraki release geri dönüşünde önce son kabul edilen CF version'ı %100 promote et; DNS'i gereksiz değiştirme. Vercel'e olağanüstü geri dönüş gerekirse managed custom domain çıkarılmadan aynı www DNS kaydı çakıştırılamaz; eski www/apex hedefleri yukarıda kayıtlıdır. Her geri dönüş sonrası actual-host hash/Chromium kabulü gerekir.

## Release kapısı

Cloudflare production Deploy command kayıtlı olarak `npx wrangler deploy` yerine `npx wrangler versions upload` yapıldı. Preview Version command zaten versions upload idi. Main push aday yükler; otomatik trafik taşımaz. Mevcut managed build token kullanılır; yeni token/login/device flow yok.

Zincir: güncel main'e küçük PR → aynı head mandatory CI/Chromium PASS → squash → yeni main mandatory CI PASS → exact main CF build/versiyonunu promote → iki actualorigin hash/Chromium kabulü PASS → GitHub checkpoint. Bu **CI sonrası kontrollü manuel promotion** politikasıdır; tam otomatik enforcement veya var olmayan branch protection iddia edilmez. Vercel quota FAILURE görünür kalır. Ayrıntı `docs/ops/CLOUDFLARE_RELEASE_POLICY.md`.

## Service worker ve cache sözleşmesi

`public/sw.js` root cache adı `cete-offline-v7`; GET olmayan, cross-origin, `/api/`, `/auth/` ve `/__app-env` isteklerini cache'lemez. Navigation ve listelenmiş modül oyunları/i18n için network-first, çevrimdışında cache fallback; diğer asset'lerde stale-while-revalidate kullanır. `scripts/offline-sw-plugin.mjs` build asset listesini gerçek çıktıdan ekler ve HANEDANIAN'ın kendi atomic package SW sürümünü içerik hash'iyle üretir. Bu yüzden compiled SW ile raw source hash'ini eşit varsaymak yanlıştır. TC/HAN gerçek offline kabulü ve geçerli save/reload kanıtı yukarıdaki koşulardan ayrı olarak kayıtlıdır. Tarayıcı kabulü temiz/izole bağlamlardadır; her geçmiş kullanıcı cache kombinasyonunun exhaustive sertifikası değildir. Mevcut cache/save namespace'leri değiştirilmedi.

## Racon A production kanıtı

Run https://github.com/tayaz-maker/tariklab/actions/runs/39453421549 final SUCCESS, attempt 2. Workers DNS öncesi PASS; www eski A dosyalarını doğru biçimde FAIL etti, DNS sonrası yalnız failed www job aynı assertions ile PASS.

Her origin: 14 exact source hash, 6 region/weekly-seal ve 6 portal tam serialized save/reload; TR/EN/PL × 390/1280. Workers artifact 12278688819 ZIP SHA-256 `3a0a457f4b4269612ca9ff7b2c086f1dbf166a7ceeece3bbf3448e4ea8436504` bağımsız indirildi/doğrulandı. www artifact 12278844782 GitHub digest `3c3016703464428cc966230392d7649348628258b4bb85dec3faec915be2eadc`; local transfer iki kez 503 olduğundan bu ZIP'e bağımsızlocal verify iddia edilmez. Aşağıdaki daha geniş www ZIP'i ayrıca indirildi/doğrulandı.

## Tüm katalog / migration kabulü

Run https://github.com/tayaz-maker/tariklab/actions/runs/39454897150 final SUCCESS, attempt 2; Chromium 151.0.7922.34. Her origin:

- 70 exact source/compiled hash (generated SW, raw kaynak yerine exact compiled output ile karşılaştırıldı).
- 18 canlı oyun × TR/EN/PL × 390/1280 = 108 giriş/render/taşma/console/asset/dil tercihi kabulü.
- 6 İHTİLÂL ve 6 Kıyı Eşiği arşiv save → hamle → reload.
- Orijinal Wave 1 suite: 24 bozuk save / storage fault senaryosu.
- Orijinal TC suite: 126 result row, 10 exact TC fingerprint, SW/offline, migration/control/save/layout.

Son ZIP'ler indirildi, SHA-256 doğrulandı, seçilmiş mobil/masaüstü ekranları incelendi:
- Workers artifact 12281001981: `d06f4d70f63addc3e97fd1ad9b5954a3b6424ade1376efa6d008edb3e23e2300`.
- www artifact 12280299752: `498d24037ed2383ccf4fb8ddd1cc8c5f9e4eab74092f2d263f0ee52dd9deeb4d`.

İlk www TC offline FAIL root cause'u otomatik Cloudflare RUM'un bilinçli offline testi sırasında `/cdn-cgi/rum` POST hatalarıydı. Diagnostic 39456147763 exact URL'leri gösterdi. RUM site ayarı Disable yapılıp kaydedildi; gerçek HTML'de beacon kaldırıldı ve **orijinal değişmemiş test** PASS oldu. Bu browser performans analitiğidir; WAF/security monitoring/SSL kapatılmadı. Eski failed artifact 12280187123 final kanıt değildir. Hiçbir assertion/timeout gevşetilmedi.

JITEM embedded SOURCE/runtime eşlemesi korunur; standalone main `e1d5bf742d012ef9355f7d822fa31bc896cd7c8d`, runtime SHA-256 `31deba68d1bcc5cd7cef9c813bd033a11b3cc1a40c95fee3c74918a998ad18f4`.

## Handoff ve sınırlar

Zorunlu 17:20 handoff gerçek GitHub commit 477e86a573902c61e47129b8c801e6eb14740a0a; continuation / A blocked / quality continuity gerçek checkpoint 9e83027eea19d9c078d9fb00ef49de96702fbb56 üzerinden okundu. Master dosya GitHub main/checkpoint tree/exact search'te bulunmadı; aynı adlı kaydedilmiş `TARIKLAB-MASTER-HANDOFF-2026-10-20(1).md` ayrı kaynaktan okundu, GitHub dosyası diye sunulmadı.

108 rota testi, 108 tam oyun veya %100 çevrilmiş korpus sertifikası değildir. TC PL giriş açıklaması ve Racon legacy metinlerinde dil kuyruğu gözlendi; Racon manager C ayrı release'tir. Fiziksel cihaz kabulü UNKNOWN / kullanıcıya ait. TC beş paket / JITEM ADAPT yeniden geliştirilmedi; 900 kart / DARPE / map / atlas / performans ertelenen işler başlatılmadı. Astra 18 oyun kaynak/envanter/kayıt/uzun oyun girdisi `ASTRA_18_GAME_AUDIT_READINESS_2026-10-20_TR.md` içinde.

Kısa bir Browser kesintisinde Cloud Browser Google auth ekranını okumak otomatik review tarafından Cloudflare kapsamı dışında reddedildi. Google auth state okunmadı ve bu ret aşılmadı; orijinal yetkili Cloudflare session geri geldi ve iş ondan tamamlandı. Rutin kullanıcı izni/token istenmedi.
