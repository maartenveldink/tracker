/** A local (not UTC) YYYY-MM-DD string for the given date. */
export function toISODate(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Today's date as a local (not UTC) YYYY-MM-DD string. */
export function todayISO(): string {
  return toISODate(new Date());
}

/** Weekday index for a date in our convention: 0=Mon … 6=Sun. */
export function weekdayOf(d: Date): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  // JS: 0=Sun,1=Mon,...,6=Sat  →  We want: 0=Mon,...,6=Sun
  return ((d.getDay() + 6) % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
}

/** Convert JS Date.getDay() (0=Sun) to our weekday index (0=Mon). */
export function getTodayWeekday(): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  return weekdayOf(new Date());
}
