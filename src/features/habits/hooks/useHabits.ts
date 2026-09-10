import { useLiveQuery } from 'dexie-react-hooks';
import { db, newId, freshSyncMeta, touchSyncMeta, tombstonePatch, type Habit, type HabitLog, type HabitSchedule, type HabitType } from '../../../db/index';

/** Reactive list of habits, ordered; archived (and deleted) excluded by default. */
export function useHabits(includeArchived = false): Habit[] {
  return (
    useLiveQuery(async () => {
      const all = await db.habits.orderBy('order').filter(h => !h.deleted).toArray();
      return includeArchived ? all : all.filter(h => !h.archived);
    }, [includeArchived]) ?? []
  );
}

/** Reactive list of all (non-deleted) habit logs. */
export function useHabitLogs(): HabitLog[] {
  return useLiveQuery(() => db.habitLogs.filter(l => !l.deleted).toArray()) ?? [];
}

/** Reactive single habit by id. */
export function useHabit(id: string | undefined): Habit | undefined {
  return useLiveQuery(async () => {
    if (id == null) return undefined;
    const h = await db.habits.get(id);
    return h && !h.deleted ? h : undefined;
  }, [id]);
}

export interface HabitInput {
  name: string;
  emoji?: string;
  color?: string;
  type: HabitType;
  target?: number;
  unit?: string;
  schedule: HabitSchedule;
}

export async function createHabit(input: HabitInput): Promise<string> {
  const last = await db.habits.orderBy('order').last();
  const order = (last?.order ?? -1) + 1;
  const id = newId();
  await db.habits.add({ ...input, id, order, archived: false, createdAt: new Date(), ...freshSyncMeta() });
  return id;
}

export async function updateHabit(id: string, changes: Partial<HabitInput>): Promise<void> {
  await db.habits.update(id, { ...changes, ...touchSyncMeta() });
}

export async function archiveHabit(id: string, archived = true): Promise<void> {
  await db.habits.update(id, { archived, ...touchSyncMeta() });
}

export async function deleteHabit(id: string): Promise<void> {
  await db.transaction('rw', db.habits, db.habitLogs, async () => {
    // Soft-delete the habit and all its logs so the deletion propagates on sync.
    const logs = await db.habitLogs.where('habitId').equals(id).toArray();
    await Promise.all(logs.map(l => db.habitLogs.update(l.id, tombstonePatch())));
    await db.habits.update(id, tombstonePatch());
  });
}

export async function reorderHabits(orderedIds: string[]): Promise<void> {
  await db.transaction('rw', db.habits, async () => {
    await Promise.all(orderedIds.map((id, i) => db.habits.update(id, { order: i, ...touchSyncMeta() })));
  });
}

/** Upsert one habit log for a day. A value ≤ 0 tombstones the row. */
export async function setHabitLog(habitId: string, date: string, value: number): Promise<void> {
  await db.transaction('rw', db.habitLogs, async () => {
    const existing = await db.habitLogs.where('[habitId+date]').equals([habitId, date]).first();
    if (value <= 0) {
      if (existing) await db.habitLogs.update(existing.id, tombstonePatch());
      return;
    }
    if (existing) await db.habitLogs.update(existing.id, { value, deleted: false, ...touchSyncMeta() });
    else await db.habitLogs.add({ id: newId(), habitId, date, value, createdAt: new Date(), ...freshSyncMeta() });
  });
}

/** Toggle a boolean habit for a day (done ↔ not done). */
export async function toggleHabit(habitId: string, date: string): Promise<void> {
  const existing = await db.habitLogs.where('[habitId+date]').equals([habitId, date]).filter(l => !l.deleted).first();
  const done = (existing?.value ?? 0) >= 1;
  await setHabitLog(habitId, date, done ? 0 : 1);
}

/** Step a count habit's value for a day, clamped to [0, max]. */
export async function stepHabitCount(
  habitId: string,
  date: string,
  delta: number,
  max?: number,
): Promise<void> {
  const existing = await db.habitLogs.where('[habitId+date]').equals([habitId, date]).filter(l => !l.deleted).first();
  let next = (existing?.value ?? 0) + delta;
  if (next < 0) next = 0;
  if (max != null && next > max) next = max;
  await setHabitLog(habitId, date, next);
}
