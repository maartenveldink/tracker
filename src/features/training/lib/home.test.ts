import { describe, expect, it } from 'vitest';
import type { Exercise, TrainingSchema, Workout } from '../../../db/index';
import {
  isEmptyHome,
  lastTrainedGroups,
  nextDayId,
  nextTraining,
  volumeDeltaPct,
  weekDots,
} from './home';

// Wednesday 11 Nov 2026, noon local.
const NOW = new Date(2026, 10, 11, 12, 0, 0);

function workout(p: Partial<Workout> & { daysAgo?: number; sets?: number; exerciseId?: string; weight?: number }): Workout {
  const start = new Date(NOW.getTime() - (p.daysAgo ?? 0) * 86_400_000);
  const n = p.sets ?? 3;
  return {
    id: Math.random().toString(36),
    schemaId: null,
    schemaName: null,
    schemaDayId: null,
    schemaDayName: null,
    status: 'completed',
    startedAt: start,
    pausedAt: null,
    totalPausedMs: 0,
    completedAt: start,
    notes: '',
    exercises: [
      {
        exerciseId: p.exerciseId ?? 'ex1',
        sets: Array.from({ length: n }, (_, i) => ({
          exerciseId: p.exerciseId ?? 'ex1',
          setNumber: i + 1,
          plannedReps: 10,
          weight: p.weight ?? 100,
          actualReps: 10,
          completed: true,
        })),
      },
    ],
    ...p,
  } as unknown as Workout;
}

function exercise(id: string, primary: string[]): Exercise {
  return { id, name: id, primaryMuscles: primary, secondaryMuscles: [] } as unknown as Exercise;
}

describe('isEmptyHome', () => {
  it('is empty without completed workouts', () => expect(isEmptyHome([])).toBe(true));
  it('is not empty with one', () => expect(isEmptyHome([workout({})])).toBe(false));
});

describe('weekDots', () => {
  it('returns Mon..Sun with done / today / rest', () => {
    // Mon 9 Nov trained (2 days ago); today is Wed.
    const dots = weekDots([workout({ daysAgo: 2 })], NOW);
    expect(dots.map(d => d.label)).toEqual(['M', 'D', 'W', 'D', 'V', 'Z', 'Z']);
    expect(dots.map(d => d.status)).toEqual(['done', 'rest', 'today', 'rest', 'rest', 'rest', 'rest']);
  });
  it('marks today as done when trained today', () => {
    const dots = weekDots([workout({ daysAgo: 0 })], NOW);
    expect(dots[2]!.status).toBe('done');
    expect(dots[2]!.isToday).toBe(true);
  });
  it('ignores workouts of other weeks', () => {
    const dots = weekDots([workout({ daysAgo: 9 })], NOW);
    expect(dots.every(d => d.status !== 'done')).toBe(true);
  });
});

describe('volumeDeltaPct', () => {
  it('is null without volume last week', () => {
    expect(volumeDeltaPct([workout({ daysAgo: 0 })], NOW)).toBeNull();
  });
  it('compares this week with last week', () => {
    const w = [workout({ daysAgo: 0, weight: 110 }), workout({ daysAgo: 7, weight: 100 })];
    expect(volumeDeltaPct(w, NOW)).toBe(10);
  });
  it('can be negative', () => {
    const w = [workout({ daysAgo: 0, weight: 50 }), workout({ daysAgo: 7, weight: 100 })];
    expect(volumeDeltaPct(w, NOW)).toBe(-50);
  });
});

describe('lastTrainedGroups', () => {
  const byId = new Map([
    ['sq', exercise('sq', ['quadriceps'])],
    ['bp', exercise('bp', ['chest'])],
    ['ohp', exercise('ohp', ['shoulders'])],
    ['cu', exercise('cu', ['core'])],
  ]);
  it('returns the stalest trained groups first, with bar fraction capped at 1', () => {
    const w = [
      workout({ daysAgo: 10, exerciseId: 'sq' }),
      workout({ daysAgo: 4, exerciseId: 'ohp' }),
      workout({ daysAgo: 3, exerciseId: 'bp' }),
      workout({ daysAgo: 1, exerciseId: 'cu' }),
    ];
    const r = lastTrainedGroups(w, byId, 3, NOW);
    expect(r.map(g => g.name)).toEqual(['Quadriceps', 'Schouders', 'Borst']);
    expect(r.map(g => g.days)).toEqual([10, 4, 3]);
    expect(r[0]!.fraction).toBe(1);
    expect(r[1]!.fraction).toBeCloseTo(4 / 7);
  });
  it('skips never-trained groups', () => {
    const r = lastTrainedGroups([workout({ daysAgo: 2, exerciseId: 'bp' })], byId, 3, NOW);
    expect(r.map(g => g.name)).toEqual(['Borst']);
  });
});

describe('nextTraining', () => {
  const day = (id: string, name: string, order: number) => ({ id, name, order, exercises: [] });
  const single = { id: 's1', name: 'Full body', exercises: [{ exerciseId: 'a' }] } as unknown as TrainingSchema;
  const multi = {
    id: 's2',
    name: 'PPL',
    exercises: [],
    days: [day('d1', 'Push', 0), day('d2', 'Pull', 1), day('d3', 'Legs', 2)],
  } as unknown as TrainingSchema;

  it('is null without schemas', () => expect(nextTraining([], [])).toBeNull());
  it('falls back to the first schema without history', () => {
    expect(nextTraining([single, multi], [])?.schema.id).toBe('s1');
  });
  it('follows the rhythm of the schema trained last', () => {
    const w = [
      workout({ daysAgo: 5, schemaId: 's2', schemaDayId: 'd1' }),
      workout({ daysAgo: 2, schemaId: 's2', schemaDayId: 'd2' }),
    ];
    const r = nextTraining([single, multi], w);
    expect(r?.schema.id).toBe('s2');
    expect(r?.day?.id).toBe('d3');
    expect(r?.lastDate?.getTime()).toBe(w[1]!.startedAt.getTime());
  });
  it('wraps around the rotation', () => {
    const w = [1, 2, 3].map(i => workout({ daysAgo: 10 - i, schemaId: 's2', schemaDayId: 'd' + i }));
    expect(nextTraining([multi], w)?.day?.id).toBe('d1');
  });
  it('ignores deleted schemas of the last workout', () => {
    const w = [workout({ daysAgo: 1, schemaId: 'gone' })];
    expect(nextTraining([single], w)?.schema.id).toBe('s1');
  });
});

describe('nextDayId', () => {
  const day = (id: string, order: number) => ({ id, name: id, order, exercises: [] });
  const multi = {
    id: 's2',
    name: 'PPL',
    exercises: [],
    days: [day('d1', 0), day('d2', 1), day('d3', 2)],
  } as unknown as TrainingSchema;
  const single = { id: 's1', name: 'Full body', exercises: [] } as unknown as TrainingSchema;

  it('is null for single-day schemas', () => expect(nextDayId(single, [])).toBeNull());
  it('starts with the first day', () => expect(nextDayId(multi, [])).toBe('d1'));
  it('counts only completed sessions of that schema with a day', () => {
    const w = [
      workout({ daysAgo: 3, schemaId: 's2', schemaDayId: 'd1' }),
      workout({ daysAgo: 2, schemaId: 's1' }),
      workout({ daysAgo: 1, schemaId: 'other', schemaDayId: 'x' }),
    ];
    expect(nextDayId(multi, w)).toBe('d2');
  });
  it('wraps around', () => {
    const w = [1, 2, 3].map(i => workout({ daysAgo: 10 - i, schemaId: 's2', schemaDayId: 'd' + i }));
    expect(nextDayId(multi, w)).toBe('d1');
  });
});
