/** Living City systems use authored game values, never live prices or transit claims. */
export const PROJECT_TYPES = [
  {
    id: "qualification",
    name: "Bir uzmanlık kazan",
    description:
      "Bir beceri alanı seç; eğitim, sertifika ve uzmanlık hedefini aynı planda takip et.",
    budget: 5000,
    days: 45,
    milestones: [
      "Eğitim veya bireysel hazırlık başlat",
      "İlgili sertifikayı al",
      "Seçtiğin beceriyi 60’a çıkar",
    ],
    consequences: [
      "Gerçek ders ve çalışma eylemleri ilerletir.",
      "Tamamlanınca mesleki itibar +5; nakit ödül yok.",
    ],
  },
  {
    id: "relocation",
    name: "Yeni bir yaşam alanı",
    description: "Bir semti ve evi hedefle; bütçeyi, keşfi ve gerçek kira sözleşmesini tamamla.",
    budget: 25000,
    days: 60,
    milestones: [
      "Hedef semti yerinde keşfet",
      "İlk kira, depozito ve taşıma bütçesini hazırla",
      "Hedef eve gerçekten taşın",
    ],
    consequences: [
      "Mevcut taşınma, depozito ve kira kuralları geçerlidir.",
      "Tamamlanınca yeni semtteki çevreyle bağ kurarsın.",
    ],
  },
  {
    id: "enterprise",
    name: "Sürdürülebilir küçük işletme",
    description: "Bir işletme türü seç; müşteri edinimi kadar nakit akışını da takip et.",
    budget: 15000,
    days: 90,
    milestones: [
      "Hedef mikro işletmeyi kur",
      "En az üç müşteri ve ilk hizmeti tamamla",
      "Borçsuz işletmeyle giderlerin üzerinde 2.000 TL kazan",
    ],
    consequences: [
      "Gerçek stok, sermaye, müşteri ve gider kararları ilerletir.",
      "Tamamlanınca işletme itibarı +8; gelir garanti değildir.",
    ],
  },
  {
    id: "relationship",
    name: "Bir bağı onar ve güçlendir",
    description: "Bir kişiyi seç; sadece hediyeyle değil, konuşma ve tutulan sözle güven kur.",
    budget: 2000,
    days: 30,
    milestones: [
      "Seçtiğin kişiyle yüz yüze görüş",
      "Bir sözünü veya randevunu yerine getir",
      "Güven 55 ve yakınlık 45’e ulaş",
    ],
    consequences: [
      "Gerçek görüşmeler, sözler ve randevular sayılır.",
      "Tamamlanınca karşılıklı saygı +5; geçmiş kırgınlıklar silinmez.",
    ],
  },
];
export const HOUSEHOLD_ASSETS = [
  {
    id: "desk",
    name: "Çalışma köşesi",
    cost: 1200,
    description: "Evde bireysel çalışmada +1 beceri; bakımlı olmalı.",
  },
  {
    id: "bed",
    name: "Dinlendirici yatak",
    cost: 900,
    description: "Evde uykudan +5 enerji; bakımlı olmalı.",
  },
  {
    id: "kitchen",
    name: "Düzenli mutfak",
    cost: 700,
    description: "Evde yemek 15 dk daha kısa, +5 tokluk; bakımlı olmalı.",
  },
];
export const NPC_UTILITIES = [
  { id: "rest", name: "Dinlenme", minutes: 60 },
  { id: "budget", name: "Bütçe düzenleme", minutes: 30 },
  { id: "study", name: "Mesleki çalışma", minutes: 90 },
  { id: "social", name: "Bir tanıdığıyla görüşme", minutes: 60 },
  { id: "job-search", name: "İş arama", minutes: 120 },
  { id: "career", name: "İş görüşmesi", minutes: 90 },
  { id: "move", name: "Yeni konut düzeni", minutes: 120 },
  { id: "favor", name: "Yakın çevreye destek", minutes: 30 },
  { id: "repay", name: "Verilen sözü yerine getirme", minutes: 30 },
];
export const MARKET_CYCLE = [88, 76, 62, 46, 68, 94, 82, 58];
