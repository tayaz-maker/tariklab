# E2 — dört temel organ için olgusal kaynak keşfi

**Durum: SOURCE DISCOVERY / NOT REVIEWED / NOT FOR PUBLICATION.** Owner/derleyen: Astra. Branch `astra/anatomy-foundation-source-discovery`; taban `dfbab3f15b74df5336fecf9f7d4247184cbb9222`. Erişim tarihi bütün kayıtlar için **2026-10-05**. Yalnız metinsel olgu doğrulaması yapıldı; atlas uygulaması, içerik yayını, çizim veya anatomik geometri doğrulaması yapılmadı.

Aşağıdaki kaynakların kendi tarihleri, TarikLab içeriğinin uzman incelemesi değildir. Bütün etiket kayıtlarında `reviewer: null`, `reviewedAt: null`, `reviewStatus: not-reviewed`, `releaseEligible: false`; sorumlu `Astra`. Ay hassasiyetindeki kaynak tarihlerine gün uydurulmadı. Erişim tarihi güncelleme tarihi yerine geçirilmedi.

| Organ / source ID | Kurum; görünen sayfa başlığı; kesin URL | Görünen kaynak tarihi | Dar olgu desteği ve yer bulucu |
|---|---|---|---|
| Kalp / `nhlbi-heart-anatomy` | NHLBI / NIH — **How the Heart Works - What the Heart Looks Like** — https://www.nhlbi.nih.gov/health/heart/anatomy | `sourceUpdatedAt: 2022-03-24` (day precision); `sourceReviewedAt: null`: ayrı inceleme tarihi görünmüyor. Tarih sayfanın içerik sonundaki güncelleme satırında. | Ana başlığın altındaki ilk paragraf: göğsün merkezine yakın konum. **Heart chambers** altındaki ilk paragraf: karıncıkların kanı akciğerlere ve diğer vücut bölgelerine göndermesi. Bu okumanın metin konumları 91 ve 94–96; güncelleme 118. |
| Akciğerler / `nhlbi-lungs` | NHLBI / NIH — **How the Lungs Work - The Lungs** — https://www.nhlbi.nih.gov/health/lungs | `sourceUpdatedAt: 2022-03-24` (day precision); `sourceReviewedAt: null`: ayrı inceleme tarihi görünmüyor. Tarih içerik sonundaki güncelleme satırında. | Ana başlığın altındaki ilk iki paragraf: göğüsteki çift organ; oksijenin kana, karbondioksitin kandan akciğerlere geçişi. Metin konumları 92–94; güncelleme 100. |
| Böbrekler / `niddk-kidneys-work` | NIDDK / NIH — **Your Kidneys & How They Work** — https://www.niddk.nih.gov/health-information/kidney-disease/kidneys-how-they-work | `sourceReviewedAt: 2018-06` (month precision); `sourceUpdatedAt: null`: ayrı güncelleme tarihi görünmüyor. Tarih içerik sonundaki kaynak inceleme satırında. | İçindekilerden sonraki ilk iki paragraf: kaburga kafesinin altında omurganın iki yanında konum; atık ve fazla suyun kandan ayrılarak idrarı oluşturması. Metin konumları 165–166; inceleme tarihi 205. |
| Karaciğer / `niddk-digestive-liver` | NIDDK / NIH — **Your Digestive System & How it Works** — https://www.niddk.nih.gov/health-information/digestive-diseases/digestive-system-how-it-works | `sourceReviewedAt: 2017-12` (month precision); `sourceUpdatedAt: null`: ayrı güncelleme tarihi görünmüyor. Tarih içerik sonundaki kaynak inceleme satırında. | Besinlerin küçük parçalara ayrılmasını açıklayan bölümde **Liver.** ile başlayan paragraf: karaciğerin safra üretmesi ve safranın yağ sindirimine yardım etmesi. Metin konumu 473; inceleme tarihi 507. Bu kayıt karaciğerin beden içindeki kesin konumunu destekleyen kaynak olarak kullanılmayacak. |

Metin konumları bu tarihteki araç çıktısının satırlarıdır; kalıcı site satır numarası değildir. Yeniden doğrulamada URL + başlık/paragraf yer bulucusu kullanılmalı. Yalnız bu dar normal anatomi/işlev bölümleri kullanıldı; hastalık, belirti, tanı veya tedavi bölümleri içerik taslağına alınmadı.

## Uzman onayı bekleyen kısa etiket taslakları

Bunlar özgün kısaltılmış anlatımlardır; kaynak cümlelerinin kopyası veya onaylı klinik metin değildir. Her satırın kaynak tarihi ve inceleme durumu yukarıdaki `source ID` kaydına bağlıdır.

| Etiket | English draft | Türkçe taslak | Kaynak / inceleme |
|---|---|---|---|
| Heart / Kalp | The heart lies near the middle of the chest and sends blood to the lungs and the rest of the body. | Kalp göğsün ortasına yakın bulunur; kanı akciğerlere ve vücudun diğer bölgelerine pompalar. | `nhlbi-heart-anatomy`; `not-reviewed`; reviewer `null` |
| Lungs / Akciğerler | The lungs exchange gases in the chest, bringing oxygen into the blood and moving carbon dioxide out for exhalation. | Göğüsteki akciğerler, oksijenin kana geçmesini ve karbondioksitin solukla dışarı atılmasını sağlayan gaz alışverişini yapar. | `nhlbi-lungs`; `not-reviewed`; reviewer `null` |
| Kidneys / Böbrekler | The kidneys sit on either side of the spine below the rib cage and separate waste and excess water from blood to form urine. | Böbrekler kaburgaların altında omurganın iki yanında bulunur; kandaki atıkları ve fazla suyu ayırarak idrarı oluşturur. | `niddk-kidneys-work`; `not-reviewed`; reviewer `null` |
| Liver / Karaciğer | The liver produces bile, a fluid that helps the body digest fats. | Karaciğer, yağların sindirilmesine yardımcı olan safra sıvısını üretir. | `niddk-digestive-liver`; `not-reviewed`; reviewer `null` |

## Açık sınırlar ve sonraki adım

- **İnsan incelemesi gerekli:** bağımsız anatomi uzmanı bu etiketleri, Türkçe terimleri ve sonraki özgün görsel yerleşimleri incelemeden doğrulanmış/anatomik kesin içerik olarak yayımlanamaz. Kaynakların kurumsal incelemesi TarikLab uzman onayı yerine geçmez.
- Bu açıklamalar genel normal yapı/işlev anlatımıdır; bireysel anatomi, sayı, konum ve şekil varyasyonlarını dışlamaz. Çizim ölçüsü, lob/katman geometrisi, kadın/erkek varyantı, damar ağı veya organ sınırı için doğrulama kaydı yok.
- Görsel, screenshot, veri kümesi, 3D model, video, ses ve OpenStax içerik indirilmedi/kullanılmadı. Resmî sayfaya atıf, sayfadaki üçüncü taraf görseller için lisans veya kurum onayı iddiası değildir.
- Foundation anlatımı tam atlas olarak sunulamaz: **“Tam anatomi sistemleri daha sonra ayrı içerik dalgalarında eklenecek.”** Eğitim amaçlı/tıbbi tavsiye değildir notu, kaynak tarihi ve uzman inceleme durumu sonraki UI/offline/test/release kapısında ayrıca doğrulanacak; burada uygulanmış sayılmadı.
- Sonraki owner: Astra içerik şemasına aktarımı ancak ayrı foundation kapsamı açıldığında yapar; bağımsız anatomi uzmanı owner **atanmadı**. Atlas implementation, marka/ad kontrolü ve release bu E2 keşfinin kapsamında değildir.
