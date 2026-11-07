import type { Workout } from '../../../db/index';
import { calculate1RM, type OneRMFormula } from '../hooks/useProgress';
import { getISOWeek } from './metrics';
import { isWeightedSet } from './sets';

/**
 * Deload detection: "your estimated 1RM has stalled/declined for several
 * exercises over several weeks — consider a deload week".
 *
 * DECISION RULE (all thresholds are the exported constants below)
 *
 * Per exercise (deleted exercises are skipped, only weighted sets count):
 *  1. Take the best estimated 1RM per ISO week over the last WINDOW_WEEKS weeks
 *     (current week included, week keys are stepped back with real dates so
 *     year boundaries / 53-week years need no special casing).
 *  2. A pause of PAUSE_WEEKS or more empty weeks in a row restarts the series:
 *     only the weeks after the pause are used ("just started again" → no alarm).
 *  3. The exercise is ASSESSABLE when that series has ≥ MIN_WEEKS weeks with a
 *     session AND the exercise was trained within the last RECENT_DAYS days.
 *  4. It is STAGNATING when the best of the last RECENT_WEEKS weeks with data
 *     does not beat the best of the earlier weeks by more than TOLERANCE
 *     (1%): `recent <= earlier * (1 + TOLERANCE)`. It is DECLINING when it is
 *     below `earlier * (1 - TOLERANCE)`. Declining ⊂ stagnating.
 *
 * A deload already underway: when the newest week's best 1RM is more than
 * DELOAD_DROP (10%) below the week before for at least half of the assessable
 * exercises, the user is already going lighter and nothing is shown.
 * With MIN_WEEKS = 4 and RECENT_WEEKS = 2 the baseline is always ≥ 2 weeks, so
 * one lucky week cannot trigger the notice.
 *
 * Training level: one notice, shown only when at least MIN_FLAGGED exercises
 * stagnate AND they are at least HALF of the assessable exercises. Fewer
 * assessable exercises than MIN_FLAGGED can therefore never raise it.
 */

export const WINDOW_WEEKS = 6;
export const MIN_WEEKS = 4;
export const RECENT_DAYS = 14;
export const RECENT_WEEKS = 2;
export const PAUSE_WEEKS = 2;
export const TOLERANCE = 0.01;
export const MIN_FLAGGED = 2;
export const MIN_FLAGGED_SHARE = 0.5;
export const DELOAD_DROP = 0.1;

export interface StagnatingExercise {
  exerciseId: string;
  /** Best 1RM of the last RECENT_WEEKS weeks with data (kg). */
  recent1RM: number;
  /** Best 1RM of the earlier weeks in the series (kg). */
  earlier1RM: number;
  /** (recent - earlier) / earlier; negative = declining. */
  change: number;
  declining: boolean;
}

export interface DeloadAdvice {
  /** True when the training-level notice should be shown. */
  suggest: boolean;
  /** Exercises with enough data to be judged. */
  assessable: number;
  /** Stagnating/declining exercises, most-declining first. */
  exercises: StagnatingExercise[];
}

/** ISO week keys of the last `count` weeks, oldest first (current week last). */
function recentWeekKeys(now: Date, count: number): string[] {
  const keys: string[] = [];
  const cursor = new Date(now.getTime());
  for (let i = 0; i < count; i++) {
    keys.unshift(getISOWeek(cursor));
    cursor.setDate(cursor.getDate() - 7);
  }
  return keys;
}

/**
 * The series (oldest → newest) of weekly best 1RMs after the last pause, or
 * null when the exercise is not assessable (too little data / not trained
 * recently). `slots[0]` is the oldest week, `undefined` = no weighted session.
 */
function assessableSeries(
  slots: (number | undefined)[],
  lastTrained: number,
  now: Date,
): number[] | null {
  if (now.getTime() - lastTrained > RECENT_DAYS * 86400000) return null;

  const series: number[] = [];
  let gap = 0;
  for (let i = slots.length - 1; i >= 0; i--) {
    const v = slots[i];
    if (v === undefined) {
      gap++;
      if (series.length > 0 && gap >= PAUSE_WEEKS) break;
      continue;
    }
    gap = 0;
    series.unshift(v);
  }
  return series.length >= MIN_WEEKS ? series : null;
}

/** Verdict for an assessable series: null when the 1RM is still rising. */
function judge(exerciseId: string, series: number[]): StagnatingExercise | null {
  const recent = Math.max(...series.slice(-RECENT_WEEKS));
  const earlier = Math.max(...series.slice(0, -RECENT_WEEKS));
  if (!Number.isFinite(recent) || !Number.isFinite(earlier) || earlier <= 0) return null;
  if (recent > earlier * (1 + TOLERANCE)) return null;
  return {
    exerciseId,
    recent1RM: recent,
    earlier1RM: earlier,
    change: (recent - earlier) / earlier,
    declining: recent < earlier * (1 - TOLERANCE),
  };
}

/**
 * @param workouts  completed workouts
 * @param isKnown   false for exercises to skip (deleted or no longer in the library)
 * @param now       injectable clock for tests
 */
export function detectDeload(
  workouts: Workout[],
  formula: OneRMFormula,
  isKnown: (exerciseId: string) => boolean = () => true,
  now: Date = new Date(),
): DeloadAdvice {
  const keys = recentWeekKeys(now, WINDOW_WEEKS);
  const slotOf = new Map(keys.map((k, i) => [k, i]));

  const perExercise = new Map<string, { slots: (number | undefined)[]; last: number }>();
  for (const w of workouts) {
    const slot = slotOf.get(getISOWeek(w.startedAt));
    if (slot === undefined || w.startedAt.getTime() > now.getTime()) continue;
    for (const we of w.exercises) {
      if (!isKnown(we.exerciseId)) continue;
      for (const set of we.sets) {
        if (!isWeightedSet(set)) continue;
        const est = calculate1RM(set.weight!, set.actualReps!, formula);
        if (!Number.isFinite(est) || est <= 0) continue;
        let acc = perExercise.get(we.exerciseId);
        if (!acc) {
          acc = { slots: new Array<number | undefined>(WINDOW_WEEKS).fill(undefined), last: 0 };
          perExercise.set(we.exerciseId, acc);
        }
        const cur = acc.slots[slot];
        if (cur === undefined || est > cur) acc.slots[slot] = est;
        acc.last = Math.max(acc.last, w.startedAt.getTime());
      }
    }
  }

  let assessable = 0;
  let underway = 0;
  const flagged: StagnatingExercise[] = [];
  for (const [exerciseId, acc] of perExercise) {
    const series = assessableSeries(acc.slots, acc.last, now);
    if (!series) continue;
    assessable++;
    const last = series[series.length - 1]!;
    const prev = series[series.length - 2]!;
    if (last < prev * (1 - DELOAD_DROP)) underway++;
    const verdict = judge(exerciseId, series);
    if (verdict) flagged.push(verdict);
  }

  flagged.sort((a, b) => a.change - b.change);
  const suggest =
    flagged.length >= MIN_FLAGGED &&
    flagged.length >= assessable * MIN_FLAGGED_SHARE &&
    underway < assessable * MIN_FLAGGED_SHARE;
  return { suggest, assessable, exercises: suggest ? flagged : [] };
}
