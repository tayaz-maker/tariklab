# TarikLab — kalan iş durumu

Kaynak: `TARIKLAB_REMAINING_WORK_COMPLETION_QUEUE.md`. Satır, merge ve production kanıtı olmadan DONE sayılmaz.

| İş | Durum | PR | main SHA | Production | Kalan risk |
|---|---|---|---|---|---|
| Main CI kapısı (#77 sonrası campaign-browser) | DONE | [#81](https://github.com/tayaz-maker/tariklab/pull/81) | `d3fbe23` | [run 35900250542](https://github.com/tayaz-maker/tariklab/actions/runs/35900250542) campaign-browser success; production adımı `Verify exact production game code` success. `www` ve workers `app.js` `bc89ed1ec0187076`, `map.js` `518b6406b6985096`, `mapintel.js` `8bee7505fd1131ec` yerel ağaçla aynı. | Yok. Kök neden: ray metni `hazırlanıyor` içinde `hazır` geçtiği için bekleme hemen dönüyor, menü henüz doğrulanmamış paketi gösteriyordu. |
| HANEDANIAN strateji / campaign-start | DONE | [#81](https://github.com/tayaz-maker/tariklab/pull/81) | `d3fbe23` | Aynı byte eşlemesi. PR CI [35897431597](https://github.com/tayaz-maker/tariklab/actions/runs/35897431597) build, campaign-browser (24m23s) ve campaign-balance yeşil. | 49×49, seed ve kayıt şeması duruyor. Katmanlar atlası yeniden kurmuyor. |
| İHTİLÂL tek oyunculu yeniden inşa | DONE | [#84](https://github.com/tayaz-maker/tariklab/pull/84) | `f924891` | Merge ağacı head `93759f5` ağacıyla aynı. `f924891` build'i ile production: 7 HTML asset ref, eksik 0, 7/7 dosya aynı. `games/ihtilal/solo-app.js`, `solo.js`, `solo.css` workers.dev'de byte-aynı. `www.tariklab.com` `solo-app.js` aynı, sha256 `07b481f27b587cdfde7206a747466abd191457d39ff970dd7e7685b6e404f900`. Smoke `/` ve `/games/ihtilal/index.html` 1440 + 390: 200, taşma yok, sayfa hatası yok. | Canlı sayfa `solo-app.js`. Eski kart motoru yalnız testlerde. Gerçek kişi yok. |
| Son 100 Gün | IN REVIEW | [#85](https://github.com/tayaz-maker/tariklab/pull/85) | — | Production yok. | Yeni tek kişilik POV oyunu `pov*.js`/`pov.css`. Yeni kayıt alanı `tariklab.son100.pov.v1.slotN`; eski `tariklab.nextwave.son-100-gun.*` kayıtları okunmaz, silinmez. Merge ve production kanıtı bekliyor. |
| Racon Manager | IN REVIEW | (PR açılıyor) | — | Production yok. | Harita şeması `network.js`: 4 karar (Koru/Yatırım/Çekil/İlişki kur), kontrol/itibar/ilişki/kaynak/tehdit/fırsat/komşu sinyalleri. Kayıt: `S.ag` + sokak `yatirim`; eski kayıt boş ağla açılır. EN yalnız statik etiketlerde; dinamik satırlar Racon'un geri kalanı gibi TR. Merge ve production kanıtı bekliyor. |
| TC SIM | TODO | — | — | — | — |
| SON KÖY MANAGER | TODO | — | — | — | — |
| TC SIM: DEVLET | TODO | — | — | — | Harita [#76](https://github.com/tayaz-maker/tariklab/pull/76) ile duruyor; derinlik ayrı iş. |
| JITEM | DONE | [#83](https://github.com/tayaz-maker/tariklab/pull/83) | `3e7194a` | `www` ve workers `runtime.js` `c9139e0b581e97bed0b6f5376290c6053c87c3cb073769f6429d93c9bd8e379b`, `SOURCE.json` `a7bbb6d3bdf0675fdfca503c6c7d68825b656d3e`. Save key `jitem-derin-ag-v3`, şema 5. | Karar masası dosyadan önce. Eski kart destesi değil. |
| Apartman / transit hukuk | BLOCKED | [#78](https://github.com/tayaz-maker/tariklab/pull/78) [#79](https://github.com/tayaz-maker/tariklab/pull/79) draft | — | Yayın yok | İnsan marka araştırması yok. Merge yok. |
| Novella | LATER | — | — | — | Bu dalga dışı. |
| Kaynaklar / hak zinciri | TODO | — | — | — | — |
| Final closure | TODO | — | — | — | Kuyruk bitmeden yazılmaz. |

## Checkpoint 2026-09-23

- JITEM [#83](https://github.com/tayaz-maker/tariklab/pull/83) merged `3e7194a`. `www.tariklab.com` ve workers `runtime.js` sha256 `c9139e0b581e97bed0b6f5376290c6053c87c3cb073769f6429d93c9bd8e379b`, `SOURCE.json` `a7bbb6d3bdf0675fdfca503c6c7d68825b656d3e`.
- İHTİLÂL [#84](https://github.com/tayaz-maker/tariklab/pull/84) branch `grok/ihtilal-single` `d6240a8`. Yerel: `ihtilal-solo` + `ihtilal.test` geçti. Tarayıcı 1280 ve 360: 19 karar, bitiş, taşma yok, sayfa hatası yok. CI henüz yeşil değil; kör merge yok.
- Sıradaki kod: CI yeşilse #84 merge + production `index.html` / `solo-app.js` doğrula, durumu DONE yaz. Sonra Son 100 Gün POV. Novella LATER.

