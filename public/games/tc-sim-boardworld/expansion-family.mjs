import { shape } from "./expansion-world.mjs";
import { HOMES, NPCS, SKILLS } from "./content.mjs";
import { REGIONS } from "./expansion-world.mjs";

const YEAR = 30;
const ADULT = 18;
const MAX_MONEY = 1_000_000_000;
const MAX_PEOPLE = 180;
const CITIES = Object.keys(REGIONS);
const NAMES = ["Ada", "Ekin", "Yağmur", "Ege", "Işık", "Özgür", "Öykü", "Toprak", "Can", "Güneş"];
const FOCUSES = ["communication", "technical", "craft", "knowledge"];
const UNION_STATUS = ["married", "separated", "divorced", "widowed"];
const nameOf = (id) => NPCS.find((npc) => npc.id === id)?.name;
const dayOf = (s) => Math.floor(s.time / 1440) + 1;
const ageAt = (person, day) => Math.floor((Math.min(person.died ?? day, day) - person.born) / YEAR);
const alive = (person) => person?.died === null;
const cap = (value) => Math.min(100, Math.max(0, value));
const select = (family, id) => family.people.find((person) => person.id === id);
const cash = (s) => s.cash + s.bank;
const publicPerson = (person, day) => ({
  id: person.id,
  name: person.name,
  parents: [...person.parents],
  age: ageAt(person, day),
  died: person.died,
  retired: person.retired,
  care: person.care,
  learning: person.learning,
  focus: person.focus,
});

function entropy(seed, text) {
  let value = seed >>> 0;
  for (const ch of text) value = Math.imul(value ^ ch.charCodeAt(0), 16777619);
  return value >>> 0;
}

function newPerson(s, id, name, born, parents = [], npcId = null) {
  return {
    id,
    name,
    born,
    died: null,
    npcId,
    parents,
    care: parents.length ? 55 : 0,
    learning: 0,
    focus: "knowledge",
    lastCare: null,
    retired: false,
    lifespan: 75 + (entropy(s.seed, id) % 16),
  };
}

function activeUnion(family, id) {
  return family.unions.find(
    (union) =>
      ["married", "separated"].includes(union.status) &&
      (union.first === id || union.second === id),
  );
}

function currentChildren(s) {
  const family = s.expansion.family;
  return family.people.filter(
    (person) => alive(person) && person.parents.includes(s.expansion.playerId),
  );
}

function dependentChildren(s) {
  return currentChildren(s).filter((person) => ageAt(person, dayOf(s)) < ADULT);
}

function familyRegion(s) {
  return s.expansion.world?.region ?? "istanbul";
}

function reserveResident(s, i, day, parentIds = []) {
  const id = `resident:${s.expansion.family.nextResident++}`;
  return {
    id,
    name: NAMES[entropy(s.seed, id) % NAMES.length],
    born: day,
    parents: parentIds,
    lifespan: 72 + (entropy(s.seed, id) % 15),
    skill: 24 + (i % 5) * 8,
  };
}

export function initFamily(s) {
  const day = dayOf(s);
  const founder = s.expansion.playerId ?? "player:1";
  s.expansion.playerId = founder;
  const age = { graduate: 24, newcomer: 26, restart: 39 }[s.player.scenario] ?? 26;
  const parent = newPerson(s, "family:1", "Aile büyüğü", day - (age + 24) * YEAR);
  const sibling = newPerson(
    s,
    "family:2",
    NAMES[entropy(s.seed, "sibling") % NAMES.length],
    day - (age - 2) * YEAR,
    [parent.id],
  );
  const start = newPerson(s, founder, s.player.name, day - age * YEAR, [parent.id]);
  s.expansion.family = {
    people: [parent, sibling, start],
    unions: [],
    expected: null,
    nextPerson: 3,
    reserve: 0,
    arrears: 0,
    lastDay: day,
    lastSupportDay: null,
    lastFamilyDay: null,
    generations: 1,
    lastEstate: null,
    nextResident: 1,
    background: [],
  };
  const family = s.expansion.family;
  for (let i = 0; i < 6; i++) {
    const first = reserveResident(s, i, day - (27 + i * 2) * YEAR);
    const second = reserveResident(s, i + 2, day - (26 + i * 2) * YEAR);
    family.background.push({
      id: `family-household:${i + 1}`,
      region: CITIES[i % CITIES.length],
      residents: [first, second],
      ancestors: [],
      cash: 2100 + i * 370,
      arrears: 0,
      lastBirth: day - i * 45,
      deaths: 0,
      births: 0,
      earnings: 0,
      expenses: 0,
    });
  }
}

export function familyCanAct(s) {
  if (!s.expansion) return true;
  return alive(select(s.expansion.family, s.expansion.playerId));
}

export function familyIsRetired(s) {
  return s.expansion ? select(s.expansion.family, s.expansion.playerId).retired : false;
}

export function familyBlocksRomance(s, npcId) {
  if (!s.expansion) return false;
  const { family, playerId } = s.expansion;
  const player = select(family, playerId);
  return isDescendant(family, player, `npc:${npcId}`);
}

function event(s, api, type, subject, detail) {
  api.expansionEvent(s, type, subject, detail);
  api.log(s, detail);
}

function familyName(s, id) {
  const index = entropy(s.seed, id) % NAMES.length;
  const existing = new Set(s.expansion.family.people.map((p) => p.name));
  for (let i = 0; i < NAMES.length; i++) {
    const next = NAMES[(index + i) % NAMES.length];
    if (!existing.has(next)) return next;
  }
  return `${NAMES[index]} ${id.slice(7)}`;
}

function addChild(s, api, parentIds, adopted) {
  const family = s.expansion.family;
  const id = `family:${family.nextPerson++}`;
  const child = newPerson(s, id, familyName(s, id), dayOf(s) - (adopted ? 3 * YEAR : 0), parentIds);
  family.people.push(child);
  family.lastFamilyDay = dayOf(s);
  event(
    s,
    api,
    adopted ? "family-adoption" : "family-birth",
    child.id,
    adopted
      ? `${child.name} evlat edinildi ve aileye katıldı.`
      : `${child.name} doğdu ve aileye katıldı.`,
  );
  return child;
}

function severUnion(s, union, api, status) {
  if (!union) return;
  union.status = status;
  union.changed = dayOf(s);
  const other = select(s.expansion.family, union.second);
  if (s.flags.partner === other?.npcId) delete s.flags.partner;
  if (s.life.household?.memberId === other?.npcId) api.closeHousehold(s, "Aile birliği sona erdi");
}

export function afterFamilyAction(s, actionId, api) {
  if (!s.expansion || !actionId.startsWith("breakup:")) return;
  const union = activeUnion(s.expansion.family, s.expansion.playerId);
  if (!union || union.status !== "married") return;
  if (union.second !== `npc:${actionId.slice("breakup:".length)}`) return;
  severUnion(s, union, api, "separated");
  event(
    s,
    api,
    "family-separation",
    union.id,
    "Eşler ayrıldı. Evlilik kaydı ve çocukların bağları korunuyor.",
  );
}

function tickBackground(s, api, day) {
  const family = s.expansion.family;
  if ((day - 1) % 7 !== 0) return;
  for (const [i, home] of family.background.entries()) {
    const before = home.residents.length;
    home.residents = home.residents.filter((person) => {
      if (day - person.born < YEAR * person.lifespan) return true;
      home.ancestors.push({ id: person.id, born: person.born, died: day });
      home.deaths++;
      api.expansionEvent(s, "family-npc-loss", person.id, `${person.name} hayatını kaybetti.`);
      return false;
    });
    // Fills a vacant household through real settlement, keeping the population bounded.
    const adults = home.residents.filter((person) => day - person.born >= YEAR * ADULT);
    if (adults.length === 0) {
      home.residents.push(reserveResident(s, i, day - YEAR * (23 + i)));
      api.expansionEvent(
        s,
        "family-npc-household",
        home.id,
        "Boşalan haneye yeni bir yetişkin yerleşti.",
      );
    }
    const workers = home.residents.filter(
      (person) => day - person.born >= YEAR * ADULT && day - person.born < YEAR * 66,
    );
    const retirees = home.residents.filter((person) => day - person.born >= YEAR * 66);
    const demand = s.expansion.world?.regions?.[home.region]?.employment ?? 100;
    const earned =
      Math.floor(
        (workers.reduce((sum, person) => sum + 260 + person.skill * 4, 0) *
          Math.min(125, Math.max(55, demand))) /
          100,
      ) +
      retirees.length * 260;
    const localPrice = s.expansion.world?.regions?.[home.region]?.price ?? 100;
    const expense = Math.round(((360 + i * 34 + home.residents.length * 55) * localPrice) / 100);
    const income = Math.min(MAX_MONEY - home.cash, earned);
    home.cash += income;
    const paid = Math.min(home.cash, expense + home.arrears);
    home.cash -= paid;
    home.arrears = Math.min(MAX_MONEY, expense + home.arrears - paid);
    home.earnings = Math.min(MAX_MONEY, home.earnings + income);
    home.expenses = Math.min(MAX_MONEY, home.expenses + paid);
    if (home.residents.length < 2 && home.cash >= 1000) {
      home.residents.push(reserveResident(s, i + 1, day - YEAR * (23 + i)));
      api.expansionEvent(
        s,
        "family-npc-household",
        home.id,
        "Hane taşınma giderini karşılayınca yeni bir yetişkin katıldı.",
      );
      home.cash -= 300;
      home.expenses = Math.min(MAX_MONEY, home.expenses + 300);
    }
    const potentialParents = adults.filter(
      (person) => !person.parents.length && day - person.born < YEAR * 54,
    );
    if (
      home.residents.length < 4 &&
      potentialParents.length >= 2 &&
      day - home.lastBirth >= YEAR * 3 &&
      home.cash >= 2600 &&
      home.arrears === 0 &&
      before === home.residents.length
    ) {
      home.cash -= 400;
      home.expenses = Math.min(MAX_MONEY, home.expenses + 400);
      home.residents.push(
        reserveResident(
          s,
          i,
          day,
          potentialParents.slice(0, 2).map((person) => person.id),
        ),
      );
      home.lastBirth = day;
      home.births++;
      api.expansionEvent(
        s,
        "family-npc-birth",
        home.id,
        "Maddi hazırlığı tamamlayan haneye bir çocuk katıldı.",
      );
    }
    const referenced = new Set(home.residents.flatMap((person) => person.parents));
    home.ancestors = home.ancestors.filter((person) => referenced.has(person.id));
  }
}

function settleFamilyCosts(s, api, children, day) {
  const family = s.expansion.family;
  if (!children.length || (day - 1) % YEAR !== 0) return;
  const expenses = children.reduce((sum, person) => sum + 160 + ageAt(person, day) * 12, 0);
  const localPrice =
    familyRegion(s) === "istanbul"
      ? s.world.priceIndex
      : s.expansion.world.regions[familyRegion(s)].price / 100;
  const needed = Math.round(expenses * Math.min(2, Math.max(0.7, localPrice)));
  const fromReserve = Math.min(family.reserve, needed);
  family.reserve -= fromReserve;
  if (fromReserve) api.record(s, "Çocuk bakımı · aile bütçesi", -fromReserve, "household");
  const fromPlayer = Math.min(cash(s), needed - fromReserve);
  if (fromPlayer) api.spend(s, fromPlayer, "Çocuk bakımı ve okul gideri", "total");
  const unpaid = needed - fromReserve - fromPlayer;
  if (!unpaid) return;
  family.arrears = Math.min(MAX_MONEY, family.arrears + unpaid);
  for (const person of children) person.care = cap(person.care - 8);
  event(
    s,
    api,
    "family-arrears",
    s.expansion.playerId,
    `Çocuk giderinden ${unpaid} TL aile borcuna eklendi.`,
  );
}

export function tickFamily(s, api) {
  const family = s.expansion.family;
  const day = dayOf(s);
  if (family.lastDay >= day) return;
  family.lastDay = day;
  if (family.lastEstate) family.lastEstate.workDays ??= s.flags.workDays;
  for (const person of family.people) {
    // The Gold roster is still authoritative for its authored adult NPCs.
    if (person.npcId || !alive(person)) continue;
    const age = ageAt(person, day);
    if (age >= person.lifespan) {
      if (person.id === s.expansion.playerId) {
        api.settleCareer(s);
        severUnion(s, activeUnion(family, person.id), api, "widowed");
      }
      person.died = day;
      event(s, api, "family-loss", person.id, `${person.name}, ${age} yaşında hayatını kaybetti.`);
      continue;
    }
    if ((day - person.born) % YEAR !== 0) continue;
    if (age === ADULT)
      event(s, api, "family-adult", person.id, `${person.name} yetişkinliğe ulaştı.`);
    if (age > 0 && age < ADULT)
      person.learning = cap(person.learning + (person.care >= 55 ? 2 : 1));
    if (person.id === s.expansion.playerId && age >= 68) api.change(s, { health: -2, energy: -3 });
  }
  if (family.expected && day >= family.expected.due) {
    addChild(s, api, family.expected.parents, false);
    family.expected = null;
  }
  const player = select(family, s.expansion.playerId);
  if (alive(player) && player.retired && (day - 1) % YEAR === 0) {
    const worked = s.flags.workDays - (family.lastEstate?.workDays ?? 0);
    const pension = Math.min(1900, 650 + Math.floor(worked / 4) * 10);
    api.receive(s, pension, "Emekli aylığı", "bank");
  }
  settleFamilyCosts(s, api, dependentChildren(s), day);
  tickBackground(s, api, day);
}

function finishSuccession(s, id, api) {
  const family = s.expansion.family;
  const predecessor = select(family, s.expansion.playerId);
  const successor = select(family, id);
  if (s.life.household) api.closeHousehold(s, "Hanede kuşak değişti");
  delete s.flags.partner;
  for (const relation of Object.values(s.npcs)) relation.romance = 0;
  s.course = null;
  Object.assign(s.deep.career, {
    reputation: 20,
    employerJobId: null,
    negotiatedBonus: 0,
    negotiatedDay: 0,
    noticeDay: 0,
    lastReviewDay: 0,
  });
  for (const job of Object.keys(s.deep.career.experience)) s.deep.career.experience[job] = 0;
  s.player.name = successor.name;
  s.player.education =
    successor.learning >= 70
      ? "university"
      : successor.learning >= 40
        ? "vocational"
        : "highschool";
  for (const { id: skill } of SKILLS)
    s.player.skills[skill] =
      15 + Math.floor(successor.learning / 5) + (successor.focus === skill ? 16 : 0);
  Object.assign(s.player, { health: 92, energy: 85, hunger: 75, stress: 25 });
  // Capital, debts, leases and obligations are the same household estate.
  // Asset systems with personal ownership receive the same atomic handover.
  api.transferEstate?.(s, predecessor.id, successor.id);
  s.expansion.playerId = successor.id;
  family.generations++;
  family.lastEstate = {
    from: predecessor.id,
    to: successor.id,
    day: dayOf(s),
    cash: s.cash,
    bank: s.bank,
    debt: s.debt,
    workDays: s.flags.workDays,
  };
  family.lastSupportDay = null;
  family.lastFamilyDay = dayOf(s);
  event(
    s,
    api,
    "family-succession",
    successor.id,
    `${successor.name} aile mirasını ve borçlarını devraldı.`,
  );
}

function isDescendant(family, person, root) {
  const pending = person.parents.slice(),
    seen = new Set();
  while (pending.length) {
    const id = pending.pop();
    if (id === root) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    pending.push(...(select(family, id)?.parents ?? []));
  }
  return false;
}

const COPY = {
  marry: [
    "Evlen",
    "Birliği resmileştir. Kira ve borçlar sürer.",
    "Marry",
    "Formalize the union. Leases and debts remain.",
    "Zawrzyj małżeństwo",
    "Sformalizuj związek. Najem i długi pozostają.",
  ],
  separate: [
    "Ayrı yaşamaya başla",
    "Ortak evi kapat. Aile geçmişi ve ebeveynlik korunur.",
    "Separate",
    "End shared housing; family history and parentage remain.",
    "Rozpocznij separację",
    "Zakończ wspólne mieszkanie. Historia i pokrewieństwo pozostają.",
  ],
  divorce: [
    "Boşanmayı tamamla",
    "Boşan; aile borçları ve çocuk bakımı sürer.",
    "Finalize divorce",
    "Divorce; family debts and childcare remain.",
    "Zakończ rozwód",
    "Rozwód; długi i opieka pozostają.",
  ],
  reconcile: [
    "Barışmayı teklif et",
    "Güven ve yakınlıkla birliği yeniden kur.",
    "Reconcile",
    "Reunite after rebuilding trust and closeness.",
    "Zaproponuj pojednanie",
    "Odnów związek po odzyskaniu zaufania i bliskości.",
  ],
  plan: [
    "Çocuk için hazırlan",
    "Ortak karar; 24 gün hazırlık. Bakım bütçeyi etkiler.",
    "Plan for a child",
    "Joint decision; 24 days preparation. Childcare costs money.",
    "Zaplanuj dziecko",
    "Wspólna decyzja, 24 dni przygotowań. Opieka kosztuje.",
  ],
  adopt: [
    "Evlat edinme başvurusu",
    "Güvenli ev ve aile giderlerine yetecek para gerekir.",
    "Apply to adopt",
    "Requires secure housing and funds for family costs.",
    "Złóż wniosek o adopcję",
    "Potrzebne bezpieczne mieszkanie i środki na rodzinę.",
  ],
  reserve: [
    "Aile bütçesine 250 TL ayır",
    "Paranı bakım hesabına aktar; çocuk giderleri önce buradan ödenir.",
    "Set aside ₺250 for family",
    "Transfer money to the reserve; childcare draws on it first.",
    "Odłóż 250 TL na rodzinę",
    "Przenieś środki do rezerwy na opiekę w pierwszej kolejności.",
  ],
  arrears: [
    "Aile borcunu öde",
    "Bakım borcunun bir bölümünü öde.",
    "Pay family arrears",
    "Pay part of the childcare arrears.",
    "Spłać zaległości rodzinne",
    "Spłać część zaległości za opiekę.",
  ],
  retire: [
    "Emekli ol",
    "Birikmiş ücret ödenir; emekli aylığı 30 günde bir yatar.",
    "Retire",
    "Wages are paid; pension is deposited every 30 days.",
    "Przejdź na emeryturę",
    "Wypłata zostanie rozliczona; emerytura wpływa co 30 dni.",
  ],
  support: [
    "Yakınını destekle",
    "Yakınına zaman ayır; destek güven ve esenliği artırır.",
    "Support a relative",
    "Time with a relative strengthens support and wellbeing.",
    "Wesprzyj krewnego",
    "Czas z krewnym wzmacnia więzi i samopoczucie.",
  ],
  care: [
    "Çocuğa zaman ayır",
    "Bakım ve ilgi esenliği artırır.",
    "Spend time with a child",
    "Care and attention improve wellbeing.",
    "Spędź czas z dzieckiem",
    "Opieka i uwaga poprawiają samopoczucie.",
  ],
  focus: [
    "Eğitim yönünü geliştir",
    "Uygulama ve eğitim gelecekteki becerileri etkiler.",
    "Develop education",
    "Practice and education affect future skills.",
    "Rozwijaj edukację",
    "Praktyka i nauka kształtują przyszłe umiejętności.",
  ],
  successor: [
    "Hayatı devral",
    "Aynı dünyada hane varlıklarını ve borçlarını devral.",
    "Continue this life",
    "Continue in the same world; inherit household assets and debts.",
    "Kontynuuj życie",
    "Kontynuuj w tym świecie, dziedzicząc majątek i długi.",
  ],
};
const FOCUS_LABELS = {
  knowledge: ["Bilgi", "Knowledge", "Wiedza"],
  craft: ["Zanaat", "Craft", "Rzemiosło"],
  technical: ["Teknoloji", "Technology", "Technologia"],
  communication: ["İletişim", "Communication", "Komunikacja"],
};
const REASONS = {
  relationship: [
    "Yakınlık ve karşılıklı güven gerekli.",
    "Requires a close and trusting relationship.",
    "Wymagana jest bliskość i wzajemne zaufanie.",
  ],
  space: [
    "Güvenli ve uygun bir ev gerekir.",
    "Establish suitable, secure housing first.",
    "Najpierw zapewnij bezpieczne i odpowiednie mieszkanie.",
  ],
  custody: [
    "Başka bir çocuk planı veya bakım sorumluluğu var.",
    "A child plan or care commitment already exists.",
    "Istnieje już plan dziecka lub obowiązek opieki.",
  ],
  cooldown: [
    "Bunun için biraz daha bekle.",
    "Wait a little longer before doing this.",
    "Odczekaj jeszcze trochę.",
  ],
  finances: [
    "Yeterli bakiye ve ödenmiş aile giderleri gerekir.",
    "Requires funds and settled family bills.",
    "Potrzebne środki i opłacone rachunki.",
  ],
  age: [
    "Yaş koşulu henüz sağlanmıyor.",
    "The age requirement is not met.",
    "Warunek wieku nie został spełniony.",
  ],
};

export function translateFamilyAction(action, language) {
  const copy = COPY[action.familyCopy];
  if (!copy) return action;
  const index = language === "en" ? 1 : language === "pl" ? 2 : 0;
  const suffix = [action.familyName, FOCUS_LABELS[action.familyFocus]?.[index]]
    .filter(Boolean)
    .join(" · ");
  const label = suffix ? `${suffix} · ${copy[index * 2]}` : copy[index * 2];
  return {
    ...action,
    label,
    description: copy[index * 2 + 1],
    reason: REASONS[action.familyReason]?.[index] || "",
  };
}

export function familyActions(s, api) {
  if (!s.expansion) return [];
  const family = s.expansion.family;
  const player = select(family, s.expansion.playerId);
  const day = dayOf(s);
  const actions = [];
  function add(key, { id = key, minutes = 30, cost = 0, reason = "", name, focus, run }) {
    actions.push(
      translateFamilyAction(
        {
          id: `family:${id}`,
          category: "life",
          minutes,
          cost,
          pay: "total",
          disabled: Boolean(reason),
          familyCopy: key,
          familyReason: reason,
          familyName: name,
          familyFocus: focus,
          run,
        },
        "tr",
      ),
    );
  }
  if (!alive(player)) {
    const adultKin = family.people.filter(
      (person) =>
        alive(person) &&
        !person.npcId &&
        ageAt(person, day) >= ADULT &&
        (isDescendant(family, person, player.id) ||
          player.parents.some((id) => person.parents.includes(id))),
    );
    for (const person of adultKin)
      add("successor", {
        id: `successor:${person.id}`,
        minutes: 0,
        name: person.name,
        run: (next) => {
          finishSuccession(next, person.id, api);
          return `${person.name} ile aynı dünyada devam ediyorsun.`;
        },
      });
    return actions;
  }
  const age = ageAt(player, day);
  const union = activeUnion(family, player.id);
  const spouse = union && select(family, union.second);
  const partner = s.flags.partner;
  const known = partner && s.npcs[partner];
  const stable = s.housing.id !== "shelter" && s.housing.arrears === 0;
  const householdFits = !s.life.household || s.life.household.memberId === partner;
  const solid = known && known.trust >= 60 && known.affinity >= 65;
  const children = dependentChildren(s);
  const suitable = stable && children.length < 3 && householdFits;
  const ready =
    suitable &&
    !family.arrears &&
    (family.lastFamilyDay === null || day - family.lastFamilyDay >= YEAR);
  if (!union && known && !familyBlocksRomance(s, partner))
    add("marry", {
      cost: 350,
      minutes: 90,
      name: nameOf(partner),
      reason:
        !stable || !householdFits
          ? "space"
          : !solid
            ? "relationship"
            : family.unions.length >= 256 ||
                (!select(family, `npc:${partner}`) &&
                  family.people.length + Number(Boolean(family.expected)) >= MAX_PEOPLE)
              ? "custody"
              : "",
      run(next) {
        const f = next.expansion.family;
        const npcId = `npc:${partner}`;
        if (!select(f, npcId))
          f.people.push(
            newPerson(
              next,
              npcId,
              nameOf(partner),
              day - (27 + (entropy(s.seed, partner) % 9)) * YEAR,
              [],
              partner,
            ),
          );
        const id = `union:${next.revision}`;
        f.unions.push({
          id,
          first: player.id,
          second: npcId,
          status: "married",
          since: day,
          changed: day,
        });
        event(next, api, "family-marriage", id, `${player.name} ve ${nameOf(partner)} evlendi.`);
        return "Evlilik başladı. Ayrı ve ortak bakiyeler kayıtta korunuyor.";
      },
    });
  if (union?.status === "married")
    add("separate", {
      name: spouse.name,
      run(next) {
        const current = activeUnion(next.expansion.family, player.id);
        severUnion(next, current, api, "separated");
        api.change(next, { stress: 8 });
        event(
          next,
          api,
          "family-separation",
          current.id,
          `${player.name} ve ${spouse.name} ayrı yaşamaya başladı.`,
        );
        return "Ortak ev sözleşmesi kapandı, çocukların aile bağları korunuyor.";
      },
    });
  if (union?.status === "separated") {
    add("divorce", {
      name: spouse.name,
      cost: 250,
      minutes: 45,
      reason: day - union.changed < 7 ? "cooldown" : "",
      run(next) {
        const current = activeUnion(next.expansion.family, player.id);
        severUnion(next, current, api, "divorced");
        event(
          next,
          api,
          "family-separation",
          current.id,
          `${player.name} ve ${spouse.name} boşandı.`,
        );
        return "Boşanma kaydedildi.";
      },
    });
    const relation = s.npcs[spouse.npcId];
    add("reconcile", {
      name: spouse.name,
      minutes: 75,
      reason:
        day - union.changed < 7
          ? "cooldown"
          : !stable || (s.life.household && s.life.household.memberId !== spouse.npcId)
            ? "space"
            : (partner && partner !== spouse.npcId) || relation.trust < 60 || relation.affinity < 60
              ? "relationship"
              : "",
      run(next) {
        const current = activeUnion(next.expansion.family, player.id);
        current.status = "married";
        current.changed = day;
        next.flags.partner = spouse.npcId;
        event(
          next,
          api,
          "family-marriage",
          current.id,
          `${player.name} ve ${spouse.name} barıştı.`,
        );
        return "Aile birliği yeniden kuruldu.";
      },
    });
  }
  const space = family.people.length < MAX_PEOPLE;
  if (union?.status === "married")
    add("plan", {
      cost: 600,
      minutes: 60,
      reason:
        age > 52
          ? "age"
          : !space || family.expected || children.length >= 3
            ? "custody"
            : !suitable
              ? "space"
              : !solid
                ? "relationship"
                : !ready
                  ? "finances"
                  : "",
      run(next) {
        next.expansion.family.expected = { parents: [player.id, spouse.id], due: day + 24 };
        return "Aile planı başladı. 24 oyun günü sonra çocuk haneye katılacak.";
      },
    });
  add("adopt", {
    cost: 900,
    minutes: 120,
    reason:
      age < 23 || age > 62
        ? "age"
        : !space || family.expected || children.length >= 3
          ? "custody"
          : !suitable
            ? "space"
            : !ready || cash(s) < 1800
              ? "finances"
              : "",
    run(next) {
      const parents = union?.status === "married" ? [player.id, spouse.id] : [player.id];
      const child = addChild(next, api, parents, true);
      return `${child.name} ile tanıştın. Okul ve bakım seçenekleri artık aile ekranında.`;
    },
  });
  add("reserve", {
    cost: 250,
    minutes: 0,
    reason: family.reserve > MAX_MONEY - 250 ? "finances" : "",
    run(next) {
      next.expansion.family.reserve += 250;
      return "250 TL aile bütçesine ayrıldı.";
    },
  });
  if (family.arrears)
    add("arrears", {
      cost: Math.min(600, family.arrears),
      minutes: 15,
      run(next) {
        next.expansion.family.arrears -= Math.min(600, next.expansion.family.arrears);
        return "Ödenmemiş aile giderinin bir bölümü kapatıldı.";
      },
    });
  if (!player.retired)
    add("retire", {
      reason: age < 62 ? "age" : "",
      minutes: 30,
      run(next) {
        const current = select(next.expansion.family, player.id);
        api.settleCareer(next);
        current.retired = true;
        event(next, api, "family-retirement", current.id, `${current.name} emekli oldu.`);
        return "Emeklilik başladı. Aylık ödemeler banka hesabına yatırılacak.";
      },
    });
  for (const person of children) {
    const childAge = ageAt(person, day);
    add("care", {
      id: `care:${person.id}`,
      minutes: 60,
      name: person.name,
      reason: person.lastCare !== null && day - person.lastCare < 3 ? "cooldown" : "",
      run(next) {
        const child = select(next.expansion.family, person.id);
        child.lastCare = day;
        child.care = cap(child.care + 8);
        api.change(next, { energy: -4, stress: -3 });
        return `${child.name} ile zaman geçirdin. Aile bağı güçlendi.`;
      },
    });
    if (childAge >= 6)
      for (const focus of FOCUSES)
        add("focus", {
          id: `focus:${person.id}:${focus}`,
          focus,
          name: person.name,
          minutes: 90,
          cost: 120,
          reason: person.lastCare !== null && day - person.lastCare < 3 ? "cooldown" : "",
          run(next) {
            const child = select(next.expansion.family, person.id);
            child.lastCare = day;
            child.learning = cap(child.learning + 3);
            child.focus = focus;
            return `${child.name} seçtiği eğitim alanında ilerledi.`;
          },
        });
  }
  const relative = family.people.find(
    (person) => alive(person) && player.parents.includes(person.id),
  );
  if (relative)
    add("support", {
      id: `support:${relative.id}`,
      name: relative.name,
      minutes: 60,
      reason: family.lastSupportDay !== null && day - family.lastSupportDay < 7 ? "cooldown" : "",
      run(next) {
        next.expansion.family.lastSupportDay = day;
        const member = select(next.expansion.family, relative.id);
        member.care = cap(member.care + 6);
        api.change(next, { stress: -6 });
        return `${member.name} ile zaman geçirip aile desteğini güçlendirdin.`;
      },
    });
  return actions;
}

export function familyView(s) {
  if (!s.expansion) return null;
  const f = s.expansion.family,
    day = dayOf(s),
    playerId = s.expansion.playerId;
  const union = activeUnion(f, playerId);
  return {
    player: publicPerson(select(f, playerId), day),
    people: f.people.map((person) => publicPerson(person, day)),
    unions: f.unions.map((union) => ({ ...union })),
    household: {
      region: familyRegion(s),
      residence: HOMES.find((home) => home.id === s.housing.id)?.name,
      roommate: nameOf(s.life.household?.memberId) ?? null,
      partner: union ? select(f, union.second).name : null,
      children: dependentChildren(s).map((person) => publicPerson(person, day)),
      reserve: f.reserve,
      arrears: f.arrears,
      expectedDay: f.expected?.due ?? null,
    },
    lastEstate: f.lastEstate && { ...f.lastEstate },
    generations: f.generations,
    yearsInDays: YEAR,
    background: f.background.map((home) => ({
      region: home.region,
      size: home.residents.length,
      births: home.births,
      deaths: home.deaths,
      cash: home.cash,
      arrears: home.arrears,
    })),
  };
}

export function validateFamily(s) {
  if (!s.expansion) return true;
  const f = s.expansion.family,
    day = dayOf(s),
    active = s.expansion.playerId;
  const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
  const validResidentId = (entry, upper) =>
    typeof entry === "string" &&
    /^resident:[1-9]\d*$/.test(entry) &&
    Number(entry.slice(9)) < upper;
  const int = (value, low, high) => Number.isSafeInteger(value) && value >= low && value <= high;
  const money = (value) => int(value, 0, MAX_MONEY);
  const legalName = (value) => typeof value === "string" && value.trim() && value.length <= 36;
  const bounded = (array, limit) => Array.isArray(array) && array.length <= limit;
  const unique = (array) => new Set(array).size === array.length;
  if (
    !shape(f, {
      nextPerson: [3, 100000],
      nextResident: [13, 1000000],
      lastDay: [1, day],
      generations: [1, MAX_PEOPLE],
      "reserve arrears": MAX_MONEY,
      "lastSupportDay lastFamilyDay": [1, day, true],
    }) ||
    !bounded(f.people, MAX_PEOPLE) ||
    !bounded(f.unions, 256) ||
    !bounded(f.background, 6) ||
    f.background.length !== 6
  )
    return false;
  const ids = new Map();
  for (const person of f.people) {
    if (
      !shape(person, {
        born: [-10000, day],
        "died lastCare": [1, day, true],
        lifespan: [75, 90],
        "care learning": 100,
        focus: FOCUSES.join(" "),
        retired: true,
      }) ||
      typeof person.id !== "string" ||
      ids.has(person.id) ||
      !legalName(person.name) ||
      (person.died !== null && person.died < Math.max(1, person.born)) ||
      !bounded(person.parents, 2) ||
      !unique(person.parents) ||
      (person.retired && ageAt(person, day) < 62)
    )
      return false;
    if (person.npcId !== null) {
      if (
        person.id !== `npc:${person.npcId}` ||
        nameOf(person.npcId) !== person.name ||
        person.parents.length ||
        person.died !== null ||
        person.retired
      )
        return false;
    } else if (
      person.id !== "player:1" &&
      (!/^family:[1-9]\d*$/.test(person.id) || Number(person.id.slice(7)) >= f.nextPerson)
    )
      return false;
    ids.set(person.id, person);
  }
  if (
    !ids.has("player:1") ||
    !ids.has(active) ||
    ids.get(active).npcId ||
    ids.get(active).name !== s.player.name ||
    ageAt(ids.get(active), day) < ADULT
  )
    return false;
  for (const person of f.people)
    for (const id of person.parents) {
      const parent = ids.get(id);
      if (
        !parent ||
        person.born - parent.born < ADULT * YEAR ||
        (parent.died !== null && person.born - parent.died > 24)
      )
        return false;
    }
  const unions = new Set(),
    occupied = new Set();
  for (const union of f.unions) {
    const first = ids.get(union?.first),
      second = ids.get(union?.second);
    if (
      !first ||
      !second ||
      first.npcId ||
      !second.npcId ||
      first.id === second.id ||
      typeof union.id !== "string" ||
      !/^union:[1-9]\d*$/.test(union.id) ||
      unions.has(union.id) ||
      !shape(union, {
        status: UNION_STATUS.join(" "),
        since: [1, day],
        changed: [union.since, day],
      }) ||
      ageAt(first, union.since) < ADULT ||
      ageAt(second, union.since) < ADULT
    )
      return false;
    unions.add(union.id);
    if (["married", "separated"].includes(union.status)) {
      if (!alive(first) || occupied.has(first.id) || occupied.has(second.id)) return false;
      occupied.add(first.id);
      occupied.add(second.id);
    }
  }
  if (f.expected !== null) {
    if (
      !object(f.expected) ||
      !bounded(f.expected.parents, 2) ||
      f.expected.parents.length !== 2 ||
      !unique(f.expected.parents) ||
      f.people.length >= MAX_PEOPLE ||
      !int(f.expected.due, day + 1, day + 24) ||
      f.expected.parents.some((id) => !ids.has(id))
    )
      return false;
  }
  if (
    f.lastEstate !== null &&
    (!object(f.lastEstate) ||
      f.lastEstate.from === f.lastEstate.to ||
      !ids.has(f.lastEstate.from) ||
      f.lastEstate.to !== active ||
      ids.get(f.lastEstate.from).died === null ||
      !int(f.lastEstate.day, ids.get(f.lastEstate.from).died, day) ||
      !["cash", "bank", "debt"].every((key) => money(f.lastEstate[key])) ||
      (Object.hasOwn(f.lastEstate, "workDays") && !int(f.lastEstate.workDays, 0, s.flags.workDays)))
  )
    return false;
  const houses = new Set(),
    residents = new Set();
  for (const home of f.background) {
    if (
      !shape(home, {
        region: CITIES.join(" "),
        lastBirth: [-3000, day],
        "cash arrears earnings expenses births deaths": MAX_MONEY,
      }) ||
      typeof home.id !== "string" ||
      !/^family-household:[1-6]$/.test(home.id) ||
      houses.has(home.id) ||
      !bounded(home.residents, 4) ||
      !home.residents.length ||
      !bounded(home.ancestors, 8)
    )
      return false;
    houses.add(home.id);
    const ancestry = new Map();
    for (const ancestor of home.ancestors) {
      if (
        !shape(ancestor, { born: [-10000, day] }) ||
        !int(ancestor.died, Math.max(1, ancestor.born + 72 * YEAR), day) ||
        !validResidentId(ancestor.id, f.nextResident) ||
        residents.has(ancestor.id) ||
        !home.residents.some(
          (person) => Array.isArray(person?.parents) && person.parents.includes(ancestor.id),
        )
      )
        return false;
      ancestry.set(ancestor.id, ancestor);
      residents.add(ancestor.id);
    }
    for (const resident of home.residents) {
      if (
        !shape(resident, { born: [-10000, day], lifespan: [72, 86], skill: 100 }) ||
        !validResidentId(resident.id, f.nextResident) ||
        residents.has(resident.id) ||
        !legalName(resident.name) ||
        !bounded(resident.parents, 2) ||
        !unique(resident.parents) ||
        resident.parents.some((id) => {
          const parent = ancestry.get(id) ?? home.residents.find((item) => item?.id === id);
          return (
            !parent ||
            !validResidentId(id, Number(resident.id.slice(9))) ||
            resident.born - parent.born < ADULT * YEAR ||
            (parent.died && resident.born > parent.died)
          );
        })
      )
        return false;
      residents.add(resident.id);
    }
  }
  return true;
}
