import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search, Loader2 } from 'lucide-react';
import { useFood, createFood, updateFood } from '../hooks/useFoods';
import { PageHeader } from '../../../components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface OFFProduct {
  product_name?: string;
  nutriments: {
    'energy-kcal_100g'?: number;
    proteins_100g?: number;
    carbohydrates_100g?: number;
    fat_100g?: number;
  };
}

export function FoodFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = id !== undefined;
  const foodId = id ? Number(id) : undefined;
  const existing = useFood(foodId);
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [servingSize, setServingSize] = useState('100');
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<OFFProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const initialized = useRef(false);

  useEffect(() => {
    if (existing && !initialized.current) {
      initialized.current = true;
      setName(existing.name);
      setServingSize(String(existing.servingSize));
      setCalories(String(existing.calories));
      setProtein(String(existing.protein));
      setCarbs(String(existing.carbs));
      setFat(String(existing.fat));
    }
  }, [existing]);

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError(false);
    setSearchResults([]);
    setHasSearched(false);
    try {
      const url =
        `https://world.openfoodfacts.org/cgi/search.pl` +
        `?search_terms=${encodeURIComponent(searchQuery)}` +
        `&json=1&action=process&page_size=10` +
        `&fields=product_name,nutriments`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP error');
      const data = (await res.json()) as { products?: OFFProduct[] };
      const products = (data.products ?? []).filter(
        p => p.product_name && (p.nutriments['energy-kcal_100g'] ?? 0) > 0,
      );
      setSearchResults(products);
      setHasSearched(true);
    } catch {
      setSearchError(true);
    } finally {
      setSearching(false);
    }
  }

  function applyProduct(p: OFFProduct) {
    const n = p.nutriments;
    const r1 = (v: number | undefined) => String(Math.round((v ?? 0) * 10) / 10);
    setName(p.product_name ?? '');
    setServingSize('100');
    setCalories(String(Math.round(n['energy-kcal_100g'] ?? 0)));
    setProtein(r1(n.proteins_100g));
    setCarbs(r1(n.carbohydrates_100g));
    setFat(r1(n.fat_100g));
    setSearchResults([]);
    setSearchQuery('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const data = {
      name: name.trim(),
      servingSize: parseFloat(servingSize) || 100,
      calories: parseFloat(calories) || 0,
      protein: parseFloat(protein) || 0,
      carbs: parseFloat(carbs) || 0,
      fat: parseFloat(fat) || 0,
    };

    if (isEditing && foodId) {
      await updateFood(foodId, data);
    } else {
      await createFood(data);
    }
    navigate('/foods');
  }

  return (
    <div>
      <PageHeader
        title={isEditing ? 'Voedingsmiddel bewerken' : 'Nieuw voedingsmiddel'}
        backTo="/foods"
      />
      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">

        {/* Online zoeken via Open Food Facts */}
        {!isEditing && (
          <div className="space-y-2">
            <Label>Online zoeken</Label>
            <div className="flex gap-2">
              <Input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); void handleSearch(); }
                }}
                placeholder="bv. kidneybonen, kipfilet…"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleSearch()}
                disabled={searching || !searchQuery.trim()}
                className="shrink-0"
              >
                {searching
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Search className="h-4 w-4" />}
              </Button>
            </div>

            {searchError && (
              <p className="text-xs text-destructive">
                Zoeken mislukt. Controleer je internetverbinding en probeer opnieuw.
              </p>
            )}

            {searchResults.length > 0 && (
              <div className="rounded-md border border-border divide-y divide-border max-h-52 overflow-y-auto">
                {searchResults.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applyProduct(p)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex items-center justify-between gap-2"
                  >
                    <span className="truncate">{p.product_name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {Math.round(p.nutriments['energy-kcal_100g'] ?? 0)} kcal/100g
                    </span>
                  </button>
                ))}
              </div>
            )}

            {!searching && !searchError && searchResults.length === 0 && searchQuery === '' && (
              <p className="text-xs text-muted-foreground">
                Zoek op naam om gegevens automatisch in te vullen via{' '}
                <span className="text-foreground">Open Food Facts</span>.
              </p>
            )}

            {!searching && !searchError && hasSearched && searchResults.length === 0 && (
              <p className="text-xs text-muted-foreground">Geen resultaten gevonden.</p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="food-name">Naam *</Label>
          <Input
            id="food-name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            placeholder="bv. Kipfilet"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="food-serving">Portiegrootte (gram) *</Label>
          <Input
            id="food-serving"
            type="number"
            inputMode="decimal"
            min="0.1"
            step="any"
            value={servingSize}
            onChange={e => setServingSize(e.target.value)}
            required
            placeholder="100"
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Voedingswaarden per portie ({servingSize || '100'}g)
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="food-cal">Calorieen (kcal)</Label>
            <Input
              id="food-cal"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={calories}
              onChange={e => setCalories(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="food-protein">Eiwitten (g)</Label>
            <Input
              id="food-protein"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={protein}
              onChange={e => setProtein(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="food-carbs">Koolhydraten (g)</Label>
            <Input
              id="food-carbs"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={carbs}
              onChange={e => setCarbs(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="food-fat">Vetten (g)</Label>
            <Input
              id="food-fat"
              type="number"
              inputMode="decimal"
              min="0"
              step="any"
              value={fat}
              onChange={e => setFat(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        <Button type="submit" className="w-full">
          {isEditing ? 'Opslaan' : 'Aanmaken'}
        </Button>
      </form>
    </div>
  );
}
