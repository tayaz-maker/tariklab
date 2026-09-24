# TarikLab — kalan iş kapanışı

Kaynak: `docs/TARIKLAB_REMAINING_WORK_STATUS.md`. Bir satır ancak merge SHA'sı ve
production kanıtı varsa DONE sayılır. Bu belge hukukî görüş değildir ve
hukukî garanti iddia etmez.

## Yayın ölçütü

Hukuk/marka onayı beklenmedi; yayın yetkisi sahipte. Uygulanan ölçüt:

- Başka oyun ya da uygulamaya ait ad, logo, ekran görüntüsü, görsel, metin,
  gerçek harita veya ayırt edici arayüz düzeni kullanılmaz.
- Yeni görseller özgün SVG/CSS/prosedürel çizimdir.
- Kanıtı olmayan eski görseller için "lisanslı", "telifsiz" veya "orijinal"
  denmez. Değişmeyenler Kaynaklar'da `provenance pending` olarak yazılır.
- Hiçbir oyuna ses veya müzik eklenmez.

## Kanıt yöntemi

1. PR CI'da 5 kontrol yeşil: build, campaign-browser, campaign-balance,
   Workers Builds, Vercel.
2. Head'in tabanı `origin/main`. Merge `expectedHeadSha` ile yapıldı ve merge
   ağacı head ağacıyla aynı.
3. Merge SHA'sı ayrı worktree'de build edildi. Production'da şunlar doğrulandı:
   - 7 HTML asset ref, eksik 0, 7/7 anahtar dosya aynı;
   - değişen dosyalar workers.dev'de byte-aynı;
   - `www.tariklab.com` aynı.
4. Smoke 1440 + 390: 200, yatay taşma yok, konsol hatası yok.
5. İşlev testi workers.dev 1280 px ve www 390 px'te yapıldı.

## Sonuç

| İş | Durum | PR | main SHA | Kanıt özeti |
|---|---|---|---|---|
| Lehçe (PL) + Kaynaklar + İHTİLÂL sonrası kapanış | DONE | [#90](https://github.com/tayaz-maker/tariklab/pull/90) | `773c979` | 5/5 dosya byte-aynı, `tlab-i18n.js` sha256 `d84da043…`, PL arayüzü ve Kaynaklar zinciri iki alanda doğrulandı. |
| Kapı Nöbeti | DONE | [#91](https://github.com/tayaz-maker/tariklab/pull/91) | `a6cf31c` | 6/6 dosya byte-aynı, `apartman/app.js` sha256 `c433080d…`, avlu SVG + 3 açık iş. |
| Kıyı Eşiği | DONE | [#92](https://github.com/tayaz-maker/tariklab/pull/92) | `d941d85` | 6/6 dosya byte-aynı, `esik/app.js` sha256 `5e2b3dfa…`, kıyı SVG + 8 hamle, Dönem 1 → 2, arıza metni. |
| Bükücü sessiz + SVG ikon | DONE | [#93](https://github.com/tayaz-maker/tariklab/pull/93) | `e431508` | 6/6 dosya byte-aynı, `bukucu/index.html` sha256 `5a4bcd17…`, ses kodu 3 → 0, AudioContext 0, `icon.svg` 200, eski PNG 404. |
| Paylaşım, JITEM ve arka plan görselleri | DONE | [#94](https://github.com/tayaz-maker/tariklab/pull/94) | #94 merge | Kodla yeniden çizildi (`scripts/ip/render-original-art.mjs`, CSS). Production kanıtı #94 yorumunda. |
| Kart görselleri + sessizlik | DONE | [#95](https://github.com/tayaz-maker/tariklab/pull/95) | `771a288` | 12/12 dosya byte-aynı, `SND-001.webp` sha256 `0b737ef0…`; manifestler kod üreticisini gösteriyor, DARBE kartları yalnız kendi SVG çizimini gömüyor, plakalar 404, iframe `autoplay` yok, ses/titreşim 0. |

## Görsel temizlik sırası

| Sıra | Yüzey | Durum |
|---|---|---|
| 1 | VETO-H!, GETT-OH!, DARBE-H! kartları | Kodla çizildi (#95). VETO/GETT: 600 kart + 2 masa arka planı, `scripts/duel-card-art`. DARBE: 300 kart kendi `card-art` çizimini gömüyor; 60 AI plakası silindi. DARBE kart çerçevesi ve düzeni aynı (A008–A012, `docs/ip/card-art-2026-09-24.md`). |
| 2 | Paylaşım görselleri (`og.jpg`, `x-banner.jpg`) | Kodla yeniden çizildi (#94, A013). |
| 3 | JITEM görselleri | TarikLab kopyası kodla yeniden çizildi, kullanılmayan `road.jpg` silindi (#94, A014). Ayrı `jitem-derin-ag` deposu aynı görsellere geçti (jitem-derin-ag#20, `15109b7`). |
| 4 | Bükücü ikonları | Elle yazılmış SVG (#93, A015). |
| — | Portal arka planı `prism-spectrum.webp` | CSS gradyanları ile değiştirildi, dosya silindi (#94, A022). |
| — | Ses ve titreşim | Bükücü tonları (#93), Çete Savaşları titreşimi ve oyun çerçevesinin `autoplay` izni (#95) kaldırıldı. `scripts/silence.test.mjs` geri dönüşü engelliyor (A005). |

## Dokunulmayanlar

- Eski checkout'taki commit edilmemiş HANEDANIAN `map.js` ve DARBE SVG
  değişiklikleri.
- Ayrı JITEM deposundaki push edilmemiş çalışma.
- Taslak #78/#79 merge edilmedi; "Superseded by #91/#92" açıklamasıyla kapatıldı.
- Novella: LATER, bu kuyruğun dışında.

## Son düzeltme dalgası (`TARIKLAB_FINAL_REMEDIATION.md`)

| Madde | Sonuç |
|---|---|
| 1. Kart görseli provenance açığı | Kapandı (#95). Yeni görseller kodla çizildi; model ya da referans görsel yok. Kayıt: üretici, tarih, yöntem. Lisans veya telif garantisi iddiası yok. |
| 2. Sessizlik kuralı | Kapandı (#95). Kalıntılar silindi, regresyon testi eklendi. |
| 3. #78/#79 hijyeni | Kapandı. İkisi de superseded olarak kapatıldı. |
| 4. JITEM ve portal görsel sınırı | #94 bozulmadı. Upstream jitem-derin-ag#20 merge edildi; TarikLab `SOURCE.json` kaydı güncellendi, runtime aynı. `grok/jitem-product-depth` WIP'i katılmadı. |
| Kapanış kapısı | Testler, typecheck, lint, build; `duel-browser` 24 senaryo + 216 viewport (1280/1920/390); CI 5/5 yeşil; merge + production kanıtı. |

## Açık kalanlar (DONE sayılmaz)

- Gerçek oyuncu testi yok.
- PL oyun gövdesi İngilizce; anadil kontrolü yok.
