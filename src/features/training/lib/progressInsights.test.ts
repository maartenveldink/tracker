import { describe, expect, it } from 'vitest';
import type { Exercise, Workout } from '../../../db/index';
import {
  detectPlateau,
  setsPerPrimaryMuscle,
  weightMovingAverage,
  averageChange,
  isNewPR,
  recentTrainingStats,
  WEEKLY_SETS_TARGET,
} from './progressInsights';

const top = (weight: number, reps: number) => ({ bestSet: { weight, reps } });

describe('detectPlateau', () => {
  it('flags 3 identical top sets and suggests +step or +1 rep', () => {
    const p = detectPlateau([top(135, 8), top(140, 8), top(140, 8), top(140, 8)], 2.5);
    expect(p).toEqual({ weight: 140, reps: 8, sessions: 3, nextWeight: 142.5, nextReps: 9 });
  });
  it('needs at least 3 sessions', () => {
    expect(detectPlateau([top(140, 8), top(140, 8)], 2.5)).toBeNull();
  });
  it('is not a plateau when the last 3 differ', () => {
    expect(detectPlateau([top(140, 8), top(140, 8), top(140, 9)], 2.5)).toBeNull();
    expect(detectPlateau([top(140, 8), top(142.5, 8), top(140, 8)], 2.5)).toBeNull();
  });
  it('ignores bodyweight top sets (no weight)', () => {
    expect(detectPlateau([top(0, 10), top(0, 10), top(0, 10)], 2.5)).toBeNull();
  });
  it('avoids float noise in the suggested weight', () => {
    const p = detectPlateau([top(0.1, 8), top(0.1, 8), top(0.1, 8)], 0.2);
    expect(p?.nextWeight).toBe(0.3);
  });
});

function ex(id: string, primary: string[], secondary: string[] = []): Exercise {
  return { id, name: id, primaryMuscles: primary, secondaryMuscles: secondary } as Exercise;
}
function workout(startedAt: Date, sets: Array<{ ex: string; done: boolean; reps: number | null }>): Workout {
  const byEx = new Map<string, typeof sets>();
  for (const s of sets) byEx.set(s.ex, [...(byEx.get(s.ex) ?? []), s]);
  return {
    startedAt,
    exercises: [...byEx].map(([exerciseId, ss]) => ({
      exerciseId,
      sets: ss.map((s, i) => ({ setNumber: i + 1, weight: 50, actualReps: s.reps, completed: s.done })),
    })),
  } as unknown as Workout;
}

describe('setsPerPrimaryMuscle', () => {
  // 2026-11-09 is a Monday.
  const ref = new Date(2026, 10, 11); // Wednesday
  const map = new Map([['a', ex('a', ['chest'], ['arms'])], ['b', ex('b', ['legs'])]]);

  it('counts completed sets per primary muscle in the current Mon-Sun week only', () => {
    const w1 = workout(new Date(2026, 10, 9, 8), [
      { ex: 'a', done: true, reps: 8 },
      { ex: 'a', done: true, reps: 8 },
      { ex: 'a', done: false, reps: null },
      { ex: 'b', done: true, reps: 5 },
    ]);
    const lastWeek = workout(new Date(2026, 10, 8, 20), [{ ex: 'a', done: true, reps: 8 }]);
    const r = setsPerPrimaryMuscle([w1, lastWeek], map, ref);
    expect(r.get('chest')).toBe(2);
    expect(r.get('legs')).toBe(1);
    expect(r.has('arms')).toBe(false); // secondary muscles do not count
  });
  it('counts bodyweight sets and skips unknown exercises', () => {
    const w = workout(new Date(2026, 10, 10), [
      { ex: 'a', done: true, reps: 12 },
      { ex: 'zzz', done: true, reps: 12 },
    ]);
    expect(setsPerPrimaryMuscle([w], map, ref).get('chest')).toBe(1);
  });
  it('exposes the 10-set target', () => {
    expect(WEEKLY_SETS_TARGET).toBe(10);
  });
});

describe('weightMovingAverage', () => {
  const e = (date: string, weightKg: number) => ({ date, weightKg });
  it('averages measurements in the 7 days up to and including each day', () => {
    const r = weightMovingAverage([e('2026-11-01', 80), e('2026-11-03', 82), e('2026-11-08', 84)]);
    expect(r.map(p => p.avg)).toEqual([80, 81, 83]); // 11-08 window = 11-02..11-08 => 82,84
  });
  it('sorts unsorted input', () => {
    const r = weightMovingAverage([e('2026-11-03', 82), e('2026-11-01', 80)]);
    expect(r.map(p => p.date)).toEqual(['2026-11-01', '2026-11-03']);
  });
  it('returns [] for no data', () => {
    expect(weightMovingAverage([])).toEqual([]);
  });
});

describe('averageChange', () => {
  const p = (date: string, avg: number) => ({ date, weightKg: avg, avg });
  it('compares the latest average with the one 28 days earlier', () => {
    expect(averageChange([p('2026-10-01', 82), p('2026-10-29', 80)], 28)).toBe(-2);
  });
  it('uses the closest measurement on or before the target day', () => {
    expect(averageChange([p('2026-09-28', 85), p('2026-10-15', 83), p('2026-10-29', 80)], 28)).toBe(-5);
  });
  it('is null without data that old', () => {
    expect(averageChange([p('2026-10-20', 82), p('2026-10-29', 80)], 28)).toBeNull();
  });
});

describe('isNewPR', () => {
  it('is true when the last session sets the record', () => {
    expect(isNewPR([100, 110, 120])).toBe(true);
  });
  it('is false when the record is older, tied, or there is one session', () => {
    expect(isNewPR([100, 120, 110])).toBe(false);
    expect(isNewPR([120, 120])).toBe(false);
    expect(isNewPR([100])).toBe(false);
  });
});

describe('recentTrainingStats', () => {
  const now = new Date(2026, 10, 11, 12);
  const w = (daysAgo: number, minutes: number, pausedMin = 0) => {
    const startedAt = new Date(now.getTime() - daysAgo * 86_400_000);
    return {
      startedAt,
      completedAt: new Date(startedAt.getTime() + minutes * 60_000),
      totalPausedMs: pausedMin * 60_000,
    } as unknown as Workout;
  };
  it('averages sessions per week and net duration over the window', () => {
    const r = recentTrainingStats([w(1, 60), w(10, 50, 10), w(20, 70), w(200, 999)], 8, now);
    expect(r.sessionsPerWeek).toBe(0.4); // 3 sessions / 8 weeks = 0.375
    expect(r.avgMinutes).toBe(57); // (60 + 40 + 70) / 3
  });
  it('handles no workouts', () => {
    expect(recentTrainingStats([], 8, now)).toEqual({ sessionsPerWeek: 0, avgMinutes: null });
  });
});
