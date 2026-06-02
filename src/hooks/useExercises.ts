import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Exercise } from '../db/index';

export function useExercises() {
  return useLiveQuery(() => db.exercises.orderBy('name').toArray()) ?? [];
}

export function useExercise(id: number | undefined) {
  return useLiveQuery(
    () => (id ? db.exercises.get(id) : undefined),
    [id],
  );
}

export async function createExercise(data: Omit<Exercise, 'id' | 'createdAt' | 'isDefault'>): Promise<number> {
  const id = await db.exercises.add({
    ...data,
    isDefault: false,
    createdAt: new Date(),
  });
  return id as number;
}

export async function updateExercise(id: number, data: Partial<Exercise>): Promise<void> {
  await db.exercises.update(id, data);
}

export async function deleteExercise(id: number): Promise<void> {
  await db.exercises.delete(id);
}

/** Check if exercise is used in any schema or workout. */
export async function isExerciseInUse(exerciseId: number): Promise<boolean> {
  const schemaCount = await db.schemas
    .filter(s => s.exercises.some(e => e.exerciseId === exerciseId))
    .count();
  if (schemaCount > 0) return true;

  const workoutCount = await db.workouts
    .filter(w => w.exercises.some(e => e.exerciseId === exerciseId))
    .count();
  return workoutCount > 0;
}
