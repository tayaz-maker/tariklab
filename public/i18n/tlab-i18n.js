/**
 * TarikLab lightweight i18n.
 * Preference key: tariklab.language
 * Changing language never writes gameplay saves.
 */
(function (root) {
  const KEY = "tariklab.language";
  const listeners = new Set();

  const EN = {
    "portal.lab": "Game Lab",
    "portal.games": "Games",
    "portal.playable": "playable",
    "portal.soon": "Coming Soon",
    "portal.play": "Play",
    "portal.sources": "Resources",
    "portal.back": "← Games",
    "portal.openGame": "Open {title}",
    "footer.rights": "© 2026 TarikLab. All rights reserved.",
    "lang.tr": "TR",
    "lang.en": "EN",
    "lang.label": "Language",
    "common.save": "Save",
    "common.load": "Load",
    "common.delete": "Delete",
    "common.newGame": "New Game",
    "common.continue": "Continue",
    "common.howTo": "How to Play",
    "common.back": "Back",
    "common.close": "Close",
    "common.confirm": "Confirm",
    "common.cancel": "Cancel",
    "common.reset": "Reset",
    "common.slot": "Slot",
    "common.emptySlot": "Empty slot",
    "common.corruptSave": "Corrupt save",
    "common.full": "occupied",
    "common.empty": "empty",
    "common.help": "How to Play",
    "common.difficulty": "Difficulty",
    "common.easy": "Easy",
    "common.medium": "Medium",
    "common.hard": "Hard",
    "common.restart": "Restart",
    "common.undo": "Undo",
    "common.hint": "Hint",
    "nw.meetingNight": "Meeting Night",
    "nw.inspect": "Inspect",
    "nw.policy": "Policy",
    "nw.major": "Major decision",
    "nw.advanceWork": "Act / advance",
    "nw.returnPhone": "Return it",
    "nw.monthTick": "Advance month",
    "nw.weekTick": "Advance week",
    "nw.advance": "Advance",
    "nw.ready": "Slot {n} ready",
    "nw.newSave": "Start a new save.",
    "nw.slots": "Save slots",
    "nw.grand": "1923→2030",
    "nw.targeted": "Directed",
    "devlet.reported": "Reported",
    "devlet.known": "Known",
    "devlet.treasury": "Treasury",
    "devlet.impl": "Implementation Rate",
    "devlet.entropy": "Entropy",
    "devlet.heat": "Social Heat",
    "devlet.debt": "Policy Debt",
    "apartman.meeting": "Meeting Night",
    "kayip.privacy": "Privacy Pressure",
    "credits.title": "Resources",
    "credits.kicker": "TarikLab · games and technical structure",
    "cete.helpTitle": "How to Play",
  };

  const PL = {
    "portal.lab": "Laboratorium gier", "portal.games": "Gry", "portal.playable": "dostępne",
    "portal.soon": "Wkrótce", "portal.play": "Graj", "portal.sources": "Materiały źródłowe",
    "portal.back": "← Gry", "portal.openGame": "Otwórz: {title}",
    "footer.rights": "© 2026 TarikLab. Wszelkie prawa zastrzeżone.",
    "lang.tr": "TR", "lang.en": "EN", "lang.pl": "PL", "lang.label": "Język",
    "common.save": "Zapisz", "common.load": "Wczytaj", "common.delete": "Usuń",
    "common.newGame": "Nowa gra", "common.continue": "Kontynuuj", "common.howTo": "Jak grać",
    "common.back": "Wstecz", "common.close": "Zamknij", "common.confirm": "Potwierdź",
    "common.cancel": "Anuluj", "common.reset": "Resetuj", "common.slot": "Slot",
    "common.emptySlot": "Pusty slot", "common.corruptSave": "Uszkodzony zapis",
    "common.full": "zajęty", "common.empty": "pusty", "common.help": "Jak grać",
    "common.difficulty": "Poziom trudności", "common.easy": "Łatwy", "common.medium": "Średni", "common.hard": "Trudny",
    "common.restart": "Zacznij od nowa", "common.undo": "Cofnij", "common.hint": "Podpowiedź",
    "credits.title": "Materiały źródłowe", "credits.kicker": "TarikLab · gry i struktura techniczna",
  };

  const PHRASE = {
    "← Oyunlar": "← Games",
    Oyunlar: "Games",
    "Oyun Laboratuvarı": "Game Lab",
    Yakında: "Coming Soon",
    oynanabilir: "playable",
    Kaynaklar: "Resources",
    "Tüm hakları saklıdır.": "All rights reserved.",
    "© 2026 TarikLab. Tüm hakları saklıdır.": "© 2026 TarikLab. All rights reserved.",
    Kaydet: "Save",
    Yükle: "Load",
    Sil: "Delete",
    "Yeni oyun": "New Game",
    "Yeni Oyun": "New Game",
    "Yeni labirent": "New maze",
    Devam: "Continue",
    Geri: "Back",
    Kapat: "Close",
    Onayla: "Confirm",
    İptal: "Cancel",
    Sıfırla: "Reset",
    "Nasıl oynanır": "How to Play",
    "Nasıl Oynanır": "How to Play",
    "Nasıl oynanır?": "How to Play?",
    "? Nasıl Oynanır": "? How to Play",
    "Boş slot": "Empty slot",
    Boş: "Empty",
    "Bozuk kayıt": "Corrupt save",
    "Kayıt okunamıyor": "Save unreadable",
    dolu: "occupied",
    boş: "empty",
    Zorluk: "Difficulty",
    Kolay: "Easy",
    Orta: "Medium",
    Zor: "Hard",
    Yerleşim: "Placement",
    Mod: "Mode",
    "Bilgisayara karşı": "Versus computer",
    "Sırayla (aynı cihaz)": "Hotseat (same device)",
    "Döndür (R)": "Rotate (R)",
    "Kendin yerleştir": "Auto-place",
    "Filoyu sıfırla": "Reset fleet",
    "Savaşı başlat": "Start battle",
    "Kayıt yerleri": "Save slots",
    "Yeni bir kayıt başlat.": "Start a new save.",
    // TC SIM: navigation, primary controls, new-game gate, save/status text.
    "Yaşam Yönetimi": "Life Management",
    "ANA SAYFA": "HOME",
    BEN: "ME",
    TAKVİM: "CALENDAR",
    PARA: "MONEY",
    FİNANS: "FINANCE",
    MARKET: "MARKET",
    İŞ: "WORK",
    EĞİTİM: "EDUCATION",
    KİŞİLER: "PEOPLE",
    "AİLE / İLİŞKİLER": "FAMILY / RELATIONS",
    EV: "HOUSE",
    BEDEN: "BODY",
    GEÇMİŞ: "HISTORY",
    "YIL DOSYASI": "YEAR FILE",
    "Oyun bölümleri": "Game sections",
    "Yaşam raporu": "Life report",
    "Haftayı ilerlet": "Advance the week",
    İsim: "Name",
    Kimlik: "Identity",
    "Belirtmek istemiyorum": "Prefer not to say",
    Kadın: "Woman",
    Erkek: "Man",
    "Başlangıç profili": "Starting profile",
    Dengeli: "Balanced",
    Hırslı: "Ambitious",
    Sosyal: "Social",
    "Aile ortamı": "Family background",
    "Aile yapısı": "Family structure",
    "Çekirdek Aile": "Nuclear family",
    "Geniş Aile": "Extended family",
    "Kök Aile": "Stem family",
    "Tek Ebeveynli Aile": "Single-parent family",
    Rastgele: "Random",
    "Maddi başlangıç": "Financial start",
    "Eğitim geçmişi": "Education background",
    "Sosyal çevre": "Social circle",
    "Askerlik durumu": "Military status",
    "Bu yaşamda yükümlülük yok": "No obligation in this life",
    "Yükümlülük var": "Has an obligation",
    "Başlangıç dönemi": "Starting era",
    "Bu slota yeni hayat": "New life in this slot",
    "Otomatik kaydedildi.": "Autosaved.",
    "Elle kaydedildi.": "Saved manually.",
    "Sakin bir hafta geçti.": "A quiet week passed.",
    "Toplantı Gecesi": "Meeting Night",
    İncele: "Inspect",
    Politika: "Policy",
    "Büyük karar": "Major decision",
    "İş / ilerle": "Act / advance",
    "İade et": "Return it",
    "Ay ilerle": "Advance month",
    "Hafta ilerle": "Advance week",
    İlerle: "Advance",
    Hedefli: "Directed",
    "büyük kampanya": "grand campaign",
    dönem: "period",
    kapandı: "closed",
    Durum: "Status",
    Genel: "Overview",
    Sakinler: "Residents",
    Bina: "Building",
    "Aidat/Kasa": "Dues / Treasury",
    Meseleler: "Issues",
    Toplantı: "Meeting",
    Geçmiş: "History",
    Yüküm: "Obligations",
    Fırsat: "Opportunity",
    İlişkiler: "Relations",
    Hayat: "Life",
    Karar: "Decision",
    "Zaman kıtlığı": "Time scarcity",
    "Baştan çöz": "Solve from start",
    "Yeniden başlat": "Restart",
    "Yeniden kur": "Reset board",
    "Geri al": "Undo",
    İpucu: "Hint",
    "Tahtayı çevir": "Flip board",
    Hamleler: "Moves",
    Hamle: "Moves",
    Süre: "Time",
    "En kısa": "Shortest",
    "Kalan taş": "Pegs left",
    "En iyin": "Your best",
    "Kurallar ve kontroller": "Rules and controls",
    "İki oyuncu": "Two players",
    "İki Oyuncu": "Two Players",
    "Bilgisayara Karşı": "Versus Computer",
    "Oyun modu": "Game mode",
    "Yukarı git": "Move up",
    "Sola git": "Move left",
    "Sağa git": "Move right",
    "Aşağı git": "Move down",
    "18+ onay": "18+ confirmation",
    "18 yaşından büyüğüm": "I am 18 or older",
    "Dosya aç": "Open a file",
    "İsmin, semtin, raconun": "Your name, hood, racon",
    Ad: "Name",
    Semt: "Neighborhood",
    "Oyun kilitlendi": "The game locked up",
    "Üç kayıt yeri": "Three save slots",
    Kayıt: "Save",
    açık: "active",
    "kayıt yok": "no save",
    "az önce": "just now",
    Ben: "Me",
    İcraat: "Jobs",
    Tezgâh: "Shop",
    Emlak: "Property",
    Sokak: "Street",
    Klinik: "Clinic",
    Amaç: "Aim",
    "Temel döngü": "Core loop",
    Kontroller: "Controls",
    "Kaynaklar ve göstergeler": "Resources and meters",
    İlerleme: "Progress",
    "Risk ve kayıp": "Risk and loss",
    "İlk oyun için ipuçları": "First-run tips",
    "Önemli not": "Note",
    "Haftalık döngü": "Weekly loop",
    "İş ve para": "Work and money",
    "İlerleme ve göstergeler": "Progress and meters",
    "Risk ve sonuçlar": "Risk and fallout",
    "İleri hayat: emeklilik, miras ve nesil": "Later life: retirement, inheritance, generation",
    "TarikLab · yaratıcı ve bileşenler": "TarikLab · creator and components",
    "Özgün TarikLab oyunları": "Original TarikLab games",
    "Üçüncü taraf bileşenler": "Third-party components",
    "Klasik oyun kuralları üzerindeki hak iddiası bu bildirimin kapsamı dışındadır.":
      "No claim is made over public-domain classic game rules.",
    "Defter kapandı": "The ledger is closed",
    "Rapor edilen enflasyon": "Reported inflation",
    güven: "confidence",
    "Rapor edilen hazine": "Reported treasury",
    işsizlik: "unemployment",
    Uygulama: "Implementation",
    form: "form",
    entropi: "entropy",
    "Muasır Medeniyet": "Contemporary Civilization",
    "Bölgesel Güç": "Regional Power",
    "Sanayi Devi": "Industrial Giant",
    "Demokratik Konsolidasyon": "Democratic Consolidation",
    "Sosyal Devlet": "Social State",
    "Tam Bağımsızlık": "Full Independence",
    "İstikrar Devleti": "Stability State",
    Günümüz: "Present day",
    Alternatif: "Alternative",
    "Borç toparlanması": "Debt recovery",
    "Aile bakımı": "Family care",
    "İş penceresi": "Career window",
    "Beden hesabı": "Body ledger",
    Taşınma: "Moving out",
    "İlişki onarımı": "Repairing us",
    "Yalnızlık / çevre": "Loneliness / circle",
    "İşsiz toparlanma": "Jobless recovery",
    "Tezgâh denemesi": "Side-hustle trial",
    "Sınav / başvuru": "Exam / application",
    "Düğün yükü": "Wedding load",
    "Aile borcu": "Family debt",
    "Kira krizi": "Rent crisis",
    "Bakım nöbeti": "Care shift",
    Tükenmişlik: "Burnout",
    "Yeni şehir": "New city",
    "Tebliğ / itiraz": "Notice / appeal",
    "Yan iş / proje": "Side job / project",
    "İş / mesai": "Work / shift",
    Aile: "Family",
    İlişki: "Relationship",
    Dinlen: "Rest",
    Öde: "Pay",
    "Ucuz çözüm": "Cheap fix",
    "Düzgün çözüm": "Proper fix",
    "Fırsata git": "Take the opportunity",
    Evrak: "Paperwork",
    Konuş: "Talk",
    Ertele: "Postpone",
    "Kendine zaman": "Time for yourself",
    "Asgari öde": "Pay the minimum",
    Yastık: "Build a cushion",
    "Eve bak": "Look after home",
    "Parayı tut": "Keep the money",
    "İşi bırak": "Quit the job",
    "Doktora git": "See a doctor",
    "Cami / dua": "Mosque / prayer",
    "Sadaka / yardım": "Charity / help",
    "İtiraf et": "Confess",
    "Yalan söyle": "Lie",
    Affet: "Forgive",
    İntikam: "Revenge",
    Yüzleş: "Confront",
    "Yakınlık / seks": "Intimacy / sex",
    "Paralı gece": "Paid encounter",
    "Bar / kulüp": "Bar / club",
    "Ağır içki": "Heavy drinking",
    "Kaçak madde": "Illegal drugs",
    Kumar: "Gamble",
    "Kaçış yolculuğu": "Escape trip",
    "Vasiyet yaz": "Write a will",
    "Bir şey bırak": "Leave something behind",
    "Gerçeği sakla": "Hide the truth",
    "Yabancıya yardım": "Help a stranger",
    "Birini koru": "Protect someone",
    "Kirli iş": "Dirty work",
    "İhbar et": "Report the crime",
    "Eski sevgiliyi ara": "Call your ex",
    "Eski dosta git": "Visit an old friend",
    "Bir şey üret": "Create something",
    "Yeni oyun başlat.": "Start a new game.",
    "Senin filon": "Your fleet",
    "Rakip denizi": "Enemy waters",
    "Zafer — rakip filo battı": "Victory — enemy fleet sunk",
    "Kayıp — filon battı": "Defeat — your fleet is sunk",
    "Sıra sende": "Your shot",
    "Rakip ateş ediyor": "Enemy firing",
    Menü: "Menu",
    İLERLET: "ADVANCE",
    "Telefonu yan çevir": "Turn the phone sideways",
    "Kod gir": "Enter code",
    Kira: "Rent",
    "Kredi kartı asgari": "Card minimum",
    Aidat: "Building dues",
    "Apartman Yöneticisi": "Building Manager",
  };

  // Deliberately short, global-safe DOM replacements only. Narrative game copy
  // remains Turkish until its own localization pass.
  const PHRASE_PL = {
    "← Oyunlar": "← Gry", Oyunlar: "Gry", "Oyun Laboratuvarı": "Laboratorium gier",
    Yakında: "Wkrótce", oynanabilir: "dostępne", Kaynaklar: "Materiały źródłowe",
    Kaydet: "Zapisz", Yükle: "Wczytaj", Sil: "Usuń", "Yeni oyun": "Nowa gra",
    Devam: "Kontynuuj", Geri: "Wstecz", Kapat: "Zamknij", Onayla: "Potwierdź",
    İptal: "Anuluj", Sıfırla: "Resetuj", "Nasıl oynanır": "Jak grać",
    "Boş slot": "Pusty slot", "Bozuk kayıt": "Uszkodzony zapis", Zorluk: "Poziom trudności",
    Kolay: "Łatwy", Orta: "Średni", Zor: "Trudny", Harita: "Mapa", Kaynak: "Zasób",
    // ---- Per-game interface (static UI only). Keys are the English label, or
    // the Turkish source where a game shows no English for it. Story, event,
    // card and help body text is not translated and falls back to English.
    // Shared shell
    "← Games": "← Gry", Menu: "Menu", MENÜ: "MENU", Save: "Zapisz", Load: "Wczytaj", Delete: "Usuń", DELETE: "USUŃ",
    "How to Play": "Jak grać", "How to Play?": "Jak grać?", "HOW TO PLAY?": "JAK GRAĆ?", "How to play": "Jak grać",
    "How to play?": "Jak grać?", "? How to Play": "? Jak grać", "New Game": "Nowa gra", "NEW GAME": "NOWA GRA",
    Continue: "Kontynuuj", CONTINUE: "KONTYNUUJ", "Main Menu": "Menu główne", Back: "Wstecz", "Back out": "Wycofaj się",
    Close: "Zamknij", Open: "Otwórz", Panel: "Panel", "More sections": "Więcej sekcji", "Search this section": "Szukaj w tej sekcji",
    "DETAILS / ACTIONS": "SZCZEGÓŁY / DZIAŁANIA", "← Back to list": "← Powrót do listy", "Collapse menu": "Zwiń menu",
    "Slot 1 · empty": "Slot 1 · pusty", "Slot 2 · empty": "Slot 2 · pusty", "Slot 3 · empty": "Slot 3 · pusty",
    "Slot 1 · occupied": "Slot 1 · zajęty", "Slot 2 · occupied": "Slot 2 · zajęty", "Slot 3 · occupied": "Slot 3 · zajęty",
    "Slot 1 · dolu": "Slot 1 · zajęty", "Selected slot is empty.": "Wybrany slot jest pusty.",
    "Sure? This save goes.": "Na pewno? Ten zapis zniknie.", Kopyala: "Kopiuj", Yedek: "Kopia zapasowa",
    Difficulty: "Poziom trudności", Easy: "Łatwy", Medium: "Średni", Hard: "Trudny", Mode: "Tryb", Aim: "Cel",
    Controls: "Sterowanie", "The goal": "Cel gry", "Common mistakes": "Częste błędy", Saving: "Zapisywanie",
    "What you see on screen": "Co widzisz na ekranie", "Sık yapılan hatalar": "Częste błędy",
    // Racon Manager
    ADVANCE: "DALEJ", Events: "Wydarzenia", Takvim: "Kalendarz", Adamlar: "Ludzie", Jobs: "Roboty",
    Pazar: "Targ", Property: "Majątek", Life: "Życie", Emniyet: "Policja", Husumet: "Wrogość", Kasa: "Kasa",
    "Sıralama": "Ranking", "Bugün": "Dzisiaj", "Bu hafta": "Ten tydzień", "Paneli kapat": "Zamknij panel",
    "Okundu, kaldır": "Przeczytane, usuń", "What the game is": "O czym jest gra", "At the start": "Na początku",
    "Core loop: ADVANCE": "Główna pętla: DALEJ", "Screens in the menu": "Ekrany w menu", "Bir iş nasıl yapılır": "Jak wykonać robotę",
    "Dört çubuk (itibarın)": "Cztery paski (twoja reputacja)", "Dosya (polis kaydın)": "Akta (twoja kartoteka)",
    "Nasıl biter": "Jak się kończy", "İpuçları": "Wskazówki", "Anladım": "Rozumiem", "Önce bir hayat başlat.": "Najpierw zacznij życie.",
    // Racon network map
    "Ağ haritası": "Mapa sieci", Koru: "Chroń", "Yatırım": "Inwestuj", "Çekil": "Wycofaj się", "İlişki kur": "Nawiąż relacje",
    // TC SIM
    "Hayatını Başlat": "Zacznij życie", "Haftayı değerlendir": "Podsumuj tydzień", HOME: "GŁÓWNA", "Life desk": "Biurko życia",
    "This week": "Ten tydzień", "Life stage": "Etap życia", Residence: "Miejsce zamieszkania", Job: "Praca",
    "Commute burden": "Obciążenie dojazdem", Agenda: "Agenda", Inbox: "Skrzynka", "Key people": "Kluczowe osoby",
    "RECORD / ACCOUNT LEDGER": "ZAPIS / KSIĘGA RACHUNKÓW", HISTORY: "HISTORIA", "CASH / RECENT TRANSACTIONS": "GOTÓWKA / OSTATNIE TRANSAKCJE",
    When: "Kiedy", Description: "Opis", "Amount (TRY)": "Kwota (TRY)", "URGENT PRESSURE": "PILNA PRESJA", GOAL: "CEL",
    OPPORTUNITY: "SZANSA", "CONSEQUENCE CHAIN": "ŁAŃCUCH SKUTKÓW", Time: "Czas", Money: "Pieniądze", Relationship: "Relacje",
    Energy: "Energia", Goal: "Cel", Earlier: "Wcześniej", "No urgent pressure this week": "W tym tygodniu brak pilnej presji",
    "A good week for planning.": "Dobry tydzień na planowanie.",
    // Son Mahalle Bükücü
    Short: "Krótka", Long: "Długa", Novice: "Nowicjusz", Tradesman: "Kupiec", "Versus Naci Bey": "Przeciw Naci Beyowi",
    "Two people, same phone": "Dwie osoby, jeden telefon", "Three people, same phone": "Trzy osoby, jeden telefon",
    "Four people, same phone": "Cztery osoby, jeden telefon",
    // Classics
    "Move up": "Ruch w górę", "Move left": "Ruch w lewo", "Move right": "Ruch w prawo", "Move down": "Ruch w dół",
    "New maze": "Nowy labirynt", "Solve from start": "Rozwiąż od startu", "Enter code": "Wpisz kod",
    "Ekranda ne görüyorum?": "Co widzę na ekranie?", "Meydan okuma kodu": "Kod wyzwania", "Labirenti aç": "Otwórz labirynt",
    Undo: "Cofnij", Hint: "Podpowiedź", "Reset board": "Resetuj planszę", "Hamle nasıl yapılır?": "Jak wykonać ruch?",
    "Oyun ne zaman biter?": "Kiedy gra się kończy?", Restart: "Od nowa", "Flip board": "Obróć planszę", Moves: "Ruchy",
    "Taşlar nasıl gider?": "Jak poruszają się bierki?", "Bir hamle nasıl yapılır?": "Jak wykonać ruch?", "Özel kurallar": "Zasady specjalne",
    "Nasıl kazanırım, nasıl berabere kalırım?": "Jak wygrać, jak zremisować?", "Oyun modları ve kontroller": "Tryby gry i sterowanie",
    "Game mode": "Tryb gry", "Two Players": "Dwóch graczy", "Versus Computer": "Przeciw komputerowi", "Oynayacağın renk": "Twój kolor",
    Beyaz: "Białe", Siyah: "Czarne", Random: "Losowo", "Start game": "Rozpocznij grę", "Tahtayı incele": "Obejrzyj planszę",
    "A fleet on the grid.": "Flota na siatce.", "Versus computer": "Przeciw komputerowi", "Hotseat (same device)": "Na zmianę (jedno urządzenie)",
    "Rotate (R)": "Obróć (R)", "Auto-place": "Rozmieść automatycznie", "Reset fleet": "Resetuj flotę", "Start battle": "Rozpocznij bitwę",
    "Önce filonu yerleştir": "Najpierw rozmieść flotę", "Bir tur nasıl işler?": "Jak działa tura?",
    "Nasıl kazanırım, nasıl kaybederim?": "Jak wygrać, jak przegrać?",
    // Apartman
    "MANAGER FILE": "AKTA ZARZĄDCY", "Estate Management Desk": "Biurko zarządu osiedla", BUILDING: "BUDYNEK",
    "TODAY'S ISSUES": "DZISIEJSZE SPRAWY", "BUILDING POLITICS": "POLITYKA BUDYNKU", "Recent ledger": "Ostatnie wpisy",
    "MEETING NIGHT": "WIECZÓR ZEBRANIA", "CLOSE THE WEEK": "ZAMKNIJ TYDZIEŃ", "How a week works": "Jak działa tydzień",
    "How residents vote": "Jak głosują mieszkańcy",
    // Kayıp Telefon
    "FOUND DEVICE": "ZNALEZIONE URZĄDZENIE", "Unlocks after another finding": "Odblokuje się po kolejnym odkryciu",
    Messages: "Wiadomości", "CASE NOTEBOOK": "NOTATNIK SPRAWY", EVIDENCE: "DOWODY", THEORY: "TEORIA", TIMELINE: "OŚ CZASU",
    "Final decision": "Ostateczna decyzja", "CLOSE CASE / RETURN": "ZAMKNIJ SPRAWĘ / ODDAJ", "How you make progress": "Jak robisz postępy",
    "Reading the findings": "Jak czytać odkrycia", "How it ends": "Jak się kończy",
    // SON KÖY MANAGER
    "A VILLAGE'S LAST CHANCE": "OSTATNIA SZANSA WSI", Budget: "Budżet", Population: "Ludność", Debt: "Dług", Capacity: "Zdolność",
    "CLOSE MONTH": "ZAMKNIJ MIESIĄC", "VILLAGE CENTRE": "CENTRUM WSI", AGENDA: "AGENDA", BUDGET: "BUDŻET", SERVICES: "USŁUGI",
    BUSINESSES: "FIRMY", "POPULATION / MIGRATION": "LUDNOŚĆ / MIGRACJA", PEOPLE: "LUDZIE", GROUPS: "GRUPY", INVESTORS: "INWESTORZY",
    FILES: "AKTA", "MONTHLY REPORT": "RAPORT MIESIĘCZNY", "THE EMPTYING VILLAGE": "PUSTOSZEJĄCA WIEŚ", "THIS MONTH'S PLAN": "PLAN NA TEN MIESIĄC",
    Urgent: "Pilne", "Investment · can wait": "Inwestycja · może poczekać", "Requests on your desk": "Prośby na twoim biurku",
    "How should I read the indicators?": "Jak czytać wskaźniki?", "How a month works": "Jak działa miesiąc",
    "What affects what": "Co na co wpływa", "What to watch": "Na co uważać", "CONSEQUENCE FEED": "KANAŁ SKUTKÓW",
    // TC SIM: DEVLET
    "State Center": "Centrum państwa", "ADVANCE MONTH": "NASTĘPNY MIESIĄC", ECONOMY: "GOSPODARKA", POLICY: "POLITYKA",
    INSTITUTIONS: "INSTYTUCJE", SOCIETY: "SPOŁECZEŃSTWO", FOREIGN: "SPRAWY ZAGRANICZNE", REGIONS: "REGIONY", "YEAR FILE": "AKTA ROKU",
    "PERIOD FILE": "AKTA OKRESU", "How to play this month": "Jak grać w tym miesiącu", "STATE DOSSIER": "DOSSIER PAŃSTWA",
    "What is happening this month?": "Co dzieje się w tym miesiącu?", "This month's decisions": "Decyzje tego miesiąca",
    "Browse all policies": "Przeglądaj wszystkie polityki", "Open dossiers": "Otwarte dossier", "PERIOD / REPORT LEDGER": "OKRES / KSIĘGA RAPORTÓW",
    "What does this mean?": "Co to oznacza?", "Inflation report": "Raport o inflacji", "Unemployment report": "Raport o bezrobociu",
    "Institutional delivery strength": "Siła realizacji instytucji", "How do decisions reach the field?": "Jak decyzje docierają w teren?",
    "How to read the reports": "Jak czytać raporty", "Open dossiers and the year file": "Otwarte dossier i akta roku",
    "SELECTED REGION": "WYBRANY REGION", "REGIONAL PRIORITY": "PRIORYTET REGIONALNY", "SELECTED PARTY": "WYBRANA STRONA",
    Priority: "Priorytet", "Resources / capacity": "Zasoby / zdolność", "Service gap / public reaction": "Luka w usługach / reakcja społeczna",
    "Next period": "Następny okres", "Make this month's priority": "Ustaw jako priorytet miesiąca", Launch: "Uruchom",
    "Trade talks": "Rozmowy handlowe", "Security accord": "Porozumienie bezpieczeństwa",
  };

  const CATALOG_EN = {
    "cete-savaslari": { title: "Çete Savaşları", subtitle: "Racon, district, cash in TL." },
    hanedanian: {
      title: "HANEDANIAN",
      subtitle: "From one settlement to a great dynasty. Read the map, build your future.",
    },
    racon: { title: "Racon Manager", subtitle: "Men die. The name remains." },
    "tc-sim": { title: "TC SIM", subtitle: "One life. Weekly choices, years of fallout." },
    bukucu: {
      title: "Son Mahalle Bükücü",
      subtitle: "Istanbul title deed. Who holds the district bends it. Money in TL.",
    },
    labirent: { title: "Labirent", subtitle: "Closed paths, one exit." },
    "peg-solitaire": { title: "Tek Taş", subtitle: "Jump. Leave one." },
    satranc: { title: "Satranç", subtitle: "Board, move, checkmate." },
    "amiral-batti": { title: "Amiral Battı", subtitle: "Fleet on a grid. Hit, miss, sunk." },
    apartman: {
      title: "Apartman: Apartman Yöneticisi",
      subtitle: "Run a two, four or ten-block estate where every shortcut returns as a cost.",
    },
    "kayip-telefon": {
      title: "Kayıp Telefon",
      subtitle: "A phone is lost. The life inside it surfaces.",
    },
    "son-100-gun": {
      title: "Son 100 Gün",
      subtitle: "The last hundred days. Every choice weighs more.",
    },
    "son-kasaba": {
      title: "SON KÖY MANAGER",
      subtitle: "Everyone is leaving. You stay and try to keep the village standing.",
    },
    "tc-sim-devlet": {
      title: "TC SIM: DEVLET",
      subtitle: "A multi-era state simulation. Institutions, economy and society from 1923 to 2030.",
    },
    "veto-h": {
      title: "VETO-H!",
      subtitle: "Election night. Build your campaign and answer your rival’s move.",
    },
    "gett-oh": {
      title: "GETT-OH!",
      subtitle: "Istanbul at night. Field your crew and play your street power.",
    },
    ihtilal: { title: "İhtilâl", subtitle: "The ruling is written. The archive does not forget." },
    "darbe-h": { title: "DARBE-H!", subtitle: "The telex lands. The desk decides." },
    "jitem-derin-ag": {
      title: "JITEM: Derin Ağ",
      subtitle: "1986–1996. Files don't stay buried. The network grows.",
    },
    esik: {
      title: "Kıyı Eşiği",
      subtitle: "A fictional coast of piers, stairs, ramps and a bridge joint. A broken threshold says why.",
    },
  };

  // The old public route still resolves to HANEDANIAN; keep cached callers aligned.
  CATALOG_EN.hanedan = CATALOG_EN.hanedanian;

  const CATALOG_PL = {
    "cete-savaslari": { title: "Çete Savaşları", subtitle: "Racon, dzielnica, gotówka w TL." },
    hanedanian: { title: "HANEDANIAN", subtitle: "Od jednej osady do wielkiej dynastii. Czytaj mapę, buduj przyszłość." },
    racon: { title: "Racon Manager", subtitle: "Ludzie umierają. Imię zostaje." },
    "tc-sim": { title: "TC SIM", subtitle: "Jedno życie. Tygodniowe wybory, lata konsekwencji." },
    bukucu: { title: "Son Mahalle Bükücü", subtitle: "Stambułskie akty własności. Kto trzyma dzielnicę, ten nią rządzi. Pieniądze w TL." },
    labirent: { title: "Labirent", subtitle: "Zamknięte ścieżki, jedno wyjście." }, "peg-solitaire": { title: "Tek Taş", subtitle: "Przeskakuj. Zostaw jeden pionek." },
    satranc: { title: "Satranç", subtitle: "Plansza, ruch, mat." }, "amiral-batti": { title: "Amiral Battı", subtitle: "Flota na siatce. Trafienie, pudło, zatopienie." },
    apartman: { title: "Apartman: Apartman Yöneticisi", subtitle: "Zarządzaj osiedlem z dwoma, czterema lub dziesięcioma blokami, gdzie każdy skrót ma swoją cenę." },
    "kayip-telefon": { title: "Kayıp Telefon", subtitle: "Telefon zaginął. Życie zapisane w środku wychodzi na jaw." },
    "son-100-gun": { title: "Son 100 Gün", subtitle: "Ostatnie sto dni. Każdy wybór waży więcej." },
    "son-kasaba": { title: "SON KÖY MANAGER", subtitle: "Wszyscy wyjeżdżają. Ty zostajesz i próbujesz utrzymać wieś przy życiu." },
    "tc-sim-devlet": { title: "TC SIM: DEVLET", subtitle: "Wieloepokowa symulacja państwa: instytucje, gospodarka i społeczeństwo od 1923 do 2030 roku." },
    "veto-h": { title: "VETO-H!", subtitle: "Noc wyborcza. Buduj kampanię i odpowiadaj na ruchy rywala." },
    "gett-oh": { title: "GETT-OH!", subtitle: "Stambuł nocą. Wystaw ekipę i rozegraj swoją uliczną siłę." },
    ihtilal: { title: "İHTİLÂL", subtitle: "Wyrok jest pisany. Archiwum nie zapomina." },
    "darbe-h": { title: "DARBE-H!", subtitle: "Nadchodzi teleks. Biurko podejmuje decyzję." },
    "jitem-derin-ag": { title: "JITEM: Derin Ağ", subtitle: "1986–1996. Akta nie pozostają pogrzebane. Sieć rośnie." },
    esik: { title: "Kıyı Eşiği", subtitle: "Wymyślone wybrzeże: nabrzeża, schody, rampy i przęsło mostu. Przerwany próg mówi dlaczego." },
  };
  CATALOG_PL.hanedan = CATALOG_PL.hanedanian;

  const CREDITS_EN = {
    h1: "Resources",
    kicker: "TarikLab · games and technical structure",
    back: "← Games",
    sections: [
      {
        h: "Catalog",
        lead: "TarikLab has 20 playable games.",
        items: [
          '<a href="/cete-savaslari">Çete Savaşları</a> · LIVE — Build a crew, run missions and hold turf under police and rival pressure.',
          '<a href="/oyna/hanedanian">HANEDANIAN</a> · LIVE — Build settlements, secure resources and lead a dynasty across a seeded strategy map; single-player and offline-first.',
          '<a href="/oyna/racon">Racon Manager</a> · LIVE — Narrative management shaped by relationships, decisions and delayed consequences.',
          '<a href="/oyna/tc-sim">TC SIM</a> · LIVE — Allocate six weekly time-and-focus blocks across work, education, family, friends, relationships and recovery. Some choices return as Long Shadows years later.',
          '<a href="/games/bukucu/index.html">Son Mahalle Bükücü</a> · LIVE — A neighborhood board game of dice, deeds, auctions and trades.',
          '<a href="/oyna/labirent">Labirent</a> · LIVE — Find the exit through a newly generated maze.',
          '<a href="/oyna/peg-solitaire">Tek Taş</a> · LIVE — Use legal jumps to leave one piece on the board.',
          '<a href="/oyna/satranc">Satranç</a> · LIVE — Chess with a local rules engine, move history and a computer opponent with distinct levels.',
          '<a href="/oyna/amiral-batti">Amiral Battı</a> · LIVE — Place a fleet and hunt coordinates against an easy, medium or hard opponent.',
          '<a href="/oyna/apartman">Apartman: Apartman Yöneticisi</a> · LIVE — Run a two, four or ten-block estate through dues, maintenance, staffing, residents and board pressure.',
          '<a href="/oyna/kayip-telefon">Kayıp Telefon</a> · LIVE — Corroborate clues across eight apps and weigh the privacy cost of returning a lost phone.',
          '<a href="/oyna/son-100-gun">Son 100 Gün</a> · LIVE — A one-seat life game: a hundred days, one decision per period. Body, savings, your people, calm and the mark you leave share one calendar.',
          '<a href="/oyna/tc-sim-devlet">TC SIM: DEVLET</a> · LIVE — Govern policy, institutions, regions and treasury through capacity, political capital, bureaucratic friction and crisis load.',
          '<a href="/oyna/son-koy-manager">SON KÖY MANAGER</a> · LIVE — Spend changing field capacity and action effort across water, energy, migration, production and trust over 24 months.',
          '<a href="/oyna/veto-h">VETO-H!</a> · LIVE — A 300-card election and campaign duel with a seeded 40-card deck, a computer opponent and a pregame Card Archive. Card art was made with AI tools (see below).',
          '<a href="/oyna/gett-oh">GETT-OH!</a> · LIVE — A 300-card neighborhood and street-power duel: the same deterministic engine, a separate card pool and an Istanbul-night table. Card art was made with AI tools (see below).',
          '<a href="/oyna/ihtilal">İhtilâl</a> · LIVE — A one-seat desk: load, trust, information and tension are tied together across fictional basins; choose between short relief and a delayed load.',
          '<a href="/oyna/darbe-h">DARBE-H!</a> · LIVE — A fictional Extraordinary Desk duel of officers, orders and notices: the shared duel engine, a separate 300-card pool and crisis points. Plate art was made with AI tools (see below).',
          '<a href="/oyna/jitem-derin-ag">JITEM: Derin Ağ</a> · LIVE — A single-player strategy game set across 1986–1996, built around sourced historical records, relationship networks, asymmetric knowledge and institutional behavior.',
          '<a href="/oyna/esik">Kıyı Eşiği</a> · LIVE — A fictional coast. Link a pier, stair, ramp, tunnel mouth and bridge joint. A broken threshold says why.',
        ],
      },
      {
        h: "How it works",
        lead: "TarikLab is a collection of independent games that run directly in the browser. The portal and Çete Savaşları use React and TypeScript; the other games run as their own HTML, CSS and JavaScript applications.",
        items: [
          "Most long-running games use three local slots, kept separate on the same device. HANEDANIAN keeps an autosave, its previous version and a separate manual save, with file export/import. Original HANEDAN saves remain accessible through the legacy game. VETO-H!, GETT-OH! and DARBE-H! each autosave one active duel; reload preserves deck order, action rights and pending responses.",
          "The portal and all 20 live games support Turkish and English; each game keeps its own voice while the outer shell owns language navigation.",
          "Polish covers the interface only (menus, saves, navigation, main buttons); game text is shown in English to Polish readers.",
          "Interfaces adapt to phone, tablet and desktop while preserving each game's own visual and interaction identity.",
        ],
      },
      {
        h: "Contribution and attribution",
        note: "Tarık is his mother's son.",
      },
      {
        h: "TLab Classics",
        lead: "Labirent, Tek Taş, Satranç and Amiral Battı were rewritten from scratch for TarikLab with independent game logic, interface and visuals. None carry an external runtime dependency.",
        items: [
          "Labirent — independent TarikLab implementation. No external dependency.",
          "Tek Taş — independent TarikLab implementation. No external dependency.",
          "Satranç — independent TarikLab rules engine and original piece set. No external dependency.",
          "Amiral Battı — independent TarikLab grid-fleet implementation. Public-domain concept; original TLab code and visuals. No external dependency.",
        ],
        note: "Classic game rules (maze, peg solitaire, chess, grid-fleet) are public-domain concepts; this notice covers only TarikLab's own code, interface and original content.",
      },
      {
        h: "Visuals and chain of title",
        lead: "Only rights with a verified record are shown here as licences.",
        items: [
          "Code-drawn visuals (game emblems, the T monogram, icons, seed-generated maps, DEVLET region outlines): TarikLab, all rights reserved.",
          "No font files, audio files or third-party map data are used.",
          "AI-generated images: VETO-H! and GETT-OH! card art and backgrounds, DARBE-H! plates. The generation tool, account and the terms in force on the generation date were not recorded; no licence is claimed for these images until the record is complete.",
          "Images whose creator was not recorded: the portal share images, JITEM: Derin Ağ images and the Son Mahalle Bükücü icons. Under review.",
        ],
      },
      {
        h: "Third-party components",
        lead: "Principal third-party components of the portal and Çete Savaşları application: React, TanStack Router, Zustand, Radix UI, Lucide and Zod. Rights in those components belong to their owners. The note on TLab Classics' independent game logic is separate from this application stack. The 54 packages shipped to the browser have verified licences: 51 MIT, 1 Apache-2.0, 1 ISC, 1 0BSD. The JITEM: Derin Ağ runtime package list has not been generated yet.",
      },
    ],
    legal:
      "© 2026 TarikLab. All rights reserved. No claim is made over public-domain classic game rules.",
  };

  const CREDITS_PL = {
    h1: "Materiały źródłowe", kicker: "TarikLab · gry i struktura techniczna", back: "← Gry",
    sections: [
      { h: "Katalog", lead: "TarikLab ma 20 dostępnych gier.", items: [
        '<a href="/cete-savaslari">Çete Savaşları</a> · LIVE — Zbuduj ekipę, prowadź zadania i utrzymuj dzielnicę pod presją policji oraz rywali.',
        '<a href="/oyna/hanedanian">HANEDANIAN</a> · LIVE — Buduj osady, zabezpieczaj zasoby i prowadź dynastię na generowanej mapie strategii.',
        '<a href="/oyna/racon">Racon Manager</a> · LIVE — Narracyjna gra menedżerska o relacjach, decyzjach i opóźnionych konsekwencjach.',
        '<a href="/oyna/tc-sim">TC SIM</a> · LIVE — Rozdzielaj tygodniowe bloki czasu między pracę, edukację, rodzinę i odpoczynek.',
        '<a href="/games/bukucu/index.html">Son Mahalle Bükücü</a> · LIVE — Planszowa gra dzielnicowa o kościach, aktach własności, aukcjach i wymianie.',
        '<a href="/oyna/labirent">Labirent</a> · LIVE — Znajdź wyjście z nowo wygenerowanego labiryntu.',
        '<a href="/oyna/peg-solitaire">Tek Taş</a> · LIVE — Wykonuj legalne skoki, aby zostawić jeden pionek na planszy.',
        '<a href="/oyna/satranc">Satranç</a> · LIVE — Szachy z lokalnym silnikiem zasad, historią ruchów i komputerowym rywalem.',
        '<a href="/oyna/amiral-batti">Amiral Battı</a> · LIVE — Rozmieść flotę i poluj na współrzędne przeciw rywalowi o wybranym poziomie trudności.',
        '<a href="/oyna/apartman">Apartman: Apartman Yöneticisi</a> · LIVE — Zarządzaj osiedlem poprzez opłaty, utrzymanie, personel i naciski rady.',
        '<a href="/oyna/kayip-telefon">Kayıp Telefon</a> · LIVE — Potwierdzaj wskazówki z ośmiu aplikacji i rozważ koszt prywatności zwrotu telefonu.',
        '<a href="/oyna/son-100-gun">Son 100 Gün</a> · LIVE — Gra o jednym życiu: sto dni, jedna decyzja na okres. Ciało, oszczędności, bliscy, spokój i ślad, który zostawisz, dzielą jeden kalendarz.',
        '<a href="/oyna/tc-sim-devlet">TC SIM: DEVLET</a> · LIVE — Zarządzaj polityką, instytucjami, regionami i skarbem państwa.',
        '<a href="/oyna/son-koy-manager">SON KÖY MANAGER</a> · LIVE — Przez 24 miesiące rozdzielaj zdolność działania między wodę, energię, migrację i zaufanie.',
        '<a href="/oyna/veto-h">VETO-H!</a> · LIVE — Pojedynek wyborczy i kampanijny na 300 kart z talią 40 kart. Grafiki kart powstały przy użyciu narzędzi AI (zob. niżej).',
        '<a href="/oyna/gett-oh">GETT-OH!</a> · LIVE — Pojedynek o dzielnicę i uliczną siłę: wspólny silnik, osobna pula kart i stambulska noc. Grafiki kart powstały przy użyciu narzędzi AI (zob. niżej).',
        '<a href="/oyna/ihtilal">İHTİLÂL</a> · LIVE — Biurko dla jednej osoby: obciążenie, zaufanie, informacja i napięcie w fikcyjnych dorzeczach; wybór między krótką ulgą a odroczonym ciężarem.',
        '<a href="/oyna/darbe-h">DARBE-H!</a> · LIVE — Fikcyjny pojedynek nadzwyczajnego biurka z oddzielną pulą 300 kart. Grafiki plansz powstały przy użyciu narzędzi AI (zob. niżej).',
        '<a href="/oyna/jitem-derin-ag">JITEM: Derin Ağ</a> · LIVE — Jednoosobowa strategia 1986–1996 oparta na źródłowych zapisach historycznych, sieciach relacji i asymetrycznej wiedzy.',
        '<a href="/oyna/esik">Kıyı Eşiği</a> · LIVE — Wymyślone wybrzeże. Nabrzeże, schody, rampa, wylot tunelu i przęsło mostu. Przerwany próg mówi dlaczego.',
      ]},
      { h: "Jak to działa", lead: "TarikLab to zbiór niezależnych gier działających bezpośrednio w przeglądarce.", items: ["Portal i Çete Savaşları używają Reacta i TypeScriptu; pozostałe gry są osobnymi aplikacjami HTML, CSS i JavaScript.", "Portal i wszystkie 20 dostępnych gier obsługują turecki i angielski. Polski obejmuje tylko interfejs (menu, zapisy, nawigacja, główne przyciski); tekst gier jest pokazywany po angielsku.", "Interfejsy dostosowują się do telefonu, tabletu i komputera." ]},
      { h: "Autorstwo", note: "Tarık jest synem swojej matki." },
      { h: "TLab Classics", lead: "Labirent, Tek Taş, Satranç i Amiral Battı zostały napisane od podstaw dla TarikLab.", items: ["Labirent — niezależna implementacja TarikLab.", "Tek Taş — niezależna implementacja TarikLab.", "Satranç — niezależny silnik zasad TarikLab.", "Amiral Battı — niezależna implementacja siatki i floty TarikLab."], note: "Klasyczne zasady gier są koncepcjami domeny publicznej; ta informacja dotyczy wyłącznie kodu, interfejsu i oryginalnej treści TarikLab." },
      { h: "Grafiki i łańcuch praw", lead: "Jako licencje pokazujemy tylko prawa z potwierdzonym zapisem.", items: [
        "Grafiki rysowane kodem (emblematy gier, monogram T, ikony, mapy generowane z ziarna, obrysy regionów DEVLET): TarikLab, wszelkie prawa zastrzeżone.",
        "Nie używamy plików czcionek, plików dźwiękowych ani zewnętrznych danych map.",
        "Obrazy wygenerowane przez AI: grafiki kart i tła VETO-H! i GETT-OH!, plansze DARBE-H!. Narzędzie, konto i warunki obowiązujące w dniu generowania nie zostały zapisane; do czasu uzupełnienia zapisu nie deklarujemy dla nich licencji.",
        "Obrazy bez zapisanego autora: grafiki udostępniania portalu, grafiki JITEM: Derin Ağ i ikony Son Mahalle Bükücü. W trakcie weryfikacji.",
      ]},
      { h: "Komponenty zewnętrzne", lead: "Główne komponenty zewnętrzne portalu i Çete Savaşları: React, TanStack Router, Zustand, Radix UI, Lucide i Zod. Prawa do nich należą do ich właścicieli. 54 pakiety wysyłane do przeglądarki mają potwierdzone licencje: 51 MIT, 1 Apache-2.0, 1 ISC, 1 0BSD. Lista pakietów środowiska JITEM: Derin Ağ nie została jeszcze wygenerowana." },
    ],
    legal: "© 2026 TarikLab. Wszelkie prawa zastrzeżone. Nie zgłasza się roszczeń do klasycznych zasad gier z domeny publicznej.",
  };

  const CETE_HELP_EN = [
    {
      title: "Aim",
      body: "Start on the street, build a crew, stack cash and reputation, hold your district. There is no single win beat; the till, reputation and staying alive move together.",
    },
    {
      title: "Core loop",
      body: "Take work from Jobs, kit weapons/armor/wheels from the Shop, press a corner or squeeze a district on the Street, grow a dealer corner in Property. Time runs on a real clock; speed it with ×N or skip with 'pass 1 hour'.",
    },
    {
      title: "Controls",
      body: "Tabs at the bottom (phone) or left (desktop) take you to Me, Jobs, Shop, Property, Street, Life and Clinic. The ledger icon shows recent events.",
    },
    {
      title: "Resources and meters",
      body: "Rounds & Stamina are energy, Racon & Charisma are toughness, Health is the body, Heat is police attention. When Heat rises, patrols and rival pressure rise. Till, investments, reputation and the bribe fund sit under Detail.",
    },
    {
      title: "Progress",
      body: "Work earns XP and rank; each rank has its own moniker. A season lasts 14 days and season score accumulates. Buy districts and grow corners for regular tribute.",
    },
    {
      title: "Risk and loss",
      body: "If Health drops under 20 or you get pinched you land in Clinic or holding; you cannot work for that stretch. A bribe fund can shorten holding. Cash you have not banked is at risk on the street while Heat is high.",
    },
    {
      title: "Saves",
      body: "The game autosaves on this device (localStorage). Sign in and progress also backs up to the cloud; guest play stays on this device only.",
    },
    {
      title: "First-run tips",
      body: "Do a few jobs first. Do not walk the street unarmed. If Heat is up, sit in the till for a while. Open a dealer corner early; regular income is the biggest swing. Learn to keep cash in the till.",
    },
    {
      title: "Note",
      body: "Fiction. Not an invitation to real gambling, drugs or violence. Gambling/bar beats on the Life tab are in-game fiction too.",
    },
  ];

  const HELP_EN = {
    apartman:
      "Pick an issue, prepare the file, put one proposal to a vote on Meeting Night, then close the week. Cheap patches return. Raising dues too often stops payment.",
    "son-100-gun":
      "One hundred days, one decision per period. Every option shows its intent, certain cost, odds and what carries forward. Situations you pass over wait or fade; the ending follows what you invested in most.",
    "kayip-telefon":
      "This phone is not yours. Eight apps open through discovery. Corroboration and contradiction change the ending. Return at any time; going deeper raises privacy cost.",
    "tc-sim-devlet":
      "Set the period, mode, goal and doctrine, then govern through capacity, political capital, bureaucratic friction and crisis load. Advance Month when the cabinet is ready. Reported figures include confidence: intent is not implementation.",
    fallback: "Save slots are local to this device.",
  };

  const TCSIM_HELP_EN = [
    {
      title: "Aim",
      body: "You run one life through weekly choices. Career, money, relationships and health pull on each other; the point is a livable balance, not a perfect plan.",
    },
    {
      title: "Weekly loop",
      body: "Each week gives you six time-and-focus blocks. Work, study, family, friends, relationships and recovery consume different shares; then the week closes and wages, rent and regular costs land on schedule.",
    },
    {
      title: "Controls",
      body: "The top menu moves you through Home, Me, Calendar, Money, Work, Education, People, Family/Relations, Home, Body, History and the Year File. Some picks open an event window; the answer there applies immediately without advancing the week.",
    },
    {
      title: "Work and money",
      body: "Finding work, promotion and education hit Money directly. The Money screen shows balance, monthly in/out and net worth: cash, investments, property, vehicles/goods and debt. Living standard and subscriptions live there too.",
    },
    {
      title: "Progress and meters",
      body: "Body tracks energy/stress/health, Calendar holds appointments and delayed fallout, the Year File keeps each year's summary. People and Family/Relations carry trust, closeness and tension.",
    },
    {
      title: "Risk and fallout",
      body: "Neglected health makes demanding plans harder and neglected relationships cool. Some consequences return weeks later as events, a message or a rent notice, not immediately. Career, school, love, family, debt, housing, circle, status, health and crisis bind in one life — not a random card, the life you stacked.",
    },
    {
      title: "Saves",
      body: "The game autosaves in the browser store; Save in the header also writes by hand. New Game wipes the current life and asks for confirmation.",
    },
    {
      title: "First-run tips",
      body: "Find work first and settle a few weeks. Rest before health turns critical. Keep some cash. Do not cut family and close circle; later openings lean on those ties.",
    },
    {
      title: "Later life: retirement, inheritance, generation",
      body: "From the sixties, enough work history lets you weigh retirement. When a life ends a Life Report appears; an adult child can continue as the next generation, carrying wealth and family ties.",
    },
  ];

  function normalizeLang(value) {
    return value === "tr" || value === "en" || value === "pl" ? value : "tr";
  }

  function readLang() {
    try {
      const v = root.localStorage && root.localStorage.getItem(KEY);
      return normalizeLang(v);
    } catch {
      return "tr";
    }
  }

  let lang = typeof root.localStorage === "undefined" ? "tr" : readLang();

  function applyHtmlLang() {
    if (typeof document === "undefined") return;
    document.documentElement.lang = lang;
  }

  function getLang() {
    return lang;
  }

  function setLang(next) {
    const n = normalizeLang(next);
    if (n === lang) {
      applyHtmlLang();
      return lang;
    }
    lang = n;
    try {
      root.localStorage.setItem(KEY, lang);
    } catch {
      /* ignore */
    }
    applyHtmlLang();
    [...listeners].forEach((fn) => {
      try {
        fn(lang);
      } catch {
        /* ignore */
      }
    });
    if (typeof document !== "undefined") {
      document.dispatchEvent(new CustomEvent("tlab-language", { detail: lang }));
    }
    return lang;
  }

  function onLang(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  if (typeof root.addEventListener === "function") {
    root.addEventListener("storage", (event) => {
      if (event.key !== KEY && event.key !== null) return;
      let next = "tr";
      try {
        next = root.localStorage.getItem(KEY);
      } catch {
        /* TR fallback */
      }
      setLang(next);
    });
  }

  const own = (dict, key) => Object.prototype.hasOwnProperty.call(dict, key);

  function t(key, fallback) {
    // Polish falls back to English, never to Turkish source text.
    if (lang === "pl") return PL[key] ?? EN[key] ?? fallback ?? key;
    const dictionary = lang === "en" ? EN : null;
    return dictionary?.[key] ?? fallback ?? key;
  }

  /** "tr" or "en": the language game content is written in for this reader.
   *  Polish readers get English content where no Polish text exists. */
  function contentLang() {
    return lang === "tr" ? "tr" : "en";
  }

  /** Polish for a Turkish or English source string, if one is authored. */
  function polish(text) {
    if (text == null) return null;
    const raw = String(text);
    if (own(PHRASE_PL, raw)) return PHRASE_PL[raw];
    const en = englishPhrase(raw);
    return own(PHRASE_PL, en) ? PHRASE_PL[en] : null;
  }

  /** Pick the reader's text from a Turkish source and an optional English
   *  version: Polish when authored, otherwise English, otherwise Turkish. */
  function localize(tr, en) {
    if (lang === "tr") return tr;
    const english = en ?? englishPhrase(String(tr ?? ""));
    if (lang === "pl") return polish(tr) ?? polish(english) ?? english;
    return english;
  }

  function phrase(text) {
    if (lang === "tr" || text == null) return text;
    const raw = String(text);
    if (lang === "pl") return polish(raw) ?? englishPhrase(raw);
    return englishPhrase(raw);
  }

  function englishPhrase(raw) {
    if (own(PHRASE, raw)) return PHRASE[raw];
    const pieces = { Kale: "Rook", At: "Knight", Fil: "Bishop", Vezir: "Queen", Şah: "King", Piyon: "Pawn" };
    let match = raw.match(/^([a-h][1-8]), (Beyaz|Siyah) (Kale|At|Fil|Vezir|Şah|Piyon)$/);
    if (match) return `${match[1]}, ${match[2] === "Beyaz" ? "White" : "Black"} ${pieces[match[3]]}`;
    match = raw.match(/^([a-h][1-8]), boş$/);
    if (match) return `${match[1]}, empty`;
    match = raw.match(/^(Beyaz|Siyah) (Kale|At|Fil|Vezir|Şah|Piyon) seçildi\.$/);
    if (match) return `${match[1] === "Beyaz" ? "White" : "Black"} ${pieces[match[2]]} selected.`;
    match = raw.match(/^([1-7])\. sıra ([1-7])\. sütundaki taş(, seçili)?$/);
    if (match) return `Peg at row ${match[1]}, column ${match[2]}${match[3] ? ", selected" : ""}`;
    match = raw.match(/^([1-7])\. sıra ([1-7])\. sütuna atla$/);
    if (match) return `Jump to row ${match[1]}, column ${match[2]}`;
    match = raw.match(/^Taş seçildi — (\d+) olası atlayış\.$/);
    if (match) return `Peg selected — ${match[1]} possible jumps.`;
    match = raw.match(/^(rakip|kendi) (10|[1-9])-(10|[1-9])$/);
    if (match) return `${match[1] === "rakip" ? "Enemy" : "Own"} ${match[2]}-${match[3]}`;
    match = raw.match(/^Slot ([1-3]) (devam|· boş)$/);
    if (match) return match[2] === "devam" ? `Continue slot ${match[1]}` : `Slot ${match[1]} · empty`;
    return raw;
  }

  function catalogEntry(slug, title, subtitle) {
    const catalog = lang === "en" ? CATALOG_EN : lang === "pl" ? CATALOG_PL : null;
    if (!catalog) return { title, subtitle };
    const row = catalog[slug];
    return {
      title: row?.title ?? title,
      subtitle: row?.subtitle ?? subtitle,
    };
  }

  function applyPhrases(rootEl) {
    if (typeof document === "undefined") return;
    const el = rootEl || document.body;
    if (!el) return;
    const walk = (node) => {
      if (node.nodeType === 3) {
        const v = node.nodeValue;
        if (!v) return;
        const trimmed = v.trim();
        if (!trimmed) return;
        const translated = phrase(trimmed);
        if (translated !== trimmed) {
          node.nodeValue = v.replace(trimmed, translated);
        }
        return;
      }
      if (node.nodeType !== 1) return;
      if (["SCRIPT", "STYLE", "TEXTAREA"].includes(node.tagName)) return;
      if (node.closest && node.closest("[data-i18n-skip]")) return;
      const attrs = ["aria-label", "title", "placeholder", "alt"];
      for (const a of attrs) {
        const cur = node.getAttribute && node.getAttribute(a);
        if (cur && phrase(cur) !== cur) {
          node.setAttribute(a, phrase(cur));
        }
      }
      const kids = node.childNodes;
      for (let i = 0; i < kids.length; i++) walk(kids[i]);
    };
    walk(el);
  }

  function mountLangToggle(host) {
    if (typeof document === "undefined" || !host) return null;
    let box = host.querySelector("[data-tlab-lang]");
    if (!box) {
      box = document.createElement("div");
      box.setAttribute("data-tlab-lang", "1");
      box.className = "tlab-lang";
      host.appendChild(box);
    }
    const render = () => {
      box.innerHTML =
        `<div class="tlab-lang-switch" role="group" aria-label="${t("lang.label", "Dil")}">` +
        `<button type="button" class="${lang === "tr" ? "is-on" : ""}" data-lang="tr" aria-pressed="${lang === "tr"}">TR</button>` +
        `<button type="button" class="${lang === "en" ? "is-on" : ""}" data-lang="en" aria-pressed="${lang === "en"}">EN</button>` +
        `<button type="button" class="${lang === "pl" ? "is-on" : ""}" data-lang="pl" aria-pressed="${lang === "pl"}">PL</button>` +
        `</div>`;
      box.querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", () => setLang(btn.getAttribute("data-lang")));
      });
    };
    render();
    if (!box._tlabBound) {
      box._tlabBound = true;
      onLang(render);
    }
    return box;
  }

  const style = `
.tlab-lang{display:inline-flex;align-items:center;margin-left:auto}
.tlab-lang-switch{display:inline-flex;border:1px solid #2c2621;border-radius:999px;overflow:hidden}
.tlab-lang-switch button{background:transparent;color:#9a9086;border:0;padding:.25rem .55rem;font:600 11px/1.2 system-ui,sans-serif;letter-spacing:.08em;cursor:pointer}
.tlab-lang-switch button.is-on{background:#efe8de;color:#12100e}
.tlab-lang-switch button:focus-visible{outline:2px solid #c45c4a;outline-offset:2px}
/* Play routes already supply the portal back action and language switch. Keep
   standalone game URLs self-contained, but remove the duplicated site chrome
   when the same document is embedded in TarikLab's play shell. */
html.tlab-embedded a[href="/"],
html.tlab-embedded [data-lang-host],
html.tlab-embedded .tlab-lang{display:none!important}
html.tlab-embedded .global-chrome:not(:has(.topbar__title)):not(:has(.topbar__tools)){display:none!important}
`;

  if (typeof document !== "undefined") {
    const inject = () => {
      document.documentElement.classList.toggle("tlab-embedded", window.self !== window.top);
      if (!document.getElementById("tlab-i18n-style")) {
        const tag = document.createElement("style");
        tag.id = "tlab-i18n-style";
        tag.textContent = style;
        document.head.appendChild(tag);
      }
      applyHtmlLang();
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", inject);
    else inject();
  }

  const api = {
    KEY,
    EN, PL, PHRASE, PHRASE_PL, CATALOG_EN, CATALOG_PL, CREDITS_EN, CREDITS_PL,
    normalizeLang,
    CETE_HELP_EN,
    HELP_EN,
    TCSIM_HELP_EN,
    getLang,
    setLang,
    onLang,
    t,
    phrase,
    polish,
    localize,
    contentLang,
    catalogEntry,
    applyPhrases,
    applyHtmlLang,
    mountLangToggle,
    requiredEnKeys: Object.keys(EN),
  };

  root.tlabI18n = api;
  root.tlabPhrase = phrase;
  root.tlabT = t;
})(typeof globalThis !== "undefined" ? globalThis : window);
