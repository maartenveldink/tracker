import type { AppSettings, Exercise, Workout, WorkoutExercise, WorkoutSet } from '../../../db/index';
import { computeExerciseSessions } from '../hooks/useProgress';
import { steppedWeight, weightStepForExercise } from './weightStep';

/** Minimal exercise prescription needed to build loggable workout sets. */
export interface BuildableExercise {
  exerciseId: number;
  sets: number;
  repsPerSet: number;
  repsMax?: number;
  startWeight?: number;
  restSeconds?: number;
  supersetGroup?: string;
}

/**
 * Turns a list of prescribed exercises into loggable {@link WorkoutExercise}s.
 * Unilateral exercises are logged per side: each planned set becomes a
 * left+right pair, so 3 planned sets yield 6 loggable sets.
 */
export function buildWorkoutExercises(
  exercises: BuildableExercise[],
  exerciseById: Map<number, Exercise>,
): WorkoutExercise[] {
  return exercises.map((se, order) => {
    const isUnilateral = exerciseById.get(se.exerciseId)?.laterality === 'unilateral';
    const sides: WorkoutSet['side'][] = isUnilateral ? ['left', 'right'] : [undefined];

    const sets: WorkoutSet[] = [];
    for (let i = 0; i < se.sets; i++) {
      for (const side of sides) {
        sets.push({
          exerciseId: se.exerciseId,
          setNumber: sets.length + 1,
          plannedReps: se.repsPerSet,
          ...(se.repsMax != null ? { plannedRepsMax: se.repsMax } : {}),
          ...(se.startWeight != null ? { plannedWeight: se.startWeight } : {}),
          ...(side ? { side } : {}),
          actualReps: null,
          weight: null,
          completed: false,
          skipped: false,
        });
      }
    }

    return {
      exerciseId: se.exerciseId,
      order,
      ...(se.restSeconds != null ? { restSeconds: se.restSeconds } : {}),
      ...(se.supersetGroup ? { supersetGroup: se.supersetGroup } : {}),
      sets,
      notes: '',
    };
  });
}

/**
 * Seeds each set's planned weight from the most recent session of the same
 * exercise, so returning users start from what they last lifted (E3-38).
 *
 * Progressive overload: when every planned set was matched last time by a
 * completed set that reached the top of its rep range, seed one increment
 * heavier instead.
 */
export function seedHistoryWeights(
  exercises: WorkoutExercise[],
  completedWorkouts: Workout[],
  exerciseById: Map<number, Exercise>,
  settings: Pick<AppSettings, 'oneRMFormula' | 'weightSteps'>,
): WorkoutExercise[] {
  return exercises.map(we => {
    const sessions = computeExerciseSessions(completedWorkouts, we.exerciseId, settings.oneRMFormula);
    const last = sessions[sessions.length - 1];
    if (!last) return we;

    const step = weightStepForExercise(exerciseById.get(we.exerciseId), settings.weightSteps);
    const hitTopOfRange = we.sets.every((s, i) => {
      const hist = last.sets[i];
      const target = s.plannedRepsMax ?? s.plannedReps;
      return hist != null && target != null && hist.reps >= target;
    });

    return {
      ...we,
      sets: we.sets.map((s, i) => {
        const hist = last.sets[i];
        if (!hist) return s;
        const weight = hitTopOfRange ? steppedWeight(hist.weight, 1, step) : hist.weight;
        return { ...s, plannedWeight: weight };
      }),
    };
  });
}
