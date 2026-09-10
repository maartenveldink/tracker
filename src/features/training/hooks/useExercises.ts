import { useLiveQuery } from 'dexie-react-hooks';
import { db, newId, freshSyncMeta, touchSyncMeta, tombstonePatch, type Exercise } from '../../../db/index';

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
