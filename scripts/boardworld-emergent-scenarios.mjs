/** Independent 4.0 player choices; no state writes, invented funds, or clock skips. */
import {
  getActions,
  getEmergentView,
  getLifeView,
} from "../public/games/tc-sim-boardworld/engine.mjs";
import { selectLifeAction } from "./boardworld-scenarios.mjs";

const dayOf = (s) => Math.floor(s.time / 1440) + 1;
export function selectEmergentLifeAction(s, style, memory = {}) {
  const ordinary = selectLifeAction(s, style, memory);
  if (
    s.pendingEvents.length ||
    /^(calendar:|withdraw:|cook$|eat$|soup$|snack$|buy:groceries|story:)/.test(ordinary?.id || "")
  )
    return ordinary;
  const actions = getActions(s).filter((a) => !a.disabled);
  const pick = (id) => actions.find((a) => a.id === id);
  const day = dayOf(s),
    minute = s.time % 1440;
  const appointment = s.calendar.entries
    .filter((e) => e.status === "confirmed" && e.end > s.time)
    .sort((a, b) => a.start - b.start)[0];
  const fits = (a) => a && (!appointment || s.time + a.minutes + 100 < appointment.start);
  // Earned shifts, qualifications and expiring deliveries retain priority. Choosing
  // a new promise does not make an existing time obligation disappear.
  if (
    /^(work$|promote$|apply:|enroll:|study$|business:serve$|freelance:deliver$)/.test(
      ordinary?.id || "",
    )
  )
    return ordinary;
  const renew = pick("lease:renew");
  if (fits(renew)) return renew;
  if (s.life.household && fits(pick("household:chore"))) return pick("household:chore");
  const commitments = {
    career: ["employment", "housing", "education", "household", "debt", "health"],
    social: ["friendship", "romance", "neighborhood", "household", "housing", "health"],
    entrepreneur: ["enterprise", "housing", "household", "debt", "health"],
  }[style];
  for (const e of getEmergentView(s).events.filter((e) => e.status === "active")) {
    const prefix = `systemic:${e.id}:`;
    if (fits(pick(prefix + "finish"))) return pick(prefix + "finish");
    const opening = pick(prefix + (commitments.includes(e.family) ? "commit" : "adapt"));
    if (fits(opening) && s.cash + s.bank - opening.cost > 800 && s.player.energy >= 35)
      return opening;
    if (e.deadline - s.time < 1440 && fits(pick(prefix + "decline")))
      return pick(prefix + "decline");
  }
  if (style === "social" && !s.life.household) {
    const invite = actions.find(
      (a) => a.id.startsWith("household:invite:") && a.id.endsWith(":balanced") && fits(a),
    );
    if (invite) return invite;
  }
  // One deliberate contextual contact per day, rotated across known people.
  // A first encounter is earned by work, service or a local visit, never inserted.
  if (minute < 1200 && memory.roleDay !== day && s.player.energy >= 40) {
    const view = getLifeView(s);
    const kinds =
      style === "entrepreneur"
        ? ["deliver", "order", "friend"]
        : style === "social"
          ? ["neighbor", "friend", "talk"]
          : ["colleague"];
    const ids = [...view.secondary.map((n) => n.id), ...view.relationships.map((n) => n.id)];
    const rotated = [...ids.slice(day % ids.length), ...ids.slice(0, day % ids.length)];
    for (const kind of kinds)
      for (const id of rotated) {
        const a = pick(`life:${kind}:${id}`);
        if (fits(a)) {
          memory.roleDay = day;
          return a;
        }
      }
  }
  return ordinary;
}

export const majorDecision =
  /^(event:|story:|systemic:|apply:|promote$|career:notice|career:negotiate|project:|calendar:propose|calendar:accept|calendar:cancel|calendar:reschedule|business:start|business:upgrade|business:close|business:pause|enroll:|rent:|lease:|household:invite|household:leave|life:order:)/;
export const maintenanceAction =
  /^(sleep|rest|work|study|exercise|eat|cook|soup|snack|wait:|walk:|travel:|practice:|withdraw:|buy:groceries)/;
export function normalizeAction(id) {
  return id
    .replace(/sys-\d+/g, "sys-*")
    .replace(/cal-\d+/g, "cal-*")
    .replace(/project-\d+/g, "project-*");
}
