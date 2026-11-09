import { describe, expect, it } from 'vitest';
import { averageOneRM, compareSessions, confettiPieces, type SetLine } from './celebration';

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
