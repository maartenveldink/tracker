import type { Workout, WorkoutSet, Exercise } from '../../../db/index';
import { calculate1RM, type OneRMFormula } from '../hooks/useProgress';

// --- Week helpers ---

/** ISO week key like "2026-W30" for a date. */
export function getISOWeek(date: Date): string {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum =
    1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${weekNum}`;
}

/**
 * Training streak: number of consecutive ISO weeks (up to now) with at least one
 * workout. A missing current week is tolerated as long as last week has one.
 */
export function calculateStreak(completedWorkouts: Workout[]): number {
  if (completedWorkouts.length === 0) return 0;

  const weeksWithWorkouts = new Set<string>();
  for (const w of completedWorkouts) {
    weeksWithWorkouts.add(getISOWeek(w.startedAt));
  }

  const sortedWeeks = Array.from(weeksWithWorkouts).sort().reverse();
  if (sortedWeeks.length === 0) return 0;

  const currentWeek = getISOWeek(new Date());
  const mostRecent = sortedWeeks[0]!;
  if (mostRecent !== currentWeek) {
    const lastWeekDate = new Date();
    lastWeekDate.setDate(lastWeekDate.getDate() - 7);
    const lastWeek = getISOWeek(lastWeekDate);
    if (mostRecent !== lastWeek) return 0;
  }

  let streak = 1;
  for (let i = 1; i < sortedWeeks.length; i++) {
    const current = sortedWeeks[i];
    const previous = sortedWeeks[i - 1];
    if (!current || !previous) break;

    const [currYear, currWeekStr] = current.split('-W');
    const [prevYear, prevWeekStr] = previous.split('-W');
    if (!currYear || !currWeekStr || !prevYear || !prevWeekStr) break;
    const currWeek = parseInt(currWeekStr);
    const prevWeek = parseInt(prevWeekStr);
    const cy = parseInt(currYear);
    const py = parseInt(prevYear);

    const isConsecutive =
      (cy === py && prevWeek - currWeek === 1) ||
      (py - cy === 1 && currWeek >= 52 && prevWeek === 1);

    if (isConsecutive) streak++;
    else break;
  }

  return streak;
}

// --- Volume ---

function isCompletedSet(s: WorkoutSet): boolean {
  return s.completed && s.weight !== null && s.weight > 0 && s.actualReps !== null && s.actualReps > 0;
}

/** Total training volume (kg = weight × reps over completed sets) of one workout. */
export function workoutVolume(w: Workout): number {
  return w.exercises.reduce(
    (sum, we) =>
      sum + we.sets.filter(isCompletedSet).reduce((s, set) => s + set.weight! * set.actualReps!, 0),
    0,
  );
}

export interface WeekStats {
  sessions: number;
  volume: number;
}

/** Session count and total volume for the ISO week containing `ref` (default now). */
export function statsForWeek(workouts: Workout[], ref: Date = new Date()): WeekStats {
  const targetWeek = getISOWeek(ref);
  const inWeek = workouts.filter(w => getISOWeek(w.startedAt) === targetWeek);
  return {
    sessions: inWeek.length,
    volume: inWeek.reduce((sum, w) => sum + workoutVolume(w), 0),
  };
}

export interface WeekVolumePoint {
  week: string;
  date: Date;   // earliest workout date in the week (for sorting/labels)
  volume: number;
}

/** Total training volume per ISO week, oldest first. */
export function weeklyVolumeSeries(workouts: Workout[]): WeekVolumePoint[] {
  const map = new Map<string, { date: Date; volume: number }>();
  for (const w of workouts) {
    const key = getISOWeek(w.startedAt);
    const vol = workoutVolume(w);
    const cur = map.get(key);
    if (cur) {
      cur.volume += vol;
      if (w.startedAt < cur.date) cur.date = w.startedAt;
    } else {
      map.set(key, { date: w.startedAt, volume: vol });
    }
  }
  return Array.from(map.entries())
    .map(([week, v]) => ({ week, date: v.date, volume: v.volume }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Volume per muscle group across the given workouts. Primary muscles get full
 * credit, secondary muscles half (matching the workout summary breakdown).
 */
export function volumePerMuscleGroup(
  workouts: Workout[],
  exerciseMap: Map<number, Exercise>,
): Map<string, number> {
  const vol = new Map<string, number>();
  for (const w of workouts) {
    for (const we of w.exercises) {
      const ex = exerciseMap.get(we.exerciseId);
      if (!ex) continue;
      for (const set of we.sets) {
        if (!isCompletedSet(set)) continue;
        const v = set.weight! * set.actualReps!;
        for (const m of ex.primaryMuscles) vol.set(m, (vol.get(m) ?? 0) + v);
        for (const m of ex.secondaryMuscles) vol.set(m, (vol.get(m) ?? 0) + v * 0.5);
      }
    }
  }
  return vol;
}

// --- Personal records ---

export interface PRRecord {
  exerciseId: number;
  best1RM: number;
  reps: number;
  weight: number;
  date: Date;
}

/**
 * All-time best estimated 1RM per exercise, with the set and date it was achieved.
 * Sorted by most recently achieved first.
 */
export function allTimePRs(workouts: Workout[], formula: OneRMFormula): PRRecord[] {
  const best = new Map<number, PRRecord>();

  for (const w of workouts) {
    for (const ex of w.exercises) {
      for (const set of ex.sets) {
        if (!isCompletedSet(set)) continue;
        const est = calculate1RM(set.weight!, set.actualReps!, formula);
        const current = best.get(ex.exerciseId);
        if (!current || est > current.best1RM) {
          best.set(ex.exerciseId, {
            exerciseId: ex.exerciseId,
            best1RM: est,
            reps: set.actualReps!,
            weight: set.weight!,
            date: w.startedAt,
          });
        }
      }
    }
  }

  return Array.from(best.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
}

/** PRs whose current all-time best was achieved within the last `sinceDays` days. */
export function recentPRs(workouts: Workout[], formula: OneRMFormula, sinceDays = 30): PRRecord[] {
  const cutoff = Date.now() - sinceDays * 86400000;
  return allTimePRs(workouts, formula).filter(pr => pr.date.getTime() >= cutoff);
}

// --- Consistency ---

/** Local YYYY-MM-DD string for a date (not UTC). */
export function localDateKey(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Set of local YYYY-MM-DD dates on which a workout was started. */
export function trainingDaysSet(workouts: Workout[]): Set<string> {
  const days = new Set<string>();
  for (const w of workouts) days.add(localDateKey(w.startedAt));
  return days;
}

/** Map of local YYYY-MM-DD date → number of workouts started that day. */
export function trainingDayCounts(workouts: Workout[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const w of workouts) {
    const key = localDateKey(w.startedAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
