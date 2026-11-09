import { describe, expect, it } from 'vitest';
import type { Workout, WorkoutSet } from '../../../db/index';
import { formatLastPerformed, lastPerformedByExercise } from './lastPerformed';

const set = (weight: number | null, reps: number, completed = true): WorkoutSet => ({
  exerciseId: 'a', setNumber: 1, plannedReps: null, actualReps: reps, weight, completed, skipped: false,
});
const workout = (startedAt: string, sets: WorkoutSet[], exerciseId = 'a'): Workout =>
  ({ startedAt: new Date(startedAt), exercises: [{ exerciseId, order: 0, sets, notes: '' }] }) as Workout;

describe('lastPerformedByExercise', () => {
  it('takes the heaviest set of the most recent workout, regardless of input order', () => {
    const m = lastPerformedByExercise([
      workout('2026-02-01', [set(50, 8), set(60, 5), set(60, 6)]),
      workout('2026-01-01', [set(100, 1)]),
    ]);
    expect(m.get('a')).toMatchObject({ weight: 60, reps: 6 });
  });
  it('ignores incomplete sets and workouts without performed sets', () => {
    const m = lastPerformedByExercise([
      workout('2026-01-01', [set(40, 10)]),
      workout('2026-02-01', [set(90, 5, false)]),
    ]);
    expect(m.get('a')).toMatchObject({ weight: 40, reps: 10 });
  });
  it('reports bodyweight sets with null weight', () => {
    const m = lastPerformedByExercise([workout('2026-01-01', [set(null, 6), set(null, 9)])]);
    const p = m.get('a')!;
    expect(p.weight).toBeNull();
    expect(formatLastPerformed(p)).toBe('× 9');
  });
  it('formats decimals with a comma', () => {
    expect(formatLastPerformed({ date: new Date(), weight: 62.5, reps: 8 })).toBe('62,5 kg × 8');
  });
});
