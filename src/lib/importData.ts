import {
  db,
  newId,
  freshSyncMeta,
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
 * Assigns a fresh string id and fresh sync metadata to a record (used by merge
 * mode so imported data gets brand-new keys and is pushed to the account).
 */
function withNewId<T extends { id: string }>(record: T): T {
  return { ...record, id: newId(), ...freshSyncMeta() };
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

        // Insert with original IDs preserved (bulkPut accepts explicit keys).
        // Mark everything dirty so the import syncs up to the account.
        const dirtyMeta = () => freshSyncMeta();
        await db.exercises.bulkPut(data.exercises.map(e => ({ ...e, ...dirtyMeta() })) as Exercise[]);
        await db.schemas.bulkPut(data.schemas.map(s => ({ ...s, ...dirtyMeta() })) as TrainingSchema[]);
        await db.workouts.bulkPut(data.workouts.map(w => ({ ...w, ...dirtyMeta() })) as Workout[]);
        await db.bodyWeights.bulkPut(bodyWeights.map(b => ({ ...b, ...dirtyMeta() })) as BodyWeightEntry[]);
        await db.habits.bulkPut(habits.map(h => ({ ...h, ...dirtyMeta() })) as Habit[]);
        await db.habitLogs.bulkPut(habitLogs.map(l => ({ ...l, ...dirtyMeta() })) as HabitLog[]);

        // Restore settings if present, otherwise keep defaults
        if (data.settings) {
          await db.settings.put({ ...data.settings, id: 1, clientUpdatedAt: Date.now(), dirty: 1 });
        }
      } else {
        // -------------------------------------------------------------------
        // Merge: assign fresh string ids, then remap the foreign-key
        // references so schemas/workouts/habit logs stay consistent.
        // -------------------------------------------------------------------

        // Step 1: add exercises with fresh ids, build old → new id map
        const exerciseIdMap = new Map<string, string>();
        const newExercises = data.exercises.map(ex => {
          const withId = withNewId(ex);
          exerciseIdMap.set(ex.id, withId.id);
          return withId;
        });
        if (newExercises.length > 0) await db.exercises.bulkAdd(newExercises as Exercise[]);
        const remapExId = (id: string): string => exerciseIdMap.get(id) ?? id;

        // Step 2: add schemas with remapped exerciseIds
        if (data.schemas.length > 0) {
          const remappedSchemas = data.schemas.map(schema => ({
            ...withNewId(schema),
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
            ...withNewId(workout),
            exercises: workout.exercises.map(e => ({
              ...e,
              exerciseId: remapExId(e.exerciseId),
              sets: e.sets.map(s => ({ ...s, exerciseId: remapExId(s.exerciseId) })),
            })),
          }));
          await db.workouts.bulkAdd(remappedWorkouts as Workout[]);
        }

        // Step 4: add body weights (no foreign keys; fresh ids)
        if (bodyWeights.length > 0) {
          await db.bodyWeights.bulkAdd(bodyWeights.map(withNewId) as BodyWeightEntry[]);
        }

        // Step 5: add habits with fresh ids, build old → new map, remap logs
        const habitIdMap = new Map<string, string>();
        const newHabits = habits.map(h => {
          const withId = withNewId(h);
          habitIdMap.set(h.id, withId.id);
          return withId;
        });
        if (newHabits.length > 0) await db.habits.bulkAdd(newHabits as Habit[]);
        if (habitLogs.length > 0) {
          const remappedLogs = habitLogs.map(log => ({
            ...withNewId(log),
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
