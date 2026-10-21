# TC SIM — FAZ 0 MASTER GAMEPLAY AUDIT

**Tarih:** 21 Ekim 2026 (Türkiye)  
**Repo:** `tayaz-maker/tariklab`  
**İncelenen ve GitHub main ile doğrulanan SHA:** `243d636485be382811ab8ef33329e57119dafb5d`  
**Oyun:** `/oyna/tc-sim`  
**Teslim türü:** Denetim ve uygulama planı; ürün değişikliği değildir.

## 1. Karar özeti

TC SIM'de finans, şehir/konut, kariyer, aile, NPC hafızası ve yaşam sonu omurgası zaten bulunuyor. İki eski analizdeki genel sistem kurma önerilerini yeniden uygulamak mükerrer iş olur. Bu denetimde ilerlemeyi durduran doğrulanmış bir **P0 bulunmadı**. Bu ifade yalnız incelenen kod ve çalıştırılan senaryolar içindir.

En güçlü P1 bulguları: **eğitim hedefinin gerçek ilerlemeden kopması; içerik hedefinin yenilemede silinmesi ve depozito birikimi vaadinin karşılıksız kalması; seçilebilir yıllık öncelik ile haftalık hedefin ayrık olması; bazı olayların yeni yaşam bağlamı olmadan ömür boyunca tekrarlanması; NPC gelişmelerinin kimlik/görünürlük köprüsü ile belirli ailede rotasyon hatası.** Bunlar aşağıdaki beş küçük pakete sığar. Yeni bankacılık, yeni mortgage, yeni harita, yeni ekran veya devasa olay üretimi gerekmez.

16 senaryo × 960 karar haftası = **15.360 hafta** ölçüldü. Aynı karakterin tekrar koşusu ve alternatif tercihler koşusu ile toplam **17.280 hafta** çalıştırıldı. Oyunun yılı 48 karar haftasıdır; 5/10/20 yıl karşılıkları **240/480/960** haftadır. Son tarih bütün 20 yıllık normal koşularda 1 Ocak 2047 oldu; tarihsel senaryonun 2030 bitişi, yirmi yıllık serbest oyun diye zorlanmadı.

### 1.1 Kaynak bütünlüğü ve sınırlar

- `AGENTS.md` ve `AGENTS.project.md` okundu. Görev bir denetim olduğu için scaffolding, startup/deploy, görsel üretim ve ürün kodu düzenlemesi yapılmadı. Audio/native işi yok. Ürün değişmediğinden web/native sync ledger eklenmedi.
- Güncel TC SIM modülleri, katalog, 21 route, mevcut testler, `docs/tc-sim/` sistem/kalite/finans/handoff kayıtları ve son TC commit geçmişi incelendi. Tarihî raporlardaki “4 NPC”, “iki haftalık hak”, “V5” ve “16 ekran” ifadeleri güncel gerçek kabul edilmedi.
- İki ek doğrudan sağlanan yerel kopyalarından okundu. **Birinci belge `## 10.` başlığında, ikinci belge `- İşlet` satırında kesiliyor.** Eksik devam metni uydurulmadı. Ek A, teslim edilen 365 tam maddeyi tek tek sınıflandırır; yarım `İşlet` ifadesi sınıflandırılmış tam öneri sayısına dahil değildir.
- Yeni Chromium kurulumu geçerli arşiv sağlayamadı. Bu nedenle **bu SHA üzerinde yeni gerçek tarayıcı/viewport veya fiziksel cihaz kabulü iddia edilmiyor**. Gerçek uygulama render/handler testleri çalıştırıldı; üç kaynak harita görsel olarak incelendi. Eski browser PASS kayıtları yalnız tarihî kanıttır. Çizim/menü yeniden tasarlamak için gerekçe çıkmadı.
- Tam CI, lint/build, production exact-main, Cloudflare ve Vercel kabulü bu fazın işi değildir; çalıştırılmış gibi gösterilmedi. Önceki geniş denemeler pahalı eski matrislere girdiğinde durduruldu; sonuçları yeşil tam koşu diye sunulmadı. Nihai kapsamlı TC koşusu ağır beş matris başlığı dışarıda bırakılarak ayrıca kaydedildi.

### 1.2 Kaynak dosyaların parmak izi

| Ek | Bayt | SHA-256 | Son teslim edilen ifade |
| --- | --- | --- | --- |
| Yapıştırılan metin (2).txt | 14026 | c985470abde8f184af3c2cea96f8d961eace4d811e510301bfe6e74ff18c24a1 | - İşlet |
| Yapıştırılan metin(20261021-171817).txt | 14612 | 53ad13126cfdfd9e2412a89dfc2ca4b4c39a6b73295a72b354a219f82a283992 | ## 10. |

## 2. Mevcut sistem envanteri

`public/games/tc-sim/js/` aşağıdaki kısa dosya adlarının köküdür; testlerin kökü `scripts/`tir. Kanıt kimlikleri hem ana değerlendirmede hem madde matrisinde aynı somut kaynak/teste bağlanır.

| Alan | Güncel sayı / işlev | Kanıt |
| --- | --- | --- |
| Ekranlar | 21 route; aynı lacivert/altın shell; Hedefler ve Zaman/Odak ayrı mevcut route | E01 |
| Karakter | 3 profil; aile/ekonomi/eğitim/sosyal arka plan; 4 aile tipi; 3 sosyal ağ modu; serbest Günümüz ve tarihsel başlangıç | E02 |
| Zaman/odak | 48 karar tanımı; normal kapasite 8, iş/eğitim/çocuk taahhüdünde 7, kritik sağlıkta 3. Eski iki-hak dokümanları güncel değil | state.js:getWeeklyActivityLimit; E15 |
| Kariyer/eğitim | 58 iş, 14 iş ailesi; 18 eğitim programı; gecikmeli işe giriş/terfi/iş kaybı | E06 |
| Yaşam arkları | 10 ark; durumdan türeyen 5 olası hedef türü; 6 yıllık öncelikten en çok 2 seçim | E03 |
| Olaylar | 433 benzersiz ID; 919 tercih; 65 life-content zinciri; 16 dışlayıcı dal ailesi | E04 |
| Sosyal ağ | 7 çekirdek slot + 41 ek cast tanımı; hepsi her başlangıçta yüklenmez (nuclear/tight: toplam 8 kişi) | E05 |
| Aile | Partner, evlilik/birlikte yaşam, ayrılık, çocuk/bakım/okul/yetişkin çocuk | E10 |
| Finans | Çoklu banka ve kartlar; mortgage/icra/itiraz/tahsilat; varlık ve net servet; işletme/çalışan; yatırım | E07/E08/E12 |
| Şehir | İstanbul 8 + Ankara 8 + İzmir 7 = 23 güncel bölge; legacy konum kimlikleri korunur | E09 |
| Hikâye/yaş | Yıllık dosya, kişi anıları, kariyer/hane kayıtları, yaş/emeklilik/ölüm/miras/kuşak/çok eksenli hayat dosyası | E13 |
| Geri bildirim | Hafta farkı, bilinen dosya ve kalan hak, ay kapanış kartı, işlem defteri, maliyet/gate ve kayıt hataları | E14/E15/E16 |

### 2.1 Kanıt ve test dizini

| Kimlik | Alan | Dosya ve fonksiyon | Mevcut test / bu tur kanıtı | Somut kapsam ve sınır |
| --- | --- | --- | --- | --- |
| E01 | Ekran ve tasarım | navigation.js:NAVIGATION_ITEMS; app.js:renderers/renderDashboard; ui-shell.js; ui-shell.css; docs/TC_SIM_MENU_INVENTORY.md | tc-sim-menu.test.mjs; tc-sim-screens.test.mjs; tc-sim-responsive.test.mjs; tc-sim-lifetime-ui.test.mjs | 21 canonical route; gerçek render/handler testleri; 21 ekran geometrisi bu tur Chromium ile yeniden ölçülmedi. |
| E02 | Başlangıç | state.js:profileSettings/createNewGame/BACKGROUND_OPTIONS; network.js:resolveFamilyType/resolveNetworkMode/applyFamilyStartFlags; historical-scenarios.js:createScenario | tc-sim-core.test.mjs; tc-sim-real-life-expansion.test.mjs; tc-sim-core-integration.test.mjs | 3 temel profil; ekonomik başlangıç farkı -1000/0/+1000; 4 aile tipi, sosyal ağ ve tarihsel başlangıçlar. Altı yeni hayat presetinin tamamlandığı iddia edilmiyor. |
| E03 | Hedef ve karar ağı | life-depth.js:deriveGoals/refreshLifeArcs; decision-network.js:currentGoal/PAYOFF/processDecisionNetworkWeek; state.js:setYearlyPriorities; app.js:renderProfile/renderDashboard("goals") | tc-sim-decision-network.test.mjs; wave4-tc-sim-life-depth.test.mjs; audit focused.json / focused-extra.json | Hedef omurgası var; eğitim alanı hatası, silinen içerik hedefi ve seçilen yıllık öncelikten bağımsız currentGoal bu denetimde yeniden üretildi. |
| E04 | Olay seçimi ve tekrar | events.js:EVENT_DEFINITIONS/isEligible/activateNextEvent/resolveEvent; life-content.js:pickLifeContentOrganic/shouldOfferLifeContent/takeDueLifeContent | tc-sim-3d.test.mjs; tc-sim-life-echo.test.mjs; wave4-tc-sim-content.test.mjs; audit probe.mjs/results.json | 433 ID, 919 seçim; once/cooldown ve altı haftalık organik cadence var. 16×960 haftada bağlamsız tekrarlar gözlendi; yeni büyük havuz önerilmiyor. |
| E05 | NPC hafızası ve sosyal sonuç | social.js:applySocialAction/hasNpcMemory/scheduleSocialFollowup; state.js:addNpcMemory; depth2-systems.js; depth3-systems.js:recordNpcMilestone/markNpcMilestoneKnown; network.js:processNetworkWeek | tc-sim-3c.test.mjs; tc-sim-3d.test.mjs; tc-sim-depth-3.test.mjs; tc-sim-promise-reputation.test.mjs; audit focused-extra.json | Yakınlık/güven/gerilim, sır, iyilik, referans ve gecikmeli sonuçlar var; network milestone ID köprüsü ve single/tight NPC rotasyonu kusurlu. |
| E06 | Kariyer ve eğitim | catalog.js:JOBS; education.js:EDUCATION_PATHS/isEligibleForJob/getEducationProgress; life.js:acceptJobOffer/completePendingJob/promoteCareer/endEmployment/updateCareerProgress | tc-sim-3b.test.mjs; tc-sim-core18-35.test.mjs; tc-sim-partner-workplace.test.mjs; tc-sim-work-recovery.test.mjs | 58 iş/14 aile, 18 eğitim yolu; teklif→gecikmeli başlangıç, terfi, iş kaybı, deneyim ve yük farkları var. Tam mülakat/maaş pazarlığı motoru tamamlanmış sayılmıyor. |
| E07 | Banka ve kredi | bank-actions.js; bank-accounts.js:bankTotals/bankPost; bank-cards.js; bank-business.js:creditAvailability/takeCredit/repayCredit; bank-record.js; bank-ui.js | tc-sim-2-banking.test.mjs; tc-sim-bank-record.test.mjs; tc-sim-credit-policy.test.mjs; tc-sim-finance-acceptance.test.mjs | Çoklu banka, hesap/kart/transfer, kredi uygunluğu, tutarlı kayıt ve erken ödeme var; yeniden yazılmayacak. |
| E08 | Konut, mortgage, icra ve servet | mortgage.js; icra.js; wealth.js:netWorth; quarters.js:buyHolding/rentToLive/sellHolding; app.js:renderHome | tc-sim-housing-net-worth.test.mjs; tc-sim-mortgage.test.mjs; tc-sim-mortgage-enforcement.test.mjs; tc-sim-icra.test.mjs; tc-sim-court-evidence.test.mjs | Ev/borç tek sayım, peşinat/taksit/erken kapama, haciz, mahkeme/itiraz ve tahsilat oyun modeli mevcut; tam gerçek hukuk simülasyonu iddiası yok. |
| E09 | Şehir, semt ve harita | locations.js:districtProfile/locationCommute/locationCosts/locationJobDelay/socialTravel/locationMoveQuote; region-data.js; region-map.js:renderRegionMap; quarters.js:regionalShopTerms | tc-sim-2-regions.test.mjs; tc-sim-city-life.test.mjs; tc-sim-district-risk.test.mjs; tc-sim-map-visual.test.mjs | 3 şehir ve 23 güncel bölge; kira, ulaşım, sektör, müşteri, aile ziyareti ve risk farkları var. Üç kaynak WebP bu tur gözle incelendi; koordinatlar ölçeksiz illüstrasyondur. |
| E10 | Aile, partner ve çocuk | events.js:requestHouseholdConversation; household.js:resolveHouseholdChoice/getHouseholdSummary; parenthood.js:canTryParenthood/processParenthoodWeek/resolveParentChoice; wedding-planning.js; partner-workplace.js | tc-sim-household.test.mjs; tc-sim-parenthood.test.mjs; tc-sim-child-6-17.test.mjs; tc-sim-marriage-depth.test.mjs | Partner, birlikte yaşam, evlilik, ayrılık, niyet farklılığı, çocuk ve bakım var; 20 yıllık aile senaryosu gerçek kararlarla bir çocuk doğurdu. |
| E11 | Riskli/yasa dışı yaşam | risk-layer.js:RISK_DECISIONS/processRiskWeek/startRiskDisengagement; criminal-justice.js; askerlik.js | tc-sim-risk-layer.test.mjs; tc-sim-criminal-justice.test.mjs; tc-sim-risk-disengagement.test.mjs; tc-sim-sentence-reentry.test.mjs | Sağlık/nakit/ısı/gözaltı/ceza/işe dönüş ve 13 haftalık uzaklaşma sonucu var; yeni suç örgütü simülasyonu gerekçelendirilmedi. |
| E12 | Ekonomi, işletme ve yaşam standardı | wealth.js:LIFESTYLE_TIERS/processCashShortfall; period-economy.js; exchange.js; bank-business.js:startBusiness/manageBusiness/processBusinessMonth; quarters.js:openShop/processSemtWeek | tc-sim-balance-final.test.mjs; tc-sim-bank-business.test.mjs; tc-sim-exchange-growth.test.mjs; tc-sim-semt-emlak.test.mjs; tc-sim-period-economy.test.mjs | Enflasyon/dönem, varlık/yatırım, tüketim, küçük işletme ve çalışan/büyüme var. Birden çok büyük işletme/ayrı rekabet motoru uygulanmış sayılmıyor. |
| E13 | Yaş, yaşam hikâyesi ve son rapor | state.js:addMemory/addCareerHistory/LIMITS; time.js:closeYear/reflectYearPriorities; lifetime.js:processLifetimeWeek/finishLife/estateSnapshot/continueGeneration; life-depth.js:buildLifeDossier | tc-sim-lifetime.test.mjs; tc-sim-late-life.test.mjs; tc-sim-lifetime-ui.test.mjs; tc-sim-child-6-17.test.mjs | Yaşlanma/emeklilik/ölüm/tereke/kuşak ve para dışı sonuçlar mevcut. Sınırlı bellek bütün ilkleri sonsuza dek saklayan arşiv değildir. |
| E14 | Haftalık/aylık geri bildirim | weekly-feedback.js:snapshotWeekState/summarizeWeek; monthly-cash.js:beginMonthlyCash/closeMonthlyCash/renderMonthlyCashCard; state.js:transact; app.js:renderDashboard/renderFinance/advance handler | tc-sim-weekly-feedback.test.mjs; tc-sim-monthly-cash.test.mjs; tc-sim-choice-summary.test.mjs; tc-sim-finance-acceptance.test.mjs | Haftalık değişim, yaklaşan dosyalar/kalan hak, muhasebeli ay kartı, servet farkı ve tek işlem defteri var. Açılış borcu/farkı ve aylık anlatı listesi ayrı tamamlanmış sayılmıyor. |
| E15 | Maliyet, kilit nedeni, işlem sonucu | time.js:canApplyDecision/applyDecision; events.js:getEventChoiceAvailability/getChoiceEffectSummary; bank-actions.js; wealth.js:marketPreview; app.js:presentDecision | tc-sim-choice-summary.test.mjs; tc-sim-job-start-outcome.test.mjs; tc-sim-lifetime-ui.test.mjs; tc-sim-2-ux.test.mjs | Genel maliyet/gate/sonuç altyapısı var; her hikâye vaadinin gerçek sonuç olduğu varsayılamaz (B01/B02). |
| E16 | Kayıt ve eski sürümler | save.js:saveGame/loadGame/migrateState/deserializeState; state.js:SAVE_VERSION/normalizeEducationCareer; app.js:persist | tc-sim-core.test.mjs; tc-sim-hardening.test.mjs; tc-sim-lifetime-ui.test.mjs; tc-sim-housing-net-worth.test.mjs | V5/V6 additive normalizasyon, 3 slot/yedek, hata bildirimi ve doğrulama var; 16 koşuda 320 kayıt/yükleme turu geçti. |
| E17 | Rehber ve dil | help.js; gameplay-language.js; public/i18n/tc-sim.js; app.js:startScreen/render/persist | tc-sim-help.test.mjs; tc-sim-gameplay-language.test.mjs; tc-sim-language-qa.test.mjs; tc-sim-dictionary-source.test.mjs | Atlanabilir giriş ve yardım mevcut; tam bağlamsal öğretici ayrı opsiyonel iş. Test edilen TR/EN/PL overlay kopyaları doğrulanır; bütün 919 tercihin insan çeviri QA’sı iddia edilmez. |
| E18 | Koruma/erteleme | Kullanıcının bu görevdeki kesin koruma kararları; AGENTS.project.md; docs/TC_SIM_MENU_INVENTORY.md; docs/tc-sim/FINAL_QUALITY_AUDIT_2026-10-21.md | Uygulama testi gerekmez; iş bu fazda yapılmaz. E01/E09/E16 mevcut kontrat testleridir. | 21 ekran/menü/boyut sabit; ürün kodu, başka oyunlar, CI/Cloudflare/deploy değişmez. Belirsiz veya düşük faydalı istek D’ye alınır; yok/var diye kanıtsız hüküm kurulmaz. |

### 2.2 Korunan 21 ekran

`dashboard`, `inbox`, `character`, `calendar`, `finance`, `banks`, `emlak`, `market`, `career`, `education`, `people`, `relationships`, `home`, `city`, `decisions`, `goals`, `saves`, `settings`, `body`, `history`, `yearbook`.

`navigation.js:NAVIGATION_ITEMS` ve `scripts/tc-sim-menu-contract.mjs:ownership` kanonik sınırdır. `emlak` ID'si araç/eşyayı, `home` konut ve mortgage'ı taşır. Eski belgelerin Bankalar içinde yeniden bütün para ekranlarını toplama önerisi bu sözleşmeyi geçersiz kılamaz.

## 3. Tamamlanmış: yeniden yapılmayacak işler (A)

1. Banka/kredi/kart/erken ödeme/mortgage/icra ile evin net servete tek kez katılması: E07/E08. “Ev net servete eklenmeli” yeni iş değildir.
2. Üç harita, 23 adlandırılmış bölge, ulaşım/kira/risk/sektör/müşteri/aile ziyareti farkı: E09. “Ankara/İzmir'e 2–3 pin ekle” eski ve mükerrerdir.
3. İş teklifi, beklemeli başlangıç, eğitim/alan/deneyim kapısı, performans/terfi/iş kaybı: E06. Meslekler yalnız maaşla ayrışmıyor; yük, enerji/stres, zone/sektör, probation ve gereksinimler de farklı.
4. NPC yakınlık/güven/gerilim, anı, sır, iyilik, referans ve gecikmeli sosyal sonuçların temeli: E05. Komple ilişki motoru gerekmez; B05 bağlantı kusurunu düzeltmek yeterli.
5. Partner/birlikte yaşama/evlilik/ayrılık/çocuk/bakım/yetişkin çocuk: E10. Bunlar yeni özellik diye planlanmayacak.
6. Riskli/yasa dışı kararların sağlık, para, aile, gözaltı/ceza/işten uzaklaşma/geri dönüş sonuçları ve suçtan uzaklaşma: E11. “Yasa dışı hayat yalnız para veriyor” genellemesi doğru değil.
7. Hafta geri bildirimi, ay kapanış kartı, nakit/banka akışları, net servet farkı ve işlem gerekçesi: E14. Yeni bir özet ekranı/ikinci muhasebe defteri yok.
8. Kayıt/yükleme/yedek/slot/hata bildirimi ve V5/V6 uyumluluğu: E16. Yeni save motoru veya sebepsiz V7 yok.
9. Emeklilik, deterministik yaşam sonu, varlık/borçla tereke, yetişkin çocukla kuşak devamı ve ekonomik olmayan hayat sonucu: E13. Başarı yalnız para değil; `buildLifeDossier` yalnız, güçlü bağları olan, tükenmiş ve dengeli hayatları ayırıyor.
10. Kompakt ortak tasarımın kaynak sözleşmesi, menülerin kanonik ayrımı, gereksiz eski harita galerisi/çift defterin kaldırılması: E01. Bu fazda yeni görsel değişiklik gerektirmez; güncel gerçek tarayıcı ölçümünün yapılamamış olması da yeniden tasarım gerekçesi değildir.

## 4. Kısmen tamamlanmış işler ve doğrulanmış P1 bulguları (B)

### B01 — Eğitim hedefi ve odak ödülü gerçek eğitimden kopuk (P1)

**Mevcut:** `life.js:updateEducationProgress` puanı `active.progressPoints` ile artırır. `education.js:getEducationProgress` bunu `path.targetPoints` üzerinden yüzdeye çevirir. Buna karşılık `life-depth.js:deriveGoals` ve eğitim arkı `active.progress` okur; `decision-network.js:PAYOFF.education` yine bu ayrı alanı yazar.

**Yeniden üretim:** Üniversite 156/312 puanda (%50) iken hedef %0. Eğitim odağına üç hafta ayrılan birim senaryosunda “eğitimi hızlandırdı” mesajı yazıldı, `progress=4` oldu, ama `progressPoints=156`, gerçek yüzde=%50 ve kalan süre=78 hafta değişmedi. Bu yalnız bir etiket sorunu değil; vaat edilen sonuç canonical ilerlemeye bağlanmamış. `focused.json:payoff` tam önce/sonra verisidir. Mevcut `tc-sim-decision-network.test.mjs` kariyer odağı ödülünü sınar; bu çapraz alan uyuşmazlığını kapsamıyor.

**Oyuncuya etkisi:** Eğitim ekranı ile Hedefler çelişir; en düşük ilerlemeyi seçen otomatik hedef, eğitimde takılabilir; hızlanma geri bildirimi gerçekte gerçekleşmez.

**En küçük güvenli çözüm:** Hedef/ark yüzdesini `getEducationProgress`ten türet. Odak ödülünün mevcut niyetini netleştir: canonical puan sistemine sınırlı ve tek seferlik bağlanacaksa mevcut tamamlanma/ücret yolundan geçir; aksi halde mevcut ödül mesajını gerçekten uygulanan etkiyle eşleştir. İki ilerleme sayacı oluşturma, eğitim sürelerini topluca değiştirme.

**Dosyalar:** `life-depth.js`, `decision-network.js`; yalnız gerekiyorsa `life.js`te mevcut tamamlanma fonksiyonuna küçük kanca. **Save riski:** düşük/orta; eski `active.progress` alanını gerçek diploma/puan diye çevirmemek gerekir, çünkü önceki ödül kaydı bunun eğitim puanı olduğunu kanıtlamaz. V5/V6 korunur. **Hedefli test:** %50 gerçek eğitim → aynı hedef yüzdesi; ödül → somut canonical etki; eşikte tek mezuniyet; save/load sonrası çift ödül yok.

### B02 — İçerik hedefi siliniyor; depozito zarfı birikim oluşturmuyor (P1)

**Mevcut/kanıt:** `life-content.js:applyLifeContentResolution` seçime bağlı `lc-goal:lc_goal_housing` ekliyor. `life-depth.js:deriveGoals` bir sonraki `refreshLifeArcs` çağrısında `d.goals=goals.slice(0,4)` ile tamamını yeniden kuruyor. Gerçek `enqueueEvent→activateNextEvent→resolveEvent("save")` yolu kullanıldı: ₺50.000 → ₺48.800, net servet de aynı miktarda azaldı; zarf hesabı/varlığı oluşmadı; %20 hedef ilk yenilemede kayboldu. Üstelik `extraToEvent`in varsayılan arkı nedeniyle bu konut hedefi `crisis` olarak ekleniyor. E03, `focused-extra.json:envelope`.

**Oyuncuya etkisi:** “Nakit kilitlenir / birikim” diye sunulan karar tüketim olarak işleniyor; takip edilebilir hedef/varlık üretmiyor. Bu nedenle anlamlı birikim kararı gibi gösterilemez. Yeni bankacılık bug'ı veya bütün para korunumunun bozulması diye genellenmez: mevcut işlem defteri -1200 gideri doğru kaydeder, problem anlatılan işlevdir.

**En küçük güvenli çözüm:** Zarfı ayrı finans motoruna dönüştürme. Önce seçeneğin ne yapacağını gerçek mevcut sisteme bağla: mevcut birikim hesabına doğrulanmış iç transfer veya mevcut bütçeye dokunmayan bir hedef notu. Para aktarmayan nota -1200 kesinti ekleme. Kalıcı niyet ile durumdan türeyen fırsatları tek listeyi ezerek saklama; yeni ekranda değil mevcut Hedefler üzerinde göster. Geçmiş kayıtlarda zarf varlığı ya da geriye dönük iade uydurma.

**Dosyalar:** `life-content.js:lc_goal_housing/applyLifeContentResolution`, `life-depth.js:deriveGoals`, gerekiyorsa mevcut bank-actions transfer yolu; `app.js` yalnız mevcut içerik alanı. **Save riski:** orta; eski kayıtta zarf varlığı yok. Yeni niyet alanı additive ve sınırlı olmalı; geçmiş anılardan borç/varlık hesaplanmamalı. **Hedefli test:** seç→render/refresh→save/load hedef devamlılığı; yeni tasarlanan kararın cüzdan+banka+net servet korunumu; stale choice/double resolution; doğru housing arkı.

### B03 — Olay hafızası var, bazı tekrarların hayat bağlamı zayıf (P1)

**Mevcut:** `events.js:isEligible` once/cooldown, aktif/kuyruk duplicate ve 3D/expansion haftalık siper uygular. `activateNextEvent` kuyruk boşsa önce ilk uygun lifeEcho, sonra katalogdaki ilk uygun tanımı seçer; production havuzunda genel kategori/sonuç hafızasıyla rotasyon yok. `life-content.js` tarafında ise altı haftalık, ark sayısı/son hafta dengeleyen ayrı mekanizma zaten vardır. Onu tekrar yazmak gerekmez.

**Somut tekrar:** Seed41 düşük gelir koşusunda 20 yılda `moving_help_mehmet` **47**, `night_call_mehmet` **60**, `payday_iban_help` **52** kez çözüldü. Taşınma olayının koşulu yalnız arkadaşlık ve `absoluteWeek>=8`, cooldown=20; yeni taşınma milestone'u istemiyor. Gece araması güven/arkadaşlık/week>=5 ve cooldown=16 ile tekrar edebiliyor. Aile yanında kalma `family_late_night` için yeterli; 38 yaşında da aynı anne-kapı metni gelir. ID tekrarının bütününü hata saymıyoruz: aylık ödeme/iş vardiyası gibi tekrar eden yaşam gerçekleri gereklidir. **Yeni bir taşınma olmadan sürekli taşınma hikâyesi** ise ölçülmüş mekanik tekrar örneğidir.

**En küçük güvenli çözüm:** Önce yalnız kanıtlı 3–5 olayın koşuluna mevcut NPC milestone/geçmiş karar/yaşam evresi bağla; yeni gerçek bağlam yoksa yeniden açma veya aynı anlamlı yardımın bağlama uygun devamını kullan. Gerekirse production havuzunda var olan cooldown bilgisiyle deterministic, bounded son-kategori seçimi; önce ölçümle kanıtla, sonra küçük değiştir. Tüm cooldown'ları büyütmek, olayları silmek veya zincir/due queue'yu rastgele sıralamak çözüm değildir.

**Dosyalar:** `events.js`te tanım koşulları ve gerekirse organic production seçimi; mevcut NPC verisi `network.js`/`depth3-systems.js`ten okunur. **Save riski:** düşük/orta; yeni son-kategori kaydı gerekiyorsa additive bounded flag, eski cooldown/seen aynen korunur. **Hedefli test:** yeni taşınma yokken aynı çağrı yeniden yok; yeni anlamlı milestone varsa yeniden mümkün; due chain önceliği/once/cooldown korunur; 240/480/960 tekrar/boşluk kıyası; seed determinismi. ID tekrarını sıfırlama hedefi yok.

### B04 — NPC gelişmeleri bazı yerlerde görünür hikâyeye ulaşmıyor (P1)

**Kimlik kusuru:** `network.js:processNetworkWeek` `knownMilestones`e `pick.text` yazıyor. `depth3-systems.js:recordNpcMilestone/markNpcMilestoneKnown` ve `time.js:closeYear` tüketicisi ise milestone **ID** bekliyor. Bilinirlik için ilişkileri 60 yapan kontrollü örnekte 12 aile/ağ kombinasyonunun hepsinde bilinen network gelişmelerinin ID eşleşmesi **0**. Kaynakla neden-sonuç açık: `.find(item.id===id)` metinle eşleşmez. Bu bütün NPC geçmişi bozuk demek değildir; standart ID ile yazılan çekirdek kilometre taşları bu hatanın dışında.

**Rotasyon kusuru:** Aynı fonksiyon yalnız `week%16===0` günceller ve `idx=week%extras.length` seçer. Güncel `single+tight` başlangıcında iki ek kişi var; 16'nın katları %2=0 olduğu için 960 hafta/60 tick boyunca **yalnız teyze**, ikinci kişi **hiç** seçilmiyor. `nuclear+tight` 1/1, normal 11/11, wide 41/41 örnekleri etkilenmiyor. Geniş ağın bütünü aç kalıyor diye yanlış genelleme yapılmadı.

**En küçük güvenli çözüm:** Mevcut `recordNpcMilestone` yolunu kullan ve bilinen gelişmeyi ID ile işaretle. Roster seçiminde takvim haftası yerine güncelleme sıra numarası/korunan küçük cursor kullan; kişi yok/mevcut değilse mevcut görünürlük sınırını izle. Eski metin tabanlı known kayıtlarını yalnız eldeki gerçek milestone metniyle eşleştirilebiliyorsa ID'ye bağla; bilmediği sırrı gösterme.

**Dosyalar:** `network.js:processNetworkWeek`; yalnız gerekiyorsa mevcut normalize katmanı `state.js`/`depth3-systems.js` ve yıl tüketicisi. **Save riski:** orta; bilinirlik gizlilik sözleşmesidir. V5/V6 dönüştürme idempotent, metin→ID eşleştirme dar olmalı. **Hedefli test:** single/tight iki kişi iki tick içinde sıra alır; 4 aile×3 ağ; aynı tick idempotent; bilinen gelişme yıl dosyasına gelir, bilinmeyen gelmez; save/load cursor ve ID devamlılığı.

### B05 — Bazı farklı metinler aynı dar etkiyi taşıyor; işlem vaadi gerçekte uygulanmıyor (P1)

**Somut metin varyasyon adayları:** `lc_wedding_year` / `lc_night_lamp` tercihleri sırasıyla yalnız stres -2 / +2; `lc_credit_limit` / `lc_late_clinic` tercihleri stres +2 / +3 ve ilk tercihte bir anı üretiyor. Bu dört tanımda `lifeNext`, `goal`, `opportunity`, `echo`, `npcMemory` yok. Ark/yaş/bağlam ve anlatı farklı olduğundan dört kartı otomatik kopya diye silmek yanlış olur. Bunlar ölçülmüş mekanik benzerlik örnekleridir; yorumla bütün havuza genellenmedi.

**Doğrulanmış yanıltıcı sonuç:** `lc_credit_limit/refuse`, “Kart limitini kendin kestin” mesaj/anısını verirken `finances.banking` hiç değişmiyor. Yeni kartı/hesabı olmayan karakterde bile başarılı çözülüyor. Organik değil, otomatik callback olarak `arrears>0` veya `balance<2500` ile schedule ediliyor; kart sahipliği kapısı yok. `lc_late_clinic/take` “Üç ay sonraki randevuyu aldın” diyor; mevcut health/openCases/content waiting durumunda takip randevusu yaratmıyor. Her ikisinde gerçek enqueue→activate→resolve yolu yalnız stresi 24→26 ve anıyı değiştirdi. `narrative-promises.json` önce/sonra; kodda ID referansları yalnız tanım ve otomatik schedule satırlarında.

**Etki:** Atmosferik metin meşrudur; burada sorunun nedeni kart limiti kesme veya randevu alma gibi somut işlemin olmuş diye bildirilmesi. Bankacılığı/sağlığı yeniden yazmak gerekmez. En küçük çözüm, gerçekten mevcut işlemi çağırmak mümkünse sahiplik/uygunluk kapısıyla o yola bağlamak; değilse etiketi ve anıyı açıkça niyet/deneme düzeyine çekmektir. Randevu için mevcut sağlık takip/case yolu yeterli olabilir; ayrı klinik oyunu veya yeni takvim ekranı gerekmez.

**Dosya:** `life-content.js` ilgili iki tanım ve schedule koşulları; yalnız gerçek mevcut işlem yoluna bağlanacaksa ilgili dar API kancası. **Save riski:** düşük; geçmiş anıyı gerçek limit değişimi/randevu borcu diye geriye dönük yorumlama yok. **Hedefli test:** kart yokken somut limit işlemi vaadi yok; mevcut karta bağlanırsa canonical limit/due değişir; randevu yapılmış deniyorsa gerçek takip oluşur, aksi halde doğru niyet metni; sıfır maliyet/çift işlem ve TR/EN aynı anlam. Bu B02 zarfıyla aynı “anlatı vaadi→gerçek sonuç” paketidir.

## 5. Gerçek eksik ve isteğe bağlı genişlemeler

### C01 — Oyuncunun seçtiği, değiştirilebilir uzun vadeli hayat yönü (P1)

**Var olanla farkı:** `state.js:setYearlyPriorities` altı kategoriden en çok ikisini kaydeder; `closeYear` bunları yorumlar. Bu gerçek ve yararlı bir özelliktir. Ancak `decision-network.js:currentGoal`, bu seçimi okumaz; `refreshLifeArcs(...).goals` içinden en düşük yüzdeyi alır. `app.js` Hedefler render'ı salt türetilmiş hedef listesidir. `focused-extra.json:priorities`: sağlık+ilişki yıllık seçimi sonrasında currentGoal yine **prepare-promotion / career**. Bu yüzden “hiç hedef yok” da “oyuncu hayat amacını seçebiliyor” da fazla iddialıdır.

**Doğrulanmış oyuncu etkisi:** Aile stratejisinde 960 haftanın **801**'inde türetilmiş hedef listesi boş; aile/çocuk/sosyal ilerleme fiilen sürüyor. Dengeli/düşük gelir politikası ilk 220 hafta çoğunlukla hedef görmüyor; sonra “konut adımı” nakit oranından %100 olsa da hâlâ aile evindeyken tamamlanmış gibi kalıyor. Elde para olması, sürdürülebilir ev sahibi/bağımsız yaşama sonucunu tek başına kanıtlamaz. Yan hedef altyapısında B02 de kaydı siliyor.

**En küçük güvenli çözüm:** Önce mevcut yıllık seçimi mevcut Hedefler alanına görünür biçimde bağla; yeni menü yok. Ayrı bir zorunlu görev sistemi eklemek yerine isteğe bağlı ana yön ve en çok 1–2 küçük izlenebilir aşama; kariyer/eğitim/sağlık/ilişki/finans/bağımsızlık alanları mevcut canonical state'ten türetilsin. Seçim değiştirilebilir ve boş/serbest yaşam geçerli olsun. Aile isteği mevcut çocuk/partner verisinden, girişimcilik isteği mevcut işletmeden beslensin; ayrı siyaset veya suç kariyer motoru şart değil. Başarı/başarısızlık zorunlu oyun sonu/bedava para doğurmasın. Hedef değişince geçmiş/önceki kararlar silinmesin.

**Dosyalar:** `state.js:setYearlyPriorities` ve additive normalizasyon; `life-depth.js`; `decision-network.js:currentGoal`; `app.js` mevcut `character/goals` içerikleri. **Save riski:** orta; eski oyuncuya geçmiş hedef seçimi/başarısı uydurulamaz. Varsayılan seçim boş; `SAVE_VERSION=6` korunur. **Hedefli test:** seç/değiştir/boşalt→haftalık odak; gerçek ilerleme/farklı yollar; konut %100 için gerçek aşama; aile ve para dışı amaç; V5/V6 round-trip; hedef değişiminde anılar kalır. B01/B02 oturmadan bu paket birleştirilmez.

### 5.1 P2: uygulama sırasına alınmayanlar

| Öneri | Durum / kanıt | En küçük olası iş | Neden otomatik planda değil |
| --- | --- | --- | --- |
| Altı yeni hazır başlangıç profili | B/D; E02: mevcut profil/arka plan bileşimi var; hepsi hazır senaryo değil | İleride yalnız preset verisi ve açık başlangıç bedeli | Amaç/sonuç bağlantısını çözmeden preset çoğaltmak aynı döngüyü farklı nakitle başlatır |
| Şehre özel daha çok hikâye | B; E09 + koşul duyarlılığı: aynı tip ev/iş durumundaki üç şehir bu örnekte aynı 41 uygun organik tanımı verdi | Mevcut bölge/meslek verisine bağlı birkaç metin/sonuç | Ekonomik şehir ayrımı zaten gerçek; tek örnek evrensel çeşitlilik yokluğu kanıtı değil |
| Ay kartında borç değişimi ve önemli olay listesi | B; E14: closing debt var, receipt opening debt yok; kart mali akışa odaklı | Açılış borcu additive snapshot + mevcut yıl/olay geçmişinden sınırlı özet | Temel ay kartı ve muhasebe çalışıyor; P1 hedef ve tekrar kusurlarından sonra |
| Bütün ilkler için ömürlük küçük milestone arşivi | B; E13: memory200, career40, annual56; final report memory20/year8 sınırı | Sadece ilk iş/ev gibi birkaç sabit milestone alanı; sınırsız günlük değil | Mevcut hayat raporu eksik değil; bütün ilklerin sonsuz saklanması ayrı ürün tercihi |
| Tam mülakat/maaş pazarlığı | D; E06 mevcut teklif/uygunluk ve işyeri sonuçları kapsanıyor | Mevcut teklifin tek kısa dalı | Yeni alt motorun faydası kanıtlanmadı |
| Ayrı rakip/suç örgütü/siyaset kariyeri | D; E05/E11/E12; mevcut çevre/itibar/risk sonuçları temel ihtiyacı karşılıyor | Gelecekte mevcut aktöre bir koşullu dal | Kapsam ve yeni durum karmaşıklığı yüksek |
| Her alana yeni portre/sahne/görsel | D; E01/E09; 3 harita + Body/ikon sistemi mevcut | Yalnız kanıtlanmış görsel bilgi eksikliği için varlık | Görsel sayısı oynanış amacı yerine geçmez; kaynak haritalar tutarlı ve korumalı |
| Genel perf/boyut/CSS refaktörü | D; E18; son kullanıcı talimatında altyapı ve tasarım korumalı | Yeni paketin eklediği maliyeti yerel sınırlı tut | Bu fazda ölçülmüş yeni performans engeli yok; site boyutu işi kapsam dışı |
| Tam bağlamsal öğretici | B/D; E17 giriş/yardım mevcut | Gerekirse mevcut ilk-adım metnine tek ipucu | Yeni ekran/akış zorunlu değil |
| TR/EN bütün anlatı satırlarının insan QA’sı | B; E17 overlay testleri tam edebî eşdeğerlik kanıtı değildir | Değişen P1 olaylarında hedefli TR/EN metin kontrolü | 919 tercihin ayrı çeviri programı bu fazı büyütür |

## 6. Olay çeşitliliği ve uzun oyun ölçümü

### 6.1 Olay havuzları

Sayılar modüllerin runtime export dizilerinden hesaplandı; aşağıdaki satırlar birbirine eklenebilir ve toplam 433'tür. `LIFETIME_EVENTS` zaten `events.js` içine eklenir; ikinci kez sayılmadı. Tarihsel senaryo olayları ayrı akıştır ve bu 433 sayısına katılmadı.

| Modül | Export / alt havuz | Tanım |
| --- | --- | --- |
| events.js | core direct declarations | 56 |
| criminal-justice.js | CRIMINAL_EVENTS | 2 |
| lifetime.js | LIFETIME_EVENTS | 1 |
| parenthood.js | PARENTING_EVENTS | 21 |
| household.js | HOUSEHOLD_EVENTS | 14 |
| adult-life-events.js | ADULT_LIFE_EVENTS | 30 |
| realism-events.js | REALISM_EVENTS | 45 |
| depth-events.js | DEPTH_EVENTS | 5 |
| depth2-events.js | DEPTH2_EVENTS | 20 |
| depth3-events.js | DEPTH3_EVENTS | 11 |
| body-events.js | BODY_EVENTS | 8 |
| expansion-events.js | EXPANSION_EVENTS | 24 |
| expansion-events.js | EXPANSION_CALLBACK_EVENTS | 1 |
| life-echo-events.js | LIFE_ECHO_EVENTS | 5 |
| life-echo-events.js | LIFE_ECHO_CALLBACK_EVENTS | 5 |
| life-depth.js | LIFE_DEPTH_EVENTS | 4 |
| life-content.js | LIFE_CONTENT_EVENTS | 181 |

Repeat politikası: **144 once, 135 cooldown, 150 repeatable, 4 repeat alanı belirtilmemiş tanım**. `repeatable` tanımların bir bölümü koşulu `false` olan queue/callback halkalarıdır; her hafta rastgele havuza girecek 150 kart demek değildir. `life-content`te 181 düğüm; 65 zincir, 65 organik düğüm ve 33 ek callback var. `coverage().delayedCallbacks=116`, “gecikmeli olarak kullanılabilen düğüm” sayısıdır; 116 bağımsız otomatik zamanlayıcı değildir. Geç yaşam içeriği 53 düğüm/16 zincir olarak mevcut.

Tam eşit **başlık veya olay metni kopyası bulunmadı**. Bu, semantik kopya yok demek değildir. Örneğin aynı durum değişkenlerini etkileyen farklı metinler ve saturasyonda etkisi küçülen sosyal seçenekler vardır. Sonuç imzası bunları ayrı ölçer; metin-only diye otomatik silme listesi çıkarmadık. Aynı hikâyenin kendisini tekrar etmesi B03'te doğrudan kanıtlandı.

### 6.2 Yöntem ve tekrar tanımları

- Mevcut `createNewGame`, `canApplyDecision/applyDecision`, sosyal/iş/eğitim/işletme API'leri, `advanceWeek`, `getEventChoiceAvailability/resolveEvent`, `validateState`, `saveGame/loadGame` kullanıldı. Gözlemci kodu yalnız scratch `audit-evidence/` altında; ürüne ve mevcut test altyapısına eklenmedi.
- `settleHouseholdEvents`in mevcut seçim/gate/80 döngü yaklaşımı esas alındı; olaylar gerçek çözülme anında sayıldı. **200 kayıtta dönen history listesinin uzunluğu olay sayacı olarak kullanılmadı.** Gözlemci tam olay izini dışarıda tuttu.
- İki seed: 41,73. Her koşuda her yıl save/load, her hafta validateState. 16 ana koşuda 320 reload. Başlangıç fixture'ı dışında para/deneyim/ilişki her hafta elle yükseltilmedi. Seed41 tekrar koşusu aynı olay/tercih/sonuç izini ve aynı 5/10/20 yıl checkpointlerini verdi. Raw save hash'inin farklılığı `save.js:saveGame`in gerçek saatli `meta.updatedAt` alanındandır; gameplay nondeterminismi diye raporlanmadı.
- **ID tekrar oranı** = `(olay adedi - benzersiz ID) / olay adedi`. Havuz sonlu olduğu için uzun dönemde artması normaldir. %0 hedeflenmez. Birbirinin aynısı olmayan 433 kartı 1000 defa çözmek bile en az %56,7 ID tekrarına yol açar.
- **Kategori** native tek şema olmadığı için tanımda varsa `arc`, yoksa ilk modül bayrağı (`parenting/household/lifeEcho/lifeDepth/depth3/depth2/social3D/expansion/lifetime`), yoksa `core` olarak atandı. Bunlar semantik sosyal tema etiketleri değildir; özellikle `social3D`yi tek yaşam konusu saymak yanıltıcıdır. Kategori tekrar oranı bağlam ve dağılım göstergesidir, hata oranı değildir.
- **Sonuç imzası** olay öncesi/sonrası nakit/borç, iş/performans/eğitim, sağlık, ilişki/güven/gerilim, partner/çocuk/konut ve açık dosya sayısının gerçek farklarını kapsar. Tam sayısal imza ile yalnız değişim yönü imzası ayrı. **Anı metni, bütün flags ve gizli zincir durumu dahil değil**; bu yüzden imza eşitliği “anlamsız aynı olay” veya “hiç sonucu yok” kanıtı sayılmaz.
- **Boş hafta** o döngüde hiç olay çözülmemesi; haftalık aksiyon, maaş/gider veya süreç ilerlememesi demek değil. **Karar çeşitliliği** uygulanabilir karar sayısı ve gerçekten seçilen aksiyon ID'leriyle ölçüldü; seçim politikası bütün seçenekleri tüketmiyor.

### 6.3 Senaryo tanımları

| Senaryo | Gerçek başlangıç ve politika |
| --- | --- |
| Düşük gelir | balanced + tight ekonomi → ₺4.000, market, aile evi; dinlen/egzersiz/aile ağırlığı |
| Varlıklı fixture | Oyunda varlıklı preset yok. Aynı karaktere yalnız fixture başlangıç sermayesi +₺495.000 (toplam ₺500.000); sonraki politika düşük gelirle aynı |
| İşsiz | Gerçek quitJob ile işsiz başlangıç, aktif iş arama politikası yok; sistemin en kötü pasif gidişatı; işsiz mezun preset varmış gibi sunulmaz |
| Borçlu | Mevcut takeCredit("medium") ile ₺30.000 kredi ve gerçek yükümlülük; fixture başlangıç harcaması -₺30.000; sonraki hafta düzenli politika |
| Aile odaklı | Sosyal meet/confide, gerçek birliktelik/niyet/gebelik/bakım seçimleri; en çok bir çocuk; uygun olduğunda eğitim/iş yatırımı |
| Kariyer odaklı | Mesleki kurs + gerçek uygun iş/terfi yolları; kontrollü mesai ve toparlanma |
| Yüksek risk | Uygun haftalarda mevcut risk-shortcut/fight/dose/night; gerçek kapı/gözaltı/sağlık/ceza sonuçları; dinlenme/egzersiz |
| Girişimci | Oyunda borçlu girişimci preset yok. +₺25.000 başlangıç fixture desteği; gerçek repair açma/çalışan/büyütme; seviye4 tavanlı politika |

Önemli sınır: Politikalarda çoğu hafta 2–3 tercih kullanıldı; güncel 7–8 odak hakkının tümünü harcayan optimum oyuncu taklidi yapılmadı. Olaydaki varsayılan tercihler bazen ofis işi gibi ek fırsatlar açtı; bu nedenle düşük gelir politikası finalde office olabilir. İşsiz koşuda aramamak ile oyunda iş bulamamak aynı şey değildir. Aile/risk/işletme profilleri yeni oyun menüsünde hazır preset değildir.

### 6.4 5 / 10 / 20 yıl — seed41

| Politika | Yıl | Çözülen olay | Benzersiz ID | ID tekrarı | Boş hafta / en uzun seri |
| --- | --- | --- | --- | --- | --- |
| Düşük gelir | 5 | 258 | 127 | %50.8 | 1 / 1 |
| Düşük gelir | 10 | 508 | 134 | %73.6 | 1 / 1 |
| Düşük gelir | 20 | 1002 | 138 | %86.2 | 1 / 1 |
| Varlıklı fixture | 5 | 258 | 127 | %50.8 | 1 / 1 |
| Varlıklı fixture | 10 | 508 | 134 | %73.6 | 1 / 1 |
| Varlıklı fixture | 20 | 1002 | 138 | %86.2 | 1 / 1 |
| İşsiz | 5 | 249 | 82 | %67.1 | 20 / 2 |
| İşsiz | 10 | 468 | 85 | %81.8 | 56 / 3 |
| İşsiz | 20 | 911 | 85 | %90.7 | 120 / 3 |
| Borçlu | 5 | 262 | 136 | %48.1 | 1 / 1 |
| Borçlu | 10 | 512 | 146 | %71.5 | 1 / 1 |
| Borçlu | 20 | 1005 | 148 | %85.3 | 1 / 1 |
| Aile odaklı | 5 | 303 | 151 | %50.2 | 0 / 0 |
| Aile odaklı | 10 | 585 | 171 | %70.8 | 0 / 0 |
| Aile odaklı | 20 | 1140 | 184 | %83.9 | 0 / 0 |
| Kariyer odaklı | 5 | 278 | 125 | %55.0 | 0 / 0 |
| Kariyer odaklı | 10 | 546 | 132 | %75.8 | 0 / 0 |
| Kariyer odaklı | 20 | 1073 | 136 | %87.3 | 0 / 0 |
| Yüksek risk | 5 | 270 | 119 | %55.9 | 2 / 1 |
| Yüksek risk | 10 | 525 | 126 | %76.0 | 17 / 1 |
| Yüksek risk | 20 | 1013 | 128 | %87.4 | 59 / 2 |
| Girişimci | 5 | 258 | 127 | %50.8 | 1 / 1 |
| Girişimci | 10 | 508 | 134 | %73.6 | 1 / 1 |
| Girişimci | 20 | 1002 | 138 | %86.2 | 1 / 1 |

### 6.5 İki seed ile 20 yılın karşılaştırması

| Politika | Seed | Olay | ID | ID tekrar | Çekirdek sonuç imzası tekrar | Hedefsiz hafta | İş | Nakit ₺ | Borç ₺ | Partner / çocuk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Düşük gelir | 41 | 1002 | 138 | %86.2 | %92.3 | 220 | office | 747040 | 0 | — / 0 |
| Varlıklı fixture | 41 | 1002 | 138 | %86.2 | %92.4 | 220 | office | 1242040 | 0 | — / 0 |
| İşsiz | 41 | 911 | 85 | %90.7 | %93.9 | 7 | işsiz | -2017320 | 300000 | — / 0 |
| Borçlu | 41 | 1005 | 148 | %85.3 | %91.7 | 144 | office | 697230 | 0 | — / 0 |
| Aile odaklı | 41 | 1140 | 184 | %83.9 | %91.8 | 801 | specialist | 1645474 | 0 | elif / 1 |
| Kariyer odaklı | 41 | 1073 | 136 | %87.3 | %92.0 | 195 | technician | 1997895 | 0 | — / 0 |
| Yüksek risk | 41 | 1013 | 128 | %87.4 | %90.7 | 0 | market | -458597 | 300000 | — / 0 |
| Girişimci | 41 | 1002 | 138 | %86.2 | %92.4 | 220 | office | 8742910 | 0 | — / 0 |
| Düşük gelir | 73 | 1000 | 135 | %86.5 | %92.5 | 220 | office | 783546 | 0 | — / 0 |
| Varlıklı fixture | 73 | 1000 | 135 | %86.5 | %92.6 | 220 | office | 1278546 | 0 | — / 0 |
| İşsiz | 73 | 913 | 85 | %90.7 | %93.9 | 7 | işsiz | -2016703 | 300000 | — / 0 |
| Borçlu | 73 | 1007 | 145 | %85.6 | %91.7 | 144 | office | 708924 | 0 | — / 0 |
| Aile odaklı | 73 | 1140 | 186 | %83.7 | %91.4 | 801 | specialist | 1655394 | 0 | elif / 1 |
| Kariyer odaklı | 73 | 1058 | 137 | %87.1 | %91.6 | 195 | technician | 2013690 | 0 | — / 0 |
| Yüksek risk | 73 | 1012 | 127 | %87.5 | %90.8 | 0 | market | -457536 | 300000 | — / 0 |
| Girişimci | 73 | 1000 | 135 | %86.5 | %92.6 | 220 | office | 7957886 | 0 | — / 0 |

**Sonuç:** 16 koşunun tümünde 960 haftalık ilerleme ve validateState başarılı. İşsiz/yüksek risk koşularında uygulanabilir karar minimumu 1'e indi fakat hiçbir ölçülen haftada sıfır olmadı. Borçta 300.000 tavan sonrasındaki yükün negatif nakitte kalması mevcut korunum kararıdır; “negatif nakit var, ekonomi bozuk” sonucu çıkarılmadı. Pasif işsiz koşu iki milyon TL civarı negatif nakde gitti; bu bir kötü strateji sonucu, bütün işsiz karakterler kaçınılmaz kilitlenir kanıtı değil.

Aile politikası iki seed'de de gerçek partner+bir çocuk ve specialist kariyeri; kariyer politikası technician; girişimci repair seviye4 ve yaklaşık ₺7,96–8,74 milyon nakit üretti. Bunlar stratejilerin ayrıştığını gösterir; işletme çarpanlarının bütün ekonomi için dengeli olduğunu tek başına kanıtlamaz. Yeniden balanslama bu raporun P1 çözümü değil.

### 6.6 Tekrarın dağılımı, boşluk ve alternatif hayat

| Seed41 düşük gelir: en çok görülen | 20 yıllık adet |
| --- | --- |
| night_call_mehmet | 60 |
| mehmet_ignored_ping | 57 |
| payday_iban_help | 52 |
| family_late_night | 48 |
| moving_help_mehmet | 47 |

| Aynı koşunun kategori dağılımı | Adet |
| --- | --- |
| social3D | 687 |
| expansion | 159 |
| depth2 | 69 |
| family | 15 |
| core | 11 |
| career | 10 |
| crisis | 9 |
| education | 9 |
| depth3 | 8 |
| lifeEcho | 8 |
| social | 6 |
| status | 4 |
| finance | 3 |
| health | 2 |
| housing | 2 |

Bu koşuda kategori tekrar oranı %98.50; tam çekirdek sonuç imzası tekrar oranı %92.32; 77 tam imza, 38 yön imzası. Son yılda 49 olay/25 ID görülmüş. Aynı hafta aynı ID tekrarı 0; en kısa ID dönüş aralığı 14 hafta. Bunlar cooldown'ın çalıştığını, ama “yeni taşınma olmadan yeniden taşınma günü” bağlamını doğrulamadığını gösteriyor.

Ana 16 koşuda en uzun olaysız seri 0–3 hafta. Aynı seed41 karakterinde tercihleri uygun listenin son seçeneğine çeviren kontrol koşusunda en uzun seri **5 hafta**, toplam 138 olaysız hafta oluştu; hâlâ bütün 960 hafta tamamlandı. Bu bulgu bir softlock değildir. Olay sayısının düşmesi sosyal kapıların seçime bağlı kapanmasıyla uyumlu; her boşluğu zorunlu popup ile doldurmak önerilmiyor.

| Aynı başlangıç / aynı seed41 | Normal tercihler | Alternatif tercihler |
| --- | --- | --- |
| Çözülen olay / ID | 1002 / 138 | 891 / 93 |
| Final iş | office | market |
| Nakit | 747040 | 203395 |
| Mehmet yakınlığı | 99 | 28 |
| Anne yakınlığı | 100 | 100 |
| En uzun olaysız seri | 1 | 5 |

Düşük gelir ve varlıklı fixture aynı seed/politikada 1002 olay ve 138 benzersiz ID üretti. ID dizisi birebir aynı değil: hizalanmış 1002 konumun yalnız 14’ünde ID farklı (%98,6 benzer konum); frekans ve tercih farkları da var. Bu sınırlı örnekte nakit farkı anlatıyı az ayrıştırdı. “Hiçbir para koşulu yok” denemez: `class_shift`, borç ve konut kapıları bulunuyor. Girişimcinin de düşük gelirle aynı toplam olay/ID sayısında ve benzer fakat özdeş olmayan dizide kalması, iş/işletme/servet bağlamını mevcut hikâyelere bağlamak için P2 araştırma gerekçesidir; otomatik yeni 100 olay siparişi değildir.

### 6.7 Koşul duyarlılığı: meslek, yaş, şehir, borç, aile ve geçmiş

Kontrollü probe'da hafta=120, depth2/3 açık ve henüz görülmemiş olaylar kullanıldı. `condition` veya `organicCheck` doğrudan ölçüldü; queue/cooldown ve bütün gerçek hayat zincirini taklit ettiği iddia edilmiyor. Başlangıç state'i zaten seed'e bağlı aile/çevre taşır. Aşağıdaki sayılar tek değişkenlik durumlarda koşul farkını gösterir; bütün oyunun doğal erişim oranı değildir.

| Kontrol | Uygun ham tanım | Eklenen / çıkan |
| --- | --- | --- |
| base | 62 | 0 / 0 |
| jobless | 42 | 4 / 24 |
| office | 63 | 2 / 1 |
| age38 | 70 | 9 / 1 |
| age68 | 68 | 10 / 4 |
| debt | 64 | 2 / 0 |
| rich | 63 | 1 / 0 |
| family | 62 | 0 / 0 |
| istanbul | 41 | 15 / 36 |
| ankara | 41 | 15 / 36 |
| izmir | 41 | 15 / 36 |

Yaş ve iş değişimi olay kapılarını belirgin değiştiriyor; borç ve yüksek nakit daha az koşulu değiştiriyor. Üç şehir fixture'ı aynı nakit/işsiz/shared konut koşulunda aynı 41 tanımı verdi. Şehir mekanikleri yine farklı maliyet/ulaşım/müşteri/risk üretir (E09); bu ölçüm “şehirler yalnız isim” hükmünü desteklemez. `family` kontrolü yalnız familyType bayrağını değiştirir; bütün geniş aile roster'ı yeniden kurulmadığından aile tipinin toplam etkisini ölçmez.

Geçmiş karar etkisi hem aynı-karakter alternatif koşusunda hem mevcut `life-echo`, sır/referans/iyilik, household ve parenthood testlerinde vardır. Tam bütün şehir×semt×meslek×yaş×borç çapraz matrisi çalıştırılmadı. Kanıt yokluğunu özellik yokluğu olarak kullanmadık.

## 7. P0 / P1 / P2 kararları

| Öncelik | İş | Sınıf | Karar |
| --- | --- | --- | --- |
| P0 | İlerlemenin durması / corruption / doğrulanmış para üretme kaybı | — | Bu örneklerde yok; garanti değil |
| P1 | B01 eğitim hedefi ve sahte hızlanma | B | Önce düzelt |
| P1 | B02 kaybolan içerik hedefi + karşılıksız zarf vaadi | B | Mevcut sistemle gerçek sonuca bağla |
| P1 | B03 yeni bağlam olmadan dönemsel aynı hikâye | B | Yalnız kanıtlı tekrarları düzelt |
| P1 | B04 NPC ID köprüsü ve single/tight rotasyonu | B | Mevcut milestone omurgasını onar |
| P1 | B05 yanıltıcı kart/klinik işlem vaatleri | B | Mevcut davranış veya doğru niyet metni |
| P1 | C01 isteğe bağlı kişisel hayat yönü / yıllık öncelik köprüsü | C | B01/B02 ardından küçük ekleme |
| P2 | Yeni preset/şehir hikâyesi/aylık borç farkı/kalıcı ilkler | B/D | Otomatik uygulama listesine alınmadı |
| D | 21 ekranı yeniden boyutlandırmak, bankacılık/mortgage yeniden kurmak, yeni harita/menü, altyapı/perf programı | D | Koruma kararına aykırı veya mükerrer; yapılmayacak |

## 8. Astra Ultra için beş uygulama paketi

Bu paketler **öneridir**; bu fazda hiçbiri uygulanmadı. Paket kabulü current-head hedefli testler + repo'nun zorunlu CI/TC kapılarıyla yapılır. Bekleyen CI/merge'i sürekli poll etmek yerine alttaki bağımsız hazırlık ilerletilir. Koruma kapıları atlanmaz.

### Paket 1 — Mevcut hedeflerin ilerleme ve kayıt bütünlüğü (B01+B02 hedef kısmı)

- PR1a: yalnız eğitim yüzdesi/arkı ve ödülün canonical sonucu; iki puan sayacı yok.
- PR1b: silinen hedefin veri sahipliği ve doğru ark. Depozitonun para/transfer davranışı Paket5’e aittir; iki PR aynı finans sonucunu ayrı ayrı değiştirmez. Yeni bankacılık sistemi yok.
- Aynı çekirdek davranışı iki kez tanımlamamak için B02 veri sözleşmesi Paket4 tarafından aynen kullanılır. Kalıcı niyet maksimumu/bounded alanı bir kez belirlenir.
- Hedefli kontroller: mevcut decision-network/life-depth/content/monthly-cash/save testleri + B01/B02'deki birkaç çapraz davranış regresyonu. 21 ekran kaynakları, yeni CSS ve finans katsayıları kapsam dışı.

### Paket 2 — NPC gelişmesinin kişiye ve geçmişe bağlanması (B04)

- PR2a: mevcut milestone fonksiyonuna geçiş, ID/known köprüsü ve dar eski-kayıt uyumu.
- PR2b gerekirse: single/tight ve değişen roster için sıra seçimi; aynı tick'in tekrar yüklemede iki kez ilerlememesi.
- Yalnız `network.js` ve zorunlu küçük normalize/tüketici dokunuşları. Yeni NPC, ilişki metriği veya ayrı yapay zekâ yok.
- Hedefli test: 4 aile×3 ağ, en az tek/çift/11/41 roster; görünür/gizli gelişme; yıl raporu ve reload. Paket1 CI beklerken bağımsız hazırlanabilir.

### Paket 3 — Kanıtlı mekanik olay tekrarlarının bağlamı (B03)

- PR3a: `moving_help_mehmet` ve aynı tür bağlam kusuru doğrulanan az sayıda tanım için mevcut milestone/gündelik bağlam kapısı; olay silmeden düzelt.
- PR3b yalnız hâlâ gerekirse: production organic seçimi için bounded son-kategori/son-kullanım dengesi. Mevcut life-content cadence, açık case ve callback önceliği korunur. Bütün event engine yeniden yazılmaz.
- Paket2'nin milestone ID sözleşmesi ihtiyaç duyulan olaylarda kullanılır; beklerken olay envanteri ve hedefli fixture hazırlanabilir.
- Kabul: 5/10/20 yıl aynı seed/politika karşılaştırması; anlamsız taşınma tekrarı yok; olay sayısı sıfıra düşmüyor; açık case zamanında ve bir kez; TR/EN olay niyeti aynı; anı ve meaningful eski dallar korunur. Yalnız toplam ID tekrar yüzdesine göre PASS verilmez.

### Paket 4 — İsteğe bağlı oyuncu yönü ve sürdürülebilir hedef (C01)

- PR4a: mevcut yıllık öncelik seçimini currentGoal/hafta planına bağla; uygun olmayan hedefte neden/alternatif göster; boş seçimi serbest yaşam olarak koru.
- PR4b: yalnız mevcut Hedefler ekranında gerçek canonical aşama/ilerleme ve değiştirilebilir ana yön. Yeni 22. ekran, zorunlu görev listesi, rastgele ödül parası, ayrı siyaset/suç motoru yok.
- Paket1'in hedef saklama sözleşmesine dayanır; aynı goal persistence işini tekrar yapmaz. Paket1 merge beklerken salt fixture ve kabul senaryoları hazırlanabilir; ürün uygulaması onun sonucuna rebase edilir.
- Kabul: aile/sağlık gibi para dışı hedefler; seç/değiştir/serbest yaşam; gerçek aşama ve geçmiş korunumu; V5/V6; currentGoal'un yıllık tercihi gerçekten okuması; konut uygunluğu yalnız nakitten %100 sayılmaz.

### Paket 5 — Yanıltıcı işlem vaatlerini mevcut davranışa bağlama (B02 zarf davranışı+B05)

- PR5a: depozito zarfında mevcut banka/bütçe karşılığı veya doğru niyet notu; Paket1’in kalıcı hedef sözleşmesini kullanır, ikinci bir goal store eklemez.
- PR5b: yalnız `lc_credit_limit` ve `lc_late_clinic` için sahiplik/uygunluk, gerçek işlem veya doğru niyet etiketi. Bütün kartları tek tek yeniden yazma/silme işi yok.
- Paket2 milestone onarımı ve Paket3 tekrar bağlamı ile bağımsız hazırlanabilir. Zarf davranışının entegrasyonu Paket1 sözleşmesini bekler; kart/klinik iki dar düzeltmesi bu sırada hazır olabilir.
- Kabul: para/varlık korunumu ve anlamı doğru anı; gerçek takip/işlem olmadan “yapıldı” mesajı yok; TR/EN aynı niyet; aktif eski olaya yüklemede geriye dönük varlık/tedavi uydurulmaz. Tasarım/banka katsayıları/sağlık motoru değişmez.

### 8.1 En kısa güvenli sıra

1. Paket1 PR1a ve Paket2 PR2a bağımsız hazırlanır; ortak save sözleşmesi başta yazılılaştırılır.
2. Birinin zorunlu CI'sı beklerken ötekinin dar test/incelemesi ilerletilir; CI sürekli izlenmez.
3. Paket1 bütünlüğü sonrası Paket4 ve Paket5’in zarf entegrasyonu; Paket2 milestone köprüsü sonrası Paket3'ün ona ihtiyaç duyan koşulları. Diğer pakette beklenen merge üzerine aynı dosyanın ikinci çözümü yazılmaz.
4. Her PR yalnız kendi davranışını ve hedefli testini taşır. Son entegrasyonda bir defa ilgili bütünleşik TC doğrulaması; gereksiz yeniden build/optimizasyon yok.
5. Yayın ve merge ayrı yetkili uygulama fazına aittir. Bu rapor hiçbir paketin “uygulandı”, “merge edildi” veya “canlıda” kanıtı değildir.

## 9. Riskler, korunacak sınırlar ve yanlış teşhisler

- **UI:** 21 route, navbar/sidebar yerleşimi, tipografi, ekran ölçüsü, lacivert/altın renkler ve üç harita korunur. Davranış düzeltmesi yeni modal/menü gerektirmez. Kaynak WebP'ler incelendi: İstanbul Boğaz/Haliç, Ankara kara şehri, İzmir körfezi illüstratif dilde ayrışıyor. Bunlar ölçekli idarî haritalar değildir; overlay adları HTML'dir. Yeni sanat siparişi yok.
- **Save:** V5/V6; eski kayıt para/borç, geçmiş, mevcut aktif olay ve seçimi korunur. Yeni niyet/rotation alanı varsa additive, sınırlı ve idempotent. Geçmiş zarf parasını/milestone'u/başarısını uydurmak yok.
- **Finans:** bank-account transferi gelir sayılmaz; yeni hedef kodu `transact`/mevcut transfer dışında para yazmaz. Mortgage/icra/katsayılar ve negatif nakit/300.000 temerrüt tasarım kararı değiştirilmez.
- **Olaylar:** queue/due callback, once/seen ve cooldown sözleşmeleri önceliklidir. Sonlu havuzun uzun dönemde tekrar etmesi hata değildir. Katılımı kesilen sosyal hayatı otomatik doldurmak, oyuncu kararını etkisizleştirir.
- **NPC gizliliği:** known metin→ID onarımı bilinmeyen gelişmeyi açık etmemeli. `single/tight` kusuru bütün roster'lara genellenmez. Personel değişimini gerçek kimlikle bağlamak, NPC sayısını artırmaktan önce gelir.
- **Hikâye:** anlamlı eski kararlar ve hikâyeler silinmez. Zarf gibi yanıltıcı seçenekte “kaldır” ilk refleks değil; mevcut mekanikle gerçek sonuç veya doğru ifade tercih edilir.
- **Ölçüm:** 20 yıl ileri yaş/emeklilik/ölüm kapsamı değildir; bunların mevcut ayrı testleri ve kaynakları okundu/ilgili testleri çalıştırıldı. “20 yıllık koşu geçti, bütün ömür kusursuz” denmez. Yeni gerçek browser kabulünün eksikliği açıkça kayıtlıdır.
- **Altyapı:** diğer TarikLab oyunları, Cloudflare/CI/deployment, Vercel, ses ve native yüzeyleri değişmez. Raporu taşımak için ürün değişikliği gerekmez.

## 10. Çalıştırma ve yeniden üretim kaydı

Denetim gözlemcileri `audit-evidence/probe.mjs` ve `focused-extra.mjs`; tam izler `trace-<politika>-<seed>.json`; toplu sonuç `results.json`; fonksiyon probları `focused.json`/`focused-extra.json`; havuz envanteri `pools.json`. Bunlar ürün/test altyapısı değildir, repo'ya eklenmez. Kayıp olmaması için bu raporda sayılar ve uygulama reçeteleri bağımsız olarak verildi.

Ana koşu tarifi: `present_day`, seed41/73, sabit createdAt, yukarıdaki başlangıç fixture'ı → her hafta mevcut availability kapılarıyla politika → açık olayları uygun tercih ile çöz → `advanceWeek` → açık olayları çöz → `validateState` → her48 haftada save/load → 240/480/960 checkpoint. B01/B02/B04 tekil reçeteleri ilgili bulgu altında aynen yeniden kurulabilir.

Nihai TC komutu (ürün veya workflow değiştirmeden):

```sh
node --test --test-skip-pattern='40 seeds|40 strategy|20 strategy|40 production|20x8' scripts/tc-sim-*.test.mjs scripts/wave4-tc-sim-*.test.mjs
```

`40 seeds×16 strateji`, `40 strategy`, `20 strategy`, `40 production`, `20×8 ömür yoğunluğu` başlıklı pahalı matrisler bu audit için yeniden talep edilmedi; yerine hedefe özel 17.280 haftalık ölçüm var. Matris dışlama yerel inceleme kapsamıdır; zorunlu CI korumasını değiştirmek/atlamak değildir. İlk eksik shared/i18n fixture okumalarından kaynaklanan hatalar kopya tamamlanınca tekrarlandı; UI12/12 ve region-target4/4 geçti. Bu sonuçlar gerçek browser sonucu değildir. Bütün final koşu sayısı aşağıdaki otomatik kapanış satırında verilir.

**Bu SHA üzerinde nihai yerel TC sonucu: 910/910 PASS, 0 fail, 0 cancelled, 0 reported skip (197,05 saniye).** `--test-skip-pattern` ile eşleşen beş pahalı test yürütülmedi ve bu 910 sayısına dahil değildir. Ana 16 senaryo + replay + alternatif tercih ayrıca 17.280 hafta; V5/V6/finans/iş/aile/UI handler/yerel harita kontratları bu testler kapsamındadır. Kanıt: `domain-receipt.tap`. Bu, GitHub CI veya gerçek Chromium kabulü yerine geçmez.

## Ek A — İki belgenin madde madde A/B/C/D denetimi

**Sözleşme:** A=var ve belirtilen kanıt kapsamıyla doğrulanmış; B=omurga var, aşağıdaki bağlantı/derinlik tamam değil; C=bu raporun kanıtladığı gerekli yeni bağ; D=koruma kuralı, yeni ürün işi olmayan inceleme talebi, mükerrer/opsiyonel/erteli veya doğrulanmadığı için uygulama hükmü verilmeyen istek. D “kesinlikle yok” demek değildir. Her satır E kanıt dizinine bağlıdır; orada dosya, fonksiyon, mevcut test ve gözlem kapsamı bulunur. Aynı öneri farklı belgede yeniden geçse de uygulama paketinde ikinci iş oluşturmaz.

Belge1=`Yapıştırılan metin(20261021-171817).txt`; Belge2=`Yapıştırılan metin (2).txt`. Satır numaraları sağlanan UTF-8 dosyalarının `splitlines()` sırasıdır.

| Kaynak satırı | Öneri / inceleme maddesi | Sınıf | Kanıt | Karar ve eksik bağ |
| --- | --- | --- | --- | --- |
| B1:24 | Mevcut hikâyeleri, olayları, karakterleri, kararları ve anlamlı oynanış içeriklerini koru. | D | E18 | Koruma/kalite ilkesi; bağımsız yeni özellik değil. |
| B1:25 | Oyunun her ekranını, menüsünü, alt menüsünü ve oynanış sistemini ciddi biçimde eleştirerek incele. | D | E18 | Koruma/kalite ilkesi; bağımsız yeni özellik değil. |
| B1:26 | **Gereksiz seçenekleri, açıklamaları, yazıları, başlıkları ve bilgi kalabalığını kaldır.** | D | E18 | Koruma/kalite ilkesi; bağımsız yeni özellik değil. |
| B1:27 | **İşlevsiz, hiçbir işlem gerçekleştirmeyen, hiçbir sonuç üretmeyen veya oyuncuya fayda sağlamayan seçenekleri kaldır.** | D | E18 | Koruma/kalite ilkesi; bağımsız yeni özellik değil. |
| B1:28 | Birbirini tekrarlayan seçenekleri birleştir. | D | E18 | Koruma/kalite ilkesi; bağımsız yeni özellik değil. |
| B1:29 | Kullanılmayan veya artık karşılığı bulunmayan menüleri temizle. | D | E18 | Koruma/kalite ilkesi; bağımsız yeni özellik değil. |
| B1:30 | Sadece dekoratif amaçla duran ama etkileşimliymiş gibi görünen butonları kaldır veya doğru biçimde düzenle. | D | E18 | Koruma/kalite ilkesi; bağımsız yeni özellik değil. |
| B1:31 | Oyuncunun kararlarını, sonuçlarını ve oyun ekonomisini etkileyen işlevleri sebepsiz yere silme. | D | E18 | Koruma/kalite ilkesi; bağımsız yeni özellik değil. |
| B1:32 | Her önemli işlem gerçek bir oyun sonucuna bağlanmalı. | D | E18 | Koruma/kalite ilkesi; bağımsız yeni özellik değil. |
| B1:33 | Gereksiz yeni sistemler ekleyerek oyunu daha da karmaşıklaştırma. | D | E18 | Koruma/kalite ilkesi; bağımsız yeni özellik değil. |
| B1:34 | Her geliştirme sırasında oyun boyutunu ve yükleme maliyetini mümkün olduğunca azalt. | D | E18 | Koruma/kalite ilkesi; bağımsız yeni özellik değil. |
| B1:35 | Türkçe ve İngilizce arayüzler arasında anlam ve işlev tutarlılığını koru. | D | E18 | Koruma/kalite ilkesi; bağımsız yeni özellik değil. |
| B1:36 | Mevcut kayıt dosyalarıyla geriye dönük uyumluluğu koru. | D | E18 | Koruma/kalite ilkesi; bağımsız yeni özellik değil. |
| B1:37 | Kritik oyun mantığını, finans hesaplarını ve kayıt sistemini doğrulamadan değiştirme. | D | E18 | Koruma/kalite ilkesi; bağımsız yeni özellik değil. |
| B1:38 | Gereksiz test, kapsam dışı refaktör ve altyapı değişikliği yapma. | D | E18 | Koruma/kalite ilkesi; bağımsız yeni özellik değil. |
| B1:52 | Oyuna ilk giriş ve karakter oluşturma. | D | E01/E18 | Denetim talebi; bu rapordaki kapsam/sınırlar geçerli, varsayımsal düzeltme yok. |
| B1:53 | Ana ekran, durum göstergeleri ve gezinme. | D | E01/E18 | Denetim talebi; bu rapordaki kapsam/sınırlar geçerli, varsayımsal düzeltme yok. |
| B1:54 | Haftalık kararlar ve zaman ilerlemesi. | D | E01/E18 | Denetim talebi; bu rapordaki kapsam/sınırlar geçerli, varsayımsal düzeltme yok. |
| B1:55 | İş, gelir, harcama ve yaşam koşulları. | D | E01/E18 | Denetim talebi; bu rapordaki kapsam/sınırlar geçerli, varsayımsal düzeltme yok. |
| B1:56 | Bankalar, krediler, borçlar ve yatırımlar. | D | E01/E18 | Denetim talebi; bu rapordaki kapsam/sınırlar geçerli, varsayımsal düzeltme yok. |
| B1:57 | Konut, kira, mortgage ve icra. | D | E01/E18 | Denetim talebi; bu rapordaki kapsam/sınırlar geçerli, varsayımsal düzeltme yok. |
| B1:58 | Şehir, semt, taşınma ve ulaşım. | D | E01/E18 | Denetim talebi; bu rapordaki kapsam/sınırlar geçerli, varsayımsal düzeltme yok. |
| B1:59 | Aile, sosyal ilişkiler ve diğer yaşam sistemleri. | D | E01/E18 | Denetim talebi; bu rapordaki kapsam/sınırlar geçerli, varsayımsal düzeltme yok. |
| B1:60 | Yasal ve yasa dışı faaliyetler. | D | E01/E18 | Denetim talebi; bu rapordaki kapsam/sınırlar geçerli, varsayımsal düzeltme yok. |
| B1:61 | Rastgele olaylar ve sonuçları. | D | E01/E18 | Denetim talebi; bu rapordaki kapsam/sınırlar geçerli, varsayımsal düzeltme yok. |
| B1:62 | Ay sonu ve ekonomik ilerleme. | D | E01/E18 | Denetim talebi; bu rapordaki kapsam/sınırlar geçerli, varsayımsal düzeltme yok. |
| B1:63 | Kayıt, yükleme ve oyuna devam etme. | D | E01/E18 | Denetim talebi; bu rapordaki kapsam/sınırlar geçerli, varsayımsal düzeltme yok. |
| B1:64 | Mobil ve masaüstü görünüm. | D | E01/E18 | Denetim talebi; bu rapordaki kapsam/sınırlar geçerli, varsayımsal düzeltme yok. |
| B1:65 | Türkçe ve İngilizce içerikler. | D | E01/E18 | Denetim talebi; bu rapordaki kapsam/sınırlar geçerli, varsayımsal düzeltme yok. |
| B1:71 | Bu ekranın amacı açık mı? | D | E01/E18 | Denetim talebi; bu rapordaki kapsam/sınırlar geçerli, varsayımsal düzeltme yok. |
| B1:72 | Oyuncu ne yapacağını kolayca anlayabiliyor mu? | D | E01/E18 | Denetim talebi; bu rapordaki kapsam/sınırlar geçerli, varsayımsal düzeltme yok. |
| B1:73 | Gereksiz açıklama veya buton var mı? | D | E01/E18 | Denetim talebi; bu rapordaki kapsam/sınırlar geçerli, varsayımsal düzeltme yok. |
| B1:74 | Aynı işlev birden fazla yerde tekrar ediyor mu? | D | E01/E18 | Denetim talebi; bu rapordaki kapsam/sınırlar geçerli, varsayımsal düzeltme yok. |
| B1:75 | Çalışmayan veya sonucu olmayan seçenek var mı? | D | E01/E18 | Denetim talebi; bu rapordaki kapsam/sınırlar geçerli, varsayımsal düzeltme yok. |
| B1:76 | Yazılar ve butonlar gereğinden büyük mü? | D | E01/E18 | Denetim talebi; bu rapordaki kapsam/sınırlar geçerli, varsayımsal düzeltme yok. |
| B1:77 | Bilgiler mantıklı sırayla mı gösteriliyor? | D | E01/E18 | Denetim talebi; bu rapordaki kapsam/sınırlar geçerli, varsayımsal düzeltme yok. |
| B1:78 | Kararların bedeli ve sonucu anlaşılıyor mu? | D | E01/E18 | Denetim talebi; bu rapordaki kapsam/sınırlar geçerli, varsayımsal düzeltme yok. |
| B1:79 | Daha az alan kullanılarak daha iyi sunulabilir mi? | D | E01/E18 | Denetim talebi; bu rapordaki kapsam/sınırlar geçerli, varsayımsal düzeltme yok. |
| B1:95 | Kredi anaparası, faiz ve taksit hesapları. | A | E07/E08 | Mevcut finans/hukuk oyun modeli ve hedefli invariant testleri; yeniden kurma yok. |
| B1:96 | Kredi kullandırma ve ödeme işlemleri. | A | E07/E08 | Mevcut finans/hukuk oyun modeli ve hedefli invariant testleri; yeniden kurma yok. |
| B1:97 | Erken kapama ve kalan borç hesaplamaları. | A | E07/E08 | Mevcut finans/hukuk oyun modeli ve hedefli invariant testleri; yeniden kurma yok. |
| B1:98 | Gecikme ve temerrüt sonuçları. | A | E07/E08 | Mevcut finans/hukuk oyun modeli ve hedefli invariant testleri; yeniden kurma yok. |
| B1:99 | İcra ve haciz süreçleri. | A | E07/E08 | Mevcut finans/hukuk oyun modeli ve hedefli invariant testleri; yeniden kurma yok. |
| B1:100 | Borçların kapanması ve muhasebe tutarlılığı. | A | E07/E08 | Mevcut finans/hukuk oyun modeli ve hedefli invariant testleri; yeniden kurma yok. |
| B1:101 | Aynı borcun iki kez tahsil edilmesi veya kaybolması. | A | E07/E08 | Mevcut finans/hukuk oyun modeli ve hedefli invariant testleri; yeniden kurma yok. |
| B1:102 | Para yaratılması veya yok olması gibi ekonomi açıkları. | A | E07/E08 | Mevcut finans/hukuk oyun modeli ve hedefli invariant testleri; yeniden kurma yok. |
| B1:106 | Satın alınan evin net servete doğru eklenmesi. | A | E08 | Mevcut konut/net servet/borç tek sayım sözleşmesi doğrulanır. |
| B1:107 | Konut kredisi borcunun doğru düşülmesi. | A | E08 | Mevcut konut/net servet/borç tek sayım sözleşmesi doğrulanır. |
| B1:108 | Ev değerinin iki kez hesaplanmasının engellenmesi. | A | E08 | Mevcut konut/net servet/borç tek sayım sözleşmesi doğrulanır. |
| B1:109 | Kira, satın alma ve taşınma giderleri. | A | E08 | Mevcut konut/net servet/borç tek sayım sözleşmesi doğrulanır. |
| B1:110 | Konut sahipliği ile mortgage ve icra sistemlerinin tutarlılığı. | A | E08 | Mevcut konut/net servet/borç tek sayım sözleşmesi doğrulanır. |
| B1:114 | Eski kayıtların sorunsuz açılması. | A | E15/E16 | Kayıt/atomiklik/zaman/sınır değer omurgası ve mevcut testler var; tüm durum garantisi değil. |
| B1:115 | Kaydedilen para, borç, varlık ve olayların doğru yüklenmesi. | A | E15/E16 | Kayıt/atomiklik/zaman/sınır değer omurgası ve mevcut testler var; tüm durum garantisi değil. |
| B1:116 | Çift tıklama nedeniyle tekrarlanan işlemlerin önlenmesi. | A | E15/E16 | Kayıt/atomiklik/zaman/sınır değer omurgası ve mevcut testler var; tüm durum garantisi değil. |
| B1:117 | Haftalık ve aylık zaman ilerlemesinin tutarlılığı. | A | E15/E16 | Kayıt/atomiklik/zaman/sınır değer omurgası ve mevcut testler var; tüm durum garantisi değil. |
| B1:118 | Negatif bakiye, büyük borç ve sınır değer senaryoları. | A | E15/E16 | Kayıt/atomiklik/zaman/sınır değer omurgası ve mevcut testler var; tüm durum garantisi değil. |
| B1:119 | Oyun ilerlemesini bozan kilitlenmeler ve hatalı durumlar. | A | E15/E16 | Kayıt/atomiklik/zaman/sınır değer omurgası ve mevcut testler var; tüm durum garantisi değil. |
| B1:133 | Bütün seçenek butonlarının boyutlarını ölçülü biçimde küçült. | D | E01/E18 | Güncel 21 ekran/ölçü korumalı; eski toplu yeniden boyutlandırma isteği uygulanmaz. |
| B1:134 | Gereğinden büyük başlıkları ve metinleri yeniden ölçeklendir. | D | E01/E18 | Güncel 21 ekran/ölçü korumalı; eski toplu yeniden boyutlandırma isteği uygulanmaz. |
| B1:135 | Kart yüksekliklerini ve iç boşlukları azalt. | D | E01/E18 | Güncel 21 ekran/ölçü korumalı; eski toplu yeniden boyutlandırma isteği uygulanmaz. |
| B1:136 | Gereksiz dikey ve yatay boşlukları kaldır. | D | E01/E18 | Güncel 21 ekran/ölçü korumalı; eski toplu yeniden boyutlandırma isteği uygulanmaz. |
| B1:137 | Butonları tutarlı biçimde hizala. | D | E01/E18 | Güncel 21 ekran/ölçü korumalı; eski toplu yeniden boyutlandırma isteği uygulanmaz. |
| B1:138 | Ekrandaki görsel hiyerarşiyi yeniden kur. | D | E01/E18 | Güncel 21 ekran/ölçü korumalı; eski toplu yeniden boyutlandırma isteği uygulanmaz. |
| B1:139 | Önemli kararları ve bilgileri ön plana çıkar. | D | E01/E18 | Güncel 21 ekran/ölçü korumalı; eski toplu yeniden boyutlandırma isteği uygulanmaz. |
| B1:140 | İkincil bilgileri açılır bölümlere veya uygun alt menülere taşı. | D | E01/E18 | Güncel 21 ekran/ölçü korumalı; eski toplu yeniden boyutlandırma isteği uygulanmaz. |
| B1:141 | Uzun açıklamaları anlaşılır ve kısa hâle getir. | D | E01/E18 | Güncel 21 ekran/ölçü korumalı; eski toplu yeniden boyutlandırma isteği uygulanmaz. |
| B1:142 | Her yerde aynı tipografi, boşluk ve bileşen kurallarını kullan. | D | E01/E18 | Güncel 21 ekran/ölçü korumalı; eski toplu yeniden boyutlandırma isteği uygulanmaz. |
| B1:143 | Mobilde dokunma alanlarını kullanılabilir tut. | D | E01/E18 | Güncel 21 ekran/ölçü korumalı; eski toplu yeniden boyutlandırma isteği uygulanmaz. |
| B1:144 | Küçük ekranlarda taşma ve yatay kaydırma sorunlarını gider. | D | E01/E18 | Güncel 21 ekran/ölçü korumalı; eski toplu yeniden boyutlandırma isteği uygulanmaz. |
| B1:145 | Masaüstünde gereksiz büyütülmüş mobil tasarım görünümünü kaldır. | D | E01/E18 | Güncel 21 ekran/ölçü korumalı; eski toplu yeniden boyutlandırma isteği uygulanmaz. |
| B1:165 | Toplam kullanılabilir para. | A | E07/E14 | Mevcut hesap/kart/kredi/akış ekranları ve işlem testleri var; ikinci banka menüsü yok. |
| B1:166 | Toplam kredi ve kart borcu. | A | E07/E14 | Mevcut hesap/kart/kredi/akış ekranları ve işlem testleri var; ikinci banka menüsü yok. |
| B1:167 | Yaklaşan ödeme. | A | E07/E14 | Mevcut hesap/kart/kredi/akış ekranları ve işlem testleri var; ikinci banka menüsü yok. |
| B1:168 | Ödeme durumu. | A | E07/E14 | Mevcut hesap/kart/kredi/akış ekranları ve işlem testleri var; ikinci banka menüsü yok. |
| B1:169 | Varsa önemli finansal uyarılar. | A | E07/E14 | Mevcut hesap/kart/kredi/akış ekranları ve işlem testleri var; ikinci banka menüsü yok. |
| B1:173 | Mevcut hesap işlemleri. | A | E07/E14 | Mevcut hesap/kart/kredi/akış ekranları ve işlem testleri var; ikinci banka menüsü yok. |
| B1:174 | Kart kullanımı ve borç durumu. | A | E07/E14 | Mevcut hesap/kart/kredi/akış ekranları ve işlem testleri var; ikinci banka menüsü yok. |
| B1:175 | İşlem geçmişi. | A | E07/E14 | Mevcut hesap/kart/kredi/akış ekranları ve işlem testleri var; ikinci banka menüsü yok. |
| B1:176 | Gereksiz veya tekrar eden hesap seçeneklerinin temizlenmesi. | A | E07/E14 | Mevcut hesap/kart/kredi/akış ekranları ve işlem testleri var; ikinci banka menüsü yok. |
| B1:180 | Mevcut krediler. | A | E07/E14 | Mevcut hesap/kart/kredi/akış ekranları ve işlem testleri var; ikinci banka menüsü yok. |
| B1:181 | Yeni kredi seçenekleri. | A | E07/E14 | Mevcut hesap/kart/kredi/akış ekranları ve işlem testleri var; ikinci banka menüsü yok. |
| B1:182 | Faiz oranı. | A | E07/E14 | Mevcut hesap/kart/kredi/akış ekranları ve işlem testleri var; ikinci banka menüsü yok. |
| B1:183 | Taksit tutarı. | A | E07/E14 | Mevcut hesap/kart/kredi/akış ekranları ve işlem testleri var; ikinci banka menüsü yok. |
| B1:184 | Toplam geri ödeme. | A | E07/E14 | Mevcut hesap/kart/kredi/akış ekranları ve işlem testleri var; ikinci banka menüsü yok. |
| B1:185 | Kalan borç. | A | E07/E14 | Mevcut hesap/kart/kredi/akış ekranları ve işlem testleri var; ikinci banka menüsü yok. |
| B1:186 | Sonraki ödeme tarihi. | A | E07/E14 | Mevcut hesap/kart/kredi/akış ekranları ve işlem testleri var; ikinci banka menüsü yok. |
| B1:187 | Erken kapama. | A | E07/E14 | Mevcut hesap/kart/kredi/akış ekranları ve işlem testleri var; ikinci banka menüsü yok. |
| B1:188 | Gecikme ve icra durumu. | A | E07/E14 | Mevcut hesap/kart/kredi/akış ekranları ve işlem testleri var; ikinci banka menüsü yok. |
| B1:192 | Mevcut yatırım araçları. | A | E07/E12/E15 | Mevcut banka/yatırım ekranındaki gösterim kapsamı; yeni ürün yok. |
| B1:193 | Bakiye ve varlık durumu. | A | E07/E14 | Mevcut hesap/kart/kredi/akış ekranları ve işlem testleri var; ikinci banka menüsü yok. |
| B1:194 | İşlem maliyetleri. | A | E07/E14 | Mevcut hesap/kart/kredi/akış ekranları ve işlem testleri var; ikinci banka menüsü yok. |
| B1:195 | Risk ve getiri bilgilerinin anlaşılır sunumu. | A | E07/E12/E15 | Mevcut banka/yatırım ekranındaki gösterim kapsamı; yeni ürün yok. |
| B1:199 | Gerçek işlem yapmayan seçenekler kaldırılmalı. | B | E07/E15 | İşlem/gate temeli mevcut; bütün etiketleri kusursuz veya işlevsiz ilan eden kanıt yok, yalnız B02 hedeflenir. |
| B1:200 | Birbirini tekrarlayan kredi işlemleri birleştirilmeli. | B | E07/E15 | İşlem/gate temeli mevcut; bütün etiketleri kusursuz veya işlevsiz ilan eden kanıt yok, yalnız B02 hedeflenir. |
| B1:201 | Kullanılmayan açıklamalar temizlenmeli. | B | E07/E15 | İşlem/gate temeli mevcut; bütün etiketleri kusursuz veya işlevsiz ilan eden kanıt yok, yalnız B02 hedeflenir. |
| B1:202 | Kredi sonuçları işlemden önce görülebilmeli. | B | E07/E15 | İşlem/gate temeli mevcut; bütün etiketleri kusursuz veya işlevsiz ilan eden kanıt yok, yalnız B02 hedeflenir. |
| B1:203 | Kredi uygunluğu ve reddedilme nedenleri açıklanmalı. | B | E07/E15 | İşlem/gate temeli mevcut; bütün etiketleri kusursuz veya işlevsiz ilan eden kanıt yok, yalnız B02 hedeflenir. |
| B1:204 | Ödeme işlemleri oyuncuya açık geri bildirim vermeli. | B | E07/E15 | İşlem/gate temeli mevcut; bütün etiketleri kusursuz veya işlevsiz ilan eden kanıt yok, yalnız B02 hedeflenir. |
| B1:205 | Bankacılık ekranı bir bilgi ansiklopedisi değil, oynanabilir bir finans yönetim merkezi olmalı. | B | E07/E15 | İşlem/gate temeli mevcut; bütün etiketleri kusursuz veya işlevsiz ilan eden kanıt yok, yalnız B02 hedeflenir. |
| B1:217 | Gereksiz seçenekler. | D | E01/E15/E18 | Toplu silme/birleştirme onayı yok; somut yanıltıcı zarf B02, diğerleri kanıt gerektirir. |
| B1:218 | İşlevsiz butonlar. | D | E01/E15/E18 | Toplu silme/birleştirme onayı yok; somut yanıltıcı zarf B02, diğerleri kanıt gerektirir. |
| B1:219 | Sonuç üretmeyen sahte etkileşimler. | D | E01/E15/E18 | Toplu silme/birleştirme onayı yok; somut yanıltıcı zarf B02, diğerleri kanıt gerektirir. |
| B1:220 | Birbirini tekrar eden menüler. | D | E01/E15/E18 | Toplu silme/birleştirme onayı yok; somut yanıltıcı zarf B02, diğerleri kanıt gerektirir. |
| B1:221 | Aynı bilgiyi farklı yerlerde tekrar eden yazılar. | D | E01/E15/E18 | Toplu silme/birleştirme onayı yok; somut yanıltıcı zarf B02, diğerleri kanıt gerektirir. |
| B1:222 | Oyuncunun işine yaramayan uzun açıklamalar. | D | E01/E15/E18 | Toplu silme/birleştirme onayı yok; somut yanıltıcı zarf B02, diğerleri kanıt gerektirir. |
| B1:223 | Gereksiz bilgi panelleri. | D | E01/E15/E18 | Toplu silme/birleştirme onayı yok; somut yanıltıcı zarf B02, diğerleri kanıt gerektirir. |
| B1:224 | Kullanılmayan arayüz bileşenleri. | D | E01/E15/E18 | Toplu silme/birleştirme onayı yok; somut yanıltıcı zarf B02, diğerleri kanıt gerektirir. |
| B1:225 | Artık erişilemeyen eski ekranlar. | D | E01/E15/E18 | Toplu silme/birleştirme onayı yok; somut yanıltıcı zarf B02, diğerleri kanıt gerektirir. |
| B1:226 | Yanıltıcı veya yanlış isimlendirilmiş seçenekler. | D | E01/E15/E18 | Toplu silme/birleştirme onayı yok; somut yanıltıcı zarf B02, diğerleri kanıt gerektirir. |
| B1:227 | Hiçbir koşulda kullanılamayan ve amaçsız kalan seçenekler. | D | E01/E15/E18 | Toplu silme/birleştirme onayı yok; somut yanıltıcı zarf B02, diğerleri kanıt gerektirir. |
| B1:228 | Hatalı bağlantılar ve boş ekranlar. | D | E01/E15/E18 | Toplu silme/birleştirme onayı yok; somut yanıltıcı zarf B02, diğerleri kanıt gerektirir. |
| B1:256 | Kira ve yaşam maliyeti. | A | E09 | Mevcut kira/ulaşım/müşteri/risk/sosyal ziyaret/taşınma etkileri testli. |
| B1:257 | İş ve müşteri fırsatları. | A | E09 | Mevcut kira/ulaşım/müşteri/risk/sosyal ziyaret/taşınma etkileri testli. |
| B1:258 | Güvenlik ve risk. | A | E09 | Mevcut kira/ulaşım/müşteri/risk/sosyal ziyaret/taşınma etkileri testli. |
| B1:259 | Ulaşım maliyeti. | A | E09 | Mevcut kira/ulaşım/müşteri/risk/sosyal ziyaret/taşınma etkileri testli. |
| B1:260 | Günlük zaman kullanımı. | A | E09 | Mevcut kira/ulaşım/müşteri/risk/sosyal ziyaret/taşınma etkileri testli. |
| B1:261 | Sosyal ilişkiler ve aile ziyaretleri. | A | E09 | Mevcut kira/ulaşım/müşteri/risk/sosyal ziyaret/taşınma etkileri testli. |
| B1:269 | Konut satın alma sürecinin netleştirilmesi. | A | E08 | Mevcut konut-mortgage-icra-net servet zinciri; mükerrer iş. |
| B1:270 | Peşinat ve kredi hesaplarının tutarlılığı. | A | E08 | Mevcut konut-mortgage-icra-net servet zinciri; mükerrer iş. |
| B1:271 | Düzenli taksitlerin doğru uygulanması. | A | E08 | Mevcut konut-mortgage-icra-net servet zinciri; mükerrer iş. |
| B1:272 | Gecikme, temerrüt ve icra sonuçları. | A | E08 | Mevcut konut-mortgage-icra-net servet zinciri; mükerrer iş. |
| B1:273 | Ev sahipliğinin servete etkisi. | A | E08 | Mevcut konut-mortgage-icra-net servet zinciri; mükerrer iş. |
| B1:274 | Ev satışı veya haciz sonrasında borçların doğru hesaplanması. | A | E08 | Mevcut konut-mortgage-icra-net servet zinciri; mükerrer iş. |
| B1:286 | Oyuncu kararının bedelini önceden görebilmeli. | B | E15/E04 | Maliyet/gate ve sonuç altyapısı var; bazı hikâye vaatleri ve bağlam B01–B03 ile eksik. |
| B1:287 | Belirsiz sonuçlar kesin sonuç gibi gösterilmemeli. | B | E15/E04 | Maliyet/gate ve sonuç altyapısı var; bazı hikâye vaatleri ve bağlam B01–B03 ile eksik. |
| B1:288 | Önemli kararların sonraki haftalara etkisi korunmalı. | B | E15/E04 | Maliyet/gate ve sonuç altyapısı var; bazı hikâye vaatleri ve bağlam B01–B03 ile eksik. |
| B1:289 | Ekonomik ve sosyal sonuçlar birbiriyle çelişmemeli. | B | E15/E04 | Maliyet/gate ve sonuç altyapısı var; bazı hikâye vaatleri ve bağlam B01–B03 ile eksik. |
| B1:290 | Kilitli seçeneklerin koşulları anlaşılır olmalı. | B | E15/E04 | Maliyet/gate ve sonuç altyapısı var; bazı hikâye vaatleri ve bağlam B01–B03 ile eksik. |
| B1:291 | Karar sonrasında neyin değiştiği açıkça gösterilmeli. | B | E15/E04 | Maliyet/gate ve sonuç altyapısı var; bazı hikâye vaatleri ve bağlam B01–B03 ile eksik. |
| B1:301 | Mevcut para. | A | E14 | Mevcut haftalık durum/odak/dosya ve değişim özeti var. |
| B1:302 | Yaklaşan ödemeler. | A | E14 | Mevcut haftalık durum/odak/dosya ve değişim özeti var. |
| B1:303 | Kalan işlem hakları. | A | E14 | Mevcut haftalık durum/odak/dosya ve değişim özeti var. |
| B1:304 | Kritik riskler. | A | E14 | Mevcut haftalık durum/odak/dosya ve değişim özeti var. |
| B1:305 | Dikkat gerektiren gelişmeler. | A | E14 | Mevcut haftalık durum/odak/dosya ve değişim özeti var. |
| B1:315 | Toplam gelir. | A | E14 | Mevcut ay kartındaki nakit/servet/kalan hak; raporda nakit esaslı sınır açıklanır. |
| B1:316 | Toplam gider. | A | E14 | Mevcut ay kartındaki nakit/servet/kalan hak; raporda nakit esaslı sınır açıklanır. |
| B1:317 | Borç değişimi. | B | E14 | Ay kartı var; bu ek alan/özet P2, otomatik uygulama yok. |
| B1:318 | Net servet değişimi. | A | E14 | Mevcut ay kartındaki nakit/servet/kalan hak; raporda nakit esaslı sınır açıklanır. |
| B1:319 | Kalan işlem hakları veya dönem durumu. | A | E14 | Mevcut ay kartındaki nakit/servet/kalan hak; raporda nakit esaslı sınır açıklanır. |
| B1:320 | Önemli olaylar ve sonuçlar. | B | E14 | Ay kartı var; bu ek alan/özet P2, otomatik uygulama yok. |
| B1:342 | Otomatik kayıt durumunun anlaşılır olması. | A | E16 | Kayıt/yedek/hata geri bildirimi mevcut; yeni save motoru yok. |
| B1:343 | Kayıt ve yükleme hatalarının görünür hâle gelmesi. | A | E16 | Kayıt/yedek/hata geri bildirimi mevcut; yeni save motoru yok. |
| B1:344 | Mevcut kayıtların korunması. | A | E16 | Kayıt/yedek/hata geri bildirimi mevcut; yeni save motoru yok. |
| B1:345 | Uygun bir yedekleme ve geri yükleme imkânı. | A | E16 | Kayıt/yedek/hata geri bildirimi mevcut; yeni save motoru yok. |
| B1:346 | Geri dönüşü zor önemli işlemlerde sonuçların açık gösterilmesi. | A | E16 | Kayıt/yedek/hata geri bildirimi mevcut; yeni save motoru yok. |
| B1:356 | Kullanılmayan dosyaları ve kodları doğrulayarak temizle. | D | E18 | Genel boyut/perf/bağımlılık refaktörü bu fazda erteli; somut P0 ölçülmedi. |
| B1:357 | Gereksiz bağımlılıkları tespit et. | D | E18 | Genel boyut/perf/bağımlılık refaktörü bu fazda erteli; somut P0 ölçülmedi. |
| B1:358 | Tekrarlanan arayüz kodlarını ortaklaştır. | D | E18 | Genel boyut/perf/bağımlılık refaktörü bu fazda erteli; somut P0 ölçülmedi. |
| B1:359 | Kullanılmayan CSS kurallarını kaldır. | D | E18 | Genel boyut/perf/bağımlılık refaktörü bu fazda erteli; somut P0 ölçülmedi. |
| B1:360 | Gereksiz büyük görselleri optimize et. | D | E18 | Genel boyut/perf/bağımlılık refaktörü bu fazda erteli; somut P0 ölçülmedi. |
| B1:361 | Görselleri gerçek görüntülenme boyutlarına uygun sun. | D | E18 | Genel boyut/perf/bağımlılık refaktörü bu fazda erteli; somut P0 ölçülmedi. |
| B1:362 | Uygun yerlerde modern ve verimli görsel formatları kullan. | D | E18 | Genel boyut/perf/bağımlılık refaktörü bu fazda erteli; somut P0 ölçülmedi. |
| B1:363 | Ağır ekranları ihtiyaç duyulduğunda yükle. | D | E18 | Genel boyut/perf/bağımlılık refaktörü bu fazda erteli; somut P0 ölçülmedi. |
| B1:364 | Gereksiz yeniden çizim ve hesaplamaları azalt. | D | E18 | Genel boyut/perf/bağımlılık refaktörü bu fazda erteli; somut P0 ölçülmedi. |
| B1:365 | İlk açılışta yüklenen veri miktarını düşür. | D | E18 | Genel boyut/perf/bağımlılık refaktörü bu fazda erteli; somut P0 ölçülmedi. |
| B1:366 | Eski kayıtları ve oyun mantığını bozmadan temizlik yap. | D | E18 | Genel boyut/perf/bağımlılık refaktörü bu fazda erteli; somut P0 ölçülmedi. |
| B2:19 | Ben kimim ve nasıl bir geçmişten geliyorum? | D | E18 | Genel tasarım sorusu/ilkesi; bağımsız ürün işi değil. |
| B2:20 | Hayattan ne istiyorum? | D | E18 | Genel tasarım sorusu/ilkesi; bağımsız ürün işi değil. |
| B2:21 | Neden çalışıyorum ve para kazanıyorum? | D | E18 | Genel tasarım sorusu/ilkesi; bağımsız ürün işi değil. |
| B2:22 | Neyi kaybetmekten korkuyorum? | D | E18 | Genel tasarım sorusu/ilkesi; bağımsız ürün işi değil. |
| B2:23 | Hayatımda hangi insanlarla bağ kuruyorum? | D | E18 | Genel tasarım sorusu/ilkesi; bağımsız ürün işi değil. |
| B2:24 | Beş yıl sonra nerede olmak istiyorum? | D | E18 | Genel tasarım sorusu/ilkesi; bağımsız ürün işi değil. |
| B2:25 | Başarılı olduğumu nasıl anlayacağım? | D | E18 | Genel tasarım sorusu/ilkesi; bağımsız ürün işi değil. |
| B2:26 | Yanlış kararlarım hayatımı nasıl değiştirecek? | D | E18 | Genel tasarım sorusu/ilkesi; bağımsız ürün işi değil. |
| B2:27 | Öldüğümde veya emekli olduğumda geride ne kalacak? | D | E18 | Genel tasarım sorusu/ilkesi; bağımsız ürün işi değil. |
| B2:46 | Düşük başlangıç sermayesi. | D | E02 | Yeni profil/preset katmanı P2/erteli; mevcut başlangıç bileşenleri var, yeni profil tamamlandı denmez. |
| B2:47 | Sınırlı sosyal çevre. | D | E02 | Yeni profil/preset katmanı P2/erteli; mevcut başlangıç bileşenleri var, yeni profil tamamlandı denmez. |
| B2:48 | Kısıtlı mesleki deneyim. | D | E02 | Yeni profil/preset katmanı P2/erteli; mevcut başlangıç bileşenleri var, yeni profil tamamlandı denmez. |
| B2:49 | Ekonomik yükselme için geniş hareket alanı. | D | E02 | Yeni profil/preset katmanı P2/erteli; mevcut başlangıç bileşenleri var, yeni profil tamamlandı denmez. |
| B2:50 | Kira, işsizlik ve geçim baskısı. | D | E02 | Yeni profil/preset katmanı P2/erteli; mevcut başlangıç bileşenleri var, yeni profil tamamlandı denmez. |
| B2:53 | Yüksek başlangıç sermayesi veya aile desteği. | D | E02 | Yeni profil/preset katmanı P2/erteli; mevcut başlangıç bileşenleri var, yeni profil tamamlandı denmez. |
| B2:54 | Güçlü sosyal bağlantılar. | D | E02 | Yeni profil/preset katmanı P2/erteli; mevcut başlangıç bileşenleri var, yeni profil tamamlandı denmez. |
| B2:55 | Aile beklentileri ve miras anlaşmazlıkları. | D | E02 | Yeni profil/preset katmanı P2/erteli; mevcut başlangıç bileşenleri var, yeni profil tamamlandı denmez. |
| B2:56 | İtibar kaybetme ve aileyle çatışma ihtimali. | D | E02 | Yeni profil/preset katmanı P2/erteli; mevcut başlangıç bileşenleri var, yeni profil tamamlandı denmez. |
| B2:57 | Ekonomik avantajın yanında sosyal baskılar. | D | E02 | Yeni profil/preset katmanı P2/erteli; mevcut başlangıç bileşenleri var, yeni profil tamamlandı denmez. |
| B2:60 | Aile işletmesiyle bağlantılı başlangıç. | D | E02 | Yeni profil/preset katmanı P2/erteli; mevcut başlangıç bileşenleri var, yeni profil tamamlandı denmez. |
| B2:61 | Mahalle çevresi ve müşteri ilişkileri. | D | E02 | Yeni profil/preset katmanı P2/erteli; mevcut başlangıç bileşenleri var, yeni profil tamamlandı denmez. |
| B2:62 | İşletmeyi büyütme veya başka bir hayat seçme imkânı. | D | E02 | Yeni profil/preset katmanı P2/erteli; mevcut başlangıç bileşenleri var, yeni profil tamamlandı denmez. |
| B2:63 | Aile borçları ve işletme sorumlulukları. | D | E02 | Yeni profil/preset katmanı P2/erteli; mevcut başlangıç bileşenleri var, yeni profil tamamlandı denmez. |
| B2:66 | Eğitim avantajı. | D | E02 | Yeni profil/preset katmanı P2/erteli; mevcut başlangıç bileşenleri var, yeni profil tamamlandı denmez. |
| B2:67 | Sınırlı gelir. | D | E02 | Yeni profil/preset katmanı P2/erteli; mevcut başlangıç bileşenleri var, yeni profil tamamlandı denmez. |
| B2:68 | İş arama ve mesleki rekabet. | D | E02 | Yeni profil/preset katmanı P2/erteli; mevcut başlangıç bileşenleri var, yeni profil tamamlandı denmez. |
| B2:69 | Başka şehre taşınma veya kariyer değiştirme seçenekleri. | D | E02 | Yeni profil/preset katmanı P2/erteli; mevcut başlangıç bileşenleri var, yeni profil tamamlandı denmez. |
| B2:72 | Mevcut borçlar. | D | E02 | Yeni profil/preset katmanı P2/erteli; mevcut başlangıç bileşenleri var, yeni profil tamamlandı denmez. |
| B2:73 | İş deneyimi. | D | E02 | Yeni profil/preset katmanı P2/erteli; mevcut başlangıç bileşenleri var, yeni profil tamamlandı denmez. |
| B2:74 | Yüksek riskli ekonomik başlangıç. | D | E02 | Yeni profil/preset katmanı P2/erteli; mevcut başlangıç bileşenleri var, yeni profil tamamlandı denmez. |
| B2:75 | İşletmeyi kurtarma, büyütme veya iflas etme ihtimali. | D | E02 | Yeni profil/preset katmanı P2/erteli; mevcut başlangıç bileşenleri var, yeni profil tamamlandı denmez. |
| B2:78 | Yeni bir sosyal çevre oluşturma ihtiyacı. | D | E02 | Yeni profil/preset katmanı P2/erteli; mevcut başlangıç bileşenleri var, yeni profil tamamlandı denmez. |
| B2:79 | Barınma ve iş bulma sorunları. | D | E02 | Yeni profil/preset katmanı P2/erteli; mevcut başlangıç bileşenleri var, yeni profil tamamlandı denmez. |
| B2:80 | Memleketle ilişkiler. | D | E02 | Yeni profil/preset katmanı P2/erteli; mevcut başlangıç bileşenleri var, yeni profil tamamlandı denmez. |
| B2:81 | Şehir yaşamına uyum süreci. | D | E02 | Yeni profil/preset katmanı P2/erteli; mevcut başlangıç bileşenleri var, yeni profil tamamlandı denmez. |
| B2:87 | Başlangıç parası. | D | E02 | Yeni profil/preset katmanı P2/erteli; mevcut başlangıç bileşenleri var, yeni profil tamamlandı denmez. |
| B2:88 | Borç ve yükümlülükler. | D | E02 | Yeni profil/preset katmanı P2/erteli; mevcut başlangıç bileşenleri var, yeni profil tamamlandı denmez. |
| B2:89 | Eğitim. | D | E02 | Yeni profil/preset katmanı P2/erteli; mevcut başlangıç bileşenleri var, yeni profil tamamlandı denmez. |
| B2:90 | Mesleki deneyim. | D | E02 | Yeni profil/preset katmanı P2/erteli; mevcut başlangıç bileşenleri var, yeni profil tamamlandı denmez. |
| B2:91 | Aile ilişkileri. | D | E02 | Yeni profil/preset katmanı P2/erteli; mevcut başlangıç bileşenleri var, yeni profil tamamlandı denmez. |
| B2:92 | Sosyal bağlantılar. | D | E02 | Yeni profil/preset katmanı P2/erteli; mevcut başlangıç bileşenleri var, yeni profil tamamlandı denmez. |
| B2:93 | Başlangıç şehri ve semti. | D | E02 | Yeni profil/preset katmanı P2/erteli; mevcut başlangıç bileşenleri var, yeni profil tamamlandı denmez. |
| B2:94 | Konut durumu. | D | E02 | Yeni profil/preset katmanı P2/erteli; mevcut başlangıç bileşenleri var, yeni profil tamamlandı denmez. |
| B2:95 | Sağlık ve enerji. | D | E02 | Yeni profil/preset katmanı P2/erteli; mevcut başlangıç bileşenleri var, yeni profil tamamlandı denmez. |
| B2:96 | İtibar. | D | E02 | Yeni profil/preset katmanı P2/erteli; mevcut başlangıç bileşenleri var, yeni profil tamamlandı denmez. |
| B2:97 | Başlangıç fırsatları. | D | E02 | Yeni profil/preset katmanı P2/erteli; mevcut başlangıç bileşenleri var, yeni profil tamamlandı denmez. |
| B2:112 | İlk birikimi oluştur. | B | E03/E06/E08/E10/E12 | Alt eylem sistemleri var; seçilmiş uzun vadeli amacın aşaması olarak bağlanması C01. |
| B2:113 | Borçlarını kapat. | B | E03/E06/E08/E10/E12 | Alt eylem sistemleri var; seçilmiş uzun vadeli amacın aşaması olarak bağlanması C01. |
| B2:114 | Ev sahibi ol. | B | E03/E06/E08/E10/E12 | Alt eylem sistemleri var; seçilmiş uzun vadeli amacın aşaması olarak bağlanması C01. |
| B2:115 | Düzenli yatırım geliri oluştur. | B | E03/E06/E08/E10/E12 | Alt eylem sistemleri var; seçilmiş uzun vadeli amacın aşaması olarak bağlanması C01. |
| B2:116 | Finansal bağımsızlığa ulaş. | B | E03/E06/E08/E10/E12 | Alt eylem sistemleri var; seçilmiş uzun vadeli amacın aşaması olarak bağlanması C01. |
| B2:119 | Meslek edin. | B | E03/E06/E08/E10/E12 | Alt eylem sistemleri var; seçilmiş uzun vadeli amacın aşaması olarak bağlanması C01. |
| B2:120 | Düzenli iş bul. | B | E03/E06/E08/E10/E12 | Alt eylem sistemleri var; seçilmiş uzun vadeli amacın aşaması olarak bağlanması C01. |
| B2:121 | Terfi et. | B | E03/E06/E08/E10/E12 | Alt eylem sistemleri var; seçilmiş uzun vadeli amacın aşaması olarak bağlanması C01. |
| B2:122 | Alanında tanın. | B | E03/E06/E08/E10/E12 | Alt eylem sistemleri var; seçilmiş uzun vadeli amacın aşaması olarak bağlanması C01. |
| B2:123 | Mesleki zirveye ulaş. | B | E03/E06/E08/E10/E12 | Alt eylem sistemleri var; seçilmiş uzun vadeli amacın aşaması olarak bağlanması C01. |
| B2:126 | Sermaye biriktir. | B | E03/E06/E08/E10/E12 | Alt eylem sistemleri var; seçilmiş uzun vadeli amacın aşaması olarak bağlanması C01. |
| B2:127 | İlk işletmeni aç. | B | E03/E06/E08/E10/E12 | Alt eylem sistemleri var; seçilmiş uzun vadeli amacın aşaması olarak bağlanması C01. |
| B2:128 | İşletmeyi ayakta tut. | B | E03/E06/E08/E10/E12 | Alt eylem sistemleri var; seçilmiş uzun vadeli amacın aşaması olarak bağlanması C01. |
| B2:129 | Çalışan istihdam et. | B | E03/E06/E08/E10/E12 | Alt eylem sistemleri var; seçilmiş uzun vadeli amacın aşaması olarak bağlanması C01. |
| B2:130 | Birden fazla işletmeye sahip ol. | D | E12 | Tek büyük işletme ve bölgesel dükkânlar var; çoklu büyük işletme motoru P2/erteli. |
| B2:133 | Kalıcı ilişkiler kur. | B | E03/E06/E08/E10/E12 | Alt eylem sistemleri var; seçilmiş uzun vadeli amacın aşaması olarak bağlanması C01. |
| B2:134 | Evlilik veya uzun süreli birliktelik yaşa. | B | E03/E06/E08/E10/E12 | Alt eylem sistemleri var; seçilmiş uzun vadeli amacın aşaması olarak bağlanması C01. |
| B2:135 | Çocuk sahibi olmayı seçebil. | B | E03/E06/E08/E10/E12 | Alt eylem sistemleri var; seçilmiş uzun vadeli amacın aşaması olarak bağlanması C01. |
| B2:136 | Aile sorumluluklarını yönet. | B | E03/E06/E08/E10/E12 | Alt eylem sistemleri var; seçilmiş uzun vadeli amacın aşaması olarak bağlanması C01. |
| B2:137 | Güçlü bir sosyal çevre oluştur. | B | E03/E06/E08/E10/E12 | Alt eylem sistemleri var; seçilmiş uzun vadeli amacın aşaması olarak bağlanması C01. |
| B2:140 | Sosyal çevre ve itibar kazan. | D | E05/E11 | Ayrı siyaset/yeraltı kariyeri gerekli kanıtı yok; kapsamı büyütme. |
| B2:141 | Yerel toplumsal faaliyetlere katıl. | D | E05/E11 | Ayrı siyaset/yeraltı kariyeri gerekli kanıtı yok; kapsamı büyütme. |
| B2:142 | Siyasi bağlantılar oluştur. | D | E05/E11 | Ayrı siyaset/yeraltı kariyeri gerekli kanıtı yok; kapsamı büyütme. |
| B2:143 | Mevcut oyun kapsamına uygunsa siyasi kariyer fırsatlarına ilerle. | D | E05/E11 | Ayrı siyaset/yeraltı kariyeri gerekli kanıtı yok; kapsamı büyütme. |
| B2:146 | Riskli çevrelerle bağlantı kur. | B | E05/E11 | Risk ve sosyal sonuç var; ayrı kalıcı suç bağlantıları modeli tamamlandı sayılmaz. |
| B2:147 | Yasa dışı gelir fırsatlarıyla karşılaş. | A | E11 | Mevcut yasa dışı gelir ve adli sonuçlar; ayrı yeni kariyer tamamlandı denmez. |
| B2:148 | Rakipler, güven ve ihanet ilişkileri yaşa. | D | E05/E11 | Ayrı siyaset/yeraltı kariyeri gerekli kanıtı yok; kapsamı büyütme. |
| B2:149 | Kolluk ve adli süreçlerin sonuçlarıyla yüzleş. | A | E11 | Mevcut yasa dışı gelir ve adli sonuçlar; ayrı yeni kariyer tamamlandı denmez. |
| B2:150 | Suç dünyasında yükselme veya bu yaşamdan çıkma fırsatı bul. | B | E11 | Uzaklaşma gerçek; ayrı yeraltı dünyasında yükselme motoru tamamlandı sayılmaz. |
| B2:153 | Başka bir şehre taşın. | B | E03/E06/E08/E10/E12 | Alt eylem sistemleri var; seçilmiş uzun vadeli amacın aşaması olarak bağlanması C01. |
| B2:154 | Meslek değiştir. | B | E03/E06/E08/E10/E12 | Alt eylem sistemleri var; seçilmiş uzun vadeli amacın aşaması olarak bağlanması C01. |
| B2:155 | Sosyal çevreni yeniden oluştur. | B | E03/E06/E08/E10/E12 | Alt eylem sistemleri var; seçilmiş uzun vadeli amacın aşaması olarak bağlanması C01. |
| B2:156 | Geçmiş kararlarının sonuçlarıyla mücadele et. | B | E03/E06/E08/E10/E12 | Alt eylem sistemleri var; seçilmiş uzun vadeli amacın aşaması olarak bağlanması C01. |
| B2:157 | Farklı bir yaşam düzeni kur. | B | E03/E06/E08/E10/E12 | Alt eylem sistemleri var; seçilmiş uzun vadeli amacın aşaması olarak bağlanması C01. |
| B2:161 | Oyuncu ana hedefini seçebilmeli. | C | E03 | C01: isteğe bağlı kalıcı ana yön/serbest yaşam seçimi; mevcut yıllık öncelik bunun tamamı değil. |
| B2:162 | Yan hedefler bulunabilmeli. | B | E03 | Hedef/ilerleme omurgası var; B01/B02/C01 bütünlük ve seçilen yön bağlantısı eksik. |
| B2:163 | Hedefler zamanla değiştirilebilmeli. | C | E03 | C01: isteğe bağlı kalıcı ana yön/serbest yaşam seçimi; mevcut yıllık öncelik bunun tamamı değil. |
| B2:164 | Her hedefin somut ilerleme aşamaları olmalı. | B | E03 | Hedef/ilerleme omurgası var; B01/B02/C01 bütünlük ve seçilen yön bağlantısı eksik. |
| B2:165 | Hedeflere farklı yöntemlerle ulaşılabilmeli. | B | E03 | Hedef/ilerleme omurgası var; B01/B02/C01 bütünlük ve seçilen yön bağlantısı eksik. |
| B2:166 | Başarısızlık oyunu zorunlu olarak bitirmemeli. | B | E03 | Hedef/ilerleme omurgası var; B01/B02/C01 bütünlük ve seçilen yön bağlantısı eksik. |
| B2:167 | Hedef değişimi önceki hayat hikâyesini silmemeli. | B | E03 | Hedef/ilerleme omurgası var; B01/B02/C01 bütünlük ve seçilen yön bağlantısı eksik. |
| B2:168 | Oyuncu hiçbir hedef seçmeden serbest yaşam modunda da oynayabilmeli. | A | E03/E13 | Mevcut Günümüz serbest yaşamı zorunlu amaç istemiyor; C01 bunu koruyacak. |
| B2:188 | İş ve gelir. | A | E06/E10/E12/E13/E14 | Mevcut haftalık/aylık/yıllık ve ömür sistemleri; yeni ana döngü motoru yok. |
| B2:189 | Günlük yaşam. | A | E06/E10/E12/E13/E14 | Mevcut haftalık/aylık/yıllık ve ömür sistemleri; yeni ana döngü motoru yok. |
| B2:190 | Sosyal ilişkiler. | A | E06/E10/E12/E13/E14 | Mevcut haftalık/aylık/yıllık ve ömür sistemleri; yeni ana döngü motoru yok. |
| B2:191 | Sağlık ve enerji. | A | E06/E10/E12/E13/E14 | Mevcut haftalık/aylık/yıllık ve ömür sistemleri; yeni ana döngü motoru yok. |
| B2:192 | Küçük fırsatlar. | A | E06/E10/E12/E13/E14 | Mevcut haftalık/aylık/yıllık ve ömür sistemleri; yeni ana döngü motoru yok. |
| B2:193 | Yaklaşan ödemeler. | A | E06/E10/E12/E13/E14 | Mevcut haftalık/aylık/yıllık ve ömür sistemleri; yeni ana döngü motoru yok. |
| B2:194 | Acil sorunlar. | A | E06/E10/E12/E13/E14 | Mevcut haftalık/aylık/yıllık ve ömür sistemleri; yeni ana döngü motoru yok. |
| B2:198 | Kariyer ilerlemesi. | A | E06/E10/E12/E13/E14 | Mevcut haftalık/aylık/yıllık ve ömür sistemleri; yeni ana döngü motoru yok. |
| B2:199 | Birikim ve borç yönetimi. | A | E06/E10/E12/E13/E14 | Mevcut haftalık/aylık/yıllık ve ömür sistemleri; yeni ana döngü motoru yok. |
| B2:200 | İlişkilerin gelişmesi. | A | E06/E10/E12/E13/E14 | Mevcut haftalık/aylık/yıllık ve ömür sistemleri; yeni ana döngü motoru yok. |
| B2:201 | İşletme büyümesi. | A | E06/E10/E12/E13/E14 | Mevcut haftalık/aylık/yıllık ve ömür sistemleri; yeni ana döngü motoru yok. |
| B2:202 | Konut ve semt değişiklikleri. | A | E06/E10/E12/E13/E14 | Mevcut haftalık/aylık/yıllık ve ömür sistemleri; yeni ana döngü motoru yok. |
| B2:203 | Eğitim ve beceri kazanımı. | A | E06/E10/E12/E13/E14 | Mevcut haftalık/aylık/yıllık ve ömür sistemleri; yeni ana döngü motoru yok. |
| B2:204 | Önemli kişisel kararlar. | A | E06/E10/E12/E13/E14 | Mevcut haftalık/aylık/yıllık ve ömür sistemleri; yeni ana döngü motoru yok. |
| B2:208 | Toplumsal sınıf değişimi. | A | E06/E10/E12/E13/E14 | Mevcut haftalık/aylık/yıllık ve ömür sistemleri; yeni ana döngü motoru yok. |
| B2:209 | Aile kurma veya aileden uzaklaşma. | A | E06/E10/E12/E13/E14 | Mevcut haftalık/aylık/yıllık ve ömür sistemleri; yeni ana döngü motoru yok. |
| B2:210 | Mesleki başarı veya çöküş. | A | E06/E10/E12/E13/E14 | Mevcut haftalık/aylık/yıllık ve ömür sistemleri; yeni ana döngü motoru yok. |
| B2:211 | Servet ve miras. | A | E06/E10/E12/E13/E14 | Mevcut haftalık/aylık/yıllık ve ömür sistemleri; yeni ana döngü motoru yok. |
| B2:212 | Kalıcı dostluklar ve düşmanlıklar. | B | E05 | Hafıza/ilişki var; her bağın ömürlük arşivi değil, B04 görünürlük köprüsü kusurlu. |
| B2:213 | Yaşlanma ve emeklilik. | A | E06/E10/E12/E13/E14 | Mevcut haftalık/aylık/yıllık ve ömür sistemleri; yeni ana döngü motoru yok. |
| B2:214 | Hayatın genel sonucu. | A | E06/E10/E12/E13/E14 | Mevcut haftalık/aylık/yıllık ve ömür sistemleri; yeni ana döngü motoru yok. |
| B2:232 | Oyuncuyla ilişki düzeyi. | A | E05 | Yakınlık/güven/gerilim ve karar etkisi mevcut. |
| B2:233 | Güven. | A | E05 | Yakınlık/güven/gerilim ve karar etkisi mevcut. |
| B2:234 | Geçmiş olaylara ilişkin hafıza. | B | E05 | Temel NPC state/koşullu tepki var; B04 kimlik/rotasyon köprüsü ve sınırlı aktör modeli. |
| B2:235 | Kişisel beklentiler. | B | E05 | Temel NPC state/koşullu tepki var; B04 kimlik/rotasyon köprüsü ve sınırlı aktör modeli. |
| B2:236 | Kendi yaşam koşulları. | B | E05 | Temel NPC state/koşullu tepki var; B04 kimlik/rotasyon köprüsü ve sınırlı aktör modeli. |
| B2:237 | Oyuncunun kararlarına tepki. | A | E05 | Yakınlık/güven/gerilim ve karar etkisi mevcut. |
| B2:238 | İlişkiyi sürdürme veya bitirme eğilimi. | B | E05 | Temel NPC state/koşullu tepki var; B04 kimlik/rotasyon köprüsü ve sınırlı aktör modeli. |
| B2:244 | Aile. | A | E05/E10 | Mevcut sosyal rol/çevre veya olay ilişkileri; her rol için ayrı otonom motor iddiası yok. |
| B2:245 | Arkadaşlık. | A | E05/E10 | Mevcut sosyal rol/çevre veya olay ilişkileri; her rol için ayrı otonom motor iddiası yok. |
| B2:246 | Romantik ilişkiler. | A | E05/E10 | Mevcut sosyal rol/çevre veya olay ilişkileri; her rol için ayrı otonom motor iddiası yok. |
| B2:247 | Evlilik. | A | E05/E10 | Mevcut sosyal rol/çevre veya olay ilişkileri; her rol için ayrı otonom motor iddiası yok. |
| B2:248 | Çocuklar. | A | E05/E10 | Mevcut sosyal rol/çevre veya olay ilişkileri; her rol için ayrı otonom motor iddiası yok. |
| B2:249 | İş arkadaşları. | A | E05/E10 | Mevcut sosyal rol/çevre veya olay ilişkileri; her rol için ayrı otonom motor iddiası yok. |
| B2:250 | İşverenler. | A | E05/E10 | Mevcut sosyal rol/çevre veya olay ilişkileri; her rol için ayrı otonom motor iddiası yok. |
| B2:251 | Komşular. | A | E05/E10 | Mevcut sosyal rol/çevre veya olay ilişkileri; her rol için ayrı otonom motor iddiası yok. |
| B2:252 | Rakipler. | D | E05/E11 | Ayrı rol/örgüt simülasyonu gerekçelendirilmedi; mevcut etki sistemleri korunur. |
| B2:253 | Borç verenler. | A | E05/E10 | Mevcut sosyal rol/çevre veya olay ilişkileri; her rol için ayrı otonom motor iddiası yok. |
| B2:254 | Suç ortakları. | D | E05/E11 | Ayrı rol/örgüt simülasyonu gerekçelendirilmedi; mevcut etki sistemleri korunur. |
| B2:255 | Siyasi ve sosyal bağlantılar. | D | E05/E11 | Ayrı rol/örgüt simülasyonu gerekçelendirilmedi; mevcut etki sistemleri korunur. |
| B2:263 | Bir arkadaş iş fırsatı sunabilir. | B | E05/E06/E10 | Somut referans/iyilik/aile/partner sonuç temeli var; her anlatı örneği aynı biçimde doğrulanmış değil, yeni kopya yazma. |
| B2:264 | Bir akraba borç isteyebilir. | B | E05/E06/E10 | Somut referans/iyilik/aile/partner sonuç temeli var; her anlatı örneği aynı biçimde doğrulanmış değil, yeni kopya yazma. |
| B2:265 | Eşin taşınma kararına karşı çıkabilir. | B | E05/E06/E10 | Somut referans/iyilik/aile/partner sonuç temeli var; her anlatı örneği aynı biçimde doğrulanmış değil, yeni kopya yazma. |
| B2:266 | İş arkadaşın referans olabilir. | B | E05/E06/E10 | Somut referans/iyilik/aile/partner sonuç temeli var; her anlatı örneği aynı biçimde doğrulanmış değil, yeni kopya yazma. |
| B2:267 | Eski ortağın rakibine dönüşebilir. | D | E05/E12 | Yeni kalıcı ortak/rakip motoru P2/erteli. |
| B2:268 | Ailen ekonomik kriz sırasında yardım edebilir. | B | E05/E06/E10 | Somut referans/iyilik/aile/partner sonuç temeli var; her anlatı örneği aynı biçimde doğrulanmış değil, yeni kopya yazma. |
| B2:269 | Geçmişte kırdığın bir insan yıllar sonra yeniden karşına çıkabilir. | B | E05/E06/E10 | Somut referans/iyilik/aile/partner sonuç temeli var; her anlatı örneği aynı biçimde doğrulanmış değil, yeni kopya yazma. |
| B2:283 | İş başvurusu. | A | E06/E05/E12 | Mevcut eğitim/deneyim/iş/terfi/kayıp/yük/itibar ve girişim API’leri var. |
| B2:284 | İş görüşmesi. | A | E06/E05/E12 | Mevcut eğitim/deneyim/iş/terfi/kayıp/yük/itibar ve girişim API’leri var. |
| B2:285 | Eğitim ve yeterlilik. | A | E06/E05/E12 | Mevcut eğitim/deneyim/iş/terfi/kayıp/yük/itibar ve girişim API’leri var. |
| B2:286 | Mesleki deneyim. | A | E06/E05/E12 | Mevcut eğitim/deneyim/iş/terfi/kayıp/yük/itibar ve girişim API’leri var. |
| B2:287 | Terfi. | A | E06/E05/E12 | Mevcut eğitim/deneyim/iş/terfi/kayıp/yük/itibar ve girişim API’leri var. |
| B2:288 | Maaş pazarlığı. | D | E06 | Mevcut iş teklifi/kapı var; tam mülakat/pazarlık alt motoru P2/erteli. |
| B2:289 | İş değiştirme. | A | E06/E05/E12 | Mevcut eğitim/deneyim/iş/terfi/kayıp/yük/itibar ve girişim API’leri var. |
| B2:290 | İşten çıkarılma. | A | E06/E05/E12 | Mevcut eğitim/deneyim/iş/terfi/kayıp/yük/itibar ve girişim API’leri var. |
| B2:291 | İşsizlik. | A | E06/E05/E12 | Mevcut eğitim/deneyim/iş/terfi/kayıp/yük/itibar ve girişim API’leri var. |
| B2:292 | İşyerinde ilişkiler. | A | E06/E05/E12 | Mevcut eğitim/deneyim/iş/terfi/kayıp/yük/itibar ve girişim API’leri var. |
| B2:293 | Mesleki itibar. | A | E06/E05/E12 | Mevcut eğitim/deneyim/iş/terfi/kayıp/yük/itibar ve girişim API’leri var. |
| B2:294 | İş ve özel hayat dengesi. | A | E06/E05/E12 | Mevcut eğitim/deneyim/iş/terfi/kayıp/yük/itibar ve girişim API’leri var. |
| B2:295 | Kendi işini kurmaya geçiş. | A | E06/E05/E12 | Mevcut eğitim/deneyim/iş/terfi/kayıp/yük/itibar ve girişim API’leri var. |
| B2:315 | Yaşadığı ev. | A | E08/E09/E12/E13 | Konut/semt/araç/eşya/tüketim/sağlık/itibar ve para dışı sonuç altyapısı mevcut. |
| B2:316 | Bulunduğu semt. | A | E08/E09/E12/E13 | Konut/semt/araç/eşya/tüketim/sağlık/itibar ve para dışı sonuç altyapısı mevcut. |
| B2:317 | Kullandığı araç. | A | E08/E09/E12/E13 | Konut/semt/araç/eşya/tüketim/sağlık/itibar ve para dışı sonuç altyapısı mevcut. |
| B2:318 | Sahip olduğu eşyalar. | A | E08/E09/E12/E13 | Konut/semt/araç/eşya/tüketim/sağlık/itibar ve para dışı sonuç altyapısı mevcut. |
| B2:319 | Sosyal çevresi. | A | E08/E09/E12/E13 | Konut/semt/araç/eşya/tüketim/sağlık/itibar ve para dışı sonuç altyapısı mevcut. |
| B2:320 | Tüketim alışkanlıkları. | A | E08/E09/E12/E13 | Konut/semt/araç/eşya/tüketim/sağlık/itibar ve para dışı sonuç altyapısı mevcut. |
| B2:321 | Sağlık ve yaşam koşulları. | A | E08/E09/E12/E13 | Konut/semt/araç/eşya/tüketim/sağlık/itibar ve para dışı sonuç altyapısı mevcut. |
| B2:322 | İş ve kariyer fırsatları. | A | E08/E09/E12/E13 | Konut/semt/araç/eşya/tüketim/sağlık/itibar ve para dışı sonuç altyapısı mevcut. |
| B2:323 | Toplumsal itibarı. | A | E08/E09/E12/E13 | Konut/semt/araç/eşya/tüketim/sağlık/itibar ve para dışı sonuç altyapısı mevcut. |
| B2:343 | Enflasyon. | A | E07/E09/E12 | Mevcut dönem maliyeti/enflasyon/kredi/konut/iş fırsatları oyun modeli. |
| B2:344 | İşsizlik. | A | E07/E09/E12 | Mevcut dönem maliyeti/enflasyon/kredi/konut/iş fırsatları oyun modeli. |
| B2:345 | Konut fiyatları. | A | E07/E09/E12 | Mevcut dönem maliyeti/enflasyon/kredi/konut/iş fırsatları oyun modeli. |
| B2:346 | Kira artışları. | A | E07/E09/E12 | Mevcut dönem maliyeti/enflasyon/kredi/konut/iş fırsatları oyun modeli. |
| B2:347 | Faiz değişimleri. | A | E07/E09/E12 | Mevcut dönem maliyeti/enflasyon/kredi/konut/iş fırsatları oyun modeli. |
| B2:348 | Ekonomik krizler. | A | E07/E09/E12 | Mevcut dönem maliyeti/enflasyon/kredi/konut/iş fırsatları oyun modeli. |
| B2:349 | Sektörel fırsatlar. | A | E07/E09/E12 | Mevcut dönem maliyeti/enflasyon/kredi/konut/iş fırsatları oyun modeli. |
| B2:350 | Dönemsel tüketim alışkanlıkları. | B | E04/E09/E12 | Mevcut olay/dönem temeli var; sistematik yerel anlatı çeşitliliği P2, tamamı ölçülmedi. |
| B2:351 | Toplumsal ve yerel gelişmeler. | B | E04/E09/E12 | Mevcut olay/dönem temeli var; sistematik yerel anlatı çeşitliliği P2, tamamı ölçülmedi. |
| B2:367 | Apartman komşusuyla anlaşmazlık. | B | E04/E05/E09/E10 | Benzer gündelik konular mevcut havuzda var; her örneğin tam eşleniği tamamlandı iddiası yok, B03 bağlam testi gerekir. |
| B2:368 | İşe geç kalma. | B | E04/E05/E09/E10 | Benzer gündelik konular mevcut havuzda var; her örneğin tam eşleniği tamamlandı iddiası yok, B03 bağlam testi gerekir. |
| B2:369 | Aile ziyareti. | B | E04/E05/E09/E10 | Benzer gündelik konular mevcut havuzda var; her örneğin tam eşleniği tamamlandı iddiası yok, B03 bağlam testi gerekir. |
| B2:370 | Beklenmedik tamir masrafı. | B | E04/E05/E09/E10 | Benzer gündelik konular mevcut havuzda var; her örneğin tam eşleniği tamamlandı iddiası yok, B03 bağlam testi gerekir. |
| B2:371 | Mahallede yeni işletme açılması. | B | E04/E05/E09/E10 | Benzer gündelik konular mevcut havuzda var; her örneğin tam eşleniği tamamlandı iddiası yok, B03 bağlam testi gerekir. |
| B2:372 | Eski arkadaşla karşılaşma. | B | E04/E05/E09/E10 | Benzer gündelik konular mevcut havuzda var; her örneğin tam eşleniği tamamlandı iddiası yok, B03 bağlam testi gerekir. |
| B2:373 | İşyerinde anlaşmazlık. | B | E04/E05/E09/E10 | Benzer gündelik konular mevcut havuzda var; her örneğin tam eşleniği tamamlandı iddiası yok, B03 bağlam testi gerekir. |
| B2:374 | Taşınma sırasında sorun yaşama. | B | E04/E05/E09/E10 | Benzer gündelik konular mevcut havuzda var; her örneğin tam eşleniği tamamlandı iddiası yok, B03 bağlam testi gerekir. |
| B2:375 | Bayram ve aile buluşmaları. | B | E04/E05/E09/E10 | Benzer gündelik konular mevcut havuzda var; her örneğin tam eşleniği tamamlandı iddiası yok, B03 bağlam testi gerekir. |
| B2:376 | Mahalle veya şehirle ilgili yerel gelişmeler. | B | E04/E05/E09/E10 | Benzer gündelik konular mevcut havuzda var; her örneğin tam eşleniği tamamlandı iddiası yok, B03 bağlam testi gerekir. |
| B2:388 | Eğitim. | A | E06/E10/E12/E13 | Yaş ve yaşam evresi, eğitim/kariyer/aile/emeklilik/miras mevcut; her yaş için ayrı motor yok. |
| B2:389 | İş arayışı. | A | E06/E10/E12/E13 | Yaş ve yaşam evresi, eğitim/kariyer/aile/emeklilik/miras mevcut; her yaş için ayrı motor yok. |
| B2:390 | İlk ilişkiler. | A | E06/E10/E12/E13 | Yaş ve yaşam evresi, eğitim/kariyer/aile/emeklilik/miras mevcut; her yaş için ayrı motor yok. |
| B2:391 | İlk ekonomik bağımsızlık. | A | E06/E10/E12/E13 | Yaş ve yaşam evresi, eğitim/kariyer/aile/emeklilik/miras mevcut; her yaş için ayrı motor yok. |
| B2:392 | Deneme ve risk alma. | A | E06/E10/E12/E13 | Yaş ve yaşam evresi, eğitim/kariyer/aile/emeklilik/miras mevcut; her yaş için ayrı motor yok. |
| B2:396 | Kariyer. | A | E06/E10/E12/E13 | Yaş ve yaşam evresi, eğitim/kariyer/aile/emeklilik/miras mevcut; her yaş için ayrı motor yok. |
| B2:397 | Konut. | A | E06/E10/E12/E13 | Yaş ve yaşam evresi, eğitim/kariyer/aile/emeklilik/miras mevcut; her yaş için ayrı motor yok. |
| B2:398 | Aile. | A | E06/E10/E12/E13 | Yaş ve yaşam evresi, eğitim/kariyer/aile/emeklilik/miras mevcut; her yaş için ayrı motor yok. |
| B2:399 | Borç ve yatırımlar. | A | E06/E10/E12/E13 | Yaş ve yaşam evresi, eğitim/kariyer/aile/emeklilik/miras mevcut; her yaş için ayrı motor yok. |
| B2:400 | Sosyal sorumluluklar. | A | E06/E10/E12/E13 | Yaş ve yaşam evresi, eğitim/kariyer/aile/emeklilik/miras mevcut; her yaş için ayrı motor yok. |
| B2:401 | Uzun vadeli kararlar. | A | E06/E10/E12/E13 | Yaş ve yaşam evresi, eğitim/kariyer/aile/emeklilik/miras mevcut; her yaş için ayrı motor yok. |
| B2:405 | Kariyerin sonuçları. | A | E06/E10/E12/E13 | Yaş ve yaşam evresi, eğitim/kariyer/aile/emeklilik/miras mevcut; her yaş için ayrı motor yok. |
| B2:406 | Aile sorumlulukları. | A | E06/E10/E12/E13 | Yaş ve yaşam evresi, eğitim/kariyer/aile/emeklilik/miras mevcut; her yaş için ayrı motor yok. |
| B2:407 | Sağlık. | A | E06/E10/E12/E13 | Yaş ve yaşam evresi, eğitim/kariyer/aile/emeklilik/miras mevcut; her yaş için ayrı motor yok. |
| B2:408 | Birikim. | A | E06/E10/E12/E13 | Yaş ve yaşam evresi, eğitim/kariyer/aile/emeklilik/miras mevcut; her yaş için ayrı motor yok. |
| B2:409 | Geçmiş kararların etkileri. | B | E13 | Geçmiş/yıl/son rapor mevcut fakat bounded; bütün ilkler için ömürlük garanti yok. |
| B2:410 | Hayatı yeniden değerlendirme. | A | E06/E10/E12/E13 | Yaş ve yaşam evresi, eğitim/kariyer/aile/emeklilik/miras mevcut; her yaş için ayrı motor yok. |
| B2:414 | Emeklilik. | A | E06/E10/E12/E13 | Yaş ve yaşam evresi, eğitim/kariyer/aile/emeklilik/miras mevcut; her yaş için ayrı motor yok. |
| B2:415 | Sağlık ve yaşam koşulları. | A | E06/E10/E12/E13 | Yaş ve yaşam evresi, eğitim/kariyer/aile/emeklilik/miras mevcut; her yaş için ayrı motor yok. |
| B2:416 | Aile bağları. | A | E06/E10/E12/E13 | Yaş ve yaşam evresi, eğitim/kariyer/aile/emeklilik/miras mevcut; her yaş için ayrı motor yok. |
| B2:417 | Servet yönetimi. | A | E06/E10/E12/E13 | Yaş ve yaşam evresi, eğitim/kariyer/aile/emeklilik/miras mevcut; her yaş için ayrı motor yok. |
| B2:418 | Miras. | A | E06/E10/E12/E13 | Yaş ve yaşam evresi, eğitim/kariyer/aile/emeklilik/miras mevcut; her yaş için ayrı motor yok. |
| B2:419 | Geçmiş yaşamın sonuçları. | B | E13 | Geçmiş/yıl/son rapor mevcut fakat bounded; bütün ilkler için ömürlük garanti yok. |
| B2:448 | Olaylar önceki kararlarla tutarlı olmalı. | B | E04/E05/E10/E12 | Nedensel dallar ve seçim sonuçları mevcut; evrensel anlatı iddiası yok, B01–B04 kusurları hedeflenir. |
| B2:449 | Aynı olay sürekli tekrarlanmamalı. | B | E04 | Cooldown/once var; bağlamsız mekanik tekrar B03. |
| B2:450 | Sonuçlar her zaman tahmin edilebilir olmamalı. | D | E04 | Belirsizlik tasarım ilkesi; bütün sonuçları rastgeleleştirme önerilmez. |
| B2:451 | Oyuncuya anlamlı karşılık verme fırsatı sunulmalı. | B | E04/E05/E10/E12 | Nedensel dallar ve seçim sonuçları mevcut; evrensel anlatı iddiası yok, B01–B04 kusurları hedeflenir. |
| B2:452 | Tek bir kötü karar bütün oyunu sebepsiz yere mahvetmemeli. | B | E04/E05/E10/E12 | Nedensel dallar ve seçim sonuçları mevcut; evrensel anlatı iddiası yok, B01–B04 kusurları hedeflenir. |
| B2:453 | Büyük başarıların da yeni sorunları ve sorumlulukları olabilmeli. | B | E04/E05/E10/E12 | Nedensel dallar ve seçim sonuçları mevcut; evrensel anlatı iddiası yok, B01–B04 kusurları hedeflenir. |
| B2:465 | İlk işe giriş. | B | E13 | Önemli olay/hane/kariyer/çocuk kayıtları var; her ilki ömür boyu saklama garantisi yok, P2. |
| B2:466 | İlk ev. | B | E13 | Önemli olay/hane/kariyer/çocuk kayıtları var; her ilki ömür boyu saklama garantisi yok, P2. |
| B2:467 | Evlilik. | B | E13 | Önemli olay/hane/kariyer/çocuk kayıtları var; her ilki ömür boyu saklama garantisi yok, P2. |
| B2:468 | Çocuk sahibi olma. | B | E13 | Önemli olay/hane/kariyer/çocuk kayıtları var; her ilki ömür boyu saklama garantisi yok, P2. |

### Ek A.1 — Madde işareti dışında sunulan başlıca öneriler

| Öneri | Sınıf | Kanıt / karar |
| --- | --- | --- |
| Sıfırdan genç / varlıklı aile / esnaf ailesi / işsiz mezun / borçlu girişimci / yeni göçmen şeklinde altı hazır hayat başlangıcı | D | E02: mevcut başlangıç koşullarından preset yapılabilir; P2, bu beş pakete eklenmez |
| Ekonomik yükseliş / kariyer / girişimcilik / aile-sosyal / yeni hayat olmak üzere seçilmiş amaçlar | C | E03/C01: eylemler var; kişinin isteğe bağlı yönünü bunlara bağlamak gerekli. Hepsine yeni motor değil |
| Siyaset ve toplumsal etki amaç ailesi | D | E05/E12: itibar/çevre mevcut; ayrı siyaset oyunu zorunlu değil |
| Suç ve yeraltı amaç ailesi | B | E11: risk/ceza/uzaklaşma var; ayrı örgüt/rakip kariyeri D. Mevcut risk yolunun seçilmiş hedefe bağlanması C01 içinde sınırlı olabilir |
| Borç krizi zinciri | A | E07/E08: gerçek kredi/gecikme/icra/yeniden ödeme; tekrar yazma |
| Kariyer yükselişi zinciri | A | E06: başlangıç/deneyim/terfi/değerlendirme ve sorumluluk |
| Aile çatışması zinciri | A | E05/E10: beklenti/gerilim/açıklama/niyet/ayrılık ve barışma yolları |
| İşletme hikâyesi ve rekabet | B | E12: açma/kâr-zarar/büyüme/çalışan/kapanma var; kalıcı rakip motoru tamamlanmış değil ve D |
| Suçtan çıkış zinciri | A | E11: 13 hafta kesintisiz uzaklaşma heat azaltır; geçmiş dosya/borç silinmez |
| Oyunu zorunlu görev listesine çevirmemek; serbest yaşam ve içerik karakterini korumak | D | E18: bağlayıcı koruma ilkesi; C01 boş seçim ile sağlar |
| Bankaların geçmişi ve resmî kaynaklar panelini kaldırmak | D | E01/E07/E18: eski kapsamlı banka yeniden düzenleme isteği; mevcut 21 ekran sözleşmesi değişmez. Oyun kararına destek olan metodoloji/yardım körlemesine silinmez |
| Görsel derinlik adına bütün oyunu yeniden görselleştirmek | D | E01/E09/E18: sağlanan ikinci belge bunun somut bölümüne ulaşmadan kesiliyor; eksik metin uydurulmadı. Mevcut korumalı haritalar/tasarım korunur |

**Madde kapsamı:** 365 tam liste maddesi: A=151, B=80, C=2, D=132. Bu adetler aynı önerinin farklı yerlerde tekrarını da içerir; geliştirme işi veya benzersiz özellik sayısı değildir. Kırpılan eklerin teslim edilmeyen devamı kapsam dışıdır.

## Ek B — Tam yeniden üretim gözlemcileri

Bu kod **oyun kaynağı değildir**. İstenirse checkout adı `tariklab` olacak biçimde, onunla aynı üst dizindeki geçici `audit-evidence/` klasörüne aşağıdaki iki dosya çıkarılır; `node audit-evidence/probe.mjs` ve ardından `node audit-evidence/focused-extra.mjs` çalıştırılır. Paket kurulumu veya ürün kodu değişikliği gerektirmez. İncelenen SHA sabit tutulur. Olay izlerinin ham boyutu nedeniyle iz dosyaları bu rapor commitine eklenmez; aşağıdaki gözlemci onları yeniden üretir.

### B.1 probe.mjs

```javascript
import {writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createNewGame,validateState,transact,setYearlyPriorities} from '../tariklab/public/games/tc-sim/js/state.js';
import {advanceWeek,applyDecision,canApplyDecision,getAvailableDecisions} from '../tariklab/public/games/tc-sim/js/time.js';
import {EVENT_DEFINITIONS as E,getEventDefinition,getEventChoiceAvailability,resolveEvent,activateNextEvent} from '../tariklab/public/games/tc-sim/js/events.js';
import {acceptJobOffer,enrollEducation,quitJob,getMonthlySummary,getJobById} from '../tariklab/public/games/tc-sim/js/life.js';
import {getEducationProgress} from '../tariklab/public/games/tc-sim/js/education.js';
import {refreshLifeArcs} from '../tariklab/public/games/tc-sim/js/life-depth.js';
import {currentGoal,processDecisionNetworkWeek} from '../tariklab/public/games/tc-sim/js/decision-network.js';
import {applySocialAction,canUseSocialAction} from '../tariklab/public/games/tc-sim/js/social.js';
import {canTryParenthood,needsParentCare} from '../tariklab/public/games/tc-sim/js/parenthood.js';
import {takeCredit,startBusiness,manageBusiness} from '../tariklab/public/games/tc-sim/js/bank-business.js';
import {netWorth} from '../tariklab/public/games/tc-sim/js/wealth.js';
import {saveGame,loadGame} from '../tariklab/public/games/tc-sim/js/save.js';
import {coverage,applyLifeContentResolution} from '../tariklab/public/games/tc-sim/js/life-content.js';
const out=new URL('./',import.meta.url);
const sha=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const count=rows=>Object.fromEntries([...new Set(rows)].map(k=>[k,rows.filter(x=>x===k).length]).sort((a,b)=>b[1]-a[1]));
const cat=d=>d.arc||(['parenting','household','lifeEcho','lifeDepth','depth3','depth2','social3D','expansion','lifetime'].find(k=>d[k]))||'core';
function core(s){return {balance:s.finances.balance,arrears:s.finances.arrears,debt:netWorth(s).debt,job:s.career.jobId,performance:s.career.performance,education:s.education.active?.progressPoints||0,degree:s.education.level,health:s.health,relationships:s.relationships,social:s.people.map(p=>[p.id,p.social.trust,p.social.tension]),partner:s.social.currentPartnerNpcId,children:s.parenthood.children.length,home:s.household.homeId,pending:s.openCases.filter(x=>x.status!=='resolved').length};}
function changes(a,b,p=''){let r=[];for(const k of new Set([...Object.keys(a),...Object.keys(b)])){const x=a[k],y=b[k],key=p+k;if(x&&y&&typeof x==='object'&&typeof y==='object')r.push(...changes(x,y,key+'.'));else if(JSON.stringify(x)!==JSON.stringify(y))r.push([key,typeof x==='number'&&typeof y==='number'?y-x:[x,y]]);}return r;}
function run(kind,seed,weeks=960,alternate=false){
 let s=createNewGame({name:'Audit',seed,profile:'balanced',economicBackground:kind==='poor'?'tight':'modest',now:'2026-10-21T00:00:00.000Z'});
 if(kind==='rich')transact(s,495000,'Audit starting-capital fixture','other');
 if(kind==='unemployed')quitJob(s);
 if(kind==='debt'){const r=takeCredit(s,'medium');if(!r.ok)throw Error(r.reason);transact(s,-30000,'Audit pre-existing expenditure fixture','other');}
 if(kind==='entrepreneur')transact(s,25000,'Audit founder-capital fixture','other');
 const rows=[],actions=[],decisionCounts=[],checkpoints={},empty=[],errors=[],goalEmpty=[];let lastJob=s.career.jobId,jobChanges=0,validations=0,reloads=0;
 const storageMap=new Map(),storage={getItem:k=>storageMap.get(k)||null,setItem:(k,v)=>storageMap.set(k,v),removeItem:k=>storageMap.delete(k)};
 function settle(){activateNextEvent(s);let guard=0;while(s.events.active){if(++guard>80)throw Error('event guard');const d=getEventDefinition(s.events.active.eventId),source=s.events.active.sourceCaseId;
  const family=kind==='family';const intent=s.parenthood.children.length>=1?'no':canTryParenthood(s)?'try_partner':'discuss';
  const prefs={cohabitation_discussion:'plan',cohabitation_move:'shared',household_adjustment:'coordinate',household_family_visit:'tell',marriage_discussion:'plan',marriage_commitment:'confirm',romantic_opportunity:family?'interested':'decline',partner_transition:family?'commit':'wait',health_overload_review:'slow',health_recovery_review:'care',health_inactivity_review:'move',health_support_disclosure:'tell',family_intent_discussion:family?'wants':'later',family_intent_review:'talk',parent_planning:family?intent:'no',parent_planning_review:family?intent:'no',parent_preparation:'prepare',parent_family_support:'tell',parent_housing_review:'later',parent_care_review:'arrange',parent_budget_review:'home',career_promotion_window:kind==='career'?'accept':'decline',career_promotion_review:kind==='career'?'advance':'steady'};
  const choices=d.choices.filter(c=>getEventChoiceAvailability(s,c.id).ok);if(!choices.length)throw Error('no available choice '+d.id);
  const c=alternate?choices.at(-1):choices.find(c=>c.id===prefs[d.id])||choices[0];const before=core(s),week=s.time.absoluteWeek;
  const r=resolveEvent(s,c.id);if(!r.ok)throw Error(r.message);const delta=changes(before,core(s));
  rows.push({week,id:d.id,choice:c.id,category:cat(d),queued:Boolean(source),signature:sha(delta),shape:sha(delta.map(([k,v])=>[k,typeof v==='number'?Math.sign(v):v])),delta});
 }}
 const act=id=>{if(canApplyDecision(s,id).ok){const r=applyDecision(s,id);if(r.ok)actions.push({week:s.time.absoluteWeek,id});settle();return r.ok;}return false;};
 for(let i=0;i<weeks;i++)try{
  const startCount=rows.length;settle();
  if(kind==='career'&&!s.education.active&&!s.education.fields.includes('technical'))enrollEducation(s,'vocational_course','part');
  if(kind==='family'&&!s.education.active&&s.education.level!=='lisans'&&s.finances.balance>=8000)enrollEducation(s,'university','part');
  if(kind==='entrepreneur'&&!s.flags.business&&s.finances.balance>=14000)startBusiness(s,'repair');
  if(kind==='entrepreneur'&&s.flags.business){const b=s.flags.business,capacity=2**(b.level-1);if(b.employees<capacity-1&&s.finances.balance>50000)manageBusiness(s,'hire');else if(b.level<4&&b.months>=3&&b.lastResult?.net>0&&s.finances.balance>120000+capacity*60000)manageBusiness(s,'expand');}
  if(i%12===0&&kind!=='unemployed'&&kind!=='risk')for(const id of kind==='career'?['technician','courier','market']:kind==='family'?['specialist','office','market']:['market']){if(getJobById(id).salary<=(getJobById(s.career.jobId)?.salary||0))continue;if(acceptJobOffer(s,id).ok)break;}
  settle();const avail=getAvailableDecisions(s).filter(x=>canApplyDecision(s,x.id).ok);decisionCounts.push({week:s.time.absoluteWeek,n:avail.length,ids:avail.map(x=>x.id)});
  if(kind==='family'){
   if(needsParentCare(s))act('parent-care');else act('rest');
   const id=canUseSocialAction(s,'elif','confide').ok?'confide':'meet';
   if(i%2===0&&canUseSocialAction(s,'elif',id).ok){applySocialAction(s,'elif',id);actions.push({week:s.time.absoluteWeek,id:'social:'+id});settle();}else act('exercise');
  }else if(kind==='career'){if(s.health.energy>=40&&s.health.stress<=62)act('overtime');act('rest');act('exercise');}
  else if(kind==='risk'){for(const id of ['risk-shortcut','risk-fight','risk-dose','risk-night'])act(id);act('rest');act('exercise');}
  else {act('rest');act(i%3===0?'family':'exercise');}
  settle();const r=advanceWeek(s);if(!r.ok)throw Error(r.messages?.join(';'));settle();const v=validateState(s);if(!v.ok)throw Error(v.errors.join(';'));validations++;
  if(s.career.jobId!==lastJob){jobChanges++;lastJob=s.career.jobId;}
  if(rows.length===startCount)empty.push(i+1);if(!refreshLifeArcs(s).goals.length)goalEmpty.push(i+1);
  if((i+1)%48===0){if(!saveGame(storage,s).ok)throw Error('save');const loaded=loadGame(storage);if(!loaded.ok)throw Error('load');s=loaded.state;reloads++;}
  if([240,480,960].includes(i+1)){
   const seen=rows.map(x=>x.id),tail=rows.filter(x=>x.week>s.time.absoluteWeek-48),counts=count(seen),n=rows.length;
   let maxEmpty=0,streak=0;for(let j=1;j<=i+1;j++){streak=empty.includes(j)?streak+1:0;maxEmpty=Math.max(maxEmpty,streak);}
   const prev=new Map(),gaps=[];for(const row of rows){if(prev.has(row.id))gaps.push(row.week-prev.get(row.id));prev.set(row.id,row.week);}
   checkpoints[i+1]={years:(i+1)/48,date:s.time.date,events:n,uniqueIds:new Set(seen).size,idRepeatPct:100*(n-new Set(seen).size)/n,categories:count(rows.map(x=>x.category)),categoryRepeatPct:100*(n-new Set(rows.map(x=>x.category)).size)/n,uniqueExactOutcomes:new Set(rows.map(x=>x.signature)).size,outcomeRepeatPct:100*(n-new Set(rows.map(x=>x.signature)).size)/n,uniqueDirectionalOutcomes:new Set(rows.map(x=>x.shape)).size,emptyWeeks:empty.length,maxEmpty,goallessWeeks:goalEmpty.length,minRepeatWeekGap:gaps.length?Math.min(...gaps):null,sameWeekRepeats:gaps.filter(x=>x===0).length,top:Object.entries(counts).slice(0,5),lastYear:{events:tail.length,uniqueIds:new Set(tail.map(x=>x.id)).size,top:Object.entries(count(tail.map(x=>x.id))).slice(0,5)},decisionUnique:new Set(actions.map(x=>x.id)).size,availableDecisionMin:Math.min(...decisionCounts.map(x=>x.n)),job:s.career.jobId,jobChanges,balance:s.finances.balance,netWorth:netWorth(s).total,debt:netWorth(s).debt,health:s.health,partner:s.social.currentPartnerNpcId,children:s.parenthood.children.length,anne:s.relationships.anne,mehmet:s.relationships.mehmet,business:s.flags.business?{id:s.flags.business.id,level:s.flags.business.level}:null,goals:s.lifeDepth.goals};
  }
 }catch(e){errors.push({step:i+1,week:s.time.absoluteWeek,error:e.message});break;}
 const result={kind,seed,alternate,weeks:validations,reloads,errors,checkpoints,eventTraceHash:sha(rows.map(({week,id,choice,signature})=>({week,id,choice,signature}))),stateHash:sha(s)};
 writeFileSync(new URL(`trace-${kind}-${seed}${alternate?'-alternate':''}.json`,out),JSON.stringify({result,rows,actions,decisionCounts},null,2));return result;
}
const results=[];
for(const seed of [41,73])for(const kind of ['poor','rich','unemployed','debt','family','career','risk','entrepreneur']){const r=run(kind,seed);results.push(r);console.log(kind,seed,r.weeks,r.errors.length);}
const replay=run('poor',41);const alternate=run('poor',41,960,true);
writeFileSync(new URL('results.json',out),JSON.stringify({main:'243d636485be382811ab8ef33329e57119dafb5d',weeksPerYear:48,seeds:[41,73],results,replay:{same:results[0].eventTraceHash===replay.eventTraceHash&&results[0].stateHash===replay.stateHash},alternate},null,2));
const s=createNewGame({seed:41,now:'2026-10-21T00:00:00.000Z'});enrollEducation(s,'university','part');s.education.active.progressPoints=156;
const before={education:getEducationProgress(s),goal:refreshLifeArcs(s).goals.find(x=>x.arc==='education')};
setYearlyPriorities(s,['education']);const selectedBefore=currentGoal(s);for(let i=0;i<3;i++){s.time.absoluteWeek++;processDecisionNetworkWeek(s,['practice-skill']);}
const payoff={before,after:{education:getEducationProgress(s),active:s.education.active,goal:refreshLifeArcs(s).goals.find(x=>x.arc==='education'),selectedBefore,network:s.decisionNetwork}};
const goalEvent=E.find(d=>d.choices.some(c=>c.goal));const goalChoice=goalEvent.choices.find(c=>c.goal);applyLifeContentResolution(s,goalEvent,goalChoice.id);const goalAdded=s.lifeDepth.goals.map(x=>x.id);refreshLifeArcs(s);payoff.contentGoal={event:goalEvent.id,choice:goalChoice.id,goalAdded,afterRefresh:s.lifeDepth.goals.map(x=>x.id)};
const dup=field=>Object.entries(E.reduce((a,d)=>{const k=JSON.stringify(d[field]);(a[k]??=[]).push(d.id);return a;},{})).filter(([k,v])=>k!=='undefined'&&v.length>1).map(([text,ids])=>({text,ids}));
writeFileSync(new URL('focused.json',out),JSON.stringify({coverage:coverage(),pool:{total:E.length,repeat:count(E.map(x=>x.repeat)),categories:count(E.map(cat)),choices:E.reduce((n,e)=>n+e.choices.length,0),duplicateText:dup('text'),duplicateTitle:dup('title'),conditions:E.map(d=>({id:d.id,category:cat(d),condition:d.condition.toString()}))},payoff},null,2));

```

### B.2 focused-extra.mjs

```javascript
import {writeFileSync,readFileSync} from 'node:fs';
import {createNewGame,setYearlyPriorities,validateState} from '../tariklab/public/games/tc-sim/js/state.js';
import {processNetworkWeek,NETWORK_CAST} from '../tariklab/public/games/tc-sim/js/network.js';
import {currentGoal} from '../tariklab/public/games/tc-sim/js/decision-network.js';
import {getEventDefinition,enqueueEvent,activateNextEvent,resolveEvent,EVENT_DEFINITIONS} from '../tariklab/public/games/tc-sim/js/events.js';
import {netWorth} from '../tariklab/public/games/tc-sim/js/wealth.js';
import {refreshLifeArcs} from '../tariklab/public/games/tc-sim/js/life-depth.js';
import {moveLocation} from '../tariklab/public/games/tc-sim/js/life.js';
const result={};
result.network=[];
for(const familyType of ['nuclear','extended','stem','single'])for(const mode of ['tight','normal','wide']){
 const s=createNewGame({seed:41,networkMode:mode,familyType});
 for(const p of s.people)s.relationships[p.id]=60;
 for(let week=16;week<=960;week+=16){s.time.absoluteWeek=week;processNetworkWeek(s);}
 const extra=s.people.filter(p=>!['anne','baba','mehmet','elif','selin','emre','burak'].includes(p.id));
 result.network.push({familyType,mode,extraCount:extra.length,touched:extra.filter(p=>p.lifeMilestones.length).map(p=>p.id),knownEntries:extra.reduce((n,p)=>n+p.knownMilestones.length,0),matchingKnownIds:extra.reduce((n,p)=>n+p.lifeMilestones.filter(m=>p.knownMilestones.includes(m.id)).length,0),example:extra.find(p=>p.lifeMilestones.length)});
}
const s=createNewGame({seed:41});s.finances.balance=50000;const before={balance:s.finances.balance,worth:netWorth(s).total};
enqueueEvent(s,'lc_goal_housing');activateNextEvent(s);resolveEvent(s,'save');
result.envelope={before,after:{balance:s.finances.balance,worth:netWorth(s).total,goals:s.lifeDepth.goals},afterRefresh:refreshLifeArcs(s).goals,valid:validateState(s)};
const g=createNewGame({seed:41});const initial=currentGoal(g);setYearlyPriorities(g,['health','relationship']);result.priorities={initial,priorities:g.yearlyPlan.priorities,after:currentGoal(g)};
const fixtures={};
fixtures.base=createNewGame({seed:41});
fixtures.jobless=structuredClone(fixtures.base);fixtures.jobless.career.jobId=null;
fixtures.office=structuredClone(fixtures.base);fixtures.office.career.jobId='office';
fixtures.age38=structuredClone(fixtures.base);fixtures.age38.player.age=38;
fixtures.age68=structuredClone(fixtures.base);fixtures.age68.player.age=68;
fixtures.debt=structuredClone(fixtures.base);fixtures.debt.finances.arrears=20000;
fixtures.rich=structuredClone(fixtures.base);fixtures.rich.finances.balance=500000;
fixtures.family=structuredClone(fixtures.base);fixtures.family.player.familyType='extended';fixtures.family.flags.familyType='extended';
for(const [name,district] of [['istanbul','sisli'],['ankara','kizilay'],['izmir','konak']]){const x=createNewGame({seed:41});x.career.jobId=null;x.finances.balance=500000;const r=moveLocation(x,district,'shared');fixtures[name]=x;result['move-'+name]=r;}
const eligible=x=>{activateNextEvent(x);x.events.active=null;x.events.queue=[];return EVENT_DEFINITIONS.filter(d=>{try{return d.organic?d.organicCheck?.(x):d.condition(x);}catch{return false;}}).map(d=>d.id).sort();};
for(const x of Object.values(fixtures)){x.time.absoluteWeek=120;x.time.year=2029;x.flags.depth2Enabled=true;x.flags.depth3Enabled=true;}
const base=eligible(fixtures.base);result.sensitivity=Object.fromEntries(Object.entries(fixtures).map(([k,v])=>{const ids=eligible(v);return [k,{eligible:ids.length,added:ids.filter(id=>!base.includes(id)),removed:base.filter(id=>!ids.includes(id))}];}));
writeFileSync(new URL('focused-extra.json',import.meta.url),JSON.stringify(result,null,2));
const resultsPath=new URL('results.json',import.meta.url),r=JSON.parse(readFileSync(resultsPath));const repeat=JSON.parse(readFileSync(new URL('trace-poor-41.json',import.meta.url))).result;
r.replay={eventTraceEqual:r.results[0].eventTraceHash===repeat.eventTraceHash,checkpointsEqual:JSON.stringify(r.results[0].checkpoints)===JSON.stringify(repeat.checkpoints),rawStateHashEqual:r.results[0].stateHash===repeat.stateHash,note:'saveGame copies wall-clock meta.updatedAt (save.js:215). Raw state hashing includes that timestamp; deterministic gameplay is assessed by the complete event trace and checkpoints.'};writeFileSync(resultsPath,JSON.stringify(r,null,2));

```
