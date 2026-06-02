import { useLiveQuery } from 'dexie-react-hooks';
import { db, type AppSettings } from '../db/index';

const DEFAULTS: AppSettings = {
  id: 1,
  oneRMFormula: 'epley',
  muscleDetailLevel: 'global',
  macroGoals: { calories: null, protein: null, carbs: null, fat: null },
};

export function useSettings(): AppSettings {
  return useLiveQuery(async () => {
    let settings = await db.settings.get(1);
    if (!settings) {
      await db.settings.put(DEFAULTS);
      settings = DEFAULTS;
    }
    return settings;
  }) ?? DEFAULTS;
}

export async function updateSettings(patch: Partial<Omit<AppSettings, 'id'>>): Promise<void> {
  await db.transaction('rw', db.settings, async () => {
    const current = (await db.settings.get(1)) ?? DEFAULTS;
    await db.settings.put({ ...current, ...patch, id: 1 });
  });
}
