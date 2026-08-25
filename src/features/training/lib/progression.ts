import type { Workout, WorkoutSet } from '../../../db/index';
import { calculate1RM, type OneRMFormula } from '../hooks/useProgress';

/**
 * Progression detection shared by the workout summary (progress icon) and the
 * celebration animation. "Better than last time" means: the best estimated 1RM
 * of this session beats the best estimated 1RM of the *previous* session for
 * that exercise — distinct from an all-time personal record.
 */

function isCompletedSet(s: WorkoutSet): boolean {
  return s.completed && s.weight !== null && s.weight > 0 && s.actualReps !== null && s.actualReps > 0;
}

/** Highest estimated 1RM across the completed sets of one exercise in a workout. */
export function bestOneRMForExercise(
  workout: Workout,
  exerciseId: number,
  formula: OneRMFormula,
): number {
  const we = workout.exercises.find(e => e.exerciseId === exerciseId);
  if (!we) return 0;
  let best = 0;
  for (const set of we.sets) {
    if (!isCompletedSet(set)) continue;
    const est = calculate1RM(set.weight!, set.actualReps!, formula);
    if (est > best) best = est;
  }
  return best;
}

/**
 * Best estimated 1RM of the most recent *earlier* completed session that
 * contained this exercise. Returns null when there is no such session.
 */
export function previousBestOneRM(
  workouts: Workout[],
  currentWorkoutId: number | undefined,
  exerciseId: number,
  formula: OneRMFormula,
): number | null {
  // Newest first, skipping the current workout.
  const earlier = workouts
    .filter(w => w.id !== currentWorkoutId && w.exercises.some(e => e.exerciseId === exerciseId))
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

  for (const w of earlier) {
    const best = bestOneRMForExercise(w, exerciseId, formula);
    if (best > 0) return best;
  }
  return null;
}

/**
 * Exercise ids in `workout` whose best 1RM improved over their previous
 * session. Excludes exercises without a comparable previous session.
 */
export function improvedExercises(
  workout: Workout,
  workouts: Workout[],
  formula: OneRMFormula,
): Set<number> {
  const improved = new Set<number>();
  for (const we of workout.exercises) {
    const current = bestOneRMForExercise(workout, we.exerciseId, formula);
    if (current <= 0) continue;
    const previous = previousBestOneRM(workouts, workout.id, we.exerciseId, formula);
    if (previous !== null && current > previous) improved.add(we.exerciseId);
  }
  return improved;
}
