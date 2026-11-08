import { describe, expect, it } from 'vitest';
import type { WorkoutSet } from '../../../db/index';
import { isCompletedSet, isWeightedSet, removeSetAt, setVolume } from './sets';

function set(p: Partial<WorkoutSet>): WorkoutSet {
  return { setNumber: 1, weight: null, actualReps: null, completed: false, ...p } as WorkoutSet;
}

describe('set predicates', () => {
  it('counts a bodyweight set as completed but not weighted, with 0 volume', () => {
    const s = set({ completed: true, actualReps: 10, weight: null });
    expect(isCompletedSet(s)).toBe(true);
    expect(isWeightedSet(s)).toBe(false);
    expect(setVolume(s)).toBe(0);
  });

  it('treats weight 0 as unweighted', () => {
    expect(isWeightedSet(set({ completed: true, actualReps: 5, weight: 0 }))).toBe(false);
  });

  it('computes volume for a weighted completed set', () => {
    expect(setVolume(set({ completed: true, actualReps: 5, weight: 100 }))).toBe(500);
  });

  it('ignores uncompleted sets and zero reps', () => {
    expect(isCompletedSet(set({ completed: false, actualReps: 5, weight: 50 }))).toBe(false);
    expect(isCompletedSet(set({ completed: true, actualReps: 0, weight: 50 }))).toBe(false);
  });
});

describe('removeSetAt', () => {
  it('removes a bilateral set and renumbers', () => {
    const out = removeSetAt([set({ setNumber: 1 }), set({ setNumber: 2 }), set({ setNumber: 3 })], 1);
    expect(out.map((s) => s.setNumber)).toEqual([1, 2]);
  });

  it('removes the left+right pair of a unilateral set', () => {
    const sets = [
      set({ side: 'left' }),
      set({ side: 'right' }),
      set({ side: 'left' }),
      set({ side: 'right' }),
    ];
    const out = removeSetAt(sets, 1);
    expect(out.map((s) => [s.side, s.setNumber])).toEqual([['left', 1], ['right', 2]]);
    expect(removeSetAt(sets, 2)).toHaveLength(2);
    expect(removeSetAt(sets, 9)).toBe(sets);
  });
});
