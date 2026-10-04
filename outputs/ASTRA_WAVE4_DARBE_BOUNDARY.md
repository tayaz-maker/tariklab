# DARBE-H Wave 4 sınır notu — yalnız kaynak keşfi
Kaynak: #111 `de4c416`; pending CI sırasında okundu. Ürün kodu/test/teşhis değişmedi; bu bir release PASS değildir.
- Oyuncu değeri: Oyuncu tamamladığı masa kararının gerçekleşmiş baskı/kaynak ve saha etkisini, kart kazanımı uydurulmadan okuyabilir.
- `public/games/darbe-h/assets/card-art/manifest.json`: mevcut 300 özgün SVG, 240×160; kimlikler ve çizimler korunur.
- Legacy `assets/cards/` + `assets/art-manifest.json`: 300 adet 400×560 yüz; silme/yeniden üretme veya ölçü değişikliği yok.
- Köken: `scripts/build-darbe-h-card-art.mjs`, `scripts/darbe-h-card-art/{compose,motifs}.mjs`; yeni katman yalnız kod/SVG/CSS, dış asset yok.
- Değişmezler: `darbe-h/{source-cards.json,designs.js,decks.json}`, `duel-core/save.js` anahtar `tariklab.darbe-h.duel`/backup/v1/checksum; mekanik/save hesabı değişmez.
- Ortak `duel-core/{rules,actions,effects,battle,summoning,model}.js` ve kart/slot ölçülerinin sahibi `duel-core/{table,design}.css` korunur.
- Mevcut UI girişi `darbe-h/app.js` → `startApp(...,{cardFace})`; `card-face.js` SVG yüzlerini kullanır. Yeni iş oyuna özgü sunum sınırında kalmalıdır.
- Gerçek before/after: `duel-core/app.js::command`, başarılı `dispatchPresented` sonrası `prev/result.state`; `telemetry.js::recordAction` gerçek KP farkı/yeni log örneğidir. Bunlar yeni hook veya ortak engine değişikliği yetkisi değildir.
- `animateTransition` başarılı komutta, load yalnız render; `lastRevision` tekrar filtresi mevcut. Outcome bir kez, sessiz, kapatılabilir, reduced-motion statik; reload tetiklemez.
- DRB-237–240: `docs/darbe-h/{README.md,FINAL_VERIFICATION_II.md}`, `designs.js` 237–240 ve `summoning.js::specialPlans`; belgeler eski sınırlama diyor. Gerçek repro henüz yok; final review'de P1 kaydı doğrulanacak, görsel PR'da çözülmeyecek.
