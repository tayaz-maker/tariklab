import { DISTRICTS, HOMES, JOBS, COURSES, NPCS } from "./content.mjs";
import { DISTRICT_RULES } from "./deep-content.mjs";

const names = Object.fromEntries(DISTRICTS.map((d) => [d.id, d.name]));
let expansionTravel;
export function attachExpansionTravel(provider) { expansionTravel = provider; }
export const VENUES = DISTRICTS.flatMap((d) => [
  {
    id: `${d.id}-cafe`,
    name: `${d.name} · mahalle kafesi`,
    district: d.id,
    kind: "meeting",
    open: 9 * 60,
    close: 22 * 60,
    fee: d.id === "besiktas" ? 90 : d.id === "sisli" ? 75 : 55,
  },
  {
    id: `${d.id}-academy`,
    name: `${d.name} · eğitim merkezi`,
    district: d.id,
    kind: "class",
    open: 8 * 60,
    close: 21 * 60,
    fee: 0,
  },
  {
    id: `${d.id}-work`,
    name: `${d.name} · iş merkezi`,
    district: d.id,
    kind: "work",
    open: 7 * 60,
    close: 23 * 60,
    fee: 0,
  },
  {
    id: `${d.id}-park`,
    name: `${d.name} · mahalle meydanı`,
    district: d.id,
    kind: "personal",
    open: 6 * 60,
    close: 23 * 60,
    fee: 0,
  },
]);
const tm = (n) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
export const venueById = (id) => VENUES.find((v) => v.id === id);
export function venueOpen(venue, start, end = start + 1) {
  return Boolean(
    venue &&
    Number.isInteger(start) &&
    Number.isInteger(end) &&
    end > start &&
    Math.floor(start / 1440) === Math.floor((end - 1) / 1440) &&
    start % 1440 >= venue.open &&
    (end - 1) % 1440 < venue.close,
  );
}
export function initCity(s) {
  s.city = {
    venue: "",
    lastRoute: null,
    visits: Object.fromEntries(DISTRICTS.map((d) => [d.id, d.id === s.location ? 1 : 0])),
  };
}
export function getRoute(s, from, to, mode = "transit", at = s.time) {
  if (!names[from] || !names[to] || !["transit", "walk"].includes(mode) || !Number.isInteger(at))
    return null;
  const minute = at % 1440,
    across = (from === "kadikoy") !== (to === "kadikoy");
  const pair = [from, to].sort().join("/");
  const base = pair === "kadikoy/sisli" ? 70 : across ? 50 : 30;
  const rush = (minute >= 480 && minute < 600) || (minute >= 1020 && minute < 1140);
  const rain = s.world.weather === "Yağmurlu";
  const minutes =
    from === to
      ? 0
      : mode === "walk"
        ? across
          ? 150
          : 90
        : base +
          (rush ? 15 : 0) +
          (rain ? 10 : 0) +
          Math.max(
            s.life?.districts[from]?.travelDelay || 0,
            s.life?.districts[to]?.travelDelay || 0,
          );
  const cost =
    from === to || mode === "walk" ? 0 : pair === "kadikoy/sisli" ? 55 : across ? 45 : 35;
  const closing = mode === "walk" ? 23 * 60 : 24 * 60;
  const reason =
    from === to
      ? ""
      : minute < 360 || minute + minutes > closing
        ? "Güzergâh bu saatte tamamlanamaz. Seferler 06.00’da başlar."
        : mode === "walk" && s.player.energy < 20
          ? "Ücretsiz güzergâh için en az 20 enerji gerekir."
          : s.cash < cost
            ? `${cost} TL nakit gerekir.`
            : "";
  const conflicts = (s.calendar?.entries || [])
    .filter((e) => e.status === "confirmed" && e.start < at + minutes && e.end > at)
    .map(
      (e) =>
        `Gün ${Math.floor(e.start / 1440) + 1} ${tm(e.start % 1440)} taahhüdü yolculukla çakışabilir.`,
    );
  return {
    id: `${from}-${to}-${mode}`,
    from,
    to,
    mode,
    label:
      from === to
        ? "Aynı semt"
        : mode === "walk"
          ? across
            ? "Dayanışma servisi · kara yolu"
            : "Yürüyüş"
          : pair === "kadikoy/sisli"
            ? "Vapur + aktarma"
            : across
              ? "Vapur + yürüyüş"
              : "Otobüs",
    minutes,
    cost,
    available: !reason,
    reason,
    actionId: `${mode === "walk" ? "walk" : "travel"}:${to}`,
    conflicts,
    districtDelay:
      from === to || mode === "walk"
        ? 0
        : Math.max(
            s.life?.districts[from]?.travelDelay || 0,
            s.life?.districts[to]?.travelDelay || 0,
          ),
  };
}
export function travelMinutes(s, from, to, at = s.time) {
  if (s.expansion && expansionTravel)
    return expansionTravel(s, from, to, { at, actor: "npc" })?.minutes ?? 1000000;
  return getRoute(s, from, to, "transit", at)?.minutes ?? 1000000;
}
export function cityActions(s, api) {
  const actions = [];
  const create = (id, route, venue = null) => {
    const minutes = route.minutes + (venue && s.city.venue !== venue.id ? 10 : 0);
    const why =
      route.reason ||
      (venue && !venueOpen(venue, s.time + minutes)
        ? `Varışta kapalı: ${tm(venue.open)}–${tm(venue.close)}.`
        : "");
    actions.push({
      id,
      label: venue ? `${venue.name} · git` : `${names[route.to]} · ${route.label}`,
      description: `${minutes} dk · ${route.cost} TL. ${venue ? `Açık ${tm(venue.open)}–${tm(venue.close)}. ` : ""}${route.conflicts.join(" ")} Oyun içi yaklaşık ulaşım değerleri.`,
      category: "travel",
      minutes,
      cost: route.cost,
      disabled: Boolean(why),
      reason: why,
      destination: route.to,
      venue: venue?.id || "",
      route,
      run(next) {
        // Arrival is applied by the authoritative resolver after time advances.
        next.city.lastRoute = {
          from: next.location,
          to: route.to,
          mode: route.mode,
          minutes,
          cost: route.cost,
          at: next.time,
        };
        next.city.visits[route.to]++;
        if (next.location !== route.to) next.flags.travels++;
        if (route.mode === "walk")
          api.change(next, {
            energy: route.to === next.location ? 0 : route.minutes >= 150 ? -10 : -12,
            health: route.minutes === 90 ? 2 : 0,
          });
        return `${venue ? venue.name : names[route.to]}: yolculuk tamamlandı; ${minutes} dk ve ${route.cost} TL.`;
      },
    });
  };
  for (const d of DISTRICTS)
    if (d.id !== s.location)
      for (const mode of ["transit", "walk"]) {
        const route = getRoute(s, s.location, d.id, mode);
        create(route.actionId, route);
      }
  for (const venue of VENUES)
    if (s.city.venue !== venue.id)
      create(`visit:${venue.id}`, getRoute(s, s.location, venue.district), venue);
  return actions;
}
export function getCityView(s) {
  const minute = s.time % 1440;
  return {
    districts: DISTRICTS.map((d) => {
      const rules = DISTRICT_RULES.find((x) => x.id === d.id);
      const homes = HOMES.filter((h) => h.district === d.id),
        jobs = JOBS.filter((j) => j.district === d.id);
      return {
        id: d.id,
        name: d.name,
        summary: d.description,
        landmark: d.landmark,
        features: [
          `${jobs.length} kariyer yolu`,
          `${COURSES.filter((c) => c.district === d.id).length} eğitim seçeneği`,
          `Konut ${Math.min(...homes.map((h) => h.rent)).toLocaleString("tr-TR")} TL’den`,
          `Lokanta çarpanı ×${rules.food}`,
          `Yerel talep ${Math.round(s.living?.markets?.[d.id]?.demand ?? 100)}%`,
        ],
        society: s.society
          ? {
              ...s.society.districts[d.id].weeklyDelta,
              foodStock: s.society.districts[d.id].foodStock,
              materialStock: s.society.districts[d.id].materialStock,
            }
          : null,
        jobs: jobs.map((j) => j.id),
        homes: homes.map((h) => h.id),
        visits: s.city?.visits[d.id] || 0,
        npcIds: NPCS.filter((n) => s.npcs[n.id].location === d.id).map((n) => n.id),
        destinations: (s.calendar?.entries || [])
          .filter((e) => e.status === "confirmed" && e.district === d.id && e.end >= s.time)
          .map((e) => e.id),
      };
    }),
    routes: DISTRICTS.filter((d) => d.id !== s.location).flatMap((d) =>
      ["transit", "walk"].map((mode) => getRoute(s, s.location, d.id, mode)),
    ),
    venues: VENUES.map((v) => ({
      ...v,
      opensAt: v.open,
      closesAt: v.close,
      hours: `${tm(v.open)}–${tm(v.close)}`,
      open: minute >= v.open && minute < v.close,
      actionId: `visit:${v.id}`,
      current: s.city?.venue === v.id,
    })),
    currentVenue: venueById(s.city?.venue) || null,
    note: "Süre ve ücretler oyun simülasyonuna aittir; canlı ulaşım tarifesi değildir.",
  };
}
export function validateCity(s) {
  const c = s.city,
    int = (v, min = 0, max = 1e9) => Number.isInteger(v) && v >= min && v <= max;
  if (
    !c ||
    Object.keys(c).length !== 3 ||
    typeof c.venue !== "string" ||
    (c.venue && venueById(c.venue)?.district !== s.location) ||
    !c.visits ||
    Object.keys(c.visits).length !== 3 ||
    !DISTRICTS.every((d) => int(c.visits[d.id]))
  )
    return false;
  const r = c.lastRoute;
  return (
    r === null ||
    (Object.keys(r).length === 6 &&
      names[r.from] &&
      names[r.to] &&
      ["transit", "walk"].includes(r.mode) &&
      int(r.minutes, 0, 300) &&
      int(r.cost, 0, 10000) &&
      int(r.at, 0, s.time))
  );
}
