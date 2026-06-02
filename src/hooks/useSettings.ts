import { useLiveQuery } from 'dexie-react-hooks';
import { db, type AppSettings } from '../db/index';

const DEFAULTS: AppSettings = {
  id: 1,
  oneRMFormula: 'epley',
  muscleDetailLevel: 'global',
  macroGoals: { calories: null, protein: null, carbs: null, fat: null },
  restTimerSeconds: 90,
};

/**
 * Ensures settings row (id=1) exists. Call once at startup, before rendering.
 * Needed for fresh installs that skip the v4 upgrade callback.
 */
export async function initSettings(): Promise<void> {
  const existing = await db.settings.get(1);
  if (!existing) {
    await db.settings.put(DEFAULTS);
  }
}

export function useSettings(): AppSettings {
  return useLiveQuery(() => db.settings.get(1)) ?? DEFAULTS;
}

export async function updateSettings(patch: Partial<Omit<AppSettings, 'id'>>): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const current = (await db.settings.get(1)) ?? DEFAULTS;
    await db.settings.put({ ...current, ...patch, id: 1 });
  });
}
