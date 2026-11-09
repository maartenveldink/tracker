import { describe, expect, it } from 'vitest';
import type { WorkoutExercise, WorkoutSet } from '../../../db/index';
import {
  MAX_SETS,
  activeSetIndex,
  afterSetLogged,
  canAddSet,
  canRemoveLastSet,
  exerciseStatus,
  exerciseStatuses,
  findNextTodo,
  formatDecimal,
  formatPrevLine,
  parseDecimal,
  focusAfterInsert,
  initialSetValues,
  primaryAction,
  primaryLabel,
  restoreSkippedSets,
  skipRemainingSets,
} from './liveTraining';

type S = 'todo' | 'done' | 'skip';

function set(state: S, n: number, side?: 'left' | 'right'): WorkoutSet {
  return {
    exerciseId: 'e',
    setNumber: n,
    plannedReps: 10,
    actualReps: state === 'done' ? 8 : null,
    weight: state === 'done' ? 50 : null,
    completed: state === 'done',
    skipped: state === 'skip',
    ...(side ? { side } : {}),
  };
}

function ex(states: S[], superset?: string): WorkoutExercise {
  return {
    exerciseId: 'e',
    order: 0,
    notes: '',
    sets: states.map((s, i) => set(s, i + 1)),
    ...(superset ? { supersetGroup: superset } : {}),
  };
}

describe('exerciseStatus', () => {
  it('is todo while any set is unsettled', () => {
    expect(exerciseStatus(ex(['done', 'todo']))).toBe('todo');
    expect(exerciseStatus(ex(['todo', 'todo']))).toBe('todo');
  });
  it('is done when all sets are settled and at least one was completed', () => {
    expect(exerciseStatus(ex(['done', 'done']))).toBe('done');
    expect(exerciseStatus(ex(['done', 'skip']))).toBe('done');
  });
  it('is skipped when all sets are settled and none completed', () => {
    expect(exerciseStatus(ex(['skip', 'skip']))).toBe('skipped');
  });
  it('treats an exercise without sets as todo', () => {
    expect(exerciseStatus(ex([]))).toBe('todo');
  });
});

describe('findNextTodo (zoekregel)', () => {
  const st = (s: string) =>
    s.split('').map(c => (c === 't' ? 'todo' : c === 'd' ? 'done' : 'skipped')) as ReturnType<typeof exerciseStatuses>;
  it('takes the first todo after the current one', () => {
    expect(findNextTodo(st('dttt'), 1)).toBe(2);
    expect(findNextTodo(st('dtst'), 1)).toBe(3);
  });
  it('falls back to the first todo before the current one', () => {
    expect(findNextTodo(st('tddd'), 2)).toBe(0);
    expect(findNextTodo(st('dtds'), 2)).toBe(1);
  });
  it('returns -1 when nothing is left to do', () => {
    expect(findNextTodo(st('dsd'), 1)).toBe(-1);
    expect(findNextTodo([], 0)).toBe(-1);
  });
  it('does not return the current exercise itself', () => {
    expect(findNextTodo(st('t'), 0)).toBe(-1);
  });
  it('from -1 returns the first todo', () => {
    expect(findNextTodo(st('dtt'), -1)).toBe(1);
  });
});

describe('primaryAction / primaryLabel', () => {
  it('logs a set while the current exercise has open sets', () => {
    expect(primaryAction({ finished: false, exerciseComplete: false, hasNext: true })).toBe('set');
    expect(primaryLabel('set')).toBe('Set klaar');
  });
  it('offers next exercise once all sets are logged', () => {
    expect(primaryAction({ finished: false, exerciseComplete: true, hasNext: true })).toBe('next');
    expect(primaryLabel('next')).toBe('Volgende oefening');
  });
  it('offers "Laatste oefening afronden" without a next exercise', () => {
    expect(primaryAction({ finished: false, exerciseComplete: true, hasNext: false })).toBe('last');
    expect(primaryLabel('last')).toBe('Laatste oefening afronden');
  });
  it('offers finishing the training in the klaar-toestand', () => {
    expect(primaryAction({ finished: true, exerciseComplete: false, hasNext: false })).toBe('finish');
    expect(primaryLabel('finish')).toBe('Training afronden');
  });
});

describe('activeSetIndex', () => {
  it('is the first unsettled set', () => {
    expect(activeSetIndex(ex(['done', 'skip', 'todo', 'todo']).sets)).toBe(2);
  });
  it('is -1 when everything is settled', () => {
    expect(activeSetIndex(ex(['done', 'done']).sets)).toBe(-1);
  });
});

describe('canAddSet / canRemoveLastSet', () => {
  it('allows adding up to MAX_SETS', () => {
    expect(canAddSet(ex(['todo', 'todo', 'todo']).sets)).toBe(true);
    expect(canAddSet(ex(Array<S>(MAX_SETS).fill('todo')).sets)).toBe(false);
  });
  it('counts a unilateral left/right pair as one set', () => {
    const pairs: WorkoutSet[] = Array.from({ length: MAX_SETS * 2 }, (_, i) =>
      set('todo', i + 1, i % 2 === 0 ? 'left' : 'right'),
    );
    expect(canAddSet(pairs)).toBe(false);
    expect(canAddSet(pairs.slice(0, 6))).toBe(true);
  });
  it('removes the last set only when it is not logged and more than one remains', () => {
    expect(canRemoveLastSet(ex(['done', 'todo']).sets)).toBe(true);
    expect(canRemoveLastSet(ex(['done', 'done']).sets)).toBe(false);
    expect(canRemoveLastSet(ex(['todo']).sets)).toBe(false);
  });
  it('refuses to drop a logged partner of a unilateral pair', () => {
    const sets = [set('todo', 1, 'left'), set('todo', 2, 'right'), set('done', 3, 'left'), set('todo', 4, 'right')];
    expect(canRemoveLastSet(sets)).toBe(false);
    expect(canRemoveLastSet(sets.slice(0, 2).concat([set('todo', 3, 'left'), set('todo', 4, 'right')]))).toBe(true);
  });
});

describe('skipRemainingSets / restoreSkippedSets', () => {
  it('skips only unsettled sets and keeps logged ones', () => {
    const next = skipRemainingSets(ex(['done', 'todo', 'todo']).sets);
    expect(next.map(s => [s.completed, s.skipped])).toEqual([[true, false], [false, true], [false, true]]);
  });
  it('restore unskips sets that were not performed', () => {
    const skipped = skipRemainingSets(ex(['todo', 'todo']).sets);
    const back = restoreSkippedSets(skipped);
    expect(back.every(s => !s.skipped && !s.completed)).toBe(true);
    expect(exerciseStatus({ ...ex([]), sets: back })).toBe('todo');
  });
  it('does not mutate its input', () => {
    const sets = ex(['todo']).sets;
    skipRemainingSets(sets);
    expect(sets[0]!.skipped).toBe(false);
  });
});

describe('afterSetLogged (supersets + rest)', () => {
  it('a solo exercise stays focused and rests', () => {
    const exs = [ex(['todo', 'todo']), ex(['todo'])];
    expect(afterSetLogged(exs, 0, 0)).toEqual({ focusIdx: 0, rest: true });
  });
  it('mid-round hands off to the next member without rest', () => {
    const exs = [ex(['todo', 'todo'], 'g'), ex(['todo', 'todo'], 'g')];
    expect(afterSetLogged(exs, 0, 0)).toEqual({ focusIdx: 1, rest: false });
  });
  it('end of round rests and returns to the first member with open sets', () => {
    const exs = [ex(['done', 'todo'], 'g'), ex(['todo', 'todo'], 'g')];
    expect(afterSetLogged(exs, 1, 0)).toEqual({ focusIdx: 0, rest: true });
  });
  it('skips members that have no open sets left', () => {
    const exs = [ex(['done'], 'g'), ex(['todo', 'todo'], 'g'), ex(['todo', 'todo'], 'g')];
    // A has no open sets, B logs, C is next
    expect(afterSetLogged(exs, 1, 0)).toEqual({ focusIdx: 2, rest: false });
    // C logs, round ends: A is done, so B
    expect(afterSetLogged(exs, 2, 0)).toEqual({ focusIdx: 1, rest: true });
  });
  it('stays on the last open member when the group is otherwise finished', () => {
    const exs = [ex(['done'], 'g'), ex(['todo'], 'g')];
    expect(afterSetLogged(exs, 1, 0)).toEqual({ focusIdx: 1, rest: true });
  });
});

describe('focusAfterInsert', () => {
  it('focuses the new exercise when the current one is complete', () => {
    expect(focusAfterInsert([ex(['done', 'done']), ex(['todo'])], 0, 1)).toBe(1);
  });
  it('focuses the new exercise in the klaar-toestand (cur -1)', () => {
    expect(focusAfterInsert([ex(['done'])], -1, 1)).toBe(1);
  });
  it('focuses the new exercise when the current one has not been started', () => {
    expect(focusAfterInsert([ex(['todo']), ex(['todo'])], 0, 0)).toBe(0);
  });
  it('keeps (and shifts) a started, unfinished current exercise', () => {
    expect(focusAfterInsert([ex(['done', 'todo']), ex(['todo'])], 0, 1)).toBe(0);
    expect(focusAfterInsert([ex(['todo']), ex(['done', 'todo'])], 1, 0)).toBe(2);
  });
});

describe('initialSetValues', () => {
  const prev = [{ weight: 100, reps: 8 }, { weight: 100, reps: 7 }];
  it('prefers the last logged set of this session', () => {
    const sets = [set('done', 1), set('todo', 2)];
    sets[0] = { ...sets[0]!, weight: 62.5, actualReps: 9 };
    expect(initialSetValues(sets, prev)).toEqual({ weight: 62.5, reps: 9 });
  });
  it('else the active set plan, then the previous session', () => {
    const planned = [{ ...set('todo', 1), plannedWeight: 40 }];
    expect(initialSetValues(planned, prev)).toEqual({ weight: 40, reps: 10 });
    expect(initialSetValues([{ ...set('todo', 1), plannedReps: null }], prev)).toEqual({ weight: 100, reps: 8 });
  });
  it('uses the stored weight of the active set first', () => {
    const sets = [{ ...set('todo', 1), weight: 55 }];
    expect(initialSetValues(sets, prev).weight).toBe(55);
  });
  it('leaves values empty when nothing is known', () => {
    expect(initialSetValues([{ ...set('todo', 1), plannedReps: null }], [])).toEqual({ weight: null, reps: null });
  });
});

describe('formatPrevLine', () => {
  it('collapses an equal weight into "kg × reps · reps"', () => {
    expect(formatPrevLine([{ weight: 140, reps: 8 }, { weight: 140, reps: 8 }, { weight: 140, reps: 7 }])).toBe('140 × 8 · 8 · 7');
  });
  it('lists each set when weights differ', () => {
    expect(formatPrevLine([{ weight: 100, reps: 8 }, { weight: 90, reps: 10 }])).toBe('100 × 8 · 90 × 10');
  });
  it('uses a decimal comma', () => {
    expect(formatPrevLine([{ weight: 62.5, reps: 10 }])).toBe('62,5 × 10');
  });
  it('is empty without sets', () => {
    expect(formatPrevLine([])).toBe('');
  });
});

describe('number parsing for the steppers', () => {
  it('parses comma and dot, rejects junk and negatives', () => {
    expect(parseDecimal('62,5')).toBe(62.5);
    expect(parseDecimal('62.5')).toBe(62.5);
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal('-3')).toBeNull();
    expect(parseDecimal('0')).toBe(0);
  });
  it('formats with a decimal comma', () => {
    expect(formatDecimal(62.5)).toBe('62,5');
    expect(formatDecimal(null)).toBe('');
  });
});
