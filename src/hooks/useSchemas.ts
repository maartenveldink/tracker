import { useLiveQuery } from 'dexie-react-hooks';
import { db, type TrainingSchema, type SchemaExercise } from '../db/index';

export function useSchemas() {
  return useLiveQuery(() => db.schemas.orderBy('name').toArray()) ?? [];
}

export function useSchema(id: number | undefined) {
  return useLiveQuery(
    () => (id ? db.schemas.get(id) : undefined),
    [id],
  );
}

export async function createSchema(name: string, exercises: SchemaExercise[] = []): Promise<number> {
  const now = new Date();
  const id = await db.schemas.add({
    name,
    exercises,
    createdAt: now,
    updatedAt: now,
  });
  return id as number;
}

export async function updateSchema(
  id: number,
  data: Partial<Pick<TrainingSchema, 'name' | 'exercises'>>,
): Promise<void> {
  await db.schemas.update(id, { ...data, updatedAt: new Date() });
}

export async function deleteSchema(id: number): Promise<void> {
  await db.schemas.delete(id);
}

export async function copySchema(id: number): Promise<number> {
  const original = await db.schemas.get(id);
  if (!original) throw new Error('Schema niet gevonden');

  const now = new Date();
  const newId = await db.schemas.add({
    name: `${original.name} (kopie)`,
    exercises: [...original.exercises],
    createdAt: now,
    updatedAt: now,
  });
  return newId as number;
}
