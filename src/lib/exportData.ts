import {
  db,
  type Exercise,
  type TrainingSchema,
  type Workout,
  type BodyWeightEntry,
  type Habit,
  type HabitLog,
  type AppSettings,
} from '@/db/index';

export const EXPORT_VERSION = 1;

export interface TrackerExport {
  exportVersion: typeof EXPORT_VERSION;
  exportedAt: string;
  exercises: Exercise[];
  schemas: TrainingSchema[];
  workouts: Workout[];
  bodyWeights: BodyWeightEntry[];
  habits: Habit[];
  habitLogs: HabitLog[];
  settings: AppSettings | undefined;
}

/**
 * Collects all user data from the database for export.
 * Default (seed) exercises are excluded — only user-created exercises are exported.
 */
export async function exportAllData(): Promise<TrackerExport> {
  const [allExercises, schemas, workouts, bodyWeights, habits, habitLogs, settings] =
    await Promise.all([
      db.exercises.toArray(),
      db.schemas.toArray(),
      db.workouts.toArray(),
      db.bodyWeights.toArray(),
      db.habits.toArray(),
      db.habitLogs.toArray(),
      db.settings.get(1),
    ]);

  // Only export user-created, non-deleted exercises; drop tombstones everywhere.
  const exercises = allExercises.filter((e) => !e.isDefault && !e.deleted);

  return {
    exportVersion: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    exercises,
    schemas: schemas.filter((s) => !s.deleted),
    workouts: workouts.filter((w) => !w.deleted),
    bodyWeights: bodyWeights.filter((b) => !b.deleted),
    habits: habits.filter((h) => !h.deleted),
    habitLogs: habitLogs.filter((l) => !l.deleted),
    settings,
  };
}

/**
 * Returns true when the database has no meaningful user data to export.
 */
export async function hasExportableData(): Promise<boolean> {
  const [workoutCount, schemaCount, bodyWeightCount, habitCount] =
    await Promise.all([
      db.workouts.filter(w => !w.deleted).count(),
      db.schemas.filter(s => !s.deleted).count(),
      db.bodyWeights.filter(b => !b.deleted).count(),
      db.habits.filter(h => !h.deleted).count(),
    ]);
  return workoutCount + schemaCount + bodyWeightCount + habitCount > 0;
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
