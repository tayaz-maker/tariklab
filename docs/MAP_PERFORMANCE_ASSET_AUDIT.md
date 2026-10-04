# Harita performansı ve asset incelemesi

Kaynak baseline: `53534e2`. Bu belge 2026-10-04 tarihli salt okunur keşfi kaydeder.
Boyut ölçümleri `tariklab-wave1-moments` içindeki mevcut **yerel b4 + Wave1 build** üzerindendir;
`53534e2` için yeniden alınmış build veya bu performance PR’sinin son çıktısı değildir.
Baytlar diskteki ham boyuttur. Gzip sayıları yerelde hesaplanan tahmindir; gerçek ağ transferi değildir.
Bu PR hiçbir asset silmez. Cache değişiklikleri yalnız hedeflenen iki renderer’a özeldir;
aşağıdaki i18n ve cloud lazy-load adayları ayrı PR kapsamıdır. Oyun tasarımı/kayıt kuralları değişmez.

## En büyük dosyalar

| İlk 10 tracked repo dosyası | Bayt |
| --- | ---: |
| `scripts/pl/source/en-strings.json` | 1.724.794 |
| `screenshots/emniyet-hayat.png` | 1.157.562 |
| `screenshots/shop-modern.png` | 914.086 |
| `screenshots/systems.png` | 901.377 |
| `screenshots/systems-street.png` | 897.826 |
| `screenshots/no-dialog.png` | 891.012 |
| `screenshots/hayat-nss.png` | 879.904 |
| `screenshots/hayat-desktop.png` | 878.637 |
| `screenshots/boot-fixed.png` | 874.532 |
| `screenshots/clock-desktop.png` | 870.848 |

| Yerel build ilk 10 (`.output/public/` altında) | Bayt |
| --- | ---: |
| `vendor/pixi/pixi-8.21.0.min.mjs` | 828.971 |
| `games/jitem-derin-ag/assets/runtime.js` | 597.637 |
| `i18n/pl/apartman.json` | 423.487 |
| `i18n/pl/tc-sim-devlet.json` | 405.270 |
| `assets/index-CkEVaRyC.js` | 401.507 |
| `games/racon/index.html` | 378.631 |
| `i18n/pl/kayip-telefon.json` | 367.901 |
| `games/next-wave/devlet-content.js` | 347.538 |
| `i18n/pl/son-kasaba.json` | 292.551 |
| `i18n/pl/tc-sim.json` | 285.980 |

Tracked `public`: 954 dosya / 16.134.396 B. Yerel `.output/public`: 1.547 dosya / 24.081.353 B.
Build `assets/`: 28 dosya / 993.480 B. Bu toplamlar bir kullanıcının ilk yüklemesi değildir.

## Arşiv, duplicate ve build kanıtı

- Tracked `screenshots/`: 52 dosya / 26.514.223 B; `screenshots/devlet-pixi/` ve `screenshots/hanedanian-pixi/` dahil.
  `scripts/qa-play.mjs:125` emniyet-hayat çıktısını, `scripts/hanedanian-pixi-qa.mjs:7` Hanedanian arşivini,
  `docs/TARIKLAB_PIXIJS_MAP_STATUS.md:520` Devlet arşivini referanslar. `docs/ASTRA_GLOBAL_FINAL_CLOSURE.md:173`
  tarihî ekran görüntülerinin korunduğunu açıkça kaydeder. Bunlar public build’e dahil değildir; toplu silme kanıtı yoktur.
- SHA-256 taramasında ≥1 KB byte-identical asset grubu yok. Tek grup `public/brand/app-mark.svg` ↔ `public/favicon.svg`,
  dosya başına 863 B. Hash: `bc6d9684c7b46f64e647488908110bf41fa621c8838abcd4da24070efc6d16e2`.
- `git ls-files` içinde `.output/`, `dist/`, `.vercel/` build çıktısı yok; mevcut yerel `.output` ignore edilir.
  Dolayısıyla yanlışlıkla tracked edilmiş deploy çıktısı bulunmadı; yerel ignored build’in varlığı bundan ayrıdır.
  JITEM bundle’ı `scripts/build-jitem-embed.mjs` ile bilinçli üretilir ve kendi `index.html` dosyasında referanslanır.
  İki `public/games/{apartman,racon}/layout-check.html` build’e kopyalanır (5.514 B); bu PR bunlara dokunmaz.

## Ayrı PR için üç somut aday

1. **Misafir Çete’de kapalı cloud senkronunun import sınırı.** `/cete-savaslari` → `GameApp` → eager `game-shell`
   → `useSaveSync(false)` (`src/components/game/game-shell.tsx:125`) yine `save-sync.ts` → `sb-save.ts` → Supabase yükler.
   Build’de `game-shell-Blsp_YKf.js` → `save-sync-BXVMvVAb.js` → `supabase-Uyd_Aojp.js` statik zinciri doğrulandı:
   Supabase 209.161 B, tahmini gzip 53.673 B. Gerçek kullanım sınırına lazy import adaydır. Ayrıca
   `offline-sw-plugin.mjs` bütün 28 chunk’ı precache eder; ağ kazancı için offline kapsamı da doğrulanmalıdır.
2. **TR Racon açılışında gerekmeyen EN overlay yükü.** `/oyna/racon` iframe’i `racon/index.html` açar
   (`src/routes/oyna.$slug.tsx`); head’de `deep-en.js` ve `deep-en-final.js` koşulsuz blocking scriptlerdir.
   Kaynakla aynı build kopyaları toplam 159.653 B / tahmini gzip 62.565 B. TR’de ertelenebilir; EN ve
   İngilizce fallback kullanan PL’de mevcut yükleme sırası korunmalıdır. Kazanç henüz tarayıcıda ölçülmedi.
3. **Portal locale katmanını oyun cümlelerinden ayırmak.** `/` → `PortalHome/useLang` → `src/lib/i18n.ts:2`
   doğrudan `EXTRA_PHRASE` import eder. `language-toggle-COTnWGH_.js` içinde oyun cümleleri doğrulandı:
   chunk 48.854 B / tahmini gzip 21.942 B; kaynak sözlük 40.873 B. Hafif portal locale/catalog API’si
   oyun `phrase()` sözlüğünden ayrılabilir. Chunk’ın tamamı kazanım sayılmaz; kesin fark yeni build ile ölçülmelidir.

Portal chunk’larında Pixi yok. HTML oyunları iframe rotasında; Racon map-view dinamik adapter üzerinden
828.971 B vendored Pixi’yi harita açılışında yükler. Bu sınır korunmalıdır, vendor elle küçültülmemelidir.
Ölçüm araçları: `scripts/wave1-outcome-browser.mjs` transfer/request/ilk render/harita geçişi;
`scripts/racon-map-browser.mjs` startup/renderMs; `scripts/hanedanian-pixi-perf.mjs` renderer karşılaştırması.
Bu keşif yeni browser çalıştırmadı; öneriler için ölçülmüş ağ veya kullanıcı gecikmesi kazanımı iddia etmez.
