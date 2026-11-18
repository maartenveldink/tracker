import { describe, expect, it } from 'vitest';
import type { WorkoutExercise, WorkoutSet } from '../../../db/index';
import { afterSetLogged } from './liveTraining';
import {
  averageOneRM,
  compareSessions,
  confettiPieces,
  finishedBetterThanLastTime,
  type SetLine,
} from './celebration';

const epley = 'epley' as const;
const s = (weight: number, reps: number): SetLine => ({ weight, reps });

describe('averageOneRM', () => {
  it('averages the estimated 1RM over weighted sets', () => {
    // epley: w * (1 + reps/30): 60x10 = 80, 60x0 ignored
    expect(averageOneRM([s(60, 10), s(60, 10)], epley)).toBeCloseTo(80);
    expect(averageOneRM([s(60, 10), s(30, 10)], epley)).toBeCloseTo(60);
  });
  it('ignores sets without weight or reps', () => {
    expect(averageOneRM([s(60, 10), s(0, 10), s(50, 0)], epley)).toBeCloseTo(80);
  });
  it('is 0 without usable sets', () => {
    expect(averageOneRM([], epley)).toBe(0);
  });
});

describe('compareSessions', () => {
  it('is null without a previous session (new exercise)', () => {
    expect(compareSessions([s(60, 10)], null, epley)).toBeNull();
    expect(compareSessions([s(60, 10)], [], epley)).toBeNull();
  });
  it('is null when today has no weighted sets', () => {
    expect(compareSessions([], [s(60, 10)], epley)).toBeNull();
  });
  it('is not improved when the average 1RM is equal or lower', () => {
    expect(compareSessions([s(60, 10)], [s(60, 10)], epley)?.improved).toBe(false);
    expect(compareSessions([s(50, 10)], [s(60, 10)], epley)?.improved).toBe(false);
  });
  it('uses the average, not the best set', () => {
    // best set is higher today (80x10) but the average is lower
    const r = compareSessions([s(80, 10), s(40, 5)], [s(70, 10), s(70, 10)], epley);
    expect(r?.improved).toBe(false);
  });
  it('is improved on a higher average and reports deltas', () => {
    const r = compareSessions([s(60, 10), s(60, 9)], [s(60, 8), s(60, 8)], epley);
    expect(r?.improved).toBe(true);
    expect(r?.repsDelta).toBe(3);
    expect(r?.volumeDelta).toBe(60 * 19 - 60 * 16);
    expect(r?.rows).toHaveLength(2);
    expect(r?.rows[0]).toMatchObject({ today: s(60, 10), previous: s(60, 8), repsDiff: 2 });
  });
  it('pads rows when set counts differ', () => {
    const r = compareSessions([s(60, 10), s(60, 10), s(60, 10)], [s(60, 8)], epley);
    expect(r?.rows).toHaveLength(3);
    expect(r?.rows[2]?.previous).toBeNull();
    expect(r?.rows[2]?.repsDiff).toBeNull();
  });
});

describe('finishedBetterThanLastTime', () => {
  const open = (setNumber = 1): WorkoutSet => ({
    exerciseId: 'a',
    setNumber,
    plannedReps: 10,
    actualReps: null,
    weight: null,
    completed: false,
    skipped: false,
  });
  const done = (weight: number, reps: number, setNumber = 1): WorkoutSet => ({
    ...open(setNumber),
    weight,
    actualReps: reps,
    completed: true,
  });
  const previous = [s(60, 10), s(60, 10)];
  const check = (before: WorkoutSet[], after: WorkoutSet[], prev: SetLine[] | null = previous) =>
    finishedBetterThanLastTime(before, after, prev, epley);

  it('fires when the last open set is logged and the average 1RM is higher', () => {
    expect(check([done(60, 10), open(2)], [done(60, 10), done(70, 10, 2)])).toBe(true);
  });
  it('does not fire while a set is still open', () => {
    expect(check([open(), open(2)], [done(70, 10), open(2)])).toBe(false);
  });
  it('does not fire when the average 1RM is equal or lower', () => {
    expect(check([done(60, 10), open(2)], [done(60, 10), done(60, 10, 2)])).toBe(false);
    expect(check([done(60, 10), open(2)], [done(60, 10), done(50, 10, 2)])).toBe(false);
  });
  it('does not fire without a previous session', () => {
    expect(check([open()], [done(70, 10)], null)).toBe(false);
  });
  it('does not fire again for an exercise that was already finished', () => {
    const finished = [done(70, 10), done(70, 10, 2)];
    expect(check(finished, finished)).toBe(false);
  });
  it('fires again when a reopened exercise is finished again', () => {
    const reopened = [done(70, 10), open(2)];
    expect(check(reopened, [done(70, 10), done(70, 10, 2)])).toBe(true);
  });
  it('fires when removing the only open set finishes the exercise', () => {
    expect(check([done(70, 10), open(2)], [done(70, 10)])).toBe(true);
  });
  it('fires for a superset member even though the focus moves to its partner', () => {
    const member = (exerciseId: string, sets: WorkoutSet[], order: number): WorkoutExercise => ({
      exerciseId,
      order,
      sets,
      notes: '',
      supersetGroup: 'g',
    });
    const before = [done(70, 10), open(2)];
    const workout = [member('a', before, 0), member('b', [done(20, 10), open(2)], 1)];

    expect(afterSetLogged(workout, 0, 1).focusIdx).toBe(1);
    expect(check(before, [done(70, 10), done(70, 10, 2)])).toBe(true);
  });
});

describe('confettiPieces', () => {
  it('is deterministic and has the requested count', () => {
    const a = confettiPieces(40);
    expect(a).toHaveLength(40);
    expect(confettiPieces(40)).toEqual(a);
  });
  it('stays within the design ranges', () => {
    for (const p of confettiPieces(40)) {
      expect(p.size).toBeGreaterThanOrEqual(6);
      expect(p.size).toBeLessThanOrEqual(10);
      expect(p.angle).toBeGreaterThanOrEqual(-170);
      expect(p.angle).toBeLessThanOrEqual(-10);
      expect(p.delay).toBeLessThanOrEqual(0.18);
    }
  });
});
