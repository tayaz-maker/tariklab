import { getLifeWorkTerms } from "./life-systems.mjs";
import { NPCS, JOBS, COURSES, DISTRICTS } from "./content.mjs";
import { VENUES, venueById, venueOpen, travelMinutes } from "./city.mjs";
import { getNpcPlan } from "./world-life.mjs";

const DAY = 1440;
const dayOf = (t) => Math.floor(t / DAY) + 1;
const timeLabel = (t) =>
  `${String(Math.floor((t % DAY) / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
const active = (e) => e.status === "confirmed";
const overlaps = (a, b, c, d) => a < d && c < b;
const cap = (n) => Math.max(0, Math.min(100, n));
const statusLabels = {
  counter: "Karşı teklif",
  confirmed: "Onaylandı",
  completed: "Tamamlandı",
  missed: "Kaçırıldı",
  cancelled: "İptal edildi",
  rejected: "Reddedildi",
};
export const CALENDAR_KINDS = [
  { id: "meeting", label: "Sosyal buluşma" },
  { id: "interview", label: "İş görüşmesi" },
  { id: "class", label: "Ders" },
  { id: "shift", label: "Vardiya" },
  { id: "personal", label: "Kişisel plan" },
];
const personal = [
  { id: "rest", label: "Dinlenme planı", kind: "personal" },
  { id: "practice", label: "Odaklı kişisel çalışma", kind: "personal" },
  { id: "community", label: "Mahalle buluşması", kind: "personal" },
];
const kindIds = CALENDAR_KINDS.map((k) => k.id);
const find = (xs, id) => xs.find((x) => x.id === id);
const MAX_ACTIVE = 24;
function history(e, at, text) {
  e.history.push({ at, text });
  e.history = e.history.slice(-8);
  e.updatedAt = at;
}
function trim(c) {
  const disabled = new Set(c.recurrences.filter((r) => !r.enabled).map((r) => r.id));
  for (const e of c.entries) if (disabled.has(e.recurrenceId)) e.recurrenceId = "";
  c.recurrences = c.recurrences.filter((r) => r.enabled);
  if (c.entries.length <= 96) return;
  const live = c.entries.filter((e) => ["confirmed", "counter"].includes(e.status));
  const past = c.entries.filter((e) => !["confirmed", "counter"].includes(e.status));
  c.entries = [...past.slice(-(96 - live.length)), ...live].sort(
    (a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id),
  );
}
export function initCalendar(s) {
  s.calendar = {
    nextId: 1,
    entries: [],
    recurrences: [],
    lastTick: s.time,
    stats: { completed: 0, missed: 0, cancelled: 0, late: 0 },
  };
  for (const old of s.appointments) {
    const start = (old.day - 1) * DAY + old.minute;
    const status = old.status === "scheduled" ? "confirmed" : old.status;
    const e = {
      id: `cal-${s.calendar.nextId++}`,
      kind: "meeting",
      subjectId: "",
      npcId: old.npcId,
      venue: `${old.location}-cafe`,
      district: old.location,
      start,
      end: start + 60,
      status,
      createdAt: Math.min(s.time, start),
      updatedAt: s.time,
      lateBy: 0,
      outcome: "1.0/2.0 randevusunun özgün saati korundu.",
      recurrenceId: "",
      replacesId: "",
      legacy: true,
      history: [
        { at: s.time, text: `Eski randevu ${old.id}: gün ${old.day}, ${timeLabel(start)}.` },
      ],
    };
    s.calendar.entries.push(e);
    if (status === "completed") s.calendar.stats.completed++;
    if (status === "missed") s.calendar.stats.missed++;
    if (status === "cancelled") s.calendar.stats.cancelled++;
  }
}
export function npcCommitments(s, id, start, end) {
  return (s.calendar?.entries || []).filter(
    (e) => active(e) && e.npcId === id && overlaps(start, end, e.start, e.end),
  );
}
export function calendarNpcLocation(s, id) {
  const e = s.calendar?.entries.find(
    (e) => active(e) && e.npcId === id && s.time >= e.start - 15 && s.time < e.end,
  );
  return e?.district || null;
}
function entryTitle(e) {
  if (e.kind === "meeting") return `${find(NPCS, e.npcId)?.name || "Kişi"} ile buluşma`;
  if (e.kind === "interview") return `${find(JOBS, e.subjectId)?.name || "İş"} · görüşme`;
  if (e.kind === "shift") return `${find(JOBS, e.subjectId)?.name || "İş"} · vardiya`;
  if (e.kind === "class") return `${find(COURSES, e.subjectId)?.name || "Kurs"} · ders`;
  return find(personal, e.subjectId)?.label || "Kişisel plan";
}
function subjectAction(e) {
  return e.kind === "interview"
    ? `apply:${e.subjectId}`
    : e.kind === "shift"
      ? "work"
      : e.kind === "class"
        ? "study"
        : null;
}
function fixedDuration(s, draft) {
  return draft.kind === "interview"
    ? 30
    : draft.kind === "shift"
      ? (find(JOBS, draft.subjectId)?.hours || 0) * 60 +
        (s.version >= 4 && s.job?.id === draft.subjectId ? getLifeWorkTerms(s).extraMinutes : 0)
      : draft.kind === "class"
        ? find(COURSES, draft.subjectId)?.minutes || 0
        : draft.duration;
}
function validDraft(s, p) {
  if (
    !p ||
    typeof p !== "object" ||
    Array.isArray(p) ||
    Object.keys(p).some(
      (k) =>
        !["kind", "npcId", "subjectId", "day", "minute", "venue", "duration", "repeat"].includes(k),
    )
  )
    return "Geçersiz plan alanları.";
  if (
    !kindIds.includes(p.kind) ||
    !Number.isInteger(p.day) ||
    p.day < dayOf(s.time) ||
    p.day > dayOf(s.time) + 14 ||
    !Number.isInteger(p.minute) ||
    p.minute < 0 ||
    p.minute >= DAY ||
    p.minute % 15 !== 0 ||
    !Number.isInteger(p.duration) ||
    ![30, 60, 90, 120, 180, 240, 360, 420, 480, 540].includes(p.duration) ||
    !["none", "weekly"].includes(p.repeat) ||
    typeof p.npcId !== "string" ||
    typeof p.subjectId !== "string" ||
    !venueById(p.venue)
  )
    return "Tarih, saat, süre veya mekân geçersiz. En fazla 14 gün sonrası planlanabilir.";
  const v = venueById(p.venue),
    start = (p.day - 1) * DAY + p.minute,
    duration = fixedDuration(s, p);
  if (start < s.time + 5)
    return "Geçmişe veya görüşme sürerken başlayacak bir plana kayıt yapılamaz.";
  if (
    p.kind === "meeting" &&
    (!find(NPCS, p.npcId) || p.subjectId !== "" || v.kind !== "meeting" || p.repeat !== "none")
  )
    return "Buluşma için kişi ve kafe seç; tekrar eden sosyal sözler ayrı onay gerektirir.";
  if (p.kind !== "meeting" && p.npcId !== "") return "Bu plan türü kişi alanını kullanmaz.";
  if (["interview", "shift"].includes(p.kind)) {
    const job = find(JOBS, p.subjectId);
    if (!job || v.kind !== "work" || v.district !== job.district)
      return "İş planı doğru iş merkezinde olmalı.";
    if (
      p.kind === "interview" &&
      (p.minute < 480 || p.minute + duration > 1020 || p.repeat !== "none")
    )
      return "İş görüşmesi 08.00–17.00 içinde tamamlanmalı.";
    if (p.kind === "shift") {
      if (s.job?.id !== job.id) return "Vardiya planlamak için bu işte çalışmalısın.";
      const weekday = (p.day - 1) % 7;
      if (job.restDay === weekday || (!job.weekends && weekday >= 5))
        return "Bu gün haftalık izin günün.";
      if (p.minute < job.start * 60 || p.minute >= job.end * 60)
        return `Başlangıç aralığı ${job.start}.00–${job.end}.00.`;
    }
  }
  if (
    p.kind === "class" &&
    (s.course?.id !== p.subjectId ||
      find(COURSES, p.subjectId)?.district !== v.district ||
      v.kind !== "class")
  )
    return "Ders için kayıtlı olduğun kursun eğitim merkezini seç.";
  if (
    p.kind === "personal" &&
    (!find(personal, p.subjectId) || v.kind !== "personal" || p.duration > 120)
  )
    return "Kişisel plan için meydan ve 30–120 dakika seç.";
  if (p.kind === "meeting" && p.duration > 120) return "Buluşma en fazla iki saat olabilir.";
  if (!venueOpen(v, start, start + duration))
    return "Planın tamamı mekânın açık olduğu saatlere sığmalı.";
  return "";
}
function travelGap(s, a, b, at = s.time) {
  // Congestion is determined when the previous commitment ends, not when a
  // future booking is entered. Ten minutes also reserves the local venue leg.
  // Future weather remains the currently known weather estimate.
  return a === b ? 10 : travelMinutes(s, a, b, at) + 10;
}
function playerConflict(s, start, end, district, ignore = "") {
  for (const e of s.calendar.entries.filter((e) => active(e) && e.id !== ignore)) {
    if (overlaps(start, end, e.start, e.end)) return `${entryTitle(e)} ile saat çakışması var.`;
    if (e.end <= start && start - e.end < travelGap(s, e.district, district, e.end))
      return `${entryTitle(e)} sonrasında ulaşım için yeterli süre yok.`;
    if (end <= e.start && e.start - end < travelGap(s, district, e.district, end))
      return `${entryTitle(e)} öncesinde ulaşım için yeterli süre yok.`;
  }
  if (start - s.time < travelGap(s, s.location, district, s.time))
    return "Bu saate yetişmek için yolculuk ve yerel ulaşım süresi yetersiz.";
  return "";
}
function npcConflict(s, id, start, end, district, ignore = "") {
  const plans = getNpcPlan(s, id, start - DAY, end + DAY) || [];
  const reservations = s.calendar.entries
    .filter((e) => active(e) && e.npcId === id && e.id !== ignore)
    .map((e) => ({ start: e.start, end: e.end, location: e.district, kind: "commitment" }));
  for (const p of [...plans, ...reservations]) {
    if (overlaps(start, end, p.start, p.end)) return "Bu saatte başka bir yükümlülüğü var.";
    if (p.end <= start && start - p.end < travelGap(s, p.location, district, p.end))
      return "Önceki planından buraya yetişemiyor.";
    if (end <= p.start && p.start - end < travelGap(s, district, p.location, end))
      return "Sonraki yükümlülüğüne yetişemiyor.";
  }
  return "";
}
function assess(s, p, ignore = "") {
  const bad = validDraft(s, p);
  if (bad) return { reason: bad };
  const start = (p.day - 1) * DAY + p.minute,
    end = start + fixedDuration(s, p),
    v = venueById(p.venue);
  if (
    s.calendar.entries.some(
      (e) =>
        e.id !== ignore &&
        ["confirmed", "completed"].includes(e.status) &&
        dayOf(e.start) === p.day &&
        e.kind === p.kind &&
        e.subjectId === p.subjectId &&
        e.npcId === p.npcId,
    )
  )
    return { reason: "Bu kişi veya etkinlik için aynı gün zaten bir plan var." };
  const reason = playerConflict(s, start, end, v.district, ignore);
  if (reason) return { reason };
  if (p.kind === "meeting") {
    const n = s.npcs[p.npcId];
    if (n.affinity < 20 || n.trust < 15)
      return {
        reason: "",
        rejected:
          "Henüz yeterli yakınlık ve güven yok; önce kısa bir sohbet veya telefon görüşmesi yap.",
        start,
        end,
      };
    const busy = npcConflict(s, p.npcId, start, end, v.district, ignore);
    if (busy) return { reason: "", busy, start, end };
  }
  return { reason: "", start, end };
}
function counterOffer(s, p, ignore = "") {
  for (let offset = 0; offset < 7; offset++)
    for (let minute = 540; minute <= 1200; minute += 30) {
      const draft = { ...p, day: p.day + offset, minute };
      if (draft.day > dayOf(s.time) + 14) continue;
      const result = assess(s, draft, ignore);
      if (!result.reason && !result.busy && !result.rejected)
        return { ...draft, start: result.start, end: result.end };
    }
  return null;
}
function entryFrom(s, p, result) {
  const v = venueById(p.venue),
    id = `cal-${s.calendar.nextId++}`;
  return {
    id,
    kind: p.kind,
    subjectId: p.subjectId,
    npcId: p.npcId,
    venue: v.id,
    district: v.district,
    start: result.start,
    end: result.end,
    status: "confirmed",
    createdAt: s.time,
    updatedAt: s.time,
    lateBy: 0,
    outcome: "",
    recurrenceId: "",
    replacesId: "",
    legacy: false,
    history: [],
  };
}
function noFunds(s, a) {
  return (a.pay === "total" ? s.cash + s.bank : a.pay === "bank" ? s.bank : s.cash) < a.cost;
}
export function calendarCommand(s, id, p, api) {
  if (id !== "calendar:propose" && !id.startsWith("calendar:reschedule:")) return null;
  const prior = id.startsWith("calendar:reschedule:")
    ? s.calendar.entries.find((e) => e.id === id.slice("calendar:reschedule:".length))
    : null;
  let reason = validDraft(s, p);
  if (
    !reason &&
    id !== "calendar:propose" &&
    (!prior || prior.status !== "confirmed" || prior.start <= s.time)
  )
    reason = "Geçmiş veya kapanmış plan yeniden düzenlenemez.";
  if (
    !reason &&
    prior &&
    (prior.kind !== p.kind || prior.npcId !== p.npcId || prior.subjectId !== p.subjectId)
  )
    reason = "Yeniden planlamada kişi ve plan türü değiştirilemez; yeni plan oluştur.";
  if (
    !reason &&
    !prior &&
    s.calendar.entries.filter((e) => ["confirmed", "counter"].includes(e.status)).length >=
      MAX_ACTIVE
  )
    reason = "Önce bekleyen planlardan birini tamamla veya iptal et (en çok 24).";
  if (
    !reason &&
    p.repeat === "weekly" &&
    s.calendar.recurrences.filter((r) => r.enabled).length >= 8
  )
    reason = "En çok sekiz haftalık tekrar olabilir.";
  const result = reason ? { reason } : assess(s, p, prior?.id);
  reason = result.reason;
  if (!reason && p.kind === "interview") {
    const a = api.getBaseAction(
      { ...s, time: result.start, location: venueById(p.venue).district },
      `apply:${p.subjectId}`,
    );
    if (!a || a.disabled) reason = a?.reason || "Bu iş görüşmesi için koşullar sağlanmıyor.";
  }
  if (
    !reason &&
    prior &&
    result.busy &&
    s.calendar.entries.filter((e) => ["confirmed", "counter"].includes(e.status)).length >=
      MAX_ACTIVE
  )
    reason = "Önce bekleyen karşı tekliflerden birini yanıtla (en çok 24 plan).";
  if (!reason && p.kind === "meeting" && (s.time % DAY < 540 || s.time % DAY >= 1260))
    reason = "Teklif için 09.00–21.00 arasında telefon et.";
  const counter = !reason && result.busy ? counterOffer(s, p, prior?.id) : null;
  return {
    id,
    label: prior ? "Planı yeniden düzenle" : "Plan teklifini gönder",
    description:
      reason ||
      result.rejected ||
      result.busy ||
      (p.repeat === "weekly"
        ? "Aynı gün/saat her hafta tekrar eder; her yeni oluşumda çakışma yeniden denetlenir."
        : "5 dk planlama; katılım bedeli yalnız gerçek katılımda ödenir."),
    category: "calendar",
    minutes: 5,
    cost: 0,
    disabled: Boolean(reason),
    reason,
    run(next) {
      if (prior && !result.rejected && !result.busy) {
        const old = next.calendar.entries.find((e) => e.id === prior.id);
        old.status = "cancelled";
        old.outcome = "Yeni tarih önerildi.";
        history(old, next.time, old.outcome);
        if (old.recurrenceId) {
          const r = next.calendar.recurrences.find((r) => r.id === old.recurrenceId);
          if (r) r.enabled = false;
        }
        if (old.npcId && old.start - next.time < 120)
          next.npcs[old.npcId].trust = cap(next.npcs[old.npcId].trust - 2);
      }
      const use = counter || p,
        timing = counter || result,
        e = entryFrom(next, use, timing);
      e.replacesId = prior?.status === "confirmed" ? prior.id : prior?.replacesId || "";
      if (result.rejected) {
        e.status = "rejected";
        e.outcome = result.rejected;
      } else if (result.busy) {
        e.status = counter ? "counter" : "rejected";
        e.outcome = counter
          ? `Önerilen saat uygun değil. Karşı teklif: gün ${use.day}, ${timeLabel(e.start)}.`
          : "Önümüzdeki günlerde ortak bir boşluk bulunamadı.";
      } else e.outcome = prior ? "Yeni tarih onaylandı." : "Plan onaylandı.";
      if (prior && e.status !== "confirmed")
        e.outcome += " Önceki onaylı tarih, yeni teklif kabul edilene kadar korunur.";
      history(e, next.time, e.outcome);
      next.calendar.entries.push(e);
      if (e.status === "confirmed" && p.repeat === "weekly") {
        const id = `repeat-${next.calendar.nextId++}`;
        e.recurrenceId = id;
        next.calendar.recurrences.push({
          id,
          kind: e.kind,
          subjectId: e.subjectId,
          venue: e.venue,
          duration: e.end - e.start,
          nextStart: e.start + 7 * DAY,
          enabled: true,
          skipped: 0,
        });
      }
      if (e.npcId) api.memory(next, e.npcId, `${entryTitle(e)}: ${e.outcome}`);
      trim(next.calendar);
      return e.outcome;
    },
  };
}
function dueActions(s, api) {
  const out = [];
  for (const e of s.calendar.entries) {
    if (e.status === "confirmed")
      out.push({
        id: `calendar:reschedule:${e.id}`,
        label: `${entryTitle(e)} · yeniden planla`,
        description: "Tarih, saat ve mekân formunu aç; yeni teklif uygunluk denetiminden geçer.",
        category: "calendar",
        minutes: 5,
        cost: 0,
        requiresPayload: true,
        disabled: e.start <= s.time,
        reason: e.start <= s.time ? "Başlamış plan değiştirilemez." : "",
        run: () => "",
      });
    if (e.status === "counter") {
      const p = {
          kind: e.kind,
          npcId: e.npcId,
          subjectId: e.subjectId,
          day: dayOf(e.start),
          minute: e.start % DAY,
          venue: e.venue,
          duration: e.end - e.start,
          repeat: "none",
        },
        check = assess(s, p, e.replacesId || e.id);
      const old = e.replacesId ? s.calendar.entries.find((x) => x.id === e.replacesId) : null;
      const why =
        e.replacesId && (!old || old.status !== "confirmed" || old.start <= s.time)
          ? "Önceki taahhüt artık değiştirilemez; yeni bir plan oluştur."
          : check.reason || check.busy || check.rejected || "";
      out.push({
        id: `calendar:accept:${e.id}`,
        label: `${entryTitle(e)} · karşı teklifi kabul et`,
        description: `Gün ${dayOf(e.start)} ${timeLabel(e.start)}. Uygunluk yeniden kontrol edilir.`,
        category: "calendar",
        minutes: 5,
        cost: 0,
        disabled: Boolean(why),
        reason: why,
        run(n) {
          if (e.replacesId) {
            const previous = n.calendar.entries.find((x) => x.id === e.replacesId);
            previous.status = "cancelled";
            previous.outcome = "Karşı teklif onaylandığı için yeni tarihe taşındı.";
            history(previous, n.time, previous.outcome);
            if (previous.recurrenceId) {
              const r = n.calendar.recurrences.find((r) => r.id === previous.recurrenceId);
              if (r) r.enabled = false;
            }
            if (previous.npcId && previous.start - n.time < 120)
              n.npcs[previous.npcId].trust = cap(n.npcs[previous.npcId].trust - 2);
          }
          const x = n.calendar.entries.find((x) => x.id === e.id);
          x.status = "confirmed";
          x.outcome = "Karşı teklif kabul edildi.";
          history(x, n.time, x.outcome);
          api.memory(n, e.npcId, x.outcome);
          return x.outcome;
        },
      });
      out.push({
        id: `calendar:decline:${e.id}`,
        label: `${entryTitle(e)} · teklifi reddet`,
        description: "2 dk; onaylanmamış teklif güven kaybettirmez.",
        category: "calendar",
        minutes: 2,
        cost: 0,
        disabled: false,
        reason: "",
        run(n) {
          const x = n.calendar.entries.find((x) => x.id === e.id);
          x.status = "rejected";
          x.outcome = "Karşı teklifi kabul etmedin.";
          history(x, n.time, x.outcome);
          return x.outcome;
        },
      });
    }
    if (!active(e)) continue;
    const grace = e.kind === "meeting" || e.kind === "personal" ? 30 : 0;
    const early = e.start - s.time;
    const effective = subjectAction(e);
    const sameSubject =
      (e.kind !== "shift" || s.job?.id === e.subjectId) &&
      (e.kind !== "class" || s.course?.id === e.subjectId);
    const underlying = effective ? api.getBaseAction(s, effective) : null;
    const baseCost = underlying?.cost || 0,
      cost = e.kind === "meeting" ? (e.legacy ? 0 : venueById(e.venue).fee) : baseCost;
    let why =
      s.location !== e.district || s.city.venue !== e.venue
        ? "Önce takvimdeki mekâna git."
        : early > 30
          ? "En erken 30 dakika önce katılabilirsin."
          : s.time >= e.end
            ? "Ayrılan katılım süresi sona erdi."
            : s.time > e.start + grace
              ? "Katılım aralığı geçti."
              : effective && (!underlying || underlying.disabled)
                ? underlying?.reason || "İş/kurs sözleşmesi artık geçerli değil."
                : effective && !sameSubject
                  ? "Planın bağlı olduğu iş/kurs değişti."
                  : "";
    // Early attendance waits until the reserved start; actual work/class prerequisites
    // are evaluated at that start rather than giving early labor or wages.
    const atStart =
      effective && s.time < e.start
        ? api.getBaseAction({ ...s, time: e.start }, effective)
        : underlying;
    if (
      effective &&
      sameSubject &&
      s.time < e.start &&
      atStart &&
      !atStart.disabled &&
      s.location === e.district &&
      s.city.venue === e.venue &&
      early <= 30
    )
      why = "";
    const proxy = atStart || underlying;
    if (e.kind === "shift" && proxy && e.end - e.start !== proxy.minutes)
      why = "Çalışma süresi değişti; takvim vardiyasını yeni sözleşme süresiyle yeniden planla.";
    const minutes = Math.max(1, e.end - s.time);
    const action = {
      id: `calendar:attend:${e.id}`,
      label: `${entryTitle(e)} · katıl`,
      description: `${timeLabel(e.start)}–${timeLabel(e.end)} · ${cost} TL. ${grace ? "En fazla 30 dk gecikme: daha düşük güven getirisi." : "Bu taahhütte geç katılım kabul edilmez."}`,
      category: "calendar",
      minutes,
      cost,
      pay: proxy?.pay || "cash",
      disabled: false,
      reason: "",
      effectId: effective || `calendar:meeting:${e.npcId}`,
      calendarEntry: e.id,
      run(n) {
        const x = n.calendar.entries.find((x) => x.id === e.id);
        x.lateBy = Math.max(0, n.time - e.start);
        let message = "";
        if (proxy) message = proxy.run(n) || proxy.label;
        else if (e.npcId) {
          const r = n.npcs[e.npcId];
          r.trust = cap(r.trust + (x.lateBy ? 2 : 10));
          r.affinity = cap(r.affinity + (x.lateBy ? 4 : 12));
          r.lastTalkDay = dayOf(n.time);
          api.change(n, { stress: -10 });
          api.memory(
            n,
            e.npcId,
            x.lateBy
              ? `${x.lateBy} dakika geç geldin; görüşmeyi kısa tuttuk.`
              : "Kararlaştırdığımız yerde sözünü tuttun.",
          );
          message = x.lateBy
            ? `${x.lateBy} dakika gecikmeyle görüştünüz.`
            : "Buluşma zamanında tamamlandı.";
        } else {
          if (e.subjectId === "rest") api.change(n, { energy: 18, stress: -8 });
          if (e.subjectId === "practice") api.skill(n, "knowledge", 2);
          if (e.subjectId === "community") {
            api.skill(n, "communication", 1);
            api.change(n, { stress: -6 });
          }
          message = "Kişisel planını tamamladın.";
        }
        x.outcome = message;
        return message;
      },
    };
    if (!why && noFunds(s, action)) why = `Katılım için ${cost} TL gerekir.`;
    action.reason = why;
    action.disabled = Boolean(why);
    out.push(action);
    out.push({
      id: `calendar:cancel:${e.id}`,
      label: `${entryTitle(e)} · iptal et`,
      description:
        "5 dk; son iki saatte sosyal iptal güven −5, daha erken −1. Haftalık tekrar da durur.",
      category: "calendar",
      minutes: 5,
      cost: 0,
      disabled: e.start <= s.time,
      reason: e.start <= s.time ? "Başlamış taahhüt geriye dönük iptal edilemez." : "",
      run(n) {
        const x = n.calendar.entries.find((x) => x.id === e.id);
        x.status = "cancelled";
        x.outcome = "Önceden haber vererek iptal ettin.";
        history(x, n.time, x.outcome);
        n.calendar.stats.cancelled++;
        if (x.npcId) {
          n.npcs[x.npcId].trust = cap(n.npcs[x.npcId].trust - (x.start - n.time < 120 ? 5 : 1));
          api.memory(n, x.npcId, x.outcome);
        }
        if (x.recurrenceId) {
          const r = n.calendar.recurrences.find((r) => r.id === x.recurrenceId);
          if (r) r.enabled = false;
        }
        return x.outcome;
      },
    });
  }
  for (const r of s.calendar.recurrences.filter((r) => r.enabled))
    out.push({
      id: `calendar:repeat-stop:${r.id}`,
      label: "Haftalık tekrarı durdur",
      description: "1 dk; mevcut onaylı randevular ayrıca iptal edilir.",
      category: "calendar",
      minutes: 1,
      cost: 0,
      disabled: false,
      reason: "",
      run(n) {
        n.calendar.recurrences.find((x) => x.id === r.id).enabled = false;
        return "Yeni haftalık oluşumlar durduruldu; mevcut sözler takvimde kaldı.";
      },
    });
  return out;
}
export function calendarActions(s, api) {
  return dueActions(s, api);
}
export function completeCalendarAttendance(s, id) {
  const e = s.calendar.entries.find((e) => e.id === id);
  if (!e || e.status !== "confirmed" || s.time < e.end)
    throw new Error("Calendar attendance finalization mismatch");
  e.status = "completed";
  s.calendar.stats.completed++;
  if (e.lateBy) s.calendar.stats.late++;
  history(e, s.time, e.outcome);
}
export function nextCalendarAt(s) {
  const candidates = s.calendar.entries
    .flatMap((e) =>
      e.status === "confirmed"
        ? [
            e.start,
            e.start + (e.legacy ? 61 : e.kind === "meeting" || e.kind === "personal" ? 31 : 1),
            e.end,
          ]
        : e.status === "counter"
          ? [e.start]
          : [],
    )
    .filter((t) => t > s.time);
  for (const r of s.calendar.recurrences)
    if (r.enabled) candidates.push(Math.max(s.time + 1, r.nextStart - DAY * 7));
  return candidates.length ? Math.min(...candidates) : Infinity;
}
export function tickCalendar(s, api) {
  if (s.calendar.lastTick > s.time) throw new Error("Calendar time reversed");
  for (const e of s.calendar.entries
    .slice()
    .sort((a, b) => a.start - b.start || a.id.localeCompare(b.id))) {
    if (e.status === "counter" && s.time >= e.start) {
      e.status = "rejected";
      e.outcome = "Karşı teklif onaylanmadan süresi geçti.";
      history(e, s.time, e.outcome);
    }
    const grace = e.legacy ? 60 : e.kind === "meeting" || e.kind === "personal" ? 30 : 0;
    if (
      active(e) &&
      e.id !== s._attendance &&
      (s.time > e.start + grace || (!e.legacy && s.time >= e.end))
    ) {
      e.status = "missed";
      e.outcome = "Taahhüt zamanında yerine getirilmedi.";
      history(e, s.time, e.outcome);
      s.calendar.stats.missed++;
      if (e.npcId) {
        s.npcs[e.npcId].trust = cap(s.npcs[e.npcId].trust - 12);
        s.npcs[e.npcId].affinity = cap(s.npcs[e.npcId].affinity - 6);
        api.memory(s, e.npcId, "Kararlaştırdığımız buluşmaya gelmedin.");
      }
      if (e.kind === "interview") api.change(s, { stress: 4 });
      if (e.kind === "class") api.change(s, { stress: 2 });
      api.log(s, `${entryTitle(e)} kaçırıldı; takvime kaydedildi.`);
    }
  }
  for (const r of s.calendar.recurrences.filter((r) => r.enabled)) {
    // One next week occurrence is materialized; cursor advances before any effects.
    if (r.nextStart > s.time + DAY * 7) continue;
    const start = r.nextStart;
    r.nextStart += DAY * 7;
    const p = {
      kind: r.kind,
      npcId: "",
      subjectId: r.subjectId,
      day: dayOf(start),
      minute: start % DAY,
      venue: r.venue,
      duration: r.duration,
      repeat: "none",
    };
    const result = assess(s, p);
    if (result.reason || s.calendar.entries.filter(active).length >= MAX_ACTIVE) {
      r.skipped++;
      r.enabled = false;
      api.log(s, `Haftalık tekrar durdu: ${result.reason || "Takvim kapasitesi doldu."}`);
      continue;
    }
    const e = entryFrom(s, p, result);
    e.recurrenceId = r.id;
    e.outcome = "Haftalık plan oluştu.";
    history(e, s.time, e.outcome);
    s.calendar.entries.push(e);
  }
  s.calendar.lastTick = s.time;
  trim(s.calendar);
}
export function actionCalendarConflict(s, a) {
  if (
    a.id.startsWith("calendar:") ||
    a.id.startsWith("event:") ||
    a.id.startsWith("wait:") ||
    a.minutes <= 5
  )
    return "";
  const end = s.time + a.minutes;
  for (const e of s.calendar.entries.filter(active)) {
    if (a.category === "travel") {
      if (a.destination === e.district && end <= e.start + 30) continue;
      if (s.time < e.end && end > e.start)
        return `${entryTitle(e)} için yolculukla saat çakışması var.`;
    } else if (overlaps(s.time, end, e.start, e.end))
      return `${entryTitle(e)} ile çakışır. Önce katıl, yeniden planla veya iptal et.`;
    else if (
      s.time < e.start &&
      end + travelGap(s, a.destination || s.location, e.district, end) > e.start
    )
      return `${entryTitle(e)} için ulaşım payı kalmıyor.`;
  }
  return "";
}
export function getAppointmentOptions(s, options = {}) {
  const { ignoreId, ...values } = options;
  const p = {
    kind: "meeting",
    npcId: NPCS[0].id,
    subjectId: "",
    day: dayOf(s.time) + 1,
    venue: `${s.location}-cafe`,
    duration: 60,
    repeat: "none",
    ...values,
  };
  const slots = [];
  for (let minute = 360; minute < 1380; minute += 30) {
    const result = assess(s, { ...p, minute }, ignoreId || "");
    slots.push({
      minute,
      label: timeLabel(minute),
      available: !result.reason,
      reason: result.reason || result.rejected || result.busy || "",
      counterExpected: Boolean(result.busy),
      rejectionExpected: Boolean(result.rejected),
    });
  }
  return { slots, venues: venueViews(s), kinds: CALENDAR_KINDS, subjects: subjects(s) };
}
function subjects(s) {
  return [
    ...JOBS.map((j) => ({
      id: j.id,
      label: j.name,
      kind: "interview",
      duration: 30,
      district: j.district,
    })),
    ...(s.job
      ? [
          {
            id: s.job.id,
            label: find(JOBS, s.job.id).name,
            kind: "shift",
            duration:
              find(JOBS, s.job.id).hours * 60 +
              (s.version >= 4 ? getLifeWorkTerms(s).extraMinutes : 0),
            district: find(JOBS, s.job.id).district,
          },
        ]
      : []),
    ...(s.course
      ? [
          {
            id: s.course.id,
            label: find(COURSES, s.course.id).name,
            kind: "class",
            duration: find(COURSES, s.course.id).minutes,
            district: find(COURSES, s.course.id).district,
          },
        ]
      : []),
    ...personal,
  ];
}
function venueViews(s) {
  return VENUES.map((v) => ({
    ...v,
    hours: `${timeLabel(v.open)}–${timeLabel(v.close)}`,
    open: venueOpen(v, s.time),
    opensAt: v.open,
    closesAt: v.close,
  }));
}
export function getCalendarView(s, { day = dayOf(s.time) } = {}) {
  if (!Number.isInteger(day)) day = dayOf(s.time);
  day = Math.max(dayOf(s.time), Math.min(dayOf(s.time) + 14, day));
  const date = (d) => new Date(Date.UTC(2026, 8, 7) + (d - 1) * 86400000);
  const days = Array.from({ length: 15 }, (_, i) => {
    const d = dayOf(s.time) + i;
    return {
      day: d,
      dateLabel: new Intl.DateTimeFormat("tr-TR", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }).format(date(d)),
      weekday: new Intl.DateTimeFormat("tr-TR", { weekday: "short", timeZone: "UTC" }).format(
        date(d),
      ),
    };
  });
  const entries = s.calendar.entries
    .map((e) => ({
      ...e,
      day: dayOf(e.start),
      title: entryTitle(e),
      startLabel: timeLabel(e.start),
      endLabel: timeLabel(e.end),
      statusLabel: statusLabels[e.status],
      venueName: venueById(e.venue).name,
      actionId: active(e) ? `calendar:attend:${e.id}` : null,
    }))
    .sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
  const next = entries.find((e) => active(e) && e.end > s.time);
  const reminders = entries
    .filter((e) => active(e) && e.start - s.time < DAY)
    .map((e) => `${e.title}: gün ${e.day}, ${e.startLabel} · ${e.venueName}`);
  if (s.job) {
    const j = find(JOBS, s.job.id);
    reminders.push(
      `İş: ${j.name}; vardiya başlangıç aralığı ${j.start}.00–${j.end}.00. Ajandadan kesin saat ayırabilirsin.`,
    );
  }
  return {
    day,
    days,
    entries,
    reminders,
    nextEvent: next
      ? {
          at: next.start,
          label: next.title,
          day: next.day,
          timeLabel: next.startLabel,
          actionId: next.actionId,
        }
      : null,
    venues: venueViews(s),
    kinds: CALENDAR_KINDS,
    subjects: subjects(s),
    recurrences: s.calendar.recurrences.map((r) => ({
      ...r,
      label: `${CALENDAR_KINDS.find((k) => k.id === r.kind)?.label} · her hafta ${timeLabel(r.nextStart)}`,
    })),
    stats: { ...s.calendar.stats },
  };
}
export function validateCalendar(s) {
  const c = s.calendar,
    int = (v, min = 0, max = 525600000) => Number.isInteger(v) && v >= min && v <= max,
    str = (v, n = 500) => typeof v === "string" && v.length <= n;
  if (
    !c ||
    Object.keys(c).length !== 5 ||
    !int(c.nextId, 1, 100000000) ||
    !int(c.lastTick, 0, s.time) ||
    !Array.isArray(c.entries) ||
    c.entries.length > 96 ||
    !Array.isArray(c.recurrences) ||
    c.recurrences.length > 32 ||
    !c.stats ||
    Object.keys(c.stats).length !== 4 ||
    !["completed", "missed", "cancelled", "late"].every((k) => int(c.stats[k], 0, 1e8))
  )
    return false;
  const ids = new Set();
  for (const e of c.entries) {
    if (
      !e ||
      Object.keys(e).length !== 17 ||
      !/^cal-\d+$/.test(e.id) ||
      Number(e.id.slice(4)) >= c.nextId ||
      ids.has(e.id) ||
      !kindIds.includes(e.kind) ||
      !Object.hasOwn(statusLabels, e.status) ||
      !int(e.start) ||
      !int(e.end, e.start + 1, e.start + 540) ||
      !int(e.createdAt, 0, s.time) ||
      !int(e.updatedAt, e.createdAt, s.time) ||
      !int(e.lateBy, 0, 30) ||
      !str(e.outcome, 1000) ||
      typeof e.legacy !== "boolean" ||
      !str(e.recurrenceId, 80) ||
      !(e.replacesId === "" || (/^cal-\d+$/.test(e.replacesId) && e.replacesId !== e.id)) ||
      !Array.isArray(e.history) ||
      e.history.length > 8 ||
      !e.history.every(
        (h) => h && Object.keys(h).length === 2 && int(h.at, 0, s.time) && str(h.text, 1000),
      )
    )
      return false;
    ids.add(e.id);
    const v = venueById(e.venue);
    if (!v || v.district !== e.district || !DISTRICTS.some((d) => d.id === e.district))
      return false;
    if (e.kind === "meeting" ? !find(NPCS, e.npcId) || e.subjectId !== "" : e.npcId !== "")
      return false;
    if (["interview", "shift"].includes(e.kind) && !find(JOBS, e.subjectId)) return false;
    if (e.kind === "class" && !find(COURSES, e.subjectId)) return false;
    if (e.kind === "personal" && !find(personal, e.subjectId)) return false;
    if (!e.legacy && !venueOpen(v, e.start, e.end)) return false;
    if (!e.legacy && e.status === "completed" && e.end > s.time) return false;
    if (e.status === "missed" && e.start > s.time) return false;
  }
  const pending = c.entries.filter(active);
  if (pending.length > 48) return false;
  for (let i = 0; i < pending.length; i++)
    for (let j = i + 1; j < pending.length; j++)
      if (
        !(pending[i].legacy && pending[j].legacy) &&
        overlaps(pending[i].start, pending[i].end, pending[j].start, pending[j].end)
      )
        return false;
  const repeats = new Set();
  for (const r of c.recurrences) {
    if (
      !r ||
      Object.keys(r).length !== 8 ||
      !/^repeat-\d+$/.test(r.id) ||
      Number(r.id.slice(7)) >= c.nextId ||
      repeats.has(r.id) ||
      !["personal", "class", "shift"].includes(r.kind) ||
      !venueById(r.venue) ||
      !int(r.duration, 30, 540) ||
      !int(r.nextStart) ||
      typeof r.enabled !== "boolean" ||
      !int(r.skipped, 0, 1e8) ||
      !(r.kind === "personal"
        ? find(personal, r.subjectId)
        : r.kind === "class"
          ? find(COURSES, r.subjectId)
          : find(JOBS, r.subjectId))
    )
      return false;
    repeats.add(r.id);
  }
  if (c.recurrences.filter((r) => r.enabled).length > 8) return false;
  return c.entries.every((e) => !e.recurrenceId || repeats.has(e.recurrenceId));
}
