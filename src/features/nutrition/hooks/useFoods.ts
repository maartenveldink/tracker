import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Food } from '../../../db/index';

export function useFoods() {
  return useLiveQuery(() => db.foods.orderBy('name').toArray()) ?? [];
}

export function useFood(id: number | undefined) {
  return useLiveQuery(
    () => (id ? db.foods.get(id) : undefined),
    [id],
  );
}

export async function createFood(
  data: Omit<Food, 'id' | 'createdAt'>,
): Promise<number> {
  const id = await db.foods.add({
    ...data,
    createdAt: new Date(),
  });
  return id as number;
}

export async function updateFood(
  id: number,
  data: Partial<Omit<Food, 'id' | 'createdAt'>>,
): Promise<void> {
  await db.foods.update(id, data);
}

export async function deleteFood(id: number): Promise<void> {
  await db.transaction('rw', [db.foods, db.dailyLog], async () => {
    await db.foods.delete(id);
    // Also clean up any daily log entries referencing this food
    await db.dailyLog.where({ itemType: 'food', itemId: id }).delete();
  });
}

export async function isFoodInUse(foodId: number): Promise<boolean> {
  // Check recipes
  const recipeCount = await db.recipes
    .filter(r => r.ingredients.some(i => i.foodId === foodId))
    .count();
  if (recipeCount > 0) return true;

  // Check daily log
  const logCount = await db.dailyLog
    .where({ itemType: 'food', itemId: foodId })
    .count();
  return logCount > 0;
}

/** Calculate macros per 100g from a food's serving data. */
export function macrosPer100g(food: Food): { calories: number; protein: number; carbs: number; fat: number } {
  if (food.servingSize <= 0) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  }
  const factor = 100 / food.servingSize;
  return {
    calories: Math.round(food.calories * factor * 10) / 10,
    protein: Math.round(food.protein * factor * 10) / 10,
    carbs: Math.round(food.carbs * factor * 10) / 10,
    fat: Math.round(food.fat * factor * 10) / 10,
  };
}
