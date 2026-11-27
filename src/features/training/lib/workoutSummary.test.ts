import { describe, expect, it } from 'vitest';
import type { Workout, WorkoutExercise } from '../../../db/index';
import {
  hasSomethingToCelebrate,
  previousSchemaSession,
  shouldPlayArrivalCelebration,
  summarizeWorkout,
  summaryHeadline,
} from './workoutSummary';

const epley = 'epley' as const;

function ex(exerciseId: string, sets: Array<[number | null, number]>): WorkoutExercise {
  return {
    exerciseId,
    order: 0,
    notes: '',
    sets: sets.map(([weight, reps], i) => ({
      exerciseId,
      setNumber: i + 1,
      plannedReps: reps,
      actualReps: reps,
      weight,
      completed: true,
      skipped: false,
    })),
  };
}

let seq = 0;
function workout(day: number, exercises: WorkoutExercise[], extra: Partial<Workout> = {}): Workout {
  seq++;
  return {
    id: `w${seq}`,
    schemaId: null,
    schemaName: null,
    schemaDayId: null,
    schemaDayName: null,
    exercises,
    status: 'completed',
    startedAt: new Date(2026, 10, day, 10),
    pausedAt: null,
    totalPausedMs: 0,
    completedAt: new Date(2026, 10, day, 11),
    notes: '',
    ...extra,
  } as Workout;
}

describe('summarizeWorkout', () => {
  it('has no comparison and nothing to celebrate without a previous session', () => {
    const today = workout(10, [ex('a', [[60, 10]])]);
    const s = summarizeWorkout(today, [today], epley);
    expect(s.exercises[0]?.comparison).toBeNull();
    expect(s.exercises[0]?.improved).toBe(false);
    expect(s.exercises[0]?.isPR).toBe(false);
    expect(s.comparableCount).toBe(0);
    expect(hasSomethingToCelebrate(s)).toBe(false);
  });

  it('flags an exercise better than last time (average 1RM) but not an all-time PR', () => {
    const first = workout(1, [ex('a', [[80, 10]])]);
    const second = workout(3, [ex('a', [[60, 10]])]);
    const today = workout(5, [ex('a', [[70, 10]])]);
    const s = summarizeWorkout(today, [first, second, today], epley);
    const a = s.exercises[0]!;
    expect(a.improved).toBe(true);
    expect(a.isPR).toBe(false);
    expect(a.comparison?.previousAvg).toBeCloseTo(80);
    expect(a.comparison?.todayAvg).toBeCloseTo(70 * (1 + 10 / 30));
    expect(s.improvedCount).toBe(1);
    expect(s.prCount).toBe(0);
    expect(hasSomethingToCelebrate(s)).toBe(true);
  });

  it('flags an all-time PR with the previous best', () => {
    const first = workout(1, [ex('a', [[60, 10]])]);
    const today = workout(5, [ex('a', [[80, 10]])]);
    const s = summarizeWorkout(today, [first, today], epley);
    const a = s.exercises[0]!;
    expect(a.isPR).toBe(true);
    expect(a.best1RM).toBeCloseTo(80 * (1 + 10 / 30));
    expect(a.previousBest1RM).toBeCloseTo(80);
    expect(s.prCount).toBe(1);
  });

  it('only compares with earlier workouts, so an old summary stays as it was', () => {
    const old = workout(1, [ex('a', [[60, 10]])]);
    const later = workout(8, [ex('a', [[100, 10]])]);
    const s = summarizeWorkout(old, [old, later], epley);
    expect(s.exercises[0]?.comparison).toBeNull();
    expect(s.exercises[0]?.isPR).toBe(false);
  });

  it('skips earlier sessions without weighted sets when looking for the previous session', () => {
    const weighted = workout(1, [ex('a', [[60, 10]])]);
    const bodyweight = workout(3, [ex('a', [[null, 10]])]);
    const today = workout(5, [ex('a', [[62.5, 10]])]);
    const s = summarizeWorkout(today, [weighted, bodyweight, today], epley);
    expect(s.exercises[0]?.comparison?.previousAvg).toBeCloseTo(80);
    expect(s.exercises[0]?.improved).toBe(true);
  });

  it('does not celebrate an equal or worse session', () => {
    const prev = workout(1, [ex('a', [[60, 10]]), ex('b', [[40, 10]])]);
    const today = workout(5, [ex('a', [[60, 10]]), ex('b', [[35, 10]])]);
    const s = summarizeWorkout(today, [prev, today], epley);
    expect(s.comparableCount).toBe(2);
    expect(s.improvedCount).toBe(0);
    expect(hasSomethingToCelebrate(s)).toBe(false);
  });

  it('counts sets and volume, bodyweight sets add sets but no volume', () => {
    const today = workout(5, [ex('a', [[60, 10], [null, 8]])]);
    const s = summarizeWorkout(today, [today], epley);
    expect(s.totalSets).toBe(2);
    expect(s.volume).toBe(600);
    expect(s.exercises[0]?.completedSets).toBe(2);
  });
});

describe('previousSchemaSession', () => {
  const schema = { schemaId: 's1', schemaName: 'Split' };
  it('is null for a free workout', () => {
    const today = workout(5, [], {});
    expect(previousSchemaSession(today, [workout(1, []), today])).toBeNull();
  });
  it('picks the latest earlier session of the same schema day', () => {
    const a1 = workout(1, [], { ...schema, schemaDayId: 'A' });
    const b1 = workout(2, [], { ...schema, schemaDayId: 'B' });
    const a2 = workout(3, [], { ...schema, schemaDayId: 'A' });
    const today = workout(5, [], { ...schema, schemaDayId: 'A' });
    const later = workout(7, [], { ...schema, schemaDayId: 'A' });
    expect(previousSchemaSession(today, [a1, b1, a2, today, later])?.id).toBe(a2.id);
    expect(previousSchemaSession(b1, [a1, b1, a2, today])).toBeNull();
  });
});

describe('summary volume delta', () => {
  it('compares total volume with the previous session of the same schema day', () => {
    const prev = workout(1, [ex('a', [[60, 10]])], { schemaId: 's1', schemaDayId: 'A' });
    const today = workout(5, [ex('a', [[60, 12]])], { schemaId: 's1', schemaDayId: 'A' });
    expect(summarizeWorkout(today, [prev, today], epley).volumeDelta).toBe(120);
  });
  it('is null without a previous schema session', () => {
    const today = workout(5, [ex('a', [[60, 12]])]);
    expect(summarizeWorkout(today, [today], epley).volumeDelta).toBeNull();
  });
});

describe('summaryHeadline', () => {
  it('names records and improvements when there is something to celebrate', () => {
    const first = workout(1, [ex('a', [[60, 10]]), ex('b', [[40, 10]]), ex('c', [[30, 10]])]);
    const second = workout(3, [ex('a', [[80, 10]]), ex('b', [[30, 10]]), ex('c', [[30, 10]])]);
    const today = workout(5, [ex('a', [[90, 10]]), ex('b', [[35, 10]]), ex('c', [[30, 10]])]);
    const h = summaryHeadline(summarizeWorkout(today, [first, second, today], epley));
    expect(h.celebrate).toBe(true);
    expect(h.title).toBe('Je bent vooruitgegaan');
    expect(h.subline).toBe('1 persoonlijk record · 2 van 3 oefeningen beter dan vorige keer');
  });
  it('stays honest without improvement', () => {
    const prev = workout(1, [ex('a', [[60, 10]])]);
    const today = workout(5, [ex('a', [[60, 10]])]);
    const h = summaryHeadline(summarizeWorkout(today, [prev, today], epley));
    expect(h.celebrate).toBe(false);
    expect(h.title).toBe('Training voltooid');
    expect(h.subline).not.toMatch(/beter|record/i);
  });
  it('calls a first session a starting point', () => {
    const today = workout(5, [ex('a', [[60, 10]])]);
    const h = summaryHeadline(summarizeWorkout(today, [today], epley));
    expect(h.celebrate).toBe(false);
    expect(h.subline).toMatch(/startpunt/);
  });
});

describe('shouldPlayArrivalCelebration', () => {
  const completedAt = new Date(2026, 10, 5, 11, 0, 0);
  const at = (sec: number) => new Date(completedAt.getTime() + sec * 1000);
  it('plays right after finishing the workout', () => {
    expect(shouldPlayArrivalCelebration({ justFinished: true, completedAt, now: at(2) })).toBe(true);
  });
  it('does not play when the summary is opened from history', () => {
    expect(shouldPlayArrivalCelebration({ justFinished: false, completedAt, now: at(2) })).toBe(false);
  });
  it('does not play for a stale flag (long after finishing)', () => {
    expect(shouldPlayArrivalCelebration({ justFinished: true, completedAt, now: at(10 * 60) })).toBe(false);
  });
  it('does not play without a completion time', () => {
    expect(shouldPlayArrivalCelebration({ justFinished: true, completedAt: null, now: at(2) })).toBe(false);
  });
});
