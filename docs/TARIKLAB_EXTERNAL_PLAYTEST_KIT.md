# TarikLab — Dış Oyun Testi Kiti

Durum: **hazır, henüz uygulanmadı.** Bu belgede hiçbir test sonucu yoktur. Gerçek
test ancak katılımcılar veya bir kanal (Discord, WhatsApp grubu, e-posta listesi)
belirlendiğinde başlar. Bulgular yalnızca gerçek oturumlardan, bu belgedeki
formlarla toplanır; tahmini, uydurma veya "örnek" bulgu yazılmaz.

Canlı adres: https://tariklab.tayaz29.workers.dev/

---

## 1. Kapsam ve karar ölçütleri

### Katılımcı sayısı

| Tur | Katılımcı | Cihaz dağılımı | Amaç |
|---|---|---|---|
| Tur 1 | 6 kişi | 3 masaüstü, 3 telefon | Engelleyici sorunları ve anlaşılmayan ekranları bulmak |
| Tur 2 | 6–8 yeni kişi | yarı yarıya | Tur 1 düzeltmelerinin işe yarayıp yaramadığını görmek |

Beş-altı kişi, bir ekrandaki büyük anlaşılırlık sorunlarının çoğunu yakalamaya
yeter. Tur 2'de aynı kişiler kullanılmaz, çünkü oyunu artık bilirler.

Katılımcı profili: 18 yaş üstü, Türkçe konuşan. En az ikisi strateji/menajerlik
oyunu oynayan, en az ikisi bu türü nadiren oynayan kişiler olmalı. Kişi TarikLab
geliştiricisi veya yakın çevresinden oyunları daha önce görmüş biri olmamalı.

### Oyun seçimi

Her katılımcı **iki oyun** oynar: biri A grubundan, biri B grubundan. Dağılım
her oyunu en az üç kişinin görmesini sağlayacak şekilde yapılır.

- **A grubu (bir sonraki ürün dalgasının hedefleri):** HANEDANIAN, JITEM: Derin Ağ,
  İHTİLÂL, SON KÖY MANAGER.
- **B grubu (karar–sonuç bağı ölçülecek oyunlar):** TC SIM, TC SIM: DEVLET,
  Racon Manager.

Kalan 12 oyun (düello ailesi, klasikler, anlatı oyunları) bu turun dışında
tutulur. Onlar ayrı bir kısa turda test edilir.

### Karar ölçütleri (bir bulgu ne zaman iş olur)

| Öncelik | Ölçüt | Karar |
|---|---|---|
| P0 | Oyunu ilerletmeyi engelliyor, veri kaybı var veya bir katılımcı bile çökme yaşadı | Hemen düzelt; sonraki tura kadar bekleme |
| P1 | Aynı sorunu, aynı oyunu oynayan kişilerin **en az yarısı** yaşadı veya görev başarısız oldu | Sonraki dalgaya al |
| P2 | Bir-iki kişide görülen anlaşılırlık sorunu, görev yine de tamamlandı | Birikim listesine yaz; tekrar görülürse P1 yap |
| P3 | Tek kişinin zevk yorumu | Kaydet, iş açma |

Bir oyun için "iyi durumda" ölçütü:
- Görevlerin en az %80'i yardımsız tamamlandı.
- Ortalama "ne yapacağımı biliyordum" puanı en az 4/5.
- P0 bulgu yok.

---

## 2. Davet metni

> Merhaba! TarikLab adında, tarayıcıda oynanan Türkçe oyunlardan oluşan bir
> koleksiyon üzerinde çalışıyoruz. Yaklaşık **30–40 dakikanı** ayırıp iki oyunu
> oynamanı ve ne düşündüğünü anlatmanı istiyoruz.
>
> - Kurulum yok; bir bağlantıya tıklaman yeterli. Bilgisayar veya telefon olabilir.
> - Her oyunda 15–20 dakikalık birkaç küçük görev var, sonra kısa bir form.
> - Doğru ya da yanlış cevap yok. Test ettiğimiz şey sen değilsin, oyunlar.
>   Takıldığın her yer bizim için değerli bir bilgi.
> - Hiçbir hesap açman gerekmiyor. Adını sormuyoruz.
>
> Katılmak istersen bu mesaja "varım" yazman yeterli. Uygun olduğun gün ve
> cihazı (bilgisayar/telefon) belirt, bağlantıyı gönderelim.

---

## 3. Onay ve gizlilik notu

Oturum başlamadan önce katılımcıya okunur veya gönderilir. Onay alınmadan
oturum başlamaz.

> **Katılım gönüllüdür.** İstediğin an bırakabilirsin, sebep söylemen gerekmez.
>
> **Topladıklarımız:**
> - Form cevapların
> - Kullandığın cihaz ve tarayıcı türü
> - İzin verirsen, oynarken söylediklerinin yazılı notları
>
> **Toplamadıklarımız:**
> - Adın, e-postan, telefon numaran
> - Konumun
> - Oyun dışındaki ekranın
>
> Ekran veya ses kaydı yalnızca açıkça "evet" dersen alınır. Kayıtlar yalnızca
> oyunları iyileştirmek için kullanılır, üçüncü kişilerle paylaşılmaz ve test
> turu bitince en geç 30 gün içinde silinir.
>
> Oyunların kayıtları yalnızca senin tarayıcında durur. Bize gönderilmez.
>
> Cevaplar katılımcı numarasıyla (ör. K3) saklanır. Raporlarda seni tanıtacak
> hiçbir bilgi yer almaz.
>
> Onaylıyor musun? ☐ Evet ☐ Evet, ama kayıt alınmasın ☐ Hayır

---

## 4. Oturum akışı (moderatör için)

1. Onay (2 dk).
2. Isınma sorusu (1 dk): "En son hangi oyunu oynadın?"
3. **Oyun 1** (15–20 dk): görevleri tek tek ver. Katılımcıyı yönlendirme.
   "Ne düşünüyorsun?", "Şu an ne bekliyordun?" dışında ipucu verme. Takılırsa
   2 dakika bekle, sonra görevi "yardımla tamamlandı" diye işaretle ve geç.
4. Oyun 1 formu (3 dk).
5. **Oyun 2** (15–20 dk) ve formu (3 dk).
6. Kapanış (2 dk): "Bir şeyi değiştirebilseydin ne olurdu?"

Her yeni katılımcıda tarayıcı kaydı temiz olmalı: gizli pencere kullanılır, ya da
oyunun kendi "yeni oyun" akışı seçilir.

---

## 5. Görev senaryoları (oyun başına 15–20 dk)

Görevler, oyuncunun hedefini anlatır. Hangi butona basacağını söylemez.

### HANEDANIAN
1. Yeni bir kampanya başlat ve ilk yerleşimini tanı: "Şu an elinde ne var?" (3 dk)
2. Bir bina geliştir ve bunun neyi değiştireceğini, emri vermeden önce söyle. (4 dk)
3. Haritada yeni yerleşim kurabileceğin bir yer bul ve neden orayı seçtiğini anlat. (5 dk)
4. Sana doğru gelen bir tehdit olup olmadığını haritadan anla. (3 dk)
5. Harita katmanlarından birini kapat, sonra tekrar aç. (2 dk)

### JITEM: Derin Ağ
1. Yeni oyun başlat ve ilk turda neyin hedeflendiğini söyle. (3 dk)
2. Bir operasyon seç ve risk ile ödülünü, onaylamadan önce anlat. (5 dk)
3. Turu bitir ve sonucun beklediğin gibi olup olmadığını söyle. (4 dk)
4. Ağdaki kırılgan bir bağlantıyı bul. (3 dk)

### İHTİLÂL
1. Oyunu başlat ve kazanmak için ne yapman gerektiğini kendi cümlenle söyle. (4 dk)
2. Üç karar ver ve her birinin sonucunu tahmin et. (8 dk)
3. Son kararın sonucunu ekranda bul ve tahminini kontrol et. (3 dk)

### SON KÖY MANAGER
1. Yeni köy başlat. Üst menüde hangi bilginin ne işe yaradığını anlat. (4 dk)
2. Köyün en acil sorununu bul. (3 dk)
3. Bu sorun için bir karar ver ve bir ay ilerle. Sonucu yorumla. (6 dk)
4. Telefonda: tüm üst menüyü kaydırmadan okuyabiliyor musun? (2 dk)

### TC SIM
1. Yeni hayat başlat ve karakterinin durumunu özetle. (3 dk)
2. Bir hafta için karar ver ve neyin değişmesini beklediğini söyle. (5 dk)
3. Birkaç hafta ilerle ve verdiğin kararın izini bul. (6 dk)

### TC SIM: DEVLET
1. Yeni dönem başlat ve devletin en zayıf yanını bul. (4 dk)
2. Bir politika seç ve etkisini, uygulamadan önce ekrandan oku. (5 dk)
3. Bir yıl ilerle ve politikanın etkisini göster. (6 dk)

### Racon Manager
1. Yeni kariyer başlat ve ilk hedefini söyle. (3 dk)
2. Bir adamına görev ver ve riskini anlat. (5 dk)
3. Sonucu oku ve bir sonraki hamleni buna göre seç. (6 dk)

---

## 6. Geri bildirim formları

### 6a. Masaüstü formu (her oyundan sonra)

- Katılımcı no: ___
- Oyun: ___
- Tarayıcı: ___
- Ekran: ☐ Dizüstü ☐ Harici monitör

Puanlar (1 = hiç katılmıyorum, 5 = tamamen katılıyorum):

1. Oyunun amacını ilk 3 dakikada anladım. 1 2 3 4 5
2. Her an ne yapacağımı biliyordum. 1 2 3 4 5
3. Kararlarımın sonucunu ekranda görebildim. 1 2 3 4 5
4. Ekrandaki yazılar okunaklıydı. 1 2 3 4 5
5. Tekrar oynamak isterim. 1 2 3 4 5

Açık sorular:

6. En çok nerede takıldın?
7. Seni en çok şaşırtan şey neydi? (iyi ya da kötü)
8. Bir şeyi değiştirebilseydin ne olurdu?

Görev tablosu (moderatör doldurur):

| Görev | Yardımsız | Yardımla | Yapamadı | Süre | Not |
|---|---|---|---|---|---|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |

### 6b. Mobil formu (her oyundan sonra)

Masaüstü formundaki 1–8 numaralı soruların hepsi sorulur, ek olarak:

- Telefon modeli / tarayıcı: ___
- Ekran yönü: ☐ Dikey ☐ Yatay

9. Butonlara parmağınla rahatça dokunabildin mi? 1 2 3 4 5
10. Bir şeyi görmek için yana kaydırman gerekti mi? ☐ Hayır ☐ Evet, nerede: ___
11. Bir panel başka bir şeyin üstünü kapattı mı? ☐ Hayır ☐ Evet, nerede: ___
12. Klavye açıldığında (varsa) ekran bozuldu mu? ☐ Hayır ☐ Evet ☐ Klavye açılmadı

---

## 7. Hata bildirimi şablonu

```
Başlık: [Oyun] kısa tanım
Katılımcı / oturum: K_ / Tur _
Cihaz / tarayıcı / ekran: ___
Adres (URL): ___
Adımlar:
  1.
  2.
  3.
Beklenen: ___
Olan: ___
Sıklık: ☐ Her seferinde ☐ Bazen ☐ Bir kez
Ekran görüntüsü / kayıt: ☐ Var (dosya adı: ___) ☐ Yok
Konsol hatası (moderatör, masaüstünde): ___
Öncelik önerisi: P0 / P1 / P2 / P3 — gerekçe: ___
```

Birden çok katılımcıda görülen aynı hata **tek kayıtta** tutulur, "Görüldüğü
katılımcılar" satırına eklenir.

---

## 8. Önceliklendirme şablonu

Tüm oturumlar bittikten sonra doldurulur. Sayılar yalnızca formlardan gelir.

| # | Oyun | Bulgu | Tür (hata / anlaşılırlık / denge / mobil) | Kaç kişi (x / n) | Görev başarısı etkisi | Öncelik | Karar (düzelt / sonraki dalga / birikim / iş açma) | Sahip | Bağlantı (PR/issue) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | | |

Oyun başına özet:

| Oyun | Katılımcı | Yardımsız görev oranı | Ort. "ne yapacağımı biliyordum" | P0 | P1 | "İyi durumda" mı? |
|---|---|---|---|---|---|---|
| HANEDANIAN | | | | | | |
| JITEM | | | | | | |
| İHTİLÂL | | | | | | |
| SON KÖY MANAGER | | | | | | |
| TC SIM | | | | | | |
| TC SIM: DEVLET | | | | | | |
| Racon Manager | | | | | | |

---

## 9. Sonraki adım

Kullanıcı katılımcıları veya kanalı verdiğinde:

1. Davet gönderilir.
2. Oturumlar planlanır.
3. Formlar doldurulur.
4. Önceliklendirme tablosu gerçek sayılarla `docs/` altında ayrı bir rapor
   olarak kaydedilir.

Bu belge o rapor değildir.
