import { useLiveQuery } from 'dexie-react-hooks';
import { db, newId, freshSyncMeta, touchSyncMeta, tombstonePatch, type Exercise, type SchemaExercise } from '../../../db/index';

export function useExercises() {
  return useLiveQuery(
    () => db.exercises.orderBy('name').filter(e => !e.deleted).toArray(),
  ) ?? [];
}

export function useExercise(id: string | undefined) {
  return useLiveQuery(
    async () => {
      if (!id) return undefined;
      const ex = await db.exercises.get(id);
      return ex && !ex.deleted ? ex : undefined;
    },
    [id],
  );
}

export type NewExerciseInput = Omit<Exercise, 'id' | 'createdAt' | 'isDefault' | 'clientUpdatedAt' | 'deleted' | 'dirty'>;

export async function createExercise(data: NewExerciseInput): Promise<string> {
  const id = newId();
  await db.exercises.add({
    ...data,
    id,
    isDefault: false,
    createdAt: new Date(),
    ...freshSyncMeta(),
  });
  return id;
}

export async function updateExercise(id: string, data: Partial<Exercise>): Promise<void> {
  await db.exercises.update(id, { ...data, ...touchSyncMeta() });
}

export async function deleteExercise(id: string): Promise<void> {
  await db.exercises.update(id, tombstonePatch());
}

/**
 * Merges the `source` exercise into `target`: every reference to `source`
 * (schema entries, workout exercises and their logged sets) is repointed to
 * `target`, then `source` is tombstoned. All touched records are marked dirty so
 * the change syncs. Idempotent-safe and runs in a single transaction.
 *
 * History and stats follow automatically because they are derived from the
 * `exerciseId` on workout sets, which now points at `target`.
 */
export async function mergeExercises(sourceId: string, targetId: string): Promise<void> {
  if (sourceId === targetId) return;

  await db.transaction('rw', db.exercises, db.schemas, db.workouts, async () => {
    const target = await db.exercises.get(targetId);
    if (!target || target.deleted) throw new Error('Doeloefening niet gevonden');

    const repointList = (list: SchemaExercise[]): { list: SchemaExercise[]; changed: boolean } => {
      let changed = false;
      const next = list.map((e) => {
        if (e.exerciseId === sourceId) {
          changed = true;
          return { ...e, exerciseId: targetId };
        }
        return e;
      });
      return { list: next, changed };
    };

    // Schemas: flat exercise list + every day's exercise list.
    const schemas = await db.schemas.filter((s) => !s.deleted).toArray();
    for (const s of schemas) {
      const flat = repointList(s.exercises ?? []);
      let daysChanged = false;
      const days = s.days?.map((d) => {
        const r = repointList(d.exercises);
        if (r.changed) daysChanged = true;
        return { ...d, exercises: r.list };
      });
      if (flat.changed || daysChanged) {
        await db.schemas.update(s.id, {
          exercises: flat.list,
          days,
          updatedAt: new Date(),
          ...touchSyncMeta(),
        });
      }
    }

    // Workouts: the exercise entry and each logged set carry an exerciseId.
    const workouts = await db.workouts.filter((w) => !w.deleted).toArray();
    for (const w of workouts) {
      let changed = false;
      const exercises = w.exercises.map((we) => {
        const setsHit = we.sets.some((st) => st.exerciseId === sourceId);
        if (we.exerciseId === sourceId || setsHit) {
          changed = true;
          return {
            ...we,
            exerciseId: we.exerciseId === sourceId ? targetId : we.exerciseId,
            sets: we.sets.map((st) =>
              st.exerciseId === sourceId ? { ...st, exerciseId: targetId } : st,
            ),
          };
        }
        return we;
      });
      if (changed) {
        await db.workouts.update(w.id, { exercises, ...touchSyncMeta() });
      }
    }

    // Finally remove the source exercise (tombstone so the deletion syncs).
    await db.exercises.update(sourceId, tombstonePatch());
  });
}

/** Check if exercise is used in any (non-deleted) schema or workout. */
export async function isExerciseInUse(exerciseId: string): Promise<boolean> {
  const schemaCount = await db.schemas
    .filter(s => !s.deleted && getSchemaExerciseIds(s).includes(exerciseId))
    .count();
  if (schemaCount > 0) return true;

  const workoutCount = await db.workouts
    .filter(w => !w.deleted && w.exercises.some(e => e.exerciseId === exerciseId))
    .count();
  return workoutCount > 0;
}

/** All exercise ids referenced by a schema, across the flat list and all days. */
function getSchemaExerciseIds(s: { exercises: { exerciseId: string }[]; days?: { exercises: { exerciseId: string }[] }[] }): string[] {
  const flat = s.exercises.map(e => e.exerciseId);
  const days = (s.days ?? []).flatMap(d => d.exercises.map(e => e.exerciseId));
  return [...flat, ...days];
}
