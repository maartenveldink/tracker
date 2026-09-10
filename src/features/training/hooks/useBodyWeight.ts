import { useLiveQuery } from 'dexie-react-hooks';
import { db, newId, freshSyncMeta, touchSyncMeta, tombstonePatch, type BodyWeightEntry } from '../../../db/index';

/** Body weight entries, oldest first (reactive). */
export function useBodyWeights(): BodyWeightEntry[] {
  return useLiveQuery(
    () => db.bodyWeights.orderBy('date').filter(b => !b.deleted).toArray(),
  ) ?? [];
}

/**
 * Records a weigh-in for a date. One entry per day: an existing (non-deleted)
 * entry for the same date is overwritten rather than duplicated.
 */
export async function addBodyWeight(date: string, weightKg: number, note?: string): Promise<void> {
  const existing = await db.bodyWeights.where('date').equals(date).filter(b => !b.deleted).first();
  if (existing) {
    await db.bodyWeights.update(existing.id, { weightKg, note, ...touchSyncMeta() });
  } else {
    await db.bodyWeights.add({ id: newId(), date, weightKg, note, createdAt: new Date(), ...freshSyncMeta() });
  }
}

export async function deleteBodyWeight(id: string): Promise<void> {
  await db.bodyWeights.update(id, tombstonePatch());
}
