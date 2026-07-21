import { useLiveQuery } from 'dexie-react-hooks';
import { db, type AppSettings } from '../db/index';

const DEFAULTS: AppSettings = {
  id: 1,
  oneRMFormula: 'epley',
  muscleDetailLevel: 'global',
  macroGoals: { calories: null, protein: null, carbs: null, fat: null },
  restTimerSeconds: 90,
  restDefaults: {
    bilateralCompound: 180,
    unilateralCompound: 90,
    bilateralIsolation: 60,
    unilateralIsolation: 15,
  },
  restTimerVibrate: true,
  restTimerSound: true,
  features: { nutrition: false, planner: false },
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
  const row = useLiveQuery(() => db.settings.get(1));
  if (!row) return DEFAULTS;
  // Merge defaults so rows saved before a field was introduced stay valid
  return {
    ...DEFAULTS,
    ...row,
    features: { ...DEFAULTS.features, ...row.features },
  };
}

/**
 * Returns whether an optional feature is enabled, or `undefined` while settings
 * are still loading from IndexedDB (so route guards don't redirect prematurely).
 */
export function useFeatureEnabled(
  feature: keyof AppSettings['features'],
): boolean | undefined {
  const row = useLiveQuery(() => db.settings.get(1));
  if (row === undefined) return undefined; // still loading
  return { ...DEFAULTS.features, ...row.features }[feature];
}

export async function updateSettings(patch: Partial<Omit<AppSettings, 'id'>>): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const current = (await db.settings.get(1)) ?? DEFAULTS;
    await db.settings.put({ ...current, ...patch, id: 1 });
  });
}
