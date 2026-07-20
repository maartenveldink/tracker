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

/**
 * Returns the effective repetition rhythm as an ordered list of day IDs.
 * Falls back to plain day order when no custom rotation is set. Any rotation
 * entries pointing at days that no longer exist are dropped.
 */
export function getRotation(schema: TrainingSchema): string[] {
  const sortedDays = getSortedDays(schema);
  if (sortedDays.length === 0) return [];
  const validIds = new Set(sortedDays.map(d => d.id));
  const rotation = (schema.rotation ?? []).filter(id => validIds.has(id));
  return rotation.length > 0 ? rotation : sortedDays.map(d => d.id);
}

export async function createSchema(
  name: string,
  exercises: SchemaExercise[] = [],
  days?: SchemaDay[],
  rotation?: string[],
): Promise<number> {
  const now = new Date();
  const isMulti = Boolean(days && days.length > 0);
  const id = await db.schemas.add({
    name,
    exercises: isMulti ? [] : exercises,
    days,
    rotation: isMulti ? rotation : undefined,
    createdAt: now,
    updatedAt: now,
  });
  return id as number;
}

export async function updateSchema(
  id: number,
  data: Partial<Pick<TrainingSchema, 'name' | 'exercises' | 'days' | 'rotation'>>,
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
  // Deep-copy days with new IDs to avoid conflicts, keeping a map old->new
  const idMap = new Map<string, string>();
  const copiedDays = original.days?.map(d => {
    const newDayId = crypto.randomUUID();
    idMap.set(d.id, newDayId);
    return { ...d, id: newDayId, exercises: [...d.exercises] };
  });
  // Remap the rotation onto the copied day IDs
  const copiedRotation = original.rotation
    ?.map(id => idMap.get(id))
    .filter((id): id is string => id !== undefined);

  const newId = await db.schemas.add({
    name: `${original.name} (kopie)`,
    exercises: [...original.exercises],
    days: copiedDays,
    rotation: copiedRotation && copiedRotation.length > 0 ? copiedRotation : undefined,
    createdAt: now,
    updatedAt: now,
  });
  return newId as number;
}
