/** Canonical civil date. Preserve the existing four decision weeks per month:
 * weeks 1–3 cover seven days; week 4 covers the rest of the calendar month.
 * This is a simulation cadence, not ISO week numbering. */
const iso = (date) => date.toISOString().slice(0, 10);
export function dateAtWeek(startDate, elapsedWeeks = 0) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const day = start.getUTCDate();
  const phase = Math.min(3, Math.floor((day - 1) / 7));
  const offset = day - 1 - phase * 7;
  const turn = phase + elapsedWeeks;
  const month = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + Math.floor(turn / 4), 1));
  const days = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  const targetPhase = (turn % 4 + 4) % 4;
  month.setUTCDate(Math.min(days, targetPhase * 7 + (targetPhase === 3 ? offset : Math.min(6, offset)) + 1));
  return iso(month);
}
export function ageOnDate(birthDate, date) {
  return Number(date.slice(0, 4)) - Number(birthDate.slice(0, 4)) - (date.slice(5) < birthDate.slice(5) ? 1 : 0);
}
export function syncGameDate(state) {
  const time = state.time;
  const scenario = state.world?.scenario;
  if (!time || !Number.isInteger(time.absoluteWeek)) return;
  if (!time.dateOrigin) {
    // Anchor migrated saves at their last displayed civil date, preserving deadlines.
    time.dateOrigin = scenario?.currentDate || `${time.year || 2027}-${String(time.month || 1).padStart(2, '0')}-${String(((time.weekOfMonth || 1) - 1) * 7 + 1).padStart(2, '0')}`;
    time.dateOriginWeek = time.absoluteWeek;
  }
  time.date = dateAtWeek(time.dateOrigin, time.absoluteWeek - time.dateOriginWeek);
  if (scenario && time.date >= scenario.endDate) time.date = scenario.endDate;
  time.year = Number(time.date.slice(0, 4));
  time.month = Number(time.date.slice(5, 7));
  time.day = Number(time.date.slice(8, 10));
  time.weekOfMonth = Math.min(4, Math.ceil(time.day / 7));
  if (scenario) scenario.currentDate = time.date;
  if (state.player) {
    if (Number.isInteger(state.lifetime?.bornWeek)) {
      state.player.birthDate = dateAtWeek(time.dateOrigin, state.lifetime.bornWeek - time.dateOriginWeek);
    } else if (!state.player.birthDate) {
      state.player.birthDate = `${time.year - state.player.age}${time.date.slice(4)}`;
    }
    state.player.age = Math.max(0, ageOnDate(state.player.birthDate, time.date));
  }
}
export const gameDateLabel = (state) => new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${state.time.date}T00:00:00Z`));
