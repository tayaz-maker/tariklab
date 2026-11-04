# SOCIAL ENGINE — GAME_DESIGN.md

**Sürüm:** 1.0 tasarım · **Tarih:** 2026-11-03 · **Ürün:** TarikLab  
**Platform:** Tarayıcı, masaüstü öncelikli, tek oyunculu, 2.5D izometrik.  
**İlk bölge:** Üsküdar'dan esinlenen, coğrafi olarak özgün **Kıyıyaka** mahallesi.

## Ürün ilkeleri ve gerçeklik sınırı

Ciddi suç draması, açık dünya özgürlüğü, sosyal hiyerarşi, nüfuz ekonomisi ve yaşam simülasyonu aynı sistemik dünyada birleşir. Sleeping Dogs, GTA, Bully, Racon Manager, TC SIM ve Boardworld yalnızca kavramsal ilhamdır; hiçbir telifli harita, karakter, görev, arayüz, görsel veya kod kopyalanmaz. Suç, ilerlemek için zorunlu değildir. Oyuncu karakteri yetişkindir (18+).

**Planlanan büyük sürüm:** bir mahalle, 100 yerel aktif NPC kaydı, 1.000 arka plan vatandaşı, 10 meslek, 10 girilebilir mekân, 20 dinamik olay türü, çalışan ekonomi ve ilişkiler, temel sürüş ve dövüş. Bunlar **doğrulanmış kapasite değil hedeflerdir**. 100 NPC aynı anda tam AI kullanmaz: yakında en fazla 25 yüksek ayrıntılı ajan, uzakta 75 düşük frekanslı ajan başlangıç tasarımıdır. 1.000 vatandaş kimlik/ekonomi/sosyal özet taşıyan arka plan simülasyonudur, 1.000 eşzamanlı sprite değildir.

## Ortak teknik kontrat

`EntityId` kalıcı ID; `WorldTick` tam sayı oyun dakikası; `Command{id,actorId,type,args,tick}`; `GameEvent{id,tick,type,actorId,targetId?,payload,schemaVersion}`; `Result{ok,reasonCode,events[]}`. Para kuruş tamsayısı, beceri 0–100, ilişki -100..100. Komutlar doğrulanır, olaylar idempotent uygulanır, RNG dünya seed'iyle deterministiktir. Simülasyon render'dan ayrılır, fizik sabit adımlıdır. Her veri nesnesinde sürüm ve güncelleme tick'i bulunur.

## 1. Kimlik, hedef kitle, ilkeler

**Oyuncu eylemleri:** Yetişkin şehir simülasyonu oyuncusu; yaşam rotası ve zorluk seçimi.

**Oyun kuralları:** Tek oyunculu; suç opsiyonel; özgün sanat; erişilebilirlik ayarları.

**Veri ihtiyaçları:** `GameConfig,Accessibility,ContentRating`; her nesne `id`, `schemaVersion`, `updatedTick` taşır.

**Bağlantılar:** tüm sistemler.

**Test edilebilir kabul:** Üç farklı geçim rotası yedi gün oynanır. Her kriter için normal, sınır ve hatalı giriş senaryosu yazılır.

## 2. Ana döngü ve ilerleme

**Oyuncu eylemleri:** İş, sosyalleşme, keşif, öğrenim, alışveriş.

**Oyun kuralları:** Eylem→sonuç→fırsat; haftalık kira/maaş; para, beceri, güven, nüfuz, hukuki risk ayrı eksenler.

**Veri ihtiyaçları:** `Progress,Unlock,Opportunity`; her nesne `id`, `schemaVersion`, `updatedTick` taşır.

**Bağlantılar:** iş,ekonomi,ilişki.

**Test edilebilir kabul:** Görevsiz 7 gün yaşanır; iki ayrı ilerleme yolu çalışır. Her kriter için normal, sınır ve hatalı giriş senaryosu yazılır.

## 3. Karakter ve beceriler

**Oyuncu eylemleri:** Görünüm, geçmiş, özellik seçimi ve antrenman.

**Oyun kuralları:** Fizik,zihin,sosyal,özdenetim; sürüş,dövüş,iletişim,teknik,ticaret,akademik 0–100; XP günlük tavan.

**Veri ihtiyaçları:** `Profile,Appearance,SkillXP,Perk`; her nesne `id`, `schemaVersion`, `updatedTick` taşır.

**Bağlantılar:** iş,eğitim,dövüş.

**Test edilebilir kabul:** Puan bütçesi aşılamaz; kayıt sonrası beceri eşittir. Her kriter için normal, sınır ve hatalı giriş senaryosu yazılır.

## 4. Hareket, kamera ve kontrol

**Oyuncu eylemleri:** WASD yürüme, Shift koşma, E etkileşim, fare hedefleme, zoom.

**Oyun kuralları:** Yürüme 1.6 m/s, koşma 3.6 m/s; 1.8 m etkileşim ve görüş hattı; kamera sınırı.

**Veri ihtiyaçları:** `Transform,Collider,NavGrid,Camera,InputMap`; her nesne `id`, `schemaVersion`, `updatedTick` taşır.

**Bağlantılar:** dövüş,araç,bina.

**Test edilebilir kabul:** Duvar arkasından etkileşim yok; 100 kapı geçişi sorunsuz. Her kriter için normal, sınır ve hatalı giriş senaryosu yazılır.

## 5. Dövüş, savunma, yaralanma

**Oyuncu eylemleri:** Hafif/ağır saldırı, blok, kaçınma, teslim.

**Oyun kuralları:** Telegraph/aktif/toparlanma; stamina tüketimi; sıfır HP bayılma ve tedavi.

**Veri ihtiyaçları:** `Combat,AttackSpec,Stamina,Injury`; her nesne `id`, `schemaVersion`, `updatedTick` taşır.

**Bağlantılar:** polis,sağlık,ilişki.

**Test edilebilir kabul:** Stamina yetersiz saldırı reddi; 30/60 FPS eş hasar. Her kriter için normal, sınır ve hatalı giriş senaryosu yazılır.

## 6. Araç, trafik, toplu taşıma

**Oyuncu eylemleri:** Araç sürme, kiralama, park, otobüs.

**Oyun kuralları:** Şerit grafı, hız sınırı, çarpışma, park kapasitesi; ücretli duraklar arası otobüs.

**Veri ihtiyaçları:** `Vehicle,RoadGraph,Parking,Transit`; her nesne `id`, `schemaVersion`, `updatedTick` taşır.

**Bağlantılar:** ekonomi,polis,hareket.

**Test edilebilir kabul:** Dolu park reddi; ücret bir kez; trafik kilidi çözülür. Her kriter için normal, sınır ve hatalı giriş senaryosu yazılır.

## 7. Meslek, kariyer, işletme

**Oyuncu eylemleri:** Başvuru, vardiya, terfi, istifa, stok yönetimi.

**Oyun kuralları:** 10 meslek: market,kurye,taksi,garson,tamirci,depo,ofis,güvenlik,eğitim asistanı,satış; saatlik ücret; stok≥0.

**Veri ihtiyaçları:** `Job,Shift,Payroll,Business,Stock`; her nesne `id`, `schemaVersion`, `updatedTick` taşır.

**Bağlantılar:** beceri,ekonomi,zaman.

**Test edilebilir kabul:** 10 işte giriş/çıkış/ödeme; çakışan vardiya reddi. Her kriter için normal, sınır ve hatalı giriş senaryosu yazılır.

## 8. Banka, borç, kira, mülk

**Oyuncu eylemleri:** Kredi, borç, kira sözleşmesi, mülk işlemi.

**Oyun kuralları:** Çift taraflı muhasebe; açık faiz; gecikme uyarısı; fiyat değişim limiti.

**Veri ihtiyaçları:** `Account,Ledger,Loan,Rent,Property,Index`; her nesne `id`, `schemaVersion`, `updatedTick` taşır.

**Bağlantılar:** iş,takvim,adalet.

**Test edilebilir kabul:** 10.000 işlem dengeli; çift tahsilat yok. Her kriter için normal, sınır ve hatalı giriş senaryosu yazılır.

## 9. Arkadaşlık, aşk, aile, evlilik

**Oyuncu eylemleri:** Konuşma, buluşma, yardım, evlilik, ayrılık.

**Oyun kuralları:** Güven/yakınlık/saygı ayrı; romantizm yetişkinler arasında karşılıklı rızaya bağlı; ortak konut/bütçe.

**Veri ihtiyaçları:** `Relationship,Consent,Household,Marriage`; her nesne `id`, `schemaVersion`, `updatedTick` taşır.

**Bağlantılar:** NPC,ekonomi,görev.

**Test edilebilir kabul:** Tek taraflı romantik onay yetmez; güven diyalogu etkiler. Her kriter için normal, sınır ve hatalı giriş senaryosu yazılır.

## 10. Okul, üniversite, hiyerarşi

**Oyuncu eylemleri:** Kurs, üniversite dersi, sertifika, kulüp.

**Oyun kuralları:** Devam, ücret ve önkoşul; çocuk NPC şiddet/romantizm/suç mekaniği dışında.

**Veri ihtiyaçları:** `Course,Enrollment,Attendance,GroupStatus`; her nesne `id`, `schemaVersion`, `updatedTick` taşır.

**Bağlantılar:** beceri,meslek,ilişki.

**Test edilebilir kabul:** Devamsıza belge yok; sertifika iş açar. Her kriter için normal, sınır ve hatalı giriş senaryosu yazılır.

## 11. Çeteler, bölgeler, itibar

**Oyuncu eylemleri:** Fraksiyon anlaşması, arabuluculuk, ayrılık.

**Oyun kuralları:** 3 özgün fraksiyon; bölge etkisi 0–100; sadakat kişisel; ihanet koşula bağlı.

**Veri ihtiyaçları:** `Faction,Territory,Loyalty,Rivalry`; her nesne `id`, `schemaVersion`, `updatedTick` taşır.

**Bağlantılar:** polis,ekonomi,ilişki.

**Test edilebilir kabul:** Etki sınırı korunur; ihanet NPC hafızasına geçer. Her kriter için normal, sınır ve hatalı giriş senaryosu yazılır.

## 12. Polis, suç, delil, adalet

**Oyuncu eylemleri:** İhbar, ifade, kaçış, itiraz, ceza.

**Oyun kuralları:** Suç→tanık/delil→şüphe→arananlık→dosya→sonuç; delilsiz otomatik hüküm yok.

**Veri ihtiyaçları:** `Crime,Evidence,Witness,Wanted,Case`; her nesne `id`, `schemaVersion`, `updatedTick` taşır.

**Bağlantılar:** dövüş,araç,finans.

**Test edilebilir kabul:** Delil zinciri ve kayıt sonrası dosya tutarlılığı. Her kriter için normal, sınır ve hatalı giriş senaryosu yazılır.

## 13. NPC rutinleri, hafıza, karar

**Oyuncu eylemleri:** NPC ile görüşme, randevu, rutin etkileme.

**Oyun kuralları:** 100 yerel kayıt; ≤25 yakın tam AI; 1000 vatandaş soyut katman; önem ağırlıklı hafıza.

**Veri ihtiyaçları:** `Citizen,Schedule,Goal,Memory,Cohort`; her nesne `id`, `schemaVersion`, `updatedTick` taşır.

**Bağlantılar:** tüm simülasyon.

**Test edilebilir kabul:** 100+1000 kayıt; aynı seed aynı sonuç; görünür NPC ışınlanmaz. Her kriter için normal, sınır ve hatalı giriş senaryosu yazılır.

## 14. Dinamik görev ve hikâyeler

**Oyuncu eylemleri:** Olayı kabul/ret, seçim, sonuç.

**Oyun kuralları:** 20 şablon; önkoşul, cooldown, katılımcı rezervasyonu, tekil ödül; ilk sürümde ≤3 aşama.

**Veri ihtiyaçları:** `EventTemplate,Instance,Choice,Effect`; her nesne `id`, `schemaVersion`, `updatedTick` taşır.

**Bağlantılar:** ekonomi,polis,ilişki.

**Test edilebilir kabul:** 20 tür tetiklenir; çift ödül yok; ret soft-lock yapmaz. Her kriter için normal, sınır ve hatalı giriş senaryosu yazılır.

## 15. Telefon, envanter, HUD

**Oyuncu eylemleri:** Harita, mesaj, banka, iş, kişi; eşya taşıma.

**Oyun kuralları:** Slot/ağırlık; benzersiz eşya ID; çatışmada menü zamanı durdurmaz.

**Veri ihtiyaçları:** `PhoneApp,Item,Inventory,Notification`; her nesne `id`, `schemaVersion`, `updatedTick` taşır.

**Bağlantılar:** tüm modüller.

**Test edilebilir kabul:** Eşya çoğalmaz; 1366×768 menü taşmaz. Her kriter için normal, sınır ve hatalı giriş senaryosu yazılır.

## 16. Zaman, hava, yaşam döngüsü

**Oyuncu eylemleri:** Uyku, randevu, hava uyarlaması.

**Oyun kuralları:** 48 gerçek dakika=1 oyun günü; açık/kapalı/yağmur/rüzgâr; 0.5×/1×/2×; yaşlanma ilk sürüm kozmetik.

**Veri ihtiyaçları:** `Clock,Calendar,Weather,Need`; her nesne `id`, `schemaVersion`, `updatedTick` taşır.

**Bağlantılar:** NPC,ekonomi,trafik.

**Test edilebilir kabul:** 30 günlük simülasyonda takvim sapmaz. Her kriter için normal, sınır ve hatalı giriş senaryosu yazılır.

## 17. Mahalle, binalar, iç mekân

**Oyuncu eylemleri:** Sokak gezisi, dükkân/ev/kurum girişi.

**Oyun kuralları:** Kıyıyaka: konut,çarşı,park,sahil; girilebilir ev,market,çayevi,klinik,polis,banka,tamirhane,ofis,kurs,restoran.

**Veri ihtiyaçları:** `District,Building,Portal,Interior,NavLayer`; her nesne `id`, `schemaVersion`, `updatedTick` taşır.

**Bağlantılar:** hareket,NPC,ekonomi.

**Test edilebilir kabul:** 10 mekânda gerçek işlem; tüm yollar bağlı. Her kriter için normal, sınır ve hatalı giriş senaryosu yazılır.

## 18. Kayıt, yükleme, oyun sonu

**Oyuncu eylemleri:** Manuel/otomatik kayıt, yükleme, emeklilik.

**Oyun kuralları:** 3 manuel slot+autosave; atomik yazım, checksum, migrasyon; zorunlu game over yok.

**Veri ihtiyaçları:** `SaveEnvelope,Snapshot,EventCursor`; her nesne `id`, `schemaVersion`, `updatedTick` taşır.

**Bağlantılar:** tüm sistemler.

**Test edilebilir kabul:** Para/ilişki/görev/tick roundtrip eş; bozuk kayıt kurtarılır. Her kriter için normal, sınır ve hatalı giriş senaryosu yazılır.

## 19. Özgürlük ve sistem etkileşimi

**Oyuncu eylemleri:** Yasal, sosyal, suç rotalarını birleştirme.

**Oyun kuralları:** Önemli karar ≥2 sistemi etkiler; olay tekil; asgari geçim kurtarma yolu.

**Veri ihtiyaçları:** `CrossRule,EventBus,Recovery`; her nesne `id`, `schemaVersion`, `updatedTick` taşır.

**Bağlantılar:** tüm modüller.

**Test edilebilir kabul:** Borç+iş kaybı+arananlıkta kurtarma yolu; tekil ödül. Her kriter için normal, sınır ve hatalı giriş senaryosu yazılır.

## 20. İlk sürüm ve sonraki sürümler

**Oyuncu eylemleri:** Vertical slice→alpha→büyük sürüm.

**Oyun kuralları:** Çok mahalle, online, fotogerçekçi 3D, sınırsız AI diyalog, tam hukuk modeli kapsam dışı.

**Veri ihtiyaçları:** `ReleaseGate,Flag,Benchmark`; her nesne `id`, `schemaVersion`, `updatedTick` taşır.

**Bağlantılar:** CI,deploy,QA.

**Test edilebilir kabul:** Gate geçmeden production kabulü yok. Her kriter için normal, sınır ve hatalı giriş senaryosu yazılır.

## 21. Dinamik olay kataloğu

İlk 20 tür: (1) iş ilanı, (2) gecikmiş maaş, (3) işten çıkarma, (4) terfi, (5) kira artışı, (6) kredi vadesi, (7) pazar fiyat şoku, (8) stok açığı, (9) kurye teslimatı, (10) araç arızası, (11) trafik sıkışıklığı, (12) kayıp eşya, (13) komşuya yardım, (14) arkadaş daveti, (15) ilişki anlaşmazlığı, (16) eğitim bursu, (17) mahalle tartışması, (18) tanık ihbarı, (19) polis kontrolü, (20) fraksiyon uzlaşması.

Her `EventTemplate` zorunlu olarak `trigger`, `preconditions`, `cooldownTicks`, `participantRoles`, `requiredLocation`, `choices`, `effects`, `expiryTicks`, `fallback` taşır. Katılımcı/mekân rezervasyonları çakışamaz. Her olay için koşul sağlandı/sağlanmadı, kabul/ret, başarı/başarısızlık, kayıt-yükleme ve tekil ödül testleri yazılır.

## 22. Somut uçtan uca örnekler

**Yasal yükseliş:** Market başvurusu → vardiya → banka maaşı → kira → eğitim → daha iyi iş. Maaş bir kez ödenir; vardiya çakışmaz; eğitim belgesi ön koşulu karşılar.

**Sosyal domino:** Komşuya yardım → güven artışı → iş referansı → gelir artışı. Yardım reddi diğer iş yollarını kapatmaz.

**Suç sonucu:** Sokak kavgası → yaralanma ve tanık → soruşturma → iş devamsızlığı → kira riski → uzlaşma/ceza/iyileşme. Delil olmadan kesin hüküm üretilmez.

**Kriz:** İş kaybı + borç + sağlık sorunu → geçici iş, yardım veya yapılandırma. Kurtarma yolu kalmalıdır.

## 23. Mimari ve ölçüm planı

Önerilen modüller: `simulation-core` (saf TypeScript), `world-data`, `render-client`, `ui`, `persistence` (IndexedDB + dışa/içe aktarım), `tests`. Motor seçimi mevcut depodaki altyapı denetlenmeden kesinleştirilmez. Yakın NPC davranış kararı yaklaşık 2–5 Hz, uzak NPC oyun dakikasında veya olayla, vatandaş kohortları oyun saatinde/gününde güncellenir. Kamera dışı pathfinding kapalıdır. Görünür ajanlar bir anda teleport etmez. Fizik 30/60 Hz sabit adımlı; simülasyon tick'i mantıksal olarak ayrıdır.

**Önerilen ve henüz ölçülmemiş hedefler:** 1080p referans masaüstünde P95 frame ≤33,3 ms; ortalama 60 FPS hedefi; kayıt/yükleme P95 ≤2 sn; 30 dakikalık oturumda çökme 0; 30 günlük hızlı simülasyonda veri invariant ihlali 0. JS gzip, heap ve GPU sınırları gerçek repo ve cihaz baseline ölçülmeden sayılandırılmaz. FPS hedefi tutmazsa önce render LOD, görünür ajan ve animasyon yoğunluğu düşürülür; kalıcı NPC sayısı sessizce azaltılmaz.

**Zorunlu repo incelemesi:** `tayaz-maker/tariklab` main SHA; `/oyna` routing; mevcut oyun motoru, asset pipeline, Boardworld simülasyon/kayıt kodunun yeniden kullanılabilirliği; CI ve browser testleri; bundle gzip, JS parse/execute, heap, GPU, P95 frame; IndexedDB sürüm/migrasyon; staging ve production ayrımı. Her bulgu dosya yolu, commit, ölçüm, cihaz ve yeniden üretim adımlarıyla raporlanır. Bu belge hazırlanırken bu denetimin tamamlandığına dair doğrulanmış kanıt bulunmadığından hiçbir kapasite **DONE** değildir.

**Performans test matrisi:** 100 NPC için 30 dakikalık rutin; 1.000 vatandaşla 30 oyun günü; 10 işte maaş ve istifa; 10 iç mekânda kapı/etkileşim/dönüş; 20 olay türünün tüm dalları; 10.000 muhasebe işlemi; 100 save/load roundtrip; 30/60 FPS dövüş hasarı eşitliği; Chrome/Firefox/Safari masaüstü kontrolleri. Sonuçlar `PASS`, `FAIL`, `BLOCKED`, `DEFERRED` olarak kanıt bağlantısıyla tutulur.

## 24. Teslim aşamaları ve durdurma kapıları

| Aşama | İçerik | Kabul kapısı |
|---|---|---|
| 0: Depo denetimi | SHA, bağımlılıklar, mevcut simülasyon, benchmark | Kod haritası ve ölçüm raporu |
| 1: Vertical slice | 2 sokak, 10 NPC, 2 mekân, 2 iş, 3 olay, kayıt | 1 günlük kesintisiz uçtan uca oyun |
| 2: Alpha | 100 yerel NPC kaydı, ilk 1.000 vatandaş modeli, ekonomi/ilişkiler, sürüş/dövüş | 7 günlük simülasyon ve invariant testleri |
| 3: Büyük sürüm adayı | 10 iş, 10 mekân, 20 olay, polis ve görevler, tam mahalle | Tüm hedef matrisi ve performans kapısı |
| 4: Production | CI, tarayıcı regresyonu, save migration, deploy | Ölçülmüş PASS; sürüm etiketi; geri alma planı |

**Kapsam kontrolü:** Çok mahalle, multiplayer, gerçekçi tam 3D, kapsamlı seslendirme, üretken AI ile sınırsız NPC sohbeti, gerçek dünya İstanbul haritası ve ayrıntılı mahkeme prosedürü ilk büyük sürümün dışındadır. Risk artarsa yeni özellik eklemek yerine simülasyon tutarlılığı, save güvenilirliği ve kare süresi korunur.

## 25. Yazılım ekibine görev parçalama

Her sistem için en az bir `schema.ts`, `rules.ts`, `commands.ts`, `events.ts`, `*.test.ts`, entegrasyon testi ve kullanıcıya görünen hata metni üretilir. Sıra: saat/olay omurgası → hareket ve dünya → ekonomi ve kayıt → NPC → meslek/ilişki → görev → araç/dövüş/polis → UI → performans. Bir PR yalnızca ilgili test, schema migration ve belge güncellemesiyle kabul edilir. Staging'de doğrulanmadan production'a merge/deploy yapılmaz.

**Nihai ürün kararı:** SOCIAL ENGINE, 1.000 vatandaşın hepsini gerçek zamanlı hareket ettiren bir teknoloji gösterisi değil; 100 kalıcı yerel karakterin oyuncuya anlamlı tepki verdiği, arka planda ekonomik ve sosyal süreklilik taşıyan, küçük ama sistemik bir açık dünyadır. Hedef kapasite ancak gerçek tarayıcı ölçümleri ve regresyon testleriyle onaylanır.
