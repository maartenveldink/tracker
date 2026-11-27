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
  celebrationEnabled: true,
  celebrationVibrate: true,
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
  return useSettingsState().settings;
}

/**
 * Settings plus whether the stored row has been read. Use `loaded` before a
 * one-off decision that depends on a setting (e.g. playing a celebration once),
 * so the defaults aren't acted on while the real row is still loading.
 */
export function useSettingsState(): { settings: AppSettings; loaded: boolean } {
  // `null` = read and absent, `undefined` = still loading.
  const row = useLiveQuery(async () => (await db.settings.get(1)) ?? null);
  if (!row) return { settings: DEFAULTS, loaded: row === null };
  // Merge defaults so rows saved before a field was introduced stay valid
  return {
    settings: {
      ...DEFAULTS,
      ...row,
      weightSteps: { ...DEFAULTS.weightSteps, ...row.weightSteps },
    },
    loaded: true,
  };
}

export async function updateSettings(patch: Partial<Omit<AppSettings, 'id'>>): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const current = (await db.settings.get(1)) ?? DEFAULTS;
    await db.settings.put({ ...current, ...patch, id: 1, clientUpdatedAt: Date.now(), dirty: 1 });
  });
}
