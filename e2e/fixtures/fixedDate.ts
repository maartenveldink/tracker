import type { Page } from '@playwright/test';

/**
 * Pins the app's notion of "now" (Date.now / new Date()) to `iso` for every page
 * load in this test. Timers keep running normally.
 *
 * Deliberately not `page.clock.setFixedTime`: Playwright's fake Date class makes
 * Dexie-hydrated rows throw "this is not a Date object" in the app. Call before the first `goto`.
 */
export async function fixDate(page: Page, iso: string): Promise<void> {
  const target = new Date(iso).getTime();
  await page.addInitScript(fixed => {
    const Native = Date;
    const offset = fixed - Native.now();
    // A Proxy (not a subclass) so every constructed value is a genuine native
    // Date: IndexedDB round-trips and Dexie keep working.
    const Shifted = new Proxy(Native, {
      construct(target, args: unknown[]) {
        return args.length === 0
          ? new target(Native.now() + offset)
          : Reflect.construct(target, args);
      },
      get(target, prop, receiver) {
        if (prop === 'now') return () => Native.now() + offset;
        return Reflect.get(target, prop, receiver);
      },
    });
    // Keep `date.constructor === Date` true: Dexie clones rows by constructor.
    Native.prototype.constructor = Shifted;
    globalThis.Date = Shifted;
  }, target);
}
