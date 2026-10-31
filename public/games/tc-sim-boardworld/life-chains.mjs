import { JOBS, HOMES } from "./content.mjs";

// Authored state machines. Only the engine executes their actions and time costs.
const day = (s) => Math.floor(s.time / 1440) + 1;
const cap = (n) => Math.max(0, Math.min(100, n));
const value = (v, s, story) => (typeof v === "function" ? v(s, story) : v);
const seen = (s, id) => s.resolvedEvents.includes(id);
const opt = (id, label, description, minutes, cost, effect, extra = {}) => ({
  id,
  label,
  description,
  minutes,
  cost,
  effect,
  ...extra,
});
const phase = (title, body, delay, choices, onArrive) => ({
  title,
  body,
  delay,
  choices,
  onArrive,
});
const route =
  (name, effect = () => {}) =>
  (s, api, story) => {
    story.route = name;
    effect(s, api, story);
  };
function bond(s, api, id, trust, affinity, text) {
  s.npcs[id].trust = cap(s.npcs[id].trust + trust);
  s.npcs[id].affinity = cap(s.npcs[id].affinity + affinity);
  api.memory(s, id, text);
  if (api.reveal) api.reveal(s, id, "story-contact", text);
}
const contract = (s, prefix) => s.documents.filter((d) => d.id.startsWith(prefix)).at(-1)?.id || "";
const context = (s) => ({
  home: s.housing.id,
  job: s.job?.id || "",
  district: s.location,
  lease: contract(s, "lease-"),
  employment: contract(s, "employment-"),
});
const ownHome = (s, story) =>
  s.housing.id === story.context.home && contract(s, "lease-") === story.context.lease;
const ownJob = (s, story) =>
  s.job?.id === story.context.job && contract(s, "employment-") === story.context.employment;
const inDistrict = (id) => (s) => (s.location === id ? "" : "Önce ilgili semte ulaşmalısın.");
const skillGate = (id, n) => (s) =>
  s.player.skills[id] >= n ? "" : "En az " + n + " beceri gerekir.";

export const STORY_CHAINS = [
  {
    id: "shared-roof",
    title: "Aynı çatının altında",
    npcId: "leyla",
    district: "kadikoy",
    summary: "Küçük bir ev sorunu, komşuluk ve kalıcı konfor kararına dönüşür.",
    unlock: (s) => day(s) >= 4 && (seen(s, "repair-home") || s.housing.id !== "shelter"),
    steps: [
      phase(
        "Masrafı paylaşmak",
        "Leyla binanın ortak bakımını konuşmak için aradı. Bugünkü sözün, gelecek haftaki yaşam koşullarını etkileyecek.",
        0,
        [
          opt(
            "share",
            "Bakım payını üstlen",
            "360 TL; Leyla güven +6. Dört gün sonra işi kontrol etmen gerekir.",
            30,
            360,
            route("shared", (s, a) => bond(s, a, "leyla", 6, 2, "Ortak bakıma katkı verdin.")),
          ),
          opt(
            "repair",
            "Emeğini teklif et",
            "Zanaat 20; 120 dk, enerji −8. Nakit harcamadan sürece katıl.",
            120,
            0,
            route("self", (s, a) => {
              a.change(s, { energy: -8 });
              a.skill(s, "craft", 2);
            }),
            { requires: skillGate("craft", 20) },
          ),
          opt(
            "report",
            "Sorumluluğu ev sahibine bırak",
            "Para ve zamanını koru. Kontrol için yeniden haberleşebilirsiniz.",
            15,
            0,
            route("reported"),
          ),
        ],
      ),
      phase(
        "İşin takibi",
        "Bakım günü geldi. Katkının sonucu için zaman ayırmak veya işi ertelemek arasında seçim yap.",
        4,
        [
          opt(
            "inspect",
            "Kontrol ve teslim",
            "60 dk; Leyla güven +5. Aynı evde kalırsan bir hafta sonra konfor +4.",
            60,
            0,
            route("fixed", (s, a) => bond(s, a, "leyla", 5, 3, "Bakımı birlikte kontrol ettik.")),
          ),
          opt(
            "postpone",
            "Şimdilik ertele",
            "Bugünkü zamanını koru; konfor kazanılmaz. Leyla güven −3.",
            0,
            0,
            route("deferred", (s, a) => bond(s, a, "leyla", -3, 0, "Bakım takibini erteledin.")),
          ),
        ],
      ),
      phase(
        "Evde kalan iz",
        "Bakımın etkisi artık belli. Taşındıysan eski evin konforunu yanında götüremezsin; kurduğun ilişki ise kalır.",
        7,
        [
          opt(
            "record",
            "Teslim tutanağını sakla",
            "Kalıcı bakım belgesi; bilgi +1.",
            15,
            0,
            (s, a, st) => {
              a.skill(s, "knowledge", 1);
              a.document(
                s,
                "story-roof",
                "Ortak bakım tutanağı",
                st.route === "fixed"
                  ? "Bakım kontrol edildi. Konfor yalnız bakım yapılan evde uygulandı."
                  : "Bakım ertelendi; ek ödeme yükümlülüğü alınmadı.",
              );
            },
          ),
          opt("thank", "Leyla ile açık konuş", "30 dk; yakınlık +5, stres −3.", 30, 0, (s, a) => {
            bond(s, a, "leyla", 0, 5, "Bakımın sonucunu açıkça konuştuk.");
            a.change(s, { stress: -3 });
          }),
        ],
        (s, a, st) => {
          if (st.route === "fixed" && ownHome(s, st)) {
            s.flags.homeComfort = Math.min(20, (s.flags.homeComfort || 0) + 4);
            a.change(s, { stress: -3 });
          }
        },
      ),
    ],
  },
  {
    id: "portfolio-bridge",
    title: "Bir portfolyonun yolculuğu",
    npcId: "selin",
    district: "sisli",
    summary: "Eğitim, teslim tarihi ve müşteri geri bildirimi aynı projede buluşur.",
    unlock: (s) => day(s) >= 6 && (seen(s, "portfolio") || s.player.skills.technical >= 20),
    steps: [
      phase(
        "Küçük pilot",
        "Selin bir ücretli pilot için kapı açıyor. Çalışır bir teslim, yalnızca iyi niyetten fazlasını gerektirir.",
        0,
        [
          opt(
            "pilot",
            "Pilotun giderini karşıla",
            "100 TL, 60 dk; dört gün sonra teslim kararı. Tamamlarsan 7 gün sonra 1.200 TL ücret.",
            60,
            100,
            route("pilot"),
            { requires: (s) => (s.inventory.laptop ? "" : "Dizüstü bilgisayar gerekir.") },
          ),
          opt(
            "learn",
            "Önce örnek proje çalış",
            "90 dk; teknoloji +4. Ücretli söz vermeden portfolyo yolunu aç.",
            90,
            0,
            route("training", (s, a) => a.skill(s, "technical", 4)),
          ),
        ],
      ),
      phase(
        "Teslim masası",
        "Hazır olmadığın ürünü bitmiş gibi sunmak yerine teslim etmek, yardım almak veya çekilmek mümkün.",
        4,
        [
          opt(
            "deliver",
            "Çalışır projeyi teslim et",
            "Teknoloji 30 ve dizüstü; 180 dk, enerji −12. Ücret yalnız pilot sözleşmesi için doğar.",
            180,
            0,
            (s, a, st) => {
              st.route = st.route === "pilot" ? "delivered-paid" : "delivered-study";
              a.change(s, { energy: -12, stress: 5 });
              bond(s, a, "selin", 8, 3, "Projeyi çalışır biçimde teslim ettin.");
            },
            {
              requires: (s) =>
                s.player.skills.technical < 30
                  ? "Teknoloji 30 gerekir."
                  : !s.inventory.laptop
                    ? "Dizüstü bilgisayar gerekir."
                    : "",
            },
          ),
          opt(
            "mentor",
            "Eksikleri mentorla tamamla",
            "120 dk; teknoloji +4, Selin güven +3. Ücretli teslim yerine öğrenme kaydı oluşur.",
            120,
            0,
            route("mentored", (s, a) => {
              a.skill(s, "technical", 4);
              bond(s, a, "selin", 3, 2, "Eksikleri dürüstçe konuşup birlikte çalıştık.");
            }),
          ),
          opt(
            "withdraw",
            "Sözleşmeden açıkça çekil",
            "Ücret yok; harcanan gider geri dönmez. Selin güven −2, ek ceza yok.",
            15,
            0,
            route("withdrawn", (s, a) =>
              bond(s, a, "selin", -2, 0, "Tamamlayamayacağın işi erken bildirdin."),
            ),
          ),
        ],
      ),
      phase(
        "Referansın değeri",
        "Teslimden bir hafta sonra geri bildirim geldi. Kazanılmış ücret varsa bankaya işlendi; aynı teslim yeniden ücret üretmez.",
        7,
        [
          opt(
            "publish",
            "Portfolyona ekle",
            "30 dk; kalıcı portfolyo ve teknoloji +2. Çekilmiş projeyi yayımlayamazsın.",
            30,
            0,
            (s, a) => {
              s.flags.portfolio = true;
              a.skill(s, "technical", 2);
              a.document(
                s,
                "story-portfolio",
                "Proje referansı",
                "Gerçek çalışma ve geri bildirimle tamamlanan portfolyo örneği.",
              );
            },
            {
              requires: (_s, st) =>
                st.route === "withdrawn" ? "Teslim edilmeyen proje yayımlanamaz." : "",
            },
          ),
          opt(
            "reflect",
            "Öğrendiklerini not et",
            "30 dk; bilgi +2. Referans yerine kişisel gelişim.",
            30,
            0,
            (s, a) => a.skill(s, "knowledge", 2),
          ),
        ],
        (s, a, st) => {
          if (st.route === "delivered-paid")
            a.receive(s, 1200, "Pilot proje · 7 gün sonra teslim ücreti", "bank");
        },
      ),
    ],
  },
  {
    id: "community-table",
    title: "Bir sofradan mahalleye",
    npcId: "aylin",
    district: "kadikoy",
    summary: "Dayanışma, zaman ayırdığında gerçek bir sosyal güven ağına dönüşür.",
    unlock: (s) => day(s) >= 8 && (seen(s, "market") || s.npcs.aylin.affinity >= 15),
    steps: [
      phase(
        "Birlikte hazırlık",
        "Aylin mahalle mutfağı için katkı istiyor. Emek ve nakit seçeneklerinin farklı fırsat maliyetleri var.",
        0,
        [
          opt(
            "time",
            "Hazırlık vardiyasına katıl",
            "Kadıköy; 120 dk, enerji −8; Aylin güven +6.",
            120,
            0,
            route("volunteer", (s, a) => {
              a.change(s, { energy: -8 });
              bond(s, a, "aylin", 6, 5, "Mutfak hazırlığında birlikte çalıştık.");
            }),
            { requires: inDistrict("kadikoy") },
          ),
          opt(
            "fund",
            "Malzemeye katkı yap",
            "300 TL; Aylin güven +3. Sonraki organizasyona davet edilirsin.",
            15,
            300,
            route("funded", (s, a) =>
              bond(s, a, "aylin", 3, 3, "Mutfak için malzeme katkısı yaptın."),
            ),
          ),
          opt(
            "decline",
            "Bu hafta yük alma",
            "Kaynaklarını koru; sorumluluk üstlenme.",
            0,
            0,
            route("declined"),
          ),
        ],
      ),
      phase(
        "Dağıtım günü",
        "İlk katkıdan üç gün sonra planın asıl emek gerektiren bölümü geldi. Katılmamak yeni bir borç yaratmaz.",
        3,
        [
          opt(
            "organize",
            "Dağıtımı organize et",
            "90 dk; iletişim +3, Aylin güven +5. Bir hafta sonra karşılıklı destek oluşur.",
            90,
            0,
            route("organized", (s, a) => {
              a.skill(s, "communication", 3);
              bond(s, a, "aylin", 5, 4, "Dağıtım sorumluluğunu tamamladın.");
            }),
          ),
          opt(
            "stepback",
            "Başkasına devret",
            "15 dk; açık iletişim sayesinde ek çatışma çıkmaz; destek paketi kazanılmaz.",
            15,
            0,
            route("delegated"),
          ),
        ],
      ),
      phase(
        "Karşılıklı destek",
        "Mahalle ilişkisi tek yönlü yardım değildir. Tamamlanan organizasyon için üç erzak teslim edildi; stok kapasitesi korunur.",
        7,
        [
          opt(
            "network",
            "Cem ile tanıştırıl",
            "45 dk; Cem yakınlık +8, Aylin yakınlık +3.",
            45,
            0,
            (s, a) => {
              bond(s, a, "cem", 2, 8, "Aylin bizi mahalle sofrasında tanıştırdı.");
              bond(s, a, "aylin", 0, 3, "Mahalle çevresiyle bağlantıyı sürdürdün.");
            },
          ),
          opt(
            "rest",
            "Bu hafta sınır koy",
            "Stres −5; yeni bir gönüllülük sözü verme.",
            15,
            0,
            (s, a) => a.change(s, { stress: -5 }),
          ),
        ],
        (s, _a, st) => {
          if (st.route === "organized")
            s.inventory.groceries = Math.min(999, (s.inventory.groceries || 0) + 3);
        },
      ),
    ],
  },
  {
    id: "learning-circle",
    title: "Öğrenciden yol arkadaşına",
    npcId: "naz",
    district: "besiktas",
    summary: "Ders, uygulama ve referans; sertifika için gerçek eğitim yine gerekir.",
    unlock: (s) => day(s) >= 10 && (s.course || s.flags.coursesCompleted || seen(s, "mentor")),
    steps: [
      phase(
        "Çalışma grubu",
        "Naz derslerden öğrendiklerini küçük bir gruba anlatmanı öneriyor. Katılım sertifika yerine geçmez.",
        0,
        [
          opt(
            "prepare",
            "Bir ders hazırla",
            "90 dk; bilgi +3, enerji −5. Beş gün sonra uygulama.",
            90,
            0,
            route("prepared", (s, a) => {
              a.skill(s, "knowledge", 3);
              a.change(s, { energy: -5 });
            }),
          ),
          opt(
            "observe",
            "Önce dinleyici ol",
            "45 dk; bilgi +1. Daha az zaman, daha sınırlı referans.",
            45,
            0,
            route("observer", (s, a) => a.skill(s, "knowledge", 1)),
          ),
        ],
      ),
      phase(
        "Uygulama saati",
        "Grup toplandı. Uygulama yapmak için temel bilgi gerekir; yeterli değilsen yardım alabilirsin.",
        5,
        [
          opt(
            "teach",
            "Küçük grubu yönet",
            "Bilgi 30; 120 dk, stres +6; Naz güven +8.",
            120,
            0,
            route("taught", (s, a) => {
              a.change(s, { stress: 6 });
              a.skill(s, "communication", 3);
              bond(s, a, "naz", 8, 4, "Hazırladığın konuyu gruba anlattın.");
            }),
            { requires: skillGate("knowledge", 30) },
          ),
          opt(
            "assist",
            "Eğitmene yardımcı ol",
            "60 dk; bilgi +2, Naz güven +3; eğitmenlik referansı kazanılmaz.",
            60,
            0,
            route("assisted", (s, a) => {
              a.skill(s, "knowledge", 2);
              bond(s, a, "naz", 3, 2, "Grup çalışmasına destek verdin.");
            }),
          ),
        ],
      ),
      phase(
        "Yeni eğitim kapısı",
        "Bir hafta sonra Naz çalışmanı değerlendiriyor. Katılım, kurs ücretinde destek sağlar; diploma veya sertifika kendiliğinden verilmez.",
        7,
        [
          opt(
            "reference",
            "Referansı kabul et",
            "Kalıcı kurs indirimi; uygulama yaptıysan iletişim +2 ve uygulama belgesi.",
            15,
            0,
            (s, a, st) => {
              s.flags.courseDiscount = true;
              if (st.route === "taught") {
                a.skill(s, "communication", 2);
                a.document(
                  s,
                  "story-learning",
                  "Çalışma grubu referansı",
                  "Naz ile uygulama yapıldı. Resmî meslek sertifikası değildir.",
                );
              }
            },
          ),
          opt(
            "continue",
            "Kendi çalışma ritmini seç",
            "60 dk; bilgi +3, stres −3. Yeni yükümlülük alınmaz.",
            60,
            0,
            (s, a) => {
              a.skill(s, "knowledge", 3);
              a.change(s, { stress: -3 });
            },
          ),
        ],
      ),
    ],
  },
  {
    id: "debt-crossroads",
    title: "Borçtan çıkış rotası",
    npcId: "baran",
    district: "sisli",
    summary: "Bütçe, gerçek geri ödeme ve sonraki ayın yükünü birlikte değerlendir.",
    unlock: (s) => day(s) >= 5 && (s.debt >= 1000 || s.housing.arrears >= 1000),
    steps: [
      phase(
        "Rakamlarla yüzleşmek",
        "Baran borçlarını otomatik olarak öğrenmez. Paylaşmayı seçersen birlikte bir plan hazırlarsınız.",
        0,
        [
          opt(
            "disclose",
            "Bütçeni Baran’la paylaş",
            "45 dk; bilgi +2, Baran güven +4. Borç gizliliğini kendi kararınla açarsın.",
            45,
            0,
            route("shared", (s, a) => {
              a.skill(s, "knowledge", 2);
              bond(s, a, "baran", 4, 2, "Bütçeni ve borç yükünü benimle paylaştın.");
              if (a.reveal) a.reveal(s, "baran", "debt", s.debt);
            }),
          ),
          opt(
            "private",
            "Kendi bütçeni çıkar",
            "60 dk; bilgi +2. Baran borcunun miktarını öğrenmez.",
            60,
            0,
            route("private", (s, a) => a.skill(s, "knowledge", 2)),
          ),
        ],
      ),
      phase(
        "İlk somut ödeme",
        "Üç gün geçti. Para aktarımı anaparayı gerçekten azaltır; yoktan borç silinmez. Acil ihtiyaçlar için bakiyeni de gözet.",
        3,
        [
          opt(
            "repay",
            "En çok 1.500 TL anapara öde",
            "Ödenen tutar kadar borç azalır. İşlem, nakit ve banka toplamından karşılanır.",
            15,
            (s) => Math.min(1500, s.debt),
            (s, a, st) => {
              const amount = Math.min(1500, s.debt);
              s.debt -= amount;
              a.record(s, "Borç rotası · anapara", -amount, "debt");
              st.route = "paid";
            },
            { requires: (s) => (s.debt > 0 ? "" : "Ödenecek banka borcu yok.") },
          ),
          opt(
            "buffer",
            "Önce temel ihtiyaçlarını koru",
            "30 dk; stres −3, sonraki aşama 14 gün sonra. Mevcut faiz takvimi devam eder.",
            30,
            0,
            route("buffer", (s, a) => a.change(s, { stress: -3 })),
          ),
        ],
      ),
      phase(
        "İki hafta sonra",
        "İlk kararın üzerinden iki hafta geçti. Ödenen anapara daha düşük faiz yükü yarattı; beklemek de kendi maliyetini taşıdı.",
        14,
        [
          opt(
            "review",
            "Planı düzenli hale getir",
            "45 dk; kalıcı borç planı kaydı ve bilgi +2. Cüzdandaki gerçek taksit seçeneklerini kullan.",
            45,
            0,
            (s, a) => {
              s.flags.debtPlan = true;
              a.skill(s, "knowledge", 2);
              a.document(
                s,
                "story-debt",
                "Borç bütçesi",
                "İki haftalık gözlem tamamlandı. Taksitler yalnız karşılanan bakiye kadar ödenir; faiz otomatik silinmez.",
              );
            },
          ),
          opt(
            "income",
            "Yeni gelir becerisine yatırım yap",
            "120 dk; zanaat +3, enerji −8. Serbest iş koşullarına yaklaş.",
            120,
            0,
            (s, a) => {
              a.skill(s, "craft", 3);
              a.change(s, { energy: -8 });
            },
          ),
        ],
      ),
    ],
  },
  {
    id: "workplace-voice",
    title: "İş yerinde söz hakkı",
    npcId: "okan",
    district: "kadikoy",
    summary: "İş arkadaşları, sınırlar ve performans; ilişkinin kariyerle kesiştiği yer.",
    unlock: (s) => day(s) >= 12 && s.job && (s.job.shifts >= 5 || seen(s, "team-conflict")),
    steps: [
      phase(
        "Sorumluluk paylaşımı",
        "Okan iş deneyimini dinlemek için aradı. İş yerindeki gerilimi anlatmak veya sınırlarını kendi başına belirlemek mümkün.",
        0,
        [
          opt(
            "discuss",
            "Sorunu açıkça konuş",
            "45 dk; Okan güven +5, stres −4. Hangi işte olduğunu kendi isteğinle paylaşırsın.",
            45,
            0,
            route("discussed", (s, a) => {
              bond(s, a, "okan", 5, 2, "İş yerindeki sorumlulukları benimle konuştun.");
              a.change(s, { stress: -4 });
              if (a.reveal) a.reveal(s, "okan", "job", s.job?.id || "unemployed");
            }),
          ),
          opt(
            "solo",
            "Sınırlarını yazılı belirle",
            "60 dk; bilgi +2. Kişisel planın başkalarına bildirilmez.",
            60,
            0,
            route("solo", (s, a) => a.skill(s, "knowledge", 2)),
          ),
        ],
      ),
      phase(
        "Yoğun haftanın kararı",
        "Beş gün sonra yoğunluk artıyor. Ek emek ayırmak, dinlenme ve sosyal yaşamdan zaman alır.",
        5,
        [
          opt(
            "coordinate",
            "Ekip planına emek ver",
            "90 dk, enerji −10, stres +4. Aynı işteysen performans +8; bir hafta sonra +5 daha.",
            90,
            0,
            route("coordinated", (s, a, st) => {
              a.change(s, { energy: -10, stress: 4 });
              if (ownJob(s, st)) s.job.performance = cap(s.job.performance + 8);
            }),
            {
              requires: (s, st) =>
                ownJob(s, st) ? "" : "Bu işten ayrıldın; eski ekibe iş sözü veremezsin.",
            },
          ),
          opt(
            "boundary",
            "Yeni yük alma",
            "30 dk; stres −7. Performans primi yerine sağlığını koru.",
            30,
            0,
            route("bounded", (s, a) => a.change(s, { stress: -7 })),
          ),
        ],
      ),
      phase(
        "Sözün karşılığı",
        "Yoğun haftanın ardından iş birliğinin etkisi görünür. İş değiştirdiysen eski işin performansı yeni işine taşınmaz.",
        7,
        [
          opt(
            "record",
            "Deneyimini kariyer planına yaz",
            "30 dk; kalıcı kariyer planı ve iletişim +2.",
            30,
            0,
            (s, a) => {
              s.flags.careerPlan = true;
              a.skill(s, "communication", 2);
            },
          ),
          opt(
            "social",
            "İş dışında bağ kur",
            "60 dk; Okan yakınlık +6, stres −4. İş ilişkisini arkadaşlığa aç.",
            60,
            0,
            (s, a) => {
              bond(s, a, "okan", 1, 6, "İş dışında da sohbet etmeye zaman ayırdın.");
              a.change(s, { stress: -4 });
            },
          ),
        ],
        (s, _a, st) => {
          if (st.route === "coordinated" && ownJob(s, st))
            s.job.performance = cap(s.job.performance + 5);
        },
      ),
    ],
  },
  {
    id: "health-rhythm",
    title: "Ritmini yeniden bul",
    npcId: "derya",
    district: "sisli",
    summary: "Bugünkü aşırı yüklenme ile gelecek haftanın sağlığı arasında bağ kur.",
    unlock: (s) =>
      day(s) >= 15 &&
      (s.player.stress >= 35 || s.player.health < 75 || seen(s, "burnout") || seen(s, "illness")),
    steps: [
      phase(
        "İlk işaretler",
        "Derya’yı arayıp yorgunluğunu anlatabilirsin. Konuşmazsan sağlık durumunu kendiliğinden öğrenmez.",
        0,
        [
          opt(
            "care",
            "Durumunu paylaş ve mola ver",
            "90 dk; stres −10, enerji +8; Derya güven +4.",
            90,
            0,
            route("cared", (s, a) => {
              a.change(s, { stress: -10, energy: 8 });
              bond(s, a, "derya", 4, 3, "Yorgunluğunu anlattın ve dinlenme planladık.");
              if (a.reveal) a.reveal(s, "derya", "health", s.player.health);
            }),
          ),
          opt(
            "push",
            "Bu hafta dinlenmeyi ertele",
            "Zaman harcamaz; üç gün sonra sağlık −6, stres +5. Sonra toparlanma yolu açık.",
            0,
            0,
            route("pushed"),
          ),
        ],
      ),
      phase(
        "Üç günün etkisi",
        "İlk kararın bedensel etkisi işlendi. Toparlanma, ücretsiz fakat zaman isteyen destekle de mümkün.",
        3,
        [
          opt(
            "clinic",
            "Kontrollü bakım al",
            "200 TL, 60 dk; sağlık +12, stres −5.",
            60,
            200,
            route("treated", (s, a) => a.change(s, { health: 12, stress: -5 })),
          ),
          opt(
            "rest",
            "Ücretsiz destek ve dinlenme",
            "180 dk; sağlık +7, enerji +15, stres −8. Bir yarım gününü ayır.",
            180,
            0,
            route("rested", (s, a) => a.change(s, { health: 7, energy: 15, stress: -8 })),
          ),
        ],
        (s, a, st) => {
          if (st.route === "pushed") a.change(s, { health: -6, stress: 5 });
          else a.change(s, { health: 3 });
        },
      ),
      phase(
        "Sürdürülebilir hafta",
        "Bir hafta sonra, tek seferlik bakımı bir yaşam kararına dönüştür. Rutin ekranında çalışma ve dinlenme tercihlerini kendin belirle.",
        7,
        [
          opt(
            "plan",
            "Dinlenme sınırlarını kaydet",
            "45 dk; stres −6 ve kişisel bakım belgesi.",
            45,
            0,
            (s, a) => {
              a.change(s, { stress: -6 });
              a.document(
                s,
                "story-health",
                "Kişisel bakım planı",
                "Dinlenme için zaman ayır. Otomasyon düşük enerji ve kritik sağlıkta durur.",
              );
            },
          ),
          opt(
            "walk",
            "Derya ile sakin yürüyüş",
            "60 dk; sağlık +3, Derya yakınlık +6.",
            60,
            0,
            (s, a) => {
              a.change(s, { health: 3 });
              bond(s, a, "derya", 1, 6, "Birlikte sakin bir yürüyüş yaptık.");
            },
          ),
        ],
      ),
    ],
  },
  {
    id: "new-neighborhood",
    title: "Adres değişir, çevre değişir",
    npcId: "arda",
    district: "sisli",
    summary: "Ulaşım maliyeti, ev ve iş erişimi üzerinden bir mahalle kararı ver.",
    unlock: (s) => day(s) >= 18 && (s.flags.travels >= 3 || seen(s, "commute")),
    steps: [
      phase(
        "Adres hesabı",
        "Arda semtleri karşılaştırmak için bir çalışma öneriyor. Taşınmanın gerçek kira ve depozitosu Yaşam ekranında ayrıca ödenir.",
        0,
        [
          opt(
            "compare",
            "Ev ve işe erişimi karşılaştır",
            "60 dk; bilgi +2, Arda güven +3. Dört gün sonra gözlemlerini değerlendir.",
            60,
            0,
            route("compared", (s, a) => {
              a.skill(s, "knowledge", 2);
              bond(s, a, "arda", 3, 2, "Semt ve ulaşım hesabını birlikte yaptık.");
            }),
          ),
          opt(
            "stay",
            "Mevcut çevreni öncelikle tanı",
            "45 dk; iletişim +2. Ucuz kira kadar mevcut bağlar da değerli.",
            45,
            0,
            route("staying", (s, a) => a.skill(s, "communication", 2)),
          ),
        ],
      ),
      phase(
        "Kararın sahadaki karşılığı",
        "Dört gündür düşündüğün adres kararını gözden geçir. Bu kart bedelsiz taşımaz; gerçek taşınma sözleşmesini Yaşam bölümünden yaparsın.",
        4,
        [
          opt(
            "moved",
            "Yeni adresteki çevreye katıl",
            "Gerçekten taşınmış olmalısın; 90 dk, bulunduğun konut semtindeki bağlantıya yakınlık +8.",
            90,
            0,
            route("moved", (s, a) => {
              const h = HOMES.find((x) => x.id === s.housing.id);
              const id =
                h.district === "sisli" ? "baran" : h.district === "besiktas" ? "ece" : "aylin";
              bond(s, a, id, 3, 8, "Yeni komşun olarak kendini tanıttın.");
            }),
            {
              requires: (s, st) =>
                ownHome(s, st) ? "Önce Yaşam ekranında gerçek taşınmayı tamamla." : "",
            },
          ),
          opt(
            "local",
            "Mevcut mahallende kök sal",
            "90 dk; iletişim +2, Arda yakınlık +5. Yeni kira riski alma.",
            90,
            0,
            route("rooted", (s, a) => {
              a.skill(s, "communication", 2);
              bond(s, a, "arda", 0, 5, "Mevcut çevrende kök salma kararını anlattın.");
            }),
          ),
        ],
      ),
      phase(
        "Bir haftalık gözlem",
        "Adres kararı bir hafta boyunca kira, erişim ve çevrene yansıdı. Sonuç, ayrıca kaydedilen gerçek yaşam işlemleriyle oluştu.",
        7,
        [
          opt(
            "review",
            "Ulaşım günlüğünü tamamla",
            "30 dk; bilgi +2 ve semt değerlendirme belgesi.",
            30,
            0,
            (s, a, st) => {
              a.skill(s, "knowledge", 2);
              a.document(
                s,
                "story-neighborhood",
                "Semt değerlendirmesi",
                st.route === "moved"
                  ? "Gerçek kira sözleşmesiyle taşınıldı ve yeni çevreye katılım sağlandı."
                  : "Mevcut konut ve çevre korunarak fırsat maliyeti değerlendirildi.",
              );
            },
          ),
          opt(
            "connect",
            "Çevreyle bağını pekiştir",
            "60 dk; Arda güven +5, stres −4.",
            60,
            0,
            (s, a) => {
              bond(s, a, "arda", 5, 2, "Semt kararının sonuçlarını yeniden konuştuk.");
              a.change(s, { stress: -4 });
            },
          ),
        ],
      ),
    ],
  },
  {
    id: "relationship-space",
    title: "Yakınlığın sınırları",
    npcId: "ece",
    district: "besiktas",
    summary: "Arkadaşlık, romantik niyet ve iş bağlantısını birbirine karıştırmadan konuş.",
    unlock: (s) =>
      day(s) >= 20 && (s.npcs.ece.affinity >= 25 || s.npcs.ece.romance >= 10 || seen(s, "romance")),
    steps: [
      phase(
        "Ne bekliyoruz?",
        "Ece ilişkinize zaman ayırmak istiyor. Yakınlık, romantik ilişkiyi otomatik olarak kurmaz.",
        0,
        [
          opt(
            "friend",
            "Arkadaşlığın beklentilerini konuş",
            "60 dk; güven +5, yakınlık +5. Romantik vaat verme.",
            60,
            0,
            route("friend", (s, a) =>
              bond(s, a, "ece", 5, 5, "Arkadaşlığımızın beklentilerini konuştuk."),
            ),
          ),
          opt(
            "romantic",
            "Romantik niyetini açıkla",
            "Yakınlık 35 ve güven 30; 60 dk, romantizm +5. Partnerlik yine karşılıklı hazır oluş gerektirir.",
            60,
            0,
            route("romantic", (s, a) => {
              s.npcs.ece.romance = cap(s.npcs.ece.romance + 5);
              bond(s, a, "ece", 3, 3, "Romantik niyetini baskı kurmadan açıkladın.");
            }),
            {
              requires: (s) =>
                s.npcs.ece.affinity >= 35 && s.npcs.ece.trust >= 30
                  ? ""
                  : "Yakınlık 35 ve güven 30 gerekir.",
            },
          ),
          opt(
            "professional",
            "Mesleki sınırını koru",
            "15 dk; iş bağlantısını koru, sosyal yükümlülük alma.",
            15,
            0,
            route("professional"),
          ),
        ],
      ),
      phase(
        "Sözün yanında zaman",
        "Dört gün sonra ilişkinin yalnız sözle ilerlemediğini görüyorsun. Buluşmak için Beşiktaş’a gerçekten gelmelisin.",
        4,
        [
          opt(
            "meet",
            "Yüz yüze zaman ayır",
            "Beşiktaş; 90 dk, 80 TL; güven +6, yakınlık +6.",
            90,
            80,
            (s, a, st) => {
              st.route = st.route === "romantic" ? "romantic-kept" : "friend-kept";
              bond(s, a, "ece", 6, 6, "Ayırdığın zamanı birlikte geçirdik.");
            },
            { requires: inDistrict("besiktas") },
          ),
          opt(
            "explain",
            "Yoğunluğunu açıkça bildir",
            "15 dk; güven −1. Belirsizce kaybolmadan sınır koy.",
            15,
            0,
            route("explained", (s, a) =>
              bond(s, a, "ece", -1, 0, "Bu hafta zaman ayıramayacağını erken bildirdin."),
            ),
          ),
        ],
      ),
      phase(
        "İlişkinin yönü",
        "Bir hafta sonra beklentilerin tekrar konuşulması, güveni ilişki türüne uygun biçimde büyütür.",
        7,
        [
          opt(
            "respect",
            "Karşılıklı sınırları kabul et",
            "30 dk; güven +4, stres −3. Partnerlik kararı Telefon bölümünde kalır.",
            30,
            0,
            (s, a) => {
              bond(s, a, "ece", 4, 2, "Birbirimizin sınırlarını kabul ettik.");
              a.change(s, { stress: -3 });
            },
          ),
          opt(
            "slow",
            "İlişkiyi yavaşlat",
            "15 dk; romantizm −5, stres −5. Arkadaşlık değerleri silinmez.",
            15,
            0,
            (s, a) => {
              s.npcs.ece.romance = cap(s.npcs.ece.romance - 5);
              a.change(s, { stress: -5 });
              a.memory(s, "ece", "İlişkiyi yavaşlatmak istediğini açıkça söyledin.");
            },
          ),
        ],
      ),
    ],
  },
  {
    id: "first-customer",
    title: "İlk müşteriden itibara",
    npcId: "emre",
    district: "besiktas",
    summary: "Gider, emek, teslim ve tahsilat birbirinden ayrılan küçük bir proje.",
    unlock: (s) =>
      day(s) >= 25 &&
      (Math.max(s.player.skills.craft, s.player.skills.technical) >= 25 ||
        seen(s, "craft-project")),
    steps: [
      phase(
        "Bir müşteri tanışması",
        "Emre küçük bir üretim işi öneriyor. Malzeme gideri kesindir; ücret ancak gerçek teslimden bir hafta sonra gelir.",
        0,
        [
          opt(
            "accept",
            "Malzemeyi al, işi üstlen",
            "150 TL, 30 dk. Üç gün sonra teslim; tamamlanırsa 650 TL tahsilat.",
            30,
            150,
            route("accepted"),
          ),
          opt(
            "practice",
            "Ücretsiz örnek üzerinde çalış",
            "120 dk; zanaat +3. Müşteri geliri yerine öğrenme.",
            120,
            0,
            route("practice", (s, a) => a.skill(s, "craft", 3)),
          ),
        ],
      ),
      phase(
        "Üretim ve kontrol",
        "İyi niyet ücret doğurmaz. Teslim için yeterli beceri ve zaman gerekir; çekilmenin malzeme gideri geri alınmaz.",
        3,
        [
          opt(
            "deliver",
            "Ürünü kontrol edip teslim et",
            "Zanaat veya teknoloji 30; 180 dk, enerji −12. Ücret yalnız üstlenilen müşteri işi için.",
            180,
            0,
            (s, a, st) => {
              st.route = st.route === "accepted" ? "delivered" : "sample";
              a.change(s, { energy: -12, stress: 5 });
              bond(s, a, "emre", 6, 4, "İşi kontrol ederek teslim ettin.");
            },
            {
              requires: (s) =>
                Math.max(s.player.skills.craft, s.player.skills.technical) >= 30
                  ? ""
                  : "Zanaat veya teknoloji 30 gerekir.",
            },
          ),
          opt(
            "cancel",
            "Kaybı kabul edip erken haber ver",
            "15 dk; malzeme masrafı batık maliyettir, yeni borç doğmaz; Emre güven −2.",
            15,
            0,
            route("cancelled", (s, a) =>
              bond(s, a, "emre", -2, 0, "Teslim edemeyeceğini erken bildirdin."),
            ),
          ),
        ],
      ),
      phase(
        "Tahsilat ve sonrası",
        "Teslimden yedi gün sonra kazanılmış müşteri ücreti bankaya işlendi. Başlangıç gideri, emek ve net kazanç farklı kalemlerdir.",
        7,
        [
          opt(
            "reference",
            "Müşteri referansını sakla",
            "30 dk; iletişim +2 ve teslim belgesi. İptal edilen iş referans olamaz.",
            30,
            0,
            (s, a) => {
              a.skill(s, "communication", 2);
              a.document(
                s,
                "story-customer",
                "İlk teslim referansı",
                "Üretim ve kontrol tamamlandı. Bu tek sözleşme tekrar ödeme üretmez.",
              );
            },
            {
              requires: (_s, st) =>
                st.route === "cancelled" ? "İptal edilen işin teslim referansı yok." : "",
            },
          ),
          opt(
            "review",
            "Gelir-gider hesabını çıkar",
            "30 dk; bilgi +2. İşletme açmak için Kariyer bölümündeki gerçek koşulları incele.",
            30,
            0,
            (s, a) => a.skill(s, "knowledge", 2),
          ),
        ],
        (s, a, st) => {
          if (st.route === "delivered")
            a.receive(s, 650, "İlk müşteri · vadeli teslim ücreti", "bank");
        },
      ),
    ],
  },
];

export function initStories(s) {
  s.stories = Object.fromEntries(
    STORY_CHAINS.map((c) => [
      c.id,
      {
        stage: 0,
        status: "locked",
        dueDay: 0,
        route: "",
        outcome: "",
        context: context(s),
        history: [],
      },
    ]),
  );
  return s;
}
export function tickStories(s, api) {
  if (!s.stories) return;
  for (const chain of STORY_CHAINS) {
    const story = s.stories[chain.id];
    if (story.status === "locked" && chain.unlock(s)) {
      story.status = "active";
      story.dueDay = day(s);
      story.context = context(s);
      api.news(s, chain.title + ": yeni bir yaşam kartı açıldı.");
    } else if (story.status === "waiting" && day(s) >= story.dueDay) {
      story.status = "active";
      const step = chain.steps[story.stage];
      if (step.onArrive) step.onArrive(s, api, story);
      api.log(s, chain.title + " · " + step.title + ": önceki kararının sonucu geldi.");
    }
  }
}
export function storyActions(s, api) {
  const actions = [];
  for (const chain of STORY_CHAINS) {
    const story = s.stories?.[chain.id];
    if (!story || story.status !== "active") continue;
    const step = chain.steps[story.stage];
    for (const choice of step.choices) {
      const cost = value(choice.cost, s, story);
      const reason =
        choice.requires?.(s, story) ||
        (s.cash + s.bank < cost ? cost + " TL toplam bakiye gerekir." : "");
      actions.push({
        id: "story:" + chain.id + ":" + choice.id,
        storyId: chain.id,
        label: choice.label,
        description: choice.description,
        category: "story",
        minutes: choice.minutes,
        cost,
        pay: "total",
        disabled: Boolean(reason),
        reason,
        run(next) {
          const st = next.stories[chain.id];
          choice.effect(next, api, st);
          const text = choice.label + ". " + choice.description;
          st.history.push({ stage: st.stage, day: day(next), choice: choice.id, text });
          st.stage++;
          if (st.stage === chain.steps.length) {
            st.status = "complete";
            st.dueDay = day(next);
            st.outcome = st.history.map((h) => h.text).join(" → ");
          } else {
            st.status = "waiting";
            st.dueDay = day(next) + chain.steps[st.stage].delay;
          }
          return (
            chain.title +
            " · " +
            choice.label +
            (st.status === "waiting"
              ? ". Sonraki gelişme: " + st.dueDay + ". gün."
              : ". Yaşam zinciri tamamlandı.")
          );
        },
      });
    }
  }
  return actions;
}
export function getStoryView(s) {
  return STORY_CHAINS.flatMap((c) => {
    const st = s.stories?.[c.id];
    if (!st || st.status === "locked") return [];
    const step = c.steps[Math.min(st.stage, c.steps.length - 1)];
    return [
      {
        id: c.id,
        title: c.title,
        summary: c.summary,
        npcId: c.npcId,
        district: c.district,
        status: st.status,
        stage: st.stage,
        stageTitle: step.title,
        body: step.body,
        dueDay: st.dueDay,
        route: st.route,
        outcome: st.outcome,
        history: st.history.map((h) => ({ ...h })),
        totalStages: c.steps.length,
      },
    ];
  });
}
const choiceRoutes = {
  "shared-roof": {
    share: "shared",
    repair: "self",
    report: "reported",
    inspect: "fixed",
    postpone: "deferred",
  },
  "portfolio-bridge": {
    pilot: "pilot",
    learn: "training",
    mentor: "mentored",
    withdraw: "withdrawn",
  },
  "community-table": {
    time: "volunteer",
    fund: "funded",
    decline: "declined",
    organize: "organized",
    stepback: "delegated",
  },
  "learning-circle": {
    prepare: "prepared",
    observe: "observer",
    teach: "taught",
    assist: "assisted",
  },
  "debt-crossroads": { disclose: "shared", private: "private", repay: "paid", buffer: "buffer" },
  "workplace-voice": {
    discuss: "discussed",
    solo: "solo",
    coordinate: "coordinated",
    boundary: "bounded",
  },
  "health-rhythm": { care: "cared", push: "pushed", clinic: "treated", rest: "rested" },
  "new-neighborhood": { compare: "compared", stay: "staying", moved: "moved", local: "rooted" },
  "relationship-space": {
    friend: "friend",
    romantic: "romantic",
    professional: "professional",
    explain: "explained",
  },
  "first-customer": { accept: "accepted", practice: "practice", cancel: "cancelled" },
};
function routeFromHistory(id, history) {
  let result = "";
  for (const h of history) {
    if (id === "portfolio-bridge" && h.choice === "deliver")
      result = result === "pilot" ? "delivered-paid" : "delivered-study";
    else if (id === "first-customer" && h.choice === "deliver")
      result = result === "accepted" ? "delivered" : "sample";
    else if (id === "relationship-space" && h.choice === "meet")
      result = result === "romantic" ? "romantic-kept" : "friend-kept";
    else result = choiceRoutes[id][h.choice] || result;
  }
  return result;
}
export function validateStories(s) {
  const all = s.stories;
  if (
    !all ||
    typeof all !== "object" ||
    Array.isArray(all) ||
    Object.keys(all).length !== STORY_CHAINS.length
  )
    return false;
  const integer = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
  const text = (v, max) => typeof v === "string" && v.length <= max;
  const keys = (obj, allowed) =>
    obj !== null &&
    typeof obj === "object" &&
    !Array.isArray(obj) &&
    Object.keys(obj).length === allowed.length &&
    Object.keys(obj).every((k) => allowed.includes(k));
  return STORY_CHAINS.every((c) => {
    const st = all[c.id];
    if (
      !keys(st, ["stage", "status", "dueDay", "route", "outcome", "context", "history"]) ||
      !integer(st.stage, 0, c.steps.length) ||
      !["locked", "active", "waiting", "complete"].includes(st.status) ||
      !integer(st.dueDay, 0, 400000) ||
      !text(st.route, 40) ||
      !text(st.outcome, 4000) ||
      !keys(st.context, ["home", "job", "district", "lease", "employment"]) ||
      !HOMES.some((h) => h.id === st.context.home) ||
      !(st.context.job === "" || JOBS.some((j) => j.id === st.context.job)) ||
      !text(st.context.lease, 80) ||
      !text(st.context.employment, 80) ||
      !["kadikoy", "besiktas", "sisli"].includes(st.context.district) ||
      !Array.isArray(st.history) ||
      st.history.length !== st.stage
    )
      return false;
    if (
      (st.status === "locked" && (st.stage !== 0 || st.dueDay !== 0 || st.route !== "")) ||
      (st.status === "complete") !== (st.stage === c.steps.length) ||
      (st.status === "waiting" && st.stage === 0) ||
      (st.status === "active" && (st.dueDay === 0 || st.dueDay > day(s)))
    )
      return false;
    const validHistory = st.history.every(
      (h, i) =>
        keys(h, ["stage", "day", "choice", "text"]) &&
        h.stage === i &&
        integer(h.day, 1, day(s)) &&
        text(h.text, 1200) &&
        c.steps[i].choices.some((x) => x.id === h.choice) &&
        (i === 0 || h.day >= st.history[i - 1].day + c.steps[i].delay),
    );
    if (!validHistory || st.route !== routeFromHistory(c.id, st.history)) return false;
    if (st.stage > 0) {
      const last = st.history[st.history.length - 1];
      const expectedDue = last.day + (st.status === "complete" ? 0 : c.steps[st.stage].delay);
      if (st.dueDay !== expectedDue) return false;
    }
    return (
      st.outcome === (st.status === "complete" ? st.history.map((h) => h.text).join(" → ") : "")
    );
  });
}
