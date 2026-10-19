// TC SIM only: presentation overlays; no game state, RNG, or save access.
(function (root) {
  const I = root.tlabI18n;
  if (!I || !I.PHRASE || !I.PHRASE_PL) return;
  const rows = [
    ["İnfaz tamamlandı. İş ve haftalık kararlar yeniden açıldı; kesin karar kaydı ve borçlar duruyor.", "The sentence is complete. Work and weekly decisions are available again; the final decision and debts remain recorded.", "Wykonanie kary zakończone. Praca i decyzje tygodniowe są ponownie dostępne; ostateczne rozstrzygnięcie i długi pozostają zapisane."],
    ["Tekrarlanan kesin kavga kararı: iki oyun haftası infaz. Gözaltıdan ayrı; mevcut iş ve SGK durdurma kuralları uygulanır.", "Repeated final fight conviction: two game weeks in custody. This is separate from detention; existing work and observed-service pauses apply.", "Powtórne ostateczne skazanie za bójkę: dwa tygodnie gry pozbawienia wolności. To odrębne od zatrzymania; obowiązują istniejące zasady wstrzymania pracy i naliczania obserwowanego stażu."],
    ["Bu sınırlı oyun sürecinde kaynak kavga kaydı inceleniyor. Gözaltı mahkûmiyet değildir. Ek inceleme kararı iki hafta, normal karar bir hafta sonra gelir; doğrulanmış delil yoksa mahkûmiyet oluşmaz. Oyundaki tekrar politikası: ikinci kesin kavga kararından itibaren iki oyun haftası infaz uygulanır.", "This limited game procedure examines the source fight record. Detention is not a conviction. An extra review takes two weeks; an ordinary decision takes one. Unverified evidence cannot create a conviction. Game repeat policy: from the second final fight conviction, two game weeks in custody apply.", "Ten ograniczony model gry bada źródłowy zapis bójki. Zatrzymanie nie oznacza skazania. Dodatkowa kontrola trwa dwa tygodnie, zwykłe rozstrzygnięcie jeden. Niepotwierdzony dowód nie może prowadzić do skazania. Zasada gry dotycząca powtórzenia: od drugiego ostatecznego skazania za bójkę obowiązują dwa tygodnie gry pozbawienia wolności."],

    ["Bu duruşma için açık kaynak dosyası yok.", "There is no open source case for this hearing.", "Brak otwartej sprawy źródłowej dla tego posiedzenia."],
    ["Kaynak delil doğrulanamadı. Mahkûmiyet ve yeni ceza talebi oluşmadı.", "Source evidence could not be verified. No conviction or new fine claim was created.", "Nie potwierdzono dowodu źródłowego. Nie powstało skazanie ani nowe roszczenie z tytułu kary."],
    ["Kavga dosyasında kesin karar çıktı. Gözaltı kaydıyla aynı şey değil.", "A final decision was issued in the fight case. This is distinct from detention.", "W sprawie bójki wydano ostateczne rozstrzygnięcie. To odrębne od zatrzymania."],
    ["Kavga dosyasında kaynak delile dayalı kesin karar çıktı. Ceza tahsilatı mevcut icra akışında; yeni iş başlangıcı bir hafta gecikebilir.", "A final decision based on source evidence was issued in the fight case. Fine collection uses the existing enforcement process; starting a new job may take one extra week.", "W sprawie bójki wydano ostateczne rozstrzygnięcie na podstawie dowodu źródłowego. Karę pobiera istniejący proces egzekucji; rozpoczęcie nowej pracy może potrwać o tydzień dłużej."],
    ["Kavga dosyasında duruşma", "Hearing in the fight case", "Posiedzenie w sprawie bójki"],
    ["Bu sınırlı oyun sürecinde kaynak kavga kaydı inceleniyor. Gözaltı mahkûmiyet değildir. Ek inceleme kararı iki hafta, normal karar bir hafta sonra gelir; doğrulanmış delil yoksa mahkûmiyet oluşmaz.", "This limited game procedure examines the source fight record. Detention is not a conviction. An extra review takes two weeks; an ordinary decision takes one. Unverified evidence cannot create a conviction.", "Ten ograniczony model gry bada źródłowy zapis bójki. Zatrzymanie nie oznacza skazania. Dodatkowa kontrola trwa dwa tygodnie, zwykłe rozstrzygnięcie jeden. Niepotwierdzony dowód nie może prowadzić do skazania."],
    ["Kaynak kayıtla karar verilmesini iste", "Request a decision on the source record", "Poproś o rozstrzygnięcie na podstawie zapisu źródłowego"],
    ["İtiraz et ve bir ek inceleme iste", "Object and request one extra review", "Zgłoś sprzeciw i poproś o jedną dodatkową kontrolę"],
    ["Kavga dosyasında kesin karar", "Final decision in the fight case", "Ostateczne rozstrzygnięcie w sprawie bójki"],
    ["Kaynak olay ve varsa ek inceleme değerlendirildi. Doğrulanmış delile bağlı karar kayda geçecek. Bu, tam yasal yargılama modeli değildir; gözaltı veya borç incelemesi tek başına sabıka yaratmaz.", "The source incident and any extra review have been assessed. A decision tied to verified evidence will be recorded. This is a limited game model; detention or a debt review alone creates no criminal record.", "Oceniono zdarzenie źródłowe i ewentualną dodatkową kontrolę. Zostanie zapisane rozstrzygnięcie oparte na potwierdzonym dowodzie. To ograniczony model gry; zatrzymanie ani kontrola długu same nie tworzą karalności."],
    ["Gerekçeli sonucu kayda geçir", "Record the reasoned outcome", "Zapisz uzasadniony wynik"],
    ["Ceza dosyası duruşması", "Criminal case hearing", "Posiedzenie w sprawie karnej"],
    ["Yeni işe başladın. Geçmiş karar kaydı duruyor; işe dönüş gecikmesi sona erdi.", "You started a new job. The past decision remains recorded; the return-to-work delay has ended.", "Rozpoczęto nową pracę. Zapis dawnego rozstrzygnięcia pozostaje; opóźnienie powrotu do pracy zakończyło się."],

    ["Riskli çevreden uzaklaş", "Step away from risky circles", "Odejdź od ryzykownego środowiska"],
    ["1 haftalık karar · 13 kesintisiz risksiz hafta · baskı bir kademe azalır; dosya ve borç silinmez.", "1 weekly action · 13 consecutive risk-free weeks · pressure drops one level; cases and debt remain.", "1 działanie tygodniowe · 13 kolejnych tygodni bez ryzyka · presja spada o jeden poziom; sprawy i długi pozostają."],
    ["Uzaklaşma planı şu anda başlatılamaz.", "The disengagement plan cannot start right now.", "Nie można teraz rozpocząć planu odejścia."],
    ["Uzaklaşma planı başladı. 13 kesintisiz risksiz hafta baskıyı bir kademe azaltır; geçmiş dosyalar ve borçlar kalır.", "Disengagement started. Thirteen consecutive risk-free weeks reduce pressure by one level; past cases and debts remain.", "Plan odejścia rozpoczęty. Trzynaście kolejnych tygodni bez ryzyka obniży presję o jeden poziom; dawne sprawy i długi pozostają."],
    ["Riskli çevreden uzaklaşmak için verdiği sözü haftalarca sürdürdü.", "Kept the promise to step away from risky circles for weeks.", "Przez wiele tygodni dotrzymywał obietnicy odejścia od ryzykownego środowiska."],
    ["13 risksiz hafta tamamlandı. Baskı bir kademe azaldı. Geçmiş dosyalar ve borçlar duruyor.", "Thirteen risk-free weeks completed. Pressure fell one level. Past cases and debts remain.", "Minęło trzynaście tygodni bez ryzyka. Presja spadła o jeden poziom. Dawne sprawy i długi pozostają."],

    ["Borç dosyasını incele", "Inspect debt evidence", "Sprawdź dokumentację długu"],
    ["1 hak · kaynak kayıt ve kalan borç · ücret yok", "1 action · source record and remaining debt · no fee", "1 działanie · dokument źródłowy i pozostały dług · bez opłaty"],
    ["Dosyaya avukat desteği al", "Get legal support for the case", "Uzyskaj pomoc prawnika w sprawie"],
    ["500 TL oyun ücreti · bir ek inceleme · borç affı yok", "500 TL game fee · one extra review · no debt waiver", "Opłata gry 500 TL · jedna dodatkowa kontrola · bez umorzenia długu"],
    ["Avukatla ek inceleme iste", "Request an extra review with counsel", "Poproś o dodatkową kontrolę z prawnikiem"],
    ["1 hak · 2 oyun haftası · tek ek inceleme", "1 action · 2 game weeks · one extra review", "1 działanie · 2 tygodnie gry · jedna dodatkowa kontrola"],
    ["İncelenecek açık bildirim veya dava yok.", "No open notice or review to inspect.", "Brak otwartego zawiadomienia lub kontroli do sprawdzenia."],
    ["Dosya incelendi. Kaynak borç, güncel kalan ve bağlı kayıt ayrıldı. İnceleme borcu silmez; güncel tutarlar Para ekranında.", "Case inspected. Source debt, current remainder and linked record are distinguished. Inspection does not waive debt; current amounts are in Money.", "Sprawdzono sprawę. Rozdzielono dług źródłowy, bieżące saldo i powiązany dokument. Kontrola nie umarza długu; bieżące kwoty są w Finansach."],
    ["Avukat için önce açık dosyayı incele; destek bir kez alınır.", "Inspect the open case before hiring counsel; support is available once.", "Sprawdź otwartą sprawę przed zatrudnieniem prawnika; pomoc jest dostępna raz."],
    ["Avukat desteği için 500 TL oyun ücreti gerekiyor.", "Legal support requires a 500 TL game fee.", "Pomoc prawna wymaga opłaty gry 500 TL."],
    ["Avukat dosya desteği", "Legal case support", "Pomoc prawna w sprawie"],
    ["Avukat dosyaya katıldı. 500 TL oyun ücreti ödendi; geçerli borç silinmez. İlk karardan sonra bir ek inceleme istenebilir; bu, yasal istinaf modeli değildir.", "Counsel joined the case. A 500 TL game fee was paid; valid debt remains. One extra review is available after the first decision; this is not a statutory appeal model.", "Prawnik dołączył do sprawy. Opłacono 500 TL opłaty gry; zasadny dług pozostaje. Po pierwszej decyzji dostępna jest jedna dodatkowa kontrola; nie jest to model ustawowej apelacji."],
    ["Ek inceleme için avukat, ilk karar ve açık süre gerekiyor.", "An extra review requires counsel, the first decision and an open deadline.", "Dodatkowa kontrola wymaga prawnika, pierwszej decyzji i otwartego terminu."],
    ["Avukatla ek inceleme açıldı. İki oyun haftası haciz bekler; kalan borç yeniden kontrol edilir. Yeni borç veya borç affı oluşmaz.", "Extra review opened with counsel. Seizure waits for two game weeks while remaining debt is checked again. No new debt or waiver is created.", "Otwarto dodatkową kontrolę z prawnikiem. Egzekucja czeka dwa tygodnie gry na ponowne sprawdzenie pozostałego długu. Nie powstaje nowy dług ani umorzenie."],
    ["Dosya delili", "Case evidence", "Dokumentacja sprawy"],
    ["Talep kalanı:", "Remaining claim:", "Pozostałe roszczenie:"],
    ["İnceleme anındaki kaynak:", "Source at inspection:", "Źródło w chwili kontroli:"],
    ["Kaynak kayıt doğrulanamadı", "Source record unverified", "Niepotwierdzony dokument źródłowy"],

    ["Bildirim süresi doldu. Maaş haczi başladı; gerçekleşmiş net ücretin en çok dörtte biri borca gider. Desteklenen özel sektör işleri için oyun modeli; emekli aylığına uygulanmaz. Süreler oyun varsayımıdır.", "Notice expired. Compulsory wage collection started; at most one quarter of actual net wages pays debt. Game model for supported private-sector jobs; pensions excluded. Timings are game assumptions.", "Termin zawiadomienia minął. Rozpoczęto przymusowe potrącenia; najwyżej jedna czwarta faktycznej pensji netto spłaca dług. Model gry dla obsługiwanych etatów prywatnych; emerytury wyłączone. Terminy są założeniami gry."],
    ["İcra: cebrî maaş haczi", "Enforcement: compulsory wage collection", "Egzekucja: przymusowe potrącenia z pensji"],

    ["Maaştan tahsilata bağla", "Arrange wage collection", "Ustal potrącenia z pensji"],
    ["gerçekleşmiş net maaşın yüzde 20’si · oyun varsayımı · borç silinmez", "20% of actual net salary · game assumption · debt remains", "20% faktycznej pensji netto · założenie gry · dług pozostaje"],
    ["Maaştan tahsilat için açık bildirim ve ücretli iş gerekiyor.", "Wage collection requires an open notice and a paid job.", "Potrącenia z pensji wymagają otwartego zawiadomienia i pracy zarobkowej."],
    ["Maaştan tahsilat bağlandı. Bildirim süresinden sonra gerçekleşmiş net maaşın yüzde 20'si borca gider. Bu oran oyun varsayımıdır; maaş yoksa kesinti yok, borç silinmez.", "Wage collection arranged. After the notice period, 20% of actual net salary goes toward debt. This rate is a game assumption; no salary means no deduction, and debt remains.", "Ustalono potrącenia z pensji. Po terminie zawiadomienia 20% faktycznej pensji netto spłaca dług. Stawka jest założeniem gry; bez pensji nie ma potrącenia, a dług pozostaje."],
    ["İcra maaş tahsilatı", "Enforcement wage payment", "Spłata egzekucyjna z pensji"],
    ["İcra: maaştan tahsilat", "Enforcement: wage collection", "Egzekucja: potrącenia z pensji"],

    ["haciz işler · nakit, ipotekli konut, araç, eşya", "enforcement proceeds · cash, mortgaged home, vehicle, goods", "egzekucja trwa · gotówka, dom z hipoteką, pojazd, rzeczy"],
    ["Konut kredisi için Bankalar menüsündeki yapılandırmayı kullan.", "For a home loan, use restructuring in Banks.", "Dla kredytu mieszkaniowego użyj restrukturyzacji w Bankach."],
    ["Bağlı konut kredisi bulunamadı.", "Linked home loan not found.", "Nie znaleziono powiązanego kredytu mieszkaniowego."],
    ["Konut kredisi gecikmesi giderildi; icra durdu, kalan kredi ve konut korunuyor.", "Home-loan delinquency cured; enforcement stopped, the remaining loan and home are retained.", "Usunięto zaległość kredytu mieszkaniowego; egzekucja wstrzymana, pozostały kredyt i dom zachowane."],
    ["İpotekli konut: oyun satış bedeli", "Mortgaged home: game sale proceeds", "Dom z hipoteką: wpływy ze sprzedaży w grze"],
    ["Konut kredisi icra bildirimi geldi. Öde, itiraz et veya Bankalar üzerinden yapılandır. Ödenmezse bağlı konut yüzde 80 oyun değeriyle satılır; kalan borç silinmez.", "Home-loan enforcement notice received. Pay, object or restructure in Banks. If unpaid, linked collateral sells at 80% game value; remaining debt is retained.", "Otrzymano zawiadomienie o egzekucji kredytu mieszkaniowego. Spłać, złóż sprzeciw lub restrukturyzuj w Bankach. Bez spłaty zabezpieczenie jest sprzedawane za 80% wartości gry; reszta długu pozostaje."],
    ["Konut icrası kapandı. Artan satış bedeli sende; ödenmeyen borç temerrüte aktarıldı. Yüzde 80 satış değeri oyun varsayımıdır. Güncel tutarlar Para ekranında.", "Home enforcement closed. Surplus proceeds are yours; unpaid debt moved to arrears. The 80% sale value is a game assumption. Current amounts are in Money.", "Egzekucja domu zakończona. Nadwyżka wpływów jest twoja; niespłacony dług przeniesiono do zaległości. Wartość sprzedaży 80% jest założeniem gry. Bieżące kwoty są w Finansach."],
    ["Borç dökümüne itiraz et", "Dispute the debt statement", "Zakwestionuj zestawienie długu"],
    ["300 TL oyun masrafı · 2 hafta inceleme · geçerli borç silinmez", "300 TL game fee · 2-week review · valid debt remains", "Opłata gry 300 TL · 2 tygodnie kontroli · zasadny dług pozostaje"],
    ["Bu dosya için yeni itiraz süresi yok.", "No new objection is available for this case.", "W tej sprawie nie można już złożyć nowego sprzeciwu."],
    ["İnceleme için 300 TL oyun masrafı gerekiyor.", "The review requires a 300 TL game fee.", "Kontrola wymaga opłaty gry w wysokości 300 TL."],
    ["İcra inceleme masrafı", "Enforcement review fee", "Opłata za kontrolę egzekucji"],
    ["İtiraz kayda geçti. Mahkeme incelemesi 2 hafta sürer; haciz bekler, borç silinmez. Süre ve 300 TL masraf oyun kuralıdır.", "Objection filed. Court review takes 2 weeks; seizure waits and debt remains. The duration and 300 TL fee are game rules.", "Sprzeciw złożony. Kontrola sądowa trwa 2 tygodnie; zajęcie jest wstrzymane, dług pozostaje. Czas i opłata 300 TL są zasadami gry."],
    ["İnceleme kapandı. Ödenmiş borç yeniden yazılmadı.", "Review closed. Paid debt was not reinstated.", "Kontrola zakończona. Spłacony dług nie został przywrócony."],
    ["İnceleme bitti. Kayıtlardaki ödenmemiş {0#} TL doğrulandı. Ödeme veya taksit için 4 oyun haftası var; ikinci itiraz yok.", "Review complete. The recorded unpaid {0#} TL was confirmed. You have 4 game weeks to pay or arrange installments; no second objection.", "Kontrola zakończona. Potwierdzono zapisany niespłacony dług {0#} TL. Masz 4 tygodnie gry na spłatę lub raty; nie ma drugiego sprzeciwu."],
    ["İnceleme bitmeden veya kapalı dosyada haciz yapılamaz.", "Seizure is unavailable during review or for a closed case.", "Zajęcie jest niedostępne podczas kontroli lub po zamknięciu sprawy."],
    ["İcra: mahkeme incelemesi", "Enforcement: court review", "Egzekucja: kontrola sądowa"],
  [
    "Riskli gece",
    "Risky night",
    "Ryzykowna noc"
  ],
  [
    "Bir doz",
    "One dose",
    "Jedna dawka"
  ],
  [
    "Kavgaya gir",
    "Get into a fight",
    "Wdaj się w bójkę"
  ],
  [
    "Kolay para",
    "Easy money",
    "Łatwe pieniądze"
  ],
  [
    "İcrayı kapat",
    "Settle enforcement debt",
    "Spłać dług egzekucyjny"
  ],
  [
    "Taksit bağla",
    "Arrange installments",
    "Ustal raty"
  ],
  [
    "Yazıyı yok say",
    "Ignore the notice",
    "Zignoruj zawiadomienie"
  ],
  [
    "Aradan dolaş",
    "Try a shortcut",
    "Spróbuj obejścia"
  ],
  [
    "Kalfa",
    "Assistant",
    "Pomocnik"
  ],
  [
    "Kalfa tut",
    "Hire an assistant",
    "Zatrudnij pomocnika"
  ],
  [
    "Kalfayı çıkar",
    "Dismiss the assistant",
    "Zwolnij pomocnika"
  ],
  [
    "Kalfa bakıyor.",
    "The assistant is looking after it.",
    "Zajmuje się tym pomocnik."
  ],
  [
    "Kalfa bakıyor. Uğraman gerekmez.",
    "The assistant is looking after it. You do not need to visit.",
    "Zajmuje się tym pomocnik. Nie musisz zaglądać."
  ],
  [
    "Bu hafta uğra",
    "Visit this week",
    "Zajrzyj w tym tygodniu"
  ],
  [
    "Bu hafta uğradın.",
    "You visited this week.",
    "Zajrzałeś w tym tygodniu."
  ],
  [
    "Bu hafta uğramadın; bu tezgâhın cirosu kendi düşer.",
    "You have not visited this week; this stall's turnover will fall.",
    "Nie zajrzałeś w tym tygodniu; obrót tego straganu spadnie."
  ],
  [
    "İkinci tezgâh",
    "Second stall",
    "Drugi stragan"
  ],
  [
    "Tezgâhı aç",
    "Open the stall",
    "Otwórz stragan"
  ],
  [
    "aynı iş, ciro ikisinde de düşer",
    "same trade; turnover falls at both stalls",
    "ta sama branża; obrót spada na obu straganach"
  ],
  [
    "1 karar · uğramazsan ciro düşer",
    "1 action · turnover falls without visits",
    "1 działanie · bez wizyt obrót spada"
  ],
  [
    "uğrama yine sana düşer",
    "visiting becomes your responsibility again",
    "wizyty znów będą twoim obowiązkiem"
  ],
  [
    "işin varken enerji de gider",
    "also costs energy while employed",
    "przy zatrudnieniu zużywa też energię"
  ],
  [
    "Askere git",
    "Start military service",
    "Rozpocznij służbę wojskową"
  ],
  [
    "Tecil et",
    "Defer service",
    "Odrocz służbę"
  ],
  [
    "Yoklamadan kaç",
    "Evade the call-up",
    "Uchyl się od poboru"
  ],
  [
    "iş durur · ucuz yatak · dönüşte bant kapanır",
    "work stops · cheap accommodation · the service window closes on return",
    "praca ustaje · tani nocleg · po powrocie zamyka się okres służby"
  ],
  [
    "{0#} TL · bir kez · pencere geri gelir",
    "{0#} TL · once · the service window returns",
    "{0#} TL · raz · okres służby powraca"
  ],
  [
    "dosya · anne · sonra ceza",
    "case file · mother · later fine",
    "akta · mama · później grzywna"
  ],
  [
    "450 TL. Sağlık dosyası açılır. Varsa partner gerilir.",
    "450 TL. A health case opens. Your partner, if any, becomes tense.",
    "450 TL. Powstaje sprawa zdrowotna. Partner, jeśli go masz, odczuwa napięcie."
  ],
  [
    "Para ve beden gider. İkincide dosya açılır.",
    "Costs money and health. The second time opens a case.",
    "Kosztuje pieniądze i zdrowie. Za drugim razem powstają akta."
  ],
  [
    "900 TL ceza. Anne duyar. Tekrarı tutuklama.",
    "900 TL fine. Your mother hears about it. Repeating it leads to detention.",
    "900 TL grzywny. Mama się dowie. Powtórka oznacza zatrzymanie."
  ],
  [
    "Şimdi nakit gelir. Isı artar. Geri tepebilir.",
    "Cash now. Police attention rises. It may backfire.",
    "Gotówka teraz. Rośnie zainteresowanie policji. Może się to zemścić."
  ],
  [
    "kalan borcun tamamı · dosya kapanır",
    "full remaining debt · the case closes",
    "cały pozostały dług · sprawa zostaje zamknięta"
  ],
  [
    "yüzde 40 peşin · yüzde 10 masraf · kalan 4 ay",
    "40 percent upfront · 10 percent fee · remainder over 4 months",
    "40 procent z góry · 10 procent opłaty · reszta przez 4 miesiące"
  ],
  [
    "haciz işler · nakit, araç, eşya",
    "seizure proceeds · cash, vehicle, goods",
    "egzekucja rusza · gotówka, pojazd, rzeczy"
  ],
  [
    "borç şişer · dosya kalınlaşır",
    "debt grows · the case file expands",
    "dług rośnie · akta puchną"
  ],
  [
    "İcra yazısı geldi. {0#} TL. Öde, taksit bağla, ya da dosya yürür.",
    "Enforcement notice: {0#} TL. Pay, arrange installments, or enforcement proceeds.",
    "Zawiadomienie o egzekucji: {0#} TL. Zapłać, ustal raty albo egzekucja ruszy."
  ],
  [
    "İcra kapandı. {0#} TL gitti. Dosya durdu.",
    "Enforcement settled. {0#} TL paid. The case stopped.",
    "Egzekucja zakończona. Zapłacono {0#} TL. Sprawa została zamknięta."
  ],
  [
    "Taksit. Peşin {0#} TL, masraf {1#} TL. Kalan {2#} TL, ayda {3#} TL.",
    "Installments. Upfront {0#} TL, fee {1#} TL. Remaining {2#} TL, monthly {3#} TL.",
    "Raty. Z góry {0#} TL, opłata {1#} TL. Pozostało {2#} TL, miesięcznie {3#} TL."
  ],
  [
    "Taksit yattı. {0#} TL. Kalan {1#} TL.",
    "Installment paid: {0#} TL. Remaining: {1#} TL.",
    "Zapłacono ratę: {0#} TL. Pozostało: {1#} TL."
  ],
  [
    "Son taksit yattı. İcra kapandı.",
    "Final installment paid. Enforcement settled.",
    "Ostatnia rata zapłacona. Egzekucja zakończona."
  ],
  [
    "Taksit bitti. İcra kapandı.",
    "Installments completed. Enforcement settled.",
    "Raty spłacone. Egzekucja zakończona."
  ],
  [
    "Kolay yol tutmadı. Borç {0#} TL şişti. Dosya kalınlaştı.",
    "The shortcut failed. Debt rose by {0#} TL. The case file expanded.",
    "Obejście nie zadziałało. Dług wzrósł o {0#} TL. Akta się powiększyły."
  ],
  [
    "Açık icra yazısı yok.",
    "No open enforcement notice.",
    "Brak otwartego zawiadomienia o egzekucji."
  ],
  [
    "{0#} TL yok. Yazı duruyor.",
    "You do not have {0#} TL. The notice remains.",
    "Nie masz {0#} TL. Zawiadomienie pozostaje."
  ],
  [
    "{0#} TL peşinat yok.",
    "You do not have the {0#} TL upfront payment.",
    "Nie masz {0#} TL na wpłatę początkową."
  ],
  [
    "Taksit yalnız ilk yazıda bağlanır.",
    "Installments can only be arranged at the initial notice.",
    "Raty można ustalić tylko po pierwszym zawiadomieniu."
  ],
  [
    "İcra haftası. Bu hafta kasa ve iş kilitli.",
    "Enforcement week. Cash and work are locked this week.",
    "Tydzień egzekucji. Gotówka i praca są zablokowane."
  ],
  [
    "Riskli bir gece. 450 TL gitti. Sağlık dosyası açıldı.",
    "A risky night. 450 TL spent. A health case opened.",
    "Ryzykowna noc. Wydano 450 TL. Powstała sprawa zdrowotna."
  ],
  [
    "Riskli bir gece. 450 TL gitti. Sağlık dosyası açıldı. Partner gerildi.",
    "A risky night. 450 TL spent. A health case opened. Your partner became tense.",
    "Ryzykowna noc. Wydano 450 TL. Powstała sprawa zdrowotna. Partner odczuł napięcie."
  ],
  [
    "Klinik sonucu dosyaya işlendi. Beden yoruldu. Bu tıbbi tavsiye değil.",
    "The clinic result was recorded. Your body is worn down. This is not medical advice.",
    "Wynik z kliniki trafił do akt. Organizm jest wyczerpany. To nie jest porada medyczna."
  ],
  [
    "Çıktın. Kısa tutuklama işi ve haftayı yedi. Dosya duruyor.",
    "You are out. Brief detention cost work and time. The case remains.",
    "Wyszedłeś. Krótkie zatrzymanie pochłonęło pracę i czas. Akta pozostają."
  ],
  [
    "Kolay para tutmadı. Polis dosyası büyüdü. Kısa tutuklama.",
    "Easy money failed. The police case grew. Brief detention.",
    "Łatwe pieniądze nie wyszły. Akta policyjne urosły. Krótkie zatrzymanie."
  ],
  [
    "Kolay para geldi. Isı tepeye çıktı. Bir sonraki sefer geri teper.",
    "Easy money arrived. Police attention peaked. Next time it backfires.",
    "Łatwe pieniądze przyszły. Zainteresowanie policji sięgnęło szczytu. Następnym razem to się zemści."
  ],
  [
    "Kolay para geldi. 1800 TL. Isı arttı. Bu geri tepebilir.",
    "Easy money arrived: 1800 TL. Police attention rose. This may backfire.",
    "Łatwe pieniądze przyszły: 1800 TL. Wzrosło zainteresowanie policji. To może się zemścić."
  ],
  [
    "Kavga dosyaya geçti. 900 TL ceza. Anne bunu duydu.",
    "The fight went on file. A 900 TL fine. Your mother heard about it.",
    "Bójka trafiła do akt. 900 TL grzywny. Mama się dowiedziała."
  ],
  [
    "Kavga büyüdü. Kısa tutuklama. İş iki hafta durdu.",
    "The fight escalated. Brief detention. Work stopped for two weeks.",
    "Bójka się zaostrzyła. Krótkie zatrzymanie. Praca stanęła na dwa tygodnie."
  ],
  [
    "Kiraya taşın",
    "Move into rented housing",
    "Przeprowadź się do wynajętego mieszkania"
  ],
  [
    "İçine geç",
    "Move in",
    "Wprowadź się"
  ],
  [
    "Boş bırak",
    "Leave vacant",
    "Pozostaw puste"
  ],
  [
    "Ufak tadilat",
    "Minor renovation",
    "Drobny remont"
  ],
  [
    "1 karar · boş teslim",
    "1 action · vacant possession",
    "1 działanie · puste mieszkanie"
  ],
  [
    "boş hafta ve arıza var",
    "vacancies and repairs can occur",
    "możliwe pustostany i awarie"
  ],
  [
    "kira durur",
    "rent stops",
    "czynsz przestaje wpływać"
  ],
  [
    "Bu daire zaten sende.",
    "You already own this apartment.",
    "Masz już to mieszkanie."
  ],
  [
    "Nakit yetmiyor.",
    "Not enough cash.",
    "Za mało gotówki."
  ],
  [
    "Taşınma nakit istiyor.",
    "Moving requires cash.",
    "Przeprowadzka wymaga gotówki."
  ],
  [
    "Kiralık satılmaz.",
    "Rented housing cannot be sold.",
    "Wynajmowanego mieszkania nie można sprzedać."
  ],
  [
    "Kiralık sözleşme kiraya verilmez.",
    "You cannot let a rented apartment.",
    "Nie możesz wynająć komuś wynajmowanego mieszkania."
  ],
  [
    "Sermaye yetmiyor.",
    "Not enough capital.",
    "Za mało kapitału."
  ],
  [
    "İlk tezgâh sermaye ve bir karar ister.",
    "The first stall needs capital and one action.",
    "Pierwszy stragan wymaga kapitału i jednego działania."
  ],
  [
    "Açık mahalle tezgâhın yok. Para ekranındaki büyük işletme bundan ayrı durur.",
    "You have no open neighborhood stall. The larger business on Finance is separate.",
    "Nie masz otwartego osiedlowego straganu. Większa firma na ekranie finansów jest osobna."
  ],
  [
    "Dükkân yaşı {0#} hafta.",
    "Stall age: {0#} weeks.",
    "Wiek straganu: {0#} tygodni."
  ],
  [
    "Küçük esnaf yolundasın. Bekleme yok.",
    "You are on the small-trader path. No waiting period.",
    "Jesteś na ścieżce drobnego przedsiębiorcy. Bez okresu oczekiwania."
  ],
  [
    "Girişim ortağı yolundasın. Bekleme yok.",
    "You are on the venture-partner path. No waiting period.",
    "Jesteś na ścieżce wspólnika przedsięwzięcia. Bez okresu oczekiwania."
  ],
  [
    "Amaç",
    "Aim",
    "Cel"
  ],
  [
    "18 yaşında, İstanbul'da aile evinde başlayan tek bir hayatı haftalık kararlarla yönetiyorsun. Kariyer, para, ilişkiler ve sağlık birbirini etkiler; amaç mükemmel bir plan değil, sürdürülebilir bir denge kurmak.",
    "You run one life through weekly choices. Career, money, relationships and health pull on each other; the point is a livable balance, not a perfect plan.",
    "Prowadzisz jedno życie przez cotygodniowe decyzje. Kariera, pieniądze, relacje i zdrowie wpływają na siebie. Celem jest równowaga pozwalająca żyć, a nie idealny plan."
  ],
  [
    "Haftalık döngü",
    "Weekly loop",
    "Cykl tygodniowy"
  ],
  [
    "Her hafta 7 hakkın var. Düzenli iş, okul ve çocuk bakımı yoksa 8, sağlığın kötüyse 3. İş, okul, aile, aşk ve dinlenme aynı haftayı paylaşır. Haftayı erken kapatabilirsin. Maaş, kira, kredi ve dükkân ay sonunda işler.",
    "Each week offers seven time-and-focus blocks, eight without steady work, study or child care, and three during critical health. Work, study, relationships and recovery share that budget; wages, rent, credit payments and business results settle at month-end.",
    "Co tydzień masz siedem bloków czasu i uwagi, osiem bez stałej pracy, nauki lub opieki nad dziećmi, a trzy przy krytycznym stanie zdrowia. Praca, nauka, relacje i odpoczynek dzielą ten budżet. Pensja, czynsz, raty i wynik firmy są rozliczane na koniec miesiąca."
  ],
  [
    "Kontroller",
    "Controls",
    "Sterowanie"
  ],
  [
    "Üst şeritten Gelenler, Hafta, Para, Yakınlar ve Beden'e doğrudan geçersin. Alışveriş Çarşı'da, ev ve araç Emlak'tadır. Diğer bölümler aşağıdaki menüdedir. Gelenler bekleyen kararları ve son gelişmeleri tek yerde toplar; açık olay bitmeden hafta ilerlemez.",
    "The top shortcuts open Inbox, Calendar, Bank/Finance, Relationships and Body. Other sections remain in the navigation. Inbox collects pending decisions and recent developments in one place; an open event must be resolved before advancing the week.",
    "Skróty u góry otwierają skrzynkę, kalendarz, finanse, relacje i ciało. Pozostałe działy są w menu. Skrzynka zbiera oczekujące decyzje i ostatnie wydarzenia. Otwarte wydarzenie trzeba rozstrzygnąć przed przejściem do następnego tygodnia."
  ],
  [
    "İş ve finans",
    "Work and money",
    "Praca i pieniądze"
  ],
  [
    "Para ekranında nakit, net servet, borçlar, banka kredisi ve küçük işletme var. Ev, araç ve kalıcı eşya Emlak ekranındadır. Günlük harcama Çarşı raflarındadır. Kredi bugün para verir ama aylık geri ödeme getirir; işletmenin ciro eksi gideri kâr da zarar da olabilir. Eski tarihli başlangıçlarda tutarlar dönem ölçeğiyle tam lira olarak gösterilir, doğrulanmış ürün fiyatı veya banka oranı değildir.",
    "Finance shows cash, net worth, bank credit and a small business. Credit creates future monthly payments; the business can make a profit or a loss. From 1999, historical amounts use the Ministry of Labour net minimum-wage scale. Before that, they use annual CPI. They are not observed product prices or bank offers.",
    "Finanse pokazują gotówkę, majątek netto, kredyt bankowy i małą firmę. Kredyt oznacza przyszłe raty, a firma może przynosić zysk lub stratę. Od 1999 roku historyczne kwoty używają skali płacy minimalnej netto ministerstwa pracy, a wcześniej rocznego CPI. Nie są to zaobserwowane ceny produktów ani oferty bankowe."
  ],
  [
    "Tarihsel rota ve yetişkin hayatı",
    "Historical starts and adult life",
    "Historyczny start i dorosłe życie"
  ],
  [
    "1999 ya da 1980'lerden başlayan rotalar 1 Ocak 2030'a ulaşır; 2026–2029 olayları kurgu olasılıklarıdır. Yetişkin ilişkisinde karşılıklı rıza varsa korunma ve seks seçimi açılır; kondomsuz ilişkide gebelik sonucu gecikmeli gelebilir. Söz, nişan, düğün, takı, evlilik ve çocuk bakımının hem duygusal hem mali sonuçları vardır. Bunlar oyun mekaniğidir, sağlık tavsiyesi değildir.",
    "The 1999 and 1980s routes run to 1 January 2030; 2026–2029 events are fictional possibilities. In a consensual adult relationship, protection and sex decisions can open; unprotected sex can lead to a delayed pregnancy outcome. Engagement, wedding gifts, marriage and child care carry emotional and financial consequences. This is gameplay, not medical advice.",
    "Trasy z 1999 roku i lat osiemdziesiątych kończą się 1 stycznia 2030 roku. Wydarzenia z lat 2026–2029 są fikcyjnymi możliwościami. W dorosłym związku za obopólną zgodą mogą pojawić się decyzje o seksie i zabezpieczeniu. Seks bez zabezpieczenia może skutkować ciążą ujawnioną później. Zaręczyny, prezenty ślubne, małżeństwo i opieka nad dziećmi mają skutki emocjonalne i finansowe. To mechanika gry, nie porada medyczna."
  ],
  [
    "İlerleme ve göstergeler",
    "Progress and meters",
    "Postęp i wskaźniki"
  ],
  [
    "Beden ekranı enerji/stres/sağlığını, Hafta bekleyen randevu ve gecikmiş sonuçlarını, Yıl dosyası her yılın özetini tutar. İnsanlar ve Yakınlar sekmeleri güven, yakınlık ve gerilim gibi ilişkisel göstergeleri taşır.",
    "Body tracks energy/stress/health, Calendar holds appointments and delayed fallout, the Year File keeps each year's summary. People and Family/Relations carry trust, closeness and tension.",
    "Ekran ciała śledzi energię, stres i zdrowie. Kalendarz przechowuje spotkania i opóźnione konsekwencje, a teczka roku podsumowanie każdego roku. Ludzie i relacje pokazują zaufanie, bliskość i napięcie."
  ],
  [
    "Risk ve sonuçlar",
    "Risk and fallout",
    "Ryzyko i konsekwencje"
  ],
  [
    "Sağlığı boşlarsan haftalık hakkın düşer ve işin etkilenir. İlişkiyi boşlarsan soğur. Bazı sonuçlar hemen değil, haftalar sonra bir olay, bir mesaj ya da bir kira kâğıdı olarak döner. İş, okul, ilişki, aile, borç, ev, çevre, sağlık ve kriz aynı hayatta birikir. Rastgele kart değil.",
    "Neglected health makes demanding plans harder and neglected relationships cool. Some consequences return weeks later as events, a message or a rent notice, not immediately. Career, school, love, family, debt, housing, circle, status, health and crisis bind in one life — not a random card, the life you stacked.",
    "Zaniedbane zdrowie utrudnia wymagające plany, a zaniedbane relacje stygną. Niektóre skutki wracają po kilku tygodniach jako wydarzenie, wiadomość lub pismo o czynszu. Kariera, nauka, miłość, rodzina, długi, mieszkanie, otoczenie, status, zdrowie i kryzysy łączą się w jednym życiu. To skutki twoich decyzji, a nie losowa karta."
  ],
  [
    "Kayıt",
    "Saves",
    "Zapisy"
  ],
  [
    "Üç ayrı kayıt yerin (Slot) var; başlangıç ekranından birini seçersin. Oyun seçili slota tarayıcının yerel deposunda otomatik kaydedilir, üstteki Kaydet ile elle de kaydedebilirsin. Yeni oyun, seçili slottaki mevcut hayatı tamamen siler ve onay ister; diğer slotlar etkilenmez.",
    "You have three separate save slots, selected on the start screen. The game autosaves to the selected slot in browser storage; Save also writes manually. New Game deletes only the selected slot after confirmation. Other slots are unchanged.",
    "Masz trzy osobne miejsca zapisu, wybierane na ekranie startowym. Gra zapisuje automatycznie w wybranym miejscu w pamięci przeglądarki. Przycisk Zapisz umożliwia zapis ręczny. Nowa gra usuwa życie tylko z wybranego miejsca i wymaga potwierdzenia. Pozostałe zapisy nie zmieniają się."
  ],
  [
    "İlk oyun için ipuçları",
    "First-run tips",
    "Wskazówki na początek"
  ],
  [
    "Önce bir iş bul ve birkaç hafta düzen kur. Sağlığın kritik seviyeye inmeden dinlenmeye zaman ayır. Elindeki parayı hepsini harcamadan bir miktar nakit tut. Aile ve yakın çevrenle bağını koparma; ilerideki birçok fırsat bu bağa dayanır.",
    "Find work first and settle a few weeks. Rest before health turns critical. Keep some cash. Do not cut family and close circle; later openings lean on those ties.",
    "Najpierw znajdź pracę i ustabilizuj kilka tygodni. Odpoczywaj, zanim zdrowie stanie się krytyczne. Zachowaj trochę gotówki. Nie zrywaj więzi z rodziną i bliskimi, bo późniejsze możliwości często od nich zależą."
  ],
  [
    "İleri hayat: emeklilik, miras ve nesil",
    "Later life: retirement, inheritance, generation",
    "Późniejsze życie: emerytura, spadek i pokolenie"
  ],
  [
    "60'lı yaşlardan sonra yeterli çalışma geçmişiyle emekliliği değerlendirebilirsin. Hayat sona erdiğinde bir Yaşam Raporu çıkar ve varsa yetişkin bir çocuğunla yeni bir kuşak olarak devam edebilirsin; servetin ve aile bağların bir sonraki hayata iz bırakır.",
    "From the sixties, enough work history lets you weigh retirement. When a life ends a Life Report appears; an adult child can continue as the next generation, carrying wealth and family ties.",
    "Po sześćdziesiątce, przy odpowiednim stażu pracy, możesz rozważyć emeryturę. Po śmierci pojawia się raport życia. Dorosłe dziecko może kontynuować jako następne pokolenie, niosąc majątek i więzi rodzinne."
  ],
  [
    "Kaynaklar",
    "Sources",
    "Źródła"
  ],
  [
    "Hayat kurgudur. Gözlenen sayılar sınırlıdır. 1999–2025 net asgari ücret Çalışma ve Sosyal Güvenlik Bakanlığı çizelgesindendir; 2025 net 22.104,67 TL. 1999 öncesi yıllık TÜFE, Dünya Bankası FP.CPI.TOTL (Türkiye, 2010=100, 6 Ekim 2026 indirimi): https://data.worldbank.org/indicator/FP.CPI.TOTL?locations=TR . Ücret çizelgesi: https://www.csgb.gov.tr/Media/t2qlvwrg/asgari-%C3%BCcret-net-br%C3%BCt-i%C5%9Fverene-maliyet.pdf ve https://www.csgb.gov.tr/Media/f4xjys1e/2025-asgari-%C3%BCcret_.pdf . Diğer fiyat, kira ve banka oranı aynı ücret ölçeğindeki oyun bütçesidir; ilan değildir. 2026–2030 için ücret ve fiyat tahmini yoktur. Kurlar TCMB bülteninden çeyreklik alınır (7 Ekim 2026). Altın, Dünya Bankası aylık ons verisidir: https://thedocs.worldbank.org/en/doc/74e8be41ceb20fa0da750cda2f6b9e4e-0050012026/related/CMO-Historical-Data-Monthly.xlsx . Ziynet gramı kuyumcu fiyatı değildir. Veri ufkundan sonrası kurgu diye işaretlenir. Tarihli karttaki TCMB veya Dünya Bankası bağlantısı o olayın yanında durur.",
    "The life is fiction. Observed numbers are limited. The 1999–2025 net minimum wage follows the Ministry of Labour schedule; the 2025 net is TRY 22,104.67. Before 1999, annual CPI is World Bank FP.CPI.TOTL for Türkiye, 2010=100, downloaded 6 October 2026: https://data.worldbank.org/indicator/FP.CPI.TOTL?locations=TR . Wage tables: https://www.csgb.gov.tr/Media/t2qlvwrg/asgari-%C3%BCcret-net-br%C3%BCt-i%C5%9Fverene-maliyet.pdf and https://www.csgb.gov.tr/Media/f4xjys1e/2025-asgari-%C3%BCcret_.pdf . Other prices, rents and bank rates are a game budget on that wage scale, not listings. 2026–2030 wages and prices are not forecast. FX is a quarterly sample of TCMB bulletins, retrieved 7 October 2026. Gold is the World Bank monthly ounce series: https://thedocs.worldbank.org/en/doc/74e8be41ceb20fa0da750cda2f6b9e4e-0050012026/related/CMO-Historical-Data-Monthly.xlsx . Jewellery grams are not a jeweller's quote. Past the data horizon the game marks a fiction scenario. Dated cards keep their TCMB or World Bank link beside the event.",
    "Życie jest fikcją. Dane obserwowane są ograniczone. Płaca minimalna netto z lat 1999–2025 pochodzi z zestawienia ministerstwa pracy; w 2025 roku wynosi 22 104,67 TRY. Wcześniejsze lata korzystają z rocznego CPI Banku Światowego FP.CPI.TOTL dla Turcji (2010=100), pobranego 6 października 2026. Pozostałe ceny, czynsze i oprocentowanie to budżet gry, nie oferty rynkowe. Brak prognozy płac i cen na lata 2026–2030. Kursy kwartalne pochodzą z biuletynów TCMB, a złoto z miesięcznych cen uncji Banku Światowego. Wartość grama w grze nie jest ceną u jubilera. Okres po końcu danych jest oznaczony jako fikcja. Źródła: https://data.worldbank.org/indicator/FP.CPI.TOTL?locations=TR https://www.csgb.gov.tr/Media/t2qlvwrg/asgari-%C3%BCcret-net-br%C3%BCt-i%C5%9Fverene-maliyet.pdf https://www.csgb.gov.tr/Media/f4xjys1e/2025-asgari-%C3%BCcret_.pdf https://thedocs.worldbank.org/en/doc/74e8be41ceb20fa0da750cda2f6b9e4e-0050012026/related/CMO-Historical-Data-Monthly.xlsx"
  ]
];
  I.TCSIM_HELP_EN[7] = { ...I.TCSIM_HELP_EN[7], body: "You have three separate save slots, selected on the start screen. The game autosaves to the selected slot in browser storage; Save also writes manually. New Game deletes only the selected slot after confirmation. Other slots are unchanged." };
  const patterns = [];
  const compile = text => {
    const tokens = [];
    const escaped = text.replace(/\{(\d+)#\}/g, (_, id) => { tokens.push(Number(id)); return "@@SLOT@@"; })
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/@@SLOT@@/g, "([-+]?\\d[\\d.,]*)");
    return { regex: new RegExp(`^${escaped}$`, "u"), tokens };
  };
  for (const [tr, en, pl] of rows) {
    if (tr.includes("#}")) patterns.push({ tr: compile(tr), en: compile(en), english: en, polish: pl });
    else { I.PHRASE[tr] = en; I.PHRASE_PL[tr] = pl; I.PHRASE_PL[en] = pl; }
  }
  const originalPhrase = I.phrase.bind(I);
  I.phrase = text => {
    if (I.getLang() === "tr" || text == null) return originalPhrase(text);
    for (const pattern of patterns) for (const source of [pattern.tr, pattern.en]) {
      const match = String(text).match(source.regex);
      if (!match) continue;
      const values = Object.fromEntries(source.tokens.map((id, i) => [id, match[i + 1]]));
      return (I.getLang() === "pl" ? pattern.polish : pattern.english).replace(/\{(\d+)#\}/g, (_, id) => values[id]);
    }
    return originalPhrase(text);
  };
  const originalApply = I.applyPhrases.bind(I);
  I.applyPhrases = el => {
    const walk = node => {
      if (!node) return;
      if (node.nodeType === 3 && node.nodeValue?.trim()) {
        const raw = node.nodeValue.trim(); node.nodeValue = node.nodeValue.replace(raw, I.phrase(raw));
      } else if (node.nodeType === 1) {
        if (["SCRIPT", "STYLE", "TEXTAREA", "CODE"].includes(node.tagName) || node.closest?.("[data-i18n-skip]")) return;
        for (const name of ["title", "aria-label", "placeholder", "alt"]) {
          const value = node.getAttribute?.(name); if (value) node.setAttribute(name, I.phrase(value));
        }
        for (const child of node.childNodes || []) walk(child);
      }
    };
    walk(el || root.document?.body);
    return originalApply(el);
  };
  I.TCSIM_LANGUAGE_QA = rows;
})(typeof window !== "undefined" ? window : globalThis);
