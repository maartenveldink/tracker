/** Convert JS Date.getDay() (0=Sun) to our weekday index (0=Mon). */
export function getTodayWeekday(): 0 | 1 | 2 | 3 | 4 | 5 | 6 {
  const jsDay = new Date().getDay();
  // JS: 0=Sun,1=Mon,...,6=Sat  →  We want: 0=Mon,...,6=Sun
  return ((jsDay + 6) % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
}
