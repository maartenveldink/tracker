import { useLiveQuery } from 'dexie-react-hooks';
import { db, type RecipeIngredient, type Food } from '../../../db/index';

export function useRecipes() {
  return useLiveQuery(() => db.recipes.orderBy('name').toArray()) ?? [];
}

export function useRecipe(id: number | undefined) {
  return useLiveQuery(
    () => (id ? db.recipes.get(id) : undefined),
    [id],
  );
}

/** Compute recipe totals from ingredient list and foods. */
export function computeRecipeMacros(
  ingredients: RecipeIngredient[],
  foodsMap: Map<number, Food>,
): { totalWeight: number; calories: number; protein: number; carbs: number; fat: number } {
  let totalWeight = 0;
  let calories = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;

  for (const ing of ingredients) {
    const food = foodsMap.get(ing.foodId);
    if (!food || food.servingSize <= 0) continue;

    const factor = ing.grams / food.servingSize;
    totalWeight += ing.grams;
    calories += food.calories * factor;
    protein += food.protein * factor;
    carbs += food.carbs * factor;
    fat += food.fat * factor;
  }

  return {
    totalWeight: Math.round(totalWeight),
    calories: Math.round(calories * 10) / 10,
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
  };
}

export async function createRecipe(
  name: string,
  ingredients: RecipeIngredient[],
): Promise<number> {
  const foodIds = [...new Set(ingredients.map(i => i.foodId))];
  const foods = await db.foods.where('id').anyOf(foodIds).toArray();
  const foodsMap = new Map(foods.map(f => [f.id!, f]));
  const macros = computeRecipeMacros(ingredients, foodsMap);

  const now = new Date();
  const id = await db.recipes.add({
    name,
    ingredients,
    ...macros,
    createdAt: now,
    updatedAt: now,
  });
  return id as number;
}

export async function updateRecipe(
  id: number,
  name: string,
  ingredients: RecipeIngredient[],
): Promise<void> {
  const foodIds = [...new Set(ingredients.map(i => i.foodId))];
  const foods = await db.foods.where('id').anyOf(foodIds).toArray();
  const foodsMap = new Map(foods.map(f => [f.id!, f]));
  const macros = computeRecipeMacros(ingredients, foodsMap);

  await db.recipes.update(id, {
    name,
    ingredients,
    ...macros,
    updatedAt: new Date(),
  });
}

export async function deleteRecipe(id: number): Promise<void> {
  await db.transaction('rw', [db.recipes, db.dailyLog], async () => {
    await db.recipes.delete(id);
    await db.dailyLog.where({ itemType: 'recipe', itemId: id }).delete();
  });
}

export async function isRecipeInUse(recipeId: number): Promise<boolean> {
  const logCount = await db.dailyLog
    .where({ itemType: 'recipe', itemId: recipeId })
    .count();
  return logCount > 0;
}
