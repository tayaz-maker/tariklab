// Validate measurement continuity independently of frame-rate/heap/long-task limits.
// The fixed 100 ms world clock is an independent witness; no QA stepping is allowed.
export function assessSoakCoverage(report, requestedMinutes) {
  const issues = [];
  let elapsed = 0,
    tick = report?.initialTick,
    samples = 0;
  if (!Number.isInteger(tick) || !Number.isFinite(requestedMinutes) || requestedMinutes <= 0)
    return { status: "UNVERIFIED", issues: ["Missing initial tick or requested duration."] };
  for (const sample of report.minuteSamples ?? []) {
    if (sample.minute > Math.ceil(requestedMinutes)) break;
    const end = sample.elapsedMs,
      next = sample.projection?.tick;
    const intervalMs = end - elapsed,
      advancedMs = (next - tick) * 100;
    if (!Number.isFinite(end) || !Number.isInteger(next) || intervalMs <= 0 || next < tick) {
      issues.push({ minute: sample.minute, reason: "Invalid observation order" });
      break;
    }
    if (intervalMs > 90000 && intervalMs - advancedMs > 15000)
      issues.push({
        minute: sample.minute,
        intervalMs,
        advancedMs,
        reason: "Sampling gap without corresponding gameplay progress",
      });
    elapsed = end;
    tick = next;
    samples++;
  }
  const targetMs = requestedMinutes * 60000;
  const simulationMs = (tick - report.initialTick) * 100;
  const coverageRatio = elapsed > 0 ? simulationMs / elapsed : 0;
  if (elapsed < targetMs || samples < Math.ceil(requestedMinutes))
    issues.push({ reason: "Requested duration or minute observations missing" });
  if (coverageRatio < 0.97 || coverageRatio > 1.03)
    issues.push({
      reason: "Fixed ticks do not corroborate elapsed observation time",
      coverageRatio,
    });
  return {
    status: issues.length ? "UNVERIFIED" : "VERIFIED",
    requestedMinutes,
    samples,
    elapsedMs: elapsed,
    simulationMs,
    coverageRatio,
    issues,
  };
}
