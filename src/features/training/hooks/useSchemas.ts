import { useLiveQuery } from 'dexie-react-hooks';
import { db, newId, freshSyncMeta, touchSyncMeta, tombstonePatch, type TrainingSchema, type SchemaExercise, type SchemaDay } from '../../../db/index';

/** Live schema list; `undefined` while the first query is still loading. */
export function useSchemasQuery() {
  return useLiveQuery(
    () => db.schemas.orderBy('name').filter(s => !s.deleted).toArray(),
  );
}

export function useSchemas() {
  return useSchemasQuery() ?? [];
}

export function useSchema(id: string | undefined) {
  return useLiveQuery(
    async () => {
      if (!id) return undefined;
      const s = await db.schemas.get(id);
      return s && !s.deleted ? s : undefined;
    },
    [id],
  );
}

export { isMultiDay, getAllSchemaExercises, getDayExercises, getSortedDays, getRotation } from '../lib/schemaDays';

export async function createSchema(
  name: string,
  exercises: SchemaExercise[] = [],
  days?: SchemaDay[],
  rotation?: string[],
): Promise<string> {
  const now = new Date();
  const isMulti = Boolean(days && days.length > 0);
  const id = newId();
  await db.schemas.add({
    id,
    name,
    exercises: isMulti ? [] : exercises,
    days,
    rotation: isMulti ? rotation : undefined,
    createdAt: now,
    updatedAt: now,
    ...freshSyncMeta(now.getTime()),
  });
  return id;
}

export async function updateSchema(
  id: string,
  data: Partial<Pick<TrainingSchema, 'name' | 'exercises' | 'days' | 'rotation' | 'active'>>,
): Promise<void> {
  await db.schemas.update(id, { ...data, updatedAt: new Date(), ...touchSyncMeta() });
}

export async function deleteSchema(id: string): Promise<void> {
  await db.schemas.update(id, tombstonePatch());
}

export async function copySchema(id: string): Promise<string> {
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

  const copyId = newId();
  await db.schemas.add({
    id: copyId,
    name: `${original.name} (kopie)`,
    exercises: [...original.exercises],
    days: copiedDays,
    rotation: copiedRotation && copiedRotation.length > 0 ? copiedRotation : undefined,
    createdAt: now,
    updatedAt: now,
    ...freshSyncMeta(now.getTime()),
  });
  return copyId;
}

export async function setSchemaActive(id: string, active: boolean): Promise<void> {
  await db.schemas.update(id, { active, updatedAt: new Date(), ...touchSyncMeta() });
}
