# TarikLab — İHTİLÂL sonrası kuyruk kapanışı

Kaynak: `TARIKLAB_POST_IHTILAL_COMPLETION_QUEUE.md`. Yalnız merge SHA'sı ve production
kanıtı olan satır DONE sayılır. Ayrıntılı kanıt satırları:
`docs/TARIKLAB_REMAINING_WORK_STATUS.md`.

## Kanıt yöntemi (her DONE satırında aynı)

1. PR head'inde yerel kapı:
   - typecheck, lint (0 hata), build;
   - `npm test` + TS paketi;
   - 1280/1440 + 390 px tarayıcı QA.
2. PR CI'da 5 kontrol yeşil:
   - build;
   - campaign-browser;
   - campaign-balance;
   - Workers Builds;
   - Vercel.
3. Merge öncesi head'in tabanı `origin/main`; merge `expectedHeadSha` ile yapıldı.
4. Merge ağacı = head ağacı.
5. Merge SHA'sı ayrı worktree'de build edildi. Production'da:
   - 7 HTML asset ref, eksik 0;
   - 7 anahtar dosya byte-aynı;
   - değişen oyun dosyaları workers.dev'de byte-aynı;
   - `www.tariklab.com` aynı.
6. Canlı smoke 1440 + 390: 200, yatay taşma yok, konsol hatası yok.
7. İşlev testi: workers.dev 1280 px ve www 390 px'te oyunun yeni özelliği oynandı.

## Sonuç

| Kuyruk | Durum | PR | main SHA | Kanıt özeti |
|---|---|---|---|---|
| Q0 İHTİLÂL | DONE | #84 | `f924891` | Önceki oturum. |
| Q1 Son 100 Gün | DONE | #85 | `786d760` | 6/6 dosya byte-aynı, `pov-app.js` sha256 `434b4dea…`, gün 15 + kayıt. |
| Q2 Racon haritası | DONE | #86 | `a7f54a0` | 3/3 dosya byte-aynı, `network.js` sha256 `9d2e5e02…`, 6 sokak + emir. |
| Q4 SON KÖY | DONE | #87 | `6e5bd40` | 3/3 dosya byte-aynı, `sim.js` sha256 `c3a3abc9…`, borç satırı + 3 yama + ay kapanışı. |
| Q3 TC SIM | DONE | #88 | `d2761c7` | 5/5 dosya byte-aynı, `decision-network.js` sha256 `872ea67f…`, 4 plan hücresi + 23 etiket. |
| Q5 DEVLET | DONE | #89 | `82e078d` | 3/3 dosya byte-aynı, `devlet-geo.js` sha256 `871b34fe…`, 4 adımlı zincir + 3 diplomasi seçeneği. |
| Q7 Lehçe | IN REVIEW | #90 | — | Merge ve production kanıtı #90 yorumunda. |
| Q8 Kaynaklar / hak zinciri | IN REVIEW | #90 | — | Aynı. |
| Q6 Apartman / transit | BLOCKED (bilerek) | #78 #79 draft | — | Hukuk/marka kapısı açılmadı. Kod merge edilmedi. Yalnız `docs/ip` kayıtları #90 ile main'e. |
| Novella | LATER | — | — | Kapsam dışı. |

## Bu dalgada bulunan ve düzeltilen hatalar

- **TC SIM:**
  - İlk taahhüt karşılığı her 3 haftada bir kalıcı +3 performans veriyordu. Bu, terfi eşiklerini aşırı zorladı.
  - Bir uzun koşu stratejisinin bakiyesi 436k'dan 1,13M'ye çıktı; sonuç çeşitliliği 3'ten 2'ye düştü.
  - Düzeltme: karşılık stres rahatlaması oldu ve çeyrekte bir gelir. Uzun koşu testleri değiştirilmeden geçer.
  - Tekrarlayan bir bedel artık sonuç zincirinde tek satır tutar.
- **Lehçe:**
  - PL okuyucu 18 oyunun 17'sinde Türkçe görüyordu (durum dosyası "EN'ye düşüyor" diyordu; yanlıştı).
  - Artık yazılmış Lehçe → İngilizce → kaynak sırası uygulanıyor.
- **İHTİLÂL ve düello masası:**
  - Sayfa dili `tr` kalıyordu.
  - Bu yüzden CSS büyük harf, İngilizce/Lehçe metinde "BİURKO" gibi noktalı İ üretiyordu.
- **Kaynaklar:** yapay zekâ ile üretilmiş kart görselleri için "özgün illüstrasyon" iddiası vardı; kaldırıldı.

## Açık kalan (sahip veya hukuk kararı gerekir)

- AI görsel sağlayıcısı ve o tarihteki koşullar: VETO-H!, GETT-OH!, DARBE-H!.
- Yaratıcısı kaydedilmemiş görseller:
  - portal paylaşım görselleri;
  - JITEM görselleri;
  - Bükücü ikonları.
- TÜRKPATENT / WIPO aramaları yapılmadı. "Apartman: Apartman Yöneticisi" başlığı üçüncü taraf adıyla çakışıyor.
- Bükücü Web Audio ile kısa ton üretiyor; sessiz oyun politikasıyla çelişiyor. Sahip kararı gerekiyor. Bu dalgada ses eklenmedi.
- Lehçe çeviriler anadil kontrolünden geçmedi. Oyun metni (hikâye/olay/kart/yardım gövdesi) Lehçe değil.
- EN kapsam boşlukları sürüyor: tc-sim, racon, klasikler ve amiral-batti'de EN modunda da kalan Türkçe kelimeler.
- Gerçek oyuncu testi ve Mac Dock kapsam dışı.
