import { useLiveQuery } from 'dexie-react-hooks';
import { db, type AppSettings } from '../db/index';

const DEFAULTS: AppSettings = {
  id: 1,
  oneRMFormula: 'epley',
  muscleDetailLevel: 'global',
  workoutDensity: 'comfortable',
  restTimerSeconds: 90,
  weightSteps: {
    cable: { value: 5, unit: 'lb' },
    dumbbell: { value: 2, unit: 'kg' },
    plates: { value: 1.25, unit: 'kg' },
    other: { value: 1, unit: 'kg' },
  },
  restDefaults: {
    bilateralCompound: 180,
    unilateralCompound: 90,
    bilateralIsolation: 60,
    unilateralIsolation: 15,
  },
  restTimerVibrate: true,
  restTimerSound: true,
  exerciseTransitionSeconds: 45,
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
    weightSteps: { ...DEFAULTS.weightSteps, ...row.weightSteps },
  };
}

export async function updateSettings(patch: Partial<Omit<AppSettings, 'id'>>): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const current = (await db.settings.get(1)) ?? DEFAULTS;
    await db.settings.put({ ...current, ...patch, id: 1 });
  });
}
