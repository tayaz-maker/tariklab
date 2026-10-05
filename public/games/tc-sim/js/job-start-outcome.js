import { getJobById, getMonthlyEmploymentIncome, getWeeklyLifeLoad } from "./life.js?v=10";

// Presentation snapshots only. No stored marker, RNG call or second simulation.
export function snapshotJobStart(state) {
  const event = state?.events?.active;
  const pending = state?.career?.pendingJob;
  if (event?.eventId !== "job_start" || !pending || pending.caseId !== event.sourceCaseId ||
    state.events.history.some((item) => item.occurrenceId === event.occurrenceId))
    return null;
  return {
    event: { ...event },
    pending: { ...pending },
    week: state.time.absoluteWeek,
    acceptedWeek: state.openCases.find((item) => item.id === pending.caseId)?.createdWeek,
    jobId: state.career.jobId,
    balance: state.finances.balance,
    focus: state.weekly.used,
    health: { ...state.health },
    salary: getMonthlyEmploymentIncome(state),
    load: { ...getWeeklyLifeLoad(state) },
  };
}

export function buildJobStartOutcome(before, after, result, choiceId) {
  if (!before || !result?.ok || choiceId !== "start" ||
    before.event.eventId !== "job_start" || before.event.sourceCaseId !== before.pending.caseId ||
    before.week < before.pending.startWeek || after.time.absoluteWeek !== before.week ||
    after.career.pendingJob !== null || after.career.jobId !== before.pending.jobId ||
    after.career.jobId === before.jobId || !after.events.history.some((item) =>
      item.occurrenceId === before.event.occurrenceId && item.eventId === "job_start" &&
      item.choiceId === "start" && item.week === before.week)) return null;
  const job = getJobById(after.career.jobId);
  if (!job) return null;
  return {
    key: `${before.event.occurrenceId}:${before.pending.caseId}`,
    jobId: job.id,
    jobTitle: job.title,
    week: before.week,
    waitedWeeks: Number.isInteger(before.acceptedWeek)
      ? Math.max(0, before.week - before.acceptedWeek) : null,
    now: {
      cash: after.finances.balance - before.balance,
      focus: after.weekly.used - before.focus,
      energy: after.health.energy - before.health.energy,
      stress: after.health.stress - before.health.stress,
      health: after.health.health - before.health.health,
    },
    schedule: {
      salaryBefore: before.salary,
      salary: getMonthlyEmploymentIncome(after),
      loadBefore: before.load.load,
      ...getWeeklyLifeLoad(after),
    },
  };
}
