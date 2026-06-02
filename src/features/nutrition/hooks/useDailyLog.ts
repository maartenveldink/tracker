import { useLiveQuery } from 'dexie-react-hooks';
import { db, type DailyLogEntry, type DailyLogItemType, type Food, type Recipe, type Macros } from '../../../db/index';

export function useDailyLog(date: string) {
  return useLiveQuery(
    () => db.dailyLog.where('date').equals(date).toArray(),
    [date],
  ) ?? [];
}

/** Sum macros for a list of log entries. */
export function sumMacros(entries: DailyLogEntry[]): Macros {
  return entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fat: acc.fat + e.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

/** Compute macros for a given grams amount based on a food or recipe source. */
function computeEntryMacros(
  source: Food | Recipe,
  grams: number,
  itemType: DailyLogItemType,
): Macros {
  // For food: macros are per servingSize grams
  // For recipe: macros are per totalWeight grams
  const baseGrams = itemType === 'food'
    ? (source as Food).servingSize
    : (source as Recipe).totalWeight;

  if (baseGrams <= 0) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  }

  const factor = grams / baseGrams;
  return {
    calories: Math.round(source.calories * factor * 10) / 10,
    protein: Math.round(source.protein * factor * 10) / 10,
    carbs: Math.round(source.carbs * factor * 10) / 10,
    fat: Math.round(source.fat * factor * 10) / 10,
  };
}

export async function addDailyLogEntry(
  date: string,
  itemType: DailyLogItemType,
  itemId: number,
  grams: number,
): Promise<number> {
  const source = itemType === 'food'
    ? await db.foods.get(itemId)
    : await db.recipes.get(itemId);

  if (!source) throw new Error('Voedingsmiddel niet gevonden');

  const macros = computeEntryMacros(source, grams, itemType);

  const id = await db.dailyLog.add({
    date,
    itemType,
    itemId,
    itemName: source.name,
    grams,
    ...macros,
    createdAt: new Date(),
  });
  return id as number;
}

export async function updateDailyLogEntry(
  entryId: number,
  grams: number,
): Promise<void> {
  const entry = await db.dailyLog.get(entryId);
  if (!entry) return;

  const source = entry.itemType === 'food'
    ? await db.foods.get(entry.itemId)
    : await db.recipes.get(entry.itemId);

  if (!source) return;

  const macros = computeEntryMacros(source, grams, entry.itemType);

  await db.dailyLog.update(entryId, {
    grams,
    ...macros,
  });
}

export async function deleteDailyLogEntry(entryId: number): Promise<void> {
  await db.dailyLog.delete(entryId);
}

