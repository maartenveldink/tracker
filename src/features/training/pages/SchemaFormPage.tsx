import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSchema, createSchema, updateSchema } from '../hooks/useSchemas';
import { useExercises } from '../hooks/useExercises';
import { PageHeader } from '../../../components/PageHeader';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, X, Plus, Pencil, Trash2 } from 'lucide-react';
import type { SchemaExercise, SchemaDay } from '../../../db/index';

interface DayState {
  id: string;
  name: string;
  exercises: SchemaExercise[];
  order: number;
}

export function SchemaFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = id !== undefined;
  const schemaId = id ? Number(id) : undefined;
  const existing = useSchema(schemaId);
  const allExercises = useExercises();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  // Single-day mode: exercises stored flat
  const [exercises, setExercises] = useState<SchemaExercise[]>([]);
  // Multi-day mode: days with their own exercises
  const [days, setDays] = useState<DayState[]>([]);
  // Multi-day repetition rhythm: ordered list of day IDs (e.g. A, B, A, C)
  const [rotation, setRotation] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<string>('single');
  const [showPicker, setShowPicker] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');
  // Which day ID is currently active for exercise picker (null = single-day mode)
  const [pickerDayId, setPickerDayId] = useState<string | null>(null);
  // Editing day name
  const [editingDayId, setEditingDayId] = useState<string | null>(null);
  const [editingDayName, setEditingDayName] = useState('');
  const initialized = useRef(false);

  const isMultiDay = days.length > 0;

  useEffect(() => {
    if (existing && !initialized.current) {
      initialized.current = true;
      setName(existing.name);
      if (existing.days && existing.days.length > 0) {
        const sorted = [...existing.days].sort((a, b) => a.order - b.order);
        setDays(sorted);
        setActiveTab(sorted[0]!.id);
        setExercises([]);
        const validIds = new Set(sorted.map(d => d.id));
        setRotation((existing.rotation ?? []).filter(id => validIds.has(id)));
      } else {
        setExercises(existing.exercises);
        setDays([]);
        setActiveTab('single');
        setRotation([]);
      }
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

  // --- Day management (E2-09) ---

  function addDay() {
    const newDay: DayState = {
      id: crypto.randomUUID(),
      name: `Dag ${days.length + 1}`,
      exercises: [],
      order: days.length,
    };

    if (days.length === 0 && exercises.length > 0) {
      // Converting from single-day to multi-day: move existing exercises to first day
      const firstDay: DayState = {
        id: crypto.randomUUID(),
        name: 'Dag 1',
        exercises: [...exercises],
        order: 0,
      };
      newDay.order = 1;
      newDay.name = 'Dag 2';
      setDays([firstDay, newDay]);
      setExercises([]);
      setActiveTab(firstDay.id);
    } else {
      setDays(prev => [...prev, newDay]);
      setActiveTab(newDay.id);
    }
  }

  function removeDay(dayId: string) {
    // Drop any rhythm steps that reference the removed day
    setRotation(prev => prev.filter(id => id !== dayId));
    setDays(prev => {
      const filtered = prev.filter(d => d.id !== dayId).map((d, i) => ({ ...d, order: i }));
      if (filtered.length === 0) {
        // Revert to single-day mode: move exercises from removed day back
        const removedDay = prev.find(d => d.id === dayId);
        if (removedDay) {
          setExercises(removedDay.exercises);
        }
        setActiveTab('single');
        setRotation([]);
        return [];
      }
      if (filtered.length === 1) {
        // Only one day left: revert to single-day
        setExercises(filtered[0]!.exercises);
        setActiveTab('single');
        setRotation([]);
        return [];
      }
      // If active tab was the removed day, switch to first
      if (activeTab === dayId) {
        setActiveTab(filtered[0]!.id);
      }
      return filtered;
    });
  }

  function moveDayOrder(dayId: string, direction: 'up' | 'down') {
    setDays(prev => {
      const index = prev.findIndex(d => d.id === dayId);
      if (index < 0) return prev;
      const newIndex = direction === 'up' ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      const updated = [...prev];
      const temp = updated[index]!;
      updated[index] = updated[newIndex]!;
      updated[newIndex] = temp;
      return updated.map((d, i) => ({ ...d, order: i }));
    });
  }

  function startEditDayName(dayId: string) {
    const day = days.find(d => d.id === dayId);
    if (day) {
      setEditingDayId(dayId);
      setEditingDayName(day.name);
    }
  }

  function saveDayName() {
    if (editingDayId && editingDayName.trim()) {
      setDays(prev => prev.map(d =>
        d.id === editingDayId ? { ...d, name: editingDayName.trim() } : d
      ));
    }
    setEditingDayId(null);
    setEditingDayName('');
  }

  // --- Repetition rhythm (rotation) management ---

  function dayName(dayId: string): string {
    return days.find(d => d.id === dayId)?.name ?? '?';
  }

  function addRotationStep(dayId: string) {
    setRotation(prev => [...prev, dayId]);
  }

  function removeRotationStep(index: number) {
    setRotation(prev => prev.filter((_, i) => i !== index));
  }

  function moveRotationStep(index: number, direction: 'left' | 'right') {
    const newIndex = direction === 'left' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= rotation.length) return;
    setRotation(prev => {
      const updated = [...prev];
      const temp = updated[index]!;
      updated[index] = updated[newIndex]!;
      updated[newIndex] = temp;
      return updated;
    });
  }

  // --- Exercise management ---

  const getCurrentExercises = useCallback((): SchemaExercise[] => {
    if (!isMultiDay) return exercises;
    const day = days.find(d => d.id === activeTab);
    return day?.exercises ?? [];
  }, [isMultiDay, exercises, days, activeTab]);

  function setCurrentExercises(updater: (prev: SchemaExercise[]) => SchemaExercise[]) {
    if (!isMultiDay) {
      setExercises(updater);
    } else {
      setDays(prev => prev.map(d =>
        d.id === activeTab ? { ...d, exercises: updater(d.exercises) } : d
      ));
    }
  }

  function addExercise(exerciseId: number) {
    const targetDayId = pickerDayId;

    const updater = (prev: SchemaExercise[]): SchemaExercise[] => [
      ...prev,
      {
        exerciseId,
        sets: 3,
        repsPerSet: 10,
        order: prev.length,
      },
    ];

    if (!isMultiDay || targetDayId === null) {
      setExercises(updater);
    } else {
      setDays(prev => prev.map(d =>
        d.id === targetDayId ? { ...d, exercises: updater(d.exercises) } : d
      ));
    }

    setShowPicker(false);
    setExerciseSearch('');
    setPickerDayId(null);
  }

  function removeExercise(index: number) {
    setCurrentExercises(prev =>
      prev.filter((_, i) => i !== index).map((e, i) => ({ ...e, order: i }))
    );
  }

  function moveExercise(index: number, direction: 'up' | 'down') {
    const current = getCurrentExercises();
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= current.length) return;

    setCurrentExercises(prev => {
      const updated = [...prev];
      const temp = updated[index]!;
      updated[index] = updated[newIndex]!;
      updated[newIndex] = temp;
      return updated.map((e, i) => ({ ...e, order: i }));
    });
  }

  function updateExerciseField(index: number, field: 'sets' | 'repsPerSet', value: number) {
    setCurrentExercises(prev =>
      prev.map((e, i) => (i === index ? { ...e, [field]: Math.max(1, value) } : e))
    );
  }

  function openPicker(dayId: string | null) {
    setPickerDayId(dayId);
    setShowPicker(true);
  }

  // --- Submit ---

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    // Only persist a custom rotation when it differs from plain day order
    const cleanRotation = rotation.filter(id => days.some(d => d.id === id));

    const schemaData = isMultiDay
      ? {
          name: name.trim(),
          exercises: [] as SchemaExercise[],
          days: days as SchemaDay[],
          rotation: cleanRotation.length > 0 ? cleanRotation : undefined,
        }
      : { name: name.trim(), exercises, days: undefined, rotation: undefined };

    if (isEditing && schemaId) {
      await updateSchema(schemaId, schemaData);
      navigate(`/schemas/${schemaId}`);
    } else {
      const newId = await createSchema(schemaData.name, schemaData.exercises, schemaData.days, schemaData.rotation);
      navigate(`/schemas/${newId}`);
    }
  }

  // --- Render helpers ---

  function renderExerciseList(exs: SchemaExercise[], totalLength: number) {
    return (
      <div className="space-y-2">
        {exs.map((ex, i) => (
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
                  disabled={i === totalLength - 1}
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
    );
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
            placeholder='bv. "Push Pull Legs", "Full Body"'
          />
        </div>

        {/* Day management (E2-09) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="block">
              {isMultiDay ? 'Dagen' : 'Oefeningen'}
            </Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addDay}
              className="h-7 text-xs"
            >
              <Plus className="h-3 w-3" />
              Dag toevoegen
            </Button>
          </div>

          {isMultiDay ? (
            <>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full flex overflow-x-auto">
                {days.map(day => (
                  <TabsTrigger key={day.id} value={day.id} className="flex-1 min-w-0">
                    <span className="truncate">{day.name}</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {days.map((day, dayIndex) => (
                <TabsContent key={day.id} value={day.id} className="space-y-3 mt-3">
                  {/* Day header with rename, reorder, delete */}
                  <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                    {editingDayId === day.id ? (
                      <Input
                        value={editingDayName}
                        onChange={e => setEditingDayName(e.target.value)}
                        onBlur={saveDayName}
                        onKeyDown={e => { if (e.key === 'Enter') saveDayName(); }}
                        className="h-7 text-sm flex-1"
                        autoFocus
                      />
                    ) : (
                      <span className="text-sm font-medium flex-1 truncate">{day.name}</span>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={() => startEditDayName(day.id)}
                      aria-label="Dag hernoemen"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={() => moveDayOrder(day.id, 'up')}
                      disabled={dayIndex === 0}
                      aria-label="Dag omhoog"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={() => moveDayOrder(day.id, 'down')}
                      disabled={dayIndex === days.length - 1}
                      aria-label="Dag omlaag"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removeDay(day.id)}
                      aria-label="Dag verwijderen"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {renderExerciseList(day.exercises, day.exercises.length)}

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-dashed text-muted-foreground"
                    onClick={() => openPicker(day.id)}
                  >
                    <Plus className="h-4 w-4" />
                    Oefening toevoegen
                  </Button>
                </TabsContent>
              ))}
            </Tabs>

            {/* Repetition rhythm (E2): define the training cycle, e.g. A, B, A, C */}
            <div className="mt-5 space-y-2">
              <div>
                <Label className="block">Herhalingsritme</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Bepaal in welke volgorde de dagen elkaar opvolgen. Laat leeg voor de
                  standaardvolgorde ({days.map(d => d.name).join(' → ')}).
                </p>
              </div>

              {/* Current sequence */}
              {rotation.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {rotation.map((dayId, i) => (
                    <div
                      key={`${dayId}-${i}`}
                      className="flex items-center gap-0.5 rounded-full bg-primary/10 border border-primary/30 pl-2.5 pr-1 py-0.5"
                    >
                      <span className="text-xs font-medium">
                        {i + 1}. {dayName(dayId)}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-muted-foreground"
                        onClick={() => moveRotationStep(i, 'left')}
                        disabled={i === 0}
                        aria-label="Stap naar links"
                      >
                        <ChevronLeft className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-muted-foreground"
                        onClick={() => moveRotationStep(i, 'right')}
                        disabled={i === rotation.length - 1}
                        aria-label="Stap naar rechts"
                      >
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 text-muted-foreground hover:text-destructive"
                        onClick={() => removeRotationStep(i)}
                        aria-label="Stap verwijderen"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-muted-foreground"
                    onClick={() => setRotation([])}
                  >
                    Wissen
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground/70 italic">
                  Nog geen eigen ritme — dagen volgen elkaar op volgorde op.
                </p>
              )}

              {/* Add-step buttons: one per day */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {days.map(day => (
                  <Button
                    key={day.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs border-dashed"
                    onClick={() => addRotationStep(day.id)}
                  >
                    <Plus className="h-3 w-3" />
                    {day.name}
                  </Button>
                ))}
              </div>
            </div>
            </>
          ) : (
            <>
              {renderExerciseList(exercises, exercises.length)}
              <Button
                type="button"
                variant="outline"
                className="mt-3 w-full border-dashed text-muted-foreground"
                onClick={() => openPicker(null)}
              >
                <Plus className="h-4 w-4" />
                Oefening toevoegen
              </Button>
            </>
          )}
        </div>

        {/* Exercise picker via Sheet (mobile bottom sheet) */}
        <Sheet open={showPicker} onOpenChange={(open) => { setShowPicker(open); if (!open) { setExerciseSearch(''); setPickerDayId(null); } }}>
          <SheetContent side="bottom" className="max-h-[70vh]">
            <SheetHeader>
              <SheetTitle>Oefening toevoegen</SheetTitle>
              <SheetDescription>Selecteer een oefening om aan {isMultiDay && pickerDayId ? days.find(d => d.id === pickerDayId)?.name ?? 'de dag' : 'het schema'} toe te voegen</SheetDescription>
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

        <Button type="submit" className="w-full">
          {isEditing ? 'Opslaan' : 'Aanmaken'}
        </Button>
      </form>
    </div>
  );
}
