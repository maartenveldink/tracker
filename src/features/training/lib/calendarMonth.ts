import type { Workout } from '../../../db';
import { localDateKey } from './metrics';

export const MONTH_NAMES = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december',
];

export interface CalendarCell {
  /** Day of month, 1-based. */
  day: number;
  /** Local YYYY-MM-DD key (same format as `localDateKey`). */
  key: string;
}

export interface MonthRef {
  year: number;
  /** 0 = januari … 11 = december. */
  month: number;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Number of days in a month (handles leap years); `month` is 0-based. */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Month grid with weeks starting on Monday. Each week has exactly 7 entries;
 * days outside the month are `null` (padding before the 1st / after the last).
 * Keys are built from the calendar numbers, never via UTC, so they match
 * `localDateKey` in every timezone.
 */
export function buildMonthGrid(year: number, month: number): (CalendarCell | null)[][] {
  const lead = (new Date(year, month, 1).getDay() + 6) % 7; // 0 = Monday
  const total = daysInMonth(year, month);
  const cells: (CalendarCell | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= total; day++) {
    cells.push({ day, key: `${year}-${pad(month + 1)}-${pad(day)}` });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (CalendarCell | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Month `delta` months away from `ref`, rolling over year boundaries. */
export function shiftMonth(ref: MonthRef, delta: number): MonthRef {
  const index = ref.year * 12 + ref.month + delta;
  return { year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 };
}

/** Workouts grouped by the local day they were started, each day oldest first. */
export function workoutsByDay(workouts: Workout[]): Map<string, Workout[]> {
  const map = new Map<string, Workout[]>();
  for (const w of workouts) {
    const key = localDateKey(w.startedAt);
    const list = map.get(key);
    if (list) list.push(w);
    else map.set(key, [w]);
  }
  for (const list of map.values()) {
    list.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  }
  return map;
}

/** Dutch long day label, e.g. "6 november" (or "6 november 2025" with `withYear`). */
export function formatDayLabel(key: string, withYear = false): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return `${d} ${MONTH_NAMES[m - 1]}${withYear ? ` ${y}` : ''}`;
}
