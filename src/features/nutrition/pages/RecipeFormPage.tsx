import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { useFoods } from '../hooks/useFoods';
import { useRecipe, createRecipe, updateRecipe, computeRecipeMacros } from '../hooks/useRecipes';
import type { RecipeIngredient, Food } from '../../../db/index';
import { PageHeader } from '../../../components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

interface IngredientRow {
  foodId: number;
  grams: string; // string for input binding
}

export function RecipeFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = id !== undefined;
  const recipeId = id ? Number(id) : undefined;
  const existing = useRecipe(recipeId);
  const foods = useFoods();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);

  const initialized = useRef(false);

  useEffect(() => {
    if (existing && !initialized.current) {
      initialized.current = true;
      setName(existing.name);
      setIngredients(
        existing.ingredients.map(i => ({
          foodId: i.foodId,
          grams: String(i.grams),
        })),
      );
    }
  }, [existing]);

  const foodsMap = useMemo(() => {
    const map = new Map<number, Food>();
    for (const f of foods) {
      if (f.id !== undefined) map.set(f.id, f);
    }
    return map;
  }, [foods]);

  // Compute live totals
  const parsedIngredients: RecipeIngredient[] = ingredients
    .filter(i => i.foodId > 0 && parseFloat(i.grams) > 0)
    .map(i => ({ foodId: i.foodId, grams: parseFloat(i.grams) || 0 }));

  const totals = computeRecipeMacros(parsedIngredients, foodsMap);

  function addIngredient() {
    setIngredients([...ingredients, { foodId: 0, grams: '100' }]);
  }

  function removeIngredient(index: number) {
    setIngredients(ingredients.filter((_, i) => i !== index));
  }

  function updateIngredient(index: number, field: 'foodId' | 'grams', value: string) {
    setIngredients(
      ingredients.map((ing, i) => {
        if (i !== index) return ing;
        if (field === 'foodId') return { ...ing, foodId: parseInt(value) || 0 };
        return { ...ing, grams: value };
      }),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || parsedIngredients.length === 0) return;

    if (isEditing && recipeId) {
      await updateRecipe(recipeId, name.trim(), parsedIngredients);
    } else {
      await createRecipe(name.trim(), parsedIngredients);
    }
    navigate('/recipes');
  }

  return (
    <div>
      <PageHeader
        title={isEditing ? 'Recept bewerken' : 'Nieuw recept'}
        backTo="/recipes"
      />
      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="recipe-name">Naam *</Label>
          <Input
            id="recipe-name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            placeholder="bv. Overnight oats"
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Ingredienten</Label>
            <Button type="button" variant="outline" size="sm" onClick={addIngredient}>
              <Plus className="h-4 w-4 mr-1" />
              Toevoegen
            </Button>
          </div>

          {ingredients.length === 0 && (
            <p className="text-muted-foreground text-sm text-center py-4">
              Voeg ingredienten toe.
            </p>
          )}

          {ingredients.map((ing, index) => (
            <Card key={index} className="shadow-none">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <select
                    value={ing.foodId || ''}
                    onChange={e => updateIngredient(index, 'foodId', e.target.value)}
                    className="flex-1 h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Kies voedingsmiddel</option>
                    {foods.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => removeIngredient(index)}
                    aria-label="Verwijder ingrediënt"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    inputMode="decimal"
                    min="0.1"
                    step="any"
                    value={ing.grams}
                    onChange={e => updateIngredient(index, 'grams', e.target.value)}
                    className="w-24"
                    placeholder="gram"
                  />
                  <span className="text-sm text-muted-foreground">gram</span>
                  {ing.foodId > 0 && foodsMap.has(ing.foodId) && parseFloat(ing.grams) > 0 && (
                    <span className="text-xs text-muted-foreground ml-auto">
                      {Math.round(
                        (foodsMap.get(ing.foodId)!.calories / foodsMap.get(ing.foodId)!.servingSize) *
                          parseFloat(ing.grams),
                      )}{' '}
                      kcal
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Live totals */}
        {parsedIngredients.length > 0 && (
          <Card className="shadow-none bg-accent/30">
            <CardContent className="p-3">
              <p className="text-sm font-medium mb-1">Totaal ({totals.totalWeight}g)</p>
              <div className="grid grid-cols-4 gap-2 text-xs text-muted-foreground">
                <div>{Math.round(totals.calories)} kcal</div>
                <div>E {totals.protein}g</div>
                <div>K {totals.carbs}g</div>
                <div>V {totals.fat}g</div>
              </div>
            </CardContent>
          </Card>
        )}

        <Button type="submit" className="w-full" disabled={!name.trim() || parsedIngredients.length === 0}>
          {isEditing ? 'Opslaan' : 'Aanmaken'}
        </Button>
      </form>
    </div>
  );
}
