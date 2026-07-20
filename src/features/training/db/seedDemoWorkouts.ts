import { db, type AppSettings } from '../../../db/index';
import { seedDatabase } from './seed';

const SETTINGS_DEFAULTS: AppSettings = {
  id: 1,
  oneRMFormula: 'epley',
  muscleDetailLevel: 'global',
  macroGoals: { calories: null, protein: null, carbs: null, fat: null },
  restTimerSeconds: 90,
  features: { nutrition: false, planner: false },
};

/**
 * Wipes all data and re-seeds the default exercise library.
 * Called by the "Alles wissen" button in Settings.
 */
export async function clearAllData(): Promise<void> {
  await db.transaction('rw', [db.exercises, db.schemas, db.workouts, db.foods, db.recipes, db.dailyLog, db.settings, db.weekPlans], async () => {
    await db.workouts.clear();
    await db.schemas.clear();
    await db.exercises.clear();
    await db.foods.clear();
    await db.recipes.clear();
    await db.dailyLog.clear();
    await db.weekPlans.clear();
    await db.settings.put(SETTINGS_DEFAULTS);
    // Note: Google Health tokens and health data are NOT cleared here — the user
    // manages that via the dedicated "Ontkoppel Google Health" button (E7-10).
  });
  await seedDatabase();
}
