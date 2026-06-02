import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useFood, createFood, updateFood } from '../hooks/useFoods';
import { PageHeader } from '../../../components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
