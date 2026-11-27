import { describe, expect, it } from 'vitest';
import type { WorkoutSet } from '../../../db/index';
import {
  canRemoveOpenSet,
  doneListScrollToBottom,
  doneRows,
  formatRestClock,
  isUnilateral,
  logicalSetNumber,
  nextOpenSetIndex,
  openSetIndex,
  openSetValues,
  restRingFraction,
  restRingLabel,
  restTimerLabel,
  pairDelta,
  restRingIdleLabel,
  restRingIdleText,
  setDelta,
  setDots,
  setProgress,
  sideDots,
  zigzagLayout,
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
    expect(restRingLabel(72, true)).toBe('Rust, nog 1 minuut 12. Tik om de rust in te stellen');
    expect(restRingLabel(150, true)).toBe('Rust, nog 2 minuten 30. Tik om de rust in te stellen');
    expect(restRingLabel(45, true)).toBe('Rust, nog 45 seconden. Tik om de rust in te stellen');
    expect(restRingLabel(120, true)).toBe('Rust, nog 2 minuten. Tik om de rust in te stellen');
  });
  it('labels the idle ring as opening the rest bar', () => {
    expect(restRingLabel(90, false)).toBe('Rust 1 minuut 30. Tik om de rust in te stellen');
  });
  it('keeps the timer label format', () => {
    expect(restTimerLabel(72)).toBe('Rust nog 1 minuut 12 seconden');
    expect(restTimerLabel(130)).toBe('Rust nog 2 minuten 10 seconden');
  });
});

// --- D1U: unilateral set registration (zigzag L1 → R1 → L2 → R2) ---

const L = (state: S, n: number, extra: Partial<WorkoutSet> = {}) => set(state, n, { side: 'left', ...extra });
const R = (state: S, n: number, extra: Partial<WorkoutSet> = {}) => set(state, n, { side: 'right', ...extra });

describe('isUnilateral', () => {
  it('is true when the sets are logged per side', () => {
    expect(isUnilateral(pairs('todo'))).toBe(true);
    expect(isUnilateral(sets('todo', 'todo'))).toBe(false);
    expect(isUnilateral([])).toBe(false);
  });
});

describe('sideDots', () => {
  it('one dot per part in zigzag order, numbered by set, with the side', () => {
    const dots = sideDots([L('done', 1), R('todo', 2), L('todo', 3), R('todo', 4)], 1);
    expect(dots.map(d => d.index)).toEqual([0, 1, 2, 3]);
    expect(dots.map(d => d.number)).toEqual([1, 1, 2, 2]);
    expect(dots.map(d => d.side)).toEqual(['left', 'right', 'left', 'right']);
    expect(dots.map(d => d.state)).toEqual(['done', 'open', 'todo', 'todo']);
    expect(dots.map(d => d.pressed)).toEqual([false, true, false, false]);
  });
  it('the line starting at a part is accent when that part is done', () => {
    const dots = sideDots([L('done', 1), R('done', 2), L('todo', 3), R('todo', 4)], 2);
    expect(dots.map(d => d.lineOn)).toEqual([true, true, false, false]);
  });
  it('aria-labels as in the design', () => {
    const dots = sideDots([L('done', 1), R('todo', 2), L('skip', 3), R('skip', 4)], 1);
    expect(dots.map(d => d.ariaLabel)).toEqual([
      'Set 1 links (klaar), aanpassen',
      'Set 1 rechts',
      'Set 2 links (overgeslagen)',
      'Set 2 rechts (overgeslagen)',
    ]);
  });
  it('an opened done part shows as open (adjusting it)', () => {
    expect(sideDots([L('done', 1), R('todo', 2)], 0)[0]!.state).toBe('open');
  });
});

describe('zigzagLayout', () => {
  it('fixed step 46 from a 24 px gutter, rows at y 16 / 46 (DESIGN §4 schuifrij)', () => {
    const l = zigzagLayout(6);
    expect(l.step).toBe(46);
    expect(l.points[0]).toEqual({ x: 24 + 23, y: 16 });
    expect(l.points[1]).toEqual({ x: 24 + 46 + 23, y: 46 });
    // the plus slot sits on the top row after the last right part
    expect(l.points).toHaveLength(7);
    expect(l.points[6]!.y).toBe(16);
    expect(l.width).toBe(24 + 7 * 46);
  });
  it('does not shrink with many sets: the row scrolls instead', () => {
    const l = zigzagLayout(40);
    expect(l.step).toBe(46);
    expect(l.width).toBe(24 + 41 * 46);
    // horizontal neighbours' 44 px tap targets do not overlap
    expect(l.points[2]!.x - l.points[0]!.x).toBeGreaterThanOrEqual(44);
  });
  it('a line between each pair of neighbouring centres', () => {
    const l = zigzagLayout(2);
    expect(l.lines).toHaveLength(2);
    expect(l.lines[0]!.x).toBe(l.points[0]!.x);
    expect(l.lines[0]!.y).toBe(16);
    expect(l.lines[0]!.length).toBeCloseTo(Math.hypot(46, 30));
    expect(l.lines[0]!.angle).toBeCloseTo((Math.atan2(30, 46) * 180) / Math.PI);
    expect(l.lines[1]!.angle).toBeCloseTo((Math.atan2(-30, 46) * 180) / Math.PI);
  });
});

describe('doneRows lists every logged set, oldest first (owner decision, not the last 3 of DESIGN §5)', () => {
  it('all 12 logged sets of 13, Set 1 at the top and the newest at the bottom', () => {
    const s = Array.from({ length: 13 }, (_, i) => set(i < 12 ? 'done' : 'todo', i + 1, { weight: 50, actualReps: 8 }));
    const rows = doneRows(s, []);
    expect(rows.map(r => r.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(rows[0]!.label).toBe('Set 1 · 50 kg × 8');
    expect(rows[11]!.label).toBe('Set 12 · 50 kg × 8');
  });
});

describe('doneListScrollToBottom', () => {
  it('on opening an exercise (first render or another exercise)', () => {
    expect(doneListScrollToBottom(null, { exercise: 0, count: 3 })).toBe(true);
    expect(doneListScrollToBottom({ exercise: 0, count: 3 }, { exercise: 1, count: 3 })).toBe(true);
  });
  it('when a new set is logged', () => {
    expect(doneListScrollToBottom({ exercise: 0, count: 3 }, { exercise: 0, count: 4 })).toBe(true);
  });
  it('not on unrelated updates (an edit, undo, or nothing changed), so a user scrolled up stays put', () => {
    expect(doneListScrollToBottom({ exercise: 0, count: 3 }, { exercise: 0, count: 3 })).toBe(false);
    expect(doneListScrollToBottom({ exercise: 0, count: 3 }, { exercise: 0, count: 2 })).toBe(false);
  });
});

describe('pairDelta (decision on DESIGN §12 q10: sum of left + right)', () => {
  const prev = { left: { weight: 20, reps: 12 }, right: { weight: 20, reps: 12 } };
  it('same weight: the reps difference of left + right summed', () => {
    expect(pairDelta({ left: { weight: 20, reps: 13 }, right: { weight: 20, reps: 13 } }, prev)).toEqual({ kind: 'up', text: '↑ +2' });
    expect(pairDelta({ left: { weight: 20, reps: 12 }, right: { weight: 20, reps: 12 } }, prev)).toEqual({ kind: 'same', text: 'gelijk' });
    expect(pairDelta({ left: { weight: 20, reps: 12 }, right: { weight: 20, reps: 11 } }, prev)).toEqual({ kind: 'down', text: '↓ 1' });
    expect(pairDelta({ left: { weight: 20, reps: 13 }, right: { weight: 20, reps: 11 } }, prev)).toEqual({ kind: 'same', text: 'gelijk' });
  });
  it('another weight: the kg difference', () => {
    expect(pairDelta({ left: { weight: 22.5, reps: 8 }, right: { weight: 22.5, reps: 8 } }, prev)).toEqual({ kind: 'up', text: '↑ +2,5 kg' });
    expect(pairDelta({ left: { weight: 17.5, reps: 8 }, right: { weight: 17.5, reps: 8 } }, prev)).toEqual({ kind: 'down', text: '↓ 2,5 kg' });
  });
  it('"nieuw" without a full previous set', () => {
    expect(pairDelta({ left: { weight: 20, reps: 12 }, right: { weight: 20, reps: 12 } }, undefined)).toEqual({ kind: 'new', text: 'nieuw' });
  });
});

describe('doneRows (unilateral)', () => {
  const prev = [
    { weight: 20, reps: 12, side: 'left' as const },
    { weight: 20, reps: 12, side: 'right' as const },
    { weight: 20, reps: 11, side: 'left' as const },
    { weight: 20, reps: 11, side: 'right' as const },
  ];
  it('one row per set whose left and right parts are both done; a half set is not listed', () => {
    const s = [
      L('done', 1, { weight: 20, actualReps: 12 }),
      R('done', 2, { weight: 20, actualReps: 12 }),
      L('done', 3, { weight: 20, actualReps: 12 }),
      R('todo', 4),
    ];
    const rows = doneRows(s, prev);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.label).toBe('Set 1 · 20 kg · L 12 · R 12');
    expect(rows[0]!.delta.text).toBe('gelijk');
    // tapping the row opens the left part (design: sel = i × 2)
    expect(rows[0]!.index).toBe(0);
    expect(rows[0]!.ariaLabel).toBe('Set 1 · 20 kg · L 12 · R 12, gelijk, aanpassen');
  });
  it('compares with the same set last time', () => {
    const s = [
      L('done', 1, { weight: 20, actualReps: 12 }),
      R('done', 2, { weight: 20, actualReps: 12 }),
      L('done', 3, { weight: 20, actualReps: 12 }),
      R('done', 4, { weight: 20, actualReps: 12 }),
      L('done', 5, { weight: 20, actualReps: 10 }),
      R('done', 6, { weight: 20, actualReps: 10 }),
    ];
    expect(doneRows(s, prev).map(r => r.delta.text)).toEqual(['gelijk', '↑ +2', 'nieuw']);
  });
  it('shows the weight per side when the sides differ', () => {
    const s = [L('done', 1, { weight: 20, actualReps: 12 }), R('done', 2, { weight: 22.5, actualReps: 10 })];
    expect(doneRows(s, [])[0]!.label).toBe('Set 1 · L 20 kg × 12 · R 22,5 kg × 10');
  });
});

describe('openSetValues (unilateral)', () => {
  it('after the left part, the right part of the same set gets the same reps (and weight)', () => {
    const s = [L('done', 1, { weight: 20, actualReps: 12 }), R('todo', 2), L('todo', 3), R('todo', 4)];
    expect(openSetValues(s, 1, [])).toEqual({ weight: 20, reps: 12 });
  });
  it('the partner wins over a later logged part', () => {
    const s = [
      L('done', 1, { weight: 20, actualReps: 12 }),
      R('todo', 2),
      L('done', 3, { weight: 22.5, actualReps: 8 }),
      R('todo', 4),
    ];
    expect(openSetValues(s, 1, [])).toEqual({ weight: 20, reps: 12 });
  });
  it('the next set takes over the values of the part just done', () => {
    const s = [L('done', 1, { weight: 20, actualReps: 12 }), R('done', 2, { weight: 20, actualReps: 11 }), L('todo', 3), R('todo', 4)];
    expect(openSetValues(s, 2, [])).toEqual({ weight: 20, reps: 11 });
  });
});

describe('rest ring idle (unilateral)', () => {
  it('shows "na R" while no rest runs on a unilateral exercise', () => {
    expect(restRingIdleText(90, false, true)).toBe('na R');
    expect(restRingIdleText(90, false, false)).toBe('1:30');
  });
  it('shows 0:00 right after a rest ran out', () => {
    expect(restRingIdleText(90, true, true)).toBe('0:00');
    expect(restRingIdleText(90, true, false)).toBe('0:00');
  });
  it('says the rest follows after the right side', () => {
    expect(restRingIdleLabel(90, true)).toBe('Rust volgt na rechts (1 minuut 30). Tik om de rust in te stellen');
    expect(restRingIdleLabel(90, false)).toBe(restRingLabel(90, false));
  });
});

describe('setProgress', () => {
  it('counts sets; a unilateral set once and only when both sides are logged', () => {
    expect(setProgress(sets('done', 'todo', 'todo'))).toEqual({ done: 1, total: 3 });
    expect(setProgress([L('done', 1), R('done', 2), L('done', 3), R('todo', 4), L('todo', 5), R('todo', 6)])).toEqual({ done: 1, total: 3 });
  });
});
