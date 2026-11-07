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
  type AppSettings,
} from '@/db/index';
import { EXPORT_VERSION, type TrackerExport } from './exportData';
import { seedDatabase } from '@/features/training/db/seed';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

type DateField = 'required' | 'nullable';

/**
 * Converts a JSON-serialised date (ISO string, or epoch ms) back to a `Date`.
 * `JSON.parse` leaves these as strings, which later crash `.getTime()` callers.
 * Throws a Dutch error naming the table/record/field when the value is not a
 * valid date.
 */
function reviveDate(value: unknown, where: string, kind: DateField): Date | null {
  if (value === null || value === undefined) {
    if (kind === 'nullable') return null;
    throw new Error(`Ongeldige datum in ${where}: waarde ontbreekt.`);
  }
  // Exports serialise dates as ISO strings (`toISOString`/JSON); only accept
  // that shape (or epoch ms) so stray values like "5" or 2024 are rejected.
  const plausible =
    (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) ||
    (typeof value === 'number' && Number.isFinite(value));
  if (plausible) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  throw new Error(`Ongeldige datum in ${where}: ${JSON.stringify(value)}.`);
}

/**
 * Returns a copy of every record in `list` with the given date fields revived.
 * `required` fields must be a valid date; `nullable` ones may also be null.
 */
function reviveRecords<T extends object>(
  list: T[],
  table: string,
  fields: Partial<Record<keyof T & string, DateField>>,
): T[] {
  return list.map((record, index) => {
    if (typeof record !== 'object' || record === null || Array.isArray(record)) {
      throw new Error(`Ongeldig record in "${table}" (nr. ${index + 1}).`);
    }
    const copy: Record<string, unknown> = { ...(record as Record<string, unknown>) };
    for (const [field, kind] of Object.entries(fields) as [string, DateField][]) {
      copy[field] = reviveDate(copy[field], `${table} #${index + 1}, veld "${field}"`, kind);
    }
    return copy as T;
  });
}

/** Optional (older exports) tables must be an array when present. */
function optionalArray<T>(obj: Record<string, unknown>, field: string): T[] {
  const value = obj[field];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error(`Veld "${field}" is geen array.`);
  return value as T[];
}

/**
 * Validates raw parsed JSON against the TrackerExport schema and restores the
 * Date fields that JSON turned into strings (per table, see `src/db/index.ts`).
 * Throws a descriptive (Dutch) error when the structure or a date is invalid.
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

  const settings = obj['settings'];
  if (settings !== undefined && settings !== null && (typeof settings !== 'object' || Array.isArray(settings))) {
    throw new Error('Veld "settings" is geen object.');
  }

  // AppSettings has no Date fields, so settings needs no reviving.
  return {
    ...(raw as TrackerExport),
    exercises: reviveRecords(obj['exercises'] as Exercise[], 'exercises', { createdAt: 'required' }),
    schemas: reviveRecords(obj['schemas'] as TrainingSchema[], 'schemas', {
      createdAt: 'required',
      updatedAt: 'required',
    }),
    workouts: reviveRecords(obj['workouts'] as Workout[], 'workouts', {
      startedAt: 'required',
      pausedAt: 'nullable',
      completedAt: 'nullable',
    }),
    bodyWeights: reviveRecords(optionalArray<BodyWeightEntry>(obj, 'bodyWeights'), 'bodyWeights', {
      createdAt: 'required',
    }),
    habits: reviveRecords(optionalArray<Habit>(obj, 'habits'), 'habits', { createdAt: 'required' }),
    habitLogs: reviveRecords(optionalArray<HabitLog>(obj, 'habitLogs'), 'habitLogs', {
      createdAt: 'required',
    }),
    settings: settings === null ? undefined : (settings as AppSettings | undefined),
  };
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
 *   Foreign-key references (exerciseId, schemaId, habitId) are remapped to the new IDs.
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

        // Step 2: add schemas with remapped exerciseIds, build old → new map.
        // Day ids live inside the schema JSON and are kept as-is (they only
        // need to be unique within a schema), so schemaDayId needs no remap.
        const schemaIdMap = new Map<string, string>();
        if (data.schemas.length > 0) {
          const remappedSchemas = data.schemas.map(schema => {
            const withId = withNewId(schema);
            schemaIdMap.set(schema.id, withId.id);
            return {
              ...withId,
              exercises: schema.exercises.map(e => ({ ...e, exerciseId: remapExId(e.exerciseId) })),
              days: schema.days?.map(day => ({
                ...day,
                exercises: day.exercises.map(e => ({ ...e, exerciseId: remapExId(e.exerciseId) })),
              })),
            };
          });
          await db.schemas.bulkAdd(remappedSchemas as TrainingSchema[]);
        }

        // Step 3: add workouts with remapped exerciseIds (exercises and sets)
        // and a remapped schemaId. Rule for a schemaId that is not in the
        // export (the schema was deleted before exporting): keep it when a live
        // schema with that id still exists in this database (a valid link),
        // otherwise null it (schemaDayId follows: kept only when that day exists), so no dangling
        // reference is left. The workout keeps its schemaName for display.
        if (data.workouts.length > 0) {
          const unmapped = [
            ...new Set(
              data.workouts
                .map(w => w.schemaId)
                .filter((id): id is string => id != null && !schemaIdMap.has(id)),
            ),
          ];
          const liveLocal = new Map<string, TrainingSchema>();
          for (const sc of await db.schemas.bulkGet(unmapped)) {
            if (sc && !sc.deleted) liveLocal.set(sc.id, sc);
          }
          const remappedWorkouts = data.workouts.map(workout => {
            const old = workout.schemaId;
            const mapped = old == null ? undefined : schemaIdMap.get(old);
            const local = old == null || mapped !== undefined ? undefined : liveLocal.get(old);
            const schemaId = mapped ?? local?.id ?? null;
            // Day ids of an imported schema are unchanged; for a kept local
            // schema the day must still exist there, else it is dropped.
            const schemaDayId =
              schemaId === null
                ? null
                : local
                  ? ((local.days ?? []).some(d => d.id === workout.schemaDayId) ? workout.schemaDayId : null)
                  : (workout.schemaDayId ?? null);
            return {
              ...withNewId(workout),
              schemaId,
              schemaDayId,
              exercises: workout.exercises.map(e => ({
                ...e,
                exerciseId: remapExId(e.exerciseId),
                sets: e.sets.map(s => ({ ...s, exerciseId: remapExId(s.exerciseId) })),
              })),
            };
          });
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
