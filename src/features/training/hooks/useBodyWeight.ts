import { useLiveQuery } from 'dexie-react-hooks';
import { db, type BodyWeightEntry } from '../../../db/index';

/** Body weight entries, oldest first (reactive). */
export function useBodyWeights(): BodyWeightEntry[] {
  return useLiveQuery(() => db.bodyWeights.orderBy('date').toArray()) ?? [];
}

/**
 * Records a weigh-in for a date. One entry per day: an existing entry for the
 * same date is overwritten rather than duplicated.
 */
export async function addBodyWeight(date: string, weightKg: number, note?: string): Promise<void> {
  const existing = await db.bodyWeights.where('date').equals(date).first();
  if (existing) {
    await db.bodyWeights.update(existing.id!, { weightKg, note });
  } else {
    await db.bodyWeights.add({ date, weightKg, note, createdAt: new Date() });
  }
}

export async function deleteBodyWeight(id: number): Promise<void> {
  await db.bodyWeights.delete(id);
}
