# E1 — ayrı atlas route/offline handoff

2026-10-05 · Owner Astra · branch `astra/anatomy-foundation-route-plan` · base `be160c95eb5283e5ed2ce8bf139ef7aa714d329d`.
**DISCOVERY ONLY / NOT IMPLEMENTED / NOT EXPERT REVIEWED.** Bu kayıt uygulama, anatomi doğruluğu, browser, performans, CI veya production PASS değildir; ürün işleri sırası gelince ayrı foundation PR'ına giriş sağlar.

## Dar ürün sınırı ve dosya planı

Geçici ad **TarikLab Yapı Atlası — Temel Anatomi**; ad/marka uygunluğu garantisi yok. Önerilen canonical giriş `/atlas/yapi/`; bağımsız statik eğitim ürünü, oyun değildir.
`src/lib/games.ts`, `HTML5_SLUGS`, `/oyna/$slug`, oyun motorları ve oyun save anahtarları değişmez; atlas oyun kodu import etmez.

| Önerilen dosya/yüzey | Sorumluluk |
| --- | --- |
| `public/atlas/yapi/index.html` | İlk kullanım eğitim notu; erişilebilir katman, arama, yapı listesi, kaynak paneli ve portal dönüşü. |
| `app.js`, `styles.css`, `view-model.js`, `svg-view.js` (aynı dizin) | Saf seçim/katman modeli, SVG/DOM çizimi; ilk foundation için WebGL zorunlu değil. |
| `content/schema.js`, `content/foundation.json`, `locales/{tr,en,pl}.json` | Sistem/yapı/etiket/açıklama; kaynak tarihi, owner, review ve yayın durumu. |
| `geometry/{body,skeleton,organs}.js` | Özgün küçük vektör geometri; yetişkin klinik ön/arka varyantlar, kaynak/inceleme durumuyla bağlı. |
| `manifest.webmanifest`, `sw.js`, `package-manifest.json` | Ayrı `/atlas/yapi/` ID/scope; hash/byte/MIME denetimli atomik offline paket. |
| `scripts/atlas-foundation-package.mjs` ve hedef schema/model/SW/browser testleri | Manifest üretimi; içerik inceleme kapısı; offline/viewport/transfer kanıtı. |
| `src/components/portal/portal-home.tsx` ve ilgili `src/lib/i18n.ts` anahtarları | Oyun kategorilerinin dışında küçük eğitim ürünü bağlantısı; atlas JS/geometri importu yok. |
| `public/credits.html`, `docs/ANATOMY_FOUNDATION_PROVENANCE.md` | Kaynak/provenance ve kapsam sınırı; kurum logosu/onayı iddiası yok. |

Kullanıcı sağlık verisi, fotoğraf, belirti, hesap veya serbest metin toplanmaz. Yalnız gerekiyorsa ayrı sürümlü dil/görünüm tercihleri; klinik kayıt yok.

## Offline ve build sınırı

- `scripts/offline-sw-plugin.mjs` bütün client `/assets/*` çıktısını kök worker'a precache eder. Atlası React client chunk'ı yapmak, kök offline kurulumunda atlas yükü doğurabilir; izole `public/atlas/yapi/` paketi bu bağımlılığı önler.
- `src/components/game/offline-ready.tsx` atlas için yeniden kullanılmaz: Çete anahtarları, metinleri ve oyun chunk prefetch'i içerir; mevcut ready hesabı paket bütünlüğü kanıtı değildir.
- Kök `public/sw.js` scope `/`, cache `cete-offline-v5`; ilk ziyarette kök controller ile atlasın daha dar scope worker'ı arasındaki geçiş test edilir. Yalnız yeni worker eklemek offline kabulü değildir.
- HANEDANIAN'ın mevcut worker'ı örnek alınabilir: bütün gövdeleri tüketme, redirected HTML'yi güvenli normalize etme, tam paket kurulmadan aktivasyon yapmama. Game-specific cache/marker/mesajlar atlas için kopyalanmaz; oyun cache/save'leri silinmez.
- Paket HTML/JS/CSS, dil/içerik/kaynak durumu, özgün geometri ve test fixture'larını aynı hash kohortunda tutar. Kesintide önceki sağlam paket korunur; doğrulanmış paket hazır olmadan offline hazır yazılmaz.
- `/atlas/yapi/`, `/atlas/yapi/index.html`, kaynak deep-link, back/refresh ve manifest iki hostta doğrulanır. Mevcut head middleware explicit manifesti korur; shared shell refactor gerekmez.

## Kaynak kapsamı ve açık insan kapısı

Mevcut `E2_FOUR_ORGAN_SOURCE_DISCOVERY.md` ile `E2_SKELETON_BRAIN_STOMACH_SOURCE_DISCOVERY.md` okundu; kaynaklar yeniden taranmadı. **Kalp, akciğerler, böbrekler, karaciğer, beyin, mide ve iskelet ana grupları** için yalnız dar olgusal TR/EN taslaklar var.
Kadın/erkek varyant oranları, ön/arka topoloji, organ sınırı/komşuluğu/derinliği, karaciğer/mide kesin konumu ve görsel geometri henüz doğrulanmış değil; bağırsak/mesane için özel source kayıtları yok. PL taslağı/anadil incelemesi eksik.
Her sistem, yapı, etiket ve açıklama: kararlı ID, kaynak URL/yer bulucu/desteklenen iddia, `sourceDate`, tarih türü/hassasiyeti, `accessedAt`, owner ve review durumu taşır. NCI tarihlerindeki **null korunur**; erişim tarihi kaynak güncelleme tarihi yerine yazılmaz.
`releaseEligible:false` varsayılandır. Bağımsız uzmanın adı/yetkinliği, tarih, kapsam ve **metin + geometri + locale exact hash** kaydı olmadan approved olmaz; değişiklik eski onayı geçersizleştirir. Uzman atanmadı; model/CI bu insan yayın kapısını kapatmaz. Shell/preview geliştirilebilir; incelenmemiş anatomik içerik onaylı ürün diye yayımlanmaz.
İlk kullanım, Kaynaklar ve offline pakette: **“Eğitim amaçlıdır; kişisel tıbbi tavsiye, tanı veya tedavi aracı değildir.”** Taslak durumu açık görünür; “tam atlas”, “klinik kesin” veya uzman onaylı iddiası yok.
**“Tam anatomi sistemleri daha sonra ayrı içerik dalgalarında eklenecek.”** Diğer sistemler LATER; kaynak görselleri/metinleri kopyalanmaz, OpenStax/dış fotoğraf/indirilen insan modeli/CDN yok.

## Önerilen bütçe ve kabul — henüz ölçülmedi

- Sıkıştırılmış ilk giriş **≤350 KiB / ≤12 istek**; temel görünür katmanlar **≤1.5 MiB**; tam foundation offline paketi **≤5 MiB**; portalda atlas/Pixi/WebGL/geometri isteği **0**. Yeni kütüphane/raster/GLB yok.
- Aynı kayıtlı cihaz/ağ/CPU profilinde ilk anlamlı içerik hedefi **≤2.5 sn**, seçim yanıtı p95 **≤100 ms**; bunlar ölçülmüş sonuç değildir. Bütçe aşımı sessizce gevşetilmez.
- Browser: 320/390/1440, TR/EN/PL, klavye/focus/etiket eşleşmesi/reduced motion; console/404/overflow ve kaynak-not görünürlüğü.
- Offline: tam online kurulum→offline deep-link, A→B worker/content, açık eski sekme, kesintili kurulum/kota/reconnect, diğer oyun cache/save'lerinin korunması.
- Release: local gate→exact-head CI→yetkili merge→www + Workers SHA/asset hash/screenshot/DOM kanıtı. Anatomi uzmanı ve PL anadil incelemesi açık insan gereksinimi; WebGL eklenmezse fiziksel GPU testi yapılmış sayılmaz.
