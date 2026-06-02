import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSchema, createSchema, updateSchema } from '../hooks/useSchemas';
import { useExercises } from '../hooks/useExercises';
import { PageHeader } from '../components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ChevronUp, ChevronDown, X, Plus } from 'lucide-react';
import type { SchemaExercise } from '../db/index';

export function SchemaFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = id !== undefined;
  const schemaId = id ? Number(id) : undefined;
  const existing = useSchema(schemaId);
  const allExercises = useExercises();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [exercises, setExercises] = useState<SchemaExercise[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const initialized = useRef(false);

  useEffect(() => {
    if (existing && !initialized.current) {
      initialized.current = true;
      setName(existing.name);
      setExercises(existing.exercises);
    }
  }, [existing]);

  const exerciseMap = useMemo(() => {
    const map = new Map<number, string>();
    allExercises.forEach(e => map.set(e.id!, e.name));
    return map;
  }, [allExercises]);

  const filteredExercises = useMemo(() => {
    if (!exerciseSearch) return allExercises;
    const q = exerciseSearch.toLowerCase();
    return allExercises.filter(e => e.name.toLowerCase().includes(q));
  }, [allExercises, exerciseSearch]);

  function addExercise(exerciseId: number) {
    setExercises(prev => [
      ...prev,
      {
        exerciseId,
        sets: 3,
        repsPerSet: 10,
        order: prev.length,
      },
    ]);
    setShowPicker(false);
    setExerciseSearch('');
  }

  function removeExercise(index: number) {
    setExercises(prev => prev.filter((_, i) => i !== index).map((e, i) => ({ ...e, order: i })));
  }

  function moveExercise(index: number, direction: 'up' | 'down') {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= exercises.length) return;

    const updated = [...exercises];
    const temp = updated[index]!;
    updated[index] = updated[newIndex]!;
    updated[newIndex] = temp;
    setExercises(updated.map((e, i) => ({ ...e, order: i })));
  }

  function updateExerciseField(index: number, field: 'sets' | 'repsPerSet', value: number) {
    setExercises(prev =>
      prev.map((e, i) => (i === index ? { ...e, [field]: Math.max(1, value) } : e)),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    if (isEditing && schemaId) {
      await updateSchema(schemaId, { name: name.trim(), exercises });
      navigate(`/schemas/${schemaId}`);
    } else {
      const newId = await createSchema(name.trim(), exercises);
      navigate(`/schemas/${newId}`);
    }
  }

  return (
    <div>
      <PageHeader
        title={isEditing ? 'Schema bewerken' : 'Nieuw schema'}
        backTo="/schemas"
      />

      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="schema-name">Naam *</Label>
          <Input
            id="schema-name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            placeholder='bv. "Push A", "Full Body"'
          />
        </div>

        {/* Exercise list with drag/reorder (E2-02, E2-03) */}
        <div>
          <Label className="mb-2 block">Oefeningen</Label>
          <div className="space-y-2">
            {exercises.map((ex, i) => (
              <Card key={`${ex.exerciseId}-${i}`} className="shadow-none">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-muted-foreground text-xs w-5 text-center">{i + 1}</span>
                    <span className="text-sm font-medium flex-1 truncate">
                      {exerciseMap.get(ex.exerciseId) ?? 'Onbekend'}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={() => moveExercise(i, 'up')}
                      disabled={i === 0}
                      aria-label="Omhoog"
                    >
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={() => moveExercise(i, 'down')}
                      disabled={i === exercises.length - 1}
                      aria-label="Omlaag"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removeExercise(i)}
                      aria-label="Verwijderen"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-3 ml-7">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs text-muted-foreground">Sets</Label>
                      <Input
                        type="number"
                        value={ex.sets}
                        onChange={e => updateExerciseField(i, 'sets', parseInt(e.target.value) || 1)}
                        min={1}
                        className="h-8 text-center"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs text-muted-foreground">Reps</Label>
                      <Input
                        type="number"
                        value={ex.repsPerSet}
                        onChange={e => updateExerciseField(i, 'repsPerSet', parseInt(e.target.value) || 1)}
                        min={1}
                        className="h-8 text-center"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Exercise picker via Sheet (mobile bottom sheet) */}
          <Sheet open={showPicker} onOpenChange={(open) => { setShowPicker(open); if (!open) setExerciseSearch(''); }}>
            <Button
              type="button"
              variant="outline"
              className="mt-3 w-full border-dashed text-muted-foreground"
              onClick={() => setShowPicker(true)}
            >
              <Plus className="h-4 w-4" />
              Oefening toevoegen
            </Button>
            <SheetContent side="bottom" className="max-h-[70vh]">
              <SheetHeader>
                <SheetTitle>Oefening toevoegen</SheetTitle>
                <SheetDescription>Selecteer een oefening om aan het schema toe te voegen</SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-3">
                <Input
                  type="text"
                  value={exerciseSearch}
                  onChange={e => setExerciseSearch(e.target.value)}
                  placeholder="Zoek oefening..."
                  autoFocus
                />
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filteredExercises.map(ex => (
                    <button
                      key={ex.id}
                      type="button"
                      onClick={() => addExercise(ex.id!)}
                      className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
                    >
                      {ex.name}
                    </button>
                  ))}
                  {filteredExercises.length === 0 && (
                    <p className="text-muted-foreground text-xs text-center py-2">Geen oefeningen gevonden.</p>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <Button type="submit" className="w-full">
          {isEditing ? 'Opslaan' : 'Aanmaken'}
        </Button>
      </form>
    </div>
  );
}
