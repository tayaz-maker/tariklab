# Güvenli arşiv ve entegrasyon hazırlığı — 20 Ekim 2026

Referans TarikLab main: `27beb9c1827ba893916aceb173c9109cf503d0d4`. Bu branch yalnız belge ve dosya envanteri içerir; hiçbir oyun, rota, kaynak, kayıt veya dosya kaldırılmaz. `ARCHIVE_INVENTORY_2026-10-20.json` boyut/SHA-256 ile tekrar üretilebilir dosya listesidir.

## Kıyı Eşiği

Canlı katalog `src/lib/games.ts`: slug `esik`, strategy kategorisi, `/oyna/esik`. Genel `src/routes/oyna.$slug.tsx` HTML5 kabuğu `/games/esik/index.html` iframe'ini açar; doğrudan URL de korunmalıdır. Kaynaklar: `public/credits.html` içindeki `data-game="esik"` LIVE satırı. TR/EN/PL katalog metinleri `src/lib/i18n.ts`; PL gövde betiği `/i18n/pl-body.js` ve esik çeviri/ekran kayıtları bulunur.

Kaynaklar: `public/games/esik/index.html`, `app.js`, `sim.js`, `save-store.js`, `style.css`, `map-model.js`, `map-pixi.js`. `app.js` sim/preview/legal kurallarını ve kayıt katmanını çağırır; Pixi yalnız harita görünümüdür. `map-pixi.js` ortak `../shared/pixi-adapter.js` üzerinden `/vendor/pixi/pixi-8.21.0.min.mjs` yükler. Ortak Pixi adapteri/vendor ve ortak i18n diğer oyunlara aittir; olası emeklilikte silinmez.

Kayıt: `tariklab.kiyi-esigi.v1`, envelope version 1; `.backup` yedeği, `.corrupt.` kurtarma kopyaları. Arşiv bu anahtarları temizleyemez veya dönüştüremez. Test yüzeyi `scripts/esik*.test.mjs`, `esik-save-browser.mjs`, `.github/workflows/esik-save-recovery.yml` ve PL ekran fixture'ı. Yalnız yayın politikasına göre daha sonra incelenir; mevcut test kapıları korunur.

Silmesiz plan: (1) Son canlı main, dosya hashleri, kaynak/lisans ve kayıt sözleşmesini sabitle. (2) Kullanıcı arşivlemeyi ayrıca uygulamaya aldığında değişmez, isimli archive ref ve geri dönüş tarifi hazırla; ref oluşturmayı bu hazırlık tamamlandı sayma. (3) Ayrı inceleme PR'ında katalog/kategori/çeviri/Kaynaklar/SW/redirect ve doğrudan URL politikasını tutarlı ele al; önce yalnız arşiv etiketi/erişim açıklaması düşün, dosyaları tut. (4) Eski kayıtların ve tarihî URL'lerin erişimi ile diğer oyunların ortak bağımlılıklarını gerçek tarayıcıda doğrula. (5) Yalnız kapılar kapandıktan sonra yayın kararı uygula. Bu turda bu adımların hiçbiri yayından kaldırma yetkisi değildir.

## İHTİLÂL canlı bağlantılar

`src/lib/games.ts`: dossier kategorisi, HTML5 slug `ihtilal`, LIVE `/oyna/ihtilal`. `src/routes/ihtilal.tsx` eski `/ihtilal` URL'sini `/oyna/ihtilal` adresine yönlendirir. HTML5 kabuk `/games/ihtilal/index.html` açar. `public/credits.html`: `data-game="ihtilal" data-status="live" data-route="/oyna/ihtilal"`, metin ve bağlantı korunur. `public/sw.js` app-shell listesinde `/games/ihtilal/` vardır. Üretilmiş routeTree, katalog lokalizasyonu ve portal ikonu da korunur. Kaynak belgeleri `docs/ihtilal`, `docs/ip/ihtilal-*`, ilgili test/browser betikleri ve fixture'lar arşiv kapsamına alınmalıdır.

Bu bağlantılar kaynak koddan doğrulandı; canlı HTTP/tarayıcı sonucu release kanıtında ayrıca işaretlenir. Eski `docs/jitem-derin-ag/IHTILAL_TRANSFER_GATE_2026-10-20.md` teknik referanstır; Astra'nın yeni handoff'unun kabulü yerine geçmez.

## Racon Manager

Canlı rota `/oyna/racon`; genel HTML5 kabuk `/games/racon/index.html`. `index.html` ana UI, simülasyon, hafta ilerleme, işe adam atama/sahne çözümü, sezon/kademe, kayıt ve hayat durumunu içerir. Nav: Olaylar, Takvim, Adamlar, Harita, İşler, Pazar, Emlak, Hayat, Emniyet, Husumet, Kasa, Sıralama. Üst kademelerde çoklu mahalle, alt ekip ve aklama açılır.

Mekanikler: temiz/kirli kasa ve aklama kapasitesi; Korku/Saygı/Nam/Racon itibarı; adam gönlü, yorgunluk/yaralanma/ölüm/ihanet hafızası; iş planlama ve iş günü sessiz/sıkıştır/ateş/çekil seçimleri; polis heat/dosya ve avukat; yükümlülük/vade ve ertelenen sonuçlar; emlak/hayat ve halef; sezon hedefi ve iki başarısız sezonda son. Ağ emirleri `network.js`: Koru (2.500 TL/3 hafta), Yatırım (5.000 TL/4 hafta), Çekil (0 TL/2 hafta), İlişki kur (800 TL/3 hafta); başlangıç/haftalık/bitiş/komşu etkileri ayrı.

`content.js`: olay zincirleri, kimlik ve aktör hafızası koşulları, gecikmiş yankı, seçim/çözüm. `network.js`: saf ağ kuralları ve normalizasyon. `map-model.js`: render modeli; `map-view.js`: harita UI; `outcome-moment.js`: önce/sonra sonuç anlatımı. Ortak `depth-framework.js` ve `outcome-runtime.js` başka oyunlarla paylaşılır. Tasarım belgeleri `docs/racon/`; doğrulama `scripts/racon*.test.mjs`, kalite/harita tarayıcı, audit, longrun ve harness betikleri. Bu envanter yeni mekanik/kalite sertifikası değildir.

Kayıt: üç slot `tariklab::racon:1` vb., `:bak` yedekleri, `tariklab::racon:active`; eski `racon_v1`/`racon_v1_bak` geçişi bulunur. Kullanıcı kayıtlarına dokunulmaz.

## Astra handoff kabul kapısı

Yeni standalone başlangıcı `37c5416e7a49b2ecc998f0d1071a7484d6e508c0`. Handoff şu bilgileri taşımalı: incelenen iki SHA, mevcut JITEM karşılığı, somut eksik davranış ve kabul örneği, korunacak tarih/kaynak ayrımı, TR/EN/kayıt uyumu, dokunulacak kesin dosyalar, test kanıtı, uyumsuz ve aktarılmayacak parçalar. Eski SHA ile hazırlanmışsa #26 diff'iyle uyumluluk kontrolü yapılır. Önce handoff kabul edilir; sonra ayrı scope/branch açılır. Astra branch'lerine yazılmaz; aynı dosyalarda paralel düzenleme yapılmaz. Üç açık geliştirme PR sınırı korunur. Bu branch aktarım kodu içermez.
