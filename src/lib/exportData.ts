import {
  db,
  type Exercise,
  type TrainingSchema,
  type Workout,
  type Food,
  type Recipe,
  type DailyLogEntry,
  type BodyWeightEntry,
  type AppSettings,
} from '@/db/index';

export const EXPORT_VERSION = 1;

export interface TrackerExport {
  exportVersion: typeof EXPORT_VERSION;
  exportedAt: string;
  exercises: Exercise[];
  schemas: TrainingSchema[];
  workouts: Workout[];
  foods: Food[];
  recipes: Recipe[];
  dailyLog: DailyLogEntry[];
  bodyWeights: BodyWeightEntry[];
  settings: AppSettings | undefined;
}

/**
 * Collects all user data from the database for export.
 * Default (seed) exercises are excluded — only user-created exercises are exported.
 */
export async function exportAllData(): Promise<TrackerExport> {
  const [allExercises, schemas, workouts, foods, recipes, dailyLog, bodyWeights, settings] =
    await Promise.all([
      db.exercises.toArray(),
      db.schemas.toArray(),
      db.workouts.toArray(),
      db.foods.toArray(),
      db.recipes.toArray(),
      db.dailyLog.toArray(),
      db.bodyWeights.toArray(),
      db.settings.get(1),
    ]);

  // Only export user-created exercises (isDefault === false)
  const exercises = allExercises.filter((e) => !e.isDefault);

  return {
    exportVersion: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    exercises,
    schemas,
    workouts,
    foods,
    recipes,
    dailyLog,
    bodyWeights,
    settings,
  };
}

/**
 * Returns true when the database has no meaningful user data to export.
 */
export async function hasExportableData(): Promise<boolean> {
  const [workoutCount, schemaCount, foodCount, recipeCount, dailyLogCount, bodyWeightCount] =
    await Promise.all([
      db.workouts.count(),
      db.schemas.count(),
      db.foods.count(),
      db.recipes.count(),
      db.dailyLog.count(),
      db.bodyWeights.count(),
    ]);
  return workoutCount + schemaCount + foodCount + recipeCount + dailyLogCount + bodyWeightCount > 0;
}

/**
 * Triggers a browser download of the given export data as a JSON file.
 */
export function downloadExport(data: TrackerExport): void {
  const date = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tracker-export-${date}.json`;
  a.click();
  // Delay revoke to ensure Firefox has time to initiate the download
  setTimeout(() => URL.revokeObjectURL(url), 100);
}
