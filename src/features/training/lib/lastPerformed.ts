import type { Workout } from '../../../db/index';
import { isCompletedSet, isWeightedSet } from './sets';

export interface LastPerformed {
  /** Start of the most recent workout with a performed set of this exercise. */
  date: Date;
  /** Heaviest weighted set of that workout (null weight = bodyweight only). */
  weight: number | null;
  reps: number;
}

/**
 * Per exercise: the best set (heaviest weight, ties by reps) of its most recent
 * workout. Bodyweight-only sessions report the highest rep count with weight null.
 */
export function lastPerformedByExercise(workouts: Workout[]): Map<string, LastPerformed> {
  const result = new Map<string, LastPerformed>();
  for (const w of workouts) {
    for (const ex of w.exercises) {
      const done = ex.sets.filter(isCompletedSet);
      if (done.length === 0) continue;
      const prev = result.get(ex.exerciseId);
      if (prev && prev.date >= w.startedAt) continue;
      const weighted = done.filter(isWeightedSet);
      let best: { weight: number | null; reps: number };
      if (weighted.length > 0) {
        const top = weighted.reduce((a, b) =>
          b.weight! > a.weight! || (b.weight === a.weight && b.actualReps! > a.actualReps!) ? b : a,
        );
        best = { weight: top.weight, reps: top.actualReps! };
      } else {
        best = { weight: null, reps: Math.max(...done.map((s) => s.actualReps!)) };
      }
      result.set(ex.exerciseId, { date: w.startedAt, ...best });
    }
  }
  return result;
}

/** "80 kg × 8", or "× 12" for bodyweight sets. */
export function formatLastPerformed(p: LastPerformed): string {
  const w = p.weight === null ? '' : `${String(p.weight).replace('.', ',')} kg `;
  return `${w}× ${p.reps}`;
}
