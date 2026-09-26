# TC SIM — Değişiklik Kaydı

## Wave 4 — Late-life authored content (65+)

- 65 yaş sonrası authored hayat hikâyesi boşluğu kapatıldı. Yeni zincirler 65–69 / 70–74 / 75–79 / 80+ bantlarına dağılır; emeklilik matematiği, ölüm, miras ve save v6 değişmez.
- Dört yeni exclusive aile: danışmanlık/bırakma, küçült/kal, aileye yaklaş/bağımsız kal, dernek/ev ritmi. Gecikmeli geri dönüşler mevcut `flags.lifeContent.waiting[]` ve actor/job/home context guard üzerinden yürür.
- Emekli oyuncuya işsizlik/statü yemeği callback'i gitmez.

## Wave 4 — Final content integration

- Production event havuzunun organic içeriği aç bırakmasını önleyen altı haftalık deterministic, arc-fair cadence eklendi.
- `flags.lifeContent.waiting` duplicate/corrupt/removed-actor/death/save-load sınırlarında once-only ve bounded hale getirildi.
- 40 seed × 16 strateji × 720 hafta matrisi; 10 arc, 12 exclusive family ve state-growth plateau doğrulamasıyla kalıcı regression testine bağlandı.

## Wave 4 — Maximum content (yaşam olayları)

- Teknik omurga kilitli kaldı. Bu tur yalnızca içerik: `life-content.js` kataloğu mevcut `flags.lifeContent` (`chains` / `exclusive` / `once` / `waiting[]`) üzerinden çok aşamalı zincir, gecikmeli geri dönüş, dışlayıcı dallar ve aktör sesi ekler. Motorun `pendingEffects` tavanı engine yankılarına bırakıldı.
- 128 olay düğümü, 49 zincir, 12 dışlayıcı aile, 18 otomatik gecikmeli geri çağırım, 7 NPC sesi. Organik açılışlar iki haftalık siper ve sıkı koşulla gelir; gecikmeli halkalar kuyruk-only'dir.
- Hayat Dosyası outcome matematiği değişmez. Ölümde additive flavor / iz eklenir (en fazla 10 iz, mevcut outcome id'leri durur).
- Kayıt hâlâ v6. Yeni top-level alan yok.

## Wave 4 — Nedensel yaşam omurgası

- Claude adversarial review entegrasyonunda yaşam haritası commute hesabı canonical konut/iş zone modeliyle eşitlendi, eğitim getirisi ömür boyu tek çalışacak kalıcı işaret aldı ve aynı hafta yinelenen aktör hafızası kapatıldı.
- Eski TC SIM nakit açığı artık ₺-10.000 tabanından sonra en fazla ₺300.000 sınırlı temerrüt borcuna dönüşür. Pozitif nakit oluştuğunda aylık sınırlı geri ödeme yapılır; üst sınırda yaşam standardı ve abonelikler otomatik olarak mütevazı düzene iner.
- Pasif ilişki aşınması rol tabanlarında durur. Aktif aile/sosyal bakım hâlâ zaman, enerji ve para kullanır fakat uzun vadede bütün stratejiler aynı sosyal dipte birleşmez.
- Yabancı oyun payload'ları migration başlamadan TC SIM kimliği ve temel shape kontrolünden geçer; doğrudan `migrateState` çağrısı dahil exception atmadan kapalı reddedilir.
- Mevcut ekonomi, kariyer, eğitim, ilişki, aile, konut, sosyal çevre, statü, beden ve kriz sistemleri on kalıcı yaşam arkında birleştirildi. Arklar tek event değil; momentum, evre, açık risk, fırsat ve sınırlı geçmiş taşıyan süreçlerdir.
- Haftalık kararlar ark hafızasına yazılır. Üst üste mesai, geçmiş arkadaş yardımı, ilişki ihmali ve tamamlanan eğitimin kariyere dönüşü save-safe gecikmeli sonuçlar üretir; aynı sonuç ikinci kez çözülemez.
- Konut/ulaşım, çocuk yükü, borç, eğitim ve nakit birlikte likidite, zaman baskısı ve güvenlik özeti üretir. Orta vadeli hedefler mevcut state'ten türetilir; ayrı görev spam'i veya ödül parası yaratmaz.
- Dashboard'a yaşam evresi, aktif arklar, yaklaşan riskler, ekonomi nedenselliği, hedefler ve geçmiş karar yankısı eklendi. Kritik seçimlerde kısa mali/kariyer/ilişki risk önizlemesi gösterilir.
- Yaşam sonundaki mevcut kuşak raporuna deterministik **HAYAT DOSYASI** eklenir: outcome profili, ark sonuçları, ekonomi, ilişkiler, aile, sağlık, aktör sonuçları, başarı/pişmanlık ve en fazla on nedensel iz.
- Save sürümü **6** oldu. v5 ve daha eski kayıtlar mevcut hayat verileri korunarak nötr arc state'i alır; migration idempotent ve deterministiktir.
- Yeni teknik omurga `life-depth.js` içindedir. İçerik sayısı özellikle sınırlı tutuldu; maximum-content ve karakter sesi genişlemesi sonraki Grok turuna bırakıldı.

## Ebeveynliğe geçiş

- Mevcut çocuk niyeti, açık deneme/bekleme kararı, gebelik haberi, hazırlık ve doğum birbirine bağlandı. Evlilik kendiliğinden gebelik üretmez; temel görüş ayrılığı parayla silinmez.
- Çocuklar ayrı bir oyuncu/NPC simülasyonu değildir. Doğumdan türeyen yaş ve 0–5 dönemleri, bakım zamanı, aylık gider, aile desteği ve konut görüşmeleri mevcut sistemleri kullanır.
- Gebelik ve doğum bilgisi ilgili ebeveynlerde kalır; Anne ancak açık paylaşım yoluyla öğrenir. Bilinen takipler takvimde, önemli sonuçlar yıl dosyasında görünür.
- Ay içinde kullanılan ücretli bakım, düzen değişse bile borç olarak ay sonunda bir kez işlenir. Çocuklar kayıt listesi sınırı nedeniyle silinmez; yeni doğum uygunluğu bakım kapasitesi ve zaman aralığıyla sınırlandırılır.
- Sürüm 5 korunur; eski kayıtlar gebelik, çocuk ve ebeveynlik geçmişi kazanmaz.

## Ayrılık ve ortak niyetler

- Ciddi çözülmemiş gerilim açık ayrılık görüşmesi doğurur. Katkı kesilir; boşanma altı haftalık değerlendirmeden sonra ayrıca seçilir. Eski eş ve ortak geçmiş korunur.
- Barışma zamanın yanında ilişki onarımı ve bağımsız konut gerektirir; aynı evlilikte bir kez mümkündür. Anlık boşanma/yeniden ilişki döngüsü engellenir.
- Çocuk konusundaki niyet görüşmesi ve gecikmeli geri dönüş eklendi. Yanıt mevcut ilişki/bütçe bağlamını okur; farklı niyetler korunur. Gebelik veya çocuk durumu oluşturulmaz.
- Eski ev arama daveti aynı ortak ev planına bağlandı; ayrı yaşayan eşler normal ortak ev davetleri almaz.

## Ortak yaşam ve evlilik

- Tek partner bağlantısı üzerinden birlikte yaşama, ev sorumlulukları, aileye açıklama ve açık evlilik kararı bağlandı. Görüşmeler haftalık zaman kullanır; ertelenebilir.
- Ortak gider katkısı ikinci gelir değildir; konut hesabında ayda bir ve ilk ay birlikte geçirilen haftalara göre uygulanır.
- Önemli kararlar kişi hafızası, geçmiş, takvim ve yıl dosyasında görünür. Açıklama yalnız seçilen kişiye ulaşır.
- Çevre algısının gizli gerçeklerden yeniden yazılması, olumsuz itibar kanıtlarının etkisiz kalması ve kapanan iyiliklerin bekleyen dosyaları düzeltildi.
- Kayıt sürümü 5 korunur; eski kayıtlara partner veya evlilik geçmişi eklenmez.

## Beden sonuçları kabul kapanışı

- Dört sağlık zincirine gerçek gecikmeli sonuçlar, kişiyle sınırlı açıklama, kayıt devamlılığı ve uçtan uca senaryolar bağlandı.
- Haftanın son kararına takılan maruziyet hesabı ve sağlık temizliğinin başka sistemlerin dosyalarını kesmesi düzeltildi.
- Bilinen durum/sonuç, sağlık önceliği değerlendirmesi ve seçilmiş takibin görünürlüğü tamamlandı; gizli riskler arayüze taşınmaz.
- Mevcut uzun koşu aracına dört deterministik beden stratejisi eklendi. Kayıt sürümü 5 korunur; eski kayıtlara sağlık geçmişi üretilmez.

## Çalışan Çekirdek

- Modüler Vanilla HTML/CSS/JavaScript oyun iskeleti oluşturuldu.
- Yeni oyun, başlangıç profili, haftalık iki aktivite sınırı ve 4×12 zaman modeli eklendi.
- Para, beden, ilişkiler, NPC hafızası, flag, koşullu event ve gecikmiş sonuç akışları çalıştırıldı.
- Ay sonu finansı, yaş artışı ve temel yıl dosyası eklendi.
- Sürümlü doğrulama, migration, yedek/recovery ve güvenli hata davranışı olan localStorage kaydı eklendi.
- Çekirdek davranış testleri ve üç yıllık deterministik simulasyon eklendi.
- Oyun TarikLab kataloğuna `/oyna/tc-sim` adresiyle bağlandı.

## Yönetim arayüzü düzeni

- Ana ekran; kompakt üst bilgi şeridi, pasif bölüm navigasyonu ve yoğun hayat dashboard'u olarak düzenlendi.

## Aşama 3A — İş + Konut

- Üç prototip iş ve konut; türetilmiş ulaşım/haftalık hayat yükü ve aylık finans zincirine bağlandı.
- Gecikmeli iş başlangıcı, maliyetli atomik taşınma, işten ayrılma ve beş koşullu iş/konut olayı eklendi.
- Save sürümü 2'ye çıkarıldı; eski çekirdek kayıtları para ve geçmiş korunarak migrate ediliyor.
- İŞ ve EV yönetim ekranları ile 3A davranış/regression testleri eklendi.

## Aşama 3B — Eğitim + Kariyer Temeli

- `education` (seviye, alanlar, aktif program, aylık eğitim borcu) ve `career.jobFamilyExperience` state'e eklendi.
- İki eğitim yolu (mesleki kurs, üniversite) tam/yarı zamanlı yoğunlukla; tam sayı puan ilerlemesiyle çalışıyor.
- Diploma ödülü haftalık tick içinde deterministik veriliyor; event yalnız bildirim olduğu için ertelense de kaybolmuyor.
- Eğitim kaydı/bırakması haftalık karar hakkı tüketmiyor; haftalık enerji/stres yükü mevcut hayat yükü hesabına giriyor.
- Kayıt ücreti peşin, aylık eğitim ücreti ay sonunda tam bir kez; eğitimi bırakmak o ayın borcunu silmiyor.
- İş ailesi (`hizmet`, `ofis`), haftalık deneyim birikimi ve türetilen kariyer bandı eklendi.
- Eğitim/alan/deneyim gereksinimi olan iki yeni iş eklendi; mevcut üç giriş işi gereksinimsiz kaldığı için eski kayıtlar kilitlenmiyor.
- Tek merkezî uygunluk kontrolü teklif kabulünde, event koşullarında ve arayüzde ortak kullanılıyor.
- Save sürümü 4'e çıkarıldı; v3 kayıtlar iş, para, konut, NPC, hafıza, açık dosya ve dönem korunarak taşınıyor, bozuk alanlar kaydı çöpe atmadan onarılıyor.
- EĞİTİM ekranı ile İŞ ekranına deneyim/bant/gereksinim gösterimi eklendi; 34 yeni test ve üç deterministik 144 haftalık senaryo eklendi.

## Aşama 3C — Sosyal Çevre + İlişkiler Temeli

- Mevcut Aylin, Murat, Mehmet ve Elif kayıtları yakınlık, güven, gerilim, son temas, rol/tag ve sınırlı NPC hafızasıyla genişletildi.
- Türetilen ilişki evreleri, altı bağlamsal sosyal eylem ve haftalık iki karar ekonomisine bağlı sosyal maliyetler eklendi.
- Kontrollü ilişki bakımı, sosyal davet, yardım sözü/openCase, gerilim konuşması ve açık romantik ilgi → sevgili yolu eklendi.
- Aile romantizmi ve birden fazla partner doğrulama seviyesinde engellendi.
- KİŞİLER ve AİLE/İLİŞKİLER ekranları etkinleştirildi; dashboard'a küçük sosyal özet eklendi.
- Save sürümü 5'e çıkarıldı; v4 kayıtları eski NPC puanları ve hafızaları korunarak taşınıyor.
- Deploy sırasında eski/yeni modül karışmasını önlemek için runtime importlarına v5 cache anahtarı eklendi.
- 28 yeni davranış testi ile sosyal eylem içeren 144/520 haftalık ve 20 seed fuzz doğrulaması eklendi.

## Aşama 3D — İçerik temeli (yalnız belge)

- Sosyal hayat araştırma paketi `docs/tc-sim/` altına kondu (kütüphane, zincir, dil, araştırma notu).
- Gerçek 3C motora göre 24 olay + 5 gecikmeli zincir seçildi.
- 3D uygulama notları: `TC_SIM_3D_POST_IMPLEMENTATION.md`.
- Runtime, save v5 ve 111 test bu kayıtta değişmedi.

## Aşama 3D — Sosyal İçerik + Hafıza + Gecikmeli Sonuçlar (runtime)

- Seçilmiş 24 bağımsız sosyal event (arkadaşlık, romantik/Elif, aile, para, görünürlük, yetişkin hayat 4'er) `events.js`'e eklendi.
- 5 gecikmeli üç adımlı zincir eklendi: CHN-01 (kişisel borç → görünürlük → yüzleşme), CHN-03 (referans sözü → sonuç → karşılık, sade), CHN-08 (yetişkin ilişki → ertesi gün → sonlu korku çözümü), CHN-09 (düğün altını → ay sonu → karşılık), CHN-10 (saklanan gece → sır sorgusu → sızma).
- Üç motor eklentisi: `scheduleSocialFollowup` (mevcut openCases mimarisini sarar), `personal-debt` openCase türü (kişiye özel, mevcut sabit 1500 TL `loan_repayment` davranışından ayrı), `hasNpcMemory(state, personId, type)`.
- Görünürlük/yetişkin bağlamı yalnız mevcut `flags` mimarisiyle temsil edildi; yeni NPC, rol, tag veya kişilik state'i eklenmedi.
- Organik aramada haftada en fazla bir yeni 3D olay aktifleşecek şekilde yoğunluk siperi güçlendirildi (`flags.lastSocial3DWeek` + `flags.lastEventResolvedWeek`).
- Dashboard "AÇIK MESELELER" panelinin sabit etiket eşlemesi yeni case türlerini (`personal-debt`, `social-followup`) tanıyacak şekilde genişletildi; başka arayüz değişikliği yapılmadı.
- Save sürümü değişmedi (**hâlâ 5**); `migrateV4()`'e dokunulmadı, v6 yok.
- 24 yeni davranış/bütünleşik senaryo testiyle (`scripts/tc-sim-3d.test.mjs`) toplam 135 test yeşil; 144/520 hafta ve 20 seed × 260 hafta fuzz koşuları ile gerçek tarayıcı smoke testi geçti. Ayrıntı: `TC_SIM_3D_POST_IMPLEMENTATION.md`.

## Historical starts — PR A

- TC SIM kept its existing Günümüz path and added the fixed 18 April 1999 and seeded 1980s life routes, each ending on 1 January 2026.
- Added deterministic scenario event order, six life choices, one-year delayed effects and a final life outcome; pending effects are summarized at the endpoint.
- Kept the `tc-sim-save` key and added a legacy-load assertion for present-day saves without historical scenario state.
- Added inline institutional citations for each factual historical/economic event; uncited dated cards are explicitly fictional life decisions.
- Added CI Chromium coverage for 1440/390/320 px, all three starts, decision persistence/reload and historical final screens.
- Technical frame: `outputs/TARIKLAB_LUNA_TC_SIM_HISTORICAL_STARTS.md`.
