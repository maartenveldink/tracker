/**
 * Pure editing rules for the fields of the shared exercise card (Schema
 * bewerken + Voorgestelde training): sets, reps, max reps, start weight and
 * rest. Each function returns the changed exercise; empty start weight / rest
 * (`undefined`) means "inherit" from the 1RM suggestion / exercise / settings.
 */
import type { SchemaExercise, WeightStepSetting } from '../../../db/index';
import { clampRest } from './restTime';
import { steppedWeight } from './weightStep';

type Fields = Pick<SchemaExercise, 'sets' | 'repsPerSet' | 'repsMax' | 'startWeight' | 'restSeconds'>;

export function stepSetsOf<T extends Fields>(ex: T, delta: number): T {
  return { ...ex, sets: Math.max(1, ex.sets + delta) };
}

export function stepRepsOf<T extends Fields>(ex: T, delta: number): T {
  const repsPerSet = Math.max(1, ex.repsPerSet + delta);
  // Keep the range valid: drop the max if it no longer exceeds the min.
  const repsMax = ex.repsMax != null && ex.repsMax <= repsPerSet ? undefined : ex.repsMax;
  return { ...ex, repsPerSet, repsMax };
}

export function stepRepsMaxOf<T extends Fields>(ex: T, delta: number): T {
  if (delta > 0) return { ...ex, repsMax: (ex.repsMax ?? ex.repsPerSet) + 1 };
  if (ex.repsMax == null) return ex;
  const next = ex.repsMax - 1;
  return { ...ex, repsMax: next > ex.repsPerSet ? next : undefined };
}

/** `base` = the suggested weight shown while the field is empty. */
export function stepStartWeightOf<T extends Fields>(ex: T, dir: 1 | -1, base: number | null, step: WeightStepSetting): T {
  return { ...ex, startWeight: steppedWeight(ex.startWeight ?? base ?? 0, dir, step) };
}

/** `inherited` = the rest that applies while the field is empty. */
export function stepRestOf<T extends Fields>(ex: T, delta: number, inherited: number): T {
  return { ...ex, restSeconds: clampRest((ex.restSeconds ?? inherited) + delta) };
}

/**
 * Swap to another exercise, keeping sets/reps/max reps/rest/superset link. The
 * start weight is cleared: it belonged to the previous exercise.
 */
export function swapExerciseOf<T extends Fields & { exerciseId: string }>(ex: T, exerciseId: string): T {
  const { startWeight: _drop, ...rest } = ex;
  return { ...rest, exerciseId } as T;
}
