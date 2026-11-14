import { shape } from "./expansion-world.mjs";
import { COURSES, NPCS } from "./content.mjs";
import { getSocietyDistrictEffects } from "./society-systems.mjs";
import { REGIONS } from "./expansion-world.mjs";

const REGION_IDS = Object.keys(REGIONS);
const TOPICS = ["skills", "health", "housing"];
const MAX_MONEY = 1_000_000_000;
const DAY = 1440;
const MAX_DAY = 400_000;
const dayOf = (s) => Math.floor(s.time / DAY) + 1;
const regionOf = (s) => s.expansion.world.region;
const priceIndex = (s) => s.expansion.world.regions[regionOf(s)].price;
const cap = (value) => Math.max(0, Math.min(100, value));
const costOf = (s, amount) => Math.max(1, Math.round((priceIndex(s) * amount) / 100));
const funds = (s) => s.cash + s.bank;
const stateOf = (s) => s.expansion?.institutions;
const currentRegion = (s) => stateOf(s).regions[regionOf(s)];
const available = (s, amount) => (funds(s) < amount ? "Yeterli bakiye yok." : "");
const localContacts = (s) =>
  regionOf(s) === "istanbul"
    ? Object.values(stateOf(s).contacts).filter((day) => day && dayOf(s) - day <= 30).length
    : 0;
const officeOpen = (s, duration) =>
  s.time % DAY < 480 || (s.time % DAY) + duration > 1200 ? "Kurum 08.00–20.00 açık." : "";
const existingCertificate = (s, course) =>
  s.documents.some((document) => document.id === `certificate-${course}`);
const signal = (s, salt) =>
  (Math.imul(s.seed ^ dayOf(s), 0x9e3779b1) ^ Math.imul(salt, 0x45d9f3b)) >>> 0;

const LABELS = {
  school: "Meslek okuluna kaydol",
  study: "Okul dersine katıl",
  withdraw: "Okul kaydını kapat",
  clinic: "Yerel klinikte tedavi ol",
  rest: "İyileşmek için dinlen",
  petition: "Belediyeye başvur",
  publish: "Sonucu yerel basına duyur",
  campaign: "Mahalle meclisinde görüş sun",
  decline: "Usulsüz teklifi reddet",
  accept: "Usulsüz ihaleyi kabul et",
  fine: "Kararı ve tazmini öde",
  appeal: "Bağımsız inceleme iste",
  rentAid: "Kira borcuna geçici destek al",
};

const institutionCopy = {
  "Meslek okuluna kaydol": ["Enrol in vocational school", "Zapisz się do szkoły zawodowej"],
  "Okul dersine katıl": ["Attend class", "Weź udział w zajęciach"],
  "Okul kaydını kapat": ["Withdraw from school", "Zrezygnuj ze szkoły"],
  "Yerel klinikte tedavi ol": [
    "Get treatment at the local clinic",
    "Skorzystaj z lokalnej kliniki",
  ],
  "İyileşmek için dinlen": ["Rest and recover", "Odpocznij i zregeneruj siły"],
  "Belediyeye başvur": ["Petition the council", "Złóż wniosek do rady miejskiej"],
  "Sonucu yerel basına duyur": [
    "Share the outcome with local media",
    "Przekaż wynik lokalnym mediom",
  ],
  "Mahalle meclisinde görüş sun": ["Speak at the local council", "Zabierz głos w radzie lokalnej"],
  "Usulsüz teklifi reddet": ["Decline the improper offer", "Odrzuć nieuczciwą ofertę"],
  "Usulsüz ihaleyi kabul et": ["Accept the improper contract", "Przyjmij nieuczciwy kontrakt"],
  "Kararı ve tazmini öde": ["Pay the fine and restitution", "Zapłać grzywnę i zwróć środki"],
  "Bağımsız inceleme iste": ["Request an independent review", "Poproś o niezależną kontrolę"],
  "Kira borcuna geçici destek al": [
    "Apply for short-term rent relief",
    "Złóż wniosek o dopłatę do czynszu",
  ],
  "Yeterli bakiye yok.": ["Insufficient funds.", "Brak wystarczających środków."],
  "Kurum 08.00–20.00 açık.": ["The office is open 08:00–20:00.", "Urząd jest czynny 08:00–20:00."],
  "Önce eğitimini tamamla veya bırak.": [
    "Finish or leave your course first.",
    "Najpierw ukończ lub opuść kurs.",
  ],
  "Bu yeterlilik zaten kayıtlı.": [
    "You already hold this qualification.",
    "Masz już te kwalifikacje.",
  ],
  "Kayıtlı olduğun şehirde katıl.": [
    "Attend in your enrolment city.",
    "Uczestnicz w mieście zapisu.",
  ],
  "Bugünkü dersi tamamladın.": ["Today's class is complete.", "Dzisiejsze zajęcia są ukończone."],
  "En az 20 enerji gerekir.": [
    "At least 20 energy is required.",
    "Potrzeba co najmniej 20 energii.",
  ],
  "Sağlık durumun bu iş için uygun değil.": [
    "Your health makes this work unsafe.",
    "Zdrowie uniemożliwia bezpieczną pracę.",
  ],
  "Banka önce gecikmiş borç veya yaptırımın çözümünü bekliyor.": [
    "Bank requires overdue debt or sanctions resolved.",
    "Bank wymaga uregulowania zaległości lub sankcji.",
  ],
  "Yeni başvuru için bekleme süresi dolmadı.": [
    "The petition cooldown is active.",
    "Okres oczekiwania na wniosek trwa.",
  ],
  "Bu şehirde başvuru işleniyor.": [
    "A petition is pending in this city.",
    "W tym mieście rozpatruje się wniosek.",
  ],
  "Önce kurumla güven ilişkisi kur.": [
    "Build trust with the institution first.",
    "Najpierw zbuduj zaufanie instytucji.",
  ],
  "Bu hafta açıklama yaptın.": [
    "You issued a statement this week.",
    "W tym tygodniu wydano już oświadczenie.",
  ],
  "Duyurulacak yeni doğrulanmış sonuç yok.": [
    "No new verified outcome to report.",
    "Brak nowego potwierdzonego wyniku.",
  ],
  "Yerel güven veya gönüllülük yetersiz.": [
    "Requires more trust or volunteering.",
    "Potrzeba więcej zaufania lub wolontariatu.",
  ],
  "Meclis bu hafta görüşünü aldı.": [
    "The council already heard you this week.",
    "Rada wysłuchała cię już w tym tygodniu.",
  ],
  "Başka soruşturma sürüyor.": ["Another investigation is open.", "Trwa inne dochodzenie."],
  "Bu şehirde sonuçlandır.": [
    "Resolve this in the city where it began.",
    "Załatw sprawę w mieście, w którym się zaczęła.",
  ],
  "Karar henüz çıkmadı.": ["No decision has been issued yet.", "Nie wydano jeszcze decyzji."],
  "İnceleme hakkı zaten kullanıldı.": [
    "The review has already been requested.",
    "Wniosek o kontrolę został już złożony.",
  ],
  "Destek için birikmiş kira borcu gerekir.": [
    "Rent arrears are required for relief.",
    "Dopłata wymaga zaległości czynszowych.",
  ],
  "Yardım yalnızca ihtiyaç ve yerel bütçe uygunsa verilir.": [
    "Relief depends on need and the local budget.",
    "Dopłata zależy od potrzeb i lokalnego budżetu.",
  ],
  "Son yardımdan beri 60 gün geçmeli.": [
    "Sixty days must pass between grants.",
    "Między dopłatami musi minąć 60 dni.",
  ],
  "Kayıtta ücret ve burs belirlenir. Günde bir ders.": [
    "Fee and scholarship set at enrolment. One class daily.",
    "Opłata i stypendium przy zapisie; jedne zajęcia dziennie.",
  ],
  "Beceri kazan; son derste meslek belgesi al.": [
    "Build skill; earn a certificate in the final class.",
    "Zdobywaj umiejętności i świadectwo na ostatnich zajęciach.",
  ],
  "Ücret iadesiz. Beceriler kalır.": [
    "Fees are non-refundable; skills remain.",
    "Opłata bezzwrotna; zdobyte umiejętności pozostają.",
  ],
  "Tedavi hastalığı ve işe etkisini azaltır.": [
    "Treatment reduces illness and its effect on work.",
    "Leczenie łagodzi chorobę i wpływ na pracę.",
  ],
  "Zaman ilerler. Yeterli beslenme iyileşmeyi hızlandırır.": [
    "Time passes. Adequate food speeds recovery.",
    "Czas płynie. Dobre odżywianie przyspiesza powrót do zdrowia.",
  ],
  "Belediye başvuru ve bütçeyi üç günde inceler.": [
    "Council reviews petition and budget within three days.",
    "Rada oceni wniosek i budżet w trzy dni.",
  ],
  "Doğrulanmış belediye sonucunu yayımla. Güven ve kamuoyu değişir.": [
    "Publish a verified council result. Trust and opinion change.",
    "Publikuj wynik rady; zaufanie i opinia się zmienią.",
  ],
  "Görüşün yerel öncelikleri ve belediye harcamalarını etkiler.": [
    "Your position affects local priorities and council spending.",
    "Stanowisko wpływa na lokalne priorytety i wydatki rady.",
  ],
  "Teklifi bildir ve kamu güvenini artır.": [
    "Report the offer and build public trust.",
    "Zgłoś ofertę i zwiększ zaufanie publiczne.",
  ],
  "Belediyeden ödeme al; kayıtlı ihale inceleme ve tazmin doğurur.": [
    "Receive public money; the contract triggers review and restitution.",
    "Środki miejskie; umowa oznacza kontrolę i zwrot.",
  ],
  "Tazmini belediye alır. Dosya ve kredi engeli kalkar.": [
    "Restitution to the council ends the case and credit block.",
    "Zwrot środków radzie kończy sprawę i blokadę kredytu.",
  ],
  "İnceleme cezayı azaltabilir. Kamu parası iade edilir.": [
    "Review may reduce the fine. Public funds are returned.",
    "Kontrola może obniżyć karę. Środki publiczne podlegają zwrotowi.",
  ],
  "Belediye fonu kira borcunu doğrudan öder.": [
    "Council funds pay rent arrears directly.",
    "Fundusz rady spłaca zaległy czynsz bezpośrednio.",
  ],
  "Eğitim kaydı açıldı.": ["School enrolment confirmed.", "Potwierdzono zapis do szkoły."],
  "Ders tamamlandı.": ["Class completed.", "Zajęcia ukończone."],
  "Mesleki yeterlilik kazanıldı.": [
    "Vocational qualification earned.",
    "Zdobyto kwalifikacje zawodowe.",
  ],
  "Eğitim kaydı kapandı.": ["School enrolment closed.", "Zamknięto zapis do szkoły."],
  "Tedavi tamamlandı.": ["Treatment completed.", "Leczenie zakończone."],
  "Dinlenme tamamlandı.": ["Rest completed.", "Odpoczynek zakończony."],
  "Başvuru değerlendirmeye alındı.": [
    "Petition accepted for review.",
    "Przyjęto wniosek do rozpatrzenia.",
  ],
  "Yerel basın doğrulanmış sonucu yayımladı.": [
    "Local media published the verified outcome.",
    "Lokalne media opublikowały potwierdzony wynik.",
  ],
  "Meclis görüşünü kayda aldı.": [
    "The council recorded your position.",
    "Rada odnotowała twoje stanowisko.",
  ],
  "Usulsüz teklif bildirildi.": ["Improper offer reported.", "Zgłoszono nieuczciwą ofertę."],
  "Ödeme yapıldı ve denetim dosyası açıldı.": [
    "Payment recorded and an audit opened.",
    "Odnotowano płatność i wszczęto kontrolę.",
  ],
  "Tazmin ödendi, dosya kapandı.": [
    "Restitution paid. Case closed.",
    "Środki zwrócono. Sprawa zamknięta.",
  ],
  "İnceleme tamamlandı. Tazmin yükümlülüğü sürüyor.": [
    "Review completed. Restitution remains due.",
    "Zakończono kontrolę. Obowiązek zwrotu nadal obowiązuje.",
  ],
  "Kira desteği belediye fonundan ödendi.": [
    "Rent relief was paid from the council fund.",
    "Dopłatę wypłacono z funduszu rady.",
  ],
  Eğitim: ["Education", "Edukacja"],
  Sağlık: ["Health", "Zdrowie"],
  Barınma: ["Housing", "Mieszkalnictwo"],
  "Hastalık sona erdi.": ["The illness has passed.", "Choroba minęła."],
  "Günlük yorgunluk ve ihtiyaçlar sağlığını etkiledi.": [
    "Fatigue and unmet needs affected your health.",
    "Zmęczenie i niezaspokojone potrzeby wpłynęły na zdrowie.",
  ],
  "Yerel başvuru kabul edildi.": [
    "The local petition was approved.",
    "Wniosek lokalny zatwierdzono.",
  ],
  "Yerel başvuru reddedildi.": ["The local petition was rejected.", "Wniosek lokalny odrzucono."],
  "Bir çıkar grubu usulsüz ihale teklif etti.": [
    "A local interest group offered an improper contract.",
    "Lokalna grupa interesu zaproponowała nieuczciwy kontrakt.",
  ],
  "Bir mahalle sakini mesleki yeterliliğini geliştirdi.": [
    "A resident advanced their vocational qualification.",
    "Mieszkaniec podniósł kwalifikacje zawodowe.",
  ],
  "Denetim sonuçlandı; tazmin ve idari ceza ödenecek.": [
    "The audit found restitution and a fine due.",
    "Kontrola wykazała obowiązek zwrotu środków i zapłaty grzywny.",
  ],
  "Geciken tazmin için ek yükümlülük doğdu.": [
    "Overdue restitution incurred an extra penalty.",
    "Za opóźniony zwrot nałożono dodatkową karę.",
  ],
  "Ödenmemiş tazmin terekeye devredildi.": [
    "Unpaid restitution transferred to the estate.",
    "Niespłacony zwrot środków przeniesiono na majątek spadkowy.",
  ],
};

export function localizeInstitutionText(text, language) {
  if (language === "tr" || !text) return text;
  const index = language === "pl" ? 1 : 0;
  const direct = Object.hasOwn(institutionCopy, text) ? institutionCopy[text] : undefined;
  if (direct) return direct[index];
  const separator = text.indexOf(" · ");
  if (separator === -1) return text;
  const label = text.slice(0, separator);
  const suffix = text.slice(separator + 3);
  return Object.hasOwn(institutionCopy, label)
    ? `${institutionCopy[label][index]} · ${Object.hasOwn(institutionCopy, suffix) ? institutionCopy[suffix][index] : suffix}`
    : text;
}

const topicName = { skills: "Eğitim", health: "Sağlık", housing: "Barınma" };
function regionalBudget(treasury) {
  return {
    treasury,
    opinion: 50,
    policy: "skills",
    policyUntil: 0,
    trust: 0,
    advocacy: 0,
    watch: 0,
    lastAid: 0,
    offerUntil: 0,
    lastPetition: 0,
    lastMedia: 0,
    lastCampaign: 0,
    petition: null,
    result: null,
  };
}
function credential(s, course) {
  const list = stateOf(s).qualifications;
  if (list.some((record) => record.course === course)) return false;
  list.push({ course, day: dayOf(s) });
  return true;
}
export function initInstitutions(s) {
  s.expansion.institutions = {
    lastDay: dayOf(s),
    program: null,
    qualifications: [],
    illness: null,
    credit: 55,
    contacts: Object.fromEntries(NPCS.map(({ id }) => [id, 0])),
    npcTraining: Object.fromEntries(NPCS.map(({ id }) => [id, 0])),
    regions: {
      istanbul: regionalBudget(18000),
      ankara: regionalBudget(14000),
      izmir: regionalBudget(12000),
    },
    case: null,
  };
  for (const course of COURSES) if (existingCertificate(s, course.id)) credential(s, course.id);
}
export function creditMunicipalTax(s, region, amount) {
  const budget = stateOf(s)?.regions[region];
  if (!REGION_IDS.includes(region) || !budget || !Number.isSafeInteger(amount) || amount < 0)
    return 0;
  const accepted = Math.min(amount, MAX_MONEY - budget.treasury);
  budget.treasury += accepted;
  return accepted;
}
function event(s, api, type, subject, message) {
  api.expansionEvent(s, type, subject, message);
  return message;
}
function trust(region, change) {
  region.trust = cap(region.trust + change);
}
function municipalOutcome(s, api, region, topic, approved) {
  const budget = stateOf(s).regions[region];
  budget.result = { topic, day: dayOf(s), approved, published: false };
  if (approved) {
    budget.policy = topic;
    budget.policyUntil = dayOf(s) + 30;
    trust(budget, 4);
  }
  event(
    s,
    api,
    "council",
    region,
    approved ? "Yerel başvuru kabul edildi." : "Yerel başvuru reddedildi.",
  );
}
function auditAmount(s) {
  const investigation = stateOf(s).case;
  return investigation ? investigation.amount + investigation.penalty : 0;
}
function clinicPrice(s) {
  const region = currentRegion(s);
  const normal = costOf(s, 350);
  const grant =
    region.policy === "health" && region.policyUntil >= dayOf(s)
      ? Math.min(Math.floor(normal / 2), region.treasury)
      : 0;
  return { cost: normal - grant, grant };
}
function treat(s, api, reduction) {
  const x = stateOf(s);
  if (!x.illness) return;
  x.illness.severity = Math.max(0, x.illness.severity - reduction);
  if (!x.illness.severity) {
    x.illness = null;
    event(s, api, "health", s.expansion.playerId, "Hastalık sona erdi.");
  }
}
function schoolGrant(s, tuition) {
  const region = currentRegion(s);
  const rate = region.policy === "skills" && region.policyUntil >= dayOf(s) ? 60 : 35;
  return funds(s) <= 10000 && (s.debt > 0 || region.trust >= 8)
    ? Math.min(Math.floor((tuition * rate) / 100), region.treasury)
    : 0;
}
function applyAid(s, api, value) {
  const budget = currentRegion(s);
  budget.treasury -= value;
  budget.lastAid = dayOf(s);
  s.housing.arrears -= value;
  api.record(s, "Belediye kira desteği", -value, "arrears");
  return event(s, api, "council", regionOf(s), "Kira desteği belediye fonundan ödendi.");
}

export function institutionActions(s, api) {
  const x = stateOf(s);
  if (!x) return [];
  const actions = [];
  const today = dayOf(s);
  const region = regionOf(s);
  const local = currentRegion(s);
  function add(id, label, description, category, minutes, cost, reason, run, extra = {}) {
    const why = reason || available(s, cost);
    actions.push({
      id: `institution:${id}`,
      label,
      description,
      category,
      minutes,
      cost,
      pay: "total",
      disabled: Boolean(why),
      reason: why,
      run,
      ...extra,
    });
  }
  if (!x.program)
    for (const course of COURSES) {
      const tuition = costOf(s, course.cost);
      const grant = schoolGrant(s, tuition);
      add(
        `school:${course.id}`,
        `${LABELS.school} · ${course.name}`,
        "Kayıtta ücret ve burs belirlenir. Günde bir ders.",
        "education",
        30,
        tuition - grant,
        s.course
          ? "Önce eğitimini tamamla veya bırak."
          : x.qualifications.some((record) => record.course === course.id) ||
              existingCertificate(s, course.id)
            ? "Bu yeterlilik zaten kayıtlı."
            : officeOpen(s, 30),
        (next) => {
          currentRegion(next).treasury -= grant;
          stateOf(next).program = {
            course: course.id,
            region,
            sessions: 0,
            lastStudyDay: 0,
            grant,
          };
          return event(next, api, "education", next.expansion.playerId, "Eğitim kaydı açıldı.");
        },
        { institutionCourse: course.id, institutionGrant: grant },
      );
    }
  if (x.program) {
    const program = x.program;
    const course = COURSES.find(({ id }) => id === program.course);
    add(
      "study",
      LABELS.study,
      "Beceri kazan; son derste meslek belgesi al.",
      "education",
      course.minutes,
      0,
      program.region !== region
        ? "Kayıtlı olduğun şehirde katıl."
        : program.lastStudyDay === today
          ? "Bugünkü dersi tamamladın."
          : s.player.energy < 20
            ? "En az 20 enerji gerekir."
            : officeOpen(s, course.minutes),
      (next) => {
        const active = stateOf(next).program;
        active.sessions++;
        active.lastStudyDay = today;
        api.skill(next, course.skill, course.gain + (next.player.trait === "focused" ? 1 : 0));
        api.change(next, { energy: -8, stress: 3 });
        if (active.sessions < course.sessions) return "Ders tamamlandı.";
        credential(next, course.id);
        api.document(
          next,
          `certificate-${course.id}`,
          course.name,
          "Mesleki yeterlilik kazanıldı.",
        );
        next.flags.coursesCompleted++;
        next.deep.career.reputation = cap(next.deep.career.reputation + 3);
        stateOf(next).program = null;
        trust(currentRegion(next), 3);
        return event(
          next,
          api,
          "education",
          next.expansion.playerId,
          "Mesleki yeterlilik kazanıldı.",
        );
      },
      { institutionCourse: course.id },
    );
    add(
      "withdraw",
      LABELS.withdraw,
      "Ücret iadesiz. Beceriler kalır.",
      "education",
      0,
      0,
      "",
      (next) => {
        stateOf(next).program = null;
        return "Eğitim kaydı kapandı.";
      },
    );
  }
  if (x.illness) {
    const { cost, grant } = clinicPrice(s);
    const delay = api.getDistrictSimulation
      ? api.getDistrictSimulation(s, api.getPlace(s).districtId).serviceDelay
      : region === "istanbul"
        ? getSocietyDistrictEffects(s, s.location).serviceDelay
        : 0;
    const minutes = 60 + delay;
    add(
      "clinic",
      LABELS.clinic,
      "Tedavi hastalığı ve işe etkisini azaltır.",
      "life",
      minutes,
      cost,
      officeOpen(s, minutes),
      (next) => {
        currentRegion(next).treasury -= grant;
        api.change(next, { health: 18, stress: -8 });
        treat(next, api, 62);
        const district = next.society?.districts[next.location];
        if (region === "istanbul" && district)
          district.serviceUsed = Math.min(20, district.serviceUsed + 1);
        return "Tedavi tamamlandı.";
      },
      { institutionGrant: grant },
    );
    add(
      "rest",
      LABELS.rest,
      "Zaman ilerler. Yeterli beslenme iyileşmeyi hızlandırır.",
      "life",
      240,
      0,
      "",
      (next) => {
        api.change(next, { health: 6, energy: 16, stress: -6 });
        treat(next, api, next.player.hunger >= 45 ? 22 : 10);
        return "Dinlenme tamamlandı.";
      },
    );
  }
  for (const topic of TOPICS)
    add(
      `petition:${topic}`,
      `${LABELS.petition} · ${topicName[topic]}`,
      "Belediye başvuru ve bütçeyi üç günde inceler.",
      "people",
      45,
      0,
      local.petition
        ? "Bu şehirde başvuru işleniyor."
        : local.lastPetition && today - local.lastPetition < 15
          ? "Yeni başvuru için bekleme süresi dolmadı."
          : local.trust + Math.min(6, localContacts(s) * 2) < 10
            ? "Önce kurumla güven ilişkisi kur."
            : officeOpen(s, 45),
      (next) => {
        const budget = currentRegion(next);
        budget.lastPetition = today;
        budget.petition = {
          topic,
          filedDay: today,
          owner: next.expansion.playerId,
          support: Math.min(6, localContacts(next) * 2),
        };
        return "Başvuru değerlendirmeye alındı.";
      },
    );
  for (const topic of TOPICS)
    add(
      `campaign:${topic}`,
      `${LABELS.campaign} · ${topicName[topic]}`,
      "Görüşün yerel öncelikleri ve belediye harcamalarını etkiler.",
      "people",
      90,
      0,
      s.flags.volunteers < 1 && local.trust < 10
        ? "Yerel güven veya gönüllülük yetersiz."
        : local.lastCampaign && today - local.lastCampaign < 7
          ? "Meclis bu hafta görüşünü aldı."
          : officeOpen(s, 90),
      (next) => {
        const budget = currentRegion(next);
        budget.lastCampaign = today;
        budget.advocacy = cap(budget.advocacy + 8);
        budget.watch = cap(budget.watch + (topic === "housing" ? 8 : 2));
        budget.opinion = cap(budget.opinion + 3);
        municipalOutcome(next, api, region, topic, budget.treasury >= 700 && budget.opinion >= 58);
        return "Meclis görüşünü kayda aldı.";
      },
    );
  add(
    "publish",
    LABELS.publish,
    "Doğrulanmış belediye sonucunu yayımla. Güven ve kamuoyu değişir.",
    "people",
    45,
    0,
    !local.result || local.result.published
      ? "Duyurulacak yeni doğrulanmış sonuç yok."
      : local.lastMedia && today - local.lastMedia < 7
        ? "Bu hafta açıklama yaptın."
        : "",
    (next) => {
      const budget = currentRegion(next);
      budget.result.published = true;
      budget.lastMedia = today;
      budget.opinion = cap(budget.opinion + (budget.result.approved ? 6 : -3));
      budget.watch = cap(budget.watch + 3);
      trust(budget, 3);
      return event(next, api, "media", region, "Yerel basın doğrulanmış sonucu yayımladı.");
    },
  );
  const supportedHousing = local.policy === "housing" && local.policyUntil >= today;
  const rentAid = Math.min(
    s.housing.arrears,
    local.treasury,
    costOf(s, supportedHousing ? 1200 : 600),
  );
  add(
    "rent-aid",
    LABELS.rentAid,
    "Belediye fonu kira borcunu doğrudan öder.",
    "finance",
    40,
    0,
    !s.housing.arrears
      ? "Destek için birikmiş kira borcu gerekir."
      : rentAid === 0 || funds(s) > 4500
        ? "Yardım yalnızca ihtiyaç ve yerel bütçe uygunsa verilir."
        : local.lastAid && today - local.lastAid < 60
          ? "Son yardımdan beri 60 gün geçmeli."
          : officeOpen(s, 40),
    (next) => applyAid(next, api, rentAid),
    { institutionGrant: rentAid },
  );
  if (local.offerUntil >= today) {
    add(
      "decline",
      LABELS.decline,
      "Teklifi bildir ve kamu güvenini artır.",
      "people",
      25,
      0,
      "",
      (next) => {
        const budget = currentRegion(next);
        budget.offerUntil = 0;
        trust(budget, 5);
        budget.opinion = cap(budget.opinion + 4);
        return event(next, api, "law", region, "Usulsüz teklif bildirildi.");
      },
    );
    const amount = Math.min(local.treasury, MAX_MONEY - s.bank, costOf(s, 1200));
    add(
      "accept",
      LABELS.accept,
      "Belediyeden ödeme al; kayıtlı ihale inceleme ve tazmin doğurur.",
      "people",
      45,
      0,
      x.case
        ? "Başka soruşturma sürüyor."
        : amount < 200
          ? "Yeterli bakiye yok."
          : officeOpen(s, 45),
      (next) => {
        const budget = currentRegion(next);
        budget.offerUntil = 0;
        budget.treasury -= amount;
        api.receive(next, amount, "Usulsüz ihale ödemesi", "bank");
        stateOf(next).case = {
          region,
          owner: next.expansion.playerId,
          amount,
          penalty: Math.ceil(amount / 2),
          openedDay: today,
          reviewed: false,
          decided: false,
          overdue: false,
        };
        return event(next, api, "law", region, "Ödeme yapıldı ve denetim dosyası açıldı.");
      },
    );
  }
  if (x.case) {
    const investigation = x.case;
    const reason =
      region !== investigation.region
        ? "Bu şehirde sonuçlandır."
        : !investigation.decided
          ? "Karar henüz çıkmadı."
          : "";
    add(
      "fine",
      LABELS.fine,
      "Tazmini belediye alır. Dosya ve kredi engeli kalkar.",
      "finance",
      30,
      auditAmount(s),
      reason || officeOpen(s, 30),
      (next) => {
        creditMunicipalTax(next, region, auditAmount(next));
        stateOf(next).case = null;
        trust(currentRegion(next), 3);
        return event(next, api, "law", region, "Tazmin ödendi, dosya kapandı.");
      },
    );
    add(
      "appeal",
      LABELS.appeal,
      "İnceleme cezayı azaltabilir. Kamu parası iade edilir.",
      "people",
      60,
      0,
      reason || (investigation.reviewed ? "İnceleme hakkı zaten kullanıldı." : officeOpen(s, 60)),
      (next) => {
        const legal = stateOf(next).case;
        legal.reviewed = true;
        if (!legal.overdue) legal.penalty = Math.ceil(legal.penalty / 2);
        return "İnceleme tamamlandı. Tazmin yükümlülüğü sürüyor.";
      },
    );
  }
  return actions;
}

export function adaptInstitutionActions(s, actions) {
  const x = stateOf(s);
  if (!x) return actions;
  for (const action of actions) {
    if (action.disabled) continue;
    let reason = "";
    if ((action.id === "work" || action.id === "world:shift") && x.illness?.severity >= 72)
      reason = "Sağlık durumun bu iş için uygun değil.";
    if (action.id === "loan" && (x.credit < 40 || x.case))
      reason = "Banka önce gecikmiş borç veya yaptırımın çözümünü bekliyor.";
    if (action.id.startsWith("enroll:") && x.program) reason = "Önce eğitimini tamamla veya bırak.";
    if (
      action.id.startsWith("enroll:") &&
      x.qualifications.some((q) => q.course === action.id.slice(7))
    )
      reason = "Bu yeterlilik zaten kayıtlı.";
    if (reason) {
      action.disabled = true;
      action.reason = reason;
    }
  }
  return actions;
}

export function afterInstitutionAction(s, actionId, before, api) {
  const x = stateOf(s);
  if (!x) return;
  if (
    actionId === "study" &&
    before.course &&
    !s.course &&
    existingCertificate(s, before.course.id)
  )
    credential(s, before.course.id);
  if (actionId === "clinic" || actionId === "event:illness:clinic") treat(s, api, 52);
  if (
    actionId === "work" ||
    actionId === "world:shift" ||
    (actionId === "district:shift" && s.flags.workDays > before.flags.workDays)
  ) {
    if (stateOf(before).illness && x.illness) {
      api.change(s, { health: -4, energy: -7 });
      x.illness.severity = cap(x.illness.severity + 4);
    }
  }
  if (actionId === "volunteer") {
    const budget = stateOf(s).regions[regionOf(before)];
    trust(budget, 6);
    budget.opinion = cap(budget.opinion + 1);
  }
  if (actionId === "loan") x.credit = cap(x.credit - 6);
  if (s.debt < before.debt)
    x.credit = cap(x.credit + Math.min(8, Math.ceil((before.debt - s.debt) / 1000)));
  const contact = /^(?:talk|call|mentor):([a-z-]+)$/.exec(actionId)?.[1];
  if (contact && Object.hasOwn(x.contacts, contact) && s.npcs[contact].trust >= 30)
    x.contacts[contact] = dayOf(s);
}

function settleMunicipal(s, api, region, budget) {
  const today = dayOf(s);
  if (budget.policyUntil && today > budget.policyUntil) {
    budget.policy = "skills";
    budget.policyUntil = 0;
  }
  if (budget.offerUntil && today > budget.offerUntil) budget.offerUntil = 0;
  if (budget.petition && today >= budget.petition.filedDay + 3) {
    const { topic, owner, support: signatures } = budget.petition;
    budget.petition = null;
    const support = budget.opinion + Math.floor(budget.advocacy / 4) + budget.trust + signatures;
    municipalOutcome(
      s,
      api,
      region,
      topic,
      owner === s.expansion.playerId && budget.treasury >= 700 && support >= 65,
    );
  }
  if ((today - 1) % 7 !== 0) return;
  const economy = s.expansion.world.regions[region];
  // Civic groups react to affordable housing and vacancies. The recorded public
  // position of each group changes the next petition and contract review.
  budget.watch = cap(budget.watch + (economy.price > 106 ? 4 : -1));
  budget.advocacy = cap(budget.advocacy + (economy.employment < 94 ? 3 : -1));
  budget.opinion = cap(budget.opinion + (economy.employment < 88 ? -3 : 1));
  if (
    !stateOf(s).case &&
    !budget.offerUntil &&
    budget.treasury >= 1200 &&
    budget.advocacy >= 20 &&
    budget.watch <= 52 &&
    budget.opinion >= 58 &&
    region === regionOf(s) &&
    signal(s, 4) % 3 === 0
  ) {
    budget.offerUntil = today + 6;
    event(s, api, "law", region, "Bir çıkar grubu usulsüz ihale teklif etti.");
  }
}
function settleNpcTraining(s, api) {
  const today = dayOf(s);
  if ((today - 1) % 7 !== 0 || !s.deep?.npcs) return;
  for (const [index, { id }] of NPCS.entries()) {
    const npc = s.deep.npcs[id];
    const completed = stateOf(s).npcTraining[id];
    const resident = s.living.npcs[id];
    if (
      completed >= 8 ||
      npc.cash < 680 ||
      npc.skill >= 97 ||
      resident.energy < 45 ||
      (npc.priority !== "career" && npc.employment !== "searching")
    )
      continue;
    if ((Math.floor(today / 7) + index) % 3 !== 0) continue;
    // Existing NPC cash and skills remain authoritative. The fee pays the
    // municipal programme once, and the upgraded skill feeds their job planner.
    const fee = creditMunicipalTax(s, "istanbul", 180);
    if (!fee) continue;
    npc.cash -= fee;
    resident.energy = Math.max(0, resident.energy - 9);
    npc.skill = cap(npc.skill + 3);
    stateOf(s).npcTraining[id]++;
    if (completed === 3)
      event(s, api, "education", id, "Bir mahalle sakini mesleki yeterliliğini geliştirdi.");
  }
}
function settleHealth(s, api) {
  const x = stateOf(s);
  const risk = s.player.stress >= 75 ? 3 : s.player.stress >= 55 ? 1 : 0;
  const exposure = (s.player.health < 60 ? 2 : 0) + (s.player.hunger < 35 ? 2 : 0);
  if (x.illness) {
    const decline = s.player.hunger >= 50 && s.player.energy >= 45 ? 18 : 7;
    api.change(s, { health: -Math.ceil(x.illness.severity / 18), stress: 2 });
    treat(s, api, decline);
  } else if (risk + exposure >= 2 && signal(s, 1) % 10 < risk + exposure) {
    x.illness = { since: dayOf(s), severity: 26 + 8 * (risk + exposure) };
    event(
      s,
      api,
      "health",
      s.expansion.playerId,
      "Günlük yorgunluk ve ihtiyaçlar sağlığını etkiledi.",
    );
  }
}
function settleCase(s, api) {
  const x = stateOf(s);
  const legal = x.case;
  if (!legal) return;
  const today = dayOf(s);
  const budget = x.regions[legal.region];
  if (!legal.decided && today >= legal.openedDay + (budget.watch >= 30 ? 2 : 4)) {
    legal.decided = true;
    budget.opinion = cap(budget.opinion - 14);
    trust(budget, -16);
    x.credit = cap(x.credit - 18);
    event(s, api, "law", legal.region, "Denetim sonuçlandı; tazmin ve idari ceza ödenecek.");
  }
  if (!legal.overdue && today >= legal.openedDay + 18) {
    legal.overdue = true;
    legal.penalty += Math.ceil(legal.amount / 4);
    x.credit = cap(x.credit - 8);
    event(s, api, "law", legal.region, "Geciken tazmin için ek yükümlülük doğdu.");
  }
}
export function tickInstitutions(s, api) {
  const x = stateOf(s);
  const today = dayOf(s);
  if (!x || x.lastDay >= today) return;
  x.lastDay = today;
  settleHealth(s, api);
  for (const region of REGION_IDS) settleMunicipal(s, api, region, x.regions[region]);
  settleCase(s, api);
  settleNpcTraining(s, api);
  if ((today - 1) % 30 === 0)
    x.credit = cap(x.credit + (s.housing.arrears ? -5 : !x.case && s.debt < 4000 ? 3 : 0));
}

export function onInstitutionSuccession(s, api) {
  const x = stateOf(s);
  x.program = null;
  x.qualifications = [];
  // Existing personal certificates may be part of the old career's documents.
  // Preserve those bytes with the estate but prevent institutional reuse.
  for (const course of COURSES) {
    const document = s.documents.find((d) => d.id === `certificate-${course.id}`);
    if (document) document.id = `estate-certificate-${course.id}-${s.revision}`;
  }
  x.illness = null;
  x.credit = 55;
  for (const id of Object.keys(x.contacts)) x.contacts[id] = 0;
  for (const region of REGION_IDS) {
    const budget = x.regions[region];
    budget.trust = Math.floor(budget.trust / 3);
    budget.petition = null;
    budget.offerUntil = 0;
  }
  if (x.case) {
    // A restitution claim remains payable by the estate. The successor cannot
    // repeatedly retire lives to retain a public payout without its obligation.
    x.case.owner = s.expansion.playerId;
    event(s, api, "law", x.case.region, "Ödenmemiş tazmin terekeye devredildi.");
  }
}

export function institutionsView(s) {
  const x = stateOf(s);
  if (!x) return null;
  const today = dayOf(s);
  return {
    credit: x.credit,
    illness: x.illness ? { ...x.illness } : null,
    program: x.program
      ? {
          ...x.program,
          requiredSessions: COURSES.find((course) => course.id === x.program.course).sessions,
        }
      : null,
    qualifications: x.qualifications.map((q) => ({ ...q })),
    contacts: NPCS.filter(({ id }) => x.contacts[id] && today - x.contacts[id] <= 30).map(
      ({ id, name }) => ({ id, name, lastDay: x.contacts[id] }),
    ),
    npcQualified: Object.values(x.npcTraining).filter((sessions) => sessions >= 4).length,
    region: regionOf(s),
    regions: REGION_IDS.map((region) => {
      const budget = x.regions[region];
      return {
        region,
        treasury: budget.treasury,
        opinion: budget.opinion,
        trust: budget.trust,
        advocacy: budget.advocacy,
        watch: budget.watch,
        policy: budget.policyUntil >= today ? budget.policy : null,
        policyUntil: budget.policyUntil,
        petition: budget.petition ? { ...budget.petition } : null,
        result: budget.result ? { ...budget.result } : null,
        improperOffer: budget.offerUntil >= today,
      };
    }),
    investigation: x.case ? { ...x.case, total: auditAmount(s) } : null,
    classId:
      funds(s) - s.debt - s.housing.arrears > 30000
        ? "established"
        : funds(s) >= s.debt + s.housing.arrears + 2500
          ? "stable"
          : "precarious",
  };
}

const knownCourse = (id) => COURSES.find((course) => course.id === id);
const namedNpcs = NPCS.map(({ id }) => id);
export function validateInstitutions(s) {
  const x = s.expansion?.institutions,
    today = dayOf(s);
  if (
    !shape(
      x,
      {
        lastDay: [1, today],
        credit: 100,
        "program qualifications illness contacts npcTraining regions case": null,
      },
      2,
    ) ||
    !shape(x.contacts, { [namedNpcs.join(" ")]: today }, 2) ||
    !shape(x.npcTraining, { [namedNpcs.join(" ")]: 8 }, 2) ||
    !shape(x.regions, { [REGION_IDS.join(" ")]: null }, 2) ||
    !Array.isArray(x.qualifications) ||
    x.qualifications.length > COURSES.length
  )
    return false;
  const courses = new Set();
  for (const q of x.qualifications) {
    if (
      !shape(q, { course: null, day: [1, today] }, 2) ||
      !knownCourse(q.course) ||
      courses.has(q.course)
    )
      return false;
    courses.add(q.course);
  }
  if (x.program !== null) {
    const p = x.program;
    if (
      !shape(
        p,
        {
          course: null,
          region: REGION_IDS.join(" "),
          sessions: MAX_MONEY,
          lastStudyDay: today,
          grant: MAX_MONEY,
        },
        2,
      )
    )
      return false;
    const course = knownCourse(p.course);
    if (
      !course ||
      courses.has(p.course) ||
      s.course ||
      p.sessions > course.sessions - 1 ||
      (p.sessions === 0) !== (p.lastStudyDay === 0)
    )
      return false;
  }
  if (x.illness !== null && !shape(x.illness, { since: [1, today], severity: [1, 100] }, 2))
    return false;
  for (const region of REGION_IDS) {
    const r = x.regions[region];
    if (
      !shape(
        r,
        {
          treasury: MAX_MONEY,
          "opinion trust advocacy watch": 100,
          policy: TOPICS.join(" "),
          policyUntil: Math.min(MAX_DAY + 30, today + 30),
          offerUntil: today + 6,
          "lastAid lastPetition lastMedia lastCampaign": today,
          "petition result": null,
        },
        2,
      )
    )
      return false;
    if (
      r.petition !== null &&
      (!shape(
        r.petition,
        { topic: TOPICS.join(" "), filedDay: [1, today], owner: null, support: 6 },
        2,
      ) ||
        r.petition.filedDay !== r.lastPetition ||
        r.petition.owner !== s.expansion.playerId)
    )
      return false;
    if (
      r.result !== null &&
      !shape(r.result, { topic: TOPICS.join(" "), day: [1, today], "approved published": true }, 2)
    )
      return false;
  }
  const c = x.case;
  return (
    c === null ||
    (shape(
      c,
      {
        region: REGION_IDS.join(" "),
        owner: null,
        amount: [200, MAX_MONEY / 2],
        penalty: [1, c?.amount],
        openedDay: [1, today],
        "reviewed decided overdue": true,
      },
      2,
    ) &&
      c.owner === s.expansion.playerId &&
      (!(c.reviewed || c.overdue) || c.decided))
  );
}
