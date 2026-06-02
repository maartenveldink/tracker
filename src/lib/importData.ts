import {
  db,
  type Exercise,
  type TrainingSchema,
  type Workout,
  type Food,
  type Recipe,
  type DailyLogEntry,
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

  const requiredArrays: (keyof TrackerExport)[] = [
    'exercises',
    'schemas',
    'workouts',
    'foods',
    'recipes',
    'dailyLog',
  ];

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
  foods: number;
  recipes: number;
  dailyLog: number;
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
 *
 * The entire operation runs inside a Dexie transaction so a failure rolls everything back.
 */
export async function importData(
  data: TrackerExport,
  mode: ImportMode,
): Promise<ImportResult> {
  const result: ImportResult = {
    exercises: data.exercises.length,
    schemas: data.schemas.length,
    workouts: data.workouts.length,
    foods: data.foods.length,
    recipes: data.recipes.length,
    dailyLog: data.dailyLog.length,
  };

  await db.transaction(
    'rw',
    [db.exercises, db.schemas, db.workouts, db.foods, db.recipes, db.dailyLog, db.settings],
    async () => {
      if (mode === 'replace') {
        // Wipe all tables
        await db.exercises.clear();
        await db.schemas.clear();
        await db.workouts.clear();
        await db.foods.clear();
        await db.recipes.clear();
        await db.dailyLog.clear();

        // Insert with original IDs preserved (bulkPut accepts explicit keys)
        await db.exercises.bulkPut(data.exercises as Exercise[]);
        await db.schemas.bulkPut(data.schemas as TrainingSchema[]);
        await db.workouts.bulkPut(data.workouts as Workout[]);
        await db.foods.bulkPut(data.foods as Food[]);
        await db.recipes.bulkPut(data.recipes as Recipe[]);
        await db.dailyLog.bulkPut(data.dailyLog as DailyLogEntry[]);

        // Restore settings if present, otherwise keep defaults
        if (data.settings) {
          await db.settings.put({ ...data.settings, id: 1 });
        }
      } else {
        // Merge: strip IDs so Dexie auto-generates new ones, avoiding conflicts
        if (data.exercises.length > 0) {
          await db.exercises.bulkAdd(data.exercises.map(stripId));
        }
        if (data.schemas.length > 0) {
          await db.schemas.bulkAdd(data.schemas.map(stripId));
        }
        if (data.workouts.length > 0) {
          await db.workouts.bulkAdd(data.workouts.map(stripId));
        }
        if (data.foods.length > 0) {
          await db.foods.bulkAdd(data.foods.map(stripId));
        }
        if (data.recipes.length > 0) {
          await db.recipes.bulkAdd(data.recipes.map(stripId));
        }
        if (data.dailyLog.length > 0) {
          await db.dailyLog.bulkAdd(data.dailyLog.map(stripId));
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
