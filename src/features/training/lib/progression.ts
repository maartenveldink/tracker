import type { Workout } from '../../../db/index';
import type { OneRMFormula } from '../hooks/useProgress';
import { averageOneRM } from './celebration';
import { isWeightedSet } from './sets';

/**
 * Progression detection shared by the workout summary (progress icon) and the
 * celebration animation. "Better than last time" means: the average estimated 1RM
 * over the weighted sets of this session beats that of the *previous* session for
 * that exercise — distinct from an all-time personal record.
 */

/** Average estimated 1RM across the weighted completed sets of one exercise in a workout. */
export function averageOneRMForExercise(
  workout: Workout,
  exerciseId: string,
  formula: OneRMFormula,
): number {
  const we = workout.exercises.find(e => e.exerciseId === exerciseId);
  if (!we) return 0;
  const lines = we.sets.filter(isWeightedSet).map(set => ({ weight: set.weight!, reps: set.actualReps! }));
  return averageOneRM(lines, formula);
}

/**
 * Average estimated 1RM of the most recent *earlier* completed session that
 * contained this exercise. Returns null when there is no such session.
 */
export function previousAverageOneRM(
  workouts: Workout[],
  currentWorkoutId: string | undefined,
  exerciseId: string,
  formula: OneRMFormula,
): number | null {
  // Newest first, skipping the current workout.
  const earlier = workouts
    .filter(w => w.id !== currentWorkoutId && w.exercises.some(e => e.exerciseId === exerciseId))
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

  for (const w of earlier) {
    const best = averageOneRMForExercise(w, exerciseId, formula);
    if (best > 0) return best;
  }
  return null;
}

/**
 * Exercise ids in `workout` whose average 1RM improved over their previous
 * session. Excludes exercises without a comparable previous session.
 */
export function improvedExercises(
  workout: Workout,
  workouts: Workout[],
  formula: OneRMFormula,
): Set<string> {
  const improved = new Set<string>();
  for (const we of workout.exercises) {
    const current = averageOneRMForExercise(workout, we.exerciseId, formula);
    if (current <= 0) continue;
    const previous = previousAverageOneRM(workouts, workout.id, we.exerciseId, formula);
    if (previous !== null && current > previous) improved.add(we.exerciseId);
  }
  return improved;
}
