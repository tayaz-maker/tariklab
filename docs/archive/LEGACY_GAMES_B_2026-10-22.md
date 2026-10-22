# Görev B — güvenli oyun arşivi (2026-10-22)

Durum: PR adayı; merge ve deployment bu görevde yapılmaz.

## Kesin kapsam ve kaynak

`src/lib/games.ts` içindeki `GAME_CATEGORIES.tabletop.slugs` gerçek Kart & Masa
üyelerini belirler. Bu raftaki altı oyun ve ismen istenen üç oyun:

| Oyun | Slug / production'dan çıkarılan özel klasör |
|---|---|
| TC SIM: DEVLET | `public/games/tc-sim-devlet/` |
| Kayıp Telefon | `public/games/kayip-telefon/` |
| Son 100 Gün | `public/games/son-100-gun/` |
| VETO-H! | `public/games/veto-h/` |
| GETT-OH! | `public/games/gett-oh/` |
| Satranç | `public/games/satranc/` |
| Amiral Battı | `public/games/amiral-batti/` |
| Tek Taş | `public/games/peg-solitaire/` |
| Labirent | `public/games/labirent/` |

Arşiv öncesi commit: `02d22c0f46969aac3b86a616d671a7e7aeb517ae`.
GitHub'da ayrıca bu commit'e sabitlenmiş kurtarma dalı oluşturuldu:
`archive/legacy-games-b-pre-retirement-20261022`. Bu dal taşınmamalıdır.

Kalıcı, repo içinde sürümlenen paket:
`archives/legacy-games-b-2026-10-22/source.tar.xz` (9.964.948 bayt).
SHA-256: `1e6ea5d736929b7a6dc7749a0ec92510bdc31b1459cd862f6502aaf43c0bd43d`.
Yanındaki `manifest.json` her dosyanın boyutunu ve SHA-256'sını,
`SHA256SUMS` ise standart doğrulama listesini içerir.

Paket 1.450 dosya / 20.487.780 açılmış bayt içerir: dokuz oyunun kaynak,
veri ve asset'leri, açılmış kart WebP'leri, ortak motorlar, i18n/Pixi,
oyun belgeleri, src ve script/test kaynakları ile build/bağımlılık dosyaları.
600 kart görseli ve iki atmosfer görseli doğrudan paketlenmiştir;
yalnızca tekrar eden sıkıştırılmış kart aktarım paketleri eklenmemiştir.
Kaynaklar Git çalışma ağacında da tutulur; production hariç tutma işlemi
Nitro'nun public-assets envanterinde yalnız bu dokuz klasöre uygulanır.
Paket `public/` dışında olduğundan web'e sunulmaz.

## Bağımlılık ve yeniden kullanım kararı

| Bileşen | Kontrol ve koruma gerekçesi |
|---|---|
| `games/next-wave.js`, `next-wave.css`, `next-wave/shared/*`, `next-wave/apartman-*` | Kapı Nöbeti ortak motora ve kayıt oturumuna bağlı; aynı kalır. |
| `next-wave/devlet-*`, `kayip-*`, `son100-*` | Ortak `next-wave.js` içindeki dinamik import sözleşmesi ve tarihsel Node API'si korunur. Ayrıştırma/oyun mekaniği değişikliği bu PR'ın kapsamı değildir. |
| `games/shared/*` | TC SIM, HANEDANIAN, Racon, Son Köy ve diğer kabuklar sonuç, kayıt, navigation, rendering yardımcılarını paylaşır; silinmez. |
| `games/duel-core/*` | İki kart oyununun deterministik kurallar, DSL, deste, RNG ve kayıt motoru yeniden kullanılabilir. Ortak modül silme sınırı gereği korunur. |
| Klasiklerin `js/` mantıkları | Satranç kuralları/AI, peg-solitaire hamleleri, filo motoru ve labirent üretimi arşivde bağımsız adaylardır. Yeni oyunlara taşınmadı. |
| Kart havuzları, WebP'ler ve veri paketleri | İki ayrı tema ve köken bilgisiyle arşivde korunur; başka oyunlara otomatik aktarılmaz. |
| `public/i18n/*`, Pixi vendor ve portal marka kaynakları | Korunan oyunlar tarafından kullanılıyor; yalnızca aktif Resources bağlantıları çıkarılır. |

Korunan oyun klasörlerinden dokuz özel klasöre statik import/script/style
bağımlılığı bulunmadı. `duel-core/table.css` iki emekli oyunun atmosfer
resimlerine başvurur; korunacak oyunlar duel-core'u yüklemiyor. Bu tarihsel
CSS ve görseller kurtarma paketinde birlikte bulunur. `manifest.protectedFiles`
192 korunan/ortak dosyayı sabitler; kaynaklar byte-identical kalır. HANEDANIAN'ın
build sırasında zaten sürümlenen `sw.js` dosyası dışında production kopyaları da
aynı SHA-256 ile doğrulanır. TC SIM 2.5D bağımsız reposuna erişilmez.

## Yayın davranışı ve kayıtlar

Altı aktif oyun: Çete Savaşları, HANEDANIAN, Racon, TC SIM, Kapı Nöbeti ve
SON KÖY MANAGER. Dokuz oyun `archived` olur; portalın live/soon filtresi arama,
raf ve navigation yüzeylerini de besler. Ayrı bir öneri motoru yoktur.
Resources TR/EN/PL ve sitemap'ten eski bağlantılar çıkarılır; tarihi açıklamalar
ve lisans/köken kayıtları korunur. Boş raflar portalda gizlenir.

Eski `/oyna/<slug>` ve ham `/games/<slug>[/index.html]` belgeleri sabit `/`
hedefine döner. Production middleware 302/no-store kullanır; kayıp oyun
asset istekleri 410 alır. Statik index tombstone'ları da aynı hedefi sağlar.
Root worker eski HTTP cache girdilerini tek tek ayıklar; tüm cache'leri silmez.
Başka oyunların cache'leri, localStorage/IndexedDB ve kullanıcı kayıtları silinmez.
Eski kayıtlar yalnızca kurtarılan oyunda yeniden okunabilir; otomatik göç yoktur.

## Boyut ve doğrulama

Aynı kilitli bağımlılıklarla alınmış arşiv öncesi build'da dokuz klasör toplam
8.779.396 bayttır. Yeni pakette yalnız dokuz statik tombstone toplam 3.672 bayt:
**8.775.724 bayt (8,37 MiB) doğrudan statik dosya kazancı**. Bu sıkıştırılmamış
build dosya toplamıdır; ağ transferi, Worker JS boyutu veya canlı yayın ölçümü
değildir. Ortak modülleri çıkarma/optimizasyon yapılmadı.

Tekrarlanabilir kontroller:

```sh
python3 scripts/verify-legacy-games-b.py
npm run build
node --test scripts/legacy-games-b.test.mjs
npm run typecheck
npm run lint
npm test
# npm run preview yerelde çalışırken:
node scripts/legacy-games-b-browser.mjs
node scripts/tc-sim-2-ux-browser.mjs .output/public built
GAME_E2E_ORIGIN=http://127.0.0.1:8081 HANEDANIAN_SOAK_MS=0 node scripts/hanedanian-browser.mjs
node scripts/wave1-save-browser.mjs --serve .output/public --label built
```

Eski kaynak oyun testleri korunur. Wave1'in built testi yalnız halen gönderilen
Son Köy'ü çalıştırır; Apartman ve Son Köy için scoped-engine kontrolü sürer.
Emekli oyunların kaynak testleri ve kaynak tarayıcı hücreleri aynen durur.
CI sınıflandırıcısı, required gate'ler, workflow'lar, Cloudflare güvenlik ve
deployment scriptleri değiştirilmez.

## Kurtarma (production'a otomatik yazmaz)

Önce mevcut dalda paket doğrulanır. Sonra yeni ve boş bir dizine açılır:

```sh
python3 scripts/verify-legacy-games-b.py
mkdir -p work/legacy-games-b-recovery
tar -xJf archives/legacy-games-b-2026-10-22/source.tar.xz -C work/legacy-games-b-recovery
(cd work/legacy-games-b-recovery && shasum -a 256 -c ../../archives/legacy-games-b-2026-10-22/SHA256SUMS)
```

Tam arşiv öncesi ortam için kaynak commit'i ayrı worktree'ye alınabilir:

```sh
git fetch origin archive/legacy-games-b-pre-retirement-20261022
git worktree add --detach work/legacy-games-b-original 02d22c0f46969aac3b86a616d671a7e7aeb517ae
```

O ortamda `npm ci` ve `node scripts/duel-art-unpack.mjs` kart aktarım
paketlerinden aynı WebP'leri üretir. Tekrar yayınlama ayrı bir PR gerektirir:
ilgili slug'ı retirement inventory, worker listesi ve route redirect'ten çıkarmak,
katalog durumunu live yapmak, Resources/sitemap bağlantılarını geri koymak ve
build/tarayıcı testlerini çalıştırmak gerekir. Kurtarma sırasında ortak dosyaları
mevcut production kaynaklarının üzerine topluca kopyalamayın. Tarayıcı kayıtlarını
aynı origin'de tutun; tarayıcı depolamasını temizlemeyin. Bu arşiv özel kullanıcı
verisi yedeği değildir ve hiçbir gerçek kullanıcı verisi toplanmadı.

Yerel sonuçlar: `LEGACY_GAMES_B_VALIDATION_2026-10-22.json`. Tam test paketi
2.381 JavaScript + 61 TypeScript testi geçti (0 hata/atlama). Arşiv açılıp
1.450 dosyanın tamamı SHA-256 ile doğrulandı. Arşiv tarayıcısı 6 hücre /
39 kayıt değeri, TC SIM 12 senaryo, HANEDANIAN 20 kontrol, Son Köy 6 hücre geçti.
Son build statik toplamı 20.727.678 → 11.951.983 bayt (8.775.695 bayt toplam
kazanç; oyun klasörü kazancıyla 29 bayt fark portal bundle değişikliğidir).
