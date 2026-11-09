import { useEffect } from 'react';

/**
 * Keeps the screen on while `active` (Screen Wake Lock API). The browser drops
 * the lock when the tab is hidden, so it is requested again on return.
 * Silently does nothing where the API is unavailable or denied.
 */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled) void lock.release();
        else sentinel = lock;
      } catch {
        // Denied (e.g. low battery) — not essential.
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release();
    };
  }, [active]);
}
