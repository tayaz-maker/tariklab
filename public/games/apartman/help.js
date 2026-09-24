/** Beginner guide for Kapı Nöbeti. */
export const HELP_SECTIONS = [
  {
    h: ["Amaç", "The goal"],
    p: [
      [
        "Yunus Apartmanı'nın yöneticisisin. Kasaya, binaya ve sakinlere sen bakarsın. Amacın binayı ayakta, kasayı dengede ve sakinleri idare edilebilir tutmak.",
        "You are the manager of Yunus Apartmanı. The budget, the building and the residents are yours to look after. Keep the building standing, the budget balanced and the residents manageable.",
      ],
      [
        "Resmî bir bitiş yok. İstediğin kadar hafta yönetebilirsin; oyun seni bir sayıya değil, binayı ne kadar süre iyi idare ettiğine bakar.",
        "There is no formal ending. You can manage as many weeks as you like; the game is about how long you keep things working, not a final score.",
      ],
    ],
  },
  {
    h: ["Ekranda ne görüyorum?", "What you see on screen"],
    list: [
      [
        "Üst panel: kasa, aidat ve binanın durumu. Haftalık kararlarının sonucunu buradan görürsün.",
        "Top panel: cash, dues and building condition — the result of your weekly decisions.",
      ],
      [
        "Mesele listesi: o hafta ilgilenebileceğin konular. Birini seçersin.",
        "Issue list: what you can deal with this week. You pick one.",
      ],
      [
        "Duyuru/zil defteri: sakinlerin memnuniyeti ve geçmiş kararları nasıl hatırladıkları.",
        "The ledger: resident satisfaction and how they remember past decisions.",
      ],
    ],
  },
  {
    h: ["Bir hafta nasıl işler?", "How a week works"],
    list: [
      ["Listeden bir mesele seç.", "Choose one issue from the list."],
      [
        "En fazla iki dosya hazırla. Dosya, toplantıda elini güçlendirir.",
        "Prepare at most two files. Files strengthen your hand at the meeting.",
      ],
      [
        "Toplantı Gecesi'nde maliyet ve risk dengesi taşıyan bir teklifi oylat.",
        "At Meeting Night, put one proposal — with its cost and risk — to a vote.",
      ],
      [
        "HAFTAYI KAPAT dediğinde zaman ilerler: aidat tahsilatı, bina eskimesi ve ucuz yamaların gecikmiş sonuçları o anda işlenir.",
        "Closing the week advances time: dues collection, wear and the delayed consequences of cheap patches are all processed then.",
      ],
    ],
  },
  {
    h: ["Sakinler nasıl oy verir?", "How residents vote"],
    p: [
      [
        "Sakinler kendi memnuniyetine, apartmandaki etkisine ve geçmiş kararları hatırlayan hafızasına göre oy kullanır. Ucuz çözümler bugünü kurtarır ama defterde kalır.",
        "Each resident votes by their own satisfaction, their influence in the building, and a memory of what you decided before. A cheap fix saves today but stays in the ledger.",
      ],
    ],
  },
  {
    h: ["Sık yapılan hatalar", "Common mistakes"],
    list: [
      [
        "Hafta kapatmadan sonuç beklemek: zaman yalnız HAFTAYI KAPAT ile ilerler.",
        "Waiting for results without closing the week — time only moves when you close it.",
      ],
      [
        "Sürekli en ucuz teklifi geçirmek; bina eskimesi birikince fatura büyür.",
        "Always passing the cheapest proposal; wear accumulates and the bill grows.",
      ],
      [
        "Dosya hazırlamadan toplantıya girmek.",
        "Going into the meeting without preparing any files.",
      ],
    ],
  },
  {
    h: ["Kayıt", "Saving"],
    p: [
      [
        "Her hamlen aktif kayıt slotuna otomatik işlenir. Üç yerel slot birbirinden bağımsızdır; dolu bir slotun üzerine yazmak onay ister.",
        "Every move is written to the active save slot automatically. The three local slots are independent; overwriting an occupied one asks for confirmation.",
      ],
    ],
  },
];
