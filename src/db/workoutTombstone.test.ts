import { describe, expect, it } from 'vitest';
import { workoutTombstone } from './workoutTombstone';
import type { Workout } from './index';

const full: Workout = {
  id: 'abc123def456ghi',
  schemaId: 'schema1',
  schemaName: 'Push',
  schemaDayId: 'day1',
  schemaDayName: 'Dag A',
  exercises: [
    {
      exerciseId: 'def-bench',
      sets: [{ targetReps: 8, actualReps: 8, weight: 80, completed: true }],
    },
  ] as unknown as Workout['exercises'],
  status: 'completed',
  startedAt: new Date('2026-11-01T10:00:00Z'),
  pausedAt: new Date('2026-11-01T10:20:00Z'),
  totalPausedMs: 60_000,
  completedAt: new Date('2026-11-01T11:00:00Z'),
  notes: 'zwaar vandaag',
  clientUpdatedAt: 1,
  deleted: false,
  dirty: 0,
};

describe('workoutTombstone', () => {
  it('keeps only the id and the sync fields, marked deleted and dirty', () => {
    const t = workoutTombstone(full, 5000);
    expect(t.id).toBe(full.id);
    expect(t.deleted).toBe(true);
    expect(t.dirty).toBe(1);
    expect(t.clientUpdatedAt).toBe(5000);
  });

  it('wipes all content: exercises, notes, schema snapshot and times', () => {
    const t = workoutTombstone(full, 5000);
    expect(t.exercises).toEqual([]);
    expect(t.notes).toBe('');
    expect(t.schemaId).toBeNull();
    expect(t.schemaName).toBeNull();
    expect(t.schemaDayId).toBeNull();
    expect(t.schemaDayName).toBeNull();
    expect(t.pausedAt).toBeNull();
    expect(t.completedAt).toBeNull();
    expect(t.totalPausedMs).toBe(0);
    expect(t.startedAt.getTime()).toBe(0);
    expect(JSON.stringify(t)).not.toMatch(/Push|Dag A|zwaar|def-bench|schema1|day1|2026/);
  });

  it('drops unknown extra fields from older rows', () => {
    const withExtra = { ...full, legacy: 'oud' } as Workout;
    expect(Object.keys(workoutTombstone(withExtra, 1)).sort()).toEqual(
      ['clientUpdatedAt', 'completedAt', 'deleted', 'dirty', 'exercises', 'id', 'notes', 'pausedAt',
        'schemaDayId', 'schemaDayName', 'schemaId', 'schemaName', 'startedAt', 'status', 'totalPausedMs'],
    );
  });

  it('survives a JSON round trip (sync push/pull) as a valid, empty workout', () => {
    const back = JSON.parse(JSON.stringify(workoutTombstone(full, 7))) as Workout;
    expect(back.exercises.map(e => e.exerciseId)).toEqual([]);
    expect(back.deleted).toBe(true);
  });
});
