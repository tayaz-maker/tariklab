import { recordNpcMilestone } from "./depth3-systems.js?v=10";
/** Aile türü, çevre modu ve seyrek NPC grafiği. Varsayılan hayat değişmez. */

export const FAMILY_TYPES = {
  nuclear: {
    id: "nuclear",
    label: "Çekirdek Aile",
    householdSize: 4,
    expenseDelta: 0,
    rentShare: 1500,
    privacy: 2,
    familySupport: 2,
    emotionalSupport: 2,
    pressure: 1,
    childcare: 1,
    elderCare: 0,
    siblingDuty: 1,
    emergencyMoney: 1,
    inheritance: 1,
    marriagePressure: 1,
    conflict: 1,
    networkBreadth: 0,
    extraFamilyIds: ["kardes"],
  },
  extended: {
    id: "extended",
    label: "Geniş Aile",
    householdSize: 7,
    expenseDelta: 0,
    rentShare: 900,
    privacy: 0,
    familySupport: 3,
    emotionalSupport: 2,
    pressure: 3,
    childcare: 3,
    elderCare: 2,
    siblingDuty: 2,
    emergencyMoney: 2,
    inheritance: 1,
    marriagePressure: 3,
    conflict: 3,
    networkBreadth: 8,
    extraFamilyIds: ["kardes", "nine", "dede", "amca", "teyze"],
  },
  stem: {
    id: "stem",
    label: "Kök Aile",
    householdSize: 5,
    expenseDelta: 0,
    rentShare: 1200,
    privacy: 1,
    familySupport: 2,
    emotionalSupport: 1,
    pressure: 2,
    childcare: 1,
    elderCare: 3,
    siblingDuty: 2,
    emergencyMoney: 2,
    inheritance: 3,
    marriagePressure: 2,
    conflict: 2,
    networkBreadth: 4,
    extraFamilyIds: ["kardes", "nine", "dede"],
  },
  single: {
    id: "single",
    label: "Tek Ebeveynli Aile",
    householdSize: 3,
    expenseDelta: 0,
    rentShare: 1800,
    privacy: 2,
    familySupport: 1,
    emotionalSupport: 1,
    pressure: 2,
    childcare: 0,
    elderCare: 1,
    siblingDuty: 2,
    emergencyMoney: 0,
    inheritance: 0,
    marriagePressure: 1,
    conflict: 2,
    networkBreadth: 2,
    extraFamilyIds: ["kardes", "teyze"],
    absentParent: "baba",
  },
};

export const NETWORK_MODES = {
  tight: { id: "tight", label: "Dar Çevre", attach: 0 },
  normal: { id: "normal", label: "Normal Çevre", attach: 10 },
  wide: { id: "wide", label: "Geniş Çevre", attach: 40 },
};

const CORE_IDS = ["anne", "baba", "mehmet", "elif", "selin", "emre", "burak"];

/** Çekirdek yedinin dışında kalan yetişkin ağ. Hepsi 18+. */
export const NETWORK_CAST = [
  { id: "nine", name: "Neriman", age: 71, gender: "woman", occupation: "Emekli öğretmen", education: "lisans", income: "low", hood: "Üsküdar", rel: "widow", family: "grandmother", traits: ["sabırlı", "inatçı", "hafıza"], lifestyle: ["ev", "komşu"], ambition: "torun düzeni", stress: 30, reliability: 88, generosity: 70, style: "sıcak", sector: "egitim", relationType: "Büyükanne", roleId: "family", tags: ["family"], trust: 76, romance: false, favors: ["childcare", "emergency"], edges: ["anne", "dede", "teyze"] },
  { id: "dede", name: "Kemal", age: 74, gender: "man", occupation: "Emekli memur", education: "lise", income: "low", hood: "Üsküdar", rel: "married", family: "grandfather", traits: ["ketum", "otoriter", "hesapçı"], lifestyle: ["çay", "gazete"], ambition: "sessiz ev", stress: 28, reliability: 80, generosity: 40, style: "mesafeli", sector: "kamu", relationType: "Büyükbaba", roleId: "family", tags: ["family"], trust: 62, romance: false, favors: ["inheritance", "advice"], edges: ["baba", "nine", "amca"] },
  { id: "amca", name: "Cengiz", age: 52, gender: "man", occupation: "Nakliyeci", education: "lise", income: "mid", hood: "Sultanbeyli", rel: "married", family: "uncle", traits: ["bağırgan", "cömert", "aceleci"], lifestyle: ["aile", "iş"], ambition: "filo büyütmek", stress: 58, reliability: 55, generosity: 64, style: "gürültülü", sector: "lojistik", relationType: "Amca", roleId: "family", tags: ["family"], trust: 50, romance: false, favors: ["job", "vehicle"], edges: ["dede", "baba", "halil"] },
  { id: "teyze", name: "Sevim", age: 48, gender: "woman", occupation: "Hemşire", education: "onlisans", income: "mid", hood: "Kadıköy", rel: "divorced", family: "aunt", traits: ["dikkatli", "yorgun", "dürüst"], lifestyle: ["vardiya", "kitap"], ambition: "nöbeti azaltmak", stress: 62, reliability: 84, generosity: 58, style: "direkt", sector: "saglik", relationType: "Teyze", roleId: "family", tags: ["family"], trust: 68, romance: false, favors: ["doctor", "childcare"], edges: ["anne", "nine", "leyla"] },
  { id: "halil", name: "Halil", age: 29, gender: "man", occupation: "Taksici", education: "lise", income: "mid", hood: "Esenler", rel: "single", family: "cousin", traits: ["lafazan", "sadık", "kumar"], lifestyle: ["gece", "radyo"], ambition: "kendi filosu", stress: 54, reliability: 48, generosity: 52, style: "sokak", sector: "lojistik", relationType: "Kuzen", roleId: "acquaintance", tags: ["peer", "family_connection"], trust: 40, romance: false, favors: ["ride", "cash"], edges: ["amca", "burak"] },
  { id: "leyla", name: "Leyla", age: 26, gender: "woman", occupation: "Öğretmen", education: "lisans", income: "mid", hood: "Maltepe", rel: "single", family: "cousin", traits: ["düzenli", "utangaç", "idealist"], lifestyle: ["okul", "yürüyüş"], ambition: "kadrolu olmak", stress: 46, reliability: 82, generosity: 60, style: "nazik", sector: "egitim", relationType: "Kuzen", roleId: "acquaintance", tags: ["peer", "family_connection", "romance_available"], trust: 42, romance: true, favors: ["intro", "study"], edges: ["teyze", "elif"] },
  { id: "cem", name: "Cem", age: 24, gender: "man", occupation: "Barista", education: "lise", income: "low", hood: "Kadıköy", rel: "single", family: "none", traits: ["esprili", "dağınık", "meraklı"], lifestyle: ["kafe", "konser"], ambition: "kendi dükkânı", stress: 40, reliability: 44, generosity: 70, style: "rahat", sector: "yemeicme", relationType: "Tanıdık", roleId: "acquaintance", tags: ["peer", "romance_available"], trust: 36, romance: true, favors: ["shift", "intro"], edges: ["mehmet", "deniz"] },
  { id: "deniz", name: "Deniz K.", age: 27, gender: "woman", occupation: "Grafik tasarımcı", education: "lisans", income: "mid", hood: "Kadıköy", rel: "partner", family: "none", traits: ["keskin", "gececi", "kıskanç"], lifestyle: ["stüdyo", "bar"], ambition: "ajans kurmak", stress: 57, reliability: 60, generosity: 38, style: "iğneleyici", sector: "medya", relationType: "Tanıdık", roleId: "acquaintance", tags: ["peer", "weak_tie"], trust: 28, romance: false, favors: ["client", "design"], edges: ["cem", "pinar"] },
  { id: "pinar", name: "Pınar", age: 31, gender: "woman", occupation: "İnsan kaynakları", education: "lisans", income: "mid", hood: "Ataşehir", rel: "married", family: "none", traits: ["hesapçı", "nazik", "torpil"], lifestyle: ["ofis", "spor"], ambition: "müdür olmak", stress: 55, reliability: 70, generosity: 30, style: "kurumsal", sector: "ofis", relationType: "İş bağlantısı", roleId: "work_contact", tags: ["professional"], trust: 34, romance: false, favors: ["referral", "interview"], edges: ["burak", "onur"] },
  { id: "onur", name: "Onur", age: 33, gender: "man", occupation: "Yazılımcı", education: "lisans", income: "high", hood: "Maslak", rel: "single", family: "none", traits: ["içe dönük", "dürüst", "tükenmiş"], lifestyle: ["ekran", "koşu"], ambition: "uzak iş", stress: 61, reliability: 86, generosity: 44, style: "kısa", sector: "teknoloji", relationType: "İş bağlantısı", roleId: "work_contact", tags: ["professional", "romance_available"], trust: 32, romance: true, favors: ["referral", "freelance"], edges: ["pinar", "seda"] },
  { id: "seda", name: "Seda", age: 29, gender: "woman", occupation: "Muhasebeci", education: "lisans", income: "mid", hood: "Bakırköy", rel: "single", family: "none", traits: ["titiz", "çekingen", "sadık"], lifestyle: ["defter", "dizi"], ambition: "kendi bürosu", stress: 48, reliability: 90, generosity: 50, style: "sessiz", sector: "ofis", relationType: "Tanıdık", roleId: "acquaintance", tags: ["peer", "romance_available"], trust: 30, romance: true, favors: ["tax", "job"], edges: ["onur", "kemal_bank"] },
  { id: "kemal_bank", name: "Kemal Bey", age: 44, gender: "man", occupation: "Banka şube yetkilisi", education: "lisans", income: "high", hood: "Beşiktaş", rel: "married", family: "kids", traits: ["resmi", "temkinli", "statü"], lifestyle: ["şube", "öğle"], ambition: "bölge müdürü", stress: 50, reliability: 74, generosity: 22, style: "mesafeli", sector: "banka", relationType: "İş bağlantısı", roleId: "work_contact", tags: ["professional"], trust: 24, romance: false, favors: ["loan", "referral"], edges: ["seda", "hulya"] },
  { id: "hulya", name: "Hülya", age: 38, gender: "woman", occupation: "Emlakçı", education: "lise", income: "mid", hood: "Ümraniye", rel: "divorced", family: "kids", traits: ["pazarlıkçı", "güleryüz", "fırsatçı"], lifestyle: ["ilan", "araba"], ambition: "kendi ofisi", stress: 52, reliability: 46, generosity: 28, style: "satış", sector: "ticaret", relationType: "Tanıdık", roleId: "acquaintance", tags: ["weak_tie"], trust: 22, romance: false, favors: ["housing", "client"], edges: ["kemal_bank", "volkan"] },
  { id: "volkan", name: "Volkan", age: 36, gender: "man", occupation: "Avukat", education: "lisans", income: "high", hood: "Şişli", rel: "partner", family: "none", traits: ["keskin", "kibirli", "işbitirici"], lifestyle: ["duruşma", "cigara"], ambition: "ortaklık", stress: 58, reliability: 64, generosity: 18, style: "sert", sector: "hukuk", relationType: "İş bağlantısı", roleId: "work_contact", tags: ["professional"], trust: 20, romance: false, favors: ["lawyer", "intro"], edges: ["hulya", "ayse_doc"] },
  { id: "ayse_doc", name: "Uzm. Dr. Ayşe", age: 41, gender: "woman", occupation: "Dahiliye uzmanı", education: "lisans", income: "high", hood: "Kadıköy", rel: "married", family: "kids", traits: ["yorgun", "dürüst", "mesafeli"], lifestyle: ["hastane", "nöbet"], ambition: "özel muayene", stress: 70, reliability: 88, generosity: 48, style: "klinik", sector: "saglik", relationType: "Tanıdık", roleId: "acquaintance", tags: ["weak_tie"], trust: 18, romance: false, favors: ["doctor"], edges: ["volkan", "teyze"] },
  { id: "mert", name: "Mert", age: 23, gender: "man", occupation: "Kurye", education: "lise", income: "low", hood: "Bağcılar", rel: "single", family: "none", traits: ["aceleci", "sadık", "risk"], lifestyle: ["motor", "çay"], ambition: "kendi rotası", stress: 49, reliability: 52, generosity: 56, style: "sokak", sector: "hizmet", relationType: "Tanıdık", roleId: "acquaintance", tags: ["peer", "romance_available"], trust: 26, romance: true, favors: ["gig", "ride"], edges: ["cem", "mehmet"] },
  { id: "gizem", name: "Gizem", age: 25, gender: "woman", occupation: "Çağrı merkezi", education: "lise", income: "low", hood: "Pendik", rel: "single", family: "none", traits: ["alaycı", "yorgun", "zeki"], lifestyle: ["kulaklık", "sigara"], ambition: "masa işi", stress: 66, reliability: 58, generosity: 42, style: "keskin", sector: "hizmet", relationType: "Tanıdık", roleId: "acquaintance", tags: ["peer", "romance_available"], trust: 24, romance: true, favors: ["shift", "gossip"], edges: ["mert", "elif"] },
  { id: "baris", name: "Barış", age: 34, gender: "man", occupation: "Fabrika formen", education: "meslek", income: "mid", hood: "Tuzla", rel: "married", family: "kids", traits: ["sert", "adil", "yorgun"], lifestyle: ["vardiya", "maç"], ambition: "ustabaşı", stress: 60, reliability: 78, generosity: 40, style: "direkt", sector: "uretim", relationType: "İş bağlantısı", roleId: "work_contact", tags: ["professional"], trust: 28, romance: false, favors: ["job", "overtime"], edges: ["mert", "usta"] },
  { id: "usta", name: "Usta Nuri", age: 56, gender: "man", occupation: "Elektrikçi", education: "ustalık", income: "mid", hood: "Kartal", rel: "married", family: "kids", traits: ["usta", "huysuz", "cömert"], lifestyle: ["atölye", "çay"], ambition: "çırağı bırakmak", stress: 44, reliability: 82, generosity: 54, style: "baba", sector: "hizmet", relationType: "Tanıdık", roleId: "acquaintance", tags: ["weak_tie"], trust: 30, romance: false, favors: ["repair", "apprentice"], edges: ["baris", "amca"] },
  { id: "dilan", name: "Dilan", age: 28, gender: "woman", occupation: "Kuaför", education: "kurs", income: "mid", hood: "Şişli", rel: "partner", family: "none", traits: ["konuşkan", "gözlemci", "kıskanç"], lifestyle: ["salon", "gece"], ambition: "kendi salonu", stress: 47, reliability: 60, generosity: 58, style: "sıcak", sector: "hizmet", relationType: "Tanıdık", roleId: "acquaintance", tags: ["peer"], trust: 34, romance: false, favors: ["intro", "looks"], edges: ["gizem", "canan"] },
  { id: "canan", name: "Canan", age: 32, gender: "woman", occupation: "Eczacı", education: "lisans", income: "high", hood: "Beşiktaş", rel: "single", family: "none", traits: ["düzenli", "temkinli", "yalnız"], lifestyle: ["eczane", "yoga"], ambition: "ikinci şube", stress: 43, reliability: 86, generosity: 46, style: "sakin", sector: "saglik", relationType: "Tanıdık", roleId: "acquaintance", tags: ["peer", "romance_available"], trust: 26, romance: true, favors: ["health", "intro"], edges: ["dilan", "ayse_doc"] },
  { id: "serkan", name: "Serkan", age: 30, gender: "man", occupation: "Satış temsilcisi", education: "onlisans", income: "mid", hood: "Başakşehir", rel: "single", family: "none", traits: ["pazarlıkçı", "yalancı", "enerjik"], lifestyle: ["hedef", "bar"], ambition: "bölge müdürü", stress: 51, reliability: 36, generosity: 34, style: "satış", sector: "ticaret", relationType: "Tanıdık", roleId: "acquaintance", tags: ["peer", "romance_available"], trust: 18, romance: true, favors: ["client", "referral"], edges: ["pinar", "cem"] },
  { id: "melis", name: "Melis", age: 27, gender: "woman", occupation: "Gazeteci", education: "lisans", income: "mid", hood: "Beyoğlu", rel: "single", family: "none", traits: ["meraklı", "cesur", "dağınık"], lifestyle: ["haber", "gece"], ambition: "büyük dosya", stress: 64, reliability: 58, generosity: 48, style: "soru", sector: "medya", relationType: "Tanıdık", roleId: "acquaintance", tags: ["peer", "romance_available"], trust: 22, romance: true, favors: ["intro", "info"], edges: ["deniz", "volkan"] },
  { id: "oguz", name: "Oğuz", age: 35, gender: "man", occupation: "Belediye memuru", education: "lisans", income: "mid", hood: "Fatih", rel: "married", family: "kids", traits: ["yavaş", "dikkatli", "torpil"], lifestyle: ["masa", "öğle"], ambition: "şef olmak", stress: 38, reliability: 62, generosity: 26, style: "bürokrasi", sector: "kamu", relationType: "İş bağlantısı", roleId: "work_contact", tags: ["professional"], trust: 20, romance: false, favors: ["paperwork", "housing"], edges: ["kemal_bank", "dede"] },
  { id: "nazli", name: "Nazlı", age: 39, gender: "woman", occupation: "Akademisyen", education: "lisans", income: "mid", hood: "Sarıyer", rel: "partner", family: "none", traits: ["analitik", "mesafeli", "idealist"], lifestyle: ["kampüs", "kitap"], ambition: "doçentlik", stress: 56, reliability: 80, generosity: 40, style: "akademik", sector: "egitim", relationType: "Tanıdık", roleId: "acquaintance", tags: ["weak_tie"], trust: 16, romance: false, favors: ["study", "intro"], edges: ["leyla", "onur"] },
  { id: "kadir", name: "Kadir", age: 42, gender: "man", occupation: "Gece kulübü işletmecisi", education: "lise", income: "high", hood: "Beşiktaş", rel: "single", family: "none", traits: ["fırsatçı", "cömert", "risk"], lifestyle: ["gece", "içki"], ambition: "ikinci mekân", stress: 53, reliability: 40, generosity: 62, style: "gece", sector: "eglence", relationType: "Tanıdık", roleId: "acquaintance", tags: ["weak_tie"], trust: 14, romance: false, favors: ["nightlife", "cash"], edges: ["dilan", "serkan"] },
  { id: "esra", name: "Esra", age: 24, gender: "woman", occupation: "Freelancer çevirmen", education: "lisans", income: "low", hood: "Kadıköy", rel: "single", family: "none", traits: ["içe dönük", "dürüst", "endişeli"], lifestyle: ["ev", "dil"], ambition: "yurtdışı", stress: 45, reliability: 76, generosity: 52, style: "yumuşak", sector: "freelance", relationType: "Tanıdık", roleId: "acquaintance", tags: ["peer", "romance_available"], trust: 28, romance: true, favors: ["study", "remote"], edges: ["nazli", "elif"] },
  { id: "yusuf", name: "Yusuf", age: 22, gender: "man", occupation: "İşsiz / KPSS", education: "lisans", income: "none", hood: "Ümraniye", rel: "single", family: "parents", traits: ["gergin", "çalışkan", "kıskanç"], lifestyle: ["dershane", "çay"], ambition: "kadrolu memur", stress: 72, reliability: 66, generosity: 36, style: "sıkışık", sector: "kamu", relationType: "Tanıdık", roleId: "acquaintance", tags: ["peer", "romance_available"], trust: 30, romance: true, favors: ["study", "intro"], edges: ["oguz", "leyla"] },
  { id: "asli", name: "Aslı", age: 29, gender: "woman", occupation: "Girişimci", education: "lisans", income: "mid", hood: "Levent", rel: "single", family: "none", traits: ["hırslı", "dağınık", "cömert"], lifestyle: ["pitch", "kahve"], ambition: "yatırım turu", stress: 68, reliability: 50, generosity: 64, style: "hızlı", sector: "ticaret", relationType: "Tanıdık", roleId: "acquaintance", tags: ["peer", "romance_available"], trust: 22, romance: true, favors: ["client", "partnership"], edges: ["onur", "hulya"] },
  { id: "hakan", name: "Hakan", age: 46, gender: "man", occupation: "Küçük esnaf", education: "lise", income: "mid", hood: "Üsküdar", rel: "married", family: "kids", traits: ["hesapçı", "sadık", "huysuz"], lifestyle: ["dükkân", "pazar"], ambition: "dükkânı tutmak", stress: 59, reliability: 72, generosity: 44, style: "esnaf", sector: "ticaret", relationType: "Komşu", roleId: "acquaintance", tags: ["neighbor"], trust: 36, romance: false, favors: ["credit", "job"], edges: ["nine", "usta"] },
  { id: "selma", name: "Selma", age: 51, gender: "woman", occupation: "Komşu / ev hanımı", education: "lise", income: "low", hood: "Üsküdar", rel: "married", family: "kids", traits: ["dedikodu", "cömert", "kontrolcü"], lifestyle: ["pencere", "pazar"], ambition: "çocukları yerleştirmek", stress: 41, reliability: 54, generosity: 60, style: "mahalle", sector: "ev", relationType: "Komşu", roleId: "acquaintance", tags: ["neighbor"], trust: 38, romance: false, favors: ["childcare", "gossip"], edges: ["nine", "anne"] },
  { id: "taner", name: "Taner", age: 37, gender: "man", occupation: "Güvenlik amiri", education: "lise", income: "mid", hood: "İkitelli", rel: "married", family: "kids", traits: ["şüpheci", "düzenli", "yorgun"], lifestyle: ["vardiya", "maç"], ambition: "gündüz vardiyası", stress: 50, reliability: 70, generosity: 32, style: "resmi", sector: "guvenlik", relationType: "İş bağlantısı", roleId: "work_contact", tags: ["professional"], trust: 24, romance: false, favors: ["shift", "intro"], edges: ["baris", "oguz"] },
  { id: "ipek", name: "İpek", age: 26, gender: "woman", occupation: "Müzisyen", education: "konservatuvar", income: "low", hood: "Cihangir", rel: "single", family: "none", traits: ["hassas", "gececi", "dürüst"], lifestyle: ["sahne", "sigara"], ambition: "kendi plak", stress: 58, reliability: 42, generosity: 66, style: "sanatçı", sector: "eglence", relationType: "Tanıdık", roleId: "acquaintance", tags: ["peer", "romance_available"], trust: 20, romance: true, favors: ["nightlife", "intro"], edges: ["kadir", "cem"] },
  { id: "faruk", name: "Faruk", age: 40, gender: "man", occupation: "Lojistik şefi", education: "onlisans", income: "mid", hood: "Hadımköy", rel: "married", family: "kids", traits: ["organize", "sert", "hesapçı"], lifestyle: ["depo", "yol"], ambition: "kendi deposu", stress: 55, reliability: 76, generosity: 30, style: "operasyon", sector: "lojistik", relationType: "İş bağlantısı", roleId: "work_contact", tags: ["professional"], trust: 22, romance: false, favors: ["job", "gig"], edges: ["amca", "baris"] },
  { id: "berna", name: "Berna", age: 33, gender: "woman", occupation: "Klinik psikolog", education: "lisans", income: "mid", hood: "Nişantaşı", rel: "partner", family: "none", traits: ["dinleyen", "sınırlı", "yorgun"], lifestyle: ["seans", "yürüyüş"], ambition: "kendi klinik", stress: 48, reliability: 84, generosity: 50, style: "yumuşak-sert", sector: "saglik", relationType: "Tanıdık", roleId: "acquaintance", tags: ["weak_tie"], trust: 16, romance: false, favors: ["therapy"], edges: ["canan", "melis"] },
  { id: "cemil", name: "Cemil", age: 45, gender: "man", occupation: "İnşaat ustası", education: "meslek", income: "mid", hood: "Esenyurt", rel: "married", family: "kids", traits: ["sert", "sadık", "kumar"], lifestyle: ["şantiye", "kahve"], ambition: "kendi ekip", stress: 57, reliability: 68, generosity: 48, style: "şantiye", sector: "uretim", relationType: "Tanıdık", roleId: "acquaintance", tags: ["weak_tie"], trust: 26, romance: false, favors: ["repair", "job"], edges: ["usta", "hulya"] },
  { id: "ruya", name: "Rüya", age: 21, gender: "woman", occupation: "Öğrenci / part-time garson", education: "lisans-devam", income: "low", hood: "Kadıköy", rel: "single", family: "parents", traits: ["meraklı", "savruk", "cesur"], lifestyle: ["ders", "vardiya"], ambition: "mezun olmak", stress: 52, reliability: 48, generosity: 58, style: "genç", sector: "yemeicme", relationType: "Tanıdık", roleId: "acquaintance", tags: ["peer", "romance_available"], trust: 24, romance: true, favors: ["shift", "intro"], edges: ["cem", "esra"] },
  { id: "tamer", name: "Tamer", age: 50, gender: "man", occupation: "Eski patron / market zinciri", education: "lise", income: "high", hood: "Ataşehir", rel: "married", family: "kids", traits: ["paternalist", "hesapçı", "unutan"], lifestyle: ["ofis", "öğle"], ambition: "zinciri satmak", stress: 46, reliability: 50, generosity: 28, style: "patron", sector: "ticaret", relationType: "Eski iş bağlantısı", roleId: "work_contact", tags: ["professional", "weak_tie"], trust: 28, romance: false, favors: ["referral", "job"], edges: ["burak", "pinar"] },
  { id: "nil", name: "Nil", age: 28, gender: "woman", occupation: "Mühendis", education: "lisans", income: "high", hood: "Kartal", rel: "single", family: "none", traits: ["disiplinli", "mesafeli", "adil"], lifestyle: ["şantiye", "spor"], ambition: "proje müdürü", stress: 54, reliability: 88, generosity: 36, style: "mühendis", sector: "uretim", relationType: "İş bağlantısı", roleId: "work_contact", tags: ["professional", "romance_available"], trust: 20, romance: true, favors: ["referral", "job"], edges: ["cemil", "onur"] },
  { id: "orkun", name: "Orkun", age: 31, gender: "man", occupation: "DJ / gece çalışanı", education: "lise", income: "mid", hood: "Beşiktaş", rel: "single", family: "none", traits: ["gececi", "sadık", "savruk"], lifestyle: ["kulaklık", "içki"], ambition: "festival", stress: 49, reliability: 38, generosity: 60, style: "gece", sector: "eglence", relationType: "Tanıdık", roleId: "acquaintance", tags: ["peer", "romance_available"], trust: 18, romance: true, favors: ["nightlife", "intro"], edges: ["ipek", "kadir"] },
  // Kardeş: her aile tipinin householdSize ve siblingDuty katsayısı zaten bir
  // kardeşi varsayıyordu, kişi karşılığı yoktu. Listenin sonuna eklenir; "normal"
  // çevre modunun ilk-10 dilimi değişmesin diye sıraya değil extraFamilyIds'e bağlanır.
  { id: "kardes", name: "Deniz", age: 23, gender: "woman", occupation: "Çağrı merkezi görevlisi", education: "lise", income: "low", hood: "Bağcılar", rel: "single", family: "sibling", traits: ["inatçı", "esprili", "gururlu"], lifestyle: ["vardiya", "telefon"], ambition: "kendi düzenini kurmak", stress: 52, reliability: 62, generosity: 66, style: "senli benli", sector: "cagri", relationType: "Kardeş", roleId: "family", tags: ["family"], trust: 66, romance: false, favors: ["emergency", "childcare"], edges: ["anne", "baba"] },
];

export function getFamilyTypeDef(id) {
  return FAMILY_TYPES[id] || FAMILY_TYPES.nuclear;
}

export function getNetworkModeDef(id) {
  return NETWORK_MODES[id] || NETWORK_MODES.tight;
}

export function resolveFamilyType(options = {}) {
  const raw = options.familyType;
  if (raw === "random") {
    const keys = ["nuclear", "extended", "stem", "single"];
    const seed = Number.isInteger(options.seed) ? options.seed >>> 0 : 1;
    return keys[seed % keys.length];
  }
  return FAMILY_TYPES[raw] ? raw : "nuclear";
}

export function resolveNetworkMode(options = {}) {
  if (NETWORK_MODES[options.networkMode]) return options.networkMode;
  if (options.socialBackground === "broad") return "wide";
  if (options.socialBackground === "family") return "normal";
  return "tight";
}

export function getCastById(id) {
  return NETWORK_CAST.find((row) => row.id === id) || null;
}

export function materializeCast(row, startWeek = 1) {
  return {
    id: row.id,
    name: row.name,
    age: row.age,
    gender: row.gender,
    occupation: row.occupation,
    education: row.education,
    incomeBand: row.income,
    neighborhood: row.hood,
    relationshipStatus: row.rel,
    familyStatus: row.family,
    traits: [...row.traits],
    lifestyle: [...row.lifestyle],
    ambition: row.ambition,
    stressTendency: row.stress,
    reliability: row.reliability,
    generosity: row.generosity,
    socialStyle: row.style,
    careerSector: row.sector,
    relationType: row.relationType,
    roleId: row.roleId,
    tags: [...row.tags],
    circles: row.roleId === "family" ? ["family"] : row.roleId === "work_contact" ? ["professional"] : ["acquaintances"],
    contactCategory: row.roleId === "family" ? "close" : "weak",
    dormant: false,
    available: true,
    romanceEligible: row.romance === true && row.age >= 18,
    possibleFavors: [...(row.favors || [])],
    networkEdges: [...(row.edges || [])],
    lifeState: {
      employment: row.occupation,
      education: row.education,
      residence: row.hood,
      relationship: row.rel === "married" || row.rel === "partner" ? row.rel : "single",
      concern: null,
    },
    lifeMilestones: [],
    knownMilestones: [],
    memories: [],
    social: {
      trust: row.trust,
      tension: 0,
      lastMeaningfulContactWeek: startWeek,
      romanceStatus: "none",
      visibility: row.roleId === "family" ? "family_connection" : "heard_of",
    },
  };
}

export function selectNetworkPeople(familyType, networkMode, startWeek = 1) {
  const family = getFamilyTypeDef(familyType);
  const mode = getNetworkModeDef(networkMode);
  const wanted = new Set(family.extraFamilyIds || []);
  if (mode.id === "wide") {
    for (const row of NETWORK_CAST) wanted.add(row.id);
  } else if (mode.id === "normal") {
    for (const row of NETWORK_CAST.slice(0, mode.attach)) wanted.add(row.id);
    for (const id of family.extraFamilyIds || []) wanted.add(id);
  }
  return NETWORK_CAST.filter((row) => wanted.has(row.id)).map((row) => materializeCast(row, startWeek));
}

export function countWideNetwork(state) {
  return Array.isArray(state?.people) ? state.people.filter((p) => !CORE_IDS.includes(p.id)).length + CORE_IDS.filter((id) => state.people.some((p) => p.id === id)).length : 0;
}

export function visibleNetwork(state) {
  return (state.people || []).filter((p) => p.available !== false && !p.dormant);
}

export function canIntroduce(state, aId, bId) {
  if (!aId || !bId || aId === bId) return { ok: false, reason: "İki ayrı kişi gerekir." };
  const a = state.people.find((p) => p.id === aId);
  const b = state.people.find((p) => p.id === bId);
  if (!a || !b) return { ok: false, reason: "Kişi bulunamadı." };
  if ((state.relationships[aId] || 0) < 35 || (state.relationships[bId] || 0) < 35)
    return { ok: false, reason: "İkisini de yeterince tanımıyorsun." };
  const key = [aId, bId].sort().join(":");
  if ((state.flags.introductions || {})[key]) return { ok: false, reason: "Bu ikisini zaten tanıştırdın." };
  return { ok: true, reason: "" };
}

export function introducePeople(state, aId, bId) {
  const gate = canIntroduce(state, aId, bId);
  if (!gate.ok) return gate;
  const a = state.people.find((p) => p.id === aId);
  const b = state.people.find((p) => p.id === bId);
  const key = [aId, bId].sort().join(":");
  state.flags.introductions = { ...(state.flags.introductions || {}), [key]: state.time.absoluteWeek };
  const ageGap = Math.abs((a.age || 30) - (b.age || 30));
  const bothSingle = (a.lifeState?.relationship || "single") === "single" && (b.lifeState?.relationship || "single") === "single";
  const bothRomance = a.romanceEligible && b.romanceEligible;
  let outcome = "acquaintance";
  if (ageGap > 18) outcome = "rejected";
  else if (bothRomance && bothSingle && ageGap < 10 && (a.lifestyle || []).some((t) => (b.lifestyle || []).includes(t)))
    outcome = "romantic";
  else if (a.careerSector && a.careerSector === b.careerSector) outcome = "work";
  else if ((state.relationships[aId] || 0) > 55 && (state.relationships[bId] || 0) > 55) outcome = "friendship";
  a.networkEdges = [...new Set([...(a.networkEdges || []), bId])].slice(0, 6);
  b.networkEdges = [...new Set([...(b.networkEdges || []), aId])].slice(0, 6);
  return { ok: true, outcome, a, b };
}

export function canRequestReferral(state, personId) {
  const person = state.people.find((p) => p.id === personId);
  if (!person) return { ok: false, reason: "Kişi yok." };
  if ((state.relationships[personId] || 0) < 40 || (person.social?.trust || 0) < 40)
    return { ok: false, reason: "Bu kişi henüz referans verecek kadar güvenmiyor." };
  const used = state.flags.referrals?.[personId] || 0;
  if (used >= 2) return { ok: false, reason: "Aynı kişiden referans çiftliği olmaz." };
  return { ok: true, reason: "" };
}

export function recordReferral(state, personId, jobId) {
  const gate = canRequestReferral(state, personId);
  if (!gate.ok) return gate;
  state.flags.referrals = { ...(state.flags.referrals || {}), [personId]: (state.flags.referrals?.[personId] || 0) + 1 };
  state.flags.lastReferral = { personId, jobId, week: state.time.absoluteWeek };
  return { ok: true };
}

export function applyFamilyStartFlags(state, familyType) {
  const def = getFamilyTypeDef(familyType);
  state.flags.familyType = def.id;
  state.flags.familyMods = {
    privacy: def.privacy,
    support: def.familySupport,
    pressure: def.pressure,
    childcare: def.childcare,
    elderCare: def.elderCare,
    marriagePressure: def.marriagePressure,
    conflict: def.conflict,
    emergencyMoney: def.emergencyMoney,
    inheritance: def.inheritance,
    // siblingDuty aile tiplerinde tanımlıydı ama hiçbir yere taşınmıyordu.
    siblingDuty: def.siblingDuty,
  };
  if (def.absentParent && state.people.find((p) => p.id === def.absentParent)) {
    const missing = state.people.find((p) => p.id === def.absentParent);
    missing.available = false;
    missing.dormant = true;
    missing.lifeState = { ...(missing.lifeState || {}), concern: "absent" };
    state.flags.absentParent = def.absentParent;
  }
  return state;
}

// Old network records stored display text where consumers expect an ID.
// Convert only an unambiguous exact match on this person's network milestones.
export function normalizeNetworkMilestoneKnowledge(person) {
  const milestones = person.lifeMilestones || [];
  return [...new Set((person.knownMilestones || []).filter((x) => typeof x === "string").map((value) => {
    if (milestones.some((m) => m.id === value)) return value;
    const matches = milestones.filter((m) => m.id?.startsWith(`net-${person.id}-`) && m.text === value);
    return matches.length === 1 ? matches[0].id : value;
  }))].slice(-12);
}

export function processNetworkWeek(state) {
  const extras = (state.people || []).filter((p) => !CORE_IDS.includes(p.id) && p.available !== false && !p.deceased);
  if (!extras.length) return false;
  const week = state.time.absoluteWeek;
  if (week % 16 !== 0 || state.flags.lastNetworkWeek === week) return false;
  for (const p of extras) p.knownMilestones = normalizeNetworkMilestoneKnowledge(p);
  const idx = (Math.floor(week / 16) - 1) % extras.length;
  const person = extras[idx];
  if (!person || person.lifeMilestones?.some((m) => m.id === `net-${person.id}-${week}`)) return false;
  const roll = week % 7;
  const patches = [
    { type: "career", text: `${person.name} iş değiştirmeyi konuşuyor.`, employment: "searching" },
    { type: "housing", text: `${person.name} taşınmayı düşünüyor.`, residence: "moving" },
    { type: "relationship", text: `${person.name} ilişkisinde bir kırılma var.`, relationship: "strained" },
    { type: "career", text: `${person.name} bir süre işsiz kalabilir.`, employment: "unemployed" },
    { type: "help", text: `${person.name} senden bir iyilik bekliyor.`, concern: "favor" },
    { type: "relationship", text: `${person.name} evlilik konuşması açtı.`, relationship: "serious" },
    { type: "contact", text: `${person.name} bir süreliğine şehir dışına çıktı.`, concern: "away" },
  ];
  const pick = patches[roll];
  const { type, text, ...statePatch } = pick;
  const changed = recordNpcMilestone(state, person.id, {
    id: `net-${person.id}-${week}`, type, text, statePatch,
    playerKnown: (state.relationships[person.id] || 0) >= 40,
  });
  if (changed) {
    person.knownMilestones = person.knownMilestones.slice(-12);
    state.flags.lastNetworkWeek = week;
  }
  return changed;
}
