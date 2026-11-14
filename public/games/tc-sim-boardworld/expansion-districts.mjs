import { VENUES as GOLD_VENUES } from "./city.mjs";
import { getSocietyDistrictEffects } from "./society-systems.mjs";
import { underworldDistrictModifiers } from "./expansion-underworld.mjs";
import { HOMES } from "./content.mjs";
import { REGIONS } from "./expansion-world.mjs";

const DAY = 1440;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
export const DISTRICTS = [
  { id: "kadikoy", regionId: "istanbul", name: "Kadıköy" },
  { id: "besiktas", regionId: "istanbul", name: "Beşiktaş" },
  { id: "sisli", regionId: "istanbul", name: "Şişli" },
  { id: "ankara:kizilay", regionId: "ankara", name: "Kızılay" },
  { id: "ankara:cankaya", regionId: "ankara", name: "Çankaya" },
  { id: "izmir:konak", regionId: "izmir", name: "Konak" },
  { id: "izmir:bornova", regionId: "izmir", name: "Bornova" },
];
const kinds = {
  housing: { name: "Konut ofisi", hours: [8, 18], capacity: 8 },
  work: { name: "İş merkezi", hours: [7, 22], capacity: 12 },
  institution: { name: "Kamu merkezi", hours: [8, 18], capacity: 8 },
  social: { name: "Mahalle buluşma yeri", hours: [9, 22], capacity: 12 },
};
export const VENUES = DISTRICTS.filter((d) => d.regionId !== "istanbul").flatMap((d) =>
  Object.entries(kinds).map(([kind, v]) => ({
    id: `${d.id}:${kind}`,
    districtId: d.id,
    kind,
    ...v,
  })),
);
const district = (id) => DISTRICTS.find((d) => d.id === id);
const venue = (id) => VENUES.find((v) => v.id === id);
const hub = (region) => DISTRICTS.find((d) => d.regionId === region)?.id;
const FOOD_IDS = DISTRICTS.filter((d) => d.regionId !== "istanbul").map((d) => d.id);
// Each independent vendor starts with 12 meals and 1,000 TL. Restocking pays
// 30 TL per meal to an external wholesaler; no second household ledger is used.
const defaultMarket = (day) => ({ stock: 12, cash: 1000, wholesaleSpent: 0, lastDay: day });
const day = (s) => Math.floor(s.time / DAY) + 1;
const active = (s) =>
  s.expansion.family.people.some((p) => p.id === s.expansion.playerId && p.died === null);
const state = (s) =>
  (s.expansion.districts ||= {
    place: null,
    job: null,
    visits: {},
    visitDay: day(s),
    contacts: {},
  });
export function districtForLot(lotId) {
  const [region, home] = String(lotId).split(":");
  if (!REGIONS[region] || !["room", "studio", "apartment"].includes(home)) return null;
  if (region === "istanbul") return HOMES.find((h) => h.id === home)?.district ?? null;
  return DISTRICTS.filter((d) => d.regionId === region)[home === "room" ? 0 : 1].id;
}
export function getPlace(s) {
  const regionId = s.expansion?.world.region ?? "istanbul";
  if (regionId === "istanbul")
    return { regionId, districtId: s.location, venueId: s.city?.venue || null };
  const p = s.expansion?.districts?.place;
  return {
    regionId,
    districtId: p && district(p.districtId)?.regionId === regionId ? p.districtId : hub(regionId),
    venueId: p && district(p.districtId)?.regionId === regionId ? p.venueId : null,
  };
}
export function getDistrictSimulation(s, districtId) {
  const d = district(districtId);
  if (!d || !s.expansion) return null;
  const market = s.expansion.world.regions[d.regionId];
  const firms = Object.entries(s.expansion.economy.firms).filter(([id]) =>
    id.startsWith(`${d.regionId}:`),
  );
  const open = firms.filter(([, f]) => f.status === "open");
  const modifiers = underworldDistrictModifiers(s, districtId);
  const localFirms = open.filter(
    ([id]) => d.regionId === "istanbul" || id.endsWith(":repair") === (hub(d.regionId) === d.id),
  );
  const stock = localFirms.reduce((sum, [, f]) => sum + f.stock, 0);
  const gold = s.society?.districts?.[districtId];
  const society = d.regionId === "istanbul" ? getSocietyDistrictEffects(s, districtId) : {};
  const food =
    d.regionId === "istanbul"
      ? (gold?.foodStock ?? 0)
      : (s.expansion.districts?.foodMarkets?.[districtId]?.stock ?? 12);
  const localIndex =
    { "ankara:kizilay": 5, "ankara:cankaya": -3, "izmir:konak": 4, "izmir:bornova": -2 }[d.id] || 0;
  return {
    demand: clamp(
      market.employment + localIndex + (society.demand || 0) + (modifiers.demand || 0),
      0,
      200,
    ),
    rentPressure: clamp(
      market.price + localIndex + (society.rentPressure || 0) + (modifiers.rentPressure || 0),
      0,
      200,
    ),
    foodStock: food,
    materialStock: d.regionId === "istanbul" ? (gold?.materialStock ?? 0) : stock,
    jobOpenings: clamp(100 + localFirms.length * 5 + (modifiers.jobOpenings || 0), 0, 200),
    serviceDelay: clamp((society.serviceDelay || 0) + (modifiers.serviceDelay || 0), 0, 200),
    security: clamp(70 + (modifiers.security || 0), 0, 100),
    influence: clamp(modifiers.influence || 0, 0, 100),
  };
}
const conflict = (s, minutes) =>
  s.calendar.entries.some(
    (e) => e.status === "confirmed" && e.start < s.time + minutes && e.end > s.time,
  );
const hours = (s, v, minutes = 0) => {
  const start = s.time % DAY;
  return start >= v.hours[0] * 60 && start + minutes <= v.hours[1] * 60;
};
const employer = (s, p, wage) => {
  const first = hub(p.regionId) === p.districtId;
  const types = first ? ["repair"] : ["digital", "teaching"];
  const reserve = Math.round((105 * s.expansion.world.regions[p.regionId].price) / 100);
  return types
    .map((type) => ({
      id: `${p.regionId}:${type}`,
      firm: s.expansion.economy.firms[`${p.regionId}:${type}`],
    }))
    .find(
      ({ firm }) =>
        firm && firm.status === "open" && firm.cash >= wage + reserve * firm.workers * 4,
    );
};
const problem = (s, minutes) =>
  conflict(s, minutes) ? "Bu süre ajandandaki bir planla çakışıyor." : "";
const make = (
  id,
  label,
  description,
  minutes,
  cost,
  reason,
  run = () => "Yolculuk tamamlandı.",
) => ({
  id,
  label,
  description,
  category: "world",
  pay: "total",
  minutes,
  cost,
  disabled: !!reason,
  reason,
  run,
});
export function districtActions(s, api) {
  const p = getPlace(s);
  if (p.regionId === "istanbul") return [];
  const actions = [];
  for (const target of DISTRICTS.filter(
    (d) => d.regionId === p.regionId && d.id !== p.districtId,
  )) {
    const minutes = 45,
      cost = 35;
    actions.push(
      make(
        `district:travel:${target.id}`,
        `${target.name} semtine git`,
        "Toplu taşıma ile semt merkezine yolculuk.",
        minutes,
        cost,
        problem(s, minutes) || (s.player.energy < 10 ? "Yolculuk için enerji gerekir." : ""),
        (n) => {
          n._transit = true;
          return "Yolculuk tamamlandı.";
        },
      ),
    );
  }
  for (const v of VENUES.filter((v) => v.districtId === p.districtId && v.id !== p.venueId)) {
    const minutes = 15,
      used =
        s.expansion.districts?.visitDay === day(s) ? s.expansion.districts.visits[v.id] || 0 : 0;
    const reason =
      problem(s, minutes) ||
      (!hours(s, v, minutes)
        ? "Mekân bu saatte kapalı."
        : used >= v.capacity
          ? "Mekânın günlük kapasitesi dolu."
          : s.player.energy < 5
            ? "Yolculuk için enerji gerekir."
            : "");
    actions.push(
      make(
        `district:visit:${v.id}`,
        `${v.name} ziyaret et`,
        "Yürüyüş · açık saatler ve günlük kapasite geçerlidir.",
        minutes,
        0,
        reason,
        (n) => {
          n._transit = true;
          return "Yolculuk tamamlandı.";
        },
      ),
    );
  }
  if (venue(p.venueId)?.kind === "social") {
    const residents = (api.regionalResidents?.(s, p.regionId) || []).filter(
      (person) =>
        person.health > 0 && person.id.endsWith(":0") === (hub(p.regionId) === p.districtId),
    );
    for (const person of residents) {
      const { id, name } = person;
      const reason =
        problem(s, 45) ||
        (!hours(s, venue(p.venueId), 45)
          ? "Mekân bu saatte kapalı."
          : s.time % DAY < 18 * 60 || (s.time % DAY) + 45 > 21 * 60
            ? "Sakin burada 18:00–21:00 arasında bulunur."
            : s.expansion.districts?.contacts?.[id]?.lastDay === day(s)
              ? "Bugün zaten görüştünüz."
              : "");
      actions.push(
        make(
          `district:meet:${id}`,
          `${name} ile sohbet et`,
          "Yerel bir sakinle bağ kur; her görüşme 45 dakika sürer.",
          45,
          0,
          reason,
          () => "Mahalle sohbeti tamamlandı.",
        ),
      );
    }
  }
  const workplace = p.venueId && venue(p.venueId)?.kind === "work";
  const job = s.expansion.districts?.job;
  const wage = Math.floor(
    (REGIONS[p.regionId].wage * s.expansion.world.regions[p.regionId].employment) / 100,
  );
  const firm = employer(s, p, wage);
  const jobFirm = job && s.expansion.economy.firms[job.firmId];
  if (workplace) {
    const base =
      problem(s, 30) || (!hours(s, venue(p.venueId), 30) ? "Mekân bu saatte kapalı." : "");
    actions.push(
      make(
        "district:apply",
        "Yerel işe başvur",
        "İşletmeyle kalıcı sözleşme kur; ücret işverenin kasasından ödenir.",
        30,
        0,
        base ||
          (getDistrictSimulation(s, p.districtId).jobOpenings < 95
            ? "Bu semtte açık iş olanağı yok."
            : job
              ? "Zaten bir yerel sözleşmen var."
              : !firm
                ? "Ücret ayırabilen açık bir yerel işletme yok."
                : ""),
        () => "İş başvurusu tamamlandı.",
      ),
    );
    if (job) {
      const skill = job.firmId.endsWith(":repair")
        ? "craft"
        : job.firmId.endsWith(":digital")
          ? "technical"
          : "knowledge";
      const pay =
        wage + Math.min(Math.floor(job.shifts / 5), Math.floor(s.player.skills[skill] / 10)) * 25;
      const why =
        problem(s, 360) ||
        (!hours(s, venue(p.venueId), 360)
          ? "Mekân bu saatte kapalı."
          : job.districtId !== p.districtId
            ? "Vardiya sözleşmendeki semtte yapılır."
            : job.lastShiftDay === day(s)
              ? "Bugünkü vardiyan tamamlandı."
              : s.player.energy < 30
                ? "Vardiya için enerji gerekir."
                : !jobFirm ||
                    jobFirm.status !== "open" ||
                    jobFirm.cash < pay ||
                    jobFirm.costs + pay > 1e9
                  ? "İşverenin ücret için yeterli kaynağı yok."
                  : s.bank + pay > 1e9
                    ? "Banka bakiyesi sınırına ulaştın."
                    : "");
      actions.push(
        make(
          "district:shift",
          "Sözleşmeli vardiya",
          `Ücret: ${pay} TL · Her beş vardiyada ilerleme.`,
          360,
          0,
          why,
          () => "Vardiya tamamlandı.",
        ),
      );
      actions.push(
        make(
          "district:quit",
          "Yerel işten ayrıl",
          "Sözleşmeyi sonlandır.",
          15,
          0,
          problem(s, 15),
          () => "İş sözleşmesi sona erdi.",
        ),
      );
    }
  }
  return actions.map((a) =>
    !a.disabled && s.cash + s.bank < a.cost
      ? { ...a, disabled: true, reason: "Bu yolculuk için yeterli bakiye yok." }
      : a,
  );
}
export function adaptDistrictActions(s, actions) {
  const p = getPlace(s);
  const kind = venue(p.venueId)?.kind;
  return actions.map((a) => {
    let reason = "";
    if (a.id.startsWith("world:move:"))
      reason = s.calendar.entries.some(
        (e) => e.status === "confirmed" && e.end > s.time && e.start < s.time + a.minutes + 360,
      )
        ? "Taşınma ve dönüş süresi ajandandaki bir planla çakışıyor."
        : "";
    else if (p.regionId === "istanbul") return a;
    else if (a.id === "world:shift") reason = "Yerel sözleşme için iş merkezine git.";
    else if (a.id === "world:meal" && kind !== "social")
      reason = "Yemek için mahalle buluşma yerine git.";
    else if (a.id.startsWith("institution:") && kind !== "institution")
      reason = "Bu hizmet için kamu merkezine git.";
    else if (/^economy:[^:]+:(ankara|izmir):(room|studio|apartment)$/.test(a.id)) {
      const lot = a.id.split(":").slice(-2).join(":");
      if (kind !== "housing" || districtForLot(lot) !== p.districtId)
        reason = "Konut işlemleri için ilgili semtin konut ofisine git.";
    }
    if (!reason && /^(world:meal|institution:|economy:)/.test(a.id) && kind)
      reason =
        problem(s, a.minutes) ||
        (!hours(s, venue(p.venueId), a.minutes) ? "Mekân bu saatte kapalı." : "");
    if (!reason && a.id === "world:meal") {
      const vendor = s.expansion.districts?.foodMarkets?.[p.districtId] ?? defaultMarket(day(s));
      if (vendor.stock < 1 || vendor.cash + a.cost > 1e9) reason = "Bu semtte yemek için stok yok.";
      else {
        const run = a.run;
        return {
          ...a,
          run(next) {
            const data = state(next);
            data.foodMarkets ||= Object.fromEntries(
              FOOD_IDS.map((id) => [id, defaultMarket(day(next))]),
            );
            const market = data.foodMarkets[p.districtId];
            market.stock--;
            market.cash += a.cost;
            return run(next);
          },
        };
      }
    }
    return reason ? { ...a, disabled: true, reason } : a;
  });
}
export function afterDistrictAction(s, id, before, api) {
  delete s._transit;
  const alive = active(s);
  const oldPerson = before.expansion.playerId;
  if (s.expansion.districts && (!alive || oldPerson !== s.expansion.playerId)) {
    s.expansion.districts.job = null;
    s.expansion.districts.contacts = {};
  }
  if (!alive || oldPerson !== s.expansion.playerId)
    return /^(district:|world:move:)/.test(id) ? "Yaşam sona erdi; eylem tamamlanmadı." : undefined;
  if (id.startsWith("world:move:")) {
    const to = id.slice("world:move:".length),
      from = before.expansion.world.region;
    if (!REGIONS[to] || to === from) return;
    if (s.job) api.settleCareer(s);
    s.city.venue = "";
    s.expansion.world.region = to;
    if (s.expansion.districts) {
      s.expansion.districts.place = null;
      s.expansion.districts.job = null;
    }
    api.expansionEvent(s, "relocation", to, from);
    return;
  }
  if (!id.startsWith("district:")) return;
  const data = state(s),
    p = getPlace(before);
  if (id.startsWith("district:travel:")) {
    const destination = id.slice("district:travel:".length);
    data.place = { districtId: destination, venueId: null };
    api.change(s, { energy: -5 });
  } else if (id.startsWith("district:visit:")) {
    const destination = id.slice("district:visit:".length);
    data.place = { districtId: p.districtId, venueId: destination };
    if (data.visitDay !== day(s)) {
      data.visitDay = day(s);
      data.visits = {};
    }
    data.visits[destination] = (data.visits[destination] || 0) + 1;
    api.change(s, { energy: -2 });
  } else if (id.startsWith("district:meet:")) {
    const resident = id.slice("district:meet:".length);
    const person = api.regionalResidents(s, p.regionId).find((person) => person.id === resident);
    if (!person || person.health <= 0) return "Sakin ayrıldı; görüşme tamamlanmadı.";
    const generation = person.generation;
    const old = data.contacts[resident];
    data.contacts[resident] = {
      score: Math.min(100, (old?.generation === generation ? old.score : 0) + 5),
      lastDay: day(before),
      generation,
      name: person.name,
    };
    api.change(s, { stress: -3 });
  } else if (id === "district:apply") {
    const wage = Math.floor(
      (REGIONS[p.regionId].wage * before.expansion.world.regions[p.regionId].employment) / 100,
    );
    const firm = employer(before, p, wage);
    if (firm)
      data.job = {
        personId: s.expansion.playerId,
        firmId: firm.id,
        districtId: p.districtId,
        shifts: 0,
        lastShiftDay: 0,
      };
  } else if (id === "district:shift" && data.job) {
    const job = data.job,
      firm = s.expansion.economy.firms[job.firmId];
    const skill = job.firmId.endsWith(":repair")
      ? "craft"
      : job.firmId.endsWith(":digital")
        ? "technical"
        : "knowledge";
    const pay =
      Math.floor(
        (REGIONS[p.regionId].wage * before.expansion.world.regions[p.regionId].employment) / 100,
      ) +
      Math.min(Math.floor(job.shifts / 5), Math.floor(before.player.skills[skill] / 10)) * 25;
    if (
      firm.status === "open" &&
      firm.cash >= pay &&
      firm.costs + pay <= 1e9 &&
      s.bank + pay <= 1e9
    ) {
      firm.cash -= pay;
      firm.costs += pay;
      job.shifts = Math.min(1000, job.shifts + 1);
      api.skill(s, skill, 1);
      job.lastShiftDay = day(before);
      s.flags.workDays++;
      api.receive(s, pay, "Yerel vardiya", "bank");
      api.change(s, { energy: -17, stress: 7 });
    } else return "İşveren ödeme yapamadı; vardiya tamamlanmadı.";
  } else if (id === "district:quit") data.job = null;
}
export function tickDistricts(s) {
  if (!s.expansion.districts) return;
  if (!active(s)) {
    s.expansion.districts.job = null;
    s.expansion.districts.contacts = {};
  }
  if (s.expansion.districts.foodMarkets)
    for (const market of Object.values(s.expansion.districts.foodMarkets)) {
      if (market.lastDay >= day(s)) continue;
      const units = Math.min(
        2 * (day(s) - market.lastDay),
        24 - market.stock,
        Math.floor(market.cash / 30),
        Math.floor((1e9 - market.wholesaleSpent) / 30),
      );
      market.stock += units;
      market.cash -= units * 30;
      market.wholesaleSpent += units * 30;
      market.lastDay = day(s);
    }
  for (const [id, contact] of Object.entries(s.expansion.districts.contacts))
    if (s.expansion.economy.residents[id]?.life?.generation !== contact.generation)
      delete s.expansion.districts.contacts[id];
}
export function validateDistricts(s) {
  const x = s.expansion.districts;
  if (x === undefined) return true;
  if (
    !x ||
    typeof x !== "object" ||
    Array.isArray(x) ||
    ![
      "contacts,job,place,visitDay,visits",
      "contacts,foodMarkets,job,place,visitDay,visits",
    ].includes(Object.keys(x).sort().join(",")) ||
    !Number.isSafeInteger(x.visitDay) ||
    x.visitDay < 1 ||
    x.visitDay > day(s) ||
    !x.visits ||
    typeof x.visits !== "object" ||
    Array.isArray(x.visits)
  )
    return false;
  if (
    x.foodMarkets !== undefined &&
    (!x.foodMarkets ||
      typeof x.foodMarkets !== "object" ||
      Array.isArray(x.foodMarkets) ||
      Object.keys(x.foodMarkets).length !== FOOD_IDS.length ||
      FOOD_IDS.some((id) => {
        const m = x.foodMarkets[id];
        return (
          !m ||
          Object.keys(m).sort().join(",") !== "cash,lastDay,stock,wholesaleSpent" ||
          !Number.isSafeInteger(m.lastDay) ||
          m.lastDay < 1 ||
          m.lastDay > day(s) ||
          !Number.isSafeInteger(m.stock) ||
          m.stock < 0 ||
          m.stock > 24 ||
          !Number.isSafeInteger(m.cash) ||
          m.cash < 0 ||
          m.cash > 1e9 ||
          !Number.isSafeInteger(m.wholesaleSpent) ||
          m.wholesaleSpent < 0 ||
          m.wholesaleSpent > 1e9
        );
      }))
  )
    return false;
  if (
    !x.contacts ||
    typeof x.contacts !== "object" ||
    Array.isArray(x.contacts) ||
    Object.entries(x.contacts).some(
      ([id, n]) =>
        !s.expansion.economy.residents[id] ||
        !n ||
        Object.keys(n).sort().join(",") !== "generation,lastDay,name,score" ||
        typeof n.name !== "string" ||
        n.name.length < 1 ||
        n.name.length > 80 ||
        !Number.isSafeInteger(n.generation) ||
        n.generation < 1 ||
        n.generation !== s.expansion.economy.residents[id].life.generation ||
        !Number.isSafeInteger(n.score) ||
        n.score < 1 ||
        n.score > 100 ||
        !Number.isSafeInteger(n.lastDay) ||
        n.lastDay < 1 ||
        n.lastDay > day(s),
    )
  )
    return false;
  if (
    Object.entries(x.visits).some(
      ([id, n]) => !venue(id) || !Number.isSafeInteger(n) || n < 1 || n > venue(id).capacity,
    )
  )
    return false;
  if (
    x.place !== null &&
    (!x.place ||
      Object.keys(x.place).sort().join(",") !== "districtId,venueId" ||
      !district(x.place.districtId) ||
      district(x.place.districtId).regionId !== s.expansion.world.region ||
      district(x.place.districtId).regionId === "istanbul" ||
      (x.place.venueId !== null && venue(x.place.venueId)?.districtId !== x.place.districtId))
  )
    return false;
  const j = x.job;
  return (
    j === null ||
    (!!j &&
      Object.keys(j).sort().join(",") === "districtId,firmId,lastShiftDay,personId,shifts" &&
      j.personId === s.expansion.playerId &&
      active(s) &&
      district(j.districtId)?.regionId === s.expansion.world.region &&
      j.firmId.startsWith(`${s.expansion.world.region}:`) &&
      !!s.expansion.economy.firms[j.firmId] &&
      Number.isSafeInteger(j.shifts) &&
      j.shifts >= 0 &&
      j.shifts <= 1000 &&
      Number.isSafeInteger(j.lastShiftDay) &&
      j.lastShiftDay >= 0 &&
      j.lastShiftDay <= day(s))
  );
}
export function districtView(s) {
  const place = getPlace(s);
  return {
    place,
    districts: DISTRICTS.map((d) => ({
      ...d,
      simulation: getDistrictSimulation(s, d.id),
      venues:
        d.regionId === "istanbul"
          ? GOLD_VENUES.filter((v) => v.district === d.id).map(({ id, name, kind }) => ({
              id,
              name,
              kind,
              districtId: d.id,
            }))
          : VENUES.filter((v) => v.districtId === d.id),
    })),
    contacts: Object.values(s.expansion.districts?.contacts || {}).map((contact) => ({
      name: contact.name,
      score: contact.score,
      lastDay: contact.lastDay,
    })),
    job: s.expansion.districts?.job ? { ...s.expansion.districts.job } : null,
  };
}
const translations = {
  "Konut ofisi": ["Housing office", "Biuro mieszkaniowe"],
  "İş merkezi": ["Work centre", "Centrum pracy"],
  "Kamu merkezi": ["Public services centre", "Centrum usług publicznych"],
  "Mahalle buluşma yeri": ["Community meeting place", "Miejsce spotkań"],
  "Toplu taşıma ile semt merkezine yolculuk.": [
    "Travel to the district centre by transit.",
    "Podróż komunikacją do centrum dzielnicy.",
  ],
  "Yürüyüş · açık saatler ve günlük kapasite geçerlidir.": [
    "Walk · opening hours and daily capacity apply.",
    "Spacer · obowiązują godziny otwarcia i dzienny limit.",
  ],
  "Taşınma ve dönüş süresi ajandandaki bir planla çakışıyor.": [
    "The move and return trip conflict with a calendar commitment.",
    "Przeprowadzka i podróż powrotna kolidują z planem.",
  ],
  "Bu süre ajandandaki bir planla çakışıyor.": [
    "This overlaps a calendar commitment.",
    "Ten czas koliduje z planem w kalendarzu.",
  ],
  "Bu yolculuk için yeterli bakiye yok.": [
    "Insufficient funds for this journey.",
    "Brak środków na podróż.",
  ],
  "Yolculuk için enerji gerekir.": [
    "You need energy to travel.",
    "Potrzebujesz energii na podróż.",
  ],
  "Mekân bu saatte kapalı.": ["The venue is closed at this time.", "Miejsce jest teraz zamknięte."],
  "Mekânın günlük kapasitesi dolu.": [
    "The venue has reached its daily capacity.",
    "Dzienny limit miejsc został wyczerpany.",
  ],
  "Yerel işe başvur": ["Apply for a local job", "Złóż podanie o lokalną pracę"],
  "İşletmeyle kalıcı sözleşme kur; ücret işverenin kasasından ödenir.": [
    "Sign an ongoing contract; wages come from the employer’s funds.",
    "Podpisz umowę; wynagrodzenie pochodzi ze środków pracodawcy.",
  ],
  "Zaten bir yerel sözleşmen var.": [
    "You already have a local contract.",
    "Masz już lokalną umowę.",
  ],
  "Ücret ayırabilen açık bir yerel işletme yok.": [
    "No open local firm can fund wages.",
    "Żadna otwarta firma nie może opłacić wynagrodzenia.",
  ],
  "Sözleşmeli vardiya": ["Contract shift", "Zmiana w ramach umowy"],
  "Vardiya sözleşmendeki semtte yapılır.": [
    "Your shift is in the district in your contract.",
    "Zmiana odbywa się w dzielnicy wskazanej w umowie.",
  ],
  "Bugünkü vardiyan tamamlandı.": [
    "You already worked today.",
    "Dzisiejsza zmiana jest już zakończona.",
  ],
  "Vardiya için enerji gerekir.": [
    "You need energy for a shift.",
    "Potrzebujesz energii na zmianę.",
  ],
  "İşverenin ücret için yeterli kaynağı yok.": [
    "Your employer lacks funds for wages.",
    "Pracodawca nie ma środków na wynagrodzenie.",
  ],
  "Banka bakiyesi sınırına ulaştın.": [
    "Your bank balance has reached its limit.",
    "Osiągnięto limit salda bankowego.",
  ],
  "Yerel işten ayrıl": ["Leave local job", "Odejdź z lokalnej pracy"],
  "Sözleşmeyi sonlandır.": ["End the contract.", "Zakończ umowę."],
  "Yerel sözleşme için iş merkezine git.": [
    "Visit the work centre for a local contract.",
    "Odwiedź centrum pracy, aby zawrzeć lokalną umowę.",
  ],
  "Yemek için mahalle buluşma yerine git.": [
    "Visit the community meeting place for a meal.",
    "Odwiedź miejsce spotkań, aby zjeść posiłek.",
  ],
  "Bu hizmet için kamu merkezine git.": [
    "Visit the public services centre for this service.",
    "Udaj się do centrum usług publicznych.",
  ],
  "Konut işlemleri için ilgili semtin konut ofisine git.": [
    "Visit the housing office for housing matters.",
    "Udaj się do biura mieszkaniowego.",
  ],
  "Sakin burada 18:00–21:00 arasında bulunur.": [
    "The resident is here from 18:00 to 21:00.",
    "Mieszkaniec jest tu od 18:00 do 21:00.",
  ],
  "Bugün zaten görüştünüz.": ["You already met today.", "Spotkaliście się już dzisiaj."],
  "Bu semtte yemek için stok yok.": [
    "No meal stock is available in this district.",
    "W tej dzielnicy brak zapasów na posiłek.",
  ],
  "Bu semtte açık iş olanağı yok.": [
    "There are no openings in this district.",
    "W tej dzielnicy nie ma ofert pracy.",
  ],
  "Yerel bir sakinle bağ kur; her görüşme 45 dakika sürer.": [
    "Build a relationship with a local resident; each meeting takes 45 minutes.",
    "Buduj relację z mieszkańcem; spotkanie trwa 45 minut.",
  ],
  "Mahalle sohbeti tamamlandı.": [
    "Community conversation completed.",
    "Rozmowa sąsiedzka zakończona.",
  ],
  "Yaşam sona erdi; eylem tamamlanmadı.": [
    "Life ended; the action was not completed.",
    "Życie dobiegło końca; czynność nie została ukończona.",
  ],
  "İşveren ödeme yapamadı; vardiya tamamlanmadı.": [
    "The employer could not pay; the shift was not completed.",
    "Pracodawca nie mógł zapłacić; zmiana nie została ukończona.",
  ],
  "Sakin ayrıldı; görüşme tamamlanmadı.": [
    "The resident left; the meeting was not completed.",
    "Mieszkaniec wyszedł; spotkanie nie zostało ukończone.",
  ],
  "Yolculuk tamamlandı.": ["Journey completed.", "Podróż zakończona."],
  "İş başvurusu tamamlandı.": ["Job application completed.", "Złożono podanie o pracę."],
  "Vardiya tamamlandı.": ["Shift completed.", "Zmiana zakończona."],
  "İş sözleşmesi sona erdi.": ["Employment contract ended.", "Umowa o pracę zakończona."],
};
export function localizeDistrictText(text, language) {
  if (typeof text !== "string" || !["en", "pl"].includes(language)) return text;
  const i = language === "en" ? 0 : 1;
  if (translations[text]) return translations[text][i];
  let m = /^(.+) · (mahalle kafesi|eğitim merkezi|iş merkezi|mahalle meydanı)$/.exec(text);
  if (m) {
    const kinds = {
      "mahalle kafesi": ["neighborhood café", "kawiarnia sąsiedzka"],
      "eğitim merkezi": ["learning centre", "centrum nauki"],
      "iş merkezi": ["work centre", "centrum pracy"],
      "mahalle meydanı": ["community square", "plac sąsiedzki"],
    };
    return `${m[1]} · ${kinds[m[2]][i]}`;
  }
  m = /^(.+) ile sohbet et$/.exec(text);
  if (m) return i ? `Porozmawiaj z ${m[1]}` : `Talk with ${m[1]}`;
  m = /^(.+) semtine git$/.exec(text);
  if (m) return i ? `Jedź do dzielnicy ${m[1]}` : `Travel to ${m[1]}`;
  m = /^(.+) ziyaret et$/.exec(text);
  if (m)
    return i
      ? `Odwiedź: ${localizeDistrictText(m[1], language)}`
      : `Visit ${localizeDistrictText(m[1], language)}`;
  m = /^Ücret: (\d+) TL · Her beş vardiyada ilerleme\.$/.exec(text);
  if (m)
    return i
      ? `Płaca: ${m[1]} TL · Awans co pięć zmian.`
      : `Pay: ${m[1]} TL · Progress after every five shifts.`;
  return text;
}
