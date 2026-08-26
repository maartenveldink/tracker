import { db, type AppSettings } from '../../../db/index';
import { seedDatabase } from './seed';

const SETTINGS_DEFAULTS: AppSettings = {
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
 * Wipes all data and re-seeds the default exercise library.
 * Called by the "Alles wissen" button in Settings.
 */
export async function clearAllData(): Promise<void> {
  await db.transaction(
    'rw',
    [db.exercises, db.schemas, db.workouts, db.bodyWeights, db.habits, db.habitLogs, db.settings],
    async () => {
      await db.workouts.clear();
      await db.schemas.clear();
      await db.exercises.clear();
      await db.bodyWeights.clear();
      await db.habits.clear();
      await db.habitLogs.clear();
      await db.settings.put(SETTINGS_DEFAULTS);
    },
  );
  await seedDatabase();
}
