import { useLiveQuery } from 'dexie-react-hooks';
import { db, type TrainingSchema, type SchemaExercise, type SchemaDay } from '../../../db/index';

export function useSchemas() {
  return useLiveQuery(() => db.schemas.orderBy('name').toArray()) ?? [];
}

export function useSchema(id: number | undefined) {
  return useLiveQuery(
    () => (id ? db.schemas.get(id) : undefined),
    [id],
  );
}

/** Returns true when the schema has multi-day structure. */
export function isMultiDay(schema: TrainingSchema): boolean {
  return Array.isArray(schema.days) && schema.days.length > 0;
}

/** Returns all exercises across all days (or the flat list for single-day schemas). */
export function getAllSchemaExercises(schema: TrainingSchema): SchemaExercise[] {
  if (isMultiDay(schema)) {
    return schema.days!.flatMap(d => d.exercises);
  }
  return schema.exercises;
}

/** Returns exercises for a specific day, or empty array if not found. */
export function getDayExercises(schema: TrainingSchema, dayId: string): SchemaExercise[] {
  const day = schema.days?.find(d => d.id === dayId);
  return day?.exercises ?? [];
}

/** Returns sorted days or empty array for single-day schemas. */
export function getSortedDays(schema: TrainingSchema): SchemaDay[] {
  if (!isMultiDay(schema)) return [];
  return [...schema.days!].sort((a, b) => a.order - b.order);
}

export async function createSchema(
  name: string,
  exercises: SchemaExercise[] = [],
  days?: SchemaDay[],
): Promise<number> {
  const now = new Date();
  const id = await db.schemas.add({
    name,
    exercises: days && days.length > 0 ? [] : exercises,
    days,
    createdAt: now,
    updatedAt: now,
  });
  return id as number;
}

export async function updateSchema(
  id: number,
  data: Partial<Pick<TrainingSchema, 'name' | 'exercises' | 'days'>>,
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
  // Deep-copy days with new IDs to avoid conflicts
  const copiedDays = original.days?.map(d => ({
    ...d,
    id: crypto.randomUUID(),
    exercises: [...d.exercises],
  }));

  const newId = await db.schemas.add({
    name: `${original.name} (kopie)`,
    exercises: [...original.exercises],
    days: copiedDays,
    createdAt: now,
    updatedAt: now,
  });
  return newId as number;
}
