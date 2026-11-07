import { useSyncExternalStore } from 'react';

/**
 * "Hide the deload notice for a week", stored device-locally.
 *
 * Deliberately NOT in `AppSettings`/Dexie (that row is synced and exported):
 * it lives in `localStorage` under its own key. `clearDeloadDismissal()` is
 * called from `clearAllData()`, like `clearCoachConfig()` for `tracker.coach.*`.
 */

export const DELOAD_DISMISSED_STORAGE = 'tracker.deload.dismissedUntil';
export const DELOAD_SNOOZE_DAYS = 7;

const listeners = new Set<() => void>();
function notify() {
  for (const l of listeners) l();
}

/** Epoch ms until which the notice is hidden (0 = not dismissed). */
export function getDeloadDismissedUntil(): number {
  try {
    const n = Number(localStorage.getItem(DELOAD_DISMISSED_STORAGE));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** Hides the notice for DELOAD_SNOOZE_DAYS days. */
export function dismissDeloadNotice(now: number = Date.now()): void {
  try {
    localStorage.setItem(
      DELOAD_DISMISSED_STORAGE,
      String(now + DELOAD_SNOOZE_DAYS * 86400000),
    );
  } catch {
    // storage unavailable: the notice just comes back on reload
  }
  notify();
}

export function clearDeloadDismissal(): void {
  try {
    localStorage.removeItem(DELOAD_DISMISSED_STORAGE);
  } catch {
    // nothing stored
  }
  notify();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Reactive dismissed-until timestamp. */
export function useDeloadDismissedUntil(): number {
  return useSyncExternalStore(subscribe, getDeloadDismissedUntil, () => 0);
}
