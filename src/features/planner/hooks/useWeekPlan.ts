import { useLiveQuery } from 'dexie-react-hooks';
import { db, type WeekPlan, type WeekPlanDay } from '../../../db/index';

/** All week plans, ordered by name. */
export function useWeekPlans(): WeekPlan[] {
  return useLiveQuery(() => db.weekPlans.orderBy('name').toArray()) ?? [];
}

/** The most recently updated week plan — acts as the "active" plan. */
export function useActiveWeekPlan(): WeekPlan | undefined {
  return useLiveQuery(async () => {
    // `updatedAt` is not an index, so sort in memory (orderBy would throw a
    // Dexie SchemaError). The most recently updated plan is the active one.
    const all = await db.weekPlans.toArray();
    return all.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
  });
}

/** A single week plan by id. */
export function useWeekPlan(id: number | undefined): WeekPlan | undefined {
  return useLiveQuery(
    () => (id ? db.weekPlans.get(id) : undefined),
    [id],
  );
}

export async function createWeekPlan(name: string, days: WeekPlanDay[]): Promise<number> {
  const now = new Date();
  const id = await db.weekPlans.add({
    name,
    days,
    createdAt: now,
    updatedAt: now,
  });
  return id as number;
}

export async function updateWeekPlan(
  id: number,
  data: Partial<Pick<WeekPlan, 'name' | 'days'>>,
): Promise<void> {
  await db.weekPlans.update(id, { ...data, updatedAt: new Date() });
}

export async function deleteWeekPlan(id: number): Promise<void> {
  await db.weekPlans.delete(id);
}
