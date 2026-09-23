// Son 100 Gün — single-seat point-of-view content. Original text written for
// TarikLab. No real person, clinic or institution is depicted.
const L = (tr, en) => ({ tr, en });

/** Who you are for these hundred days. People keys are kin, friend, young. */
export const SCENARIOS = [
  {
    id: "ogretmen",
    name: L("Edebiyat öğretmeni", "Literature teacher"),
    pitch: L(
      "Emekliliğe iki yıl vardı. Sınıf hâlâ bekliyor, kız kardeşin henüz bilmiyor.",
      "Retirement was two years away. The class still waits, and your sister does not know yet.",
    ),
    work: L("ders kitabı taslağı", "the textbook draft"),
    job: L("okul", "the school"),
    asset: L("araban", "your car"),
    people: {
      kin: {
        name: "Selma",
        role: L("kız kardeşin", "your sister"),
        dat: "Selma'ya",
        acc: "Selma'yı",
      },
      friend: {
        name: "Ferit",
        role: L("eski meslektaşın", "your former colleague"),
        dat: "Ferit'e",
        acc: "Ferit'i",
      },
      young: { name: "Deniz", role: L("yeğenin", "your niece"), dat: "Deniz'e", acc: "Deniz'i" },
    },
    start: { body: 66, money: 30, peace: 38, mark: 18, kin: 46, friend: 40, young: 44 },
    wage: 0.55,
    burn: 0.45,
  },
  {
    id: "usta",
    name: L("Saat ustası", "Watchmaker"),
    pitch: L(
      "Otuz yıllık dükkânın vitrini hâlâ çarşıya bakıyor. Oğlun başka şehirde, çırağın her sabah erken geliyor.",
      "Your shop window has faced the arcade for thirty years. Your son lives in another city; your apprentice comes early every morning.",
    ),
    work: L("tamir defteri", "the repair ledger"),
    job: L("dükkân", "the shop"),
    asset: L("evin alt katı", "the flat downstairs"),
    people: {
      kin: { name: "Kerem", role: L("oğlun", "your son"), dat: "Kerem'e", acc: "Kerem'i" },
      friend: {
        name: "Rıza",
        role: L("karşı dükkândaki komşun", "your neighbour across the arcade"),
        dat: "Rıza'ya",
        acc: "Rıza'yı",
      },
      young: { name: "Elif", role: L("çırağın", "your apprentice"), dat: "Elif'e", acc: "Elif'i" },
    },
    start: { body: 58, money: 22, peace: 48, mark: 22, kin: 34, friend: 56, young: 50 },
    wage: 0.5,
    burn: 0.4,
  },
  {
    id: "cevirmen",
    name: L("Çevirmen", "Translator"),
    pitch: L(
      "Yarım kalan bir kitap çevirisi, bakıma muhtaç bir anne ve yıllardır konuşmadığın bir dost.",
      "A half-finished book translation, a mother who needs care, and a friend you have not spoken to in years.",
    ),
    work: L("çeviri", "the translation"),
    job: L("yayınevi", "the publisher"),
    asset: L("kitaplığın", "your library"),
    people: {
      kin: {
        name: "Hayriye",
        role: L("annen", "your mother"),
        dat: "Hayriye'ye",
        acc: "Hayriye'yi",
      },
      friend: {
        name: "Can",
        role: L("eski dostun", "your old friend"),
        dat: "Can'a",
        acc: "Can'ı",
      },
      young: { name: "İpek", role: L("stajyerin", "your intern"), dat: "İpek'e", acc: "İpek'i" },
    },
    start: { body: 72, money: 14, peace: 30, mark: 16, kin: 52, friend: 24, young: 38 },
    wage: 0.45,
    burn: 0.45,
  },
];

export const PHASES = {
  start: L("Başlangıç", "Beginning"),
  routine: L("Düzen", "Routine"),
  break: L("Kırılma", "Breaking point"),
  end: L("Son günler", "Last days"),
};

/** Standing rhythm. Applied at every period close once chosen. */
export const ROUTINES = {
  body: {
    name: L("Beden ritmi", "Body rhythm"),
    each: L(
      "Beden daha yavaş yorulur (×0,7), iç huzur +1, birikim −1.",
      "Body tires more slowly (×0.7), calm +1, savings −1.",
    ),
  },
  work: {
    name: L("İş ritmi", "Work rhythm"),
    each: L(
      "Gelir ×1,3, iz +1; beden daha hızlı yorulur (×1,1).",
      "Income ×1.3, mark +1; body tires faster (×1.1).",
    ),
  },
  table: {
    name: L("Sofra ritmi", "Table rhythm"),
    each: L("Üç yakının her biri +3, birikim −1.", "Each of your three people +3, savings −1."),
  },
  desk: {
    name: L("Masa ritmi", "Desk rhythm"),
    each: L("İz +2, iç huzur +1; ilk yakının −1.", "Mark +2, calm +1; your closest relation −1."),
  },
};

// Card fields: phases, once | cd (cooldown in periods), core (always drawn first
// in its phase), urgent (drawn first when true), when (eligibility), target
// ("lowest" | "highest" person), scen (scenario ids), lapse (effect when shown
// and not chosen). Options: fx, risk {p, win, lose, flag}, later [{in, fx}],
// flag, routine, job, needs {body, flag, noflag}, keep (card stays open).
export const CARDS = [
  // ——— Beginning ———
  {
    id: "tell",
    phases: ["start"],
    once: true,
    core: true,
    title: L("Kime söyleyeceksin?", "Who do you tell?"),
    text: L(
      "Hekimin sesi hâlâ kulağında: yaklaşık yüz gün. Henüz kimse bilmiyor.",
      "The doctor's voice is still in your ears: roughly a hundred days. Nobody knows yet.",
    ),
    lapse: {
      fx: { peace: -2 },
      text: L(
        "Söylenmemiş şey bir hafta daha taşındı.",
        "The unsaid thing was carried another week.",
      ),
    },
    options: [
      {
        id: "kin",
        label: L("{kin.dat} bugün söyle", "Tell {kin} today"),
        intent: L(
          "Yükü paylaşmak. İlk konuşma zor olacak.",
          "Share the weight. The first conversation will be hard.",
        ),
        fx: { peace: -3 },
        risk: {
          p: 0.7,
          win: { kin: 12 },
          lose: { kin: 2, peace: -4 },
          winText: L("Uzun sustu, sonra elini tuttu.", "A long silence, then a hand on yours."),
          loseText: L(
            "Önce öfke geldi; sana değil, habere.",
            "Anger came first — at the news, not at you.",
          ),
        },
        later: [
          {
            in: 2,
            fx: { peace: 4 },
            text: L("Paylaşılan yük hafifledi.", "The shared weight grew lighter."),
          },
        ],
        flag: "told",
      },
      {
        id: "all",
        label: L("Herkese birden, sade bir mesajla", "Everyone at once, one plain message"),
        intent: L(
          "Tek seferde bitsin. Yakınlık biraz kaybolur.",
          "Get it over with at once. Some closeness is lost.",
        ),
        fx: { people: 4, peace: 2 },
        later: [
          {
            in: 1,
            fx: { kin: -4 },
            text: L(
              "{kin} bunu bir mesajdan öğrenmeyi hazmedemedi.",
              "{kin} could not quite forgive learning it from a message.",
            ),
          },
        ],
        result: L(
          "Mesaj gitti. Telefon akşama kadar sustu.",
          "The message went out. The phone stayed quiet until evening.",
        ),
        flag: "told",
      },
      {
        id: "none",
        label: L("Şimdilik kimseye söyleme", "Tell no one for now"),
        intent: L(
          "Günler olağan kalsın. Sır büyüdükçe ağırlaşır.",
          "Keep the days ordinary. A secret gets heavier as it grows.",
        ),
        fx: { peace: 4 },
        later: [
          {
            in: 4,
            fx: { people: -5, peace: -3 },
            text: L(
              "Sonradan öğrendiler. En çok beklemen koydu.",
              "They found out later. The waiting hurt them most.",
            ),
          },
        ],
        result: L("Akşam yemeği her zamanki gibi geçti.", "Supper went by like any other."),
        flag: "secret",
      },
    ],
  },
  {
    id: "doctor",
    phases: ["start"],
    once: true,
    core: true,
    title: L("Tedavi görüşmesi", "The treatment talk"),
    text: L(
      "Hekim iki yol anlatıyor. İkisi de süreyi değil, günlerin nasıl geçeceğini değiştirir.",
      "The doctor describes two paths. Neither changes the count, only how the days will pass.",
    ),
    lapse: {
      fx: { body: -2 },
      text: L("Karar ertelendi; beden beklemedi.", "The decision waited; the body did not."),
    },
    options: [
      {
        id: "intensive",
        label: L("Yoğun tedaviyi dene", "Try the intensive treatment"),
        intent: L(
          "Bedeni korumak için bugünden bedel ödemek.",
          "Pay now to protect the body later.",
        ),
        fx: { money: -8, body: -6 },
        risk: {
          p: 0.55,
          win: { peace: 3 },
          lose: { body: -6, peace: -3 },
          flag: "responding",
          winText: L(
            "İlk kontrol umut verdi. Beden artık daha yavaş yoruluyor.",
            "The first check-up gave hope. The body now tires more slowly.",
          ),
          loseText: L(
            "Yan etkiler ağır geçti; kazanç görünmedi.",
            "The side effects were hard, and no gain showed.",
          ),
        },
        flag: "treatment",
      },
      {
        id: "comfort",
        label: L("Ağrı kontrolüne odaklan", "Focus on pain control"),
        intent: L(
          "Günleri berrak geçirmek. Beden kendi hızında yorulur.",
          "Keep the days clear. The body tires at its own pace.",
        ),
        fx: { money: -2, peace: 6 },
        result: L(
          "İlaçlar ayarlandı. Geceler biraz daha uzun uykulu.",
          "The medication was adjusted. Nights are a little more restful.",
        ),
        flag: "comfort",
      },
      {
        id: "second",
        label: L("Önce ikinci bir görüş al", "Get a second opinion first"),
        intent: L(
          "Bir hafta ve biraz para harcar; bilgi getirir. Karar masada kalır.",
          "Costs a week and some money; brings information. The decision stays open.",
        ),
        fx: { money: -3, peace: -1 },
        later: [
          {
            in: 1,
            fx: { peace: 3 },
            text: L(
              "İkinci hekim aynı şeyi daha sakin anlattı.",
              "The second doctor said the same thing, more calmly.",
            ),
          },
        ],
        result: L(
          "Randevu alındı. Bekleme salonunda uzun bir sabah.",
          "An appointment was made. A long morning in a waiting room.",
        ),
        keep: true,
      },
    ],
  },
  {
    id: "job",
    phases: ["start"],
    once: true,
    core: true,
    title: L("İş", "Work"),
    text: L(
      "{Job} seni pazartesi bekliyor. Kimse neden yorgun göründüğünü sormadı.",
      "{Job} expects you on Monday. Nobody has asked why you look tired.",
    ),
    options: [
      {
        id: "full",
        label: L("Tam gün devam et", "Keep full days"),
        intent: L(
          "Birikim ve alışkanlık. Beden ve yakınlar bedel öder.",
          "Savings and habit. The body and your people pay for it.",
        ),
        fx: { mark: 3 },
        result: L(
          "Pazartesi her zamanki saatte kapıdaydın.",
          "On Monday you were at the door at the usual hour.",
        ),
        job: "full",
      },
      {
        id: "part",
        label: L("Yarı zamana geç", "Go part-time"),
        intent: L(
          "Gelirin yarısı. Günlerin yarısı sana kalır.",
          "Half the income. Half the days are yours.",
        ),
        fx: { peace: 3 },
        result: L(
          "Yeni çizelge salı ve perşembeyi sana bıraktı.",
          "The new schedule leaves Tuesdays and Thursdays to you.",
        ),
        job: "part",
      },
      {
        id: "quit",
        label: L("Bırak", "Leave"),
        intent: L(
          "Geri dönüşü yok. Zaman senin, gelir biter.",
          "No way back. The time is yours; the income stops.",
        ),
        fx: { peace: 6, mark: -2, money: 4 },
        result: L(
          "Son maaş ve bir veda kartı. Kapı arkandan yavaşça kapandı.",
          "A last payslip and a farewell card. The door closed softly behind you.",
        ),
        job: "quit",
        irreversible: true,
      },
    ],
  },
  {
    id: "list",
    phases: ["start"],
    once: true,
    title: L("Gece listesi", "The night list"),
    text: L(
      "Uyku gelmiyor. Elinde bir kalem var.",
      "Sleep will not come. There is a pen in your hand.",
    ),
    options: [
      {
        id: "musts",
        label: L("Yapılacakları yaz", "Write what must be done"),
        intent: L(
          "Günlere yön verir. Liste bazen ağırlaşır.",
          "Gives the days a direction. A list can get heavy.",
        ),
        fx: { mark: 4, peace: 1 },
        later: [
          {
            in: 4,
            fx: { mark: 3 },
            text: L("Listenin yarısı çizildi.", "Half the list is crossed out."),
          },
        ],
        result: L(
          "On bir madde. Üçünün yanına soru işareti koydun.",
          "Eleven items. You put a question mark next to three.",
        ),
      },
      {
        id: "wants",
        label: L("Gerekenleri değil, istediklerini yaz", "Write wants, not musts"),
        intent: L(
          "Yön yerine istek. Huzur getirir, iz bırakmaz.",
          "Wishes instead of direction. Brings calm, leaves no mark.",
        ),
        fx: { peace: 6 },
        result: L(
          "Liste kısa kaldı. İlk maddesi: denizi görmek.",
          "The list stayed short. First item: see the sea.",
        ),
      },
    ],
  },
  {
    id: "accounts",
    phases: ["start", "routine"],
    once: true,
    title: L("Hesaplar", "The accounts"),
    text: L(
      "Banka, kira, küçük borçlar. Kâğıtlar masada.",
      "Bank, rent, small debts. The papers are on the table.",
    ),
    options: [
      {
        id: "will",
        label: L("Vasiyet taslağı hazırlat", "Have a will drafted"),
        intent: L(
          "Para ve zaman ister. Geride düzen bırakır.",
          "Takes money and time. Leaves order behind.",
        ),
        fx: { money: -3, mark: 4, peace: 4 },
        result: L(
          "Taslak imzaya hazır. İçin biraz rahatladı.",
          "The draft is ready to sign. Something in you eased.",
        ),
        flag: "will",
      },
      {
        id: "together",
        label: L("{kin} ile birlikte düzenle", "Sort them out with {kin}"),
        intent: L(
          "Yakınlaştırır; mahremiyetin azalır.",
          "Brings you closer; less of your life stays private.",
        ),
        needs: { flag: "told" },
        fx: { kin: 6, peace: 3, mark: 1 },
        result: L(
          "İki fincan çay, üç klasör. Bir yerde ikiniz de güldünüz.",
          "Two cups of tea, three folders. At one point you both laughed.",
        ),
      },
      {
        id: "later",
        label: L("Sonra bakarsın", "Leave it for later"),
        intent: L("Bugün rahat. Yük sonraya kalır.", "Easy today. The weight is pushed forward."),
        fx: { peace: 2 },
        later: [
          {
            in: 5,
            fx: { peace: -5, kin: -3 },
            text: L(
              "Kâğıtlar yine masadaydı, bu kez başkasının önünde.",
              "The papers were on the table again, this time in front of someone else.",
            ),
          },
        ],
        result: L("Kâğıtları çekmeceye koydun.", "You put the papers in a drawer."),
      },
    ],
  },

  // ——— Routine ———
  {
    id: "rhythm",
    phases: [],
    forced: "rhythm",
    once: true,
    title: L("Günlerin biçimi", "A shape for the days"),
    text: L(
      "İki haftadır her gün başka türlü geçti. Bir saati sabitlemek istiyorsun.",
      "For two weeks every day has gone differently. You want to fix one hour in place.",
    ),
    options: [
      {
        id: "body",
        label: L("Sabah yürüyüşü, erken uyku", "Morning walks, early nights"),
        intent: L(
          "Beden daha yavaş yorulur. Başka işe daha az zaman kalır.",
          "The body tires more slowly. Less time is left for anything else.",
        ),
        routine: "body",
        result: L(
          "İlk sabah yirmi dakika. Üçüncü sabah kırk.",
          "Twenty minutes the first morning. Forty by the third.",
        ),
      },
      {
        id: "work",
        label: L("{Job} ritmini koru", "Keep {job}'s rhythm"),
        intent: L(
          "Birikim ve iz. Beden daha hızlı yorulur.",
          "Savings and a mark. The body tires faster.",
        ),
        needs: { noflag: "quit" },
        routine: "work",
        result: L("Takvim eskisi gibi doldu.", "The calendar filled up as before."),
      },
      {
        id: "table",
        label: L("Her akşam aynı saatte sofra", "Supper at the same hour every evening"),
        intent: L(
          "Yakınların yakın kalır. Para ve iz yavaş ilerler.",
          "Your people stay close. Money and mark move slowly.",
        ),
        routine: "table",
        result: L(
          "Masaya fazladan bir tabak konmaya başladı.",
          "An extra plate started appearing on the table.",
        ),
      },
      {
        id: "desk",
        label: L("Her sabah iki saat {work} için", "Two hours on {work} every morning"),
        intent: L("İz büyür. {kin} seni daha az görür.", "The mark grows. {kin} sees you less."),
        routine: "desk",
        result: L(
          "Sabah yedide masadasın. Kahve soğuyor.",
          "At seven you are at the desk. The coffee goes cold.",
        ),
      },
    ],
  },
  {
    id: "trip",
    phases: ["routine"],
    once: true,
    title: L("Kıyı", "The coast"),
    text: L(
      "{friend} yıllar önce yarım kalan bir yolculuğu hatırlatıyor: üç gün, deniz kenarı.",
      "{friend} brings up a trip you never finished years ago: three days by the sea.",
    ),
    options: [
      {
        id: "go",
        label: L("Git", "Go"),
        intent: L(
          "Anı ve yakınlık. Para ve beden bedel öder.",
          "Memory and closeness. Money and body pay for it.",
        ),
        needs: { body: 35 },
        fx: { money: -7, body: -4, friend: 9 },
        risk: {
          p: 0.75,
          win: { peace: 8 },
          lose: { body: -5, peace: 2 },
          winText: L(
            "Sabah denizi durgundu. Uzun zamandır ilk kez acele etmedin.",
            "The morning sea was still. For the first time in a long while you did not hurry.",
          ),
          loseText: L(
            "Yol yordu; yine de gittiğine sevindin.",
            "The road wore you out; you were still glad you went.",
          ),
        },
      },
      {
        id: "later",
        label: L("Ertele", "Postpone"),
        intent: L(
          "Düzen korunur. Teklif belki bir daha gelmez.",
          "The routine holds. The offer may not come again.",
        ),
        fx: { friend: -3 },
        result: L(
          "“Sonra” dedin. {friend} “olur” dedi.",
          "You said “later”. {friend} said “all right”.",
        ),
        flag: "trip-later",
      },
    ],
  },
  {
    id: "young-ask",
    phases: ["routine"],
    once: true,
    title: L("{young} soruyor", "{young} asks"),
    text: L(
      "{young} öğrenmek istiyor: nasıl yapıyorsun, neden böyle yapıyorsun?",
      "{young} wants to learn: how you do it, and why you do it that way.",
    ),
    options: [
      {
        id: "evening",
        label: L("Her hafta bir akşam ayır", "Give one evening a week"),
        intent: L(
          "Bildiğin sende kalmaz. Akşamların azalır.",
          "What you know does not stay with you. Your evenings shrink.",
        ),
        fx: { young: 8, mark: 4, body: -2 },
        later: [
          {
            in: 3,
            fx: { mark: 5, young: 3 },
            text: L("{young} öğrendiğini sensiz de yaptı.", "{young} did it without you."),
          },
        ],
        result: L(
          "İlk akşam iki saat sürdü. {young} not aldı.",
          "The first evening ran two hours. {young} took notes.",
        ),
      },
      {
        id: "notebook",
        label: L("Bir defter hazırla, ona bırak", "Fill a notebook and leave it"),
        intent: L(
          "Daha az yorar. Yüz yüze bağ kurulmaz.",
          "Less tiring. No face-to-face bond forms.",
        ),
        fx: { mark: 5, young: 2 },
        result: L(
          "Defterin ilk sayfasına bir uyarı yazdın: acele etme.",
          "On the first page you wrote a warning: do not rush.",
        ),
      },
    ],
  },
  {
    id: "quarrel",
    phases: ["routine"],
    once: true,
    title: L("Eski kırgınlık", "An old grievance"),
    text: L(
      "{friend} ile aranızda yıllardır konuşulmayan bir şey var.",
      "Something has gone unspoken between you and {friend} for years.",
    ),
    options: [
      {
        id: "call",
        label: L("Ara ve açık konuş", "Call and speak plainly"),
        intent: L("Kapı açılabilir de, kapanabilir de.", "The door may open, or it may close."),
        fx: { peace: -2 },
        risk: {
          p: 0.6,
          win: { friend: 14, peace: 7 },
          lose: { friend: -6, peace: -5 },
          flag: "reconciled",
          winText: L(
            "Telefon bir saat sürdü. Sonunda ikiniz de güldünüz.",
            "The call lasted an hour. By the end you were both laughing.",
          ),
          loseText: L(
            "Konuşma eski yerinden başladı ve orada bitti.",
            "The talk started where it always had, and ended there.",
          ),
        },
      },
      {
        id: "letter",
        label: L("Mektup yaz, cevap bekleme", "Write a letter, expect no reply"),
        intent: L(
          "Söylenmiş olur. Cevabı sana kalmaz.",
          "It is said. The reply is not yours to control.",
        ),
        fx: { friend: 5, peace: 4, mark: 1 },
        result: L(
          "Mektup postada. Rahatladığını fark ettin.",
          "The letter is in the post. You notice you feel lighter.",
        ),
      },
    ],
  },
  {
    id: "project",
    phases: ["routine"],
    once: true,
    title: L("Yarım iş", "The unfinished work"),
    text: L(
      "{Work} yarım duruyor. Bitmesi için geceler gerekir.",
      "{Work} sits half-done. Finishing it would take nights.",
    ),
    options: [
      {
        id: "nights",
        label: L("Geceleri çalış, bitir", "Work nights and finish it"),
        intent: L(
          "İz büyür. Beden ve evdekiler bedel öder.",
          "The mark grows. The body and home pay for it.",
        ),
        needs: { body: 30 },
        fx: { mark: 9, body: -6, kin: -3 },
        later: [
          {
            in: 2,
            fx: { mark: 5 },
            text: L("Son sayfa masada duruyor.", "The last page lies on the desk."),
          },
        ],
        result: L("Masa lambası gece ikiye kadar yandı.", "The desk lamp burned until two."),
      },
      {
        id: "hand",
        label: L("{young.dat} devret", "Hand it to {young}"),
        intent: L(
          "Geri dönüşü yok. İş yaşar ama artık senin değil.",
          "No way back. The work lives on, but it is no longer yours.",
        ),
        fx: { mark: 4, young: 9, peace: 3 },
        result: L("{young} dosyayı iki eliyle aldı.", "{young} took the file with both hands."),
        flag: "handed",
        irreversible: true,
      },
    ],
  },
  {
    id: "clinic",
    phases: ["routine", "break"],
    cd: 3,
    title: L("Kontrol", "Check-up"),
    text: L(
      "Kontrol günü geldi. Sonuçlar ilaç dozunu değiştirebilir.",
      "Check-up day. The results may change the dose.",
    ),
    options: [
      {
        id: "go",
        label: L("Git, sonuçları dinle", "Go and hear the results"),
        intent: L(
          "Beden toparlanır. Haber iyi de olabilir, kötü de.",
          "The body recovers a little. The news may be good or bad.",
        ),
        fx: { money: -2, body: 5 },
        risk: {
          p: 0.5,
          win: { peace: 4 },
          lose: { peace: -5 },
          winText: L("Sayılar beklenenden iyi.", "The numbers are better than expected."),
          loseText: L("Sayılar beklenen gibi.", "The numbers are what was expected."),
        },
      },
      {
        id: "skip",
        label: L("Bu seferlik atla", "Skip it this once"),
        intent: L(
          "Bir gün sana kalır. Beden sonra hatırlatır.",
          "A day stays yours. The body reminds you later.",
        ),
        fx: { peace: 2 },
        later: [
          {
            in: 2,
            fx: { body: -5 },
            text: L(
              "Atlanan kontrol kendini hissettirdi.",
              "The skipped check-up made itself felt.",
            ),
          },
        ],
        result: L(
          "Randevuyu iptal ettin. Öğleden sonra parka gittin.",
          "You cancelled. In the afternoon you went to the park.",
        ),
      },
    ],
  },
  {
    id: "kin-visit",
    phases: ["routine", "break"],
    cd: 3,
    title: L("{kin} geliyor", "{kin} is coming"),
    text: L("{kin} hafta sonu gelmek istiyor.", "{kin} wants to come at the weekend."),
    lapse: {
      fx: { kin: -2 },
      text: L("{kin} aramadı; sen de aramadın.", "{kin} did not call; neither did you."),
    },
    options: [
      {
        id: "day",
        label: L("Bütün günü {kin.dat} ayır", "Give {kin} the whole day"),
        intent: L("Bağ güçlenir. İş bekler.", "The bond grows. Work waits."),
        fx: { kin: 9, money: -1, mark: -1 },
        result: L(
          "Eski bir tarif denediniz. Tuz fazlaydı.",
          "You tried an old recipe together. Too much salt.",
        ),
      },
      {
        id: "short",
        label: L("Kısa tut; işin var", "Keep it short; there is work"),
        intent: L("İş ilerler. {kin} bunu fark eder.", "Work moves on. {kin} notices."),
        fx: { kin: -4, mark: 4 },
        result: L(
          "Bir saatlik ziyaret. Kapıda uzun bir bakış.",
          "A one-hour visit. A long look at the door.",
        ),
      },
    ],
  },
  {
    id: "night",
    phases: ["routine", "break"],
    cd: 3,
    title: L("Uykusuz gece", "A sleepless night"),
    text: L("Saat üç. Ev sessiz.", "Three in the morning. The house is quiet."),
    options: [
      {
        id: "walk",
        label: L("Yürüyüşe çık", "Go for a walk"),
        intent: L(
          "Kafa durulur. Ertesi gün biraz yorgun.",
          "The mind settles. A little tired the next day.",
        ),
        fx: { peace: 5, body: -1 },
        result: L(
          "Sokak lambaları ve bir kedi. Başka kimse yok.",
          "Street lamps and a cat. Nobody else.",
        ),
      },
      {
        id: "desk",
        label: L("Masaya otur, çalış", "Sit at the desk and work"),
        intent: L("İz büyür. Uykusuzluk birikir.", "The mark grows. The lost sleep adds up."),
        fx: { mark: 4, body: -3 },
        result: L("Sabaha karşı iki sayfa.", "Two pages by dawn."),
      },
    ],
  },
  {
    id: "album",
    phases: ["routine", "break"],
    once: true,
    title: L("Fotoğraf kutusu", "The photo box"),
    text: L(
      "Dolabın üstünde otuz yılın fotoğrafları.",
      "On top of the wardrobe, thirty years of photographs.",
    ),
    options: [
      {
        id: "together",
        label: L("{young} ile birlikte ayıkla", "Sort them with {young}"),
        intent: L("Hatıralar aktarılır. Saatler gider.", "Memories are handed on. Hours go by."),
        fx: { young: 6, mark: 4, peace: 2, body: -1 },
        result: L(
          "{young} en çok senin gençlik fotoğraflarına güldü.",
          "{young} laughed most at the photos of you young.",
        ),
      },
      {
        id: "alone",
        label: L("Yalnız bak", "Look alone"),
        intent: L(
          "Kendinle kalırsın. Kimse bir şey öğrenmez.",
          "You stay with yourself. Nobody learns anything.",
        ),
        fx: { peace: 7 },
        result: L("Bir fotoğrafı cebine koydun.", "You put one photograph in your pocket."),
      },
    ],
  },
  {
    id: "friend-need",
    phases: ["routine"],
    once: true,
    title: L("{friend} zor durumda", "{friend} is struggling"),
    text: L(
      "{friend} kendi derdini anlatmak için aradı. Senin durumunu bilmiyor olabilir.",
      "{friend} called about their own trouble. They may not know about yours.",
    ),
    options: [
      {
        id: "there",
        label: L("Yanında ol", "Be there"),
        intent: L(
          "Dostluk derinleşir. Enerjin azalır.",
          "The friendship deepens. Your energy runs down.",
        ),
        needs: { body: 25 },
        fx: { friend: 10, body: -4, money: -2 },
        result: L(
          "Bütün bir öğleden sonra hastane koridorunda, ama bu kez başkası için.",
          "A whole afternoon in a hospital corridor, for someone else this time.",
        ),
      },
      {
        id: "honest",
        label: L("Dinle, sonra kendi durumunu anlat", "Listen, then tell your own news"),
        intent: L(
          "Dürüstlük. Nasıl karşılanacağı belli değil.",
          "Honesty. How it lands is uncertain.",
        ),
        risk: {
          p: 0.5,
          win: { friend: 8, peace: 3 },
          lose: { friend: -4 },
          winText: L(
            "Kendi derdini bir kenara koydu, seninkini sordu.",
            "They set their trouble aside and asked about yours.",
          ),
          loseText: L(
            "Kendi yükü yetiyordu; konuşma kısa kaldı.",
            "Their own load was enough; the call stayed short.",
          ),
        },
      },
    ],
  },
  {
    id: "honour",
    phases: ["routine", "break"],
    once: true,
    title: L("Teşekkür", "A thank-you"),
    text: L(
      "{Job} senin için küçük bir teşekkür toplantısı düzenlemek istiyor.",
      "{Job} wants to hold a small thank-you gathering for you.",
    ),
    options: [
      {
        id: "speak",
        label: L("Kabul et, konuş", "Accept and speak"),
        intent: L(
          "İz görünür olur. Kalabalık yorar.",
          "The mark becomes visible. Crowds are tiring.",
        ),
        needs: { body: 25 },
        fx: { body: -3, mark: 6 },
        risk: {
          p: 0.7,
          win: { mark: 4 },
          lose: { peace: -4 },
          winText: L(
            "Söylediklerin birinin defterine yazıldı.",
            "Someone wrote down what you said.",
          ),
          loseText: L(
            "Söylemek istediğini söyleyemedin.",
            "You could not say what you meant to say.",
          ),
        },
      },
      {
        id: "decline",
        label: L("Kibarca geri çevir", "Politely decline"),
        intent: L("Sessizlik korunur. Bir fırsat geçer.", "The quiet holds. A chance passes."),
        fx: { peace: 4 },
        result: L(
          "Bir teşekkür notu geldi. Çekmeceye koydun.",
          "A thank-you note came. You put it in a drawer.",
        ),
      },
    ],
  },
  {
    id: "help-money",
    phases: ["routine", "break", "end"],
    once: true,
    urgent: (s) => s.money < 8 && !s.flags.includes("secret"),
    when: (s) => s.money < 8 && !s.flags.includes("secret"),
    title: L("{kin} para öneriyor", "{kin} offers money"),
    text: L("Hesabın azaldığını {kin} fark etti.", "{kin} noticed your account is running low."),
    options: [
      {
        id: "accept",
        label: L("Kabul et", "Accept"),
        intent: L("Kira ödenir. Gururun sızlar.", "The rent gets paid. Your pride stings."),
        fx: { money: 12, kin: 3, peace: -3 },
        result: L(
          "Zarfı masaya bıraktı, çayını içip gitti.",
          "They left the envelope on the table, drank their tea, and went.",
        ),
      },
      {
        id: "refuse",
        label: L("Teşekkür et, reddet", "Thank them and refuse"),
        intent: L(
          "Kendi hesabın sende kalır. {kin} biraz kırılır.",
          "Your accounts stay your own. {kin} is a little hurt.",
        ),
        fx: { peace: 2, kin: -2 },
        result: L(
          "“Lazım olursa” dedi. Bir daha açmadınız.",
          "“If you need it,” they said. Neither of you raised it again.",
        ),
      },
    ],
  },
  {
    id: "sell",
    phases: ["routine", "break"],
    once: true,
    when: (s) => s.money < 12 && !s.flags.includes("sold"),
    title: L("Alıcı", "A buyer"),
    text: L("{Asset} için bir alıcı çıktı.", "Someone wants to buy {asset}."),
    options: [
      {
        id: "sell",
        label: L("Sat", "Sell"),
        intent: L(
          "Geri dönüşü yok. Para gelir, bir parça gider.",
          "No way back. Money comes in, a piece of you goes.",
        ),
        fx: { money: 16, mark: -4, peace: -2 },
        result: L(
          "İmza bir dakika sürdü. Anahtarı verirken durakladın.",
          "The signature took a minute. You paused handing over the key.",
        ),
        flag: "sold",
        irreversible: true,
      },
      {
        id: "keep",
        label: L("Tut", "Keep it"),
        intent: L("Parça kalır. Hesap sıkışık kalır.", "The piece stays. The account stays tight."),
        fx: { peace: 1 },
        result: L("Alıcıya teşekkür ettin.", "You thanked the buyer."),
      },
    ],
  },
  {
    id: "slip",
    phases: ["routine", "break"],
    once: true,
    urgent: (s) => Boolean(s.routine) && s.routine !== "body" && s.body < 30,
    when: (s) => Boolean(s.routine) && s.routine !== "body" && s.body < 30,
    title: L("Düzen sallanıyor", "The rhythm is slipping"),
    text: L(
      "Merdivenler uzadı. Günlerin eski biçimi artık zor.",
      "The stairs got longer. The old shape of the days is hard now.",
    ),
    options: [
      {
        id: "rest",
        label: L("Dinlenmeye geç", "Shift to rest"),
        intent: L(
          "Beden yavaşlar. Eski ritim biter.",
          "The body slows its decline. The old rhythm ends.",
        ),
        fx: { peace: -2 },
        routine: "body",
        result: L(
          "Çizelgeyi sildin; yerine tek satır yazdın: yürü, uyu.",
          "You wiped the schedule and wrote one line: walk, sleep.",
        ),
      },
      {
        id: "carry",
        label: L("Olduğu gibi devam et", "Carry on as before"),
        intent: L(
          "Ritim korunur. Beden daha hızlı yorulur.",
          "The rhythm holds. The body tires faster.",
        ),
        fx: { mark: 2, body: -3 },
        result: L(
          "Bir sonraki sabah da aynı saatte kalktın.",
          "The next morning you rose at the same hour.",
        ),
      },
    ],
  },
  {
    id: "debt-call",
    phases: ["routine", "break", "end"],
    cd: 2,
    urgent: (s) => s.money < 0,
    when: (s) => s.money < 0,
    title: L("Ödeme hatırlatması", "A payment reminder"),
    text: L(
      "Bir borç bildirimi geldi. Hesap eksi gösteriyor.",
      "A debt notice arrived. The account is in the red.",
    ),
    options: [
      {
        id: "instal",
        label: L("Taksite bağla", "Arrange instalments"),
        intent: L("Bugün rahatlar. Yük sonraya kalır.", "Relief today. The load moves forward."),
        fx: { money: 8, peace: -2 },
        later: [
          {
            in: 3,
            fx: { money: -6 },
            text: L("Taksit hesaptan çekildi.", "An instalment left the account."),
          },
        ],
        result: L("Bir telefon, bir onay kodu.", "A phone call, a confirmation code."),
        flag: "debt",
      },
      {
        id: "tell",
        label: L("{kin.dat} anlat", "Tell {kin}"),
        intent: L(
          "Borç kapanır. {kin} yükün bir kısmını taşır.",
          "The debt is cleared. {kin} carries part of the load.",
        ),
        needs: { noflag: "secret" },
        fx: { money: 10, kin: -2, peace: -1 },
        result: L("{kin} hiçbir şey sormadan ödedi.", "{kin} paid without asking anything."),
      },
    ],
  },

  // ——— Breaking point (one forced card on the break day) ———
  {
    id: "break-body",
    phases: [],
    forced: "break",
    breakKind: "body",
    once: true,
    title: L("Düşüş", "The fall"),
    text: L(
      "Mutfakta ayağın kaydı. Hastanede bir gece, sonra bir karar.",
      "You slipped in the kitchen. A night in hospital, then a decision.",
    ),
    options: [
      {
        id: "stay",
        label: L("Birkaç gün hastanede kal", "Stay a few days in hospital"),
        intent: L(
          "Beden toparlanır. Para ve sabır gider.",
          "The body recovers. Money and patience go.",
        ),
        fx: { money: -6, body: 12, peace: -3, people: 3 },
        result: L(
          "Ziyaretçiler sırayla geldi. Hemşire adını öğrendi.",
          "Visitors came in turns. The nurse learned your name.",
        ),
      },
      {
        id: "home",
        label: L("Eve dön", "Go home"),
        intent: L(
          "Kendi yatağın. Beden daha kırılgan kalır.",
          "Your own bed. The body stays fragile.",
        ),
        fx: { body: 3, peace: 6, kin: -3 },
        result: L(
          "Kendi yastığın. {kin} her saat mesaj attı.",
          "Your own pillow. {kin} texted every hour.",
        ),
      },
      {
        id: "move",
        label: L("{kin.dat} yanına taşınmasını söyle", "Ask {kin} to move in"),
        intent: L(
          "Geri dönüşü yok. Yalnız kalmazsın; alanın daralır.",
          "No way back. You will not be alone; your space shrinks.",
        ),
        fx: { body: 6, kin: 8, peace: -1 },
        result: L("İki valiz ve bir saksı geldi.", "Two suitcases and a potted plant arrived."),
        flag: "kin-moved",
        irreversible: true,
      },
    ],
  },
  {
    id: "break-money",
    phases: [],
    forced: "break",
    breakKind: "money",
    once: true,
    title: L("Hesap bitti", "The account is empty"),
    text: L(
      "Kira ve ilaç aynı hafta geldi. Hesapta yetecek para yok.",
      "Rent and medicine came due the same week. There is not enough in the account.",
    ),
    options: [
      {
        id: "borrow",
        label: L("Borç al", "Borrow"),
        intent: L("Bugünü kurtarır. Borç geride kalır.", "Saves today. The debt stays behind."),
        fx: { money: 16, peace: -5 },
        result: L(
          "Kredi onaylandı. Faiz oranını okumadın.",
          "The loan was approved. You did not read the rate.",
        ),
        flag: "debt",
      },
      {
        id: "sell",
        label: L("Bir şey sat", "Sell something"),
        intent: L(
          "Geri dönüşü yok. Borç yok; bir parça gider.",
          "No way back. No debt; a piece of you goes.",
        ),
        fx: { money: 18, mark: -6 },
        result: L("{Asset} artık başkasının.", "{Asset} belongs to someone else now."),
        flag: "sold",
        irreversible: true,
      },
      {
        id: "ask",
        label: L("Yardım iste", "Ask for help"),
        intent: L(
          "Yakınların devreye girer. Gurur bedel öder.",
          "Your people step in. Pride pays.",
        ),
        fx: { money: 11, kin: 4, friend: 3, peace: -4 },
        result: L(
          "İki telefon yetti. Kimse neden diye sormadı.",
          "Two calls were enough. Nobody asked why.",
        ),
      },
    ],
  },
  {
    id: "break-people",
    phases: [],
    forced: "break",
    breakKind: "people",
    target: "lowest",
    once: true,
    title: L("Kapı kapandı", "A door closed"),
    text: L(
      "{target} aramalarına dönmüyor. Aradaki mesafe bir kopuşa dönüştü.",
      "{target} is not returning your calls. The distance has become a break.",
    ),
    options: [
      {
        id: "door",
        label: L("Kapısına git", "Go to their door"),
        intent: L("Yüz yüze. Beden ve gurur bedel öder.", "Face to face. Body and pride pay."),
        needs: { body: 20 },
        fx: { body: -4, peace: -2, target: 14 },
        result: L(
          "Kapı açıldı. İlk cümleyi {target} kurdu.",
          "The door opened. {target} spoke first.",
        ),
      },
      {
        id: "through",
        label: L("Ortak bir tanıdıkla haber gönder", "Send word through someone you both know"),
        intent: L("Daha yumuşak. Sonuç belirsiz.", "Gentler. The outcome is uncertain."),
        risk: {
          p: 0.6,
          win: { target: 9 },
          lose: { target: 2, peace: -2 },
          winText: L(
            "Bir gün sonra kısa bir mesaj geldi: “Geliyorum.”",
            "A day later a short message came: “I'm coming.”",
          ),
          loseText: L("Haber ulaştı; cevap gelmedi.", "The word arrived; no answer came."),
        },
      },
      {
        id: "let",
        label: L("Bırak, olsun", "Let it be"),
        intent: L(
          "Geri dönüşü yok. Huzur gelir; o kapı kapalı kalır.",
          "No way back. Calm comes; that door stays shut.",
        ),
        fx: { peace: 6, target: -6 },
        result: L("Telefonu ters çevirdin.", "You turned the phone face down."),
        flag: "let-go",
        irreversible: true,
      },
    ],
  },
  {
    id: "break-meaning",
    phases: [],
    forced: "break",
    breakKind: "meaning",
    target: "highest",
    once: true,
    title: L("Boşluk", "The hollow"),
    text: L(
      "Bir sabah hiçbir şeyin anlamı yokmuş gibi uyandın. Takvimde {left} gün var.",
      "One morning you woke as if nothing meant anything. The calendar shows {left} days.",
    ),
    options: [
      {
        id: "finish",
        label: L("Bir şeyi bitir", "Finish one thing"),
        intent: L("Somut bir iz. Beden bedel öder.", "A concrete mark. The body pays."),
        needs: { body: 20 },
        fx: { mark: 10, body: -5 },
        result: L(
          "Akşam bir şey bitti. Küçük, ama bitti.",
          "By evening something was finished. Small, but finished.",
        ),
      },
      {
        id: "drop",
        label: L("Bir şeyi bırak", "Let one thing go"),
        intent: L(
          "Yük hafifler. Bir parça yarım kalır.",
          "The load lightens. One piece stays unfinished.",
        ),
        fx: { peace: 10, mark: -3 },
        result: L(
          "Bir dosyayı kapattın ve rafa kaldırdın.",
          "You closed a file and put it on the shelf.",
        ),
      },
      {
        id: "tell",
        label: L("{target.dat} anlat", "Tell {target}"),
        intent: L(
          "Yakınlık. Kimseye yük olmama isteğin sarsılır.",
          "Closeness. Your wish not to burden anyone is shaken.",
        ),
        fx: { target: 6, peace: 5 },
        result: L(
          "{target} dinledi, çözüm önermedi. İyi geldi.",
          "{target} listened and offered no solutions. It helped.",
        ),
      },
    ],
  },

  // ——— After the break ———
  {
    id: "late-trip",
    phases: ["break"],
    once: true,
    when: (s) => s.flags.includes("trip-later"),
    title: L("İkinci çağrı", "A second call"),
    text: L(
      "{friend} yolculuğu yeniden soruyor. Bu kez daha kısa, daha yakın.",
      "{friend} asks about the trip again. Shorter this time, and closer.",
    ),
    options: [
      {
        id: "go",
        label: L("Bu kez git", "Go this time"),
        intent: L(
          "Yarım kalan tamamlanır. Beden zorlanır.",
          "What was left unfinished gets done. The body strains.",
        ),
        needs: { body: 25 },
        fx: { money: -5, body: -5, friend: 10, peace: 6 },
        result: L("İki gün, bir iskele, çok çay.", "Two days, a pier, a lot of tea."),
      },
      {
        id: "no",
        label: L("“Olmayacak” de", "Say it will not happen"),
        intent: L("Geri dönüşü yok. Dürüst; biraz acı.", "No way back. Honest; a little painful."),
        fx: { friend: -5, peace: 2 },
        result: L("{friend} anladığını söyledi.", "{friend} said they understood."),
        flag: "trip-lost",
        irreversible: true,
      },
    ],
  },
  {
    id: "letters",
    phases: ["break", "end"],
    once: true,
    title: L("Mektuplar", "Letters"),
    text: L(
      "Açılmaları için bir tarih yazacaksın, senden sonraki bir tarih.",
      "You will write a date for them to be opened, a date after you.",
    ),
    options: [
      {
        id: "each",
        label: L("Her birine ayrı bir mektup", "A separate letter to each"),
        intent: L(
          "Her bağ bir iz bırakır. Günlerin gider.",
          "Every bond leaves a mark. Your days go into it.",
        ),
        needs: { body: 15 },
        fx: { people: 4, mark: 5, body: -3 },
        result: L(
          "Üç zarf, üç tarih. En uzunu {young} için.",
          "Three envelopes, three dates. The longest is for {young}.",
        ),
        flag: "letters",
      },
      {
        id: "one",
        label: L("Tek bir mektup, herkese", "One letter to everyone"),
        intent: L("Daha hafif. Daha az kişisel.", "Lighter. Less personal."),
        fx: { mark: 4, peace: 3, people: 1 },
        result: L(
          "Bir sayfa. Sonunu üç kez değiştirdin.",
          "One page. You changed the ending three times.",
        ),
      },
    ],
  },
  {
    id: "craft-ogretmen",
    phases: ["break"],
    once: true,
    scen: ["ogretmen"],
    title: L("Son ders", "The last lesson"),
    text: L(
      "Okul, dönem sonu için seni bir derse çağırıyor.",
      "The school invites you back for an end-of-term lesson.",
    ),
    options: [
      {
        id: "teach",
        label: L("Dersi ver", "Teach it"),
        intent: L(
          "İz büyür. Bir sabahın bütün gücü gider.",
          "The mark grows. A whole morning's strength goes into it.",
        ),
        needs: { body: 25 },
        fx: { mark: 11, body: -6, young: 3 },
        result: L(
          "Son sırada biri ağladı. Zil çaldığında kimse kalkmadı.",
          "Someone in the back row cried. When the bell rang nobody stood up.",
        ),
      },
      {
        id: "notes",
        label: L("Notlarını gönder", "Send your notes"),
        intent: L("Daha az yorar. Sınıf seni görmez.", "Less tiring. The class does not see you."),
        fx: { mark: 5, peace: 2 },
        result: L("Notlar fotokopiyle çoğaltıldı.", "Your notes were photocopied for everyone."),
      },
    ],
  },
  {
    id: "craft-usta",
    phases: ["break"],
    once: true,
    scen: ["usta"],
    title: L("Dükkânın anahtarı", "The shop key"),
    text: L("{young} dükkânı sürdürmeyi teklif ediyor.", "{young} offers to keep the shop going."),
    options: [
      {
        id: "give",
        label: L("Anahtarı {young.dat} ver", "Give {young} the key"),
        intent: L(
          "Geri dönüşü yok. Tezgâh yaşar; kira riski onda.",
          "No way back. The bench lives on; the rent risk is theirs.",
        ),
        fx: { mark: 10, young: 10, money: -3, peace: 3 },
        result: L(
          "Vitrine yeni bir isim yazılmadı. {young} eskisini bıraktı.",
          "No new name went on the window. {young} kept the old one.",
        ),
        flag: "handed",
        irreversible: true,
      },
      {
        id: "close",
        label: L("Dükkânı kapat, malzemeyi sat", "Close the shop, sell the stock"),
        intent: L(
          "Geri dönüşü yok. Para gelir; tezgâh susar.",
          "No way back. Money comes in; the bench falls silent.",
        ),
        fx: { money: 10, mark: -4, peace: 2 },
        result: L("Kepenk son kez indi.", "The shutter came down for the last time."),
        flag: "sold",
        irreversible: true,
      },
    ],
  },
  {
    id: "craft-cevirmen",
    phases: ["break"],
    once: true,
    scen: ["cevirmen"],
    title: L("Teslim tarihi", "The deadline"),
    text: L(
      "Yayınevi çeviriyi bitmiş hâliyle istiyor; teslim tarihi yakın.",
      "The publisher wants the finished translation; the deadline is close.",
    ),
    options: [
      {
        id: "finish",
        label: L("Son bölümü bitir, teslim et", "Finish the last chapter and deliver"),
        intent: L(
          "Büyük bir iz olabilir. Beden ağır bedel öder.",
          "Could leave a large mark. The body pays heavily.",
        ),
        needs: { body: 30 },
        fx: { body: -7 },
        risk: {
          p: 0.6,
          win: { mark: 14, money: 6 },
          lose: { mark: 6 },
          winText: L(
            "Kitap baskıya girdi. Adın iç kapakta.",
            "The book went to print. Your name is on the title page.",
          ),
          loseText: L(
            "Teslim edildi; son düzeltmeler başkasına kaldı.",
            "It was delivered; the final edits fell to someone else.",
          ),
        },
      },
      {
        id: "partial",
        label: L("Notlarıyla birlikte yarım teslim et", "Deliver it unfinished, with notes"),
        intent: L(
          "Beden korunur. İş başkasıyla tamamlanır.",
          "The body is spared. Someone else completes the work.",
        ),
        fx: { mark: 5, peace: 4, young: 3 },
        result: L("Kenar notlarını {young} temize çekti.", "{young} typed up your margin notes."),
      },
    ],
  },
  {
    id: "trial",
    phases: ["break"],
    once: true,
    when: (s) => s.flags.includes("treatment") || s.body < 40,
    title: L("Deneysel tedavi", "An experimental treatment"),
    text: L(
      "Bir klinik araştırmada yer açıldı. Hiçbir garantisi yok.",
      "A place opened in a clinical study. There is no guarantee.",
    ),
    options: [
      {
        id: "join",
        label: L("Katıl", "Join"),
        intent: L(
          "Geri dönüşü yok. Beden kazanabilir de kaybedebilir de.",
          "No way back. The body may gain or lose.",
        ),
        fx: { money: -4, peace: -3 },
        risk: {
          p: 0.4,
          win: { body: 16 },
          lose: { body: -8 },
          winText: L("Değerler ilk kez yükseldi.", "For the first time the numbers went up."),
          loseText: L(
            "Beden kaldırmadı; çalışmadan çekildin.",
            "The body could not take it; you left the study.",
          ),
        },
        flag: "trial",
        irreversible: true,
      },
      {
        id: "no",
        label: L("Hayır de", "Say no"),
        intent: L(
          "Kalan günleri deney masasında geçirmezsin.",
          "You will not spend the days left on a study bench.",
        ),
        fx: { peace: 5 },
        result: L("Formu imzalamadan geri verdin.", "You handed the form back unsigned."),
      },
    ],
  },
  {
    id: "care-fight",
    phases: ["break", "end"],
    once: true,
    when: (s) => s.flags.includes("kin-moved") || s.people.kin > 62,
    title: L("Kimin kararı?", "Whose decision?"),
    text: L(
      "{kin} bakımın için senin yerine karar vermeye başladı.",
      "{kin} has started deciding about your care for you.",
    ),
    options: [
      {
        id: "yield",
        label: L("Kararı {kin.dat} bırak", "Leave it to {kin}"),
        intent: L(
          "{kin} kendini işe yarar hisseder. Sen biraz kaybolursun.",
          "{kin} feels useful. You fade a little.",
        ),
        fx: { kin: 6, peace: -3 },
        result: L("Takvim artık onun elinde.", "The calendar is in their hands now."),
      },
      {
        id: "hold",
        label: L("Kendi kararını koru", "Keep the decision yours"),
        intent: L(
          "Kendin kalırsın. Aranız gerilir.",
          "You stay yourself. Things get tense between you.",
        ),
        fx: { peace: 5, kin: -6 },
        result: L(
          "Sesini yükseltmeden söyledin. Yine de kapı sert kapandı.",
          "You said it without raising your voice. The door still shut hard.",
        ),
      },
    ],
  },

  // ——— Last days ———
  {
    id: "gathering",
    phases: ["end"],
    once: true,
    title: L("Sofra", "The table"),
    text: L(
      "Herkesi aynı akşam aynı masada görmek istiyorsun.",
      "You want everyone at the same table on the same evening.",
    ),
    options: [
      {
        id: "all",
        label: L("Hepsini çağır", "Invite them all"),
        intent: L(
          "Bağlar bir arada güçlenir. Gecenin sonunda tükenirsin.",
          "The bonds grow together. You are spent by the end of the night.",
        ),
        needs: { body: 15 },
        fx: { money: -4, body: -5, people: 7, peace: 3 },
        result: L(
          "{friend} eski bir hikâye anlattı. {kin} ilk kez duydu.",
          "{friend} told an old story. {kin} had never heard it.",
        ),
      },
      {
        id: "one",
        label: L("Birer birer gör", "See them one by one"),
        intent: L(
          "Daha az yorar. Herkes seni ayrı hatırlar.",
          "Less tiring. Each remembers you separately.",
        ),
        fx: { people: 4, body: -3 },
        result: L("Üç ayrı öğleden sonra, üç ayrı çay.", "Three afternoons, three pots of tea."),
      },
    ],
  },
  {
    id: "last-page",
    phases: ["end"],
    once: true,
    title: L("Son sayfa", "The last page"),
    text: L(
      "{Work} için bir sayfa daha yazabilirsin; belki son sayfa.",
      "You could write one more page of {work}; perhaps the last.",
    ),
    options: [
      {
        id: "write",
        label: L("Yaz", "Write it"),
        intent: L("İz tamamlanır. Beden bedel öder.", "The mark is completed. The body pays."),
        needs: { body: 12 },
        fx: { mark: 8, body: -4 },
        result: L("Sayfanın altına tarih attın.", "You dated the bottom of the page."),
      },
      {
        id: "note",
        label: L("Bir not bırak: burada kaldı", "Leave a note: it stopped here"),
        intent: L(
          "Yarım kalan kabul edilir. İç rahatlar.",
          "The unfinished is accepted. Something settles.",
        ),
        fx: { mark: 3, peace: 5 },
        result: L("Notu ataçla tutturdun.", "You paper-clipped the note in place."),
      },
    ],
  },
  {
    id: "window",
    phases: ["end"],
    cd: 2,
    target: "highest",
    title: L("Pencere", "The window"),
    text: L("Öğleden sonra ışığı odaya giriyor.", "The afternoon light comes into the room."),
    options: [
      {
        id: "watch",
        label: L("Sadece bak", "Just watch"),
        intent: L(
          "Sükûnet. Bir öğleden sonra yalnız geçer.",
          "Stillness. An afternoon spent alone.",
        ),
        fx: { peace: 8 },
        result: L("Işık duvardan halıya indi.", "The light slid from the wall to the rug."),
      },
      {
        id: "call",
        label: L("{target.acc} çağır, birlikte bakın", "Call {target} and watch together"),
        intent: L("Paylaşılan bir sessizlik.", "A shared silence."),
        fx: { peace: 4, target: 5 },
        result: L("İkiniz de konuşmadınız.", "Neither of you spoke."),
      },
    ],
  },
  {
    id: "forgive",
    phases: ["end"],
    once: true,
    target: "lowest",
    when: (s) => Math.min(s.people.kin, s.people.friend, s.people.young) < 45,
    title: L("Af", "Forgiveness"),
    text: L(
      "{target} ile aranızda hâlâ bir düğüm var.",
      "There is still a knot between you and {target}.",
    ),
    options: [
      {
        id: "sorry",
        label: L("Özür dile", "Apologise"),
        intent: L(
          "Düğüm çözülebilir. Kabul edilmeyebilir.",
          "The knot may loosen. It may not be accepted.",
        ),
        risk: {
          p: 0.65,
          win: { target: 14, peace: 6 },
          lose: { target: 4, peace: -2 },
          winText: L(
            "Kabul etti. Başka bir şey söylemesi gerekmedi.",
            "They accepted. Nothing else needed saying.",
          ),
          loseText: L(
            "Dinledi; affetmeye hazır değildi.",
            "They listened; they were not ready to forgive.",
          ),
        },
      },
      {
        id: "leave",
        label: L("Olduğu gibi bırak", "Leave it as it is"),
        intent: L("Kendi barışın. Düğüm kalır.", "Your own peace. The knot stays."),
        fx: { peace: 3 },
        result: L("Bazı düğümler de hikâyenin parçası.", "Some knots are part of the story too."),
      },
    ],
  },
  {
    id: "farewell",
    phases: ["end"],
    once: true,
    title: L("Veda", "Goodbye"),
    text: L(
      "Nasıl hatırlanmak istediğini söylemenin zamanı.",
      "Time to say how you want to be remembered.",
    ),
    options: [
      {
        id: "open",
        label: L("Açık bir veda", "An open goodbye"),
        intent: L(
          "Herkes ne diyeceğini bilir. Söylemek yorar.",
          "Everyone knows what to say. Saying it is tiring.",
        ),
        fx: { people: 5, peace: -2, body: -2 },
        result: L("Tek tek sarıldınız.", "You held each of them in turn."),
      },
      {
        id: "quiet",
        label: L("Sessiz bir veda", "A quiet goodbye"),
        intent: L(
          "Kendi içinde bir kapanış. Onlar sonradan anlar.",
          "A closing inside you. They understand later.",
        ),
        fx: { peace: 7, people: -2 },
        result: L(
          "Kimseye bir şey demeden kapıyı araladın.",
          "Without a word to anyone, you left the door ajar.",
        ),
      },
    ],
  },
];

export const ENDINGS = {
  door: {
    title: L("Açık kapı", "An open door"),
    text: L(
      "Son günlerde ev hiç boş kalmadı. {kin}, {friend} ve {young} seni kendi hikâyelerinde taşıyacak.",
      "In the last days the house was never empty. {kin}, {friend} and {young} will carry you in their own stories.",
    ),
  },
  mark: {
    title: L("Kalan iz", "What remains"),
    text: L(
      "{Work} tamamlandı ya da emin ellerde. Adın bir işin içinde yaşayacak.",
      "{Work} is finished or in safe hands. Your name will live inside a piece of work.",
    ),
  },
  still: {
    title: L("Sükûnet", "Stillness"),
    text: L(
      "Korkunun yerini yavaş bir sükûnet aldı. Günlerin çoğunu kendin olarak yaşadın.",
      "A slow stillness took the place of fear. You lived most of your days as yourself.",
    ),
  },
  unfinished: {
    title: L("Yarım cümle", "An unfinished sentence"),
    text: L(
      "Her şeye biraz yetiştin, hiçbirine tam. Çoğu hayat böyle biter; bu da bir sondur.",
      "You reached a little of everything and all of nothing. Most lives end this way; this too is an ending.",
    ),
  },
};

export const EPILOGUE = {
  debt: L("Geride bir borç kaldı; {kin} ödüyor.", "A debt was left behind; {kin} is paying it."),
  secret: L(
    "Bazıları haberi senden değil, başkalarından aldı.",
    "Some heard the news from others, not from you.",
  ),
  reconciled: L("{friend} ile barıştınız.", "You and {friend} made peace."),
  letters: L(
    "Mektuplar yazdığın tarihte açılacak.",
    "The letters will be opened on the dates you wrote.",
  ),
  handed: L("{young} işini sürdürüyor.", "{young} carries your work on."),
  sold: L(
    "Bir parça satıldı; yokluğu hatırlanıyor.",
    "Something was sold; its absence is remembered.",
  ),
  "let-go": L("Bir kapı kapalı kaldı.", "One door stayed shut."),
  trial: L("Deneysel tedaviyi denedin.", "You tried the experimental treatment."),
  "kin-moved": L("{kin} son haftalarda yanındaydı.", "{kin} was with you in the final weeks."),
  will: L(
    "Vasiyetin düzenliydi; kimse kâğıt aramak zorunda kalmadı.",
    "Your will was in order; nobody had to search for papers.",
  ),
};
