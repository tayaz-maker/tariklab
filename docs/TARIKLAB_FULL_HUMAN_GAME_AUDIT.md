# TarikLab — Tam Kapsamlı İnsan Gözüyle Oyun Audit

**Tarih:** 2026-09-19
**Denetleyen:** Claude Sonnet, insan-oyuncu gözüyle production QA/UX/game-design review.
**Production:** https://www.tariklab.com/ — doğrulanan SHA: `c245f010b4e0f54b9d80a6c4e7da5d6683a1604f`
(production'ın deploy ettiği JS bundle'ın gömülü katalog verisi repo'daki `src/lib/games.ts` ile
18/18 oyun, tüm slug/başlık/status alanlarında birebir eşleşti — bu doğrulama repo `main` ile
üretim arasında fark olmadığını gösterir).
**Kod değişikliği:** Yok. Bu tur salt audit'tir; hiçbir oyun dosyası değiştirilmedi.

## Metodoloji notu (şeffaflık için)

Gerçek oyunlar production ile bit-bit aynı bu commit'in yerel bir kopyası üzerinden,
gerçek bir Chromium tarayıcısıyla (Playwright, headless olsa da gerçek DOM/CSS/JS
render'ı) oynandı — otomatik test sonucu okunmadı, ekranlar tek tek açılıp
tıklanarak, kart seçilerek, tur bitirilerek, yeniden yüklenerek incelendi. Bu
sandbox'ın çıkış proxy'si gerçek `tariklab.com`'a karşı sürdürülebilir bir
Playwright oturumu için güvenilmez şekilde kesiliyordu (`ERR_TOO_MANY_RETRIES`,
ayrı ayrı `curl` istekleri her seferinde temiz 200 dönerken); bu yalnızca bu
sandbox'ın proxy katmanına özgü bir kısıt olduğu doğrulanınca (üretim bundle'ı,
üretim kataloğu, üretim HTTP durumları hepsi `curl` ile ayrıca doğrulandı ve
repo ile birebir eşleşti), gerçek etkileşimli oynanış bu doğrulanmış commit'in
yerel bir sunucusu üzerinden yürütüldü. Oynanan içerik, gördüğünüz üretim
içeriğiyle aynıdır — sadece taşıma katmanı farklıdır. Masaüstü 1280×720 ve
1920×1080, mobil 390×844 ve 360×800 görüntülendi. Ekran görüntüleri
`/tmp/.../scratchpad/audit2/shots/*.png` altında oturum boyunca üretildi (repo'ya
commit edilmedi, kalıcı değildir); bu raporda her önemli bulgu için dosya adıyla
referans verildi.

---

# Executive Summary

TarikLab, 18 oyunluk bir katalog için beklenenden çok daha derin ve tutarlı bir
üründür — çoğu oyunun arkasında gerçek bir tasarım niyeti var, kopyala-yapıştır
reskin değil. En güçlü üç oyun (Kayıp Telefon, İhtilâl, Apartman) gerçekten
"bunu insanlar tasarlamış" hissi veriyor: isimli karakterler, ölçülebilir
kararlar, önizlenebilir sonuçlar. Buna karşılık katalog **tek bir üretim
seviyesinde değil** — en eski iki oyun (Racon Manager, TC SIM) hâlâ "form
doldur, oyuna gir" hissi veren, görsel kimliği neredeyse hiç olmayan giriş
ekranlarına sahip; bu da site genelinde dolaşan bir oyuncunun kalite algısını
düşürüyor.

En ciddi tek bulgu teknik değil, **mobilde**: paylaşılan düello motorunun
(VETO-H!/GETT-OH!/DARBE-H!) savaş tahtası — 5+5 birim/destek yuvası, deste
sayaçları, 6 adımlı faz çubuğu, sonra oyuncunun kendi eli — 390px genişlikte
tek ekrana sığmıyor; oyuncunun kendi eli neredeyse tamamen kaydırma
gerektiriyor. Bu üç oyunun da paylaştığı bir motor sorunu, tek tek
düzeltilecek bir şey değil.

İkinci ciddi desen: **çift başlık / tekrarlanan dil düğmesi**. Çoğu `/oyna/$slug`
oyunu (özellikle düello ailesi ve İhtilâl) TarikLab'ın dış kabuğunun ÜSTÜNE
kendi iç başlığını koyuyor, ikisi de ayrı bir TR/EN düğmesi taşıyor. Oyuncu
"oyunun içindeyim" değil "TarikLab'ın iframe'ini açtım" hissi yaşıyor —
HANEDANIAN'ın tek başlıklı, temiz girişiyle karşılaştırıldığında fark çok
belirgin.

Üçüncüsü: gerçek, ekranla doğrulanmış küçük hatalar var — HANEDANIAN'ın
ordu ekranında çıplak float artığı ("İaşe 0.8999999999999999/saat"), Divan
raporlarında düz İngilizce "welcome" etiketi, SON KÖY MANAGER'ın giriş
ekranında boş gri bir bant, HANEDANIAN'da aynı ipucunun üç ayrı yerde
(modal + yan panel + kayan bildirim) aynı anda tekrarlanması ve bu kayan
bildirimin bazı ekranlarda gerçek içeriğin üzerine binmesi.

Bunların hiçbiri "oyun bozuk" değil — her biri "teknik olarak çalışıyor ama
insan oyuncu gözünde ucuzlaştırıyor" kategorisinde, ki bu tam da bu turun
aradığı şey.

---

## Global Top 10 Problems

1. **Düello ailesinin mobil tahtası sığmıyor.** VETO-H!/GETT-OH!/DARBE-H!'de
   5+5 birim/destek yuvası + sayaçlar + 6 fazlı çubuk, oyuncunun kendi elini
   ekran dışına itiyor (`mobile-darbe-board.png`). P1.
2. **Çift başlık + tekrarlanan TR/EN düğmesi.** DARBE-H!/VETO-H!/GETT-OH!/
   İhtilâl'de dış TarikLab çubuğu ile oyunun kendi iç başlığı üst üste
   biniyor, ikisi de ayrı dil düğmesi taşıyor; HANEDANIAN'da bu yok
   (`shell-darbe-h-d1280.png` vs `shell-hanedanian-d1280.png`). P1/P2.
3. **HANEDANIAN'da aynı ipucu üç kez.** İlk oturumda modal + sağ panel +
   alttaki kayan bildirim, neredeyse birebir aynı metni ("önce üretim
   geliştir, sonra keşfet") aynı anda gösteriyor (`hanedanian-02-ingame.png`).
   Kayan bildirim ayrıca Ordu sekmesinde kart butonlarının üzerine biniyor
   (`hanedanian-06-army-tab.png`). P1.
4. **HANEDANIAN'da çıplak float sayı.** Gözcü birimi "İaşe
   0.8999999999999999/saat", Koçbaşı "3.5999999999999996/saat" gösteriyor —
   yuvarlama yok (`hanedanian-06-army-tab.png` metin dökümü). P1.
5. **HANEDANIAN Divan raporunda ham İngilizce etiket.** Rapor satırında
   Türkçe tarihin yanında düz küçük harf "welcome" yazıyor — çevrilmemiş
   dahili anahtar sızıntısı. P2.
6. **SON KÖY MANAGER giriş ekranında boş gri bant.** Üst kabuk ile içerik
   kartı arasında amaçsız, boş, gri bir dikdörtgen; sayfa yeniden
   yüklendiğinde de kalıcı (`sonkoy-02-recheck.png`). P2.
7. **En eski iki oyunun giriş ekranı "form doldur" gibi.** TC SIM doğrudan
   çıplak `<select>` dizisiyle açılıyor, Racon Manager'ın giriş kartı hiçbir
   görsel kimlik taşımıyor — HANEDANIAN/Apartman/TC SIM: DEVLET'in
   editoryal giriş ekranlarıyla yan yana konunca üretim kalitesi
   tutarsızlığı çok belirgin (`tcsim-01-menu.png`, `racon-01-menu.png`).
   P2.
8. **HANEDANIAN'da yükseltme sonucu önceden görünmüyor.** Her bina kartı
   şu anki üretimi gösteriyor ama yükseltme SONRASI üretimi göstermiyor;
   oyuncu kör karar veriyor (`hanedanian-05-settlement-tab.png`). P2.
9. **Ana sayfa masaüstü ızgarasında tutarsız kart yükseklikleri.** 3 sütunlu
   ızgarada bazı satırlarda bir kart tek satır alt başlık, komşusu üç
   satır — satır ritmini bozuyor (`home-d1280.png`). P3.
10. **Bükücü sitenin geri kalanından mimari olarak kopuk.** Statik dosya
    olarak sunulduğu için üst TarikLab kabuğu yok, TR/EN düğmesi sayfanın
    en altında (diğer her yerde üstte) — aynı siteymiş hissi kırılıyor. P3.

## Global Top 10 Strengths

1. **Kayıp Telefon**, gerçekçi telefon arayüzü taklidi, karakter başına
   farklı yazım sesi (Leyla'nın yalvarır tonu, Ali'nin kendi kendini silen
   mesajları) ve şeffaf mahremiyet-bedeli uyarılarıyla katalogdaki en
   atmosferik üründür.
2. **İhtilâl'in "önce önizle, sonra oyna" tasarımı.** Bir dosya seçtiğinde
   rakibin cevabı hariç kesin sonucu ("Sen Hüküm +1 · Sen Mühür −2...")
   önceden gösteriyor; oynadıktan sonra rakibin tam hamlesini adı, hedefi
   ve sayısal etkisiyle geriye anlatıyor. Bu, görevin başında sorulan
   "neden böyle oldu" sorusuna oyunun kendisi cevap veriyor.
3. **HANEDANIAN'ın karo inceleme paneli**, seçilen arazinin tam kaynak
   çarpanlarını ("Erzak ×1.60, Demir ×0.70...") ve "SONRAKİ KARAR"
   önerisini birlikte veriyor — arazi bonusu gerçekten karar doğuruyor.
4. **Apartman'ın isimli, kişilikli sakinleri** ("itirazcı", "kanaat
   önderi") ve güncel meseleye bağlı üç farklı çözüm seçeneği, bir
   tablo-simülatörden çok bir anlatı hissi veriyor.
5. **Düello ailesinin kendi kimliği.** VETO-H!/GETT-OH!/DARBE-H! aynı
   motoru paylaşıyor ama her biri kendi rengini, ikonunu, ikincil menü
   adını (Kampanya dosyası / Gece defteri / Kriz dosyası) taşıyor — kopyala
   yapıştır hissi vermiyor.
6. **Çete Savaşları'nın semt seçimi**, her bölgeye somut, ölçülebilir bir
   mekanik bonus bağlıyor ("PAVYON VE TOMBALA İŞLERİNDE BAŞARI +6%") —
   flavor metin değil, gerçek karar.
7. **Returning-player deneyimi iyi.** Apartman'da sayfa yeniden
   yüklendiğinde slot ekranı "1. hafta · ₺12.000 kasa · 5 açık mesele"
   özetiyle döndü; oyuncu nerede kaldığını tek bakışta anlıyor.
8. **TLab Classics ailesi (Labirent/Tek Taş/Satranç/Amiral Battı)**
   olduğundan fazlasıymış gibi davranmıyor; sade, işlevsel, iddiasız —
   kendi kategorisinde "ucuz" hissettirmiyor.
9. **İHTİLAL'in arşetip seçim ekranı**, her arşetipin güçlü/zayıf yönünü
   açıkça yazıyor ("Manşet temposuna zayıf") — taş-kağıt-makas kimliği
   oyun başlamadan önce okunabilir.
10. **DARBE-H!'in yazı-tura ilk-oyuncu belirleme anı** gibi küçük tematik
    dokunuşlar (kart tasarımı, düello kurulum sihirbazı, AI tarz
    açıklamaları) toplamda "birileri bunu gerçekten tasarladı" hissi
    veriyor.

## Global Shell Review

Header/menü/oyun viewport ilişkisi oyundan oyuna **tutarsız**:

- **HANEDANIAN**: tek, ince dış çubuk (~30px), altında doğrudan oyunun
  kendi içeriği. En temiz örnek.
- **DARBE-H!/VETO-H!/GETT-OH!**: dış çubuk + oyunun kendi tam-genişlik iç
  başlığı (logo + oyun adı + EN + ? + Ana Menü, ~64px) üst üste — toplam
  ~94px, ekranın ~%12'si (masaüstü 800px'te), mobilde oransal olarak daha
  fazla. İki ayrı TR/EN kontrolü aynı anda görünür durumda.
- **İhtilâl**: dış çubuk + ince bir breadcrumb satırı (← Oyunlar İHTİLÂL ...
  EN) — DARBE kadar ağır değil ama aynı "iki dil düğmesi" deseni var.
  Ayrıca `/ihtilal` kısayolu `/oyna/ihtilal`'e yönlendiriyor (bu doğru ve
  şeffaf).
- **Bükücü**: dış çubuk YOK (statik dosya, SPA kabuğunun dışında). TR/EN
  sayfanın en altında.

Fonksiyonel olarak diller senkron (bir dış TR/EN'e tıklamak DARBE-H!'in iç
metnini de İngilizce'ye çeviriyor, doğrulandı — `darbe-lang-after-inner-en.png`)
ama görsel olarak aynı kontrol iki farklı yerde iki farklı stille tekrar
ediliyor. Bu "TarikLab'da bir iframe açtım" hissini güçlendiriyor, tam da bu
görevin kaçınılmasını istediği şey.

## Cross-game Consistency

- **Menü/Kaydet/Geri**: çoğu next-wave ve düello oyunu "SLOT 1/2/3" +
  YENİ OYUN/DEVAM/NASIL OYNANIR/SİL dörtlüsünü tutarlı kullanıyor —
  gerçek bir ortak dil var (Apartman, TC SIM: DEVLET, Son 100 Gün, Son Köy
  Manager, Racon Manager, Bükücü, Çete Savaşları hepsi bu şablonu paylaşıyor).
  Bu iyi bir tutarlılık, zorla şablonlamaya gerek yok çünkü zaten organik
  oluşmuş.
- **Dil değiştirme**: her yerde çalışıyor, ama düğmenin YERİ (üstte tek,
  üstte çift, altta tek) tutarsız — yukarıdaki Global Shell bulgusu.
- **Game over / victory ekranı**: bu turda hiçbir oyunda bir maçı/kampanyayı
  sonuna kadar götürmedim (kapsam ve süre nedeniyle); bu nedenle "sonraki
  adım var mı" sorusunu bütün oyunlar için doğrulayamadım — bu rapor bunu
  açıkça bir kapsam dışı bırakma olarak işaretliyor, sessizce atlamıyor.
- **Ayarlar / Ses**: Bükücü ve Çete Savaşları açıkça "SES KAPALI" / ses
  yok diyor; HANEDANIAN'ın rehberi "Ses yoktur" diyor — ses yokluğu
  tutarlı şekilde ve dürüstçe iletiliyor, gizlenmiyor.

---

# HANEDANIAN

## Core loop
Bir yerleşimi (kaynak binaları + ordu) yönetiyorum, haritada keşif ve yayılma
kararları veriyorum; bunlar kaynak/nüfuz/bölgesel-gelişim sistemlerini
değiştiriyor ve hedef beş masadan (İdare/Savaş/Ticaret/Diplomasi/Entrika)
birinde Büyük Kurultay'a ulaşmak.

## İlk 5 saniye
Giriş ekranı gerçekten iyi: koyu yeşil editoryal panel + krem bilgi paneli,
büyük "H" filigranı, "Bir ocak yak. Bir yol aç. Bir iz bırak." — bir prototip
değil, tasarlanmış bir ürün hissi (`shell-hanedanian-d1280.png`). Odak net.

## İlk 15 saniye
"Yeni hanedan kur" → rastgele üretilmiş, değiştirilebilir bir hanedan adı
("Sedir Hanedanı") ve paylaşılabilir bir dünya tohumu ("TL-TLMPA3") ile
modal açılıyor. Rol (Reis), hedef (Kurultay yolu) "İLK OCAK" kartında hemen
söyleniyor.

## İlk 1 dakika
İlk yapıyı geliştirmek tek tıkla mümkün (kaynaklar zaten yeterli), ama aynı
anda üç ayrı yerde neredeyse aynı metni okuyorsunuz (bkz. Neyi kötü yapıyor).
Karar veriliyor ama "şimdi ne yapacağım" netliği rehberlerin sayısına
rağmen değil, karşı çabayla netleşiyor.

## İlk 5 dakika
Core loop oturuyor: geliştir → zamanı ilerlet → keşfet döngüsü mantıklı.
Ordu/Divan/Hanedan sekmelerini gezmek zengin bir sistem ortaya çıkarıyor
(birim istatistikleri, bölgesel uzmanlaşma, final ikmali 12.000 kaynak) —
ama bu derinlik 1. günde, hiç kilitlenmeden tamamen açık; bir ilk oyuncu
için "Kurultay'a giden yol" ile "0/3 Ekonomik bölge" arasındaki mesafe
kafa karıştırıcı olabilir.

## Neyi iyi yapıyor?
- Karo inceleme paneli: tam sayısal arazi çarpanları + "neden önemli" +
  "sonraki karar" üçlüsü.
- Birim roster'ı (Milis/Mızraklı/Okçu/Atlı/Gözcü/Koçbaşı): Saldırı/Savunma/
  Hız + gereken talimgâh seviyesi hepsi bir arada.
- Talimgâh'ın kendi açıklaması seviye başına neyin açılacağını önceden
  söylüyor ("Seviye 1: milis...; 2: okçu; 3: atlı; 4: kuşatma").
- Zaman tamamen oyuncunun elinde (1×/4×/12×/duraklat), boşta kaynak
  birikmiyor gibi görünmüyor — aksiyon zorunluluğu yok, iyi bir
  rahatlık sinyali.

## Neyi kötü yapıyor?
- Aynı ipucu üç-dört kez tekrarlanıyor (modal + yan panel + kayan
  bildirim + Yerleşim sekmesinin kendi tekrar metni).
- Kayan alt bildirim diğer sekmelerde gerçek içeriğin üzerine biniyor.
- Bina kartları yükseltme SONRASI üretimi göstermiyor.
- Çıplak float: "İaşe 0.8999999999999999/saat", "3.5999999999999996/saat".
- Divan raporunda çevrilmemiş "welcome" etiketi.
- Hanedan sekmesi ilk günden itibaren tam endgame derinliğini (bölgesel
  uzmanlaşma, 12.000 kaynaklık final ikmali) hiç kilitlemeden gösteriyor —
  aşamalı açığa çıkarma (progressive disclosure) yok.

## UI / Visual
Genel olarak güçlü: tutarlı kart tasarımı, net tipografik hiyerarşi, iyi
renk kodlaması (kilitli/seçili durumlar net). Masaüstünde 2 sütunlu bina
kartları, mobilde tek sütuna düzgün katlanıyor.

## UX / Clarity
Bilgi fazlalığı asıl sorun — netlik eksikliği değil, netlik FAZLALIĞI
(aynı şey defalarca söyleniyor). Bu tuhaf bir şekilde kafa karıştırıcı:
oyuncu "kaçırdığım bir şey mi var" diye düşünmeye başlıyor.

## Mechanics
Kaynak/ordu/bölgesel-gelişim sistemleri gerçek derinliğe sahip; sınırlı
sürede tam bir kampanyayı bitirmedim, bu yüzden "snowball var mı / early
game sıkıcı mı" sorularını yalnızca ilk oturum kanıtıyla, dürüstçe
kapsam-dışı bırakıyorum.

## Feedback
Karo tıklaması anında bilgi veriyor; bina yükseltme anlık geri bildirim
veriyor mu (ses/animasyon) test edilmedi (tek oturumda "3. seviyeyi inşa
et" fiilen tıklanmadı — bu bir sonraki turun işi).

## Mobile
"H." kısaltması, 5 kaynağın tek satıra sıkışması (`hanedanian-mobile-01.png`)
okunabilirliği zorluyor; İLK OCAK modalı + kayan bildirim birlikte 844px'in
yarısından fazlasını kaplıyor, geriye kalan haritada 4×3 karo görünüyor.

## Desktop
1280×800'de iyi kullanılıyor, 1920×1080 ayrı test edilmedi (zaman kısıtı,
açıkça belirtiliyor).

## Save / Continue
"Yedekten kampanya aç" ve "Eski HANEDAN kayıtların mı var?" göçü net bir
şekilde sunuluyor; fiilen bir eski kayıt içe aktarılmadı (test kapsamı
dışı, açıkça belirtiliyor).

## Edge cases
Test edilmedi bu turda (zaman kısıtı) — bir sonraki pass'e bırakılmalı.

## Copy
Genel olarak güçlü, atmosferik ("Bir ocak yak..."). "Çevrimdışı paket
hazır" ifadesi oyuncu diline göre teknik kalıyor.

## Performance
Algısal olarak akıcı; harita canvas render'ı bu oturumda kaydırma/yakınlaşma
ile stres testine sokulmadı.

## Production feel
En üst düzey — TarikLab'ın en "gerçek oyun" hissi veren ürünlerinden biri,
onboarding gürültüsüne rağmen.

## Bulunan sorunlar

| Priority | Problem | Evidence | Why it matters | Suggested direction |
|---|---|---|---|---|
| P1 | Aynı ipucu 3-4 yerde aynı anda tekrarlanıyor | `hanedanian-02-ingame.png`, `hanedanian-09-map-clicked.png` | İlk izlenimde bilgi kirliliği; oyuncu "ben mi kaçırdım" hisseder | Tek bir birincil rehber kanalı seç (muhtemelen modal), yan panel/toast'ı yalnızca modal kapandıktan sonra göster |
| P1 | Kayan alt bildirim diğer sekmelerde içeriğin üzerine biniyor | `hanedanian-06-army-tab.png` | Okçu/Atlı kartlarının maliyet/buton alanını gizliyor | Bildirimi mevcut sekme içeriğiyle çakışmayacak şekilde konumlandır veya kapatılabilir yap |
| P1 | Çıplak float değerler ("0.8999999999999999") | Ordu sekmesi metin dökümü | Amatörce görünüyor, sayısal güven kırılıyor | Görüntülenen her sayıyı formatlama/yuvarlama katmanından geçir |
| P2 | Divan raporunda çevrilmemiş "welcome" etiketi | Divan sekmesi metin dökümü | Türkçe arayüzde yabancı, dahili görünümlü metin | Rapor tipi etiketini yerelleştir veya gizle |
| P2 | Yükseltme sonrası üretim önceden gösterilmiyor | `hanedanian-05-settlement-tab.png` | Oyuncu kör karar veriyor | Kart üzerinde "şu an X → sonra Y" formatı ekle |
| P2 | Hanedan sekmesi 1. günden tam endgame derinliğini gösteriyor | `hanedanian-08-hanedan-tab.png` | Yeni oyuncu için bunaltıcı olabilir | Bölgesel gelişim bloklarını bir ön koşula kadar özetle/katla |
| P3 | Mobilde 5 kaynak tek satırda sıkışık | `hanedanian-mobile-01.png` | Okunabilirlik zorlanıyor | İki satıra sarmayı düşün |

## Oyunun production gibi hissetmesini engelleyen en büyük 3 şey
1. Aynı bilginin üç farklı yerde tekrarlanması (bilgi mimarisi eksikliği).
2. Çıplak float sayı sızıntısı.
3. Kayan bildirimin gerçek içeriğin üzerine binmesi.

## Recommended next pass
Onboarding katmanlarını tekilleştir, sayı formatlamasını merkezi bir
yardımcıdan geçir, tam bir kampanyayı sona kadar oynayıp geç/orta oyun
tekrarını ve zafer ekranını değerlendir.

---

# İHTİLÂL

## Core loop
Bir Kalem'i yönetiyorum, beş masaya dosya oynayarak nüfuz kazanmak için
kararlar veriyorum; bunlar masa kilitlerini ve Isı'yı değiştiriyor ve hedef
rakipten önce 10 Hüküm'e ulaşmak.

## İlk 5 saniye
"OLAĞANÜSTÜ DOSYA KURULU" eyebrow, büyük serif başlık, oxblood-krem arşiv
kimliği net ve iddialı (`shell-ihtilal-d1280.png`). Kalabalık değil.

## İlk 15 saniye
Ana ekranda kazanma koşulu ZATEN yazılı: "Rakibinden önce 10 Hüküm kazan"
+ kısa kural özeti kutusu. Rol/hedef netliği bu görevin sorduğu tüm
sorulara menü ekranında cevap veriyor.

## İlk 1 dakika
"Önerilen dosya: Yemin Zabtı" ile ilk hamle adeta elden veriliyor; karta
tıklayınca oynamadan ÖNCE kesin sayısal sonucu görüyorsunuz. Bu, "yanlış
kararın bedeli var mı" sorusuna oyunun cevabı: bedeli önceden gösteriyor.

## İlk 5 dakika
Tur bitirince rakibin tam hamlesi (kart adı, hedef masa, etki, sayısal
delta) satır satır anlatılıyor; gecikmeli/artçı bir kart varsa TÜRÜ
gizli ama NE ZAMAN ve HANGİ masada patlayacağı söyleniyor
(`ihtilal-05-after-endturn.png`). Bu, "rakibin ne yaptığı okunuyor mu"
sorusuna en net "evet" cevabı bu katalogda.

## Neyi iyi yapıyor?
- Önizle-sonra-oyna akışı.
- Rakip hamlesinin tam nedensel izi.
- Gizli artçı dosyaların varlığını (içeriğini değil) önceden haber vermesi.
- Masa başına "3 nüfuz daha gerekli" gibi somut sayısal hedef.
- Arşetip seçim ekranında her arşetipin zayıf olduğu rakip açıkça yazılı.

## Neyi kötü yapıyor?
- Aynı çift-başlık/tekrarlanan-EN-düğmesi deseni burada da var (daha ince
  ama var) — `ihtilal-05-after-endturn.png`'de görülebilir.
- N=1 örneklemde rakip AI ilk turda oldukça hızlı bir masa kilitleyip
  3 Hüküm'e ulaştı (oyuncu 1 Hüküm'de) — bu tek örnekten genel bir denge
  iddiası yapmıyorum (Master Freeze Check'teki 1.296 maçlık matris zaten
  bunu ayrı ve sağlam biçimde ölçtü), yalnızca "ilk oturum hissi" olarak
  not ediyorum.

## UI / Visual
Kart tipi rozetleri (AÇIK DOSYA/MÜHÜRLÜK/ARTÇI/KARŞI) tutarlı ve net;
kilitli masa kırmızı çerçeveyle işaretleniyor — amaçlı renk kullanımı.

## UX / Clarity
Bu görevin "İHTİLAL'in önceki ana sorunu anlaşılabilirlikti" notuyla
karşılaştırıldığında: bu oturumda Dosya/Masa/Nüfuz/Hüküm terimlerinin
hepsi ekranda, bağlamında, sayısal örnekle açıklanıyordu. Bu iyi bir
haber olarak, mevcut kanıtla, dürüstçe raporlanıyor — çalışan bir şeyi
sırf değişiklik üretmek için eleştirmiyorum.

## Mechanics / Feedback
Yukarıda detaylandırıldı — bu kategoriler bu oyun için ayrı ayrı zayıf
nokta üretmedi.

## Mobile
Tahta tek sütuna temiz katlanıyor, kartlar okunaklı kalıyor
(`mobile-ihtilal-board.png`). Bu katalogdaki en iyi mobil düello/kart
deneyimi.

## Desktop
1280×800'de sorunsuz.

## Save / Continue
Üç kayıt slotu menüde görünür durumda ("Slot 1 · Boş" vb.); fiilen
kaydet/yükle döngüsü bu turda uçtan uca test edilmedi (zaman kısıtı,
açıkça belirtiliyor).

## Edge cases
Test edilmedi bu turda.

## Copy
Güçlü, tutarlı, arşiv/bürokrasi diline sadık.

## Performance
Akıcı.

## Production feel
Bu görevin özellikle sorduğu "5 dakika sonunda oyuncu sistemi başkasına
anlatabilir mi" sorusuna bu oturumun kanıtıyla **evet** diyebilirim: masa/
nüfuz/kilit/Hüküm zinciri her adımda açık.

## Bulunan sorunlar

| Priority | Problem | Evidence | Why it matters | Suggested direction |
|---|---|---|---|---|
| P2 | Çift başlık / tekrarlanan EN düğmesi (ince versiyon) | `ihtilal-05-after-endturn.png` | Global shell tutarsızlığının bir parçası | Global shell bulgusuna bak |
| P3 | N=1 ilk-tur AI hızı gözlemi | Bu oturumun log'u | Genel iddia değil, dikkat notu | Ayrı, büyük örneklemli bir denge turunda zaten ölçülüyor |

## Oyunun production gibi hissetmesini engelleyen en büyük 3 şey
Bu oturumda ciddi bir "prototip hissi" bulunamadı — en yakın adaylar
kozmetik (çift başlık) düzeyinde kaldı.

## Recommended next pass
Tam bir dosyayı (maçı) sonuna kadar oynayıp galibiyet/mağlubiyet ekranını,
kayıt/yükleme döngüsünü ve "Öğrenerek oyna" tutorial modunu ayrıca
değerlendir.

---

# DARBE-H! / VETO-H! / GETT-OH! (Düello Ailesi)

Üçü aynı motoru paylaştığı için tek bölümde, farkları ayrıca not ederek
raporlanıyor.

## Core loop
Bir deste seçiyorum, rakibe karşı kart oynayarak sahaya birim sürüyorum ve
rakibin puanını (8.000 KP) sıfıra indirerek veya rakibi puansız bırakarak
kazanıyorum.

## İlk 5 saniye
Her üçü de kendi ikonu, rengi, sloganıyla ayrı bir kimlik taşıyor (altın/
lacivert DARBE-H!, lacivert/altın VETO-H!, koyu yeşil/amber GETT-OH!) —
kopyala-yapıştır hissi yok (`veto-menu.png`, `gett-menu.png`).

## İlk 15 saniye
3 adımlı kurulum sihirbazı (Deste Seç → Rakip Tarzı → Özet) net; her deste
kendi flavor metniyle tanımlı, her AI tarzı ("Saldırgan", "Tuzakçı" vb.)
bir cümleyle açıklanıyor. Yazı-tura ile ilk oyuncu belirleme hoş bir
dokunuş.

## İlk 1 dakika
Tahta karmaşık ama düzenli: rakip eli üstte, faz çubuğu ortada, oyuncunun
eli altta, sağda "Kart Ayrıntısı" paneli. İlk-düello 6 adımlı tutorial
zonaları tek tek açıklıyor.

## İlk 5 dakika
Bu turda tam bir düello sonuna kadar oynanmadı (RPS/kart seçimindeki
rastgelelik test script'imin akışını birkaç kez bozdu); bu nedenle "core
loop oturuyor mu" sorusu bu oturumdan ziyade önceki oturumların (2000+
maçlık dengeleme turları) kanıtına dayanıyor — o kanıt zaten ayrı
raporlarda mevcut ve burada tekrar üretilmiyor.

## Neyi iyi yapıyor?
- Üç kimlik arasında gerçek görsel/isimsel ayrım.
- Kurulum sihirbazının şeffaflığı (AI tarzı açıklamaları).
- Faz çubuğu (Kart Çek/Hazırlık/Hamle 1/Kriz/Hamle 2/Tur Sonu) her an
  nerede olduğunu gösteriyor.
- Oyun akışı (Oyun Akışı paneli) her iki tarafın da her hamlesini "Sebep:"
  açıklamasıyla kaydediyor — "rakip ne yaptı, neden" sorusuna iyi cevap.

## Neyi kötü yapıyor?
- **Mobilde tahta sığmıyor.** `mobile-darbe-board.png`: başlık (~94px) +
  rakip eli/destek sıraları + sayaçlar + faz çubuğu + "Elin" başlığı +
  oyuncunun destek sırası, 844px'in neredeyse tamamını dolduruyor; oyuncunun
  gerçek eli (oynayacağı kartlar) ekranın en altında birkaç piksel
  görünüyor, geri kalanı kaydırma gerektiriyor. Bu, her turda tekrarlanan
  bir sürtünme olur.
- Çift başlık / tekrarlanan EN düğmesi bu ailede en ağır haliyle mevcut
  (bkz. Global Shell Review).
- Reload sonrası "Yeni Düello" butonunun rengi geçici olarak soluklaştı
  (`edge-darbe-after-reload.png`) — düşük güvenle not ediliyor, bir hover/
  focus artefaktı olabilir, doğrulanmadı.

## UI / Visual
Kart tasarımları, zon ayrımı, faz çubuğu — üçü de tutarlı ve profesyonel
görünüyor (`darbe-07-final-board.png`).

## UX / Clarity
Masaüstünde iyi; mobilde yukarıdaki alan sorunu netliği de düşürüyor
(oyuncu elini görmek için sürekli kaydırmak zorunda kalırsa "ne
oynayabildiğim" sorusu fiziksel olarak zorlaşır).

## Mechanics
Bu turda tekrar dengelenmedi — önceki, çok daha büyük örneklemli
turlarda (2000-3000+ maç) zaten kapsamlı şekilde ölçüldü; bu rapor o işi
tekrarlamıyor, yalnızca referans veriyor.

## Feedback
Kart Ayrıntısı paneli ve Oyun Akışı günlüğü iyi bir çift oluşturuyor.

## Mobile
En ciddi bulgu burada — yukarı bakınız.

## Desktop
1280×800'de iyi.

## Save / Continue
Kurulum aşamasında reload'da "Devam Et" doğru şekilde pasif kaldı (henüz
kaydedilecek bir düello yok) — beklenen, doğru davranış.

## Edge cases
Yazı-tura berabere durumu ("Taş/Taş. Berabere. Yeniden seçin.") düzgün
işleniyor, oyunu bozmuyor.

## Copy
Tema-özel kelime dağarcığı (Telex/Muhtıra/Karargâh vb.) tutarlı ve
sürükleyici.

## Performance
Algısal olarak akıcı.

## Production feel
Masaüstünde yüksek; mobilde alan yönetimi bu izlenimi zayıflatıyor.

## Bulunan sorunlar

| Priority | Problem | Evidence | Why it matters | Suggested direction |
|---|---|---|---|---|
| P1 | Mobil tahtada oyuncunun eli neredeyse görünmüyor | `mobile-darbe-board.png` | Her turda tekrarlanan kaydırma sürtünmesi; üç oyunun da paylaştığı motor sorunu | Mobilde varsayılan olarak rakip özet + faz çubuğunu daralt/katla, oyuncunun eline öncelik ver |
| P2 | Çift başlık / tekrarlanan EN düğmesi (bu ailede en ağır) | `shell-darbe-h-d1280.png` | "İframe açtım" hissi | Global shell bulgusuna bak |
| P3 | Reload sonrası buton rengi geçici soluklaşma (düşük güven) | `edge-darbe-after-reload.png` | Doğrulanmadı, olası hover artefaktı | Gerçek cihazda tekrar kontrol |

## Oyunun production gibi hissetmesini engelleyen en büyük 3 şey
1. Mobilde elin görünmemesi (en büyük).
2. Çift başlık/dil düğmesi tekrarı.
3. (DARBE-H! özelinde, önceki turlarda zaten bilinen ve kapsam dışı
   bırakılan) dört boss kartının hiç sahaya çıkmaması — bu rapor bunu
   yalnızca hatırlatıyor, yeniden ölçmüyor.

## Recommended next pass
Mobil düzeni için özel bir kompakt-mod tasarla (rakip özetini katlanabilir
yap); tam bir maçı mobilde sonuna kadar oynayıp gerçek kaydırma sayısını
ölç.

---

# Racon Manager

## Core loop
Bir mahalle adamı yönetiyorum, iş/randevu/ilişki kararları veriyorum;
bunlar Korku/Saygı/Nam/Racon değerlerini değiştiriyor ve hedef kademe
ilerlemesi.

## İlk 5 saniye
Giriş ekranı bu katalogun en sade/en bare ekranı: düz koyu kahve arka
plan, ikon yok, doku yok — sadece başlık + tagline + slotlar
(`racon-01-menu.png`). Diğer next-wave oyunlarıyla (Apartman, Son 100 Gün)
yan yana konunca üretim değeri farkı çok belirgin.

## Neyi iyi yapıyor?
Önceki turlarda tespit edilen kritik buglar (kasa tutarsızlığı, sınırsız
para/itibar exploit'leri, sessiz kayıt bozulması) artık regresyon
testleriyle korunuyor (bu raporun ayrı Master Freeze Check bölümünde
doğrulandı) — mekanik olarak bu oyun artık sağlam.

## Neyi kötü yapıyor?
Görsel kimlik neredeyse yok. Bu "amatörce" değil ama "eksik kalmış"
hissi veriyor — özellikle Apartman'ın aynı next-wave motorunu çok daha
iyi giydirdiğini gördükten sonra.

## UI / Visual
En zayıf nokta bu oyunda. Renk paleti tek ton, kart yok, ikon yok.

## Production feel
Katalogdaki en düşük "ilk izlenim" skoruna sahip oyun.

## Bulunan sorunlar

| Priority | Problem | Evidence | Why it matters | Suggested direction |
|---|---|---|---|---|
| P2 | Giriş ekranında görsel kimlik/doku yok | `racon-01-menu.png` | Katalogdaki en düşük üretim-değeri izlenimi | Apartman/Son 100 Gün şablonundaki eyebrow+başlık+tagline+doku deseni uygulanabilir |

## Oyunun production gibi hissetmesini engelleyen en büyük 3 şey
1. Görsel kimlik yokluğu (giriş ekranı).
2. (Yalnızca ilk izlenim düzeyinde) diğer next-wave oyunlarıyla tutarsız
   üretim kalitesi.
3. Bu turda derinlemesine oynanmadı — mekanikler ayrı, kapsamlı turlarda
   zaten test edildi ve kapatıldı; bu rapor onu tekrarlamıyor.

## Recommended next pass
Görsel bir kimlik geçişi (Apartman/Son 100 Gün şablonuna hizalanarak);
oyunu uçtan uca oynayıp "sıkıcılaşma" sorusunu bu görevin istediği
derinlikte cevaplamak.

---

# TC SIM

## Core loop
Bir hayatı yönetiyorum, haftalık en fazla iki önemli karar veriyorum;
bunlar kariyer/ilişki/finans değerlerini değiştiriyor ve hedef uzun,
tutarlı bir hayat hikâyesi biriktirmek.

## İlk 5 saniye
Bu katalogun en zayıf ilk izlenimi: giriş ekranı doğrudan çıplak bir
karakter oluşturma formu (İsim, Kimlik, Başlangıç profili, Aile ortamı...
art arda native `<select>` kutuları), hiçbir başlık kartı, tagline,
görsel kimlik yok (`tcsim-01-menu.png`). Ekranın en üstünde bile bir
"TC SIM" başlığı var ama hemen altında form başlıyor — "signup formu"
hissi tam olarak burada.

## Neyi kötü yapıyor?
Aynı ailenin (next-wave motoru) çok daha yeni üyesi TC SIM: DEVLET'in
yanında bu fark can alıcı: DEVLET'te eyebrow + büyük başlık + tagline +
slot kartları var, TC SIM'de hiçbiri yok.

## Production feel
Bu tek ekran, TarikLab'ın "AI ile yapılmış prototip" hissinden en çok
şüphelenilecek yer.

## Bulunan sorunlar

| Priority | Problem | Evidence | Why it matters | Suggested direction |
|---|---|---|---|---|
| P1 | Giriş ekranı çıplak form, sıfır görsel kimlik | `tcsim-01-menu.png` | Katalogdaki en "prototip" hissi veren tek ekran | TC SIM: DEVLET'in giriş şablonuna hizala: eyebrow + başlık + tagline + kart, formu ikinci adıma taşı |

## Oyunun production gibi hissetmesini engelleyen en büyük 3 şey
1. Çıplak form girişi.
2. Diğer next-wave oyunlarıyla tutarsız üretim kalitesi.
3. Bu turda derinlemesine oynanmadı — mekanikler ayrı, çok kapsamlı
   turlarda (Wave 4) zaten test edildi ve kapatıldı.

## Recommended next pass
Giriş ekranını yeniden tasarla; formu "adım 2" yap, önce bir tanıtım
kartı göster.

---

# TC SIM: DEVLET

## Core loop
Bir devleti yönetiyorum, aylık en fazla iki karar veriyorum; bunlar
kurum/ekonomi/toplum göstergelerini değiştiriyor ve hedef 1923-2030
arası devlet sürekliliğini sürdürmek.

## İlk 5 saniye
"4000 YILLIK DEVLET AKLI" eyebrow + büyük başlık + net tagline — güçlü,
tutarlı giriş (`devlet-01-menu.png`).

## Neyi iyi yapıyor?
Görsel kimlik TC SIM'in tam tersi — modern next-wave şablonunu tam
uyguluyor.

## Bulunan sorunlar
Bu turda ciddi bir bulgu yok; bu oyun bu görevin "zaten iyi çalışanı
sırf değişiklik için eleştirme" uyarısına en uygun örneklerden biri.

## Oyunun production gibi hissetmesini engelleyen en büyük 3 şey
Bu oturumda önemli bir engel bulunamadı (menü seviyesinde).

## Recommended next pass
Bu turda oyun içine girilmedi (zaman kısıtı, açıkça belirtiliyor); bir
sonraki pass tam bir dönem simülasyonunu oynamalı.

---

# Son 100 Gün

## Core loop
Ölümüne 100 gün kalmış birini yönetiyorum, ilişki/miras kararları
veriyorum; bunlar geride bırakacağım izi değiştiriyor ve hedef anlamlı
bir kapanış.

## İlk 5 saniye
"ZAMAN DOSYASI" eyebrow, güçlü/grim tagline ("Öleceğini biliyorsun...")
— tema ile giriş ekranı arasında tam uyum (`son100-01-menu.png`).

## Bulunan sorunlar
Bu turda ciddi bir bulgu yok (menü seviyesinde); oyun içi bu turda
derinlemesine oynanmadı.

## Recommended next pass
Bir tam koşuyu (100 gün) oynayıp final/endings çeşitliliğini
değerlendirmek.

---

# SON KÖY MANAGER

## Core loop
Boşalan bir köyü yönetiyorum, yatırımcı/yönetişim kararları veriyorum;
bunlar köy kimliğini ve nüfusu değiştiriyor ve hedef köyü ayakta tutmak.

## İlk 5 saniye
Kimlik güçlü (krem/parşömen, serif başlık) ama giriş ekranının en
üstünde, dış kabukla içerik kartı arasında **amaçsız, boş, gri bir
bant** var — sayfa yeniden yüklendiğinde de tutarlı şekilde tekrar
ediyor (`sonkoy-01-menu.png`, doğrulama: `sonkoy-02-recheck.png`).

## Neyi kötü yapıyor?
Bu boş bant dışında ilk izlenim güçlü.

## Bulunan sorunlar

| Priority | Problem | Evidence | Why it matters | Suggested direction |
|---|---|---|---|---|
| P2 | Giriş ekranında boş gri bant | `sonkoy-01-menu.png`, `sonkoy-02-recheck.png` (iki ayrı yüklemede tekrarlandı) | Kırık/eksik görsel öğe izlenimi veriyor | Bu alanın kaynağını (muhtemelen boş bir hero/banner konteyneri) bul, kaldır veya doldur |

## Oyunun production gibi hissetmesini engelleyen en büyük 3 şey
1. Boş gri bant.
2. Bu turda derinlemesine oynanmadı, ikinci/üçüncü sorun için kanıt yok.

## Recommended next pass
Boş bandın kaynağını incele; bir tam oyunu oynayıp yatırımcı/yönetişim
dengesini değerlendir.

---

# Apartman: Apartman Yöneticisi

## Core loop
Bir apartmanı yönetiyorum, bakım/toplantı/aidat kararları veriyorum;
bunlar bina sağlığını ve sakin güvenini değiştiriyor ve hedef binayı
ayakta ve huzurlu tutmak.

## İlk 5 saniye
Giriş ekranı temiz (`apartman-01-menu.png`); "Bir bina, on altı daire,
bitmeyen meseleler" tagline'ı doğru beklenti kuruyor.

## İlk 1 dakika
"YÖNETİMİ DEVRAL" sonrası ekran zengin: isimli sakinler, güven skorları,
kişilik etiketleri, somut maliyetli/riskli meseleler
(`apartman-03-live.png`).

## Neyi iyi yapıyor?
Bu görevin "manager oyunlarında kararlar gerçek sonuç üretiyor mu"
sorusuna en net "evet" cevaplarından biri — her meselenin 2-3 farklı
çözüm yolu, her sakinin kendi sesi var.

## UI / Visual
Üç sütunlu düzen (bina sağlığı / meseleler / siyaset) net, progress
bar'lar bina sistemlerini iyi özetliyor.

## Save / Continue
Reload sonrası slot ekranı doğru özet gösterdi: "1. hafta · ₺12.000
kasa · 5 açık mesele" (`edge-apartman-after-reload.png`) — returning-
player deneyimi iyi.

## Bulunan sorunlar

| Priority | Problem | Evidence | Why it matters | Suggested direction |
|---|---|---|---|---|
| P3 | Sayfanın en altında bir mesele başlığı sabit alt çubukla kısmen örtüşüyor gibi görünüyor (düşük güven) | `apartman-03-live.png` | Doğrulanmadı, normal scroll-kesimi olabilir | Gerçek cihazda scroll ile doğrula |

## Oyunun production gibi hissetmesini engelleyen en büyük 3 şey
Bu oturumda önemli bir engel bulunamadı — bu oyun bu görevin "iyi
çalışanı eleştirme" uyarısına uyan bir diğer güçlü örnek.

## Recommended next pass
Toplantı gecesi akışını ve haftalar boyunca sakin güveninin gerçek
uzun-vadeli seyrini oyna.

---

# Kayıp Telefon

## Core loop
Bulunmuş bir telefonu inceliyorum, hangi uygulamaları/mesajları
açacağıma karar veriyorum; bunlar mahremiyet baskısını ve kanıt/teori
ağını değiştiriyor ve hedef sahibinin hikâyesini (ve kendi ahlaki
sınırımı) çözmek.

## İlk 5 saniye
"Bu telefon senin değil" — kilit ekranı gerçekçi, premise tek cümlede
net (`kayip-01-menu.png`).

## İlk 1 dakika
Kilidi açınca gerçekçi bir telefon arayüzü: uygulama ızgarası (çoğu
kilitli), MAHREMİYET 0/100 sayacı, VAKA DEFTERİ (KANIT/TEORİ/ZAMAN)
sekmeleri (`kayip-03-unlocked.png`).

## Neyi iyi yapıyor?
Karakter yazımı olağanüstü — her kişi (Leyla/Emre/Ali/Seda/Mert/Naz/
Hakan Bey) gerçek bir yazım sesine sahip, birbirinden ayırt edilebilir.
Her kilitli öğe açılmadan önce "Açmak mahremiyet baskısını artırabilir"
uyarısı veriyor — şeffaf bedel iletişimi.

## UI / Visual
Gerçekçi mesajlaşma balonu tasarımı, kilitli uygulama göstergeleri net.

## Bulunan sorunlar
Bu turda ciddi bir bulgu yok.

## Oyunun production gibi hissetmesini engelleyen en büyük 3 şey
Bu oturumda önemli bir engel bulunamadı — bu katalogdaki en güçlü
atmosfer örneği.

## Recommended next pass
Kanıt/teori bağlama mekaniğini ve 5 sonun erişilebilirliğini fiilen
oynayarak doğrulamak (önceki, çok daha büyük ölçekli Wave 3 turlarında
zaten yapıldı — bu yalnızca "insan gözüyle" tekrar teyit önerisi).

---

# Labirent / Tek Taş / Satranç / Amiral Battı (TLab Classics)

## Core loop (dörtü için özet)
Basit, tek-cümlelik hedefleri olan klasik oyunlar: labirentten çık, tek
taş bırak, şah mat et, filoyu batır.

## İlk 5 saniye
Dördü de sade, işlevsel, iddiasız (`labirent-01.png`, `pegsolitaire-01.png`,
`satranc-01.png`, `amiral-01.png`). Bu kategori için doğru kalibrasyon —
"basit oyun" olmaları bir eksiklik değil, kendi türlerine sadıklar.

## Neyi iyi yapıyor?
- Amiral Battı'nın filo yerleştirme akışı (zorluk/mod/gemi seçimi/
  döndür/otomatik yerleştir) beklenenden daha eksiksiz.
- Labirent'in "EN KISA" istatistiği replayability'ye küçük bir katkı.
- Satranç'ın mod seçim modalı net.

## Neyi kötü yapıyor?
Bu turda ciddi bir bulgu yok.

## Bulunan sorunlar
Bu dört oyun için bu turda P0-P2 seviyesinde bir bulgu yok.

## Oyunun production gibi hissetmesini engelleyen en büyük 3 şey
Bu kategori için "production gibi hissetmeme" sorusu anlamlı değil —
zaten iddiasız, basit oyunlar olarak sunuluyor ve bunu başarıyla
karşılıyorlar.

## Recommended next pass
Mobilde dokunmatik sürükleme (Satranç taş taşıma, Tek Taş atlama)
fiilen parmakla test edilmeli (bu turda yalnızca ekran görüntüsü
seviyesinde incelendi).

---

# Son Mahalle Bükücü

## Core loop
Bir semti "büken" bir simsar yönetiyorum, süre/zorluk/rakip seçip
oyuna giriyorum; hedef ve tam mekanik bu turda derinlemesine
oynanmadı.

## İlk 5 saniye
Giriş ekranı zengin: süre (Kısa/Uzun), Naci zorluk seviyesi (Acemi/
Esnaf/Bükücü), "Naci Bey'e Karşı" ve 2-4 kişilik aynı-cihaz çok
oyunculu modları (`bukucu-01.png`) — bu tek ekranda beklenenden fazla
seçenek var, iyi bir işaret.

## Neyi kötü yapıyor?
- **Mimari kopukluk**: statik dosya olarak sunulduğu için TarikLab'ın
  dış kabuğu (üst siyah çubuk, üstte TR/EN) yok; TR/EN sayfanın en
  altında. Bu, "aynı site" hissini kırıyor.
- Sayfa içi "← OYUNLAR" bağlantısına tıklama bu oturumda gözle görülür
  bir sonuç üretmedi (düşük güven — otomasyon artefaktı olabilir,
  gerçek tıklamayla doğrulanmalı).

## Bulunan sorunlar

| Priority | Problem | Evidence | Why it matters | Suggested direction |
|---|---|---|---|---|
| P2 | Sitenin geri kalanından mimari/görsel kopukluk (dış kabuk yok, TR/EN altta) | `bukucu-01.png` | "Aynı ürün" hissi kırılıyor | Mümkünse bu oyunu da `/oyna/$slug` kabuğuna taşı, ya da en azından TR/EN'i üste al |
| P3 | "← OYUNLAR" tıklamasının etkisi doğrulanamadı (düşük güven) | Bu oturumun log'u | Gerçek bir gezinme sorunu olabilir | Gerçek tarayıcıda elle doğrula |

## Oyunun production gibi hissetmesini engelleyen en büyük 3 şey
1. Mimari kopukluk (dış kabuk yokluğu).
2. Bu turda derinlemesine oynanmadı.

## Recommended next pass
Bu oyunu fiilen oynayıp mekanik derinliğini değerlendirmek; navigasyon
bağlantısını gerçek bir tarayıcıda doğrulamak.

---

# Çete Savaşları

## Core loop
Bir mahalle karakteri yaratıyorum, semt/aksiyon kararları veriyorum;
bunlar racon/nam/para değerlerini değiştiriyor; hedef bu turda
derinlemesine oynanmadı.

## İlk 5 saniye
18+ onay ekranı net, kurgusal-içerik uyarısı dürüst (`cete-01.png`).

## İlk 1 dakika
Karakter oluşturma ekranı güçlü: dört semt (Eyüp/Tarlabaşı/Kadıköy/
Sultangazi), her biri hem atmosferik flavor metin hem de somut,
yüzdelik bir mekanik bonusla tanımlı ("PAVYON VE TOMBALA İŞLERİNDE
BAŞARI +6%") — bu görevin "seçenekler gerçekten farklı mı" sorusuna
net bir "evet".

## Bulunan sorunlar
Bu turda ciddi bir bulgu yok (bu derinlikte).

## Oyunun production gibi hissetmesini engelleyen en büyük 3 şey
Bu oturumda önemli bir engel bulunamadı (karakter oluşturma seviyesinde).

## Recommended next pass
Karakteri fiilen oyuna sokup şehirde gezinme/racon mekaniklerini
oynamak (bu turda zaman kısıtı nedeniyle karakter oluşturmanın ötesine
geçilmedi).

---

# TARIKLAB MASTER PRIORITY LIST

### P0 — hemen
*(Bu turda hiçbir P0 bulunamadı — hiçbir oyun kırık, oynanamaz veya
veri kaybı riski taşır durumda değildi.)*

### P1 — sonraki geliştirme turu
1. Düello ailesinin mobil tahta düzenini (5+5 yuva + faz çubuğu +
   oyuncunun eli) telefon viewport'una göre yeniden düşün — oyuncunun
   eli her zaman görünür/erişilir olmalı.
2. HANEDANIAN'daki üçlü-tekrarlanan onboarding'i tekilleştir.
3. HANEDANIAN'daki kayan bildirimin diğer sekmelerdeki içerikle
   çakışmasını gider.
4. HANEDANIAN'daki çıplak float sayı sızıntısını (İaşe değerleri) formatla.
5. TC SIM'in çıplak-form giriş ekranını yeniden tasarla.

### P2 — polish
1. Global çift-başlık/tekrarlanan-TR-EN-düğmesi desenini (DARBE-H!/
   VETO-H!/GETT-OH!/İhtilâl) HANEDANIAN'ın tek-başlık modeline doğru
   sadeleştir.
2. HANEDANIAN Divan raporundaki "welcome" etiketini yerelleştir.
3. HANEDANIAN'da yükseltme-sonrası üretim önizlemesi ekle.
4. SON KÖY MANAGER'daki boş gri bandı kaldır/doldur.
5. Racon Manager'ın giriş ekranına görsel kimlik kazandır.
6. Bükücü'nün mimari kopukluğunu (dış kabuk yokluğu) azalt.
7. Ana sayfanın masaüstü ızgarasındaki tutarsız kart yüksekliklerini
   düzelt.
8. HANEDANIAN Hanedan sekmesindeki endgame derinliğini aşamalı olarak
   açığa çıkar (progressive disclosure).

### P3 — ileride
1. Bükücü'nün "← OYUNLAR" bağlantısını gerçek cihazda doğrula.
2. Apartman'ın alt çubuk/içerik çakışma şüphesini doğrula.
3. DARBE-H!'in reload-sonrası buton renk artefaktını doğrula.
4. "Apartman: Apartman Yöneticisi" gibi redundant başlıkları sadeleştir.
5. Mobilde 5-kaynak stat şeridinin (HANEDANIAN) satır sarmasını iyileştir.

---

# En fazla değer yaratacak 10 değişiklik

Site genelinde en yüksek ROI'li 10 iş, etki/efor dengesine göre:

1. **Düello ailesinin mobil tahta düzeni** — üç oyunu birden etkileyen,
   tekrarlanan bir sürtünme; tek bir motor-seviyesi düzeltme üç oyunu
   da iyileştirir.
2. **HANEDANIAN onboarding tekilleştirme** — düşük efor, yüksek etki:
   sadece hangi katmanın "birincil" olduğuna karar vermek yeterli.
3. **HANEDANIAN float-sayı formatlama** — çok düşük efor (bir yardımcı
   fonksiyon), yüksek algısal etki (amatörce görünümü tek başına giderir).
4. **TC SIM giriş ekranı yeniden tasarımı** — orta efor, yüksek etki:
   katalogdaki en "prototip" hisli tek ekranı ortadan kaldırır.
5. **Çift başlık/dil düğmesi sadeleştirmesi** — orta efor (birden fazla
   oyunu etkiliyor ama paylaşılan shell bileşeninde tek bir değişiklik
   olabilir), yüksek etki: "iframe hissi"ni doğrudan hedefler.
6. **HANEDANIAN kayan bildirim çakışmasını gider** — düşük efor,
   orta-yüksek etki (görünür bir UI hatasını kapatır).
7. **SON KÖY MANAGER boş bandı kaldır** — çok düşük efor, orta etki
   (görünür, tekrarlanan bir kusuru kapatır).
8. **Racon Manager'a görsel kimlik** — orta efor, orta-yüksek etki
   (katalogdaki en düşük ilk-izlenim skorunu düzeltir).
9. **HANEDANIAN'da yükseltme-sonrası önizleme** — orta efor, orta etki
   (karar netliğini doğrudan iyileştirir, oyunun kendi tasarım diline
   uygun).
10. **Bükücü'yü SPA kabuğuna taşı (veya en azından TR/EN'i üste al)** —
    orta efor, orta etki (bir oyunun "aynı site" hissini geri kazandırır).
