import { describe, expect, it } from 'vitest';
import type { WorkoutExercise, WorkoutSet } from '../../../db/index';
import { groupSupersets } from './superset';
import { afterSetLogged } from './liveTraining';
import { openSetValues, restRingIdleLabel, restRingIdleText, zigzagTrack } from './setRegistration';
import {
  appendRound,
  firstOpenPart,
  isSupersetPair,
  roundCount,
  roundDelta,
  roundHasB,
  supersetDoneRows,
  supersetDots,
} from './supersetRegistration';

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
const ex = (exerciseId: string, list: WorkoutSet[], supersetGroup?: string): WorkoutExercise =>
  ({ exerciseId, sets: list, notes: '', ...(supersetGroup ? { supersetGroup } : {}) }) as WorkoutExercise;

describe('isSupersetPair', () => {
  it('only a superset of exactly two members without per-side sets', () => {
    const pair = [ex('a', sets('todo'), 'g'), ex('b', sets('todo'), 'g'), ex('c', sets('todo'))];
    expect(isSupersetPair(groupSupersets(pair)[0], pair)).toBe(true);
    expect(isSupersetPair(groupSupersets(pair)[1], pair)).toBe(true);
    expect(isSupersetPair(groupSupersets(pair)[2], pair)).toBe(false);

    const tri = [ex('a', sets('todo'), 'g'), ex('b', sets('todo'), 'g'), ex('c', sets('todo'), 'g')];
    expect(isSupersetPair(groupSupersets(tri)[0], tri)).toBe(false);

    const uni = [ex('a', [set('todo', 1, { side: 'left' }), set('todo', 2, { side: 'right' })], 'g'), ex('b', sets('todo'), 'g')];
    expect(isSupersetPair(groupSupersets(uni)[1], uni)).toBe(false);
  });
});

describe('firstOpenPart (default opened part, zigzag order A1 → B1 → A2 …)', () => {
  it('starts at A1, then B1, then A2', () => {
    expect(firstOpenPart(sets('todo', 'todo'), sets('todo', 'todo'))).toEqual({ member: 0, setIdx: 0 });
    expect(firstOpenPart(sets('done', 'todo'), sets('todo', 'todo'))).toEqual({ member: 1, setIdx: 0 });
    expect(firstOpenPart(sets('done', 'todo'), sets('done', 'todo'))).toEqual({ member: 0, setIdx: 1 });
  });
  it('skips empty slots and skipped parts; null when all is settled', () => {
    expect(firstOpenPart(sets('done'), sets('done', 'todo'))).toEqual({ member: 1, setIdx: 1 });
    expect(firstOpenPart(sets('skip', 'todo'), sets('done', 'todo'))).toEqual({ member: 0, setIdx: 1 });
    expect(firstOpenPart(sets('done'), sets('done', 'skip'))).toBeNull();
  });
});

describe('roundCount / roundHasB', () => {
  it('rounds = the longest set list; a shorter B has no part in later rounds', () => {
    expect(roundCount(sets('todo'), sets('todo', 'todo', 'todo'))).toBe(3);
    expect(roundHasB(sets('todo'), 0)).toBe(true);
    expect(roundHasB(sets('todo'), 1)).toBe(false);
  });
});

describe('supersetDots', () => {
  it('one dot per existing part in zigzag order, round number, slot 2r + member', () => {
    const d = supersetDots(sets('done', 'todo'), sets('done', 'todo'), { member: 0, setIdx: 1 });
    expect(d.map(x => `${x.part}${x.number}:${x.slot}:${x.state}`)).toEqual([
      'A1:0:done',
      'B1:1:done',
      'A2:2:open',
      'B2:3:todo',
    ]);
    expect(d[2]!.pressed).toBe(true);
    expect(d[0]!.lineOn).toBe(true);
    expect(d[2]!.lineOn).toBe(false);
  });
  it('aria labels name the set and the part', () => {
    const d = supersetDots(sets('done', 'skip'), sets('todo'), null);
    expect(d.map(x => x.ariaLabel)).toEqual(['Set 1 van A (klaar), aanpassen', 'Set 1 van B', 'Set 2 van A (overgeslagen)']);
  });
  it('an empty slot (member with fewer sets) gets no dot', () => {
    const d = supersetDots(sets('todo', 'todo', 'todo'), sets('todo'), null);
    expect(d.map(x => x.slot)).toEqual([0, 1, 2, 4]);
  });
});

describe('zigzagTrack (skips empty slots)', () => {
  it('lines connect the listed slots in order; width ends after the last (plus) slot', () => {
    const t = zigzagTrack([0, 1, 2, 4, 6]);
    expect(t.points.map(p => p.y)).toEqual([16, 46, 16, 16, 16]);
    expect(t.lines).toHaveLength(4);
    // A2 → A3 runs straight along the top row over the empty B2 slot
    expect(t.lines[2]!.angle).toBe(0);
    expect(t.lines[2]!.length).toBe(2 * 46);
    expect(t.width).toBe(24 + 7 * 46);
  });
});

describe('roundDelta (DESIGN §6 Supersets)', () => {
  const r = (weight: number, reps: number) => ({ weight, reps });
  it('same weights: the reps differences of A and B summed', () => {
    expect(roundDelta([r(140, 9), r(45, 14)], [r(140, 8), r(45, 12)])).toEqual({ kind: 'up', text: '↑ +3' });
    expect(roundDelta([r(140, 8), r(45, 12)], [r(140, 8), r(45, 12)])).toEqual({ kind: 'same', text: 'gelijk' });
    expect(roundDelta([r(140, 7), r(45, 12)], [r(140, 8), r(45, 12)])).toEqual({ kind: 'down', text: '↓ 1' });
  });
  it('a weight differs: the kg difference of the differing parts', () => {
    expect(roundDelta([r(142.5, 6), r(45, 20)], [r(140, 8), r(45, 12)])).toEqual({ kind: 'up', text: '↑ +2,5 kg' });
    expect(roundDelta([r(137.5, 8), r(47.5, 12)], [r(140, 8), r(45, 12)])).toEqual({ kind: 'same', text: 'gelijk' });
    expect(roundDelta([r(135, 8), r(45, 12)], [r(140, 8), r(45, 12)])).toEqual({ kind: 'down', text: '↓ 5 kg' });
  });
  it('nieuw without that round last time; missing parts are left out', () => {
    expect(roundDelta([r(140, 8), r(45, 12)], [r(140, 8), undefined])).toEqual({ kind: 'new', text: 'nieuw' });
    expect(roundDelta([r(140, 9), undefined], [r(140, 8), r(45, 12)])).toEqual({ kind: 'up', text: '↑ +1' });
  });
});

describe('supersetDoneRows', () => {
  const done = (weight: number, reps: number, n = 1) => set('done', n, { weight, actualReps: reps });
  it('one row per round with A and B logged, "Set 1 · 140 × 8 · 45 × 12"; a half round is not listed', () => {
    const rows = supersetDoneRows(
      [done(140, 8), done(140, 9, 2), set('todo', 3)],
      [done(45, 12), set('todo', 2), set('todo', 3)],
      [{ weight: 140, reps: 8 }],
      [{ weight: 45, reps: 10 }],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.label).toBe('Set 1 · 140 × 8 · 45 × 12');
    expect(rows[0]!.delta).toEqual({ kind: 'up', text: '↑ +2' });
    expect(rows[0]!.ariaLabel).toBe('Set 1 · 140 × 8 · 45 × 12, ↑ +2, aanpassen');
    expect(rows[0]!.open).toEqual({ member: 0, setIdx: 0 });
  });
  it('an empty slot or skipped part shows as —; the row opens the logged part', () => {
    const rows = supersetDoneRows([done(140, 8)], [done(45, 12), done(45, 11, 2)], [], []);
    expect(rows.map(x => x.label)).toEqual(['Set 1 · 140 × 8 · 45 × 12', 'Set 2 · — · 45 × 11']);
    expect(rows[1]!.open).toEqual({ member: 1, setIdx: 1 });
    expect(rows[1]!.delta.text).toBe('nieuw');
    expect(supersetDoneRows([set('skip', 1)], [set('skip', 1)], [], [])).toEqual([]);
  });
  it('a set without weight counts as 0 kg', () => {
    const rows = supersetDoneRows([set('done', 1, { weight: null, actualReps: 10 })], [done(45, 12)], [], []);
    expect(rows[0]!.label).toBe('Set 1 · 0 × 10 · 45 × 12');
  });
});

describe('appendRound (plus dot)', () => {
  it('adds a set to both members with the values of their own last set', () => {
    const [a, b] = appendRound(
      [set('done', 1, { weight: 140, actualReps: 8, plannedReps: 8 })],
      [set('done', 1, { weight: 45, actualReps: 12, plannedReps: 12 })],
      ['a', 'b'],
    );
    expect(a).toHaveLength(2);
    expect(b).toHaveLength(2);
    expect(a[1]).toMatchObject({ exerciseId: 'a', setNumber: 2, weight: 140, plannedReps: 8, completed: false });
    expect(b[1]).toMatchObject({ exerciseId: 'b', setNumber: 2, weight: 45, plannedReps: 12, completed: false });
  });
  it('fills empty slots so the new round has an A and a B part; existing sets stay', () => {
    const a0 = sets('done');
    const [a, b] = appendRound(a0, sets('done', 'todo', 'todo'), ['a', 'b']);
    expect(a).toHaveLength(4);
    expect(b).toHaveLength(4);
    expect(a[0]).toBe(a0[0]);
  });
});

describe('superset flow (rest only after B, prefill per exercise)', () => {
  const pair = (a: WorkoutSet[], b: WorkoutSet[]) => [ex('a', a, 'g'), ex('b', b, 'g')];
  it('after A: B, no rest; after B: back to A with rest; after the very last part: no rest', () => {
    expect(afterSetLogged(pair(sets('todo', 'todo'), sets('todo', 'todo')), 0, 0)).toEqual({ focusIdx: 1, rest: false });
    expect(afterSetLogged(pair(sets('done', 'todo'), sets('todo', 'todo')), 1, 0)).toEqual({ focusIdx: 0, rest: true });
    expect(afterSetLogged(pair(sets('done', 'done'), sets('done', 'todo')), 1, 1)).toEqual({ focusIdx: 1, rest: false });
  });
  it('a round without B (empty slot): rest follows right after A', () => {
    expect(afterSetLogged(pair(sets('done', 'todo', 'todo'), sets('done')), 0, 1)).toEqual({ focusIdx: 0, rest: true });
  });
  it('the next round starts with the values of the round just done, per exercise', () => {
    const a = [set('done', 1, { weight: 140, actualReps: 8 }), set('todo', 2)];
    const b = [set('done', 1, { weight: 45, actualReps: 12 }), set('todo', 2)];
    expect(openSetValues(a, 1, [])).toEqual({ weight: 140, reps: 8 });
    expect(openSetValues(b, 1, [])).toEqual({ weight: 45, reps: 12 });
  });
});

describe('rest ring idle (superset)', () => {
  it('shows "na B" while no rest runs, 0:00 right after a rest ran out', () => {
    expect(restRingIdleText(90, false, 'B')).toBe('na B');
    expect(restRingIdleText(90, true, 'B')).toBe('0:00');
    expect(restRingIdleLabel(90, 'B')).toBe('Rust volgt na B (1 minuut 30). Tik om de rust in te stellen');
  });
});
