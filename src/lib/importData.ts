import {
  db,
  type Exercise,
  type TrainingSchema,
  type Workout,
  type BodyWeightEntry,
  type Habit,
  type HabitLog,
} from '@/db/index';
import { EXPORT_VERSION, type TrackerExport } from './exportData';
import { seedDatabase } from '@/features/training/db/seed';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Validates raw parsed JSON against the TrackerExport schema.
 * Throws a descriptive error when the structure is invalid.
 */
export function validateExport(raw: unknown): TrackerExport {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Ongeldig bestand: geen geldig JSON-object.');
  }

  const obj = raw as Record<string, unknown>;

  if (obj['exportVersion'] !== EXPORT_VERSION) {
    throw new Error(
      `Onbekende exportversie: ${String(obj['exportVersion'])}. Verwacht: ${EXPORT_VERSION}.`,
    );
  }

  const requiredArrays: (keyof TrackerExport)[] = ['exercises', 'schemas', 'workouts'];

  for (const field of requiredArrays) {
    if (!Array.isArray(obj[field])) {
      throw new Error(`Verplicht veld "${field}" ontbreekt of is geen array.`);
    }
  }

  return raw as TrackerExport;
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

export type ImportMode = 'replace' | 'merge';

export interface ImportResult {
  exercises: number;
  schemas: number;
  workouts: number;
  bodyWeights: number;
  habits: number;
  habitLogs: number;
}

/**
 * Strips the `id` property from a record so Dexie generates a new auto-increment key.
 */
function stripId<T extends { id?: number }>(record: T): Omit<T, 'id'> {
  const { id: _, ...rest } = record;
  return rest;
}

/**
 * Imports data into the database.
 *
 * - **replace**: clears all tables, then inserts everything using original IDs (bulkPut).
 *   After inserting, re-seeds the default exercise library so seed exercises are present.
 * - **merge**: appends records with new auto-generated IDs (no conflicts with existing data).
 *   Foreign-key references (exerciseId) are remapped to the new IDs.
 *
 * The entire operation runs inside a Dexie transaction so a failure rolls everything back.
 */
export async function importData(
  data: TrackerExport,
  mode: ImportMode,
): Promise<ImportResult> {
  // bodyWeights, habits and habitLogs are optional for backward compatibility.
  const bodyWeights = data.bodyWeights ?? [];
  const habits = data.habits ?? [];
  const habitLogs = data.habitLogs ?? [];

  const result: ImportResult = {
    exercises: data.exercises.length,
    schemas: data.schemas.length,
    workouts: data.workouts.length,
    bodyWeights: bodyWeights.length,
    habits: habits.length,
    habitLogs: habitLogs.length,
  };

  await db.transaction(
    'rw',
    [db.exercises, db.schemas, db.workouts, db.bodyWeights, db.habits, db.habitLogs, db.settings],
    async () => {
      if (mode === 'replace') {
        // Wipe all tables
        await db.exercises.clear();
        await db.schemas.clear();
        await db.workouts.clear();
        await db.bodyWeights.clear();
        await db.habits.clear();
        await db.habitLogs.clear();

        // Insert with original IDs preserved (bulkPut accepts explicit keys)
        await db.exercises.bulkPut(data.exercises as Exercise[]);
        await db.schemas.bulkPut(data.schemas as TrainingSchema[]);
        await db.workouts.bulkPut(data.workouts as Workout[]);
        await db.bodyWeights.bulkPut(bodyWeights as BodyWeightEntry[]);
        await db.habits.bulkPut(habits as Habit[]);
        await db.habitLogs.bulkPut(habitLogs as HabitLog[]);

        // Restore settings if present, otherwise keep defaults
        if (data.settings) {
          await db.settings.put({ ...data.settings, id: 1 });
        }
      } else {
        // -------------------------------------------------------------------
        // Merge: strip IDs so Dexie auto-generates new ones, then remap
        // exerciseId references so schemas/workouts stay consistent.
        // -------------------------------------------------------------------

        // Step 1: add exercises, build old → new ID map
        const exerciseIdMap = new Map<number, number>();
        if (data.exercises.length > 0) {
          const newIds = await db.exercises.bulkAdd(
            data.exercises.map(stripId) as Exercise[],
            { allKeys: true },
          );
          data.exercises.forEach((ex, i) => {
            const oldId = ex.id;
            const newId = (newIds as number[])[i];
            if (oldId !== undefined && newId !== undefined) {
              exerciseIdMap.set(oldId, newId);
            }
          });
        }
        const remapExId = (id: number): number => exerciseIdMap.get(id) ?? id;

        // Step 2: add schemas with remapped exerciseIds
        if (data.schemas.length > 0) {
          const remappedSchemas = data.schemas.map(schema => ({
            ...stripId(schema),
            exercises: schema.exercises.map(e => ({ ...e, exerciseId: remapExId(e.exerciseId) })),
            days: schema.days?.map(day => ({
              ...day,
              exercises: day.exercises.map(e => ({ ...e, exerciseId: remapExId(e.exerciseId) })),
            })),
          }));
          await db.schemas.bulkAdd(remappedSchemas as TrainingSchema[]);
        }

        // Step 3: add workouts with remapped exerciseIds (exercises and sets)
        if (data.workouts.length > 0) {
          const remappedWorkouts = data.workouts.map(workout => ({
            ...stripId(workout),
            exercises: workout.exercises.map(e => ({
              ...e,
              exerciseId: remapExId(e.exerciseId),
              sets: e.sets.map(s => ({ ...s, exerciseId: remapExId(s.exerciseId) })),
            })),
          }));
          await db.workouts.bulkAdd(remappedWorkouts as Workout[]);
        }

        // Step 4: add body weights (no foreign keys; strip IDs for fresh keys)
        if (bodyWeights.length > 0) {
          await db.bodyWeights.bulkAdd(bodyWeights.map(stripId) as BodyWeightEntry[]);
        }

        // Step 5: add habits, build old → new ID map, then remap habit logs
        const habitIdMap = new Map<number, number>();
        if (habits.length > 0) {
          const newIds = await db.habits.bulkAdd(habits.map(stripId) as Habit[], { allKeys: true });
          habits.forEach((h, i) => {
            const oldId = h.id;
            const newId = (newIds as number[])[i];
            if (oldId !== undefined && newId !== undefined) habitIdMap.set(oldId, newId);
          });
        }
        if (habitLogs.length > 0) {
          const remappedLogs = habitLogs.map(log => ({
            ...stripId(log),
            habitId: habitIdMap.get(log.habitId) ?? log.habitId,
          }));
          await db.habitLogs.bulkAdd(remappedLogs as HabitLog[]);
        }

        // In merge mode we do not overwrite settings
      }
    },
  );

  // In replace mode, re-seed default exercises (they were wiped and only user exercises were in the export)
  if (mode === 'replace') {
    await seedDatabase();
  }

  return result;
}
