# TarikLab — final kapanış, 2026-09-23

**Karar: CLOSED WITH KNOWN RISKS.** Bütün işler merge edildi ve production'da doğrulandı. Aşağıdaki kanıtlar bunu destekliyor. Yalnızca iki şey "production verified" demeye yetmiyor:

- Mac Dock ve yerel macOS kurulumu bu ortamda denenemedi (§4).
- §7'deki gerçek riskler açık kalıyor.

**Production:**

- Hedef: Cloudflare Worker `tariklab`, <https://tariklab.tayaz29.workers.dev/>.
- Dağıtım: `main`'e her push'ta Cloudflare Workers Builds ile (`OPS.md`). Vercel production hedefi değil.
- Son canonical `main`: `bc4036a7421d8ce1cd8e82c269f6f27d6c146491`, tree `ecd777849ec8ccfe418aaab08627e9a44b7c2a97`.
- Production bu SHA'yı 2026-09-23T03:31:17Z'den beri birebir sunuyor.

## 1. Production nasıl doğrulandı

Workers Builds, `main` deploy'larının build id'sini bu ortama vermiyor. Check run yalnızca PR head'lerinde görünüyor; dashboard ise hesap girişi istiyor. Bu yüzden her deploy build id ile değil, içerikle doğrulandı:

1. **Tree kimliği.** Merge commit'in tree'si, benim yerelde build edip gate'ten geçirdiğim PR head'inin tree'siyle karşılaştırıldı (`git rev-parse <sha>^{tree}`). Base her seferinde son `main` olduğu için ikisi aynı.
2. **Byte kimliği.** Production şu koşullar sağlanana kadar yoklandı:
   - canlı HTML'in referans verdiği her hash'li `/assets/*.js|css` dosyası o yerel build'de mevcut
   - yedi anahtar dosya o build ile byte byte aynı: `sw.js`, `manifest.webmanifest`, `favicon.svg`, HANEDANIAN `app.js` ve `map.js`, JITEM `SOURCE.json`, DARBE-H! `app.js`

   #64'te ek olarak şunlar da karşılaştırıldı: `card-face.js`, `card-face.css`, duel-core `app.js` ve `card-art/manifest.json`. #67'de `favicon.ico`.

| `main` SHA | Tree | Merge | Merge (UTC) | Production eşleşti (UTC) |
| --- | --- | --- | --- | --- |
| `973e51b493638e37cdd52de3847dd1e590e0c23d` | `0fbeb6d9…` | #62 (sürüm seti 1'in sonu) | 23:59:25 (22 Eyl) | 00:01:11 |
| `8f47bb11252231e81123970350173b05a19f5402` | `c071798e…` | #65 | 00:34:16 | 00:36:21 |
| `03db7cfc02311e922362e6e2d752a482b81f2584` | `6aeaf701…` | #66 | 01:00:18 | 01:01:37 |
| `9b7e1c379197998569f2e4af60971c88547e723d` | `5fb9dfad…` | #64 | 01:27:20 | 01:28:39 |
| `bc4036a7421d8ce1cd8e82c269f6f27d6c146491` | `ecd77784…` | #67 | 03:29:56 | 03:31:17 |

Sürüm seti 1'in ara `main`'leri (`d4e872e`, `9a81d0f`, `cfd4a6f`) ayrı ayrı içerik eşleştirmesinden geçmedi. Hepsi `973e51b`'nin atası ve production `973e51b`'de doğrulandı.

## 2. Merge edilen PR'lar

Hepsi merge commit ile birleşti. Squash, push edilmiş dalda rebase veya force-push yok.

Her TarikLab merge'ünden önce şunlar geçti:

- **Yerel gate:** `tsc --noEmit`, `eslint .` (0 hata), `npm run build`, `npm test`.
- **GitHub CI:** `build`, `campaign-browser`, `campaign-balance`, ayrıca Workers Builds.
- **Tarayıcı QA:** 1440×900 ve 390×844.

Her merge'den sonra yeni `main` kaydedildi ve sıradaki PR bu tabana güncellendi (`update branch`, merge commit). Ardından o head'de gate ve CI yeniden koştu.

**`tayaz-maker/tariklab`**

| PR | Kapsam | Diffstat | Merge commit = `main` |
| --- | --- | --- | --- |
| [#63](https://github.com/tayaz-maker/tariklab/pull/63) | JITEM vendor sync → `002ca46` | 8 dosya, +68/−12 | `d4e872e84903d3e102421f979d16f16244ce2ca8` |
| [#60](https://github.com/tayaz-maker/tariklab/pull/60) | HANEDANIAN önbellekli atlas (bloklamayan) + DARBE-H! iç görselleri | 312 dosya, +2688/−1993 | `9a81d0fb0ad8039550e462b64f49fbc11beb2a80` |
| [#61](https://github.com/tayaz-maker/tariklab/pull/61) | #58 görsel adayı, bloklamayan atlas üzerinde | 383 dosya, +4822/−6328 | `cfd4a6fa19d2fa4578e2e4105bf48a9b677ed278` |
| [#62](https://github.com/tayaz-maker/tariklab/pull/62) | Portal kategorileri ve TarikLab kurulum kimliği | 19 dosya, +127/−36 | `973e51b493638e37cdd52de3847dd1e590e0c23d` |
| [#65](https://github.com/tayaz-maker/tariklab/pull/65) | B: JITEM vendor sync → `1e7c588` (hamle rehberi, harita dokusu yolu) | 7 dosya, +9/−9 | `8f47bb11252231e81123970350173b05a19f5402` |
| [#66](https://github.com/tayaz-maker/tariklab/pull/66) | C: HANEDANIAN emir önizlemesi, dönem özeti, adım göstergesi, hafif harita katmanı | 9 dosya, +904/−51 | `03db7cfc02311e922362e6e2d752a482b81f2584` |
| [#64](https://github.com/tayaz-maker/tariklab/pull/64) | A: DARBE-H! kartları sıfırdan, kart başına bir özgün illüstrasyon (300) | 323 dosya, +5058/−66 | `9b7e1c379197998569f2e4af60971c88547e723d` |
| [#67](https://github.com/tayaz-maker/tariklab/pull/67) | D: portal rafları, küçük boyutta okunaklı ikon, `favicon.ico`, tek tema rengi | 9 dosya, +66/−28 | `bc4036a7421d8ce1cd8e82c269f6f27d6c146491` |

**`tayaz-maker/jitem-derin-ag`**

Bu depoda CI check'i yok. Her merge yerelde typecheck, lint, build ve iki test paketiyle kapılandı.

| PR | Kapsam | Diffstat | Merge commit (upstream `main`) |
| --- | --- | --- | --- |
| [#15](https://github.com/tayaz-maker/jitem-derin-ag/pull/15) | Ürün dalgası (#12–#14) | 30 dosya, +1819/−280 | `3cfa1614670b2a8923721757a58adc6d2cb63f44` |
| [#16](https://github.com/tayaz-maker/jitem-derin-ag/pull/16) | Kalıcı hamle seçimi, önizleme = sonuç, sıradaki adım, sonuç geri bildirimi | 9 dosya, +502/−43 | `4b43c5f25a33b8f3de5704f4c99792b78a6d7615` |
| [#17](https://github.com/tayaz-maker/jitem-derin-ag/pull/17) | Harita dokusu Vite base'inden yükleniyor (production 404'ü düzeltildi) | 2 dosya, +27/−1 | `1e7c588a550c6515a62d505328478fa73fead2ab` |

## 3. QA sonuçları

**Son test sayıları** (her PR'ın son head'inde):

- `npm test`: 1398–1416 geçti, 0 başarısız, 1 atlandı. Atlanan test, `main`'de de atlanan isteğe bağlı uzun denge koşusu.
- TypeScript paketi: 50/50.
- JITEM: 151/151 ve 113/113.

**Son production smoke (`bc4036a`, masaüstü ve 390 px).** 18/18 rota × görünüm kombinasyonu 200 döndü; yatay taşma yok, birinci ve üçüncü taraf hata yok. Rotalar:

- `/`
- `/oyna/jitem-derin-ag`, `/games/jitem-derin-ag/`
- `/oyna/hanedanian`, `/games/hanedanian/`
- `/oyna/darbe-h`, `/games/darbe-h/`
- `/games/veto-h/`, `/games/gett-oh/`

**JITEM, canlıda.**

- Olay → bağ → hamle → önizleme → uygula akışı 1440 ve 390 px'te oynandı. Önizleme satırları uygulanan satırlarla birebir aynı (örn. *Kapasite 5 → 3*, *güven 52 → 64*).
- Seçim paneller arasında korunuyor.
- `SOURCE.json`: `1e7c588`, kayıt anahtarı `jitem-derin-ag-v3` ve şema 5 değişmedi.

**HANEDANIAN, canlıda.**

- Adım çubuğu, keşif önizlemesi ve yapı önizlemesi çalışıyor. Yapı önizlemesi, kuyruğa giren sonuçla aynı metni veriyor.
- 12× çalıştırıp durdurunca dönem özeti çıkıyor.
- Sınırlar katmanı ve lejant çalışıyor.
- Hata ve 4xx yok.
- **Dünya→yakın geçişinde 50 ms üstü harita long task'ı:** production'da 1440×900'de 3/3 ve 390×844'te 3/3 temiz koşuda **0**. Aynı ölçüm merge öncesi build çıktısında da 0'dı.
- Oturumdaki tek long task (54–66 ms), mevcut kampanya başlatma işleyicisinden geliyor, haritadan değil.
- Katmanın çizim maliyeti (medyan): yakın zoom'da 6.3 ms (katman kapalıyken 5.6), dünya zoom'unda 1.7 ms (kapalıyken 0.6).

**DARBE-H!, canlıda ve merge öncesi.**

- Arşiv, detay, düello, seçili el ve oynanamaz el durumları masaüstünde ve 390 px'te gezildi; konsol hatası yok.
- Duel tarayıcı paketi: 24 senaryo + 216 görünüm kontrolü.
- Logo, ana ekran, palet ve düzen değişmedi. VETO-H! ve GETT-OH! duel-core'un kendi kart yüzünü koruyor.

**Portal, canlıda.**

- Dört raf masaüstünde ve 390 px'te: Strateji & Güç (5), Hayat & Yönetim (4), Dosya & Soruşturma (3), Kart & Masa (7).
- `favicon.ico` 200 ve commit'lenen dosyayla byte byte aynı. `favicon.svg` ve 180 px apple-touch ikonu da yerinde.
- Tek manifest: TarikLab, `#080706`.

## 4. Mac Dock / PWA

**Chromium doğrulaması:**

- Chromium'un kendi yükleme kararı, kalıcı profil ve DevTools `Page.getInstallabilityErrors` ile production'da alındı: **0 hata**.
- Manifest ayrıştırma hatası yok.
- Manifest alanları: `name` TarikLab, `id`/`start_url`/`scope` `/`, `display` standalone, tema ve arka plan `#080706`.
- 192, 512 ve maskable 512 ikonlarının üçü de 200 döndü.

**Ortam engeli:** Mac Dock ve yerel macOS kurulum diyaloğu bu Linux ortamında çalıştırılamaz, dolayısıyla denenmedi.

Önceden kurulmuş uygulamalar, tarayıcı manifesti yeniden çekene kadar eski ikonu gösterebilir.

## 5. Üçüncü taraf ağ

Production'daki 18 son smoke yüklemesinde üçüncü taraf istek hatası veya konsol uyarısı gözlenmedi (`third: []`).

## 6. Kapanış sırasında bulunup düzeltilen hatalar

- **JITEM `/images/map.jpg` 404.**
  - Belirti: gömülü build dokuyu site kökünden istiyordu; production'da 404.
  - Düzeltme: [jitem-derin-ag#17](https://github.com/tayaz-maker/jitem-derin-ag/pull/17), [#65](https://github.com/tayaz-maker/tariklab/pull/65).
- **`/favicon.ico` 404 (site geneli).** [#67](https://github.com/tayaz-maker/tariklab/pull/67) ile düzeltildi.
- **Tema rengi uyuşmazlığı.** Sayfa `#080706`, manifest `#111713` idi. [#67](https://github.com/tayaz-maker/tariklab/pull/67) hepsini sayfa zemini `#080706`'ya eşitledi.
- **Jeton kartlarının olmayan görseli istemesi.**
  - Belirti: `main`'de gizliydi; düello sırasında jeton çıkınca `assets/cards/token.webp` isteniyordu (CI'da GETT-OH!'da yakalandı). Yeni DARBE-H! yüzü de `card-art/token.svg` isteyecekti.
  - Düzeltme: [#64](https://github.com/tayaz-maker/tariklab/pull/64), `a1efb5a`. Regresyon testi düzeltme olmadan başarısız oluyor.
- **`duel-browser.mjs`, DARBE-H! için yanlış dosyaya bakıyordu.** Artık DARBE-H! arşiv görselini eski manifest yerine `card-art` plakalarıyla kontrol ediyor ([#64](https://github.com/tayaz-maker/tariklab/pull/64)).

## 7. Açık kalan gerçek riskler

1. **Mac Dock ve yerel macOS kurulumu doğrulanmadı** (ortam engeli, §4). Chromium yükleme kararı temiz, ama gerçek bir Mac'te kurulum denenmeli.
2. **Kampanya başlatma long task'ı.** HANEDANIAN'da kampanya başlatma işleyicisi 54–66 ms'lik tek bir long task üretiyor. Bu, #60'tan önce de vardı; harita kaynaklı değil ama 50 ms eşiğinin üstünde.
3. **Yerel `npm run preview` çöküyor.** `src/lib/auth/server.ts` içindeki `previewAuthSecret()` global kapsamda rastgele bayt ürettiği için yerel workerd'de açılışta hata veriyor. Bu `main`'de de var ve production'ı etkilemiyor. Bu kapanışta production-build QA'sı bunun yerine Cloudflare dal önizlemesi ve statik build çıktısı üzerinde yapıldı.
4. **Workers Builds `main` build id'si yok.** Bu ortamdan alınamadı; deploy kaynağı tree ve byte kimliğiyle kanıtlandı (§1).
5. **Dal önizlemeleri gecikebiliyor.** Cloudflare dal önizlemesi her push'ta hemen güncellenmeyebiliyor (#62'de görüldü). Önizleme tabanlı QA'da önizlemenin ilgili commit'i sunduğu ayrıca kontrol edilmeli.
