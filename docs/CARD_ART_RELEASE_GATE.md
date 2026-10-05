# Kart sanatı yayın kapısı (VETO-H! · GETT-OH! · DARBE-H!)

Durum: **ALTYAPI HAZIR — SANAT YAYINDA DEĞİL.** Üç destenin hiçbiri 300/300 değil; production kart görselleri değişmedi.

## Doğrulanan paket

`TARIKLAB_CARD_ART_PARTIAL_2026-10-05.zip` (9 175 407 bayt) gerçekten incelendi. İçinde 430 WebP var (VETO 136, GETT 135, DARBE 159) ve bir yarım dosya: `gett-oh/assets/cards/RCN-017.webp.tmp`. Dondurma kaydı (`MISSING.json`, 2026-10-05T15:59+03): 112 + 135 + 159 = 406, eksik 494.

Doğrulayıcı sonucu (Chromium ile tam piksel decode açık):

**VETO 110/300; GETT 135/300; DARBE 159/300** → 404/900 manifest-pass

| Oyun | Paketteki dosya | Manifest-pass | Red | Dosya yok | Ort. / en büyük | 300 kart tahmini | Bugünkü 300 kart | Kapı | Görsel QA |
|---|---:|---:|---:|---:|---:|---:|---:|---|---|
| veto-h | 136 | 110 | 26 | 164 | 30 KB / 60 KB | ~8.7 MB | 4.3 MB | BLOCKED | PENDING |
| gett-oh | 135 | 135 | 0 | 165 | 16 KB / 24 KB | ~4.6 MB | 2.8 MB | BLOCKED | PENDING |
| darbe-h | 159 | 159 | 0 | 141 | 16 KB / 25 KB | ~4.6 MB | 2.3 MB (SVG) | BLOCKED | PENDING |

Bulgular:

- VETO'da dondurmadan sonra yazılan 24 dosya (SND-191, 197, 203, 209, 215, 217, 221, 223, 227, 229, 231, 233, 235, 237, 239, 243, 245, 246, 249, 251, 257, 263, 269, 275) `freeze:written-after-freeze` ile reddedildi; dondurma kaydı onları eksik sayıyor.
- **SND-080 ve SND-081'in provenance satırları bozuk:** `veto-h.jsonl` 80. satırda SND-080 kaydının ortasına SND-234 kaydı yazılmış (eşzamanlı yazma). İki kartın görselinin hangi istemden ve hangi hash'le üretildiği kanıtlanamıyor; dosyalar decode oluyor ama kabul edilmedi. Grok sayımındaki 112, bu iki kartı sayıyor; gerçek doğrulanmış VETO sayısı **110**.
- `RCN-017.webp.tmp` yarım kalmış yazım; paket hatası olarak raporlandı (asıl RCN-017.webp geçerli).
- DARBE'de 12 provenance satırının dosyası yok (DRB-088–099); uyarı olarak raporlandı, kart eksik sayıldı.
- 430 dosyanın hepsi geçerli WebP, kesin boyutta (576×384 / 400×300 / 400×560), düz renk değil; iki kart aynı byte'ı paylaşmıyor; 8 KB altında dosya yok. **Bunların hiçbiri görsel kalite kabulü değildir.**
- 300 kartlık bir release, hâlihazırdaki kod-çizimi sanatın yaklaşık 2 katı ağırlıkta; kartlar yalnız ekranda çizildiğinde ve `loading="lazy"` ile indiğinden portal açılışı etkilenmez.

### Kabul edilmeyen 496 ID (494 eksik + 2 bozuk provenance)

#### veto-h — 190 kabul edilmeyen (dosya yok 164 + red 26); MISSING.json 188; fark +[SND-080,SND-081] -[]

SND-080–081, SND-108–184, SND-186–210, SND-212–218, SND-220–224, SND-226–239, SND-241–300

#### gett-oh — 165 kabul edilmeyen (dosya yok 165 + red 0); MISSING.json 165; fark +[] -[]

RCN-136–300

#### darbe-h — 141 kabul edilmeyen (dosya yok 141 + red 0); MISSING.json 141; fark +[] -[]

DRB-088–099, DRB-172–300

## Komutlar

```sh
npm run art:gate -- --pack <paket.zip | açılmış klasör> [--out dir] [--decode auto|on|off]
npm run art:gallery -- --pack <açılmış klasör> [--per-class 4 | --all] [--shots]
node scripts/card-art-gate/release.mjs --pack <klasör> --game darbe-h --signoff qa.json [--write]
```

- `art:gate` `card-art-gate.json` ve `card-art-gate.md` yazar (varsayılan `artifacts/card-art-gate/`, git'e girmez). Üç oyun 300/300 manifest-pass değilse çıkış kodu 1'dir. Denetimler: kanonik `source-cards.json` SHA-256, 300 benzersiz beklenen ID, dosya adı/yetim/`.tmp`, RIFF/VP8/VP8L yapısı, Chromium decode + düz kare tespiti, kesin boyut, byte + SHA-256, provenance satırı (hash, ad, tür, boyut, çıktı yolu, araç), prompt kaydı (ad, boyut), dondurma kaydı, oyunlar arası aynı-byte. Her red kart başına nedenle yazılır. Kapı en fazla `READY_FOR_VISUAL_QA` der; görsel QA her zaman `PENDING`.
- `art:gallery` her oyundan sahne sınıfına göre (insan/nesne/mekân/olay/eylem/kurum) ID aralığına yayılmış örnekleri kart adı ve etkisiyle yan yana gösterir; anatomi, sahne çeşitliliği, ad–sahne uyumu, okunurluk, gerçek kişi/logo/yazı yokluğu için işaret kutuları ve imza JSON'u üretir. `--shots` 320/390/1440 ekran görüntüsü alır (bu pakette yatay taşma 0 px).

## Atomik yayın tasarımı

- `public/games/duel-core/art-release.js` tema başına bir işaretçi tutar; üçü de `null`. `null` iken `cardArt()` bugünkü yolu döndürür: VETO/GETT `/games/<tema>/assets/cards/<ID>.webp`, DARBE `…/<ID>.svg`. Kısmi paket canlıya çıkamaz.
- İşaretçi yalnız `status: "accepted"`, `count: 300`, `kind: "webp"`, `r<12 hex>` kimliği ve boyutlarla geçerlidir; aksi her durumda eski sanat kalır. DARBE'nin SVG→WebP geçişi bu işaretçiyle olur (400×560 WebP); SVG dosyaları silinmez.
- Release dosyaları `/games/<tema>/assets/card-art-releases/<releaseId>/<ID>.webp` altına gider. `releaseId` 300 dosya hash'inin hash'idir: tek bir görsel değişirse tüm URL'ler değişir. Bir URL'nin içeriği hiç değişmediği için service worker'ın URL başına önbelleği eski ve yeni sanatı karıştıramaz; çevrimdışı eski modül eski URL'leri, yeni modül yeni URL'leri çözer. İndirilmemiş bir yeni görsel çevrimdışıyken eski sanata değil mevcut "◈" yer tutucusuna düşer.
- `release.mjs` 300/300 manifest-pass ve bu `releaseId`'yi adıyla onaylayan insan imzası (`verdict: "PASS"`, reviewer, date) olmadan reddeder; `--write` önce dosyaları ve `manifest.json`'u kopyalar, işaretçiyi en son çevirir. CI testi, işaretlenen her release klasörünün 300 dosyasını manifest hash'ine ve boyuta karşı doğrular.
- Kart verisi, motor, kurallar, save şeması, çeviriler ve erişilebilir metin değişmedi; `source-cards.json` hash'leri testle sabitlendi.

## Yayın için gereken koşullar (her oyun ayrı)

1. Eksik görsellerin üretilmesi (VETO 190, GETT 165, DARBE 141) ve SND-080/081 için geçerli provenance kaydı (ya da yeniden üretim).
2. `npm run art:gate` → ilgili oyun `300/300`, paket hatası yok (`.tmp` gibi artıklar temizlenmiş).
3. `npm run art:gallery -- --all --shots` ile insan görsel QA'sı ve imza JSON'u.
4. `release.mjs --write`, ayrı sanat PR'ı, CI yeşil, production'da kart görsellerinin doğrulanması.
