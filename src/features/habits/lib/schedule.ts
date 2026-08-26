import type { Habit, HabitLog, HabitSchedule } from '../../../db/index';
import { toISODate, weekdayOf } from '../../../lib/dateUtils';

/**
 * Pure helpers for habit schedules and streaks. Dates are handled as local
 * YYYY-MM-DD keys (see {@link toISODate}); weekday convention is 0=Mon … 6=Sun.
 */

/** Whole days between two local dates (b − a), ignoring time-of-day. */
function daysBetween(aISO: string, b: Date): number {
  const a = new Date(`${aISO}T00:00:00`);
  const bMid = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((bMid.getTime() - a.getTime()) / 86_400_000);
}

/** Whether a habit is "due" on the given date, per its schedule. */
export function isScheduledOn(schedule: HabitSchedule, date: Date): boolean {
  switch (schedule.kind) {
    case 'daily':
      return true;
    case 'interval': {
      const diff = daysBetween(schedule.anchor, date);
      return diff >= 0 && schedule.everyDays >= 1 && diff % schedule.everyDays === 0;
    }
    case 'weekdays':
      return schedule.days.includes(weekdayOf(date));
    case 'monthdays':
      // Days that don't exist in a month (e.g. 31 in February) simply never match.
      return schedule.days.includes(date.getDate());
  }
}

/** Builds a YYYY-MM-DD → done map for one habit from its logs. */
export function doneByDateForHabit(
  habit: Pick<Habit, 'id' | 'type' | 'target'>,
  logs: HabitLog[],
): Map<string, boolean> {
  const map = new Map<string, boolean>();
  for (const log of logs) {
    if (log.habitId !== habit.id) continue;
    if (isHabitDone(habit, log.value)) map.set(log.date, true);
  }
  return map;
}

/** Whether a logged value counts the habit as done on a day. */
export function isHabitDone(habit: Pick<Habit, 'type' | 'target'>, value: number | undefined): boolean {
  if (value == null) return false;
  if (habit.type === 'count') return value >= Math.max(1, habit.target ?? 1);
  return value >= 1;
}

/**
 * Consecutive scheduled days completed, counting back from `today`. Non-scheduled
 * days are skipped (they don't break the streak). If today is scheduled but not
 * yet done, that doesn't break the streak either — counting starts the day before.
 *
 * `doneByDate` maps a YYYY-MM-DD key to whether the habit was done that day.
 */
export function habitStreak(
  habit: Pick<Habit, 'schedule'>,
  doneByDate: Map<string, boolean>,
  today: Date = new Date(),
  maxLookbackDays = 366,
): number {
  let streak = 0;
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let isFirst = true;

  for (let i = 0; i <= maxLookbackDays; i++) {
    if (isScheduledOn(habit.schedule, cursor)) {
      const done = doneByDate.get(toISODate(cursor)) === true;
      if (done) {
        streak++;
      } else if (isFirst) {
        // Today (the most recent scheduled day) not done yet: don't break.
      } else {
        break;
      }
      isFirst = false;
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

/**
 * Fraction (0–1) of scheduled days in `[from, to]` on which the habit was done.
 * Returns 0 when there were no scheduled days in the range.
 */
export function completionRate(
  habit: Pick<Habit, 'schedule'>,
  doneByDate: Map<string, boolean>,
  from: Date,
  to: Date,
): number {
  let scheduled = 0;
  let done = 0;
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(to.getFullYear(), to.getMonth(), to.getDate());

  while (cursor <= end) {
    if (isScheduledOn(habit.schedule, cursor)) {
      scheduled++;
      if (doneByDate.get(toISODate(cursor)) === true) done++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return scheduled === 0 ? 0 : done / scheduled;
}
