import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Habit, type HabitLog, type HabitSchedule, type HabitType } from '../../../db/index';

/** Reactive list of habits, ordered; archived excluded by default. */
export function useHabits(includeArchived = false): Habit[] {
  return (
    useLiveQuery(async () => {
      const all = await db.habits.orderBy('order').toArray();
      return includeArchived ? all : all.filter(h => !h.archived);
    }, [includeArchived]) ?? []
  );
}

/** Reactive list of all habit logs. */
export function useHabitLogs(): HabitLog[] {
  return useLiveQuery(() => db.habitLogs.toArray()) ?? [];
}

/** Reactive single habit by id. */
export function useHabit(id: number | undefined): Habit | undefined {
  return useLiveQuery(() => (id == null ? undefined : db.habits.get(id)), [id]);
}

export interface HabitInput {
  name: string;
  emoji?: string;
  color?: string;
  type: HabitType;
  target?: number;
  schedule: HabitSchedule;
}

export async function createHabit(input: HabitInput): Promise<number> {
  const last = await db.habits.orderBy('order').last();
  const order = (last?.order ?? -1) + 1;
  const id = await db.habits.add({ ...input, order, archived: false, createdAt: new Date() });
  return id as number;
}

export async function updateHabit(id: number, changes: Partial<HabitInput>): Promise<void> {
  await db.habits.update(id, changes);
}

export async function archiveHabit(id: number, archived = true): Promise<void> {
  await db.habits.update(id, { archived });
}

export async function deleteHabit(id: number): Promise<void> {
  await db.transaction('rw', db.habits, db.habitLogs, async () => {
    await db.habitLogs.where('habitId').equals(id).delete();
    await db.habits.delete(id);
  });
}

export async function reorderHabits(orderedIds: number[]): Promise<void> {
  await db.transaction('rw', db.habits, async () => {
    await Promise.all(orderedIds.map((id, i) => db.habits.update(id, { order: i })));
  });
}

/** Upsert one habit log for a day. A value ≤ 0 removes the row. */
export async function setHabitLog(habitId: number, date: string, value: number): Promise<void> {
  await db.transaction('rw', db.habitLogs, async () => {
    const existing = await db.habitLogs.where('[habitId+date]').equals([habitId, date]).first();
    if (value <= 0) {
      if (existing?.id != null) await db.habitLogs.delete(existing.id);
      return;
    }
    if (existing?.id != null) await db.habitLogs.update(existing.id, { value });
    else await db.habitLogs.add({ habitId, date, value, createdAt: new Date() });
  });
}

/** Toggle a boolean habit for a day (done ↔ not done). */
export async function toggleHabit(habitId: number, date: string): Promise<void> {
  const existing = await db.habitLogs.where('[habitId+date]').equals([habitId, date]).first();
  const done = (existing?.value ?? 0) >= 1;
  await setHabitLog(habitId, date, done ? 0 : 1);
}

/** Step a count habit's value for a day, clamped to [0, max]. */
export async function stepHabitCount(
  habitId: number,
  date: string,
  delta: number,
  max?: number,
): Promise<void> {
  const existing = await db.habitLogs.where('[habitId+date]').equals([habitId, date]).first();
  let next = (existing?.value ?? 0) + delta;
  if (next < 0) next = 0;
  if (max != null && next > max) next = max;
  await setHabitLog(habitId, date, next);
}
