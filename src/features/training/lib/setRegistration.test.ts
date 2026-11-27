import { describe, expect, it } from 'vitest';
import type { WorkoutSet } from '../../../db/index';
import {
  canRemoveOpenSet,
  doneRows,
  formatRestClock,
  logicalSetNumber,
  nextOpenSetIndex,
  openSetIndex,
  openSetValues,
  restRingFraction,
  restRingLabel,
  restTimerLabel,
  setDelta,
  setDots,
} from './setRegistration';

type S = 'todo' | 'done' | 'skip';

function set(state: S, n: number, extra: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    exerciseId: 'e',
    setNumber: n,
    plannedReps: 10,
    actualReps: state === 'done' ? 8 : null,
    weight: state === 'done' ? 50 : null,
    completed: state === 'done',
    skipped: state === 'skip',
    ...extra,
  };
}

const sets = (...states: S[]) => states.map((s, i) => set(s, i + 1));
const pairs = (...states: S[]) =>
  states.flatMap((s, i) => [set(s, i * 2 + 1, { side: 'left' }), set(s, i * 2 + 2, { side: 'right' })]);

describe('openSetIndex', () => {
  it('defaults to the first open set', () => {
    expect(openSetIndex(sets('done', 'todo', 'todo'), null)).toBe(1);
  });
  it('uses the selected set while it exists', () => {
    expect(openSetIndex(sets('done', 'todo', 'todo'), 0)).toBe(0);
    expect(openSetIndex(sets('done', 'todo', 'todo'), 2)).toBe(2);
  });
  it('falls back when the selection is out of range (e.g. a set being added)', () => {
    expect(openSetIndex(sets('done', 'todo'), 5)).toBe(1);
  });
  it('is -1 when every set is settled and nothing is selected', () => {
    expect(openSetIndex(sets('done', 'skip'), null)).toBe(-1);
  });
});

describe('nextOpenSetIndex', () => {
  it('is the first open set after the logged one', () => {
    expect(nextOpenSetIndex(sets('todo', 'todo', 'todo'), 0)).toBe(1);
  });
  it('wraps to an earlier open set when the later ones are settled', () => {
    expect(nextOpenSetIndex(sets('todo', 'done', 'todo'), 2)).toBe(0);
  });
  it('is -1 when the logged set was the last open one', () => {
    expect(nextOpenSetIndex(sets('done', 'done', 'todo'), 2)).toBe(-1);
  });
});

describe('logicalSetNumber', () => {
  it('counts a left/right pair as one set', () => {
    const s = pairs('todo', 'todo');
    expect(s.map((_, i) => logicalSetNumber(s, i))).toEqual([1, 1, 2, 2]);
  });
});

describe('setDots', () => {
  it('marks done, open and coming sets, and colours the line after a done set', () => {
    const dots = setDots(sets('done', 'done', 'todo', 'todo'), 2);
    expect(dots.map(d => d.state)).toEqual(['done', 'done', 'open', 'todo']);
    expect(dots.map(d => d.lineOn)).toEqual([false, true, true, false]);
    expect(dots.map(d => d.pressed)).toEqual([false, false, true, false]);
  });
  it('an opened done set shows as open, its aria-label says it can be adjusted', () => {
    const dots = setDots(sets('done', 'todo'), 0);
    expect(dots[0]!.state).toBe('open');
    expect(dots[0]!.ariaLabel).toBe('Set 1 (klaar), aanpassen');
    expect(dots[1]!.ariaLabel).toBe('Set 2');
    // the line still follows the done state, not the opened state
    expect(dots[1]!.lineOn).toBe(true);
  });
  it('labels a skipped set', () => {
    expect(setDots(sets('skip', 'todo'), 1)[0]!.ariaLabel).toBe('Set 1 (overgeslagen)');
    expect(setDots(sets('skip', 'todo'), 1)[0]!.state).toBe('todo');
  });
  it('shows one dot per left/right pair and opens its first open side', () => {
    const s = [set('done', 1, { side: 'left' }), set('todo', 2, { side: 'right' }), ...pairs('todo').map(x => ({ ...x }))];
    const dots = setDots(s, 1);
    expect(dots).toHaveLength(2);
    expect(dots[0]).toMatchObject({ number: 1, state: 'open', target: 1 });
    expect(dots[1]).toMatchObject({ number: 2, state: 'todo', target: 2 });
  });
  it('a pair is only done when both sides are logged', () => {
    const s = [set('done', 1, { side: 'left' }), set('todo', 2, { side: 'right' })];
    expect(setDots(s, -1)[0]!.state).toBe('todo');
  });
});

describe('setDelta', () => {
  it('compares reps at the same weight', () => {
    expect(setDelta({ weight: 140, reps: 9 }, { weight: 140, reps: 8 })).toEqual({ kind: 'up', text: '↑ +1' });
    expect(setDelta({ weight: 140, reps: 8 }, { weight: 140, reps: 8 })).toEqual({ kind: 'same', text: 'gelijk' });
    expect(setDelta({ weight: 140, reps: 6 }, { weight: 140, reps: 8 })).toEqual({ kind: 'down', text: '↓ 2' });
  });
  it('compares kg when the weight differs', () => {
    expect(setDelta({ weight: 142.5, reps: 6 }, { weight: 140, reps: 8 })).toEqual({ kind: 'up', text: '↑ +2,5 kg' });
    expect(setDelta({ weight: 137.5, reps: 10 }, { weight: 140, reps: 8 })).toEqual({ kind: 'down', text: '↓ 2,5 kg' });
  });
  it('ignores float noise in the weight', () => {
    expect(setDelta({ weight: 0.1 + 0.2, reps: 8 }, { weight: 0.3, reps: 8 }).kind).toBe('same');
  });
  it('is "nieuw" without a matching previous set', () => {
    expect(setDelta({ weight: 140, reps: 8 }, undefined)).toEqual({ kind: 'new', text: 'nieuw' });
  });
});

describe('doneRows', () => {
  it('lists completed sets with the difference to the same set last time', () => {
    const s = [
      set('done', 1, { weight: 140, actualReps: 8 }),
      set('done', 2, { weight: 140, actualReps: 9 }),
      set('todo', 3),
      set('done', 4, { weight: 0, actualReps: 12 }),
    ];
    const rows = doneRows(s, [{ weight: 140, reps: 8 }, { weight: 140, reps: 8 }]);
    expect(rows.map(r => r.index)).toEqual([0, 1, 3]);
    expect(rows.map(r => r.label)).toEqual(['Set 1 · 140 kg × 8', 'Set 2 · 140 kg × 9', 'Set 4 · 0 kg × 12']);
    expect(rows.map(r => r.delta.text)).toEqual(['gelijk', '↑ +1', 'nieuw']);
    expect(rows[1]!.ariaLabel).toBe('Set 2 · 140 kg × 9, ↑ +1, aanpassen');
  });
  it('names the side of a unilateral set and compares per side', () => {
    const s = [set('done', 1, { side: 'left', weight: 20, actualReps: 10 }), set('done', 2, { side: 'right', weight: 20, actualReps: 9 })];
    const rows = doneRows(s, [{ weight: 20, reps: 10 }, { weight: 20, reps: 10 }]);
    expect(rows.map(r => r.label)).toEqual(['Set 1 links · 20 kg × 10', 'Set 1 rechts · 20 kg × 9']);
    expect(rows.map(r => r.delta.text)).toEqual(['gelijk', '↓ 1']);
  });
  it('treats a set without weight as 0 kg', () => {
    const s = [set('done', 1, { weight: null, actualReps: 8 })];
    expect(doneRows(s, [])[0]!.label).toBe('Set 1 · 0 kg × 8');
  });
});

describe('openSetValues', () => {
  it('shows the stored values of an opened done set', () => {
    const s = [set('done', 1, { weight: 60, actualReps: 9 }), set('done', 2, { weight: 62.5, actualReps: 7 }), set('todo', 3)];
    expect(openSetValues(s, 0, [])).toEqual({ weight: 60, reps: 9 });
  });
  it('an open set gets the values of the last logged set', () => {
    const s = [set('done', 1, { weight: 60, actualReps: 9 }), set('todo', 2), set('todo', 3)];
    expect(openSetValues(s, 2, [{ weight: 50, reps: 5 }])).toEqual({ weight: 60, reps: 9 });
  });
  it('before anything is logged: own value, then plan, then the same set last time', () => {
    const s = [set('todo', 1, { plannedReps: null }), set('todo', 2, { plannedReps: null })];
    expect(openSetValues(s, 1, [{ weight: 50, reps: 5 }, { weight: 55, reps: 4 }])).toEqual({ weight: 55, reps: 4 });
    const planned = [set('todo', 1, { plannedWeight: 40, plannedReps: 12 })];
    expect(openSetValues(planned, 0, [{ weight: 50, reps: 5 }])).toEqual({ weight: 40, reps: 12 });
  });
  it('a set that was put back keeps its own values', () => {
    const s = [set('todo', 1, { weight: 60, actualReps: 9 }), set('todo', 2), set('done', 3, { weight: 70, actualReps: 5 })];
    expect(openSetValues(s, 0, [])).toEqual({ weight: 60, reps: 9 });
  });
  it('is empty without any source', () => {
    expect(openSetValues([set('todo', 1, { plannedReps: null })], 0, [])).toEqual({ weight: null, reps: null });
  });
});

describe('canRemoveOpenSet', () => {
  it('only for the opened last set while it is not logged', () => {
    expect(canRemoveOpenSet(sets('done', 'todo', 'todo'), 2)).toBe(true);
    expect(canRemoveOpenSet(sets('done', 'todo', 'todo'), 1)).toBe(false);
    expect(canRemoveOpenSet(sets('todo', 'done'), 1)).toBe(false);
  });
  it('never the only set', () => {
    expect(canRemoveOpenSet(sets('todo'), 0)).toBe(false);
  });
  it('a unilateral pair counts as the last set, from either side, while neither side is logged', () => {
    const s = pairs('todo', 'todo');
    expect(canRemoveOpenSet(s, 2)).toBe(true);
    expect(canRemoveOpenSet(s, 3)).toBe(true);
    expect(canRemoveOpenSet(s, 1)).toBe(false);
    const half = [...pairs('todo'), set('done', 3, { side: 'left' }), set('todo', 4, { side: 'right' })];
    expect(canRemoveOpenSet(half, 3)).toBe(false);
  });
});

describe('rest ring', () => {
  it('fraction of the rest that is left, clamped', () => {
    expect(restRingFraction(45, 90)).toBe(0.5);
    expect(restRingFraction(120, 90)).toBe(1);
    expect(restRingFraction(-3, 90)).toBe(0);
    expect(restRingFraction(10, 0)).toBe(0);
  });
  it('formats the clock', () => {
    expect(formatRestClock(72)).toBe('1:12');
    expect(formatRestClock(5)).toBe('0:05');
    expect(formatRestClock(0)).toBe('0:00');
  });
  it('labels the running ring as in the design', () => {
    expect(restRingLabel(72, true)).toBe('Rust, nog 1 minuut 12. Tik voor 30 seconden extra');
    expect(restRingLabel(150, true)).toBe('Rust, nog 2 minuten 30. Tik voor 30 seconden extra');
    expect(restRingLabel(45, true)).toBe('Rust, nog 45 seconden. Tik voor 30 seconden extra');
    expect(restRingLabel(120, true)).toBe('Rust, nog 2 minuten. Tik voor 30 seconden extra');
  });
  it('labels the idle ring as a start button', () => {
    expect(restRingLabel(90, false)).toBe('Rust 1 minuut 30. Tik om de rust te starten');
  });
  it('keeps the timer label format', () => {
    expect(restTimerLabel(72)).toBe('Rust nog 1 minuut 12 seconden');
    expect(restTimerLabel(130)).toBe('Rust nog 2 minuten 10 seconden');
  });
});
