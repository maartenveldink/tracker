import type { Workout } from './index';

/**
 * Pure: the minimal tombstone for a deleted workout. Only the id and the sync
 * fields (`deleted`, `dirty`, `clientUpdatedAt`) carry meaning; every content
 * field is reset to a neutral, type-valid value so nothing of the training
 * (exercises, sets, notes, schema snapshot, times) stays in IndexedDB or reaches
 * the server, while code that reads the row without a `deleted` filter (indexes,
 * `reviveDateFields`, `exercises.map`) still gets a well-formed `Workout`.
 * Write it with `put` (not `update`) so any extra fields of older rows go too.
 */
export function workoutTombstone(workout: Pick<Workout, 'id'>, now = Date.now()): Workout {
  return {
    id: workout.id,
    schemaId: null,
    schemaName: null,
    schemaDayId: null,
    schemaDayName: null,
    exercises: [],
    status: 'completed',
    startedAt: new Date(0),
    pausedAt: null,
    totalPausedMs: 0,
    completedAt: null,
    notes: '',
    deleted: true,
    dirty: 1,
    clientUpdatedAt: now,
  };
}
