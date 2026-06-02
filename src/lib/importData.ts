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
 *   Foreign-key references (exerciseId, foodId, itemId) are remapped to the new IDs.
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
    [db.exercises, db.schemas, db.workouts, db.foods, db.recipes, db.dailyLog, db.settings, db.weekPlans],
    async () => {
      if (mode === 'replace') {
        // Wipe all tables
        await db.exercises.clear();
        await db.schemas.clear();
        await db.workouts.clear();
        await db.foods.clear();
        await db.recipes.clear();
        await db.dailyLog.clear();
        await db.weekPlans.clear();

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
        // ---------------------------------------------------------------------------
        // Merge: strip IDs so Dexie auto-generates new ones, then remap all
        // foreign-key references so schemas/workouts/recipes/dailyLog stay consistent.
        // ---------------------------------------------------------------------------

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

        // Step 4: add foods, build old → new food ID map
        const foodIdMap = new Map<number, number>();
        if (data.foods.length > 0) {
          const newFoodIds = await db.foods.bulkAdd(
            data.foods.map(stripId) as Food[],
            { allKeys: true },
          );
          data.foods.forEach((food, i) => {
            const oldId = food.id;
            const newId = (newFoodIds as number[])[i];
            if (oldId !== undefined && newId !== undefined) {
              foodIdMap.set(oldId, newId);
            }
          });
        }

        // Step 5: add recipes with remapped foodIds, build old → new recipe ID map
        const recipeIdMap = new Map<number, number>();
        if (data.recipes.length > 0) {
          const remappedRecipes = data.recipes.map(recipe => ({
            ...stripId(recipe),
            ingredients: recipe.ingredients.map(ing => ({
              ...ing,
              foodId: foodIdMap.get(ing.foodId) ?? ing.foodId,
            })),
          }));
          const newRecipeIds = await db.recipes.bulkAdd(
            remappedRecipes as Recipe[],
            { allKeys: true },
          );
          data.recipes.forEach((recipe, i) => {
            const oldId = recipe.id;
            const newId = (newRecipeIds as number[])[i];
            if (oldId !== undefined && newId !== undefined) {
              recipeIdMap.set(oldId, newId);
            }
          });
        }

        // Step 6: add daily log with remapped food/recipe itemIds
        if (data.dailyLog.length > 0) {
          const remappedLog = data.dailyLog.map(entry => ({
            ...stripId(entry),
            itemId: entry.itemType === 'food'
              ? (foodIdMap.get(entry.itemId) ?? entry.itemId)
              : (recipeIdMap.get(entry.itemId) ?? entry.itemId),
          }));
          await db.dailyLog.bulkAdd(remappedLog as DailyLogEntry[]);
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
