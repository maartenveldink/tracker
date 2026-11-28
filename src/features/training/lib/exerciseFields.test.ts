import { describe, expect, it } from 'vitest';
import {
  stepRepsMaxOf,
  stepRepsOf,
  stepRestOf,
  stepSetsOf,
  stepStartWeightOf,
  swapExerciseOf,
} from './exerciseFields';
import { buildWorkoutExercises } from './workoutBuild';
import type { Exercise } from '../../../db/index';

import type { SchemaExercise } from '../../../db/index';

const base: SchemaExercise = { exerciseId: 'a', sets: 3, repsPerSet: 8, repsMax: 12, order: 0 };

describe('exercise fields', () => {
  it('never goes below one set', () => {
    expect(stepSetsOf({ ...base, sets: 1 }, -1).sets).toBe(1);
  });

  it('drops the max when reps reach it', () => {
    expect(stepRepsOf({ ...base, repsPerSet: 11 }, 1).repsMax).toBeUndefined();
    expect(stepRepsOf(base, 1).repsMax).toBe(12);
  });

  it('max reps starts above reps and clears at the minimum', () => {
    expect(stepRepsMaxOf({ ...base, repsMax: undefined }, 1).repsMax).toBe(9);
    expect(stepRepsMaxOf({ ...base, repsMax: 9 }, -1).repsMax).toBeUndefined();
  });

  it('start weight steps from the suggestion while empty', () => {
    expect(stepStartWeightOf(base, 1, 60, { value: 2.5, unit: 'kg' }).startWeight).toBe(62.5);
    expect(stepStartWeightOf({ ...base, startWeight: 40 }, -1, 60, { value: 2.5, unit: 'kg' }).startWeight).toBe(37.5);
  });

  it('rest steps from the inherited value and clamps', () => {
    expect(stepRestOf(base, 15, 90).restSeconds).toBe(105);
    expect(stepRestOf({ ...base, restSeconds: 15 }, -15, 90).restSeconds).toBe(15);
  });

  it('swap keeps the prescription but clears the start weight', () => {
    const swapped = swapExerciseOf(
      { ...base, startWeight: 50, restSeconds: 60, supersetGroup: 'g' },
      'b',
    );
    expect(swapped).toEqual({ ...base, exerciseId: 'b', restSeconds: 60, supersetGroup: 'g' });
  });
});

describe('suggestion item -> built workout', () => {
  it('carries max reps, start weight and rest into the built exercise', () => {
    const [we] = buildWorkoutExercises(
      [{ exerciseId: 'a', sets: 2, repsPerSet: 8, repsMax: 12, startWeight: 55, restSeconds: 75 }],
      new Map<string, Exercise>(),
    );
    expect(we!.restSeconds).toBe(75);
    expect(we!.sets.map(s => [s.plannedReps, s.plannedRepsMax, s.plannedWeight])).toEqual([
      [8, 12, 55],
      [8, 12, 55],
    ]);
  });
});
