/** TC SIM Wave 4 max-content. Catalog + scheduling only; life-depth math stays frozen. */
import { economyCausality, ensureLifeDepthState, getLifePhase } from "./life-depth.js?v=10";
import { addNpcMemory } from "./state.js?v=10";
import { hasNpcMemory } from "./social.js?v=10";

const cap = (rows, n) => (Array.isArray(rows) ? rows.slice(-n) : []);
const unique = (rows, key = (row) => row.id) => {
  const seen = new Set();
  return rows.filter((row) => row && !seen.has(key(row)) && seen.add(key(row)));
};
const hash = (seed, value) => {
  let x = (Number(seed) || 12345) >>> 0;
  for (const c of String(value)) x = Math.imul(x ^ c.charCodeAt(0), 16777619) >>> 0;
  return x >>> 0;
};

export const EXCLUSIVE_PAIRS = {
  "commute-path": ["metro", "car"],
  "education-vs-job": ["kurs", "mesai"],
  "nikah-timing": ["evlen", "bekle"],
  "career-fork": ["yurtdisi", "yerel"],
  "work-form": ["freelance", "kadrolu"],
  "housing-near": ["aile", "is"],
  "side-income": ["esnaf", "kamu"],
  "child-care": ["kres", "anne"],
  "health-path": ["randevu", "idare"],
  "social-circle": ["mahalle", "is"],
  "crisis-response": ["aile", "yalniz"],
  "wedding-path": ["git", "skip"],
  "late-work": ["consult", "leave"],
  "late-home": ["downsize", "stay"],
  "late-family": ["near", "independent"],
  "late-circle": ["club", "home"],
};

export const ACTOR_VOICES = {
  anne: {
    rhythm: "kısa cümle, soru yok",
    money: "hesabı yüksek sesle yapar",
    crisis: "önce yemek koyar, sonra konuşur",
    line: ["Kızım bak, baban karışmaz ama ben karışırım.", "Listen: your father will not interfere, I will."],
  },
  baba: {
    rhythm: "tek satır, 'bak' ile başlar",
    money: "borcu utanç sayar, sormaz",
    crisis: "sigara yakar, cümleyi yarım bırakır",
    line: ["Bak, ben karışmam. Karışmazsam da duyarım.", "Look, I stay out of it. Staying out is not the same as not hearing."],
  },
  mehmet: {
    rhythm: "kanka, rakam, nokta yok",
    money: "borcu şaka gibi açar, ikinci kez ciddi",
    crisis: "ara, gel, silme",
    line: ["kanka rakam net. şaka değil bu sefer.", "kanka the number is clear. not a joke this time."],
  },
  elif: {
    rhythm: "tam cümle, emoji yok",
    money: "hesabı konuşur, utandırmaz",
    crisis: "mesafeyi takvimle ölçer",
    line: ["Takvim değil, ayırdığın zaman konuşuyor.", "It is not the calendar. It is the time you did not set aside."],
  },
  burak: {
    rhythm: "iş-typo, ı harfi yok",
    money: "maaşı 'paket' diye anar",
    crisis: "ailene karışmam, işine karışırım",
    line: ["bu maili iletme. ciddili.", "do not forward this mail. serious."],
  },
  kardes: {
    rhythm: "küçük harf, gurur, ikinci ricayı yutma",
    money: "ister, sonra inkar eder",
    crisis: "kapı çalar, özür etmez",
    line: ["zaten bir kere sordum. ikinciyi sormam.", "i already asked once. i will not ask twice."],
  },
  selin: {
    rhythm: "uzun mesaj, fazla nokta",
    money: "borcu borç diye koyar, şaka yapmaz",
    crisis: "önce çözüm satırı, sonra sitem",
    line: ["Kuzenim bu ay yetiştiremedim. Konuşalım.", "Cousin, I could not make it this month. Let's talk."],
  },
};

function bag(state) {
  if (!state.flags.lifeContent || typeof state.flags.lifeContent !== "object") {
    state.flags.lifeContent = { chains: {}, exclusive: {}, once: {}, waiting: [] };
  }
  const raw = state.flags.lifeContent;
  raw.chains = raw.chains && typeof raw.chains === "object" ? raw.chains : {};
  raw.exclusive = raw.exclusive && typeof raw.exclusive === "object" ? raw.exclusive : {};
  raw.once = raw.once && typeof raw.once === "object" ? raw.once : {};
  const waiting = Array.isArray(raw.waiting) ? raw.waiting : [];
  const seenWaiting = new Set();
  raw.waiting = waiting
    .filter((row) => {
      if (!row || typeof row !== "object") return false;
      if (typeof row.id !== "string" || !row.id.startsWith("lc:")) return false;
      if (typeof row.eventId !== "string" || !row.eventId.startsWith("lc_")) return false;
      if (!Number.isFinite(Number(row.dueWeek))) return false;
      if (seenWaiting.has(row.id) || seenWaiting.has(`event:${row.eventId}`)) return false;
      if (raw.once[`resolved:${row.id}`]) return false;
      seenWaiting.add(row.id);
      seenWaiting.add(`event:${row.eventId}`);
      row.dueWeek = Math.max(0, Math.trunc(Number(row.dueWeek)));
      row.actorId = typeof row.actorId === "string" ? row.actorId : null;
      row.expectedPartnerId = typeof row.expectedPartnerId === "string" ? row.expectedPartnerId : null;
      row.expectedJobId = typeof row.expectedJobId === "string" ? row.expectedJobId : null;
      row.expectedHomeId = typeof row.expectedHomeId === "string" ? row.expectedHomeId : null;
      row.expectedNoPartner = row.expectedNoPartner === true;
      row.requiresAdultChild = row.requiresAdultChild === true;
      return true;
    })
    .sort((a, b) => a.dueWeek - b.dueWeek || a.id.localeCompare(b.id))
    .slice(0, 12);
  raw.arcCounts = raw.arcCounts && typeof raw.arcCounts === "object" ? raw.arcCounts : {};
  raw.arcLastWeek = raw.arcLastWeek && typeof raw.arcLastWeek === "object" ? raw.arcLastWeek : {};
  return raw;
}

export function shownBranch(state, family) {
  const taken = bag(state).exclusive[family];
  if (taken) return taken;
  const branches = EXCLUSIVE_PAIRS[family];
  if (!branches?.length) return null;
  return branches[(hash(state.meta?.rngState || state.meta?.seed || 1, `ex:${family}`) >>> 8) % branches.length];
}

function stageOf(state, chainId) {
  return Number(bag(state).chains[chainId]) || 0;
}

// "Is this actor in the player's life right now", the same test social.js,
// state.js and the life-echo events already apply. Existence alone is not
// enough: the roster slot survives death (continueGeneration keeps "baba" and
// marks it deceased as the previous player) and survives an absent parent
// (network.js sets available=false), so an id check alone let content address
// people who are dead or gone while every other subsystem refused to.
function personOk(state, id) {
  const person = (state.people || []).find((row) => row.id === id);
  return Boolean(person) && person.deceased !== true && person.available !== false;
}

function hasChild(state) {
  return (state.parenthood?.children || []).some((row) => row.alive !== false);
}

function hasAdultChild(state) {
  const week = Number(state.time?.absoluteWeek) || 0;
  return (state.parenthood?.children || []).some((row) =>
    row?.alive !== false && Number.isFinite(Number(row.bornWeek)) && week - Number(row.bornWeek) >= 18 * 48,
  );
}

function partnerId(state) {
  return state.social?.currentPartnerNpcId || null;
}

function isRetired(state) {
  return state.career?.retirement?.status === "retired";
}

function organicOk(state, chain, node) {
  if (stageOf(state, chain.id) !== (node.needStage || 0)) return false;
  if (chain.exclusive && shownBranch(state, chain.exclusive) !== chain.branch) return false;
  if (node.minWeek && state.time.absoluteWeek < node.minWeek) return false;
  if (node.maxWeek && state.time.absoluteWeek > node.maxWeek) return false;
  if (node.minAge && state.player.age < node.minAge) return false;
  if (node.maxAge && state.player.age > node.maxAge) return false;
  if (node.needJob && !state.career?.jobId) return false;
  if (node.needRetired && !isRetired(state)) return false;
  if (node.notRetired && isRetired(state)) return false;
  if (node.needPartner && !partnerId(state)) return false;
  if (node.needNoPartner && partnerId(state)) return false;
  if (node.needChild && !hasChild(state)) return false;
  if (node.needAdultChild && !hasAdultChild(state)) return false;
  if (node.needArrears && !(Number(state.finances?.arrears) > 0)) return false;
  if (node.needHome && state.household?.homeId !== node.needHome) return false;
  if (node.notHome && state.household?.homeId === node.notHome) return false;
  if (node.minCommute && economyCausality(state).commute < node.minCommute) return false;
  if (node.minDebt && economyCausality(state).debt < node.minDebt) return false;
  if (node.phase && getLifePhase(state) !== node.phase) return false;
  if (node.familyType) {
    const ft = state.flags.familyType || state.player?.familyType;
    if (![].concat(node.familyType).includes(ft)) return false;
  }
  if (node.needActor && !personOk(state, node.needActor)) return false;
  if (node.needMemory && !hasNpcMemory(state, node.needMemory[0], node.needMemory[1])) return false;
  if (node.forbidMemory && hasNpcMemory(state, node.forbidMemory[0], node.forbidMemory[1])) return false;
  if (typeof node.if === "function" && !node.if(state)) return false;
  return true;
}

function choice(id, label, en, risk, effects, extra = {}) {
  return { id, label, risk, effects, en, ...extra };
}

function nodeToEvent(chain, node) {
  const choices = node.choices.map((row) => {
    const copy = { ...row };
    return copy;
  });
  return {
    id: node.id,
    lifeContent: true,
    organic: Boolean(node.organic),
    chain: chain.id,
    stage: node.stage,
    arc: node.arc || chain.arc,
    exclusive: chain.exclusive || null,
    branch: chain.branch || null,
    tags: [...new Set([...(chain.tags || []), ...(node.tags || [])])],
    repeat: node.repeat || (node.organic ? "once" : "repeatable"),
    cooldownWeeks: node.cooldownWeeks,
    title: node.title,
    text: node.text,
    en: {
      title: node.enTitle || node.title,
      text: node.enText || node.text,
      choices: Object.fromEntries(choices.map((row) => [row.id, row.en || row.label])),
    },
    condition: () => false,
    organicCheck: node.organic ? (state) => organicOk(state, chain, node) : null,
    choices: choices.map((row) => ({
      id: row.id,
      label: row.label,
      risk: row.risk,
      effects: row.effects || {},
      lifeNext: row.lifeNext || null,
      lifeStage: row.lifeStage,
      lifeLock: row.lifeLock,
      npcMemory: row.npcMemory || null,
      echo: row.echo || null,
      opportunity: row.opportunity || null,
      goal: row.goal || null,
    })),
  };
}

const CHAINS = [
  {
    id: "metro-shift", exclusive: "commute-path", branch: "metro", arc: "career",
    tags: ["career", "housing", "cross", "economy"],
    nodes: [
      {
        id: "lc_metro_offer", stage: 1, organic: true, minWeek: 10, needJob: true, minCommute: 1, maxAge: 42,
        tags: ["career", "housing", "phase-open"],
        title: "Karşı yakaya kadro",
        text: "Burak yazmış: 'kadıköy tarafı açıldı. paket iyi. yol uzun.' Metro haritası cebinde, ev hâlâ bu yakada.",
        enTitle: "A post on the other shore", enText: "Burak wrote: 'kadıköy side opened. package is fine. the road is long.' The metro map is in your pocket; the house is still on this shore.",
        choices: [
          choice("take", "Kabul et, yol uzasın", "Take it, let the road grow", "Ulaşım yükü artar; maaş kapısı açılır", { health: { energy: -6, stress: 4 }, memory: "Karşı yakadaki kadroyu kabul ettin." }, {
            lifeStage: 1, lifeLock: "metro",
            lifeNext: { eventId: "lc_metro_month", dueWeeks: 6, key: "metro-month" },
            npcMemory: { personId: "burak", text: "Karşı yakadaki kadroyu kabul etti.", type: "lc_metro_take" },
            echo: "Kadıköy hattı artık işin parçası.",
          }),
          choice("keep", "Bu yakada kal", "Stay on this shore", "Fırsat kapanır; yol kısa kalır", { health: { stress: 2 } }, { lifeStage: 9 }),
        ],
      },
      {
        id: "lc_metro_month", stage: 2,
        tags: ["health", "career", "cross"],
        title: "Vapurdan inen yorgunluk",
        text: "Altı haftadır iskele-metro-iş. Akşam eve varınca konuşacak cümle kalmıyor. Yemek ısınmış, sen soğumuşsun.",
        enTitle: "Tiredness getting off the ferry", enText: "Six weeks of pier-metro-work. By the time you reach home there is no sentence left. The food is warm; you are not.",
        choices: [
          choice("endure", "Bir süre daha idare", "Hold on a while longer", "Kariyer ivmesi; enerji düşer", { health: { energy: -8, stress: 6 } }, {
            lifeStage: 2, lifeNext: { eventId: "lc_metro_notice", dueWeeks: 8, key: "metro-notice" },
          }),
          choice("ask-move", "Taşınmayı konuş", "Talk about moving", "Konut kararı açılır", { health: { stress: 3 }, memory: "Ulaşım yüzünden taşınmayı konuştun." }, {
            lifeStage: 2, lifeNext: { eventId: "lc_metro_move", dueWeeks: 4, key: "metro-move" }, echo: "İşin evi çekiyor.",
          }),
        ],
      },
      {
        id: "lc_metro_notice", stage: 3,
        tags: ["relationship", "health", "memory"],
        title: "Takvimde boş akşam yok",
        text: "Elif değilse annen: 'seni akşam gören kaldı mı.' Cümle sitem değil, sayım.",
        enTitle: "No empty evening on the calendar", enText: "If it is not Elif it is your mother: 'is there anyone who still sees you in the evening.' It is not a complaint. It is a count.",
        choices: [
          choice("call", "Bu hafta erken çık", "Leave early this week", "Performans biraz iner; bağ durur", { health: { energy: 4, stress: -4 } }, {
            lifeStage: 3, npcMemory: { personId: "anne", text: "Bir akşam erken geldi.", type: "lc_came_home" },
          }),
          choice("text", "Mesaj at, yetişemem de", "Text that you cannot make it", "Bağ incelir", { health: { stress: 3 } }, {
            lifeStage: 3, npcMemory: { personId: "anne", text: "Yine yetişemedi.", type: "lc_missed_evening" },
          }),
        ],
      },
      {
        id: "lc_metro_move", stage: 3,
        tags: ["housing", "economy", "cross"],
        title: "Evi işe yaklaştır",
        text: "Depozito, komisyon, kutu. Aile evinden çıkmak bir cümle; kira artışı ayrı bir cümle.",
        enTitle: "Move the house toward the job", enText: "Deposit, fee, boxes. Leaving the family house is one sentence; the rent increase is another.",
        choices: [
          choice("move", "Taşın, yol kısalın", "Move, shorten the road", "Nakit gider; ulaşım düşer", { money: -4200, reason: "Taşınma ve depozito", health: { stress: 8, energy: -6 }, memory: "İşe yakın bir eve taşındın." }, {
            lifeStage: 4, echo: "Evin adresi işe kaydı.",
          }),
          choice("stay-family", "Ailede kal, yolu ye", "Stay with family, eat the road", "Nakit durur; yorgunluk birikir", { health: { energy: -5 } }, { lifeStage: 4 }),
        ],
      },
    ],
  },
  {
    id: "car-loan", exclusive: "commute-path", branch: "car", arc: "finance",
    tags: ["finance", "housing", "economy", "cross"],
    nodes: [
      {
        id: "lc_car_offer", stage: 1, organic: true, minWeek: 14, needJob: true, minAge: 21, maxAge: 48,
        tags: ["finance", "career"],
        title: "İkinci el, birinci taksit",
        text: "Galerici 'aile arabası' demiş. Sen işe gidiş diyorsun. Taksit, kira ile aynı haftaya denk geliyor.",
        enTitle: "Second-hand, first installment", enText: "The dealer said 'family car'. You mean the commute. The installment lands in the same week as rent.",
        choices: [
          choice("take", "Taksitle al", "Take it on installments", "Ulaşım rahatlar; nakit sıkışır", { money: -3500, reason: "Araç peşinatı", health: { stress: 6 }, memory: "İşe gidiş için araba taksitine girdin." }, {
            lifeStage: 1, lifeLock: "car", lifeNext: { eventId: "lc_car_taksit", dueWeeks: 8, key: "car-taksit" }, echo: "Direksiyon işe gidişi kısalttı, cüzdanı değil.",
          }),
          choice("refuse", "Toplu taşımada kal", "Stay on public transport", "Nakit durur; yol uzun kalır", { health: { energy: -2 } }, { lifeStage: 9 }),
        ],
      },
      {
        id: "lc_car_taksit", stage: 2, tags: ["finance", "economy"],
        title: "Taksit ve kira aynı gün",
        text: "Banka SMS'i kira hatırlatmasından iki dakika sonra düşüyor. İki sayı, bir bakiye.",
        enTitle: "Installment and rent on the same day", enText: "The bank SMS lands two minutes after the rent reminder. Two numbers, one balance.",
        choices: [
          choice("pay", "İkisini de öde", "Pay both", "Nakit erir; sicil durur", { money: -2400, reason: "Taksit + kira baskısı", health: { stress: 5 } }, {
            lifeStage: 2, lifeNext: { eventId: "lc_car_echo", dueWeeks: 10, key: "car-echo" },
          }),
          choice("delay", "Taksiti kaydır", "Slide the installment", "Arrears görünür olabilir", { health: { stress: 8 }, memory: "Araç taksitini kaydırdın." }, {
            lifeStage: 2, lifeNext: { eventId: "lc_car_echo", dueWeeks: 6, key: "car-echo" }, echo: "Taksit kayınca borç cümlesi uzadı.",
          }),
        ],
      },
      {
        id: "lc_car_echo", stage: 3, tags: ["finance", "career"],
        title: "Yol kısa, hesap uzun",
        text: "Trafikte kazandığın kırk dakika, taksitte kaybettiğin kırk gün gibi duruyor.",
        enTitle: "The road is short, the account is long", enText: "The forty minutes you gained in traffic look like the forty days you lost to the installment.",
        choices: [
          choice("keep", "Arabayı tut", "Keep the car", "Konfor kalır; borç konuşur", { health: { stress: 3 } }, { lifeStage: 3 }),
          choice("sell", "Sat, rahatla", "Sell it, breathe", "Nakit döner; yol uzar", { money: 1800, reason: "Araç satışı", health: { stress: -6 }, memory: "Taksitli arabayı geri sattın." }, { lifeStage: 4, echo: "Direksiyon gitti, taksit de." }),
        ],
      },
    ],
  },
  {
    id: "kira-artisi", arc: "housing", tags: ["housing", "economy", "finance", "cross"],
    nodes: [
      {
        id: "lc_kira_letter", stage: 1, organic: true, minWeek: 16, notHome: "family",
        tags: ["housing", "economy", "phase-mid"],
        title: "Ev sahibi yazmış",
        text: "Kâğıt kısa: 'yeni dönem, yeni rakam.' Altında imza, üstünde mahalle zammı. Kapıcı 'herkese geldi' diyor, teselli değil.",
        enTitle: "The landlord wrote", enText: "The note is short: 'new term, new number.' A signature under it, a neighbourhood increase above it. The doorman says it came to everyone — not a consolation.",
        choices: [
          choice("pay", "Zammı yut", "Swallow the increase", "Konut durur; nakit iner", { money: -1800, reason: "Kira zammı", health: { stress: 5 } }, {
            lifeStage: 1, lifeNext: { eventId: "lc_kira_search", dueWeeks: 8, key: "kira-search" },
          }),
          choice("look", "Başka ilan bak", "Look at other listings", "Taşınma kapısı açılır", { health: { energy: -4, stress: 4 }, memory: "Kira zammı sonrası ilan bakmaya başladın." }, {
            lifeStage: 1, lifeNext: { eventId: "lc_kira_search", dueWeeks: 3, key: "kira-search" }, echo: "Zam, evin cümlesini değiştirdi.",
          }),
        ],
      },
      {
        id: "lc_kira_search", stage: 2, tags: ["housing", "social"],
        title: "İlanlar aynı ev, başka yalan",
        text: "'Metroya 3 dk' diye yazılmış. Haritada 18. Komşu 'bizimki daha temizdi' diyor, kapıdan içeri bakmadan.",
        enTitle: "The ads are the same house, a different lie", enText: "'3 min to metro' it says. On the map, 18. A neighbour says theirs was cleaner, without looking through the door.",
        choices: [
          choice("deposit", "Depozitoyu yatır, çık", "Put the deposit down and leave", "Nakit büyük gider; ev değişir", { money: -5000, reason: "Yeni depozito", health: { stress: 7, energy: -8 }, memory: "Zam yüzünden taşındın." }, { lifeStage: 3, echo: "Evin adresi değişti, zam durdu." }),
          choice("stay", "Kal, zamlı öde", "Stay, pay the raised rent", "Adres durur; bütçe daralır", { health: { stress: 4 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "bayram-yol", arc: "family", tags: ["family", "finance", "cross", "phase-open"],
    nodes: [
      {
        id: "lc_bayram_invite", stage: 1, organic: true, minWeek: 8, needActor: "anne",
        tags: ["family", "finance"],
        title: "Bayram otogarı",
        text: "Annen: 'bu bayram gelmezsen baban bir şey demez. Ben derim.' Bilet, izin, hediye. Üç kalem, bir hafta.",
        enTitle: "The bayram station", enText: "Your mother: 'if you do not come this bayram your father will say nothing. I will.' Ticket, leave, gift. Three lines, one week.",
        choices: [
          choice("go", "Bileti al, git", "Buy the ticket and go", "Nakit ve izin; aile bağlanır", { money: -1600, reason: "Bayram yolu", health: { energy: -5, stress: -3 }, relationships: { anne: 6, baba: 4 } }, {
            lifeStage: 1, npcMemory: { personId: "anne", text: "Bayrama geldi.", type: "lc_bayram_came" },
            lifeNext: { eventId: "lc_bayram_table", dueWeeks: 12, key: "bayram-table" }, echo: "Bayram masasında yerin durdu.",
          }),
          choice("skip", "Bu yıl yetişemem", "I cannot make it this year", "Nakit durur; sitem birikir", { relationships: { anne: -5 }, health: { stress: 5 }, memory: "Bayrama gitmedin." }, {
            lifeStage: 1, npcMemory: { personId: "anne", text: "Bayrama gelmedi.", type: "lc_bayram_missed" },
            lifeNext: { eventId: "lc_bayram_cold", dueWeeks: 14, key: "bayram-cold" },
          }),
        ],
      },
      {
        id: "lc_bayram_table", stage: 2, tags: ["family", "memory"],
        title: "Masada senin tabak",
        text: "Annen kaldırmamış. 'Gelmesen de duruyor' demiyor, durduruyor.",
        enTitle: "Your plate at the table", enText: "Your mother did not clear it. She does not say 'it stays even if you do not come.' She just leaves it.",
        choices: [
          choice("stay-late", "Bir gün daha kal", "Stay one more day", "İş payı kaçar; bağ güçlenir", { health: { energy: -3 }, relationships: { anne: 4, baba: 3 } }, { lifeStage: 3 }),
          choice("return", "İş var, dön", "Work waits, go back", "Kariyer durur; masa boşalır", { health: { stress: 2 } }, { lifeStage: 3 }),
        ],
      },
      {
        id: "lc_bayram_cold", stage: 2, tags: ["family", "memory"],
        title: "Fotoğraf gelmedi",
        text: "Grupta herkes var, sen yoksun. Annen 'çekmedik' demez. Çekmemiş.",
        enTitle: "The photo did not come", enText: "Everyone is in the group photo except you. Your mother does not say 'we did not take one.' She did not.",
        choices: [
          choice("call", "Ara, geç de olsa", "Call, even late", "Sitem yumuşar", { health: { stress: -2 }, relationships: { anne: 3 } }, { lifeStage: 3 }),
          choice("silence", "Sessiz geç", "Let it pass in silence", "Mesafe sertleşir", { health: { stress: 3 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "sertifika-aksam", exclusive: "education-vs-job", branch: "kurs", arc: "education",
    tags: ["education", "career", "cross"],
    nodes: [
      {
        id: "lc_cert_offer", stage: 1, organic: true, minWeek: 12, needJob: true, maxAge: 40,
        tags: ["education", "career"],
        title: "Salı-perşembe kursu",
        text: "Sertifika üç ay. Mesai ile çakışıyor. Burak 'bunu yazdırırsan paket değişir' demiş, ı harfi yine yok.",
        enTitle: "Tuesday-Thursday course", enText: "The certificate is three months. It collides with overtime. Burak said 'if you put this on paper the package changes' — missing ı again.",
        choices: [
          choice("enroll", "Kursa yazıl", "Enroll", "Zaman ve para; ileride kapı", { money: -2200, reason: "Sertifika ücreti", health: { energy: -6, stress: 5 }, memory: "Akşam kursuna yazıldın." }, {
            lifeStage: 1, lifeLock: "kurs", lifeNext: { eventId: "lc_cert_exam", dueWeeks: 10, key: "cert-exam" },
            npcMemory: { personId: "burak", text: "Akşam kursuna yazıldı.", type: "lc_cert_enroll" }, echo: "Akşamlar artık derse ait.",
          }),
          choice("later", "Bu dönem olmaz", "Not this term", "Kapı kapanmaz, hız kesilir", { health: { stress: -1 } }, { lifeStage: 9 }),
        ],
      },
      {
        id: "lc_cert_exam", stage: 2, tags: ["education", "health"],
        title: "Sınav haftası, teslim haftası",
        text: "Aynı çarşamba: kurs sınavı ve iş teslimi. İkisi de 'kaydırılmaz' diyor.",
        enTitle: "Exam week, deadline week", enText: "The same Wednesday: the course exam and the work deadline. Both say they will not slide.",
        choices: [
          choice("exam", "Sınava gir, teslimi gece bitir", "Sit the exam, finish the deadline at night", "Eğitim ilerler; tükenme artar", { health: { energy: -10, stress: 8 } }, {
            lifeStage: 3, lifeNext: { eventId: "lc_cert_door", dueWeeks: 6, key: "cert-door" }, echo: "Sertifika kâğıdı cebinde, uyku değil.",
          }),
          choice("work", "İşi kurtar, sınavı kaçır", "Save the job, miss the exam", "Kariyer durur; kurs yarım kalır", { health: { stress: 6 }, memory: "Sınav haftasında işi seçtin." }, { lifeStage: 3 }),
        ],
      },
      {
        id: "lc_cert_door", stage: 3, tags: ["education", "career", "cross"],
        title: "Kâğıt geldi, kapı aralandı",
        text: "Sertifika PDF. Burak 'bunu iletme, göster' yazmış. İletmek ayrı, göstermek ayrı.",
        enTitle: "The paper arrived, the door cracked", enText: "Certificate PDF. Burak wrote 'do not forward it, show it.' Forwarding is one thing, showing is another.",
        choices: [
          choice("show", "İş yerinde göster", "Show it at work", "Performans kapısı; kıskançlık da", { health: { stress: 3 }, memory: "Sertifikayı işe taşıdın." }, { lifeStage: 4, opportunity: "Sertifika ile iç kapı" }),
          choice("hold", "Kendi dosyanda tut", "Keep it in your own file", "Kapı yavaş açılır", { health: { stress: -2 } }, { lifeStage: 4 }),
        ],
      },
    ],
  },
  {
    id: "mesai-karsi", exclusive: "education-vs-job", branch: "mesai", arc: "career",
    tags: ["career", "health", "cross"],
    nodes: [
      {
        id: "lc_ot_window", stage: 1, organic: true, minWeek: 12, needJob: true,
        tags: ["career", "education"],
        title: "Kurs değil, teslim",
        text: "Aynı saate kurs da sığardı. Patron 'bu ay kapanış' diyor. Kapanış, her ay aynı kapı.",
        enTitle: "Not the course, the deadline", enText: "The course would have fitted the same hour. The boss says 'month-end close'. Close is the same door every month.",
        choices: [
          choice("overtime", "Kapanışa kal", "Stay for close", "Nakit ve performans; kurs kaçar", { money: 900, reason: "Kapanış mesaisi", health: { energy: -8, stress: 7 }, memory: "Kurs yerine kapanış mesaisini seçtin." }, {
            lifeStage: 1, lifeLock: "mesai", lifeNext: { eventId: "lc_ot_body", dueWeeks: 7, key: "ot-body" },
          }),
          choice("leave", "Saatinde çık", "Leave on time", "Mesai kaçar; beden durur", { health: { energy: 4 } }, { lifeStage: 9 }),
        ],
      },
      {
        id: "lc_ot_body", stage: 2, tags: ["health", "career"],
        title: "Uyku borçlandı",
        text: "Sabah servisinde ayaktasın, otururken değil. Gözün kırmızı, teslim yeşil.",
        enTitle: "Sleep went into arrears", enText: "You are on your feet on the morning shuttle, not in a seat. Your eyes are red, the deadline is green.",
        choices: [
          choice("push", "Bu tempo bir ay daha", "This pace for one more month", "Kariyer; sağlık faturası", { health: { energy: -8, health: -3, stress: 8 } }, { lifeStage: 3 }),
          choice("cut", "Mesaiyi kes", "Cut the overtime", "İvme düşer; uyku döner", { health: { energy: 8, stress: -6 } }, { lifeStage: 3, echo: "Kapanışsız bir hafta denedin." }),
        ],
      },
    ],
  },
  {
    id: "nikah-baskisi", exclusive: "nikah-timing", branch: "evlen", arc: "relationship",
    tags: ["relationship", "family", "cross"],
    nodes: [
      {
        id: "lc_nikah_ask", stage: 1, organic: true, minWeek: 24, minAge: 24, maxAge: 40, needPartner: true, needActor: "anne",
        tags: ["family", "relationship", "phase-mid"],
        title: "Nikâh konuşması masada",
        text: "Annen direkt sormuyor. 'Kına için salon bakmıştım' diyor. Partnerin susuyor, sen bakıyorsun.",
        enTitle: "The nikah talk at the table", enText: "Your mother does not ask directly. She says she looked at a hall for the henna. Your partner is silent; you are looking.",
        choices: [
          choice("set", "Tarih konuşalım de", "Say let's talk a date", "Aile rahatlar; ilişki hızlanır", { health: { stress: 6 }, relationships: { anne: 5 }, memory: "Nikâh tarihini konuşmaya açtın." }, {
            lifeStage: 1, lifeLock: "evlen", lifeNext: { eventId: "lc_nikah_money", dueWeeks: 6, key: "nikah-money" },
            npcMemory: { personId: "anne", text: "Nikâh konuşmasına evet dedi.", type: "lc_nikah_yes" }, echo: "Tarih yok, niyet var.",
          }),
          choice("deflect", "Şimdi değil", "Not now", "Sitem birikir", { relationships: { anne: -4 }, health: { stress: 4 } }, { lifeStage: 9 }),
        ],
      },
      {
        id: "lc_nikah_money", stage: 2, tags: ["finance", "family", "cross"],
        title: "Salon değil, sayı",
        text: "Düğün bir gün. Hesap bir yıl. Baba 'ben karışmam' deyip kâğıda bir rakam yazıyor.",
        enTitle: "Not the hall, the number", enText: "The wedding is a day. The account is a year. Your father says he will not interfere and writes a number on the paper.",
        choices: [
          choice("small", "Küçük düğün", "A small wedding", "Nakit dayanır; bazı davetliler kırılır", { money: -4500, reason: "Küçük düğün payı", health: { stress: 5 }, memory: "Küçük düğüne razı oldun." }, { lifeStage: 3, echo: "Salon küçük, borç da." }),
          choice("wait-save", "Bir yıl biriktir", "Save for a year", "Tarih kayar; aile bekler", { health: { stress: 3 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "nikah-bekle", exclusive: "nikah-timing", branch: "bekle", arc: "relationship",
    tags: ["relationship", "family", "cross"],
    nodes: [
      {
        id: "lc_nikah_wait", stage: 1, organic: true, minWeek: 24, minAge: 24, maxAge: 40, needPartner: true,
        tags: ["relationship", "family"],
        title: "Beklemek de bir cevap",
        text: "Partnerin 'hazır değiliz' demiyor. 'Hazır olan tek şey baskı' diyor. Annen bunu duymasın istiyorsun.",
        enTitle: "Waiting is also an answer", enText: "Your partner does not say 'we are not ready.' They say 'the only ready thing is the pressure.' You do not want your mother to hear that.",
        choices: [
          choice("hold", "Bekleyelim, net söyle", "Wait, and say it clearly", "Aile kırılır; ilişki nefes alır", { relationships: { anne: -6 }, health: { stress: 4 }, memory: "Nikâhı ertelediniz." }, {
            lifeStage: 1, lifeLock: "bekle", lifeNext: { eventId: "lc_nikah_held", dueWeeks: 10, key: "nikah-held" },
            npcMemory: { personId: "anne", text: "Nikâhı erteledi.", type: "lc_nikah_wait" },
          }),
          choice("fold", "Tarihe razı ol", "Agree to a date", "Baskı diner; tempo artar", { health: { stress: 7 } }, { lifeStage: 9 }),
        ],
      },
      {
        id: "lc_nikah_held", stage: 2, tags: ["relationship", "memory"],
        title: "Soru değişti, masa aynı",
        text: "Annen artık tarih sormuyor. 'Siz bilirsiniz' diyor. Bu cümle ödül değil.",
        enTitle: "The question changed, the table did not", enText: "Your mother no longer asks for a date. She says 'you know best.' That sentence is not a prize.",
        choices: [
          choice("visit", "Bu hafta yemeğe git", "Go to dinner this week", "Sitem yumuşar", { health: { energy: -3 }, relationships: { anne: 4 } }, { lifeStage: 3 }),
          choice("distance", "Bir süre arama", "Do not call for a while", "Mesafe kalınlaşır", { health: { stress: 3 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "yurtdisi", exclusive: "career-fork", branch: "yurtdisi", arc: "career",
    tags: ["career", "status", "cross", "phase-mid"],
    nodes: [
      {
        id: "lc_abroad_offer", stage: 1, organic: true, minWeek: 40, minAge: 26, maxAge: 45, needJob: true,
        tags: ["career", "family"],
        title: "Üç yıllık Berlin notu",
        text: "Mail İngilizce, korku Türkçe. Vize, kira, aile. Burak 'kanka bu kapı iki kez çalmaz' yazmış.",
        enTitle: "A three-year Berlin note", enText: "The mail is in English, the fear in Turkish. Visa, rent, family. Burak wrote 'kanka this door does not knock twice.'",
        choices: [
          choice("go", "Başvur", "Apply", "Kariyer sıçrar; bağlar gerilir", { health: { stress: 8, energy: -5 }, memory: "Yurtdışı teklifine başvurdun." }, {
            lifeStage: 1, lifeLock: "yurtdisi", lifeNext: { eventId: "lc_abroad_family", dueWeeks: 5, key: "abroad-family" },
            npcMemory: { personId: "burak", text: "Yurtdışı kapısına yürüdü.", type: "lc_abroad_apply" }, echo: "Pasaport artık iş dosyasında.",
          }),
          choice("pass", "Bu tur geç", "Skip this round", "Kapı kapanabilir", { health: { stress: 2 } }, { lifeStage: 9 }),
        ],
      },
      {
        id: "lc_abroad_family", stage: 2, tags: ["family", "career", "cross"],
        title: "Annen haritaya bakmıyor",
        text: "'Uçak iner iner, ya dönmezsen.' Baba televizyonu açıyor. Cümle orada.",
        enTitle: "Your mother is not looking at the map", enText: "'Planes land, they land — what if you do not come back.' Your father turns the television on. The sentence is there.",
        choices: [
          choice("promise", "Dönerim de, net söyle", "Say you will come back, clearly", "Aile nefes alır; sen bağlanırsın", { relationships: { anne: 4, baba: 2 }, health: { stress: 3 } }, { lifeStage: 3 }),
          choice("honest", "Bilmiyorum de", "Say you do not know", "Dürüstlük; kırgınlık", { relationships: { anne: -5 }, health: { stress: 5 } }, { lifeStage: 3, echo: "Dönüş cümlesi kurulmadı." }),
        ],
      },
    ],
  },
  {
    id: "yerel-terfi", exclusive: "career-fork", branch: "yerel", arc: "career",
    tags: ["career", "status", "cross"],
    nodes: [
      {
        id: "lc_local_promo", stage: 1, organic: true, minWeek: 36, needJob: true, minAge: 24,
        tags: ["career"],
        title: "İçeriden kadro",
        text: "Yurtdışı maili duruyor bir yerde. Burada müdür 'seni düşünüyoruz' diyor. Düşünmek, vermek değil.",
        enTitle: "An internal post", enText: "The abroad mail is sitting somewhere. Here the manager says 'we are thinking of you.' Thinking is not giving.",
        choices: [
          choice("stay", "Burada yüksel", "Rise here", "Yerel ivme; dış kapı kapanır", { health: { stress: 4 }, memory: "Yurtdışı yerine iç terfiyi bekledin." }, {
            lifeStage: 1, lifeLock: "yerel", lifeNext: { eventId: "lc_local_team", dueWeeks: 7, key: "local-team" }, echo: "Kariyer bu binada kaldı.",
          }),
          choice("wait-abroad", "Dış kapıyı açık tut", "Keep the outer door open", "İçerisi soğur", { health: { stress: 3 } }, { lifeStage: 9 }),
        ],
      },
      {
        id: "lc_local_team", stage: 2, tags: ["career", "social"],
        title: "Ekip senin oldu, yük de",
        text: "Terfi cümlesi kısa. Mesai cümlesi uzun. Birinin işi senin sırtına kaydı, isim değişmeden.",
        enTitle: "The team is yours, and the load", enText: "The promotion sentence is short. The overtime sentence is long. Someone's work slid onto your back without a name change.",
        choices: [
          choice("carry", "Yükü al", "Take the load", "Performans; tükenme", { health: { energy: -7, stress: 7 } }, { lifeStage: 3 }),
          choice("delegate", "Paylaştır, kırıl", "Share it out, even if it stings", "Ekip gerilir; sen durursun", { health: { stress: 5 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "freelance", exclusive: "work-form", branch: "freelance", arc: "career",
    tags: ["career", "finance", "cross"],
    nodes: [
      {
        id: "lc_free_offer", stage: 1, organic: true, minWeek: 20, needJob: true, maxAge: 44,
        tags: ["career", "finance"],
        title: "Fatura kesmek",
        text: "Bir tanıdık 'kadrolu gibi değil, iş gibi' diyor. SGK cümlesi yok. Serbest, korku da serbest.",
        enTitle: "Issuing an invoice", enText: "An acquaintance says 'not like a post, like work.' No social-security sentence. Freelance — the fear is freelance too.",
        choices: [
          choice("jump", "Çık, fatura kes", "Leave, invoice", "Özgürlük; güvence düşer", { health: { stress: 8 }, memory: "Kadroyu bırakıp serbest çalışmaya geçtin." }, {
            lifeStage: 1, lifeLock: "freelance", lifeNext: { eventId: "lc_free_month", dueWeeks: 8, key: "free-month" }, echo: "Maaş yerine fatura.",
          }),
          choice("keep-job", "Kadroda kal", "Stay on payroll", "Güvence durur", { health: { stress: -1 } }, { lifeStage: 9 }),
        ],
      },
      {
        id: "lc_free_month", stage: 2, tags: ["finance", "career", "economy"],
        title: "Müşteri gecikti, kira gelmedi",
        text: "Fatura kesildi. Ödeme 'ay başı'ymış. Ayın onu. Kira on iki.",
        enTitle: "The client delayed, the rent did not", enText: "The invoice was issued. Payment was 'start of the month'. It is the tenth. Rent is the twelfth.",
        choices: [
          choice("chase", "Ara, sıkıştır", "Call and press", "Nakit belki döner; ilişki gerilir", { health: { stress: 6 }, memory: "Geciken faturayı sıkıştırdın." }, { lifeStage: 3 }),
          choice("borrow", "Kısa borç al", "Take a short loan", "Arrears yerine borç", { money: 1500, reason: "Nakit köprüsü", health: { stress: 5 } }, { lifeStage: 3, echo: "Fatura gelmeden kira bağlandı." }),
        ],
      },
    ],
  },
  {
    id: "kadrolu", exclusive: "work-form", branch: "kadrolu", arc: "career",
    tags: ["career", "status"],
    nodes: [
      {
        id: "lc_staff_keep", stage: 1, organic: true, minWeek: 20, needJob: true,
        tags: ["career"],
        title: "Kadronun fiyatı",
        text: "Serbest iş daha çok ödüyor gibi. Bordro daha az konuşuyor. Annene bordro daha kolay anlatılır.",
        enTitle: "The price of a post", enText: "Freelance seems to pay more. The payslip talks less. A payslip is easier to explain to your mother.",
        choices: [
          choice("stay", "Kadroyu tut", "Keep the post", "Güvence; tavan alçak", { health: { stress: 2 }, memory: "Serbest işi geçip kadroda kaldın." }, {
            lifeStage: 1, lifeLock: "kadrolu", lifeNext: { eventId: "lc_staff_ceiling", dueWeeks: 9, key: "staff-ceiling" },
          }),
          choice("side", "Akşam işi bak", "Look at evening work", "Yan gelir kapısı", { health: { energy: -4 } }, { lifeStage: 9 }),
        ],
      },
      {
        id: "lc_staff_ceiling", stage: 2, tags: ["career", "status"],
        title: "Tavan göründü",
        text: "Terfi listesinde ismin var, kadro yok. 'Gelecek yıl' her yıl aynı yıl.",
        enTitle: "The ceiling came into view", enText: "Your name is on the promotion list; the post is not. 'Next year' is the same year every year.",
        choices: [
          choice("wait", "Bir yıl daha bekle", "Wait one more year", "Sadakat; öfke", { health: { stress: 5 } }, { lifeStage: 3 }),
          choice("search", "Dışarı bak", "Look outside", "Risk; hareket", { health: { energy: -3, stress: 4 }, memory: "Kadronun tavanında dışarı bakmaya başladın." }, { lifeStage: 3, echo: "Bordro duruyor, kapı aralandı." }),
        ],
      },
    ],
  },
  {
    id: "aile-yakin", exclusive: "housing-near", branch: "aile", arc: "housing",
    tags: ["housing", "family", "cross"],
    nodes: [
      {
        id: "lc_near_family", stage: 1, organic: true, minWeek: 18, notHome: "family", minAge: 23,
        tags: ["housing", "family"],
        title: "Anneye on dakika",
        text: "İlan aile evine yakın. İşe uzak. 'Hafta sonu yemeğe yürürsün' cümlesi kira kadar net.",
        enTitle: "Ten minutes to mum", enText: "The listing is close to the family house. Far from work. 'You can walk to Sunday lunch' is as clear as the rent.",
        choices: [
          choice("near", "Aileye yakın tut", "Keep it close to family", "Bağ durur; yol uzar", { health: { energy: -4 }, relationships: { anne: 5, baba: 3 }, memory: "İşe uzak, aileye yakın bir eve baktın." }, {
            lifeStage: 1, lifeLock: "aile", lifeNext: { eventId: "lc_near_family_week", dueWeeks: 6, key: "near-fam-week" }, echo: "Adres aileye kaydı.",
          }),
          choice("no", "Uzak dur", "Keep your distance", "Özerklik", { health: { stress: 2 } }, { lifeStage: 9 }),
        ],
      },
      {
        id: "lc_near_family_week", stage: 2, tags: ["family", "health"],
        title: "Kapı zili iş gibi",
        text: "Salı akşamı tencere. Perşembe 'bir bakıver'. Yakınlık, vardiya olmuş.",
        enTitle: "The doorbell like a shift", enText: "Tuesday evening, a pot. Thursday, 'just look in.' Closeness has become a shift.",
        choices: [
          choice("bound", "Sınır koy", "Set a boundary", "Gerilim; nefes", { relationships: { anne: -3 }, health: { energy: 4, stress: -3 } }, { lifeStage: 3 }),
          choice("serve", "Git, bak", "Go and look in", "Bağ; yorgunluk", { health: { energy: -6 }, relationships: { anne: 4 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "ise-yakin", exclusive: "housing-near", branch: "is", arc: "housing",
    tags: ["housing", "career", "cross"],
    nodes: [
      {
        id: "lc_near_job", stage: 1, organic: true, minWeek: 18, minCommute: 1, needJob: true,
        tags: ["housing", "career"],
        title: "İşe yürünecek ev",
        text: "Metro yok, merdiven var. Aile 'o semt pahalı' diyor. Semt değil, dakika pahalı.",
        enTitle: "A house you can walk to work from", enText: "No metro, stairs. The family says 'that neighbourhood is expensive.' It is not the neighbourhood that is expensive. It is the minutes.",
        choices: [
          choice("near", "İşe yakın tut", "Keep it close to work", "Kira yükselir; yol kısalır", { money: -2800, reason: "İşe yakın kira farkı", health: { energy: 6, stress: 4 }, memory: "Aileye uzak, işe yakın oturdun." }, {
            lifeStage: 1, lifeLock: "is", lifeNext: { eventId: "lc_near_job_quiet", dueWeeks: 7, key: "near-job-quiet" }, echo: "Yol kısaldı, masa uzaklaştı.",
          }),
          choice("no", "Aile semtinde kal", "Stay in the family neighbourhood", "Yol durur", { health: { energy: -2 } }, { lifeStage: 9 }),
        ],
      },
      {
        id: "lc_near_job_quiet", stage: 2, tags: ["family", "housing"],
        title: "Hafta sonu yol oldu",
        text: "Yemeğe gitmek artık bir sefer. Annen 'misafir gibi geldin' diyor. Misafir, kira ödemez.",
        enTitle: "The weekend became a trip", enText: "Going to lunch is now a journey. Your mother says 'you arrived like a guest.' Guests do not pay rent.",
        choices: [
          choice("visit", "Bu pazar kal", "Stay this Sunday", "Bağ onarılır", { health: { energy: -4 }, relationships: { anne: 5 } }, { lifeStage: 3 }),
          choice("call", "Ara, yetişemem de", "Call and say you cannot make it", "Mesafe kalır", { health: { stress: 3 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "esnaf-yan", exclusive: "side-income", branch: "esnaf", arc: "finance",
    tags: ["finance", "career", "cross"],
    nodes: [
      {
        id: "lc_side_stall", stage: 1, organic: true, minWeek: 16, needJob: true,
        tags: ["finance", "career"],
        title: "Hafta sonu tezgâh",
        text: "Kuzen 'pazarda yer var, durmasın' diyor. SGK sormuyor, belin soruyor.",
        enTitle: "A weekend stall", enText: "A cousin says there is a place at the market, it should not sit empty. Social security does not ask; your back does.",
        choices: [
          choice("stall", "Tezgâha dur", "Stand the stall", "Nakit; pazar yorgunluğu", { money: 1100, reason: "Pazar tezgâhı", health: { energy: -9, stress: 4 }, memory: "Hafta sonu tezgâh açtın." }, {
            lifeStage: 1, lifeLock: "esnaf", lifeNext: { eventId: "lc_side_tax", dueWeeks: 8, key: "side-tax" }, echo: "Maaşın yanında tezgâh.",
          }),
          choice("no", "Pazara girme", "Stay out of the market", "Beden durur", {}, { lifeStage: 9 }),
        ],
      },
      {
        id: "lc_side_tax", stage: 2, tags: ["finance", "crisis"],
        title: "Fiş isteyen müşteri",
        text: "Bir adam fiş istedi. Tezgâh susuyor. Sen de.",
        enTitle: "A customer who wants a receipt", enText: "A man asked for a receipt. The stall is silent. So are you.",
        choices: [
          choice("receipt", "Fiş kes, düzgün git", "Issue the receipt, go clean", "Nakit azalır; risk iner", { money: -400, reason: "Kayıtlı satış", health: { stress: -3 } }, { lifeStage: 3 }),
          choice("cash", "Nakit, kayıtsız", "Cash, off-book", "Nakit kalır; risk durur", { health: { stress: 6 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "kamu-sinav", exclusive: "side-income", branch: "kamu", arc: "education",
    tags: ["education", "career", "cross"],
    nodes: [
      {
        id: "lc_exam_form", stage: 1, organic: true, minWeek: 14, maxAge: 35,
        tags: ["education", "career"],
        title: "KPSS dosyası",
        text: "Form uzun, umut kısa. Annen 'devlet ekmek' diyor. Ekmek bu yıl zamlı.",
        enTitle: "The civil-service file", enText: "The form is long, the hope is short. Your mother says 'the state is bread.' Bread went up this year.",
        choices: [
          choice("apply", "Başvur, çalış", "Apply and study", "Zaman bedeli; güvence bahsi", { money: -350, reason: "Sınav ücreti", health: { energy: -5, stress: 6 }, memory: "Kamu sınavına girdin." }, {
            lifeStage: 1, lifeLock: "kamu", lifeNext: { eventId: "lc_exam_night", dueWeeks: 9, key: "exam-night" },
            npcMemory: { personId: "anne", text: "Devlet sınavına girdi.", type: "lc_kamu_apply" },
          }),
          choice("skip", "Bu yıl girme", "Do not sit it this year", "Kapı kapanmaz", { health: { stress: -1 } }, { lifeStage: 9 }),
        ],
      },
      {
        id: "lc_exam_night", stage: 2, tags: ["education", "health"],
        title: "Gece test, gündüz vardiya",
        text: "Kitap açık, göz kapalı. Soru bankası rüya gibi, rüya da test gibi.",
        enTitle: "Tests at night, a shift by day", enText: "The book is open, the eyes are closed. The question bank is like a dream, and the dream is like a test.",
        choices: [
          choice("grind", "Bitir", "Finish it", "Sınav şansı; beden faturası", { health: { energy: -8, stress: 6 } }, { lifeStage: 3 }),
          choice("sleep", "Uyu, yarım bırak", "Sleep, leave it half-done", "Sağlık; ihtimal düşer", { health: { energy: 8, stress: -5 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "kres-mesai", exclusive: "child-care", branch: "kres", arc: "family",
    tags: ["family", "career", "economy", "cross"],
    nodes: [
      {
        id: "lc_kres_list", stage: 1, organic: true, minWeek: 30, needChild: true, minAge: 24,
        tags: ["family", "career", "economy"],
        title: "Kreş sırası, mesai sırası",
        text: "Kreş 08:20 açılıyor, iş 08:30. On dakika bir hayat. Fiyat, maaşın bir kalemi değil, bir cümlesi.",
        enTitle: "Nursery queue, overtime queue", enText: "Nursery opens at 08:20, work at 08:30. Ten minutes is a life. The price is not a line of the salary; it is a sentence of it.",
        choices: [
          choice("enroll", "Kreşe yazdır", "Enroll at nursery", "Nakit gider; kariyer durur", { money: -3200, reason: "Kreş kaydı", health: { stress: 6, energy: -4 }, memory: "Çocuğu kreşe yazdırdın." }, {
            lifeStage: 1, lifeLock: "kres", lifeNext: { eventId: "lc_kres_fever", dueWeeks: 5, key: "kres-fever" }, echo: "Sabah kapısı kreş oldu.",
          }),
          choice("delay", "Biraz daha evde", "Keep them home a little longer", "Kariyer yavaşlar", { health: { energy: -6 } }, { lifeStage: 9 }),
        ],
      },
      {
        id: "lc_kres_fever", stage: 2, tags: ["family", "health", "career", "cross"],
        title: "Ateş çıktı, teslim duruyor",
        text: "Kreş aradı. İş teslimi de arıyor. İki telefon, bir el.",
        enTitle: "A fever, and the deadline still standing", enText: "The nursery called. The deadline is calling too. Two phones, one hand.",
        choices: [
          choice("home", "Sen bak, işi kaydır", "You stay, slide the work", "Kariyer sarsılır; çocuk durur", { health: { energy: -8, stress: 5 }, memory: "Kreş ateşinde işi kaydırdın." }, { lifeStage: 3 }),
          choice("ask", "Aileye bırak, işe git", "Leave them with family, go to work", "İş durur; borç cümlesi doğar", { relationships: { anne: 3 }, health: { stress: 6 } }, {
            lifeStage: 3, npcMemory: { personId: "anne", text: "Çocuk ateşliyken bana bıraktı.", type: "lc_child_help" },
          }),
        ],
      },
    ],
  },
  {
    id: "anne-yardim", exclusive: "child-care", branch: "anne", arc: "family",
    tags: ["family", "career", "cross"],
    nodes: [
      {
        id: "lc_grandma_care", stage: 1, organic: true, minWeek: 30, needChild: true, needActor: "anne",
        tags: ["family"],
        title: "Annen 'ben bakarım'",
        text: "Kreş parasına bakıyor. 'Ver o parayı ekmeğe.' Bakmak, ücret değil, vardiya.",
        enTitle: "Your mother says she will look after them", enText: "She looks at the nursery fee. 'Put that money toward bread.' Care is not a wage. It is a shift.",
        choices: [
          choice("accept", "Anneye bırak", "Leave it with mum", "Nakit durur; borç görünmez birikir", { relationships: { anne: 6 }, health: { stress: 3 }, memory: "Çocuk bakımını anneye bıraktın." }, {
            lifeStage: 1, lifeLock: "anne", lifeNext: { eventId: "lc_grandma_tired", dueWeeks: 8, key: "grandma-tired" },
            npcMemory: { personId: "anne", text: "Çocuğa ben bakıyorum.", type: "lc_child_help" }, echo: "Kreş yerine anne vardiyası.",
          }),
          choice("pay-kres", "Kreşi sen öde", "You pay for nursery", "Nakit iner; sınır durur", { money: -2800, reason: "Kreş" }, { lifeStage: 9 }),
        ],
      },
      {
        id: "lc_grandma_tired", stage: 2, tags: ["family", "health", "memory"],
        title: "Annenin bel ağrısı",
        text: "'Bir şeyim yok' diyor. Otururken yüzü başka. Bakmak ücretsiz diye beden de ücretsiz değil.",
        enTitle: "Your mother's back", enText: "She says nothing is wrong. Sitting down, her face is different. Care being free does not make the body free.",
        choices: [
          choice("relief", "Bu hafta sen bak, onu yatır", "You take this week, let her rest", "Kariyer payı kaçar", { health: { energy: -7 }, relationships: { anne: 5 } }, { lifeStage: 3 }),
          choice("keep", "Rutin devam", "Keep the routine", "Yük anne de kalır", { health: { stress: 4 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "saglik-randevu", exclusive: "health-path", branch: "randevu", arc: "health",
    tags: ["health", "career", "cross"],
    nodes: [
      {
        id: "lc_clinic_slot", stage: 1, organic: true, minWeek: 15, needJob: true,
        tags: ["health"],
        title: "MHRS 07:12",
        text: "Açılır açılmaz bir slot. Öğlen iş toplantısı var. 'İdare ederim' cümlesi üç aydır aynı cümle.",
        enTitle: "Clinic slot at 07:12", enText: "A slot the moment bookings open. There is a work meeting at noon. 'I can manage' has been the same sentence for three months.",
        choices: [
          choice("book", "Randevuyu al, işi kaydır", "Take the slot, slide the work", "Sağlık; performans riski", { health: { stress: 3, health: 6 }, memory: "Erken klinik randevusu aldın." }, {
            lifeStage: 1, lifeLock: "randevu", lifeNext: { eventId: "lc_clinic_result", dueWeeks: 4, key: "clinic-result" }, echo: "Vücut kuyruğa girdi, teslim değil.",
          }),
          choice("skip", "İdare et", "Manage it", "İş durur; şikâyet uzar", { health: { health: -4, stress: 4 } }, { lifeStage: 9 }),
        ],
      },
      {
        id: "lc_clinic_result", stage: 2, tags: ["health"],
        title: "Tahlil kâğıdı, isim yok",
        text: "Doktor 'alarm değil, ihmal de etme' diyor. İhmal, senin uzmanlık alanın gibi duruyor.",
        enTitle: "Lab paper, no name", enText: "The doctor says it is not an alarm, and not to neglect it either. Neglect looks like your field of expertise.",
        choices: [
          choice("follow", "Kontrole git", "Go to the follow-up", "Zaman; sağlık", { health: { health: 5, energy: -3 }, money: -400, reason: "Kontrol" }, { lifeStage: 3 }),
          choice("shelf", "Kâğıdı çekmeceye", "Put the paper in a drawer", "İş devam; risk durur", { health: { stress: 3 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "idare-et", exclusive: "health-path", branch: "idare", arc: "health",
    tags: ["health", "career"],
    nodes: [
      {
        id: "lc_manage_pain", stage: 1, organic: true, minWeek: 15, needJob: true,
        tags: ["health"],
        title: "Ağrı 'mevsimlik'",
        text: "Eczane kuyruğunda numara yok. 'Bir kutu daha' diyorsun. Kutu bitince mevsim de bitmiyor.",
        enTitle: "The pain is 'seasonal'", enText: "No ticket in the pharmacy queue. You say 'one more box.' When the box ends the season does not.",
        choices: [
          choice("box", "Kutu al, işe dön", "Buy the box, go back to work", "Kısa rahatlama; asıl kapı kapalı", { money: -180, reason: "Eczane", health: { energy: 3, stress: 2 }, memory: "Ağrıyı kutuyla idare ettin." }, {
            lifeStage: 1, lifeLock: "idare", lifeNext: { eventId: "lc_manage_night", dueWeeks: 6, key: "manage-night" },
          }),
          choice("doctor", "Doktora git", "See a doctor", "Zaman kayar", { health: { stress: 3 } }, { lifeStage: 9 }),
        ],
      },
      {
        id: "lc_manage_night", stage: 2, tags: ["health", "crisis"],
        title: "Gece uyanma",
        text: "Saat 03:40. Ağrı mevsimlik değilmiş. Mevsim senmişsin.",
        enTitle: "Waking at night", enText: "03:40. The pain was not seasonal. You were the season.",
        choices: [
          choice("go", "Sabah randevuya", "To a slot in the morning", "İş payı kaçar", { health: { stress: 4, health: 4 } }, { lifeStage: 3, echo: "İdare bitti, kuyruk başladı." }),
          choice("work", "Sabah işe", "To work in the morning", "Teslim durur", { health: { health: -5, energy: -6 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "eski-mahalle", exclusive: "social-circle", branch: "mahalle", arc: "social",
    tags: ["social", "status", "cross"],
    nodes: [
      {
        id: "lc_old_street", stage: 1, organic: true, minWeek: 22, minAge: 23,
        tags: ["social", "status"],
        title: "Eski mahalle WhatsApp'ı",
        text: "Halısaha var. Sen 'yoğunluk' yazıyorsun. Yoğunluk, yeni semtin kelimesi.",
        enTitle: "The old neighbourhood WhatsApp", enText: "There is a five-a-side. You write 'busy.' Busy is a word from the new neighbourhood.",
        choices: [
          choice("go", "Halısahaya git", "Go to five-a-side", "Eski bağ; yeni çevre kıskanır", { health: { energy: -5, stress: -4 }, memory: "Eski mahalle maçına gittin." }, {
            lifeStage: 1, lifeLock: "mahalle", lifeNext: { eventId: "lc_old_street_bill", dueWeeks: 5, key: "old-bill" },
            npcMemory: { personId: "mehmet", text: "Halısahaya geldi.", type: "lc_street_came" },
          }),
          choice("skip", "Yoğunum de", "Say you are busy", "Yeni tempo; eski soğuk", { health: { stress: 2 } }, { lifeStage: 9 }),
        ],
      },
      {
        id: "lc_old_street_bill", stage: 2, tags: ["social", "finance", "status"],
        title: "Çay o kadar değildi",
        text: "Hesap geldi. Yeni semtte bu tutara yemek deniyor. Burada çay. Sen arada kaldın.",
        enTitle: "Tea was not that much", enText: "The bill arrived. In the new neighbourhood this amount is a meal. Here it is tea. You are in between.",
        choices: [
          choice("pay", "Sen kapat", "You get it", "Statü jesti; nakit", { money: -700, reason: "Mahalle hesabı", health: { stress: -2 } }, { lifeStage: 3 }),
          choice("split", "Bölüşün", "Split it", "Dürüstlük; hava kaçar", { money: -180, reason: "Çay", health: { stress: 2 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "yeni-is-cevre", exclusive: "social-circle", branch: "is", arc: "status",
    tags: ["social", "status", "career", "cross"],
    nodes: [
      {
        id: "lc_afterwork", stage: 1, organic: true, minWeek: 18, needJob: true,
        tags: ["status", "career"],
        title: "İş çıkışı 'bir şeyler'",
        text: "Mekan işe yakın, hesaba uzak. Gelmeyen mahalleli, gelen müdür.",
        enTitle: "After work 'something'", enText: "The place is close to work, far from the bill. The neighbourhood does not come; the manager does.",
        choices: [
          choice("go", "Git, görünür ol", "Go, be seen", "Statü; nakit ve uyku", { money: -950, reason: "İş çıkışı", health: { energy: -5, stress: 3 }, memory: "İş çıkışı yeni çevreye gittin." }, {
            lifeStage: 1, lifeLock: "is", lifeNext: { eventId: "lc_afterwork_bill", dueWeeks: 6, key: "after-bill" }, echo: "Akşamlar ofise kaydı.",
          }),
          choice("home", "Eve git", "Go home", "Mahalle durur", { health: { energy: 4 } }, { lifeStage: 9 }),
        ],
      },
      {
        id: "lc_afterwork_bill", stage: 2, tags: ["status", "finance"],
        title: "Hesabı kimse bölmedi",
        text: "Bir tur 'ben kapatırım' oldu. Tur senin sıran. Maaş bu sırayı sevmiyor.",
        enTitle: "Nobody split the bill", enText: "One round became 'I'll get it.' The round is yours. The salary does not like this queue.",
        choices: [
          choice("pay", "Kapat, gülümse", "Get it, smile", "Aidiyet; nakit", { money: -1200, reason: "İş çıkışı hesabı", health: { stress: 4 } }, { lifeStage: 3 }),
          choice("leave", "Erken kalk", "Get up early", "Tasarruf; dışarıda kalma", { health: { stress: 5 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "aileye-don", exclusive: "crisis-response", branch: "aile", arc: "crisis",
    tags: ["crisis", "family", "finance", "cross"],
    nodes: [
      {
        id: "lc_crisis_home", stage: 1, organic: true, minWeek: 28, minDebt: 1,
        tags: ["crisis", "family", "economy"],
        title: "Kapı, anahtar, utanç",
        text: "Nakit yetmedi. Aile evi boş değil. 'Bir ay' diyorsun. Annen 'bir ay'ı duymuyor, 'geldin'i duyuyor.",
        enTitle: "Door, key, shame", enText: "The cash did not stretch. The family house is not empty. You say 'one month.' Your mother does not hear 'one month.' She hears 'you came.'",
        choices: [
          choice("return", "Bir süre ailede kal", "Stay with family for a while", "Nakit nefes alır; gurur inmez", { health: { stress: 6, energy: 4 }, relationships: { anne: 3, baba: -2 }, memory: "Krizde aile evine döndün." }, {
            lifeStage: 1, lifeLock: "aile", lifeNext: { eventId: "lc_crisis_home_week", dueWeeks: 6, key: "crisis-home" }, echo: "Adres geri kaydı, borç duruyor.",
          }),
          choice("hold", "Kendi evinde idare", "Manage in your own place", "Gurur; sıkışma", { health: { stress: 8 } }, { lifeStage: 9 }),
        ],
      },
      {
        id: "lc_crisis_home_week", stage: 2, tags: ["family", "crisis"],
        title: "Oda yine senin değil",
        text: "Dolapta hâlâ lise ceketi. Baba 'iş nasıl' diye sormuyor. Sormamak da soru.",
        enTitle: "The room is not yours again", enText: "A high-school jacket is still in the wardrobe. Your father does not ask how work is. Not asking is also a question.",
        choices: [
          choice("talk", "Hesabı aç, utancı paylaş", "Open the account, share the shame", "Rahatlama; kırılganlık", { health: { stress: -5 }, relationships: { baba: 4 } }, { lifeStage: 3 }),
          choice("quiet", "İşler yolunda de", "Say things are fine", "Gurur; yalnızlık", { health: { stress: 4 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "yalniz-kal", exclusive: "crisis-response", branch: "yalniz", arc: "crisis",
    tags: ["crisis", "health", "cross"],
    nodes: [
      {
        id: "lc_crisis_alone", stage: 1, organic: true, minWeek: 28, minDebt: 1,
        tags: ["crisis", "health"],
        title: "Aileye haber yok",
        text: "Mesaj taslağı: 'biraz sıkışığım.' Silindi. İkinci taslak da silindi. Buzdolabında ışık var, yemek yok.",
        enTitle: "The family has not been told", enText: "A draft: 'I am a bit squeezed.' Deleted. The second draft too. The fridge light works; the food does not.",
        choices: [
          choice("hide", "Kimseye söyleme", "Tell no one", "Gurur; yük tek omuzda", { health: { stress: 8, energy: -5 }, memory: "Krizi aileden sakladın." }, {
            lifeStage: 1, lifeLock: "yalniz", lifeNext: { eventId: "lc_crisis_alone_week", dueWeeks: 5, key: "crisis-alone" }, echo: "Kapı kilitli, borç içeride.",
          }),
          choice("call-home", "Eve haber ver", "Tell home", "Utanç; yardım ihtimali", { health: { stress: 5 } }, { lifeStage: 9 }),
        ],
      },
      {
        id: "lc_crisis_alone_week", stage: 2, tags: ["crisis", "social", "memory"],
        title: "Mehmet 'kanka neredesin'",
        text: "Üç satır, nokta yok. 'gelmiyosan söyle.' Gelmemek de bir haber.",
        enTitle: "Mehmet: kanka where are you", enText: "Three lines, no period. 'if you're not coming say so.' Not coming is also news.",
        choices: [
          choice("answer", "Sıkışığım de", "Say you are squeezed", "Yardım kapısı; gurur iner", { health: { stress: -4 }, memory: "Sıkışmayı Mehmet'e söyledin." }, {
            lifeStage: 3, npcMemory: { personId: "mehmet", text: "Sıkışınca haber verdi.", type: "lc_told_mehmet" },
          }),
          choice("seen", "Görüldü bırak", "Leave it on seen", "Yalnızlık sertleşir", { health: { stress: 5 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "dugun-git", exclusive: "wedding-path", branch: "git", arc: "social",
    tags: ["social", "finance", "family", "cross"],
    nodes: [
      {
        id: "lc_wedding_invite", stage: 1, organic: true, minWeek: 12, needActor: "mehmet",
        tags: ["social", "finance"],
        title: "Zarfta isim, içinde rakam",
        text: "Mehmet'in düğünü. Takı konuşulmuyor, konuşuluyor. Gitmek bir gece, gitmemek yıllarca.",
        enTitle: "A name on the envelope, a number inside", enText: "Mehmet's wedding. The gold gift is not being discussed, and it is. Going is one night. Not going is years.",
        choices: [
          choice("go", "Git, takı tak", "Go, pin the gift", "Nakit ve bağ", { money: -2500, reason: "Düğün takısı", health: { energy: -6, stress: 3 }, memory: "Mehmet'in düğününe gittin." }, {
            lifeStage: 1, lifeLock: "git", lifeNext: { eventId: "lc_wedding_return", dueWeeks: 16, key: "wedding-return" },
            npcMemory: { personId: "mehmet", text: "Düğününe geldi, takı taktı.", type: "lc_wedding_came" }, echo: "Salon gürültüsü borç gibi durmuyor, duruyor.",
          }),
          choice("skip", "Bu sefer yetişemem", "Cannot make it this time", "Nakit durur; kırgınlık", { health: { stress: 4 } }, { lifeStage: 9 }),
        ],
      },
      {
        id: "lc_wedding_return", stage: 2, tags: ["social", "memory", "finance"],
        title: "Karşılık masası",
        text: "Mehmet 'o geceyi unutmadım' diyor. Hesabı kapatıyor. Takı faizi böyle işler.",
        enTitle: "The return table", enText: "Mehmet says he has not forgotten that night. He closes the bill. That is how gift interest works.",
        choices: [
          choice("accept", "Teşekkür et", "Say thank you", "Bağ güçlenir", { money: 600, reason: "Düğün karşılığı", health: { stress: -3 } }, { lifeStage: 3 }),
          choice("refuse", "Olmaz, ben bakarım", "No, I will get it", "Gurur; jest kaçar", { health: { stress: 2 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "dugun-skip", exclusive: "wedding-path", branch: "skip", arc: "social",
    tags: ["social", "finance", "memory"],
    nodes: [
      {
        id: "lc_wedding_skip", stage: 1, organic: true, minWeek: 12, needActor: "mehmet",
        tags: ["social", "memory"],
        title: "Zarfta sen yoksun",
        text: "Mesaj: 'kanka anlarım yoğunluk.' Anlamak, unutmak değil. Fotoğrafta herkes var.",
        enTitle: "You are not on the envelope", enText: "A message: 'kanka I get that you're busy.' Understanding is not forgetting. Everyone is in the photo.",
        choices: [
          choice("skip", "Gitme, sonra yaz", "Do not go, write later", "Nakit durur; hatıra soğur", { health: { stress: 5 }, memory: "Mehmet'in düğününe gitmedin." }, {
            lifeStage: 1, lifeLock: "skip", lifeNext: { eventId: "lc_wedding_cold", dueWeeks: 10, key: "wedding-cold" },
            npcMemory: { personId: "mehmet", text: "Düğününe gelmedi.", type: "lc_wedding_missed" }, echo: "Salon fotoğrafında boşluk sen.",
          }),
          choice("last", "Son anda git", "Go at the last minute", "Nakit ve yorgunluk", { money: -1800, reason: "Geç takı", health: { energy: -7 } }, { lifeStage: 9 }),
        ],
      },
      {
        id: "lc_wedding_cold", stage: 2, tags: ["social", "memory"],
        title: "Halısaha iptal",
        text: "Grup dağıldı değil. Sen düştün. Mehmet 'bu hafta olmaz' yazıyor, her hafta.",
        enTitle: "Five-a-side cancelled", enText: "The group did not break up. You dropped out of it. Mehmet writes 'not this week,' every week.",
        choices: [
          choice("apologize", "Yüzüne söyle", "Say it to his face", "Onarım ihtimali", { health: { stress: 3 }, memory: "Düğün yokluğunu yüzüne söyledin." }, { lifeStage: 3 }),
          choice("wait", "Geçmesini bekle", "Wait for it to pass", "Soğuk kalır", { health: { stress: 2 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "kart-taksit", arc: "finance", tags: ["finance", "economy"],
    nodes: [
      {
        id: "lc_card_sms", stage: 1, organic: true, minWeek: 10, needArrears: false,
        tags: ["finance", "economy"],
        if: (state) => Number(state.finances?.balance) < 4000 || Number(state.finances?.arrears) > 0,
        title: "Kart asgari, kira tam",
        text: "Banka asgariyi hatırlatıyor. Ev sahibi tamı. Asgari ile tam aynı cümlede durmaz.",
        enTitle: "Card minimum, rent in full", enText: "The bank reminds you of the minimum. The landlord of the full amount. Minimum and full do not sit in the same sentence.",
        choices: [
          choice("min", "Asgariyi öde", "Pay the minimum", "Kart durur; faiz işler", { money: -700, reason: "Kart asgari", health: { stress: 5 }, memory: "Kartı asgariyle idare ettin." }, {
            lifeStage: 1, lifeNext: { eventId: "lc_card_interest", dueWeeks: 6, key: "card-interest" }, echo: "Asgari ödendi, asıl duruyor.",
          }),
          choice("full", "Kartı kapat, kira kayar", "Clear the card, let rent slide", "Faiz durur; kira gerilir", { money: -2200, reason: "Kart kapatma", health: { stress: 6 } }, { lifeStage: 2 }),
        ],
      },
      {
        id: "lc_card_interest", stage: 2, tags: ["finance", "economy"],
        title: "Faiz de bir kira",
        text: "Ekstre geldi. Alışveriş değil, zaman satılmış. Zaman pahalıymış.",
        enTitle: "Interest is also rent", enText: "The statement arrived. Not shopping — time was sold. Time was expensive.",
        choices: [
          choice("cut", "Kartı dondur", "Freeze the card", "Harcama düşer", { health: { stress: 3 }, memory: "Kartı dondurdun." }, { lifeStage: 3 }),
          choice("use", "Bir tur daha", "One more cycle", "Nefes; faiz", { health: { stress: 6 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "komsu-gurultu", arc: "housing", tags: ["housing", "social"],
    nodes: [
      {
        id: "lc_neighbor", stage: 1, organic: true, minWeek: 14, notHome: "family",
        tags: ["housing", "social"],
        title: "Üst kat 01:10",
        text: "Çocuk değil, televizyon. Kapıya gitmek bir cesaret, not bırakmak bir evrak.",
        enTitle: "The floor above at 01:10", enText: "Not a child, a television. Going to the door is courage; leaving a note is paperwork.",
        choices: [
          choice("note", "Not bırak", "Leave a note", "Sınır; komşuluk gerilir", { health: { stress: 3 }, memory: "Üst kata not bıraktın." }, {
            lifeStage: 1, lifeNext: { eventId: "lc_neighbor_day", dueWeeks: 2, key: "neighbor-day" },
          }),
          choice("earplugs", "Kulak tıkacı", "Earplugs", "Uyku yarım", { health: { energy: -3 } }, { lifeStage: 9 }),
        ],
      },
      {
        id: "lc_neighbor_day", stage: 2, tags: ["housing", "social"],
        title: "Asansörde yüz",
        text: "Not işe yaramış ya da yaramamış. Adam 'biz de insanız' diyor. Sen de öyleydin, saat 01:10'da.",
        enTitle: "A face in the lift", enText: "The note worked or it did not. The man says 'we are people too.' So were you, at 01:10.",
        choices: [
          choice("soft", "Anlaşın, saat koyun", "Agree a time", "Barış", { health: { stress: -3, energy: 3 } }, { lifeStage: 3 }),
          choice("hard", "Yöneticiye yaz", "Write to the manager", "Resmiyet; soğuk", { health: { stress: 4 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "teyze-bakim", arc: "family", tags: ["family", "health", "cross"],
    nodes: [
      {
        id: "lc_aunt_call", stage: 1, organic: true, minWeek: 20, minAge: 22,
        tags: ["family", "health"],
        title: "Teyze, randevu, sen",
        text: "Hastane 09:40. İş 09:00. 'Birlikte gidelim' bir ricadır, vardiyadır.",
        enTitle: "Aunt, appointment, you", enText: "Hospital at 09:40. Work at 09:00. 'Let's go together' is a request and a shift.",
        choices: [
          choice("take", "Sen götür", "You take her", "Aile; iş payı kaçar", { health: { energy: -6, stress: 3 }, relationships: { anne: 4 }, memory: "Teyzeyi randevuya götürdün." }, {
            lifeStage: 1, lifeNext: { eventId: "lc_aunt_again", dueWeeks: 8, key: "aunt-again" }, echo: "Hastane koridoru aile işi oldu.",
          }),
          choice("pay-taxi", "Taksi ayır", "Get a taxi", "Nakit; sen işte kalırsın", { money: -450, reason: "Taksi", health: { stress: 2 } }, { lifeStage: 2 }),
        ],
      },
      {
        id: "lc_aunt_again", stage: 2, tags: ["family", "health"],
        title: "Kontrol de seninle",
        text: "Bir kez götürmek yardım. İkinci kez görev. Annen bunu söylemiyor, takvim söylüyor.",
        enTitle: "The follow-up is with you too", enText: "Taking her once is help. A second time is a duty. Your mother does not say that. The calendar does.",
        choices: [
          choice("again", "Yine sen", "You again", "Bağ; yorgunluk", { health: { energy: -5 }, relationships: { anne: 3 } }, { lifeStage: 3 }),
          choice("share", "Kardeşe devret", "Hand it to a sibling", "Sınır; kırgınlık ihtimali", { health: { stress: 3 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "yalnizlik", arc: "crisis", tags: ["crisis", "relationship", "health"],
    nodes: [
      {
        id: "lc_quiet_flat", stage: 1, organic: true, minWeek: 26,
        tags: ["crisis", "health"],
        if: (state) => !partnerId(state) && (state.health?.stress || 0) >= 45,
        title: "Ev sessiz, telefon da",
        text: "Bildirim yok. Bu bir başarı gibi satılıyor. Satılmıyor. Akşam uzuyor.",
        enTitle: "The flat is quiet, so is the phone", enText: "No notifications. It is being sold as an achievement. It is not selling. The evening stretches.",
        choices: [
          choice("call", "Birini ara", "Call someone", "Bağ; gurur iner", { health: { stress: -6, energy: -2 }, memory: "Sessiz evde birini aradın." }, {
            lifeStage: 1, lifeNext: { eventId: "lc_quiet_return", dueWeeks: 4, key: "quiet-return" },
          }),
          choice("scroll", "Ekranda kal", "Stay on the screen", "Uyku kaçardı", { health: { energy: -4, stress: 3 } }, { lifeStage: 9 }),
        ],
      },
      {
        id: "lc_quiet_return", stage: 2, tags: ["social", "crisis"],
        title: "Karşı taraf 'gel'",
        text: "Kısa. 'çay var.' Çay bahane, kapı gerçek.",
        enTitle: "The other side says come", enText: "Short. 'there's tea.' Tea is the excuse, the door is real.",
        choices: [
          choice("go", "Git", "Go", "Yalnızlık iner", { health: { stress: -5, energy: -3 } }, { lifeStage: 3 }),
          choice("cancel", "Yarın de", "Say tomorrow", "Kapı bir kez daha kapanır", { health: { stress: 3 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "dil-kursu", arc: "education", tags: ["education", "career", "status", "cross"],
    nodes: [
      {
        id: "lc_english_ad", stage: 1, organic: true, minWeek: 16, maxAge: 38, needJob: true,
        tags: ["education", "career"],
        title: "Akşam İngilizce",
        text: "İlan 'iş İngilizcesi' diyor. Sınıfta herkes CV. Sen yorgunsun, fiil de yorgun.",
        enTitle: "Evening English", enText: "The ad says 'business English.' Everyone in the room is a CV. You are tired, and so is the verb.",
        choices: [
          choice("join", "Yazıl", "Join", "Zaman ve para; kapı belki", { money: -1800, reason: "Dil kursu", health: { energy: -5, stress: 4 }, memory: "Akşam dil kursuna yazıldın." }, {
            lifeStage: 1, lifeNext: { eventId: "lc_english_talk", dueWeeks: 8, key: "eng-talk" }, echo: "Akşamlar fiile gitti.",
          }),
          choice("skip", "Bu dönem değil", "Not this term", "Beden durur", {}, { lifeStage: 9 }),
        ],
      },
      {
        id: "lc_english_talk", stage: 2, tags: ["education", "status"],
        title: "Speaking, susmak",
        text: "Sıra sende. Cümle Türkçe kuruluyor içerde, dışarı çıkmıyor. Hocanın gülümsemesi not değil.",
        enTitle: "Speaking, staying quiet", enText: "Your turn. The sentence is built in Turkish inside and does not come out. The teacher's smile is not a grade.",
        choices: [
          choice("speak", "Yanlış da olsa konuş", "Speak even if it is wrong", "Utanç; ilerleme", { health: { stress: 4, energy: -2 } }, { lifeStage: 3 }),
          choice("pass", "Pass de", "Say pass", "Rahat; kapı daralır", { health: { stress: -1 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "ofis-siyaset", arc: "career", tags: ["career", "status", "cross"],
    nodes: [
      {
        id: "lc_office_cc", stage: 1, organic: true, minWeek: 14, needJob: true,
        tags: ["career", "status"],
        title: "CC'de ismin yok",
        text: "Toplantı maili senden geçmemiş. İş senin işin. İsim başkasının.",
        enTitle: "Your name is not on CC", enText: "The meeting mail did not pass through you. The work is yours. The name is someone else's.",
        choices: [
          choice("ask", "Neden yokum de", "Ask why you are not on it", "Görünürlük; sürtünme", { health: { stress: 5 }, memory: "CC dışı bırakılmayı konuştun." }, {
            lifeStage: 1, lifeNext: { eventId: "lc_office_side", dueWeeks: 4, key: "office-side" },
          }),
          choice("work", "İşi bitir, konuşma", "Finish the work, do not talk", "Sadakat; görünmezlik", { health: { energy: -4 } }, { lifeStage: 2 }),
        ],
      },
      {
        id: "lc_office_side", stage: 2, tags: ["career", "social"],
        title: "Koridorda fısıltı",
        text: "Birisi 'sen çok üstüne gidiyorsun' diyor. Gitmemek de gidiyor olmak.",
        enTitle: "A whisper in the corridor", enText: "Someone says you are pushing too hard. Not going is also a way of going.",
        choices: [
          choice("soft", "Bir adım geri", "One step back", "Barış; ivme düşer", { health: { stress: -3 } }, { lifeStage: 3 }),
          choice("push", "Dosyayı tamamla, sesin dursun", "Finish the file, let the work speak", "Risk; kayıt", { health: { stress: 5 } }, { lifeStage: 3, echo: "İsim CC'ye geçti ya da geçmedi; dosya duruyor." }),
        ],
      },
    ],
  },
  {
    id: "mentor-cikis", arc: "career", tags: ["career", "social"],
    nodes: [
      {
        id: "lc_mentor_leave", stage: 1, organic: true, minWeek: 32, needJob: true, needActor: "burak",
        tags: ["career"],
        title: "Burak istifa etmiş",
        text: "Mail kısa. 'kanka ben cıkıyorum. sen kalırsan yaz.' Kalmak da bir istifa gibi duruyor şimdi.",
        enTitle: "Burak has resigned", enText: "Short mail. 'kanka I am leaving. write if you stay.' Staying now looks like a resignation too.",
        choices: [
          choice("write", "Yaz, bağla", "Write, stay tied", "Network durur", { health: { stress: 2 }, memory: "Burak çıkınca bağı tuttun." }, {
            lifeStage: 1, npcMemory: { personId: "burak", text: "Çıkışında yazdı.", type: "lc_burak_kept" },
            lifeNext: { eventId: "lc_mentor_ref", dueWeeks: 10, key: "mentor-ref" },
          }),
          choice("ghost", "İşine bak", "Mind your work", "Bağ soğur", { health: { stress: 1 } }, { lifeStage: 9 }),
        ],
      },
      {
        id: "lc_mentor_ref", stage: 2, tags: ["career", "memory"],
        title: "Eski bağ, yeni kapı",
        text: "Burak: 'bir isim var. senin adını verdim. kızma.' Kızmak ayrı, kapı ayrı.",
        enTitle: "An old tie, a new door", enText: "Burak: 'there is a name. I gave yours. don't be mad.' Being mad is one thing, the door is another.",
        choices: [
          choice("use", "Konuş, bak", "Talk, look", "Fırsat; borç hissi", { health: { stress: 4 }, memory: "Burak'ın ismini kullandın." }, {
            lifeStage: 3, opportunity: "Burak'ın yeni kapısı", echo: "Eski bağ iş kapısı oldu.",
          }),
          choice("hold", "Şimdilik yok", "Not for now", "Bağ sade kalır", { health: { stress: -1 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "deniz-kira", arc: "family", tags: ["family", "finance", "cross"],
    nodes: [
      {
        id: "lc_sibling_rent", stage: 1, organic: true, minWeek: 18, needActor: "kardes",
        tags: ["family", "finance", "memory"],
        title: "Deniz, kira, gurur",
        text: "zaten bir kere sordum. ikinciyi sormam. mesaj bu. rakam yok, var.",
        enTitle: "Deniz, rent, pride", enText: "i already asked once. i will not ask twice. that is the message. there is no number, and there is.",
        choices: [
          choice("send", "Gönder, sorma", "Send it, do not ask", "Nakit iner; hatıra kalır", { money: -1800, reason: "Kardeş kirası", relationships: { kardes: 8 }, memory: "Deniz'in kirasına sessizce destek oldun." }, {
            lifeStage: 1, npcMemory: { personId: "kardes", text: "Kira için sormadan gönderdi.", type: "lc_helped_sibling" },
            lifeNext: { eventId: "lc_sibling_back", dueWeeks: 14, key: "sibling-back" }, echo: "Gurur kırılmadan kira bağlandı.",
          }),
          choice("ask", "Ne kadar diye sor", "Ask how much", "Netlik; gurur gerilir", { health: { stress: 3 } }, { lifeStage: 2 }),
        ],
      },
      {
        id: "lc_sibling_back", stage: 2, tags: ["family", "memory"],
        title: "Kapıda poşet",
        text: "Deniz bırakmış, zil çalmamış. İçinde senin unuttuğun şarj aleti ve bir not: 'bu sefer ben.'",
        enTitle: "A bag at the door", enText: "Deniz left it, did not ring. Inside, the charger you forgot and a note: 'this time me.'",
        choices: [
          choice("thanks", "Yaz, sağ ol", "Write, thank you", "Bağ düzgün kalır", { health: { stress: -3 } }, { lifeStage: 3 }),
          choice("return", "Parayı iade et", "Return the money", "Gurur savaşı", { money: -500, reason: "İade ısrarı" }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "elif-zaman", arc: "relationship", tags: ["relationship", "career", "health", "cross"],
    nodes: [
      {
        id: "lc_elif_calendar", stage: 1, organic: true, minWeek: 16, needPartner: true,
        tags: ["relationship", "career", "memory"],
        if: (state) => partnerId(state) === "elif" || (state.relationships?.elif || 0) >= 40,
        title: "Elif, takvim, boş kutu",
        text: "Takvim değil, ayırdığın zaman konuşuyor. Mesaj tam cümle: 'Bu hafta da yoksan söyle, yokum diye ayarlayayım.'",
        enTitle: "Elif, calendar, empty box", enText: "It is not the calendar. It is the time you did not set aside. A complete sentence: 'If you are not there this week either, say so, I will arrange to be absent.'",
        choices: [
          choice("block", "Akşamı kilitle", "Lock the evening", "İlişki; iş payı kaçar", { health: { energy: -3, stress: -5 }, memory: "Elif için bir akşamı kilitledin." }, {
            lifeStage: 1, npcMemory: { personId: "elif", text: "Bir akşamı benim için kilitledi.", type: "lc_elif_time" },
            lifeNext: { eventId: "lc_elif_walk", dueWeeks: 5, key: "elif-walk" },
          }),
          choice("delay", "Yarın netleşir de", "Say it will be clear tomorrow", "Mesafe", { health: { stress: 5 } }, {
            lifeStage: 1, npcMemory: { personId: "elif", text: "Yine yarın dedi.", type: "lc_elif_delay" },
            lifeNext: { eventId: "lc_elif_distance", dueWeeks: 6, key: "elif-distance" },
          }),
        ],
      },
      {
        id: "lc_elif_walk", stage: 2, tags: ["relationship"],
        title: "Moda, iki yavaş adım",
        text: "Konuşulacak büyük şey yok. Olmaması büyük şey. Deniz kokusu iş mailinden uzun.",
        enTitle: "Moda, two slow steps", enText: "There is no large thing to discuss. That is the large thing. The smell of the sea is longer than a work mail.",
        choices: [
          choice("stay", "Geç dön", "Come back late", "Bağ; uyku", { health: { energy: -4, stress: -6 } }, { lifeStage: 3 }),
          choice("home", "Yarın erken var", "An early start tomorrow", "Sınır", { health: { stress: 2 } }, { lifeStage: 3 }),
        ],
      },
      {
        id: "lc_elif_distance", stage: 2, tags: ["relationship", "memory"],
        title: "Cümle kurulmadı",
        text: "Elif 'tamam' demiş. Tamam, bitiş cümlesidir bazen. Nokta var, soru yok.",
        enTitle: "The sentence was not built", enText: "Elif said 'alright.' Alright is sometimes a closing sentence. There is a period, no question.",
        choices: [
          choice("repair", "Yüzüne anlat", "Tell it to her face", "Onarım şansı", { health: { stress: 4, energy: -3 }, memory: "Elif'le mesafeyi konuştun." }, { lifeStage: 3 }),
          choice("accept", "Tamamı kabul et", "Accept the alright", "Mesafe yerleşir", { health: { stress: 3 } }, { lifeStage: 3, echo: "İlişki 'tamam' ile inceldi." }),
        ],
      },
    ],
  },
  {
    id: "anne-borc", arc: "family", tags: ["family", "finance", "memory", "cross"],
    nodes: [
      {
        id: "lc_anne_ask", stage: 1, organic: true, minWeek: 14, needActor: "anne",
        tags: ["family", "finance"],
        title: "Annen, sayı, utanç yok",
        text: "Kızım bak, baban karışmaz ama ben karışırım. Bu ay bir yer bağlanacak. Rakam söylemiyor, söylüyor.",
        enTitle: "Mum, a number, no shame", enText: "Listen: your father will not interfere, I will. Something has to be tied this month. She is not saying the number, and she is.",
        choices: [
          choice("give", "Ver, sorma", "Give it, do not ask", "Nakit iner; hatıra kalır", { money: -2000, reason: "Aile desteği", relationships: { anne: 7, baba: 2 }, memory: "Annenin sıkışmasına sordurmadan destek oldun." }, {
            lifeStage: 1, npcMemory: { personId: "anne", text: "Sormadan verdi.", type: "lc_family_money" },
            lifeNext: { eventId: "lc_anne_pot", dueWeeks: 12, key: "anne-pot" }, echo: "Aile hesabı senin bakiyeden geçti.",
          }),
          choice("half", "Yarısını gönder", "Send half", "Sınır; sitem", { money: -900, reason: "Kısmi destek", relationships: { anne: 2 }, health: { stress: 3 } }, { lifeStage: 2 }),
        ],
      },
      {
        id: "lc_anne_pot", stage: 2, tags: ["family", "memory"],
        title: "Tencere sende",
        text: "Annen bırakmış. Not yok. Yemek, faiz değil, hatır.",
        enTitle: "The pot is yours", enText: "Your mother left it. No note. The food is not interest. It is a reminder.",
        choices: [
          choice("eat", "Ye, ara", "Eat, call", "Bağ durur", { health: { energy: 3, stress: -3 } }, { lifeStage: 3 }),
          choice("return", "Ertesi gün tencereyi götür", "Take the pot back the next day", "Ziyaret", { health: { energy: -3 }, relationships: { anne: 3 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "mehmet-nakit", arc: "social", tags: ["social", "finance", "memory", "cross"],
    nodes: [
      {
        id: "lc_mehmet_cash", stage: 1, organic: true, minWeek: 11, needActor: "mehmet",
        tags: ["social", "finance"],
        title: "kanka rakam net",
        text: "kanka rakam net. şaka değil bu sefer. 3.500. çarşamba. annene söyleme.",
        enTitle: "kanka the number is clear", enText: "kanka the number is clear. not a joke this time. 3,500. Wednesday. don't tell your mum.",
        choices: [
          choice("lend", "Ver", "Lend it", "Nakit iner; hatıra doğar", { money: -3500, reason: "Mehmet nakit", health: { stress: 4 }, memory: "Mehmet'e 3.500 verdin." }, {
            lifeStage: 1, npcMemory: { personId: "mehmet", text: "3.500'ü verdi, söylemedi.", type: "lc_helped_mehmet_money" },
            lifeNext: { eventId: "lc_mehmet_payback", dueWeeks: 12, key: "mehmet-pay" }, echo: "Nakit gitti, isim kaldı.",
          }),
          choice("no", "Bu ay yok", "Not this month", "Bağ gerilir", { health: { stress: 3 }, relationships: { mehmet: -4 } }, {
            lifeStage: 1, npcMemory: { personId: "mehmet", text: "Bu ay yok dedi.", type: "lc_refused_mehmet" },
            lifeNext: { eventId: "lc_mehmet_coldcash", dueWeeks: 9, key: "mehmet-cold" },
          }),
        ],
      },
      {
        id: "lc_mehmet_payback", stage: 2, tags: ["social", "memory", "finance"],
        title: "IBAN geldi",
        text: "Eksik değil. Fazla da değil. 'sağ ol kanka' ayrı satırda. Nokta yok.",
        enTitle: "The IBAN arrived", enText: "Not short. Not extra either. 'sağ ol kanka' on its own line. No period.",
        choices: [
          choice("ok", "Sağ ol yaz", "Write sağ ol", "Hesap kapanır", { money: 3500, reason: "Mehmet iade", health: { stress: -4 } }, { lifeStage: 3 }),
          choice("keep", "Biraz tut, sonra konuş", "Hold a bit, talk later", "Güvensizlik", { health: { stress: 3 } }, { lifeStage: 3 }),
        ],
      },
      {
        id: "lc_mehmet_coldcash", stage: 2, tags: ["social", "memory"],
        title: "Halısaha yok",
        text: "Grup susuyor. Mehmet hikâye atıyor, sen yoksun. Borç konuşulmadan konuşuluyor.",
        enTitle: "No five-a-side", enText: "The group is quiet. Mehmet posts a story, you are not in it. The debt is being discussed without being discussed.",
        choices: [
          choice("repair", "Bir çay ısmarla, konuşma", "Buy a tea, do not talk about it", "Onarım", { money: -80, reason: "Çay", health: { stress: -2 } }, { lifeStage: 3 }),
          choice("leave", "Soğuk dursun", "Let it stay cold", "Mesafe", { health: { stress: 2 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
];

const MORE_CHAINS = [
  {
    id: "cenaze-yol", arc: "family", tags: ["family", "finance", "cross", "phase-mid"],
    nodes: [
      {
        id: "lc_funeral_call", stage: 1, organic: true, minWeek: 20, minAge: 20, needActor: "anne",
        tags: ["family", "finance", "phase-mid"],
        title: "Gece araması, gündüz otobüs",
        text: "Annen 'deden' demiyor, 'yola bak' diyor. Bilet, izin, siyah gömlek. Üç kalem yine.",
        enTitle: "A night call, a morning bus", enText: "Your mother does not say 'your grandfather.' She says 'look at the road.' Ticket, leave, a black shirt. Three lines again.",
        choices: [
          choice("go", "Bileti al, git", "Buy the ticket, go", "Nakit ve izin; aile durur", { money: -1400, reason: "Cenaze yolu", health: { energy: -6, stress: 4 }, relationships: { anne: 6, baba: 4 }, memory: "Cenazeye yetiştin." }, {
            lifeStage: 1, npcMemory: { personId: "anne", text: "Cenazeye yetişti.", type: "lc_funeral_came" },
            lifeNext: { eventId: "lc_funeral_house", dueWeeks: 2, key: "funeral-house" }, echo: "Yol kısa tutulmadı.",
          }),
          choice("send", "Çelenk gönder, yetişemem de", "Send a wreath, say you cannot make it", "Nakit küçük; sitem büyük", { money: -600, reason: "Çelenk", relationships: { anne: -5 }, health: { stress: 6 }, memory: "Cenazeye yetişemedin." }, {
            lifeStage: 1, npcMemory: { personId: "anne", text: "Cenazeye yetişemedi.", type: "lc_funeral_missed" },
            lifeNext: { eventId: "lc_funeral_cold", dueWeeks: 6, key: "funeral-cold" },
          }),
        ],
      },
      {
        id: "lc_funeral_house", stage: 2, tags: ["family", "memory"],
        title: "Ev dolu, oda senin değil",
        text: "Çay sürekli. Baba konuşmuyor, bu sefer doğru dürüst. Annen 'yemek dağıt' diyor, yas da bir vardiya.",
        enTitle: "The house is full, the room is not yours", enText: "Tea is constant. Your father is not talking, properly this time. Your mother says 'hand out the food.' Grief is also a shift.",
        choices: [
          choice("serve", "Dağıt, dur", "Hand it out, stay", "Bağ; yorgunluk", { health: { energy: -5 }, relationships: { anne: 3 } }, {
            lifeStage: 2, lifeNext: { eventId: "lc_funeral_year", dueWeeks: 16, key: "funeral-year" },
          }),
          choice("corner", "Köşede otur", "Sit in the corner", "Mesafe", { health: { stress: 3 } }, { lifeStage: 3 }),
        ],
      },
      {
        id: "lc_funeral_cold", stage: 2, tags: ["family", "memory", "crisis"],
        title: "Grup fotoğrafı yok, sitem var",
        text: "Annen 'haberin olsun diye yazdım' diyor. Haber, yetişmek değilmiş.",
        enTitle: "No group photo, a complaint", enText: "Your mother says she wrote so you would know. Knowing was not the same as arriving.",
        choices: [
          choice("visit", "Hafta sonu git", "Go at the weekend", "Geç onarım", { health: { energy: -4 }, relationships: { anne: 4 } }, { lifeStage: 3 }),
          choice("hold", "Mesajla geç", "Let a message cover it", "Sitem kalır", { health: { stress: 4 } }, { lifeStage: 3 }),
        ],
      },
      {
        id: "lc_funeral_year", stage: 3, tags: ["family", "memory", "phase-mid"],
        title: "Mezarlık, bir yıl sonra",
        text: "Aynı otobüs, daha az çanta. Baba sigara yakıyor, cümle yine yarım.",
        enTitle: "The cemetery, a year later", enText: "The same bus, fewer bags. Your father lights a cigarette, the sentence half-finished again.",
        choices: [
          choice("stand", "Dur, konuşma", "Stand, do not talk", "Paylaşılan sessizlik", { health: { stress: -3 } }, { lifeStage: 4 }),
          choice("ask", "Baba, nasılsın de", "Ask your father how he is", "Kapı aralanır", { relationships: { baba: 4 }, health: { stress: 2 } }, { lifeStage: 4 }),
        ],
      },
    ],
  },
  {
    id: "aidat-toplantı", arc: "housing", tags: ["housing", "social", "economy", "cross"],
    nodes: [
      {
        id: "lc_dues_meet", stage: 1, organic: true, minWeek: 18, notHome: "family",
        tags: ["housing", "economy", "social"],
        title: "Aidat toplantısı, asansör kokusu",
        text: "Gündem: boya. Asıl gündem: kim ödememiş. Sen hem kiracısın hem yüz.",
        enTitle: "Dues meeting, lift smell", enText: "Agenda: paint. Real agenda: who has not paid. You are both the tenant and a face.",
        choices: [
          choice("pay", "Aidatı kapat, sus", "Clear the dues, stay quiet", "Nakit iner; barış", { money: -900, reason: "Aidat", health: { stress: 3 }, memory: "Aidat toplantısında hesabı kapattın." }, {
            lifeStage: 1, lifeNext: { eventId: "lc_dues_paint", dueWeeks: 5, key: "dues-paint" },
          }),
          choice("ask", "Kira mı aidat mı diye sor", "Ask if this is rent or dues", "Netlik; soğuk", { health: { stress: 4 } }, { lifeStage: 2 }),
        ],
      },
      {
        id: "lc_dues_paint", stage: 2, tags: ["housing", "social"],
        title: "Boya kokusu, kapı çizik",
        text: "Boya bitti. Çizik duruyor. Yönetici 'estetik' diyor. Estetik, senin depoziton değil.",
        enTitle: "Paint smell, a scratch on the door", enText: "The paint is done. The scratch remains. The manager says 'aesthetics.' Aesthetics is not your deposit.",
        choices: [
          choice("photo", "Çizik fotoğrafı çek", "Photograph the scratch", "Kayıt; komşuluk gerilir", { health: { stress: 3 }, memory: "Kapı çizğini kayda aldın." }, { lifeStage: 3 }),
          choice("leave", "Bırak, otur", "Leave it, live there", "Huzur; hak uyanır", { health: { stress: -2 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "torpil-koku", arc: "career", tags: ["career", "status", "cross"],
    nodes: [
      {
        id: "lc_ref_offer", stage: 1, organic: true, minWeek: 22, needJob: true, needActor: "burak",
        tags: ["career", "status"],
        title: "Burak 'bir isim söyleyeyim'",
        text: "Mail: 'kanka bu kadro senin işin. isim lazım. iletme.' İsim, liyakat cümlesinin yanına oturmuyor.",
        enTitle: "Burak: I can drop a name", enText: "Mail: 'kanka this post is your work. a name is needed. do not forward.' A name does not sit next to the merit sentence.",
        choices: [
          choice("use", "İsmi kullan", "Use the name", "Kapı açılır; borç doğar", { health: { stress: 5 }, memory: "Kadro için isim kullandın." }, {
            lifeStage: 1, npcMemory: { personId: "burak", text: "İsmini kadro için kullandı.", type: "lc_used_ref" },
            lifeNext: { eventId: "lc_ref_debt", dueWeeks: 8, key: "ref-debt" }, echo: "Kapı açıldı, isim içeride kaldı.",
          }),
          choice("file", "Dosyayla gir", "Go in on the file", "Yavaş; borç yok", { health: { energy: -3, stress: 3 }, memory: "İsmi bırakıp dosyayla gittin." }, {
            lifeStage: 1, lifeNext: { eventId: "lc_ref_file", dueWeeks: 6, key: "ref-file" },
          }),
        ],
      },
      {
        id: "lc_ref_debt", stage: 2, tags: ["career", "memory", "status"],
        title: "Karşılık maili",
        text: "Burak: 'bir imza lazım. senin katın.' İmza küçük, katın değil.",
        enTitle: "The return mail", enText: "Burak: 'a signature is needed. your floor.' The signature is small. The floor is not.",
        choices: [
          choice("sign", "İmzala", "Sign it", "Borç kapanır; risk açılır", { health: { stress: 6 }, memory: "İsim borcunu imzayla ödedin." }, { lifeStage: 3, echo: "Referans, tek yön değildi." }),
          choice("hold", "Bu imza olmaz de", "Say this signature will not happen", "Sınır; bağ gerilir", { health: { stress: 5 } }, { lifeStage: 3 }),
        ],
      },
      {
        id: "lc_ref_file", stage: 2, tags: ["career", "status"],
        title: "Dosya sırada, isim önde",
        text: "Kısa listeye girmedin. Giren isim, senin işini anlatıyor. Anlatmak, yapmak değil.",
        enTitle: "The file is in line, the name is ahead", enText: "You did not make the shortlist. The name that did is describing your work. Describing is not doing.",
        choices: [
          choice("stay", "Kadroda kal, işi bitir", "Stay, finish the work", "Sadakat; öfke", { health: { stress: 4 } }, { lifeStage: 3 }),
          choice("look", "Dışarı bak", "Look outside", "Hareket", { health: { energy: -3, stress: 3 }, memory: "İsimsiz kaldığın yerden dışarı baktın." }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "nufus-kuyruk", arc: "crisis", tags: ["crisis", "phase-open"],
    nodes: [
      {
        id: "lc_id_queue", stage: 1, organic: true, minWeek: 8, maxAge: 28, maxWeek: 80,
        tags: ["crisis", "phase-open"],
        title: "Nüfus kuyruğu, numara 184",
        text: "İkametgâh, askerlik belgesi, bir imza. Gişe 'eksik evrak' diyor. Evrak sende, sistemde yok.",
        enTitle: "Civil-registry queue, ticket 184", enText: "Residence paper, military paper, one signature. The window says 'missing file.' The file is on you. It is not in the system.",
        choices: [
          choice("wait", "Sıra bekle, tamamla", "Wait the line, finish it", "Zaman; iş payı kaçar", { health: { energy: -6, stress: 4 }, memory: "Nüfus kuyruğunda evrakı tamamladın." }, {
            lifeStage: 1, lifeNext: { eventId: "lc_id_stamp", dueWeeks: 3, key: "id-stamp" },
          }),
          choice("later", "Bu hafta olmaz", "Not this week", "İş durur; kuyruk uzar", { health: { stress: 3 } }, { lifeStage: 9 }),
        ],
      },
      {
        id: "lc_id_stamp", stage: 2, tags: ["crisis", "career"],
        title: "Kaşe vuruldu, gün bitti",
        text: "Kâğıt tamam. Müdür 'neden yoktun' yazmış. Cevap: 184.",
        enTitle: "The stamp landed, the day ended", enText: "The paper is done. The manager wrote 'why were you out.' The answer is 184.",
        choices: [
          choice("explain", "Kuyruğu anlat", "Explain the queue", "Şeffaflık; ciddiyet kaçar", { health: { stress: 3 } }, { lifeStage: 3 }),
          choice("cover", "Randevuydu de", "Say it was an appointment", "İş durur; cümle eğilir", { health: { stress: 2 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "plaza-hesap", arc: "status", tags: ["status", "finance", "social", "cross"],
    nodes: [
      {
        id: "lc_plaza_lunch", stage: 1, organic: true, minWeek: 24, needJob: true, minAge: 23,
        tags: ["status", "finance", "phase-mid"],
        title: "Plaza öğle yemeği",
        text: "Menü İngilizce, fiyat Türkçe. Masada 'yazlık' konuşuluyor. Sen kira konuşmuyorsun.",
        enTitle: "Plaza lunch", enText: "The menu is in English, the prices in Turkish. The table is talking about a summer house. You are not talking about rent.",
        choices: [
          choice("stay", "Kal, payına bak", "Stay, watch your share", "Aidiyet jesti; nakit", { money: -1100, reason: "Plaza öğle", health: { stress: 5 }, memory: "Plaza öğle yemeğinde kaldın." }, {
            lifeStage: 1, lifeNext: { eventId: "lc_plaza_invite", dueWeeks: 7, key: "plaza-invite" }, echo: "Hesap aidiyet gibi durdu, durmadı.",
          }),
          choice("out", "Sandviç al, dön", "Get a sandwich, go back", "Tasarruf; dışarıda kalma", { health: { stress: 3 } }, { lifeStage: 9 }),
        ],
      },
      {
        id: "lc_plaza_invite", stage: 2, tags: ["status", "social", "finance"],
        title: "Cuma 'bir yerler'",
        text: "Mekan adı marka. Marka, maaşın bir haftası. Gelmemek de bir cevap.",
        enTitle: "Friday 'somewhere'", enText: "The place is a brand. The brand is a week of salary. Not coming is also an answer.",
        choices: [
          choice("go", "Git, bir kadeh", "Go, one glass", "Çevre; nakit", { money: -850, reason: "Cuma mekanı", health: { energy: -4, stress: 3 } }, { lifeStage: 3 }),
          choice("skip", "Eve yaz", "Write that you are going home", "Mahalle durur", { health: { energy: 3 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "gec-uni", arc: "education", tags: ["education", "career", "phase-late", "cross"],
    nodes: [
      {
        id: "lc_late_school", stage: 1, organic: true, minWeek: 80, minAge: 36, maxAge: 52, needJob: true,
        tags: ["education", "phase-late"],
        title: "İkinci üniversite broşürü",
        text: "Akşam bölümü. Sınıfta senin yaşında üç kişi. CV 'eksik' demiş bir ilan. Eksik, geç değilmiş.",
        enTitle: "A second-university brochure", enText: "Evening division. Three people your age in the room. A listing called the CV 'incomplete.' Incomplete was not the same as late.",
        choices: [
          choice("enroll", "Yazıl", "Enroll", "Zaman ve para; geç kapı", { money: -2400, reason: "İkinci eğitim", health: { energy: -6, stress: 5 }, memory: "Otuzların sonunda ikinci eğitime yazıldın." }, {
            lifeStage: 1, lifeNext: { eventId: "lc_late_exam", dueWeeks: 10, key: "late-exam" }, echo: "Akşamlar tekrar sıraya girdi.",
          }),
          choice("skip", "Bu tren geçti de", "Say this train has gone", "Beden durur; cümle kapanır", { health: { stress: 2 } }, { lifeStage: 9 }),
        ],
      },
      {
        id: "lc_late_exam", stage: 2, tags: ["education", "health", "phase-late"],
        title: "Vize haftası, vardiya haftası",
        text: "Çocuk varsa çocuk, yoksa yorgunluk. Kitap açık, göz 00:40.",
        enTitle: "Midterm week, shift week", enText: "If there is a child, the child. If not, tiredness. The book is open, the eyes at 00:40.",
        choices: [
          choice("sit", "Sınava gir", "Sit the exam", "İlerleme; uyku", { health: { energy: -8, stress: 6 } }, { lifeStage: 3, opportunity: "İkinci eğitim kapısı" }),
          choice("drop", "Dönemi bırak", "Drop the term", "Beden; yarım kâğıt", { health: { energy: 6, stress: -4 }, memory: "İkinci eğitimi yarıda bıraktın." }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "iftar-mesai", arc: "family", tags: ["family", "career", "health", "cross"],
    nodes: [
      {
        id: "lc_iftar_call", stage: 1, organic: true, minWeek: 12, needActor: "anne", needJob: true,
        tags: ["family", "career", "phase-open"],
        title: "İftar saati, teslim saati",
        text: "Annen: 'sofrayı bekletmem.' Patron: 'kapanış.' İki ezan, bir masa.",
        enTitle: "Iftar time, deadline time", enText: "Your mother: 'I will not hold the table.' The boss: 'close.' Two calls to prayer, one table.",
        choices: [
          choice("home", "İftara yetiş", "Make iftar", "Aile; iş payı kaçar", { health: { energy: -3, stress: -4 }, relationships: { anne: 5, baba: 3 }, memory: "Mesaiye rağmen iftara yetiştin." }, {
            lifeStage: 1, npcMemory: { personId: "anne", text: "İftara yetişti.", type: "lc_iftar_came" },
            lifeNext: { eventId: "lc_iftar_table", dueWeeks: 4, key: "iftar-table" },
          }),
          choice("stay", "Kapanışa kal", "Stay for close", "Kariyer; boş tabak", { health: { energy: -6, stress: 5 }, relationships: { anne: -4 }, memory: "İftarı mesaiye verdin." }, {
            lifeStage: 1, npcMemory: { personId: "anne", text: "İftara yetişemedi.", type: "lc_iftar_missed" },
            lifeNext: { eventId: "lc_iftar_cold", dueWeeks: 5, key: "iftar-cold" },
          }),
        ],
      },
      {
        id: "lc_iftar_table", stage: 2, tags: ["family", "memory"],
        title: "Hurma, susuş, çay",
        text: "Baba 'geç kaldın ama geldin' demiyor. Demese de tabak duruyor.",
        enTitle: "Dates, a hush, tea", enText: "Your father does not say 'you were late but you came.' Even without saying it, the plate is there.",
        choices: [
          choice("stay-tea", "Çaya kal", "Stay for tea", "Bağ", { health: { stress: -3 } }, { lifeStage: 3 }),
          choice("work-mail", "Maili bak, masada", "Check mail at the table", "İş sızar", { health: { stress: 3 } }, { lifeStage: 3 }),
        ],
      },
      {
        id: "lc_iftar_cold", stage: 2, tags: ["family", "memory"],
        title: "Sofradan fotoğraf, sen yoksun",
        text: "Annen 'yemekleri kaldırdık' yazmış. Kaldırmak, beklemek değil.",
        enTitle: "A photo from the table, you are not in it", enText: "Your mother wrote 'we cleared the food.' Clearing is not waiting.",
        choices: [
          choice("sahur", "Sahura git", "Go to sahur", "Geç jest", { health: { energy: -5 }, relationships: { anne: 3 } }, { lifeStage: 3 }),
          choice("msg", "Özür mesajı", "An apology text", "Zayıf onarım", { health: { stress: 2 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "baba-sessiz", arc: "family", tags: ["family", "health", "memory", "cross"],
    nodes: [
      {
        id: "lc_father_cough", stage: 1, organic: true, minWeek: 26, minAge: 22, needActor: "baba",
        tags: ["family", "health", "memory"],
        title: "Baba, öksürük, televizyon",
        text: "Bak, ben karışmam. Karışmazsam da duyarım. Öksürük reklam arasından uzun.",
        enTitle: "Father, a cough, the television", enText: "Look, I stay out of it. Staying out is not the same as not hearing. The cough is longer than the ad break.",
        choices: [
          choice("ask", "Doktora gidelim de", "Say let's go to a doctor", "Sınır ihlali; ihtimal", { health: { stress: 3 }, relationships: { baba: 3 }, memory: "Babanın öksürüğünü konuştun." }, {
            lifeStage: 1, npcMemory: { personId: "baba", text: "Öksürüğü konuşuldu.", type: "lc_father_health" },
            lifeNext: { eventId: "lc_father_clinic", dueWeeks: 5, key: "father-clinic" },
          }),
          choice("tea", "Çay koy, sorma", "Pour tea, do not ask", "Saygı; ihmal", { health: { stress: 2 } }, { lifeStage: 2 }),
        ],
      },
      {
        id: "lc_father_clinic", stage: 2, tags: ["family", "health", "memory"],
        title: "Koridor, sıra, gurur",
        text: "Baba 'ben karışmam' diyor yine. Kayıt kâğıdını sen dolduruyorsun.",
        enTitle: "Corridor, queue, pride", enText: "Your father says he will not interfere, again. You are filling in the form.",
        choices: [
          choice("wait", "Sırada kal", "Stay in the queue", "Zaman; bakım", { health: { energy: -4 }, relationships: { baba: 4 } }, { lifeStage: 3 }),
          choice("work", "İşe dön, o kalsın", "Go back to work, leave him", "Kariyer; borç cümlesi", { health: { stress: 5 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "depozito-iade", arc: "housing", tags: ["housing", "finance", "economy", "cross"],
    nodes: [
      {
        id: "lc_deposit_ask", stage: 1, organic: true, minWeek: 28, notHome: "family",
        tags: ["housing", "finance", "economy"],
        title: "Depozito, 'boya düşer'",
        text: "Taşınıyorsun. Ev sahibi 'duvar' diyor. Duvar senin değil, iz seninmiş.",
        enTitle: "The deposit, 'paint comes off'", enText: "You are moving. The landlord says 'the wall.' The wall is not yours. The mark apparently is.",
        choices: [
          choice("fight", "Tutanak tut, iste", "Write a record, ask for it", "Hak; kavga", { health: { stress: 6 }, memory: "Depozitoyu yazılı istedin." }, {
            lifeStage: 1, lifeNext: { eventId: "lc_deposit_wait", dueWeeks: 6, key: "deposit-wait" },
          }),
          choice("cut", "Bir kısmını bırak, çık", "Leave some, leave", "Nakit kaybı; hız", { money: -1800, reason: "Kesilen depozito", health: { stress: 4 } }, { lifeStage: 3 }),
        ],
      },
      {
        id: "lc_deposit_wait", stage: 2, tags: ["housing", "finance", "memory"],
        title: "IBAN'a düşmeyen",
        text: "İki hafta. 'Hesap işi' demişti. Hesap işi, senin kira peşinatı.",
        enTitle: "It did not land on the IBAN", enText: "Two weeks. He had said 'an account thing.' The account thing is your next deposit.",
        choices: [
          choice("legal", "Tüketiciye yaz", "Write to consumer affairs", "Süreç; enerji", { health: { energy: -4, stress: 5 }, memory: "Depozito için resmi yola gittin." }, { lifeStage: 3 }),
          choice("drop", "Bırak, yeni eve bak", "Drop it, look at the new place", "Huzur; nakit gitti", { health: { stress: -2 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "issizlik-ilan", arc: "career", tags: ["career", "crisis", "finance", "cross"],
    nodes: [
      {
        id: "lc_jobless_ad", stage: 1, organic: true, minWeek: 20, notRetired: true,
        tags: ["career", "crisis", "economy"],
        if: (state) => !state.career?.jobId && state.career?.retirement?.status !== "retired",
        title: "İlan 'acil aranıyor'",
        text: "Acil, her ilanda var. Cevap yok. Annen çay koyuyor, ilan koymuyor.",
        enTitle: "The listing says urgently wanted", enText: "Urgent is on every listing. No answer. Your mother pours tea, not listings.",
        choices: [
          choice("spray", "On ilan daha", "Ten more listings", "Tempo; umut", { health: { energy: -6, stress: 5 }, memory: "İşsiz haftada ilan yağdırdın." }, {
            lifeStage: 1, lifeNext: { eventId: "lc_jobless_call", dueWeeks: 3, key: "jobless-call" },
          }),
          choice("day", "Bugün yok, yürü", "Not today, walk", "Beden; gecikme", { health: { energy: 5, stress: -3 } }, { lifeStage: 2 }),
        ],
      },
      {
        id: "lc_jobless_call", stage: 2, tags: ["career", "memory"],
        title: "Mülakat, asansör, 'neden boştaydın'",
        text: "Cümle hazır. Söylenince ucuz duruyor. Boş olmak da bir işmiş.",
        enTitle: "Interview, lift, why were you out", enText: "The sentence is ready. Said out loud it sounds cheap. Being out of work was also a job.",
        choices: [
          choice("honest", "Doğrusunu söyle", "Tell it straight", "Risk; nefes", { health: { stress: 4 } }, { lifeStage: 3 }),
          choice("spin", "Proje vardı de", "Say there was a project", "Kapı; eğri cümle", { health: { stress: 3 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "komsu-un", arc: "housing", tags: ["housing", "social", "memory"],
    nodes: [
      {
        id: "lc_sugar_ask", stage: 1, organic: true, minWeek: 10, notHome: "family",
        tags: ["housing", "social", "memory"],
        title: "Kapı: un, bir su bardağı",
        text: "Komşu 'bir bardak' diyor. Bardak, tanışmak. Un, mahalle anayasası.",
        enTitle: "The door: flour, one water-glass", enText: "The neighbour says 'one glass.' The glass is how you meet. Flour is neighbourhood law.",
        choices: [
          choice("give", "Ver, çay da koy", "Give it, pour tea too", "Bağ; on dakika", { health: { stress: -2 }, memory: "Komşuya un verdin." }, {
            lifeStage: 1, npcMemory: { personId: "mehmet", text: "Mahalle kapısı açıldı.", type: "lc_neighbor_flour" },
            lifeNext: { eventId: "lc_sugar_back", dueWeeks: 3, key: "sugar-back" },
          }),
          choice("none", "Yok de", "Say you have none", "Sınır", { health: { stress: 1 } }, { lifeStage: 9 }),
        ],
      },
      {
        id: "lc_sugar_back", stage: 2, tags: ["housing", "social", "memory"],
        title: "Poşet kapıda, not yok",
        text: "Un değil, börek. Not yok. Mahalle faizi böyle işler, banka değil.",
        enTitle: "A bag at the door, no note", enText: "Not flour — börek. No note. That is how neighbourhood interest works. Not a bank.",
        choices: [
          choice("thanks", "Kapıyı çal, sağ ol de", "Knock, say thank you", "Bağ ısınır", { health: { stress: -2 } }, { lifeStage: 3 }),
          choice("quiet", "Poşeti al, sus", "Take the bag, stay quiet", "Hesap kapanır", { health: { stress: -1 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "selin-nisan", arc: "social", tags: ["social", "family", "finance", "cross"],
    nodes: [
      {
        id: "lc_selin_ring", stage: 1, organic: true, minWeek: 16, needActor: "selin",
        tags: ["social", "family", "finance", "memory"],
        title: "Selin nişan, zarf yine",
        text: "Kuzenim bu ay yetiştiremedim. Konuşalım. Yetişmek, nişana yetişmek. Zarf konuşuyor yine.",
        enTitle: "Selin's engagement, the envelope again", enText: "Cousin, I could not make it this month. Let's talk. Making it means making the engagement. The envelope is talking again.",
        choices: [
          choice("go", "Git, zarfı doldur", "Go, fill the envelope", "Nakit ve bağ", { money: -1600, reason: "Nişan hediyesi", health: { energy: -4 }, memory: "Selin'in nişanına gittin." }, {
            lifeStage: 1, npcMemory: { personId: "selin", text: "Nişanıma geldi.", type: "lc_selin_came" },
            lifeNext: { eventId: "lc_selin_photo", dueWeeks: 8, key: "selin-photo" },
          }),
          choice("skip", "Bu sefer yaz", "Write this time", "Nakit durur; kuzen soğur", { health: { stress: 3 }, memory: "Selin'in nişanına gitmedin." }, {
            lifeStage: 1, npcMemory: { personId: "selin", text: "Nişanıma gelmedi.", type: "lc_selin_missed" },
            lifeNext: { eventId: "lc_selin_cold", dueWeeks: 9, key: "selin-cold" },
          }),
        ],
      },
      {
        id: "lc_selin_photo", stage: 2, tags: ["social", "memory"],
        title: "Fotoğrafta ön sıra",
        text: "Selin etiketlemiş. Annen 'aile gibi durmuşsunuz' diyor. Aile gibi, aile değil, durmak.",
        enTitle: "Front row in the photo", enText: "Selin tagged you. Your mother says you looked like family. Looking like family is not being family. It is standing.",
        choices: [
          choice("repost", "Paylaş", "Share it", "Görünür bağ", { health: { stress: -2 } }, { lifeStage: 3 }),
          choice("save", "Kayıt, paylaşma", "Save, do not share", "Sessiz bağ", { health: { stress: -1 } }, { lifeStage: 3 }),
        ],
      },
      {
        id: "lc_selin_cold", stage: 2, tags: ["social", "memory", "family"],
        title: "Bayramda Selin yok",
        text: "Grupta herkes var. Selin 'yoğunluk' yazmış. Yoğunluk senin kelimenmiş, iade edildi.",
        enTitle: "Selin is missing at bayram", enText: "Everyone is in the group. Selin wrote 'busy.' Busy was your word. It has been returned.",
        choices: [
          choice("call", "Ara", "Call", "Onarım", { health: { stress: 2 } }, { lifeStage: 3 }),
          choice("wait", "Bekle", "Wait", "Mesafe", { health: { stress: 2 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
];
for (const chain of MORE_CHAINS) CHAINS.push(chain);

const LATE_LIFE_CHAINS = [
  {
    id: "son-kadro", arc: "career", tags: ["career", "status", "late-life", "age-65", "cross"],
    nodes: [
      {
        id: "lc_last_badge", stage: 1, organic: true, minAge: 65, maxAge: 69, notRetired: true, needJob: true,
        tags: ["career", "late-life", "age-65", "phase-late"],
        title: "Kart, hâlâ fotoğrafın",
        text: "Güvenlik 'abi bu kart eski sistem' diyor. Sistem senin yüzünü tanıyor, kadro tanımıyor. Koridor aynı, isimlik yenilenmiş.",
        enTitle: "The badge still has your photo", enText: "Security says 'this badge is the old system.' The system knows your face. The post does not. The corridor is the same. The nameplate has been replaced.",
        choices: [
          choice("keep", "Kartı tak, gir", "Wear the badge, go in", "Ritim durur; kimlik sızar", { health: { stress: 3 }, memory: "Altmış beşinde kartı takıp girdin." }, {
            lifeStage: 1, lifeNext: { eventId: "lc_last_desk", dueWeeks: 5, key: "last-desk" }, echo: "Kart hâlâ cebinde, kadro değil.",
          }),
          choice("drawer", "Çekmeceye koy", "Put it in the drawer", "Mesafe; koridor soğur", { health: { stress: 2 } }, { lifeStage: 9 }),
        ],
      },
      {
        id: "lc_last_desk", stage: 2, tags: ["career", "late-life", "memory"],
        title: "Masa sade, mail dolu",
        text: "Çekmece boşaltılıyor. Senin kalem duruyor. Bir stajyer 'bunu kullanabilir miyim' diye soruyor. Kalem, veda gibi duruyor.",
        enTitle: "A clear desk, a full inbox", enText: "The drawer is being emptied. Your pen is still there. An intern asks if they can use it. The pen looks like a goodbye.",
        choices: [
          choice("give", "Ver, gül", "Give it, smile", "Hafiflik", { health: { stress: -3 } }, { lifeStage: 3 }),
          choice("keep-pen", "Kalemi al, çık", "Take the pen, leave", "Nesne; kapanış", { health: { stress: 2 }, memory: "Son masadan kalemi aldın." }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "danisman-kapi", exclusive: "late-work", branch: "consult", arc: "career",
    tags: ["career", "status", "late-life", "age-65", "cross"],
    nodes: [
      {
        id: "lc_consult_ask", stage: 1, organic: true, minAge: 60, maxAge: 69, needRetired: true, needActor: "burak",
        tags: ["career", "status", "late-life", "age-65", "memory"],
        title: "Burak: 'iki saatlik bakış'",
        text: "Mail kısa, ı yok: 'ciddili. kadro değil. bakış. paket ayrı.' Emekli cüzdanı, ofis cümlesi. İkisi aynı masaya oturmuyor.",
        enTitle: "Burak: a two-hour look", enText: "Short mail, no ı: 'serious. not a post. a look. separate package.' A pension wallet, an office sentence. They do not sit at the same table.",
        choices: [
          choice("take", "Bakışa git", "Take the look", "Kimlik dolusu; tempo", { health: { energy: -5, stress: 4 }, memory: "Emeklilikte danışmanlık kapısını açtın." }, {
            lifeStage: 1, lifeLock: "consult", npcMemory: { personId: "burak", text: "Bakış için geldi.", type: "lc_consult_took" },
            lifeNext: { eventId: "lc_consult_month", dueWeeks: 6, key: "consult-month" }, echo: "Kapı kapandı sanıldı, aralandı.",
          }),
          choice("pass", "Bu kapı kapandı de", "Say this door has closed", "Huzur; boş pazartesi", { health: { stress: -2 } }, { lifeStage: 9, lifeLock: "consult" }),
        ],
      },
      {
        id: "lc_consult_month", stage: 2, tags: ["career", "health", "late-life", "memory"],
        title: "Toplantı, sen susunca bitmiyor",
        text: "Soru senin eski cümlen. Cevap genç birinin. Sen 'ben karışmam' demiyorsun, karışıyorsun. Bel ağrısı da karışıyor.",
        enTitle: "The meeting does not end when you go quiet", enText: "The question is your old sentence. The answer is a younger person's. You are not saying you will stay out of it. You are in it. The back pain is in it too.",
        choices: [
          choice("again", "Bir ay daha", "One more month", "Gelir; beden", { money: 1800, reason: "Danışmanlık", health: { energy: -6, stress: 5 } }, {
            lifeStage: 2, lifeNext: { eventId: "lc_consult_end", dueWeeks: 8, key: "consult-end" },
          }),
          choice("stop", "Bu kadarı", "This is enough", "Sınır", { health: { energy: 4, stress: -3 } }, { lifeStage: 3 }),
        ],
      },
      {
        id: "lc_consult_end", stage: 3, tags: ["career", "late-life", "memory"],
        title: "Teşekkür maili, kadro yok",
        text: "Burak 'iyi bakıştı' yazmış. İyi bakış, iş değil. Pazartesi yine senin, ofisin değil.",
        enTitle: "A thank-you mail, no post", enText: "Burak wrote 'good look.' A good look is not a job. Monday is yours again, not the office's.",
        choices: [
          choice("file", "Maili sakla", "Keep the mail", "Hatıra", { health: { stress: -2 } }, { lifeStage: 4, echo: "Danışmanlık bir mevsim sürdü, bir hayat değil." }),
          choice("delete", "Sil, kapat", "Delete it, close it", "Kesin kapanış", { health: { stress: -1 } }, { lifeStage: 4 }),
        ],
      },
    ],
  },
  {
    id: "emekli-sus", exclusive: "late-work", branch: "leave", arc: "career",
    tags: ["career", "health", "late-life", "age-65", "cross"],
    nodes: [
      {
        id: "lc_leave_clean", stage: 1, organic: true, minAge: 60, maxAge: 69, needRetired: true,
        tags: ["career", "identity", "late-life", "age-65"],
        title: "Grup sohbeti, sen çıkınca susmuyor",
        text: "İş grubu hâlâ açık. 'abi bi bakar mısın' yazılmış. Bakmak, dönmek. Dönmek, emekli olmamak.",
        enTitle: "The group chat does not go quiet when you leave", enText: "The work group is still open. Someone wrote 'abi can you take a look.' Looking is returning. Returning is not being retired.",
        choices: [
          choice("mute", "Grubu sessize al", "Mute the group", "Sınır; kimlik boşalır", { health: { stress: -4 }, memory: "İş grubunu sessize alıp çıktın." }, {
            lifeStage: 1, lifeLock: "leave", lifeNext: { eventId: "lc_leave_monday", dueWeeks: 4, key: "leave-monday" }, echo: "Sessiz grup, gürültülü pazartesi.",
          }),
          choice("reply", "Bir cümle yaz, çık", "Write one sentence, leave", "Nezaket; kapı aralık", { health: { stress: 3 } }, { lifeStage: 2, lifeLock: "leave" }),
        ],
      },
      {
        id: "lc_leave_monday", stage: 2, tags: ["career", "health", "late-life"],
        title: "Pazartesi, alarm yok",
        text: "Beden 07:10'da kalkıyor. İş yok. Çay fazla demli. Bu bir zafer diye satılmıyor, satılsa da almıyorsun.",
        enTitle: "Monday, no alarm", enText: "The body gets up at 07:10. No work. The tea is over-brewed. This is not being sold as a victory. If it were, you would not buy it.",
        choices: [
          choice("walk", "Çık, yürü", "Go out, walk", "Ritim", { health: { energy: 5, stress: -4 } }, { lifeStage: 3 }),
          choice("sit", "Pencerede otur", "Sit at the window", "Sessizlik", { health: { stress: 2 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "emekli-sabah", arc: "health", tags: ["health", "career", "late-life", "age-65", "cross"],
    nodes: [
      {
        id: "lc_morning_empty", stage: 1, organic: true, minAge: 60, maxAge: 69, needRetired: true,
        tags: ["health", "late-life", "age-65", "phase-late"],
        title: "Sabah, teslim yok",
        text: "Eski servis saati. Durakta sen varsın, servis yok. Bacaklar işe gidiyor, sen gitmiyorsun.",
        enTitle: "Morning, no deadline", enText: "The old shuttle hour. You are at the stop. The shuttle is not. The legs are going to work. You are not.",
        choices: [
          choice("walk", "Yürü, durak değişsin", "Walk, change the stop", "Beden; ritim", { health: { energy: 4, stress: -3 }, memory: "Emekli sabahında durağı yürüyüşe çevirdin." }, {
            lifeStage: 1, lifeNext: { eventId: "lc_morning_walk", dueWeeks: 6, key: "morning-walk" },
          }),
          choice("home", "Dön, çay koy", "Go home, make tea", "Huzur; durgunluk", { health: { stress: -2 } }, { lifeStage: 2 }),
        ],
      },
      {
        id: "lc_morning_walk", stage: 2, tags: ["health", "social", "late-life"],
        title: "Aynı bank, başka yüzler",
        text: "Parkta tanıdık yok. Köpek var, sahibi yok gibi. Yürüyüş iş gibi duruyor, durmuyor. Nefes sayılıyor.",
        enTitle: "The same bench, other faces", enText: "No one you know in the park. A dog, apparently without an owner. The walk looks like work. It is not. Breath is being counted.",
        choices: [
          choice("again", "Yarın da gel", "Come tomorrow too", "Alışkanlık", { health: { energy: 3, stress: -3 } }, {
            lifeStage: 2, lifeNext: { eventId: "lc_morning_year", dueWeeks: 12, key: "morning-year" },
          }),
          choice("skip", "Bu hafta yok", "Not this week", "Beden dinlenir", { health: { energy: 2 } }, { lifeStage: 3 }),
        ],
      },
      {
        id: "lc_morning_year", stage: 3, tags: ["health", "late-life", "memory"],
        title: "Bir yıl, aynı ayakkabı",
        text: "Taban incelmiş. Doktor 'yürüyün' demişti. Yürümek, reçete gibi duruyor şimdi, kaçış değil.",
        enTitle: "A year, the same shoes", enText: "The soles have thinned. The doctor had said 'walk.' Walking looks like a prescription now, not an escape.",
        choices: [
          choice("new", "Ayakkabı al", "Buy shoes", "Nakit; devam", { money: -900, reason: "Yürüyüş ayakkabısı", health: { energy: 2 } }, { lifeStage: 4 }),
          choice("keep", "Bu yeter", "These will do", "Tasarruf", { health: { stress: 1 } }, { lifeStage: 4 }),
        ],
      },
    ],
  },
  {
    id: "cocuk-iban", arc: "family", tags: ["family", "finance", "late-life", "age-65", "cross"],
    nodes: [
      {
        id: "lc_child_ask", stage: 1, organic: true, minAge: 65, maxAge: 72, needAdultChild: true,
        tags: ["family", "finance", "late-life", "age-65", "memory"],
        title: "Mesaj: 'kısa bir aktarım'",
        text: "Kısa bir aktarım, uzun bir cümle. Çocuk artık çocuk değil. Sen hâlâ hesap. Emekli maaşının bir haftası, birinin peşinatı.",
        enTitle: "A message: 'a short transfer'", enText: "A short transfer, a long sentence. The child is no longer a child. You are still the account. A week of the pension is someone's deposit.",
        choices: [
          choice("send", "Gönder, sorma", "Send it, do not ask", "Nakit iner; rol durur", { money: -2200, reason: "Çocuk aktarımı", health: { stress: 4 }, memory: "Emekli ayında çocuğa sormadan aktardın." }, {
            lifeStage: 1, lifeNext: { eventId: "lc_child_table", dueWeeks: 7, key: "child-table" }, echo: "Aktarım kısa durdu, rol uzun.",
          }),
          choice("talk", "Konuşalım de", "Say let's talk", "Sınır; gerginlik", { health: { stress: 5 } }, {
            lifeStage: 1, lifeNext: { eventId: "lc_child_year", dueWeeks: 10, key: "child-year" },
          }),
        ],
      },
      {
        id: "lc_child_table", stage: 2, tags: ["family", "late-life", "memory"],
        title: "Sofra, teşekkür yok gibi",
        text: "Yemek var. Teşekkür, kapı eşiğinde mırıldanıyor. Mırıldanmak, görmemek değil. Sen de bir zamanlar mırıldanmıştın.",
        enTitle: "A table, thanks that barely exist", enText: "There is food. Thanks are muttered on the doorstep. Muttering is not not-seeing. You used to mutter too.",
        choices: [
          choice("stay", "Çaya kal", "Stay for tea", "Bağ", { health: { stress: -3 } }, { lifeStage: 3 }),
          choice("go", "Erken kalk", "Leave early", "Mesafe", { health: { stress: 2 } }, { lifeStage: 3 }),
        ],
      },
      {
        id: "lc_child_year", stage: 2, tags: ["family", "finance", "late-life", "memory"],
        title: "Bu yıl da aynı cümle",
        text: "Aktarım kelimesi değişmemiş. Senin cümlen değişmiş: 'bu ay yok' denebilir artık. Denmek, kopmak değil.",
        enTitle: "The same sentence this year too", enText: "The word transfer has not changed. Your sentence has: 'not this month' can be said now. Saying it is not a break.",
        choices: [
          choice("hold", "Bu ay yok de", "Say not this month", "Sınır", { health: { stress: 3 }, memory: "Aktarımı bu kez tuttun." }, { lifeStage: 3 }),
          choice("half", "Yarısını gönder", "Send half", "Paylaşılmış yük", { money: -1100, reason: "Yarım aktarım", health: { stress: 2 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "ev-kucult", exclusive: "late-home", branch: "downsize", arc: "housing",
    tags: ["housing", "finance", "late-life", "age-70", "cross"],
    nodes: [
      {
        id: "lc_downsize_talk", stage: 1, organic: true, minAge: 70, maxAge: 74, notHome: "family",
        tags: ["housing", "finance", "late-life", "age-70"],
        title: "Oda fazla, merdiven dik",
        text: "Eşya duruyor, nefes yetmiyor. Küçülmek yenilgi gibi satılıyor. Satılmasa da merdiven speküle etmiyor, dik.",
        enTitle: "A spare room, a steep stair", enText: "The furniture is still there. The breath is not enough. Downsizing is being sold as a defeat. Even if it is not, the stairs do not speculate. They are steep.",
        choices: [
          choice("move", "Küçült, in", "Downsize, go down", "Gider iner; hatıra taşınır", { health: { energy: -6, stress: 5 }, memory: "Yetmişinde evi küçülttün." }, {
            lifeStage: 1, lifeLock: "downsize", lifeNext: { eventId: "lc_downsize_box", dueWeeks: 5, key: "downsize-box" }, echo: "Oda azaldı, merdiven kısaldı.",
          }),
          choice("later", "Bu kış değil", "Not this winter", "Erteleme", { health: { stress: 2 } }, { lifeStage: 9, lifeLock: "downsize" }),
        ],
      },
      {
        id: "lc_downsize_box", stage: 2, tags: ["housing", "late-life", "memory"],
        title: "Kutu, isimsiz fotoğraf",
        text: "Albüm ağır. Kim olduğunu unuttuğun bir yüz. Atmak, unutmak. Saklamak, taşımak.",
        enTitle: "A box, an unnamed photograph", enText: "The album is heavy. A face you have forgotten the name of. Throwing it away is forgetting. Keeping it is carrying.",
        choices: [
          choice("keep", "Kutuyu götür", "Take the box", "Hatıra; yer", { health: { energy: -3 } }, {
            lifeStage: 2, lifeNext: { eventId: "lc_downsize_key", dueWeeks: 4, key: "downsize-key" },
          }),
          choice("toss", "Bir kısmını bırak", "Leave some of it", "Hafiflik", { health: { stress: -2 } }, { lifeStage: 3 }),
        ],
      },
      {
        id: "lc_downsize_key", stage: 3, tags: ["housing", "late-life"],
        title: "Eski anahtar, yeni kilit",
        text: "Anahtarlıkta fazla halka. Kapıcı 'bunlar uymuyor' diyor. Uymamak, gitmiş olmak.",
        enTitle: "An old key, a new lock", enText: "Too many rings on the keyring. The caretaker says these do not fit. Not fitting is having left.",
        choices: [
          choice("drop", "Fazlasını çıkar", "Take the extras off", "Kapanış", { health: { stress: -3 } }, { lifeStage: 4 }),
          choice("keep-key", "Halkada dursun", "Leave them on the ring", "Hatıra ağırlığı", { health: { stress: 1 } }, { lifeStage: 4 }),
        ],
      },
    ],
  },
  {
    id: "ev-kal", exclusive: "late-home", branch: "stay", arc: "housing",
    tags: ["housing", "health", "late-life", "age-70", "cross"],
    nodes: [
      {
        id: "lc_stay_repair", stage: 1, organic: true, minAge: 70, maxAge: 74, notHome: "family",
        tags: ["housing", "health", "late-life", "age-70", "economy"],
        title: "Musluk, gece damlıyor",
        text: "Tesisatçı 'abi merdiven' diyor. Merdiven senin kararın. Damla, kira kadar düzenli.",
        enTitle: "The tap drips at night", enText: "The plumber says 'abi, the stairs.' The stairs are your decision. The drip is as regular as rent.",
        choices: [
          choice("fix", "Çağır, öde", "Call, pay", "Nakit; uyku", { money: -850, reason: "Tesisat", health: { stress: -3 }, memory: "Eski evde kaldın, musluğu tamir ettin." }, {
            lifeStage: 1, lifeLock: "stay", lifeNext: { eventId: "lc_stay_stair", dueWeeks: 6, key: "stay-stair" },
          }),
          choice("bowl", "Kase koy, idare", "Put a bowl, manage", "Tasarruf; damla", { health: { stress: 3 } }, { lifeStage: 2, lifeLock: "stay" }),
        ],
      },
      {
        id: "lc_stay_stair", stage: 2, tags: ["housing", "health", "late-life"],
        title: "Üçüncü kat, market poşeti",
        text: "Poşet sapı ele gömülüyor. Komşu 'bırakın ben' diyor. Bırakmak, evden bir parça teslim.",
        enTitle: "Third floor, a shopping bag", enText: "The bag handle is sinking into the hand. A neighbour says 'leave it, I will.' Leaving it is handing over a piece of the house.",
        choices: [
          choice("accept", "Bırak, teşekkür et", "Leave it, say thank you", "Destek; gurur iner", { health: { energy: 3, stress: -2 } }, { lifeStage: 3 }),
          choice("carry", "Sen çıkar", "You carry it", "Bağımsızlık; nefes", { health: { energy: -5, stress: 3 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "aile-yakin-gec", exclusive: "late-family", branch: "near", arc: "family",
    tags: ["family", "social", "late-life", "age-70", "cross"],
    nodes: [
      {
        id: "lc_near_sunday", stage: 1, organic: true, minAge: 70, maxAge: 74,
        tags: ["family", "late-life", "age-70", "memory"],
        title: "Pazar masası, sen misafir",
        text: "Sandalye senin değil artık, ayrılmış. Yemek bildik, saat onların. Yaklaşmak, ev sahibi olmamak.",
        enTitle: "Sunday table, you are the guest", enText: "The chair is no longer yours; it has been set aside. The food is familiar, the hour is theirs. Drawing near is not being the host.",
        choices: [
          choice("go", "Her pazar git", "Go every Sunday", "Bağ; ritim onların", { health: { energy: -3, stress: -4 }, memory: "Pazar masasına misafir oldun." }, {
            lifeStage: 1, lifeLock: "near", lifeNext: { eventId: "lc_near_guest", dueWeeks: 8, key: "near-guest" },
          }),
          choice("skip", "İki haftada bir", "Every two weeks", "Mesafe", { health: { stress: 2 } }, { lifeStage: 2, lifeLock: "near" }),
        ],
      },
      {
        id: "lc_near_guest", stage: 2, tags: ["family", "late-life", "memory"],
        title: "Kapı zili, sen açmıyorsun",
        text: "Ev onların. Zil onların. Sen içeridesin, anahtar sende değil. Bu bir ziyaret, bir dönüş değil.",
        enTitle: "The doorbell, you do not open it", enText: "The house is theirs. The bell is theirs. You are inside. The key is not on you. This is a visit, not a return.",
        choices: [
          choice("stay", "Yemeğe kal", "Stay for the meal", "Aidiyet jesti", { health: { stress: -3 } }, { lifeStage: 3 }),
          choice("leave", "Çaya kalma", "Do not stay for tea", "Kendi düzen", { health: { stress: 1 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "bagimsiz-duzen", exclusive: "late-family", branch: "independent", arc: "family",
    tags: ["family", "housing", "late-life", "age-70", "cross"],
    nodes: [
      {
        id: "lc_own_table", stage: 1, organic: true, minAge: 70, maxAge: 74, notHome: "family",
        tags: ["family", "housing", "late-life", "age-70"],
        title: "Tek tabak, radyo açık",
        text: "Arıyorlar. 'neden gelmedin.' Gelmemek, küsmek değil. Kendi saatin, kendi tuzu.",
        enTitle: "One plate, the radio on", enText: "They are calling. 'why did you not come.' Not coming is not a feud. Your own hour, your own salt.",
        choices: [
          choice("hold", "Bu pazar evde", "This Sunday at home", "Bağımsızlık", { health: { stress: -2 }, memory: "Pazar masasını evde kurdun." }, {
            lifeStage: 1, lifeLock: "independent", lifeNext: { eventId: "lc_own_call", dueWeeks: 6, key: "own-call" },
          }),
          choice("go", "Yine de git", "Go anyway", "Bağ", { health: { energy: -3 } }, { lifeStage: 2, lifeLock: "independent" }),
        ],
      },
      {
        id: "lc_own_call", stage: 2, tags: ["family", "late-life", "memory"],
        title: "Akşam araması, kısa",
        text: "'yemek yedin mi.' Cümle çocukluk gibi, tersine. Sen 'yedim' diyorsun. Yemek, kanıt.",
        enTitle: "An evening call, short", enText: "'did you eat.' The sentence is like childhood, reversed. You say you did. Eating is proof.",
        choices: [
          choice("true", "Yedim de", "Say you ate", "Huzur", { health: { stress: -2 } }, { lifeStage: 3 }),
          choice("invite", "Siz gelin de", "Say they should come", "Kapı aralanır", { health: { stress: 1 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "es-tempo", arc: "relationship", tags: ["relationship", "health", "late-life", "age-70", "cross"],
    nodes: [
      {
        id: "lc_partner_slow", stage: 1, organic: true, minAge: 70, maxAge: 76, needPartner: true,
        tags: ["relationship", "health", "late-life", "age-70", "memory"],
        title: "Yürüyüş, sen öndesin",
        text: "Partnerin 'yavaş' demiyor, duruyor. Durmak, bir cümle. Tempo artık ortak bir karar, alışkanlık değil.",
        enTitle: "A walk, you are ahead", enText: "Your partner does not say 'slow.' They stop. Stopping is a sentence. Pace is a joint decision now, not a habit.",
        choices: [
          choice("match", "Tempo onların olsun", "Let the pace be theirs", "Bağ; mesafe kısalır", { health: { energy: -2, stress: -4 }, memory: "Yürüyüşü partnere uydurdun." }, {
            lifeStage: 1, lifeNext: { eventId: "lc_partner_clinic", dueWeeks: 7, key: "partner-clinic" },
          }),
          choice("loop", "Sen turunu bitir", "Finish your loop", "Beden; mesafe", { health: { energy: 2, stress: 3 } }, { lifeStage: 2 }),
        ],
      },
      {
        id: "lc_partner_clinic", stage: 2, tags: ["relationship", "health", "late-life", "memory"],
        title: "Sıra, iki sandalye, bir isim",
        text: "Randevu onun. Dosya senin elinde. Gişe 'yakını' diyor. Yakın, imza yetkisi değil, bekleme yetkisi.",
        enTitle: "A queue, two chairs, one name", enText: "The appointment is theirs. The file is in your hand. The window says 'relative.' Relative is not signing authority. It is waiting authority.",
        choices: [
          choice("wait", "Sırada kal", "Stay in the queue", "Bakım", { health: { energy: -4 }, memory: "Partnerin randevusunda sırada kaldın." }, {
            lifeStage: 2, lifeNext: { eventId: "lc_partner_tea", dueWeeks: 5, key: "partner-tea" },
          }),
          choice("errand", "Sen marketten dön", "You go to the shop", "Paylaşım", { health: { energy: -2 } }, { lifeStage: 3 }),
        ],
      },
      {
        id: "lc_partner_tea", stage: 3, tags: ["relationship", "late-life"],
        title: "Çay, tansiyon, susuş",
        text: "Konuşulacak şey reçete. Reçete bitince ev yine ev. Bu bir kriz değil, bir tempo.",
        enTitle: "Tea, blood pressure, a hush", enText: "What there is to talk about is the prescription. When the prescription ends the house is a house again. This is not a crisis. It is a pace.",
        choices: [
          choice("tea", "Çayı sen koy", "You pour the tea", "Ritim", { health: { stress: -3 } }, { lifeStage: 4 }),
          choice("news", "Televizyonu aç", "Turn the television on", "Kaçış", { health: { stress: -1 } }, { lifeStage: 4 }),
        ],
      },
    ],
  },
  {
    id: "bakim-el", arc: "health", tags: ["health", "family", "late-life", "age-70", "cross"],
    nodes: [
      {
        id: "lc_care_day", stage: 1, organic: true, minAge: 70, maxAge: 76,
        tags: ["health", "late-life", "age-70", "phase-late"],
        title: "Kutular, öğle, unutulan öğün",
        text: "İlaç kutusu günlere ayrılmış. Salı, çarşamba gibi duruyor. Öğün atlanınca kutu suçluyor, sen değil.",
        enTitle: "Boxes, noon, a missed meal", enText: "The pill box is divided by days. It looks like Tuesday, Wednesday. When a meal is skipped the box is to blame, not you.",
        choices: [
          choice("alarm", "Saat kur", "Set an alarm", "Ritim; bağımlılık küçük", { health: { stress: -2 }, memory: "İlaç saatini kendin kurdun." }, {
            lifeStage: 1, lifeNext: { eventId: "lc_care_night", dueWeeks: 4, key: "care-night" },
          }),
          choice("note", "Kâğıda yaz", "Write it on paper", "Eski yöntem", { health: { stress: 1 } }, { lifeStage: 2 }),
        ],
      },
      {
        id: "lc_care_night", stage: 2, tags: ["health", "late-life"],
        title: "Gece lambası, koridor",
        text: "Tuvalet yolu uzun. Lamba yanık kalmış. Yanık lamba, fatura değil, düşmeme kararı.",
        enTitle: "A night light, the corridor", enText: "The way to the toilet is long. The lamp has been left on. A lamp left on is not a bill. It is a decision not to fall.",
        choices: [
          choice("on", "Lambayı bırak", "Leave the lamp on", "Güvenlik", { health: { stress: -2 } }, { lifeStage: 3 }),
          choice("off", "Söndür, ezberle", "Switch it off, memorise it", "Tasarruf; risk", { health: { stress: 2 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "kulup-cay", exclusive: "late-circle", branch: "club", arc: "social",
    tags: ["social", "health", "late-life", "age-75", "cross"],
    nodes: [
      {
        id: "lc_club_chair", stage: 1, organic: true, minAge: 75, maxAge: 79,
        tags: ["social", "late-life", "age-75"],
        title: "Dernek sandalyesi, çay 10 lira değil",
        text: "Masa sabit, isimler değişiyor. 'abi gel' deniyor. Gelmek, aidiyet aidatı. Aidat, yalnızlıktan ucuz duruyor.",
        enTitle: "A club chair, tea that is not ten lira", enText: "The table is fixed. The names change. Someone says 'abi come.' Coming is a membership due. The due looks cheaper than being alone.",
        choices: [
          choice("sit", "Otur, çay söyle", "Sit, order tea", "Çevre; nakit", { money: -120, reason: "Dernek çayı", health: { stress: -4 }, memory: "Yetmiş beşinde dernek masasına oturdun." }, {
            lifeStage: 1, lifeLock: "club", lifeNext: { eventId: "lc_club_absent", dueWeeks: 6, key: "club-absent" },
          }),
          choice("pass", "Bu hafta yok", "Not this week", "Ev", { health: { stress: 2 } }, { lifeStage: 9, lifeLock: "club" }),
        ],
      },
      {
        id: "lc_club_absent", stage: 2, tags: ["social", "late-life", "memory"],
        title: "Sandalyen dolu, sen yoksun",
        text: "Birisi senin yere oturmuş. Küsmek çocuk işi. Yer, mülk değil. Yine de yerin varmış, öğreniyorsun.",
        enTitle: "Your chair is taken, you are not there", enText: "Someone is sitting in your place. Taking offence is a child's job. A place is not property. Still, you learn you had a place.",
        choices: [
          choice("other", "Başka sandalye", "Another chair", "Esneklik", { health: { stress: -2 } }, { lifeStage: 3 }),
          choice("home", "Eve dön", "Go home", "Mesafe", { health: { stress: 2 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "ev-sessiz", exclusive: "late-circle", branch: "home", arc: "social",
    tags: ["social", "health", "late-life", "age-75", "cross"],
    nodes: [
      {
        id: "lc_home_radio", stage: 1, organic: true, minAge: 75, maxAge: 79,
        tags: ["social", "late-life", "age-75"],
        title: "Radyo, öğle haberleri",
        text: "Dışarı gürültü. İçerisi cümle. Haber bitince ev yeniden büyük. Büyük ev, kalabalık değil.",
        enTitle: "The radio, the noon news", enText: "Noise outside. Sentences inside. When the news ends the house is large again. A large house is not a crowd.",
        choices: [
          choice("keep", "Radyoyu açık bırak", "Leave the radio on", "Ritim", { health: { stress: -3 }, memory: "Öğle haberini evde tuttun." }, {
            lifeStage: 1, lifeLock: "home", lifeNext: { eventId: "lc_home_window", dueWeeks: 5, key: "home-window" },
          }),
          choice("out", "Balkona çık", "Go to the balcony", "Hava", { health: { energy: 2 } }, { lifeStage: 2, lifeLock: "home" }),
        ],
      },
      {
        id: "lc_home_window", stage: 2, tags: ["social", "housing", "late-life"],
        title: "Pencere, aşağıda çocuk sesi",
        text: "Ses tanıdık değil. Tanıdık olması gerekmiyor. Bakmak, katılmak değil. Katılmamak da bir seçim, bir eksik değil.",
        enTitle: "The window, a child's voice below", enText: "The voice is not familiar. It does not have to be. Looking is not joining. Not joining is also a choice, not a lack.",
        choices: [
          choice("watch", "Bak, çekilme", "Look, do not pull away", "Dünya durur", { health: { stress: -2 } }, { lifeStage: 3 }),
          choice("curtain", "Perdeyi çek", "Draw the curtain", "İçeri", { health: { stress: 1 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "eski-numara", arc: "social", tags: ["social", "status", "late-life", "age-75", "cross"],
    nodes: [
      {
        id: "lc_old_number", stage: 1, organic: true, minAge: 75, maxAge: 80, needActor: "mehmet",
        tags: ["social", "memory", "late-life", "age-75"],
        needMemory: ["mehmet", "lc_helped_mehmet_money"],
        title: "Mehmet, eski numara, yeni ses",
        text: "kanka rakam net. bu sefer rakam yok. 'abi naber' var. Naber, yıllar sonra bir borç defteri değil, bir yoklama.",
        enTitle: "Mehmet, old number, new voice", enText: "kanka the number is clear. this time there is no number. there is 'abi how are you.' How are you, years later, is not a debt book. It is a roll-call.",
        choices: [
          choice("talk", "Konuş, çay söyle", "Talk, say tea", "Hatıra ısınır", { health: { stress: -4 }, memory: "Mehmet yıllar sonra aradı, konuştun." }, {
            lifeStage: 1, npcMemory: { personId: "mehmet", text: "Yıllar sonra konuştuk.", type: "lc_mehmet_years" },
            lifeNext: { eventId: "lc_old_silence", dueWeeks: 8, key: "old-silence" },
          }),
          choice("short", "Kısa kes", "Keep it short", "Mesafe", { health: { stress: 2 } }, { lifeStage: 2 }),
        ],
      },
      {
        id: "lc_old_silence", stage: 2, tags: ["social", "late-life", "memory"],
        title: "İkinci arama yok",
        text: "Bir hafta. Mehmet yazmıyor. Yazmamak, küsmek değil. Yoklama bir kez yapılır, yoklama defteri değil.",
        enTitle: "There is no second call", enText: "A week. Mehmet does not write. Not writing is not a feud. Roll-call is taken once. It is not a register.",
        choices: [
          choice("call", "Sen ara", "You call", "Bağ", { health: { stress: -2 } }, {
            lifeStage: 2, lifeNext: { eventId: "lc_old_photo", dueWeeks: 10, key: "old-photo" },
          }),
          choice("leave", "Bırak", "Leave it", "Huzur", { health: { stress: -1 } }, { lifeStage: 3 }),
        ],
      },
      {
        id: "lc_old_photo", stage: 3, tags: ["social", "late-life", "memory"],
        title: "Bir fotoğraf, ikiniz genç",
        text: "Mehmet atmış. Mekân belirsiz, saç belirsiz. 'bu biz' yazmış. Biz, geçmiş zaman.",
        enTitle: "A photograph, both of you young", enText: "Mehmet sent it. The place is unclear, the hair is unclear. He wrote 'this is us.' Us is past tense.",
        choices: [
          choice("keep", "Sakla", "Keep it", "Hatıra", { health: { stress: -3 } }, { lifeStage: 4 }),
          choice("reply", "Bir cümle yaz", "Write one sentence", "Cevap", { health: { stress: -2 } }, { lifeStage: 4 }),
        ],
      },
    ],
  },
  {
    id: "anahtar-kopya", arc: "crisis", tags: ["crisis", "family", "housing", "late-life", "age-80", "cross"],
    nodes: [
      {
        id: "lc_key_keep", stage: 1, organic: true, minAge: 80, maxAge: 88,
        tags: ["crisis", "housing", "late-life", "age-80"],
        title: "Yedek anahtar, kime",
        text: "Kapıcı 'bir kopya durur' diyor. Durmak, güven. Vermek, teslim. Vermemek, düşme ihtimali.",
        enTitle: "A spare key, to whom", enText: "The caretaker says a copy can stay with him. Staying is trust. Giving it is handing over. Not giving it is the chance of a fall.",
        choices: [
          choice("give", "Kopyayı bırak", "Leave the copy", "Güvenlik; mahremiyet iner", { health: { stress: 3 }, memory: "Yedek anahtarı kapıcıya bıraktın." }, {
            lifeStage: 1, lifeNext: { eventId: "lc_key_give", dueWeeks: 6, key: "key-give" }, echo: "Anahtar sende değil, kapı sende.",
          }),
          choice("hold", "Cebinde dursun", "Keep it in your pocket", "Bağımsızlık; risk", { health: { stress: 2 } }, { lifeStage: 2 }),
        ],
      },
      {
        id: "lc_key_give", stage: 2, tags: ["crisis", "late-life", "memory"],
        title: "Zil, sen açmadan açılıyor",
        text: "Kapıcı 'kontrol' demiş. Kontrol, ziyaret. Ziyaret, izin. İzin senin cümlen değil artık.",
        enTitle: "The bell, the door opens without you", enText: "The caretaker said 'a check.' A check is a visit. A visit is permission. Permission is no longer your sentence.",
        choices: [
          choice("thank", "Sağ ol de", "Say thank you", "Ağ", { health: { stress: -2 } }, { lifeStage: 3 }),
          choice("rule", "Önce zil de", "Say the bell first", "Sınır", { health: { stress: 3 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
  {
    id: "kutu-fotograf", arc: "family", tags: ["family", "status", "late-life", "age-80", "cross"],
    nodes: [
      {
        id: "lc_box_open", stage: 1, organic: true, minAge: 80, maxAge: 90,
        tags: ["family", "late-life", "age-80", "memory"],
        title: "Kutu, senin el yazın",
        text: "Zarflar isimsiz. Birinin üzerinde 'sakla' yazıyor, kimin için belli değil. Saklamak, teslim etmek değil. Henüz.",
        enTitle: "A box, your handwriting", enText: "The envelopes have no names. One says 'keep,' for whom is not clear. Keeping is not handing over. Not yet.",
        choices: [
          choice("sort", "Ayır, yaz", "Sort, write names", "Miras cümlesi", { health: { energy: -3, stress: 2 }, memory: "Fotoğraf kutusunu isimleyerek ayırdın." }, {
            lifeStage: 1, lifeNext: { eventId: "lc_box_leave", dueWeeks: 8, key: "box-leave" }, echo: "Kutu konuşmaya başladı, henüz teslim değil.",
          }),
          choice("close", "Kapat, başka gün", "Close it, another day", "Erteleme", { health: { stress: -1 } }, { lifeStage: 2 }),
        ],
      },
      {
        id: "lc_box_leave", stage: 2, tags: ["family", "late-life", "memory"],
        title: "Kutu dolapta, not üstte",
        text: "Not: 'bunlar dağıtılır.' Dağıtmak gelecek zaman. Gelecek zaman, bugün değil. Yine de cümle duruyor.",
        enTitle: "The box in the cupboard, a note on top", enText: "The note: 'these get handed out.' Handing out is future tense. Future tense is not today. Still the sentence is there.",
        choices: [
          choice("leave", "Not dursun", "Leave the note", "Hazırlık", { health: { stress: -2 } }, { lifeStage: 3 }),
          choice("tell", "Birine söyle", "Tell someone", "Paylaşım", { health: { stress: 2 } }, { lifeStage: 3 }),
        ],
      },
    ],
  },
];
for (const chain of LATE_LIFE_CHAINS) CHAINS.push(chain);

const EXTRA_CALLBACKS = [
  {
    id: "lc_arrears_letter",
    tags: ["finance", "economy", "delayed"],
    title: "Gecikme bildirimi",
    text: "Kâğıt resmi. 'ödenmeyen bakiye.' Arrears artık bir kelime değil, bir adres.",
    enTitle: "An arrears notice",
    enText: "Official paper. 'unpaid balance.' Arrears is no longer a word. It is an address.",
    choices: [
      choice("pay", "Bir kısmını kapat", "Clear some of it", "Nakit iner; sicil nefes alır", { money: -1500, reason: "Gecikme kapatma", health: { stress: 4 }, memory: "Gecikmiş bakiyenin bir kısmını kapattın." }, { echo: "Arrears kâğıdı çekmeceye girdi, bitti değil." }),
      choice("hold", "Bu ay dokunma", "Do not touch it this month", "Yük durur", { health: { stress: 6 } }, {}),
    ],
  },
  {
    id: "lc_overtime_partner",
    tags: ["relationship", "health", "delayed", "memory"],
    title: "Üst üste mesai, boş sandalye",
    text: "Partnerin yemek koyup kaldırmış. Not yok. Tabak duruyor. Bu bir sitem, yüksek ses değil.",
    enTitle: "Overtime stacked, an empty chair",
    enText: "Your partner put food out and cleared it. No note. The plate remains. That is a complaint, not a raised voice.",
    choices: [
      choice("home", "Bu hafta mesai yok", "No overtime this week", "Bağ onarılır", { health: { energy: 5, stress: -6 } }, { npcMemory: { personId: "elif", text: "Mesaiyi kesti, eve geldi.", type: "lc_cut_overtime" } }),
      choice("keep", "Bir ay daha", "One more month", "Kariyer; mesafe", { health: { energy: -6, stress: 5 } }, { echo: "Sandalye boş kaldı." }),
    ],
  },
  {
    id: "lc_move_help_echo",
    tags: ["social", "housing", "delayed", "memory"],
    title: "Taşınırken kim vardı",
    text: "Kutu ağır. Mehmet 'kanka geldim' diyor ya da demiyor. Hafıza bu kutuda.",
    enTitle: "Who was there when you moved",
    enText: "The box is heavy. Mehmet either says 'kanka I came' or he does not. The memory is in this box.",
    choices: [
      choice("thanks", "Çay koy, oturt", "Make tea, sit him down", "Hatıra ısınır", { health: { stress: -3 } }, {}),
      choice("rush", "Kutuyu bitir, konuşma", "Finish the box, do not talk", "İş bitsin", { health: { energy: -4 } }, {}),
    ],
  },
  {
    id: "lc_secret_kept",
    tags: ["relationship", "family", "delayed", "memory"],
    title: "Sır duruyor, masa durmuyor",
    text: "Aile hâlâ sormuyor. Partnerin soruyor. İki susuş aynı susuş değil.",
    enTitle: "The secret is still there, the table is not",
    enText: "The family still does not ask. Your partner does. Two silences are not the same silence.",
    choices: [
      choice("tell", "Aileye söyle", "Tell the family", "Rahatlama; fırtına", { health: { stress: 6 }, memory: "Saklanan ilişkiyi aileye açtın." }, { echo: "Sır masaya geldi." }),
      choice("keep", "Biraz daha tut", "Hold it a little longer", "Güven iner", { health: { stress: 4 } }, {}),
    ],
  },
  {
    id: "lc_jobless_week",
    tags: ["career", "crisis", "delayed"],
    title: "İlan, sessizlik, çay",
    text: "Başvuru gitti. Cevap yok. Annen 'bir şey çıkar' diyor. Bir şey, ilan değil.",
    enTitle: "A listing, silence, tea",
    enText: "The application went. No answer. Your mother says something will come up. Something is not a listing.",
    choices: [
      choice("apply", "Üç ilan daha", "Three more listings", "Tempo; umut", { health: { energy: -5, stress: 4 } }, {}),
      choice("rest", "Bugün yok", "Not today", "Beden; gecikme", { health: { energy: 6, stress: -3 } }, {}),
    ],
  },
  {
    id: "lc_status_dinner",
    tags: ["status", "finance", "delayed"],
    title: "Restoran senin semtin değil",
    text: "Hesap gelmeden menu konuşuluyor. Sen rakamı çeviriyorsun. Çevirmek, aidiyet değil.",
    enTitle: "The restaurant is not your neighbourhood",
    enText: "The menu is being discussed before the bill. You are converting the number. Converting is not belonging.",
    choices: [
      choice("stay", "Kal, payına bak", "Stay, watch your share", "Statü jesti", { money: -1400, reason: "Statü yemeği", health: { stress: 5 } }, {}),
      choice("go", "Erken kalk", "Leave early", "Tasarruf; dışarıda kalma", { health: { stress: 4 } }, {}),
    ],
  },
  {
    id: "lc_sleep_debt",
    tags: ["health", "career", "delayed"],
    title: "Uyku alacak yazdı",
    text: "Serviste ayaktasın. Oturacak yer var, oturunca inemeyeceğini biliyorsun.",
    enTitle: "Sleep wrote itself into arrears",
    enText: "You are on your feet on the shuttle. There is a seat. You know you will not be able to stand up if you take it.",
    choices: [
      choice("sit", "Otur, bir durak kaçsın", "Sit, miss a stop", "Beden; iş gecikir", { health: { energy: 5, stress: -2 } }, {}),
      choice("stand", "Ayakta kal", "Stay standing", "Teslim; beden", { health: { energy: -4 } }, {}),
    ],
  },
  {
    id: "lc_goal_housing",
    arc: "housing",
    tags: ["housing", "goal"],
    title: "Depozito zarfı",
    text: "Zarfın üzerinde 'ev' yazıyor. İçinde henüz ev yok. Birikim, adres değil.",
    enTitle: "The deposit envelope",
    enText: "The envelope says 'home.' There is no home in it yet. Saving is not an address.",
    choices: [
      choice("save", "Birikim hedefi belirle", "Set a savings goal", "Hedef notu; para ayrılmaz", { health: { stress: 2 }, memory: "Depozito için birikim hedefi belirledin; henüz para ayırmadın." }, { goal: "Depozito için 10.000 TL biriktir" }),
      choice("spend", "Bu ay dokunma", "Leave it this month", "Esneklik", {}, {}),
    ],
  },
  {
    id: "lc_bayram_year",
    tags: ["family", "memory", "delayed"],
    title: "Bu bayram da aynı otogar",
    text: "Geçen yıl gittin ya da gitmedin. Bilet yine aynı fiyat değil. Annen cümleyi değiştirmemiş.",
    enTitle: "The same station this bayram too",
    enText: "Last year you went, or you did not. The ticket is not the same price. Your mother has not changed the sentence.",
    choices: [
      choice("go", "Yine git", "Go again", "Bağ yenilenir", { money: -1700, reason: "Bayram yolu", health: { energy: -5 } }, { npcMemory: { personId: "anne", text: "Bayrama yine geldi.", type: "lc_bayram_again" } }),
      choice("skip", "Bu yıl da yetişemem", "Cannot make it this year either", "Sitem katlanır", { relationships: { anne: -3 }, health: { stress: 4 } }, {}),
    ],
  },
  {
    id: "lc_wedding_year",
    tags: ["social", "memory", "delayed"],
    title: "Düğün yıldönümü, grup susuyor",
    text: "Mehmet hikâye atıyor. Sen o salonda vardın ya da yoktun. Hikâye hatırlıyor.",
    enTitle: "Wedding anniversary, the group is quiet",
    enText: "Mehmet posts a story. You were in that hall, or you were not. The story remembers.",
    choices: [
      choice("react", "Bir cümle yaz", "Write one sentence", "Hatıra ısınır", { health: { stress: -2 } }, {}),
      choice("mute", "Sessiz geç", "Let it pass quiet", "Mesafe", { health: { stress: 2 } }, {}),
    ],
  },
  {
    id: "lc_father_hospital",
    tags: ["family", "health", "delayed", "memory"],
    title: "Hastane SMS'i, baba adı",
    text: "Randevu hatırlatması. Baba 'ben karışmam' demişti. Sistem karışmış.",
    enTitle: "A hospital SMS, your father's name",
    enText: "An appointment reminder. Your father had said he would not interfere. The system has.",
    choices: [
      choice("take", "Sen götür", "You take him", "Bakım; iş payı", { health: { energy: -6 }, relationships: { baba: 5 } }, { npcMemory: { personId: "baba", text: "Hastaneye götürdü.", type: "lc_father_taken" } }),
      choice("call", "Ara, kendin git de", "Call, tell him to go himself", "Gurur korunur; risk durur", { health: { stress: 4 } }, {}),
    ],
  },
  {
    id: "lc_landlord_sale",
    tags: ["housing", "economy", "delayed"],
    title: "Ev satılık, sen içindesin",
    text: "İlan fotoğrafında senin perde. Ev sahibi 'bakıcı gelecek' diyor. Bakıcı, senin kahvaltın.",
    enTitle: "The house is for sale, you are inside it",
    enText: "Your curtain is in the listing photo. The landlord says a viewer is coming. The viewer is your breakfast.",
    choices: [
      choice("allow", "Kapıyı aç", "Open the door", "Kira durur; mahremiyet iner", { health: { stress: 5 } }, { echo: "Evin ilanı senin kahvaltından geçti." }),
      choice("move", "Süre iste, çık", "Ask for time, leave", "Taşınma kapısı", { health: { energy: -4, stress: 6 }, memory: "Satılık ilan sonrası çıkmayı konuştun." }, {}),
    ],
  },
  {
    id: "lc_credit_limit",
    tags: ["finance", "economy", "delayed"],
    title: "Limit teklifi",
    text: "Banka daha yüksek limitli bir kart öneriyor. Teklif, tuzak gibi duruyor. Henüz hesabında bir değişiklik yok.",
    enTitle: "A credit limit offer",
    enText: "The bank offers a card with a higher limit. The offer looks like a trap. Nothing has changed on your account yet.",
    choices: [
      choice("refuse", "Limit düşürmeyi planla", "Plan to lower the limit", "Niyet; limit henüz değişmez", { health: { stress: 2 }, memory: "Kart limitini düşürmeyi planladın; limit henüz değişmedi." }, {}),
      choice("keep", "Tebriği yut", "Swallow the congratulations", "Nefes; faiz kapısı", { health: { stress: 3 } }, {}),
    ],
  },
  {
    id: "lc_reference_ask",
    tags: ["career", "social", "delayed", "memory"],
    title: "Birisi senin ismini istiyor",
    text: "Bu sefer sen Burak'sın. İsim vermek, kapı açmak, borç yazmak.",
    enTitle: "Someone wants your name",
    enText: "This time you are Burak. Giving a name is opening a door and writing a debt.",
    choices: [
      choice("give", "İsmi ver", "Give the name", "İyilik; borç", { health: { stress: 3 }, memory: "Birine ismini referans verdin." }, { opportunity: "Verilen isim" }),
      choice("hold", "Tanımıyorum de", "Say you do not know them", "Sınır", { health: { stress: 2 } }, {}),
    ],
  },
  {
    id: "lc_newyear_alone",
    tags: ["crisis", "relationship", "delayed"],
    title: "31 Aralık, asansör ışığı",
    text: "Patlama uzaktan. Evde tabak tek. Bu bir tercih diye satılıyor yine.",
    enTitle: "31 December, lift light",
    enText: "Fireworks from far off. One plate at home. It is being sold as a choice again.",
    choices: [
      choice("call", "Birini ara", "Call someone", "Bağ", { health: { stress: -5 } }, {}),
      choice("sleep", "Erken yat", "Sleep early", "Beden", { health: { energy: 4 } }, {}),
    ],
  },
  {
    id: "lc_tax_notice",
    tags: ["finance", "economy", "delayed"],
    title: "e-Devlet bildirimi",
    text: "Ceza değil, uyarı. Uyarı, cezanın kibar hali. Rakam küçük, cümle büyük.",
    enTitle: "An e-Devlet notice",
    enText: "Not a fine, a warning. A warning is a polite fine. The number is small, the sentence is large.",
    choices: [
      choice("pay", "Bugün öde", "Pay today", "Nakit iner; sicil durur", { money: -420, reason: "Vergi uyarı", health: { stress: 2 } }, {}),
      choice("later", "Ay sonu", "End of the month", "Faiz ihtimali", { health: { stress: 4 } }, {}),
    ],
  },
  {
    id: "lc_child_fever_night",
    tags: ["family", "health", "career", "delayed", "memory"],
    title: "Gece ateş, sabah teslim",
    text: "Termometre 38.2. Mail 08:00. İki sayı, bir el yine.",
    enTitle: "A fever at night, a deadline in the morning",
    enText: "The thermometer reads 38.2. The mail is at 08:00. Two numbers, one hand again.",
    choices: [
      choice("stay", "Sen bak", "You stay", "Çocuk; kariyer sarsılır", { health: { energy: -8, stress: 5 }, memory: "Çocuk ateşinde işi kaydırdın." }, {}),
      choice("split", "Nöbetleş, sen sabah işe", "Take shifts, you go in the morning", "Paylaşım", { health: { energy: -4, stress: 4 } }, {}),
    ],
  },
  {
    id: "lc_emre_loan",
    tags: ["social", "finance", "delayed", "memory"],
    title: "Emre, 'kısa bir şey'",
    text: "Kısa bir şey, uzun bir IBAN. Eski sınıf, yeni sıkışma.",
    enTitle: "Emre, 'a short thing'",
    enText: "A short thing, a long IBAN. Old classmate, new squeeze.",
    choices: [
      choice("lend", "Gönder", "Send it", "Nakit iner; hatıra", { money: -1200, reason: "Emre nakit", memory: "Emre'ye kısa borç verdin." }, { npcMemory: { personId: "emre", text: "Kısa borcu verdi.", type: "lc_helped_emre" } }),
      choice("no", "Bu ay yok", "Not this month", "Sınır", { health: { stress: 2 }, relationships: { emre: -3 } }, {}),
    ],
  },
  {
    id: "lc_pension_day",
    arc: "finance",
    tags: ["finance", "career", "late-life", "age-65", "delayed"],
    title: "Maaş yattı, cümle değişti",
    text: "Hesap bildirimi. Eski maaş değil, emekli. Rakam küçük, gün aynı. Aynı gün, başka hayat.",
    enTitle: "The pension landed, the sentence changed",
    enText: "An account notice. Not the old salary, a pension. The number is smaller, the day is the same. The same day, another life.",
    choices: [
      choice("budget", "Bu aya göre kes", "Cut the month to fit", "Disiplin", { health: { stress: 2 }, memory: "Emekli maaşına göre ayı kestin." }, { echo: "Maaş kelimesi değişti, ay değişmedi." }),
      choice("same", "Eski tempo", "The old pace", "Lifestyle; açık", { health: { stress: 4 } }, {}),
    ],
  },
  {
    id: "lc_old_office_mail",
    arc: "career",
    tags: ["career", "social", "late-life", "age-65", "delayed", "memory"],
    title: "Burak: 'bir bakış daha'",
    text: "Aynı ı'sız cümle. Bu sefer 'kısa.' Kısa, geçen sefer de kısaydı. Kapı yine aralık.",
    enTitle: "Burak: one more look",
    enText: "The same sentence without an ı. This time 'short.' Short was short last time too. The door is ajar again.",
    choices: [
      choice("go", "Git, bir saat", "Go, one hour", "Kimlik; yorgunluk", { health: { energy: -4, stress: 3 } }, { npcMemory: { personId: "burak", text: "Bir bakış daha geldi.", type: "lc_consult_again" } }),
      choice("no", "Kapandı de", "Say it has closed", "Sınır", { health: { stress: -2 } }, {}),
    ],
  },
  {
    id: "lc_stair_week",
    arc: "health",
    tags: ["health", "housing", "late-life", "age-70", "delayed"],
    title: "Merdiven, market, durak",
    text: "Poşet iki el. Ara basamak yok. Nefes üçüncü katta bitiyor, kapı dördüncüde.",
    enTitle: "Stairs, the shop, a stop",
    enText: "The bag takes both hands. There is no landing. Breath ends on the third floor. The door is on the fourth.",
    choices: [
      choice("rest", "Ara katta dur", "Stop on the landing", "Beden", { health: { energy: 3, stress: -2 } }, {}),
      choice("up", "Çık, bitir", "Go up, finish it", "Gurur; nefes", { health: { energy: -5 } }, {}),
    ],
  },
  {
    id: "lc_sunday_empty",
    arc: "crisis",
    tags: ["crisis", "relationship", "late-life", "age-70", "delayed"],
    title: "Pazar, tek tabak",
    text: "Televizyon yüksek. Yüksek, konuşacak biri yok diye. Bu bir tercih diye satılıyor yine. Satılmıyor.",
    enTitle: "Sunday, one plate",
    enText: "The television is loud. Loud because there is no one to talk to. It is being sold as a choice again. It does not sell.",
    choices: [
      choice("call", "Birini ara", "Call someone", "Bağ", { health: { stress: -4 } }, {}),
      choice("walk", "Çık, otur bankta", "Go out, sit on a bench", "Hava", { health: { energy: 3, stress: -2 } }, {}),
    ],
  },
  {
    id: "lc_name_plate",
    arc: "housing",
    tags: ["housing", "status", "late-life", "age-75", "delayed"],
    title: "İsimlik, silik",
    text: "Kapıdaki isim okunmuyor. Postacı 'hangi daire' diye soruyor. Sormak, görünmez olmak değil, solmuş olmak.",
    enTitle: "The nameplate, faded",
    enText: "The name on the door cannot be read. The postman asks which flat. Asking is not being invisible. It is having faded.",
    choices: [
      choice("new", "İsimlik yaptır", "Have a new plate made", "Görünürlük; nakit", { money: -350, reason: "İsimlik", health: { stress: -2 } }, {}),
      choice("say", "Numarayı söyle", "Give the number", "İdare", { health: { stress: 1 } }, {}),
    ],
  },
  {
    id: "lc_winter_bus",
    arc: "health",
    tags: ["health", "late-life", "age-75", "delayed"],
    title: "Otobüs, basamak, şoför bekliyor",
    text: "Kapı açık. Sen yavaşsın. Arkadan 'abi' deniyor. Abi, acele demek. Acele, düşmek.",
    enTitle: "The bus, a step, the driver waiting",
    enText: "The door is open. You are slow. Someone behind says 'abi.' Abi means hurry. Hurry means falling.",
    choices: [
      choice("slow", "Yavaş in, bakma", "Get off slowly, do not look", "Beden", { health: { energy: -3, stress: 2 } }, {}),
      choice("taxi", "Bu hat değil, taksi", "Not this line, a taxi", "Nakit; güvenlik", { money: -280, reason: "Taksi", health: { stress: -2 } }, {}),
    ],
  },
  {
    id: "lc_photo_ask",
    arc: "family",
    tags: ["family", "late-life", "age-80", "delayed", "memory"],
    title: "Birisi fotoğraf istiyor",
    text: "Eski bir yüz, 'şu kutu' diyor. Kutu senin elinde değil, dolapta. Vermek, dağıtmak. Dağıtmak, henüz ölüm değil.",
    enTitle: "Someone wants a photograph",
    enText: "An old face says 'that box.' The box is not in your hand, it is in the cupboard. Giving is handing out. Handing out is not death yet.",
    choices: [
      choice("give", "Bir tanesini ver", "Give one", "Paylaşım", { health: { stress: -2 } }, {}),
      choice("later", "Ben bakarım de", "Say you will look", "Erteleme", { health: { stress: 1 } }, {}),
    ],
  },
  {
    id: "lc_child_transfer",
    arc: "family",
    tags: ["family", "finance", "late-life", "age-65", "delayed", "memory"],
    title: "Aktarım cümlesi yine",
    text: "Emekli ayı. Çocuk 'kısa' diyor yine. Kısa, senin bir haftan. Rol değişmedi, rakam değişti.",
    enTitle: "The transfer sentence again",
    enText: "A pension month. The child says 'short' again. Short is a week of yours. The role has not changed. The number has.",
    choices: [
      choice("send", "Gönder", "Send it", "Rol durur", { money: -1800, reason: "Geç dönem aktarım", health: { stress: 3 } }, {}),
      choice("no", "Bu ay yok", "Not this month", "Sınır", { health: { stress: 4 } }, {}),
    ],
  },
  {
    id: "lc_mehmet_years",
    arc: "social",
    tags: ["social", "memory", "late-life", "age-70", "delayed"],
    title: "Mehmet, 'kanka duruyorsun'",
    text: "Durmak, yaşamak. Rakam yok. Çay var. Çay, eski borcun faizi değil, yoklama.",
    enTitle: "Mehmet, 'kanka you are still here'",
    enText: "Still here means alive. No number. There is tea. Tea is not interest on the old debt. It is roll-call.",
    choices: [
      choice("tea", "Çay söyle", "Order tea", "Hatıra", { health: { stress: -3 } }, { npcMemory: { personId: "mehmet", text: "Çayda durduk.", type: "lc_mehmet_tea" } }),
      choice("short", "Kısa otur", "Sit a short while", "Mesafe", { health: { stress: -1 } }, {}),
    ],
  },
  {
    id: "lc_elif_pace",
    arc: "relationship",
    tags: ["relationship", "health", "late-life", "age-70", "delayed", "memory"],
    title: "Elif, takvim yine, tempo başka",
    text: "Takvim değil, ayırdığın zaman konuşuyor. Bu sefer zaman var. Tempo yok. İki sandalye, bir yürüyüş, yarım tur.",
    enTitle: "Elif, the calendar again, another pace",
    enText: "It is not the calendar. It is the time you set aside. This time there is time. There is no pace. Two chairs, one walk, half a loop.",
    choices: [
      choice("slow", "Yarım tur, tam çay", "Half a loop, a full tea", "Bağ", { health: { stress: -4 } }, { npcMemory: { personId: "elif", text: "Tempo benim olsun dedi.", type: "lc_elif_slow" } }),
      choice("skip", "Bugün ev", "Home today", "Beden", { health: { energy: 3 } }, {}),
    ],
  },
  {
    id: "lc_selin_visit",
    arc: "social",
    tags: ["social", "family", "late-life", "age-75", "delayed", "memory"],
    title: "Selin kapıda, zarf yok",
    text: "Kuzenim bu ay yetiştiremedim demiyor. Yetişmiş. Zarf yok. Zarf olmayınca ziyaret, hesap değil.",
    enTitle: "Selin at the door, no envelope",
    enText: "She does not say she could not make it this month. She has made it. No envelope. Without an envelope a visit is not an account.",
    choices: [
      choice("in", "Buyur, çay", "Come in, tea", "Bağ", { health: { stress: -3 } }, { npcMemory: { personId: "selin", text: "Zarf olmadan oturdu.", type: "lc_selin_sat" } }),
      choice("short", "Kapıda konuş", "Talk at the door", "Mesafe", { health: { stress: 1 } }, {}),
    ],
  },
  {
    id: "lc_arrears_quiet",
    arc: "finance",
    tags: ["finance", "late-life", "age-65", "delayed", "economy"],
    title: "Gecikme, emekli satırında",
    text: "Kâğıt aynı kâğıt. Maaş başka maaş. Arrears emekli olunca kaybolmuyor, küçülünce görünüyor.",
    enTitle: "Arrears, on the pension line",
    enText: "The same paper. A different wage. Arrears do not vanish when you retire. They show when you shrink.",
    choices: [
      choice("pay", "Bir kısmını kapat", "Clear some of it", "Sicil", { money: -900, reason: "Emekli gecikme", health: { stress: 3 } }, {}),
      choice("hold", "Bu ay dokunma", "Do not touch it this month", "Yük", { health: { stress: 5 } }, {}),
    ],
  },
  {
    id: "lc_rent_weight",
    arc: "housing",
    tags: ["housing", "finance", "late-life", "age-70", "delayed", "economy"],
    title: "Kira, emekli ayının yarısı",
    text: "Ev sahibi artırmıyor, artırmasına gerek yok. Oran kendiliğinden büyümüş. Büyümek, metrekare değil, pay.",
    enTitle: "Rent, half the pension month",
    enText: "The landlord is not raising it. He does not have to. The ratio has grown on its own. Growing is not square metres. It is a share.",
    choices: [
      choice("pay", "Zamanında yatır", "Pay on time", "Huzur", { money: -400, reason: "Kira farkı", health: { stress: 2 } }, {}),
      choice("talk", "Konuş, indirim yoksa da sor", "Talk, even if there is no cut", "Netlik", { health: { stress: 4 } }, {}),
    ],
  },
  {
    id: "lc_late_clinic",
    arc: "health",
    tags: ["health", "late-life", "age-75", "delayed"],
    title: "Randevu üç ay sonra",
    text: "Sistem 'en yakın' diyor. En yakın, kış. Kış, yürümek. Yürümek, randevunun kendisi kadar iş.",
    enTitle: "An appointment in three months",
    enText: "The system says 'the nearest.' The nearest is winter. Winter is walking. Walking is as much work as the appointment.",
    choices: [
      choice("take", "Randevu aramayı planla", "Plan to seek an appointment", "Niyet; randevu kesinleşmez", { health: { stress: 2 }, memory: "Üç ay sonrası için randevu aramayı planladın; henüz randevu almadın." }, {}),
      choice("wait", "Bu kış idare", "Manage this winter", "Erteleme", { health: { stress: 3 } }, {}),
    ],
  },
  {
    id: "lc_night_lamp",
    arc: "health",
    tags: ["health", "housing", "late-life", "age-80", "delayed"],
    title: "Gece, koridor, tek lamba",
    text: "Düşmemek bir başarı gibi durmuyor. Durması da gerekmiyor. Lamba yanık, ev uyanık.",
    enTitle: "Night, the corridor, one lamp",
    enText: "Not falling does not look like an achievement. It does not have to. The lamp is on. The house is awake.",
    choices: [
      choice("on", "Yanık bırak", "Leave it on", "Güvenlik", { health: { stress: -2 } }, {}),
      choice("off", "Söndür", "Switch it off", "Tasarruf; risk", { health: { stress: 2 } }, {}),
    ],
  },
];

function extraToEvent(row) {
  return {
    id: row.id,
    lifeContent: true,
    chain: row.chain || null,
    stage: row.stage || 0,
    arc: row.arc || "crisis",
    tags: row.tags || [],
    delayed: true,
    repeat: "repeatable",
    title: row.title,
    text: row.text,
    en: { title: row.enTitle || row.title, text: row.enText || row.text, choices: Object.fromEntries(row.choices.map((c) => [c.id, c.en || c.label])) },
    condition: () => false,
    choices: row.choices.map((c) => ({
      id: c.id, label: c.label, risk: c.risk, effects: c.effects || {},
      lifeNext: c.lifeNext || null, lifeStage: c.lifeStage, npcMemory: c.npcMemory || null,
      echo: c.echo || null, opportunity: c.opportunity || null, goal: c.goal || null,
    })),
  };
}

export const LIFE_CONTENT_CHAIN_EVENTS = CHAINS.flatMap((chain) => chain.nodes.map((node) => nodeToEvent(chain, node)));
export const LIFE_CONTENT_CALLBACKS = EXTRA_CALLBACKS.map(extraToEvent);
export const LIFE_CONTENT_EVENTS = LIFE_CONTENT_CHAIN_EVENTS.concat(LIFE_CONTENT_CALLBACKS);

// Delayed prose that explicitly assumes the same partner, employer or home must
// be revalidated when it becomes due. Other career callbacks (certificates,
// mentors, references) intentionally survive a job change, so this is a small
// allow-list rather than a blanket "must still have a job" rule.
const PARTNER_SENSITIVE_CALLBACKS = new Set([
  "lc_overtime_partner",
  "lc_secret_kept",
  "lc_nikah_money",
  "lc_nikah_held",
  "lc_elif_walk",
  "lc_elif_distance",
  "lc_partner_clinic",
  "lc_partner_tea",
  "lc_elif_pace",
]);
const NO_PARTNER_SENSITIVE_CALLBACKS = new Set(["lc_sunday_empty"]);
const EMPLOYER_SENSITIVE_CALLBACKS = new Set([
  "lc_metro_month",
  "lc_metro_notice",
  "lc_metro_move",
  "lc_local_team",
  "lc_staff_ceiling",
  "lc_near_job_quiet",
  "lc_afterwork_bill",
  "lc_office_side",
  "lc_last_desk",
]);
const HOME_SENSITIVE_CALLBACKS = new Set([
  "lc_neighbor_day",
  "lc_dues_paint",
  "lc_deposit_wait",
  "lc_sugar_back",
  "lc_landlord_sale",
  "lc_downsize_box",
  "lc_downsize_key",
  "lc_stay_stair",
  "lc_rent_weight",
  "lc_stair_week",
  "lc_name_plate",
]);
const ADULT_CHILD_SENSITIVE_CALLBACKS = new Set([
  "lc_child_table",
  "lc_child_year",
  "lc_child_transfer",
]);
const ACTOR_SENSITIVE_CALLBACKS = new Map([
  ["lc_consult_month", "burak"],
  ["lc_consult_end", "burak"],
  ["lc_old_silence", "mehmet"],
  ["lc_old_photo", "mehmet"],
]);

function scheduleContent(state, spec) {
  if (!spec?.eventId || !spec?.key) return false;
  if (!LIFE_CONTENT_EVENTS.some((row) => row.id === spec.eventId)) return false;
  const id = `lc:${spec.key}`;
  const store = bag(state);
  if (store.once[id] || store.waiting.some((row) => row.id === id || row.eventId === spec.eventId)) return false;
  if (store.waiting.length >= 11) return false;
  const expectedPartnerId = PARTNER_SENSITIVE_CALLBACKS.has(spec.eventId)
    ? (spec.actorId || partnerId(state) || null)
    : null;
  const expectedJobId = EMPLOYER_SENSITIVE_CALLBACKS.has(spec.eventId)
    ? (state.career?.jobId || null)
    : null;
  const expectedHomeId = HOME_SENSITIVE_CALLBACKS.has(spec.eventId)
    ? (state.household?.homeId || null)
    : null;
  const actorId = spec.actorId || ACTOR_SENSITIVE_CALLBACKS.get(spec.eventId) || null;
  store.waiting.push({
    id,
    eventId: spec.eventId,
    dueWeek: state.time.absoluteWeek + Math.max(1, spec.dueWeeks || 4),
    actorId,
    expectedPartnerId,
    expectedJobId,
    expectedHomeId,
    expectedNoPartner: NO_PARTNER_SENSITIVE_CALLBACKS.has(spec.eventId),
    requiresAdultChild: ADULT_CHILD_SENSITIVE_CALLBACKS.has(spec.eventId),
  });
  store.waiting = cap(store.waiting, 12);
  store.once[id] = state.time.absoluteWeek;
  return true;
}

function pushEcho(state, text, id) {
  if (!text) return;
  const depth = ensureLifeDepthState(state);
  const row = { id: id || `lc-echo:${state.time.absoluteWeek}:${depth.echoes.length}`, week: state.time.absoluteWeek, text };
  if (!depth.echoes.some((item) => item.id === row.id)) depth.echoes = cap(depth.echoes.concat(row), 12);
}

export function applyLifeContentResolution(state, definition, choiceId) {
  if (!definition?.lifeContent) return false;
  const choice = definition.choices.find((row) => row.id === choiceId);
  if (!choice) return false;
  const store = bag(state);
  if (definition.exclusive && definition.branch) store.exclusive[definition.exclusive] = definition.branch;
  if (definition.chain && Number.isFinite(choice.lifeStage)) store.chains[definition.chain] = choice.lifeStage;
  if (choice.lifeLock && definition.exclusive) store.exclusive[definition.exclusive] = choice.lifeLock;
  if (choice.lifeNext) scheduleContent(state, choice.lifeNext);
  if (choice.npcMemory?.personId) {
    addNpcMemory(state, choice.npcMemory.personId, choice.npcMemory.text, choice.npcMemory.type || "life_content");
  }
  if (choice.echo) pushEcho(state, choice.echo, `lc-echo:${definition.id}:${choiceId}:${state.time.absoluteWeek}`);
  const depth = ensureLifeDepthState(state);
  if (choice.opportunity) {
    depth.opportunities = unique(cap(depth.opportunities.concat({
      id: `lc-opp:${definition.id}:${state.time.absoluteWeek}`,
      arc: definition.arc || "career",
      label: choice.opportunity,
      status: "open",
    }), 8));
  }
  if (choice.goal) {
    depth.contentGoals = unique(cap(depth.contentGoals.concat({
      id: `lc-goal:${definition.id}`,
      arc: definition.arc || "housing",
      label: choice.goal,
      progress: 0,
    }), 2));
    depth.goals = unique(depth.contentGoals.concat(depth.goals)).slice(0, 6);
  }
  store.once[`seen:${definition.id}`] = state.time.absoluteWeek;
  if (definition.organic) {
    store.lastWeek = state.time.absoluteWeek;
    store.arcCounts[definition.arc] = (Number(store.arcCounts[definition.arc]) || 0) + 1;
    store.arcLastWeek[definition.arc] = state.time.absoluteWeek;
  }
  return true;
}

export function processLifeContentWeek(state) {
  const depth = ensureLifeDepthState(state);
  const store = bag(state);
  const week = state.time.absoluteWeek;
  if (store.autoWeek === week) return true;
  const trySched = (ok, spec) => {
    if (!ok) return false;
    if (scheduleContent(state, spec)) {
      store.autoWeek = week;
      return true;
    }
    return false;
  };
  if (trySched(Number(state.finances?.arrears) > 0 && week >= 16, { eventId: "lc_arrears_letter", dueWeeks: 3, key: "arrears-letter" })) return true;
  if (trySched((state.flags.overtimeStreak || 0) >= 3 && partnerId(state), { eventId: "lc_overtime_partner", dueWeeks: 5, key: "overtime-partner", actorId: partnerId(state) })) return true;
  if (trySched(hasNpcMemory(state, "mehmet", "lc_helped_mehmet_money") && state.household?.homeId !== "family" && week >= 20, { eventId: "lc_move_help_echo", dueWeeks: 7, key: "move-help", actorId: "mehmet" })) return true;
  if (trySched(!state.career?.jobId && !isRetired(state) && week >= 24, { eventId: "lc_jobless_week", dueWeeks: 4, key: "jobless-week" })) return true;
  if (trySched((state.health?.energy || 100) < 35 && week >= 12, { eventId: "lc_sleep_debt", dueWeeks: 2, key: "sleep-debt" })) return true;
  if (trySched(state.household?.homeId === "family" && state.player.age >= 23 && week >= 20 && !depth.goals.some((row) => row.id === "lc-goal:lc_goal_housing"), { eventId: "lc_goal_housing", dueWeeks: 6, key: "goal-housing" })) return true;
  if (trySched((state.career?.performance || 0) >= 70 && week >= 30 && !isRetired(state) && state.career?.jobId, { eventId: "lc_status_dinner", dueWeeks: 8, key: "status-dinner" })) return true;
  if (trySched(hasNpcMemory(state, "elif", "lc_elif_delay") && partnerId(state), { eventId: "lc_secret_kept", dueWeeks: 9, key: "secret-kept" })) return true;
  if (trySched((hasNpcMemory(state, "anne", "lc_bayram_came") || hasNpcMemory(state, "anne", "lc_bayram_missed")) && week >= 48, { eventId: "lc_bayram_year", dueWeeks: 8, key: "bayram-year", actorId: "anne" })) return true;
  if (trySched(hasNpcMemory(state, "mehmet", "lc_wedding_came") || hasNpcMemory(state, "mehmet", "lc_wedding_missed"), { eventId: "lc_wedding_year", dueWeeks: 12, key: "wedding-year", actorId: "mehmet" })) return true;
  if (trySched(hasNpcMemory(state, "baba", "lc_father_health") && week >= 32, { eventId: "lc_father_hospital", dueWeeks: 6, key: "father-hospital", actorId: "baba" })) return true;
  if (trySched(state.household?.homeId !== "family" && week >= 40 && Number(state.finances?.balance) < 8000, { eventId: "lc_landlord_sale", dueWeeks: 5, key: "landlord-sale" })) return true;
  if (trySched(Number(state.finances?.arrears) > 0 || Number(state.finances?.balance) < 2500, { eventId: "lc_credit_limit", dueWeeks: 4, key: "credit-limit" })) return true;
  if (trySched(hasNpcMemory(state, "burak", "lc_used_ref") || hasNpcMemory(state, "burak", "lc_burak_kept"), { eventId: "lc_reference_ask", dueWeeks: 10, key: "reference-ask", actorId: "burak" })) return true;
  if (trySched(!partnerId(state) && week >= 50 && (state.health?.stress || 0) >= 40, { eventId: "lc_newyear_alone", dueWeeks: 6, key: "newyear-alone" })) return true;
  if (trySched(week >= 36 && (Number(state.finances?.arrears) > 0 || economyCausality(state).debt > 0), { eventId: "lc_tax_notice", dueWeeks: 5, key: "tax-notice" })) return true;
  if (trySched(hasChild(state) && week >= 34, { eventId: "lc_child_fever_night", dueWeeks: 7, key: "child-fever" })) return true;
  if (trySched(personOk(state, "emre") && week >= 22 && Number(state.finances?.balance) > 3000 && state.player.age < 60, { eventId: "lc_emre_loan", dueWeeks: 9, key: "emre-loan", actorId: "emre" })) return true;
  const age = Number(state.player?.age) || 0;
  if (trySched(isRetired(state) && age >= 65, { eventId: "lc_pension_day", dueWeeks: 3, key: "pension-day" })) return true;
  if (trySched(isRetired(state) && age >= 60 && age <= 69 && shownBranch(state, "late-work") === "consult" && personOk(state, "burak"), { eventId: "lc_consult_ask", dueWeeks: 4, key: "consult-ask", actorId: "burak" })) return true;
  if (trySched(isRetired(state) && age >= 60 && age <= 69 && shownBranch(state, "late-work") === "leave", { eventId: "lc_leave_clean", dueWeeks: 4, key: "leave-clean" })) return true;
  if (trySched(age >= 70 && age <= 74 && state.household?.homeId !== "family" && shownBranch(state, "late-home") === "downsize", { eventId: "lc_downsize_talk", dueWeeks: 5, key: "downsize-talk" })) return true;
  if (trySched(age >= 70 && age <= 74 && state.household?.homeId !== "family" && shownBranch(state, "late-home") === "stay", { eventId: "lc_stay_repair", dueWeeks: 5, key: "stay-repair" })) return true;
  if (trySched(age >= 70 && age <= 74 && shownBranch(state, "late-family") === "near", { eventId: "lc_near_sunday", dueWeeks: 6, key: "near-sunday" })) return true;
  if (trySched(age >= 70 && age <= 74 && shownBranch(state, "late-family") === "independent" && state.household?.homeId !== "family", { eventId: "lc_own_table", dueWeeks: 6, key: "own-table" })) return true;
  if (trySched(age >= 75 && age <= 79 && shownBranch(state, "late-circle") === "club", { eventId: "lc_club_chair", dueWeeks: 5, key: "club-chair" })) return true;
  if (trySched(age >= 75 && age <= 79 && shownBranch(state, "late-circle") === "home", { eventId: "lc_home_radio", dueWeeks: 5, key: "home-radio" })) return true;
  if (trySched(isRetired(state) && age >= 65 && age <= 72 && personOk(state, "burak"), { eventId: "lc_old_office_mail", dueWeeks: 8, key: "old-office-mail", actorId: "burak" })) return true;
  if (trySched(age >= 70 && (state.health?.energy || 100) < 55, { eventId: "lc_stair_week", dueWeeks: 4, key: "stair-week" })) return true;
  if (trySched(age >= 70 && !partnerId(state), { eventId: "lc_sunday_empty", dueWeeks: 6, key: "sunday-empty" })) return true;
  if (trySched(age >= 75 && state.household?.homeId !== "family", { eventId: "lc_name_plate", dueWeeks: 5, key: "name-plate" })) return true;
  if (trySched(age >= 75 && (state.health?.energy || 100) < 50, { eventId: "lc_winter_bus", dueWeeks: 4, key: "winter-bus" })) return true;
  if (trySched(age >= 80, { eventId: "lc_photo_ask", dueWeeks: 7, key: "photo-ask" })) return true;
  if (trySched(age >= 65 && hasAdultChild(state), { eventId: "lc_child_transfer", dueWeeks: 9, key: "child-transfer" })) return true;
  if (trySched(age >= 70 && personOk(state, "mehmet") && (hasNpcMemory(state, "mehmet", "lc_helped_mehmet_money") || hasNpcMemory(state, "mehmet", "lc_mehmet_years")), { eventId: "lc_mehmet_years", dueWeeks: 8, key: "mehmet-years", actorId: "mehmet" })) return true;
  if (trySched(age >= 70 && partnerId(state) === "elif", { eventId: "lc_elif_pace", dueWeeks: 6, key: "elif-pace", actorId: "elif" })) return true;
  if (trySched(age >= 75 && personOk(state, "selin"), { eventId: "lc_selin_visit", dueWeeks: 10, key: "selin-visit", actorId: "selin" })) return true;
  if (trySched(age >= 65 && Number(state.finances?.arrears) > 0, { eventId: "lc_arrears_quiet", dueWeeks: 5, key: "arrears-quiet" })) return true;
  if (trySched(age >= 70 && state.household?.homeId !== "family" && isRetired(state), { eventId: "lc_rent_weight", dueWeeks: 6, key: "rent-weight" })) return true;
  if (trySched(age >= 75 && (state.health?.energy || 100) < 45, { eventId: "lc_late_clinic", dueWeeks: 5, key: "late-clinic" })) return true;
  if (trySched(age >= 80, { eventId: "lc_night_lamp", dueWeeks: 4, key: "night-lamp" })) return true;
  return true;
}

export function pickLifeContentOrganic(state) {
  const store = bag(state);
  const week = state.time.absoluteWeek;
  if (Number.isInteger(store.lastWeek) && week - store.lastWeek < 6) return null;
  if (state.events?.active || (state.events?.queue || []).length) return null;
  const eligible = LIFE_CONTENT_EVENTS.filter(
    (row) =>
      row.organic &&
      !state.events.seen.includes(row.id) &&
      typeof row.organicCheck === "function" &&
      row.organicCheck(state),
  );
  if (!eligible.length) return null;
  const next = eligible.sort((a, b) => {
    const count = (Number(store.arcCounts[a.arc]) || 0) - (Number(store.arcCounts[b.arc]) || 0);
    if (count) return count;
    const age = (Number(store.arcLastWeek[a.arc]) || -1) - (Number(store.arcLastWeek[b.arc]) || -1);
    if (age) return age;
    return hash(state.meta?.seed || 1, `${week}:${a.id}`) - hash(state.meta?.seed || 1, `${week}:${b.id}`);
  })[0];
  return next?.id || null;
}

export function shouldOfferLifeContent(state) {
  const store = bag(state);
  const week = Number(state.time?.absoluteWeek) || 0;
  if (week < 6) return false;
  return !Number.isInteger(store.lastWeek) || week - store.lastWeek >= 6;
}

export function takeDueLifeContent(state) {
  if (state.lifetime?.death) return null;
  if (state.events?.active || (state.events?.queue || []).length) return null;
  const store = bag(state);
  while (true) {
    const due = store.waiting.find((row) => Number(row.dueWeek) <= state.time.absoluteWeek);
    if (!due) return null;
    store.waiting = store.waiting.filter((row) => row.id !== due.id);
    store.once[`resolved:${due.id}`] = state.time.absoluteWeek;
    if (due.actorId && !personOk(state, due.actorId)) continue;
    if (due.expectedPartnerId && (partnerId(state) !== due.expectedPartnerId || !personOk(state, due.expectedPartnerId))) continue;
    if (due.expectedNoPartner && partnerId(state)) continue;
    if (due.expectedJobId && (
      state.career?.jobId !== due.expectedJobId ||
      state.career?.retirement?.status === "retired"
    )) continue;
    if (due.expectedHomeId && state.household?.homeId !== due.expectedHomeId) continue;
    if (due.requiresAdultChild && !hasAdultChild(state)) continue;
    if (!LIFE_CONTENT_EVENTS.some((row) => row.id === due.eventId)) continue;
    return due.eventId;
  }
}

const OUTCOME_FLAVOR = {
  balanced: ["Denge bir zafer değil; kırılmadan durmuş bir masa.", "Balance is not a victory; it is a table that did not break."],
  "successful-but-alone": ["İş cümlesi uzun, ev cümlesi kısa kaldı.", "The work sentence ran long; the house sentence stayed short."],
  "simple-with-strong-bonds": ["Rakamlar mütevazı, kapı kalabalık.", "The numbers are modest; the doorway is crowded."],
  "wealthy-but-burned-out": ["Hesap duruyor, uyku durmuyor.", "The account is standing. Sleep is not."],
  "financially-secure": ["Borç cümlesi kapanmış. Başka cümleler açık.", "The debt sentence closed. Other sentences are still open."],
  "burned-out": ["Teslimler bitti, beden bitmedi.", "The deadlines ended. The body did not."],
  "debt-burdened": ["Arrears bir kâğıttı, sonra adres oldu.", "Arrears was a piece of paper, then an address."],
};

const EXTRA_FLAVOR = [
  ["Yol kısa tutuldu, masa uzaklaştı.", "The road was kept short; the table moved away."],
  ["Sertifika kâğıdı duruyor, uyku değil.", "The certificate paper remains; sleep does not."],
  ["Takı takıldı, borç da.", "The gift was pinned, and so was the debt."],
  ["İsim kapıyı açtı, liyakat koridorda kaldı.", "The name opened the door; merit stayed in the corridor."],
  ["Bayram masası seni saydı ya da saymadı.", "The bayram table counted you, or it did not."],
  ["Kreş kapısı ile iş kapısı aynı dakikaya sığmadı.", "The nursery door and the work door did not fit the same minute."],
  ["Kadıköy hattı işin parçası oldu, evin değil.", "The Kadıköy line became part of the job, not of the house."],
  ["Sessiz ev bir başarı gibi satıldı, satılmadı.", "The quiet flat was sold as an achievement. It did not sell."],
  ["Pazartesi alarmı kalktı, beden kalkmadı.", "The Monday alarm was lifted. The body was not."],
  ["Danışmanlık bir mevsim sürdü, bir hayat değil.", "The consulting lasted a season, not a life."],
  ["Oda azaldı, merdiven kısaldı.", "The rooms shrank. The stairs shortened."],
  ["Pazar masasında misafirdin, ev sahibi değil.", "At the Sunday table you were a guest, not the host."],
  ["Dernek sandalyesi doldu ya da ev radyo ile kaldı.", "The club chair filled, or the house stayed with the radio."],
  ["Yedek anahtar kapıcıda, düşmeme kararı sende.", "The spare key is with the caretaker. The decision not to fall is yours."],
];

export const DOSSIER_TRACE_TEMPLATES = [
  { id: "lc-trace-abroad", test: (state) => bag(state).exclusive["career-fork"] === "yurtdisi", text: "Pasaport iş dosyasına girdi; dönüş cümlesi kurulmadı ya da kuruldu." },
  { id: "lc-trace-local", test: (state) => bag(state).exclusive["career-fork"] === "yerel", text: "Kariyer bu binada kaldı; dış kapı aralanmadı." },
  { id: "lc-trace-metro", test: (state) => bag(state).exclusive["commute-path"] === "metro", text: "İskele-metro-iş bir vardiya oldu, ev ikinci vardiya." },
  { id: "lc-trace-car", test: (state) => bag(state).exclusive["commute-path"] === "car", text: "Direksiyon yolu kısalttı, taksit cümleyi uzattı." },
  { id: "lc-trace-arrears", test: (state) => Number(state.finances?.arrears) > 0 || bag(state).once["lc:arrears-letter"], text: "Gecikmiş bakiye bir kâğıttı, sonra bir adres." },
  { id: "lc-trace-bayram", test: (state) => hasNpcMemory(state, "anne", "lc_bayram_came") || hasNpcMemory(state, "anne", "lc_bayram_missed"), text: "Bayram otogarı bir karar olarak kaldı, bilet olarak değil." },
  { id: "lc-trace-wedding", test: (state) => hasNpcMemory(state, "mehmet", "lc_wedding_came") || hasNpcMemory(state, "mehmet", "lc_wedding_missed"), text: "Salon fotoğrafı bir borç defteri gibi durdu." },
  { id: "lc-trace-mehmet", test: (state) => hasNpcMemory(state, "mehmet", "lc_helped_mehmet_money") || hasNpcMemory(state, "mehmet", "lc_refused_mehmet"), text: "Nakit gitti ya da gitmedi; isim kaldı." },
  { id: "lc-trace-nikah", test: (state) => Boolean(bag(state).exclusive["nikah-timing"]), text: "Nikâh tarihi konuşuldu; konuşmak, takmak değil." },
  { id: "lc-trace-school", test: (state) => Boolean(bag(state).exclusive["education-vs-job"]), text: "Kurs ile kapanış aynı saate sığmadı." },
  { id: "lc-trace-home", test: (state) => Boolean(bag(state).exclusive["housing-near"] || state.household?.homeId), text: "Adres bir tercih olarak yazıldı; semt bir cümle, dakika bir fatura." },
  { id: "lc-trace-crisis", test: (state) => Boolean(bag(state).exclusive["crisis-response"]), text: "Krizde kapı açıldı ya da kilitli kaldı." },
  { id: "lc-trace-consult", test: (state) => bag(state).exclusive["late-work"] === "consult", text: "Emeklilikte kapı aralandı; bakış bir mevsim sürdü." },
  { id: "lc-trace-leave-work", test: (state) => bag(state).exclusive["late-work"] === "leave", text: "İş grubu sessize alındı; pazartesi evde kaldı." },
  { id: "lc-trace-downsize", test: (state) => bag(state).exclusive["late-home"] === "downsize", text: "Oda azaldı, merdiven kısaldı; kutu isimlenerek taşındı." },
  { id: "lc-trace-stay-home", test: (state) => bag(state).exclusive["late-home"] === "stay", text: "Eski katta kalındı; damla ve poşet idare edildi." },
  { id: "lc-trace-near-family", test: (state) => bag(state).exclusive["late-family"] === "near", text: "Pazar masasında misafirdin; zil artık senin değil." },
  { id: "lc-trace-independent", test: (state) => bag(state).exclusive["late-family"] === "independent", text: "Tek tabak ve radyo bir düzen olarak tutuldu." },
  { id: "lc-trace-club", test: (state) => bag(state).exclusive["late-circle"] === "club", text: "Dernek sandalyesi bir yer oldu, mülk değil." },
  { id: "lc-trace-home-rhythm", test: (state) => bag(state).exclusive["late-circle"] === "home", text: "Öğle haberi evde tutuldu; pencere katılımdan sayılmadı." },
];

const LATE_DOSSIER_TRACE_IDS = new Set([
  "lc-trace-consult", "lc-trace-leave-work", "lc-trace-downsize", "lc-trace-stay-home",
  "lc-trace-near-family", "lc-trace-independent", "lc-trace-club", "lc-trace-home-rhythm",
]);

export function decorateLifeDossier(state) {
  const depth = ensureLifeDepthState(state);
  const dossier = depth.dossier;
  if (!dossier) return null;
  const flavor = OUTCOME_FLAVOR[dossier.outcome] || OUTCOME_FLAVOR.balanced;
  const extra = EXTRA_FLAVOR[(Number(state.meta?.rngState || state.meta?.seed) || 0) % EXTRA_FLAVOR.length];
  const content = DOSSIER_TRACE_TEMPLATES.filter((row) => {
    try { return row.test(state); } catch { return false; }
  }).map((row) => ({ id: row.id, text: row.text }));
  // The dossier keeps ten traces and buildLifeDossier already hands over ten
  // (the arcHistory tail plus echoes), so appending the authored life-traces
  // last meant they were always the ones cut: across 160 natural death dossiers
  // not one of the twelve templates survived, and the slots went to the final
  // weeks' routine decisions instead. Reserve part of the budget for the
  // authored traces and let the generic rows fill the rest. Outcome math and
  // contentNotes are untouched.
  const RESERVED_CONTENT_TRACES = 5;
  const earlyContent = content.filter((row) => !LATE_DOSSIER_TRACE_IDS.has(row.id));
  const lateContent = content.filter((row) => LATE_DOSSIER_TRACE_IDS.has(row.id));
  const prioritizedContent = lateContent.length
    ? [...earlyContent.slice(0, 3), ...lateContent.slice(0, 2), ...earlyContent.slice(3), ...lateContent.slice(2)]
    : content;
  const genericTraces = (dossier.traces || []).filter((row) =>
    !String(row?.id || "").startsWith("lc-trace-") && !String(row?.id || "").startsWith("lc-flavor-"),
  );
  const traces = unique([
    { id: "lc-flavor-outcome", text: flavor[0] },
    { id: "lc-flavor-seed", text: extra[0] },
    ...prioritizedContent.slice(0, RESERVED_CONTENT_TRACES),
    ...genericTraces,
    ...prioritizedContent.slice(RESERVED_CONTENT_TRACES),
  ]).slice(0, 10);
  dossier.traces = traces;
  dossier.flavor = flavor[0];
  dossier.contentNotes = (lateContent.length
    ? [...earlyContent.slice(0, 4), ...lateContent.slice(0, 4)]
    : content.slice(0, 8)).map((row) => row.text);
  const report = state.lifetime?.reports?.find((row) => row.id === state.lifetime?.death?.reportId);
  if (report?.lifeDossier) {
    report.lifeDossier.traces = traces;
    report.lifeDossier.flavor = flavor[0];
    report.lifeDossier.contentNotes = dossier.contentNotes;
  }
  return dossier;
}

export function actorVoiceLine(personId, en = false) {
  const voice = ACTOR_VOICES[personId];
  if (!voice) return "";
  return en ? voice.line[1] : voice.line[0];
}

export function coverage() {
  const events = LIFE_CONTENT_EVENTS;
  const tagged = (tag) => events.filter((row) => (row.tags || []).includes(tag)).length;
  const delayedNodes = events.filter((row) => row.organic !== true);
  const organic = events.filter((row) => row.organic).length;
  const lateEvents = events.filter((row) => (row.tags || []).includes("late-life"));
  const lateChains = CHAINS.filter((chain) => (chain.tags || []).includes("late-life") || (chain.nodes || []).some((node) => node.minAge >= 65));
  return {
    events: events.length,
    chains: CHAINS.length,
    delayedCallbacks: delayedNodes.length,
    delayedAuto: EXTRA_CALLBACKS.length,
    memorySensitive: events.filter((row) => (row.tags || []).includes("memory") || (row.choices || []).some((c) => c.npcMemory)).length,
    crossArc: events.filter((row) => (row.tags || []).includes("cross")).length,
    phaseAge: events.filter((row) => (row.tags || []).some((tag) => String(tag).startsWith("phase-"))).length + CHAINS.reduce((n, chain) => n + chain.nodes.filter((node) => node.minAge || node.maxAge || node.phase).length, 0),
    economyHousing: tagged("economy") + tagged("housing") + tagged("finance"),
    relationshipFamily: tagged("relationship") + tagged("family"),
    careerEducation: tagged("career") + tagged("education"),
    exclusive: Object.keys(EXCLUSIVE_PAIRS).length,
    voices: Object.keys(ACTOR_VOICES).length,
    organic,
    callbacks: EXTRA_CALLBACKS.length,
    longTerm: events.filter((row) => (row.choices || []).some((c) => (c.lifeNext?.dueWeeks || 0) >= 10)).length,
    dossierTraces: DOSSIER_TRACE_TEMPLATES.length,
    outcomeFlavor: Object.keys(OUTCOME_FLAVOR).length + EXTRA_FLAVOR.length,
    lateLifeEvents: lateEvents.length,
    lateLifeChains: lateChains.length,
    lateLifeDelayed: lateEvents.filter((row) => row.organic !== true).length,
    lateLifeOrganic: lateEvents.filter((row) => row.organic).length,
    lateLifeMemory: lateEvents.filter((row) => (row.tags || []).includes("memory") || (row.choices || []).some((c) => c.npcMemory)).length,
    lateExclusive: Object.keys(EXCLUSIVE_PAIRS).filter((id) => id.startsWith("late-")).length,
  };
}

export { CHAINS, EXTRA_CALLBACKS, LATE_LIFE_CHAINS, bag as lifeContentBag, scheduleContent };
