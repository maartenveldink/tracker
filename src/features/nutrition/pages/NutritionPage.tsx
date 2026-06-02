import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus, ChevronLeft, ChevronRight, Pencil, Trash2, UtensilsCrossed, BookOpen } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Food, type Recipe, type DailyLogEntry } from '../../../db/index';
import {
  useDailyLog,
  sumMacros,
  addDailyLogEntry,
  updateDailyLogEntry,
  deleteDailyLogEntry,
} from '../hooks/useDailyLog';
import { useSettings } from '../../../hooks/useSettings';
import { PageHeader } from '../../../components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function displayDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'long' });
}

function isToday(dateStr: string): boolean {
  return dateStr === formatDate(new Date());
}

type AddMode = 'food' | 'recipe';

export function NutritionPage() {
  const [date, setDate] = useState(() => formatDate(new Date()));
  const entries = useDailyLog(date);
  const totals = sumMacros(entries);
  const settings = useSettings();
  const goals = settings.macroGoals;

  // Add item dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>('food');
  const [addSearch, setAddSearch] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [addGrams, setAddGrams] = useState('');

  // Edit dialog
  const [editEntry, setEditEntry] = useState<DailyLogEntry | null>(null);
  const [editGrams, setEditGrams] = useState('');

  // Load foods and recipes for the add dialog
  const foods = useLiveQuery(() => db.foods.orderBy('name').toArray()) ?? [];
  const recipes = useLiveQuery(() => db.recipes.orderBy('name').toArray()) ?? [];

  const filteredItems = useMemo(() => {
    const q = addSearch.toLowerCase();
    if (addMode === 'food') {
      return foods.filter(f => !q || f.name.toLowerCase().includes(q));
    }
    return recipes.filter(r => !q || r.name.toLowerCase().includes(q));
  }, [addMode, addSearch, foods, recipes]);

  function prevDay() {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    setDate(formatDate(d));
  }

  function nextDay() {
    const d = new Date(date + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    setDate(formatDate(d));
  }

  function openAdd(mode: AddMode) {
    setAddMode(mode);
    setAddSearch('');
    setSelectedItemId(null);
    setAddGrams('');
    setAddOpen(true);
  }

  function selectItem(id: number) {
    setSelectedItemId(id);
    // Pre-fill with serving size for food or total weight for recipe
    if (addMode === 'food') {
      const food = foods.find(f => f.id === id);
      if (food) setAddGrams(String(food.servingSize));
    } else {
      const recipe = recipes.find(r => r.id === id);
      if (recipe) setAddGrams(String(recipe.totalWeight));
    }
  }

  async function confirmAdd() {
    if (!selectedItemId || !addGrams) return;
    const grams = parseFloat(addGrams);
    if (grams <= 0) return;

    await addDailyLogEntry(date, addMode, selectedItemId, grams);
    setAddOpen(false);
  }

  function openEdit(entry: DailyLogEntry) {
    setEditEntry(entry);
    setEditGrams(String(entry.grams));
  }

  async function confirmEdit() {
    if (!editEntry?.id) return;
    const grams = parseFloat(editGrams);
    if (grams <= 0) return;
    await updateDailyLogEntry(editEntry.id, grams);
    setEditEntry(null);
  }

  async function handleDelete(entryId: number) {
    await deleteDailyLogEntry(entryId);
  }

  // Macro progress helper
  function progressPercent(current: number, goal: number | null): number | null {
    if (goal === null || goal <= 0) return null;
    return Math.min(Math.round((current / goal) * 100), 100);
  }

  // Selected item preview in add dialog
  const selectedPreview = useMemo(() => {
    if (!selectedItemId) return null;
    if (addMode === 'food') {
      return foods.find(f => f.id === selectedItemId) ?? null;
    }
    return recipes.find(r => r.id === selectedItemId) ?? null;
  }, [selectedItemId, addMode, foods, recipes]);

  function previewMacros(): { calories: number; protein: number; carbs: number; fat: number } | null {
    if (!selectedPreview || !addGrams) return null;
    const grams = parseFloat(addGrams);
    if (grams <= 0) return null;

    const baseGrams = addMode === 'food'
      ? (selectedPreview as Food).servingSize
      : (selectedPreview as Recipe).totalWeight;

    if (baseGrams <= 0) return null;
    const factor = grams / baseGrams;
    return {
      calories: Math.round(selectedPreview.calories * factor),
      protein: Math.round(selectedPreview.protein * factor * 10) / 10,
      carbs: Math.round(selectedPreview.carbs * factor * 10) / 10,
      fat: Math.round(selectedPreview.fat * factor * 10) / 10,
    };
  }

  const preview = previewMacros();

  return (
    <div>
      <PageHeader
        title="Voeding"
        actions={
          <div className="flex gap-1">
            <Button asChild variant="ghost" size="sm">
              <Link to="/foods">
                <UtensilsCrossed className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/recipes">
                <BookOpen className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        }
      />

      {/* Date navigation */}
      <div className="flex items-center justify-between px-4 py-2">
        <Button variant="ghost" size="icon" onClick={prevDay}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="text-sm font-medium">
          {isToday(date) ? 'Vandaag' : displayDate(date)}
        </span>
        <Button variant="ghost" size="icon" onClick={nextDay}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Macro totals */}
      <div className="px-4 pb-3">
        <Card className="shadow-none">
          <CardContent className="p-3">
            <div className="grid grid-cols-4 gap-2 text-center">
              {([
                { label: 'Kcal', value: Math.round(totals.calories), goal: goals.calories, color: 'text-orange-400', unit: '' },
                { label: 'Eiwit', value: totals.protein, goal: goals.protein, color: 'text-blue-400', unit: 'g' },
                { label: 'Koolh', value: totals.carbs, goal: goals.carbs, color: 'text-green-400', unit: 'g' },
                { label: 'Vet', value: totals.fat, goal: goals.fat, color: 'text-yellow-400', unit: 'g' },
              ] as const).map(m => {
                const pct = progressPercent(m.value, m.goal);
                return (
                  <div key={m.label}>
                    <p className={`text-lg font-semibold ${m.color}`}>
                      {Math.round(m.value)}{m.unit ?? ''}
                    </p>
                    <p className="text-xs text-muted-foreground">{m.label}</p>
                    {pct !== null && (
                      <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${pct >= 100 ? 'bg-primary' : 'bg-primary/60'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                    {m.goal !== null && m.goal > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        / {m.goal}{m.unit ?? ''}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add buttons */}
      <div className="px-4 flex gap-2 pb-3">
        <Button onClick={() => openAdd('food')} size="sm" className="flex-1">
          <Plus className="h-4 w-4 mr-1" />
          Voedingsmiddel
        </Button>
        <Button onClick={() => openAdd('recipe')} size="sm" variant="outline" className="flex-1">
          <Plus className="h-4 w-4 mr-1" />
          Recept
        </Button>
      </div>

      {/* Log entries */}
      <div className="px-4 space-y-2 pb-4">
        {entries.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-8">
            Nog niets gelogd vandaag.
          </p>
        )}
        {entries.map(entry => (
          <Card key={entry.id} className="shadow-none">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{entry.itemName}</p>
                <p className="text-xs text-muted-foreground">
                  {entry.grams}g &middot; {Math.round(entry.calories)} kcal &middot;{' '}
                  E {entry.protein}g &middot; K {entry.carbs}g &middot; V {entry.fat}g
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground shrink-0"
                onClick={() => openEdit(entry)}
                aria-label="Bewerk hoeveelheid"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => handleDelete(entry.id!)}
                aria-label="Verwijder"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add item dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-sm max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {addMode === 'food' ? 'Voedingsmiddel toevoegen' : 'Recept toevoegen'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 flex-1 overflow-y-auto">
            <Input
              type="text"
              placeholder="Zoek..."
              value={addSearch}
              onChange={e => setAddSearch(e.target.value)}
            />

            <div className="space-y-1 max-h-48 overflow-y-auto">
              {filteredItems.length === 0 && (
                <p className="text-muted-foreground text-xs text-center py-3">
                  Geen items gevonden.{' '}
                  <Link to={addMode === 'food' ? '/foods/new' : '/recipes/new'} className="text-primary underline">
                    Nieuw aanmaken
                  </Link>
                </p>
              )}
              {filteredItems.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectItem(item.id!)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    selectedItemId === item.id
                      ? 'bg-primary/15 text-primary'
                      : 'hover:bg-accent'
                  }`}
                >
                  <span className="font-medium">{item.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {Math.round(item.calories)} kcal
                  </span>
                </button>
              ))}
            </div>

            {selectedItemId !== null && (
              <div className="space-y-2 pt-2 border-t border-border">
                <Label>Hoeveelheid (gram)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="any"
                  value={addGrams}
                  onChange={e => setAddGrams(e.target.value)}
                  placeholder="gram"
                />
                {preview && (
                  <p className="text-xs text-muted-foreground">
                    {preview.calories} kcal &middot; E {preview.protein}g &middot; K {preview.carbs}g &middot; V {preview.fat}g
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Annuleren
            </Button>
            <Button onClick={confirmAdd} disabled={!selectedItemId || !addGrams || parseFloat(addGrams) <= 0}>
              Toevoegen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={editEntry !== null} onOpenChange={(open) => { if (!open) setEditEntry(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hoeveelheid aanpassen</DialogTitle>
          </DialogHeader>
          {editEntry && (
            <div className="space-y-3">
              <p className="text-sm font-medium">{editEntry.itemName}</p>
              <div className="space-y-2">
                <Label>Hoeveelheid (gram)</Label>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="1"
                  step="any"
                  value={editGrams}
                  onChange={e => setEditGrams(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEntry(null)}>
              Annuleren
            </Button>
            <Button onClick={confirmEdit} disabled={!editGrams || parseFloat(editGrams) <= 0}>
              Opslaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
