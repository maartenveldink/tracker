import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Plus, Trash2, Search, ChevronDown } from 'lucide-react';
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

// ---------------------------------------------------------------------------
// Inline food picker — searchable combobox per ingredient row
// ---------------------------------------------------------------------------

interface FoodPickerProps {
  value: number;               // currently selected foodId (0 = none)
  foods: Food[];
  onChange: (foodId: number) => void;
}

function FoodPicker({ value, foods, onChange }: FoodPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedFood = value > 0 ? foods.find(f => f.id === value) : undefined;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q ? foods.filter(f => f.name.toLowerCase().includes(q)) : foods;
  }, [search, foods]);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleOpen() {
    setOpen(true);
    setSearch('');
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function handleSelect(food: Food) {
    onChange(food.id!);
    setOpen(false);
    setSearch('');
  }

  return (
    <div ref={containerRef} className="relative flex-1">
      {/* Trigger */}
      <button
        type="button"
        onClick={handleOpen}
        className="w-full h-9 flex items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-left"
      >
        <span className={selectedFood ? 'text-foreground' : 'text-muted-foreground'}>
          {selectedFood ? selectedFood.name : 'Kies voedingsmiddel…'}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 rounded-md border border-border bg-card shadow-lg">
          {/* Search input */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Zoek voedingsmiddel…"
                className="w-full pl-7 pr-2 py-1.5 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* List */}
          <div className="max-h-44 overflow-y-auto">
            {foods.length === 0 ? (
              <div className="px-3 py-3 text-xs text-muted-foreground text-center space-y-1">
                <p>Nog geen voedingsmiddelen aangemaakt.</p>
                <Link
                  to="/foods/new"
                  className="text-primary underline"
                  onClick={() => setOpen(false)}
                >
                  Voedingsmiddel toevoegen
                </Link>
              </div>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-3 text-xs text-muted-foreground text-center">
                Geen resultaten voor "{search}".
              </p>
            ) : (
              filtered.map(food => (
                <button
                  key={food.id}
                  type="button"
                  onClick={() => handleSelect(food)}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-accent flex items-center justify-between ${
                    food.id === value ? 'bg-primary/10 text-primary' : ''
                  }`}
                >
                  <span className="truncate">{food.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0 ml-2">
                    {Math.round(food.calories / food.servingSize * 100)} kcal/100g
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RecipeFormPage
// ---------------------------------------------------------------------------

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

  function updateFoodId(index: number, foodId: number) {
    setIngredients(prev =>
      prev.map((ing, i) => {
        if (i !== index) return ing;
        // Pre-fill grams with the food's serving size
        const food = foodsMap.get(foodId);
        return { ...ing, foodId, grams: food ? String(food.servingSize) : ing.grams };
      }),
    );
  }

  function updateGrams(index: number, value: string) {
    setIngredients(prev =>
      prev.map((ing, i) => (i === index ? { ...ing, grams: value } : ing)),
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

        {/* No foods warning */}
        {foods.length === 0 && (
          <div className="rounded-lg border border-amber-800/50 bg-amber-900/20 px-4 py-3 text-sm text-amber-300 space-y-1">
            <p>Er zijn nog geen voedingsmiddelen aangemaakt.</p>
            <Link to="/foods/new" className="underline text-amber-200">
              Voeg eerst een voedingsmiddel toe
            </Link>
          </div>
        )}

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

          {ingredients.map((ing, index) => {
            const selectedFood = ing.foodId > 0 ? foodsMap.get(ing.foodId) : undefined;
            const kcal = selectedFood && parseFloat(ing.grams) > 0
              ? Math.round((selectedFood.calories / selectedFood.servingSize) * parseFloat(ing.grams))
              : null;

            return (
              <Card key={index} className="shadow-none">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <FoodPicker
                      value={ing.foodId}
                      foods={foods}
                      onChange={foodId => updateFoodId(index, foodId)}
                    />
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
                      onChange={e => updateGrams(index, e.target.value)}
                      className="w-24"
                      placeholder="gram"
                    />
                    <span className="text-sm text-muted-foreground">gram</span>
                    {kcal !== null && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        {kcal} kcal
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
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
