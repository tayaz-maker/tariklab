import type { Point } from "../domain/types.ts";
/** Presentation-only history: never writes a simulation transform. */
export type MotionSample = { from: Point; to: Point; updatedAt: number; duration: number };
export function sampleMotion(sample: MotionSample, now: number): Point & { moving: boolean } {
  const progress = Math.max(
    0,
    Math.min(1, (now - sample.updatedAt) / Math.max(1, sample.duration)),
  );
  return {
    x: sample.from.x + (sample.to.x - sample.from.x) * progress,
    y: sample.from.y + (sample.to.y - sample.from.y) * progress,
    moving:
      progress < 1 && Math.hypot(sample.to.x - sample.from.x, sample.to.y - sample.from.y) > 0.001,
  };
}
/** An unchanged 10 Hz projection must not restart a coarse actor's 1 Hz blend. */
export function retargetMotion(
  sample: MotionSample,
  target: Point,
  duration: number,
  now: number,
): boolean {
  if (Math.abs(target.x - sample.to.x) + Math.abs(target.y - sample.to.y) <= 0.00001) return false;
  const current = sampleMotion(sample, now);
  sample.from = { x: current.x, y: current.y };
  sample.to = { ...target };
  sample.updatedAt = now;
  sample.duration = duration;
  return true;
}
