import type { Workout, Exercise } from '../../../db/index';
import { calculate1RM, type OneRMFormula } from '../hooks/useProgress';
import { isCompletedSet, isWeightedSet, setVolume } from './sets';

// --- Week helpers ---

/** ISO week key like "2026-W07" (zero-padded, so keys sort chronologically as text). */
export function getISOWeek(date: Date): string {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum =
    1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
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

  // Walk back week by week from now using real dates, so year boundaries and
  // 53-week years need no special casing. A missing current week is tolerated.
  const cursor = new Date();
  if (!weeksWithWorkouts.has(getISOWeek(cursor))) cursor.setDate(cursor.getDate() - 7);

  let streak = 0;
  while (weeksWithWorkouts.has(getISOWeek(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 7);
  }
  return streak;
}

// --- Volume ---

/** Total training volume (kg = weight × reps over completed sets) of one workout. */
export function workoutVolume(w: Workout): number {
  return w.exercises.reduce(
    (sum, we) =>
      sum + we.sets.reduce((s, set) => s + setVolume(set), 0),
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
  exerciseMap: Map<string, Exercise>,
): Map<string, number> {
  const vol = new Map<string, number>();
  for (const w of workouts) {
    for (const we of w.exercises) {
      const ex = exerciseMap.get(we.exerciseId);
      if (!ex) continue;
      for (const set of we.sets) {
        if (!isCompletedSet(set)) continue;
        // Bodyweight sets add 0 kg but still register the muscle group.
        const v = setVolume(set);
        for (const m of ex.primaryMuscles) vol.set(m, (vol.get(m) ?? 0) + v);
        for (const m of ex.secondaryMuscles) vol.set(m, (vol.get(m) ?? 0) + v * 0.5);
      }
    }
  }
  return vol;
}

// --- Personal records ---

export interface PRRecord {
  exerciseId: string;
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
  const best = new Map<string, PRRecord>();

  for (const w of workouts) {
    for (const ex of w.exercises) {
      for (const set of ex.sets) {
        if (!isWeightedSet(set)) continue;
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
