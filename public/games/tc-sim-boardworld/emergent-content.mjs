/** Finite causal families, not generated dialogue or a random reward deck. */
export const SYSTEMIC_FAMILIES = [
  {
    id: "employment",
    title: "İşin yeni dengesi",
    cooldown: 28,
    window: 4,
    variants: { pressure: "İş yükü birikiyor", opportunity: "Ekipte yeni sorumluluk" },
  },
  {
    id: "housing",
    title: "Kiranın geleceği",
    cooldown: 40,
    window: 7,
    variants: { arrears: "Geciken kira için görüşme", renewal: "Yeni dönem bütçesi" },
  },
  {
    id: "neighborhood",
    title: "Mahallenin yönü",
    cooldown: 28,
    window: 5,
    variants: { works: "Sokağın düzeni değişiyor", network: "Mahalle masasında yer var" },
  },
  {
    id: "transport",
    title: "Yolun fırsat maliyeti",
    cooldown: 28,
    window: 4,
    variants: { disruption: "Ulaşımda daralan zaman", commute: "Düzenli yolculuk planı" },
  },
  {
    id: "education",
    title: "Öğrenmenin sonraki adımı",
    cooldown: 35,
    window: 5,
    variants: { application: "Beceriyi gerçek işe dönüştür", plateau: "Tekrarın sınırına geldin" },
  },
  {
    id: "friendship",
    title: "Karşılıklı emek",
    cooldown: 28,
    window: 5,
    variants: { distance: "Görüşmeyeli zaman oldu", support: "Arkadaşın da zaman istiyor" },
  },
  {
    id: "romance",
    title: "Birlikte ayrılan zaman",
    cooldown: 35,
    window: 5,
    variants: { neglect: "İlişkinin takvimdeki yeri", balance: "Beklentileri konuşma zamanı" },
  },
  {
    id: "household",
    title: "Evin görünmeyen işleri",
    cooldown: 28,
    window: 5,
    variants: { shared: "Ortak evin sorumluluğu", upkeep: "Küçük bakım, sonraki ayın rahatlığı" },
  },
  {
    id: "health",
    title: "Sürdürülebilir tempo",
    cooldown: 21,
    window: 3,
    variants: { fatigue: "Bedenin yavaşlamanı istiyor", balance: "Yoğun haftanın bedeli" },
  },
  {
    id: "debt",
    title: "Borç ile hareket alanı",
    cooldown: 45,
    window: 7,
    variants: { burden: "Faiz bütçeyi sıkıştırıyor", buffer: "Ödeme mi, güvenlik payı mı?" },
  },
  {
    id: "enterprise",
    title: "Müşteriye verilen söz",
    cooldown: 21,
    window: 4,
    variants: {
      shortage: "Talep var, hazırlık eksik",
      quality: "Tekrarlayan müşterinin beklentisi",
    },
  },
  {
    id: "institutions",
    title: "Belgenin açtığı kapı",
    cooldown: 60,
    window: 7,
    variants: {
      qualification: "Belgeli beceriyi doğrulat",
      community: "Mahalle emeğini kayıt altına al",
    },
  },
];

export const POLICY_FIELDS = [
  {
    id: "meal",
    title: "Öğün",
    choices: [
      ["home", "Evde pişir", "Ev, erzak ve bütçe uygunsa pişir; uygun değilse açıklayıp dur."],
      [
        "frugal",
        "Tutumlu öğün",
        "Önce uygun ücretsiz öğün; sonra evde pişirme veya eldeki sandviç.",
      ],
      ["eat", "Lokanta", "Açık lokantanın gerçek bedeli bütçe tabanını koruyorsa ye."],
    ],
  },
  {
    id: "commute",
    title: "Ulaşım",
    choices: [
      ["transit", "Toplu taşıma", "Gerçek sefer, nakit, süre ve randevu koşulları geçerli."],
      ["free", "Ücretsiz güzergâh", "Daha uzun süre ve enerji harcar; yeterli pencere yoksa dur."],
    ],
  },
  {
    id: "practice",
    title: "Planlı çalışma",
    choices: [
      ["none", "Kendim seçerim", "Rutin beceri çalışması yapmaz."],
      [
        "communication",
        "İletişim",
        "Gerçek beceri çalışması; günlük ve haftalık verim sınırları geçerli.",
      ],
      [
        "technical",
        "Teknoloji",
        "Gerçek beceri çalışması; belge gereksinimi ve verim sınırları geçerli.",
      ],
      ["craft", "Zanaat", "Gerçek beceri çalışması; zaman ve enerji harcanır."],
      ["knowledge", "Bilgi", "Gerçek beceri çalışması; verimsiz tekrar otomatik seçilmez."],
    ],
  },
  {
    id: "practiceQuota",
    title: "Günlük çalışma sayısı",
    choices: [
      [
        "1",
        "En çok bir oturum",
        "Daha çok serbest zaman; öğrenme diğer gerçek yollarla da ilerler.",
      ],
      [
        "2",
        "En çok iki oturum",
        "İkinci tekrarda daha düşük getiri; ihtiyaçlar ve taahhütler öncelikli.",
      ],
    ],
  },
  {
    id: "bedtime",
    title: "Uyku saati",
    choices: [
      ["1200", "20.00", "Akşamı erken kapat; sabah 08.00’e kadar uyku."],
      ["1320", "22.00", "Akşam için zaman ayır; ihtiyaçlar bozulursa daha önce dinlen."],
      ["1380", "23.00", "Daha uzun akşam; enerji ve sağlık kısıtları devam eder."],
    ],
  },
  {
    id: "businessService",
    title: "Mevcut işletmede hizmet",
    choices: [
      ["false", "Hizmeti ben seçerim", "Rutin işletme vardiyası yapmaz."],
      [
        "true",
        "Hazırsa hizmet ver",
        "Yalnız mevcut müşteri, stok ve işletme kasasıyla; yatırım yapmaz.",
      ],
    ],
  },
  {
    id: "householdChores",
    title: "Ev sorumluluğu",
    choices: [
      ["false", "Kendim takip ederim", "Ev yükümlülükleri için rutin durup hatırlatır."],
      [
        "true",
        "Planlı görevi yap",
        "Yalnız mevcut ev sözleşmesinin açıkça atanan görevi uygulanır.",
      ],
    ],
  },
  {
    id: "autoWithdraw",
    title: "Nakit tamamlama",
    choices: [
      ["false", "Bankayı ben yönetirim", "Nakit yetmezse rutin durur."],
      [
        "true",
        "Kendi bankamdan çek",
        "Gerekince gerçek 1.000 TL çekim; para yaratılmaz, bütçe tabanı korunur.",
      ],
    ],
  },
];
