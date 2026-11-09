import type { Exercise, Workout } from '../../../db/index';
import { getISOWeek } from './metrics';
import { isCompletedSet } from './sets';

// --- Plateau ---

export const PLATEAU_SESSIONS = 3;

export interface Plateau {
  weight: number;
  reps: number;
  sessions: number;
  nextWeight: number;
  nextReps: number;
}

/**
 * Plateau signal: the last 3 sessions (oldest first) had the same top set
 * (same weight and reps). Bodyweight top sets (weight 0) are ignored, there is
 * no weight to bump. `stepKg` is the exercise's weight increment.
 */
export function detectPlateau(
  sessions: Array<{ bestSet: { weight: number; reps: number } }>,
  stepKg: number,
): Plateau | null {
  if (sessions.length < PLATEAU_SESSIONS) return null;
  const last = sessions.slice(-PLATEAU_SESSIONS).map(s => s.bestSet);
  const { weight, reps } = last[0]!;
  if (!(weight > 0)) return null;
  if (!last.every(s => s.weight === weight && s.reps === reps)) return null;
  return {
    weight,
    reps,
    sessions: PLATEAU_SESSIONS,
    nextWeight: Math.round((weight + stepKg) * 1000) / 1000,
    nextReps: reps + 1,
  };
}

/** True when the latest value is a strictly new all-time high (needs history). */
export function isNewPR(oneRMs: number[]): boolean {
  if (oneRMs.length < 2) return false;
  const last = oneRMs[oneRMs.length - 1]!;
  return last > Math.max(...oneRMs.slice(0, -1));
}

// --- Sets per muscle group ---

/** Weekly set target; below this a muscle group counts as "low". */
export const WEEKLY_SETS_TARGET = 10;
/** Upper end of the bar. */
export const WEEKLY_SETS_MAX = 20;

/**
 * Completed sets per primary muscle in the ISO week (Mon-Sun) containing `ref`.
 * Secondary muscles do not count. Bodyweight sets count (see `sets.ts`).
 */
export function setsPerPrimaryMuscle(
  workouts: Workout[],
  exerciseMap: Map<string, Exercise>,
  ref: Date = new Date(),
): Map<string, number> {
  const week = getISOWeek(ref);
  const result = new Map<string, number>();
  for (const w of workouts) {
    if (getISOWeek(w.startedAt) !== week) continue;
    for (const we of w.exercises) {
      const ex = exerciseMap.get(we.exerciseId);
      if (!ex) continue;
      const done = we.sets.filter(isCompletedSet).length;
      if (done === 0) continue;
      for (const m of ex.primaryMuscles) result.set(m, (result.get(m) ?? 0) + done);
    }
  }
  return result;
}

// --- Body weight ---

export interface WeightPoint {
  date: string; // YYYY-MM-DD
  weightKg: number;
  /** Mean of the measurements in the 7 days up to and including `date`. */
  avg: number;
}

const DAY_MS = 86_400_000;

function dayNumber(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Math.round(Date.UTC(y!, m! - 1, d!) / DAY_MS);
}

function isoFromDayNumber(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Per measurement the mean of the measurements in the 7 days up to and
 * including that day. Days without a measurement do not count.
 */
export function weightMovingAverage(
  entries: Array<{ date: string; weightKg: number }>,
): WeightPoint[] {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map(e => {
    const day = dayNumber(e.date);
    const window = sorted.filter(x => {
      const d = dayNumber(x.date);
      return d <= day && d > day - 7;
    });
    const avg = window.reduce((s, x) => s + x.weightKg, 0) / window.length;
    return { date: e.date, weightKg: e.weightKg, avg: Math.round(avg * 100) / 100 };
  });
}

/**
 * Latest average minus the average `days` earlier (the latest point on or
 * before that day). Null when there is no measurement that old.
 */
export function averageChange(points: WeightPoint[], days: number): number | null {
  const latest = points[points.length - 1];
  if (!latest) return null;
  const target = isoFromDayNumber(dayNumber(latest.date) - days);
  const earlier = points.filter(p => p.date <= target).pop();
  if (!earlier) return null;
  return Math.round((latest.avg - earlier.avg) * 10) / 10;
}

// --- Overview tiles ---

export interface RecentTrainingStats {
  sessionsPerWeek: number;
  /** Mean net duration (excluding pauses) in minutes; null without finished workouts. */
  avgMinutes: number | null;
}

/** Average sessions per week and duration per training over the last `weeks` weeks. */
export function recentTrainingStats(
  workouts: Workout[],
  weeks = 8,
  now: Date = new Date(),
): RecentTrainingStats {
  const cutoff = now.getTime() - weeks * 7 * DAY_MS;
  const inWindow = workouts.filter(w => w.startedAt.getTime() >= cutoff);
  // A new user (first workout < `weeks` ago) is averaged over the weeks they have actually been training.
  const firstStart = workouts.reduce((min, w) => Math.min(min, w.startedAt.getTime()), now.getTime());
  const activeWeeks = Math.min(weeks, Math.max(1, Math.ceil((now.getTime() - firstStart) / (7 * DAY_MS))));
  const durations = inWindow
    .filter(w => w.completedAt)
    .map(w => (w.completedAt!.getTime() - w.startedAt.getTime() - (w.totalPausedMs ?? 0)) / 60_000)
    .filter(m => m > 0);
  return {
    sessionsPerWeek: Math.round((inWindow.length / activeWeeks) * 10) / 10,
    avgMinutes: durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null,
  };
}
