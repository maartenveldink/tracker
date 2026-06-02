import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useWorkout, updateWorkout } from '../hooks/useWorkout';
import { useExercises } from '../hooks/useExercises';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { ChevronLeft, Plus, X, Trash2, StickyNote, FileText, Save } from 'lucide-react';
import type { Exercise, WorkoutExercise, WorkoutSet } from '../../../db/index';

interface ValidationError {
  exerciseIndex: number;
  setIndex: number;
  field: 'weight' | 'reps';
  message: string;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
}

export function WorkoutEditPage() {
  const { id } = useParams<{ id: string }>();
  const workoutId = id ? Number(id) : undefined;
  const workout = useWorkout(workoutId);
  const allExercises = useExercises();
  const navigate = useNavigate();

  // Local editing state
  const [exercises, setExercises] = useState<WorkoutExercise[]>([]);
  const [notesDraft, setNotesDraft] = useState('');
  const [exerciseNotesDrafts, setExerciseNotesDrafts] = useState<Record<number, string>>({});
  const [expandedNotes, setExpandedNotes] = useState<number | null>(null);
  const [workoutNotesOpen, setWorkoutNotesOpen] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [showDeleteExercise, setShowDeleteExercise] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const initialized = useRef(false);

  // Initialize local state from workout
  useEffect(() => {
    if (workout && !initialized.current) {
      initialized.current = true;
      setExercises(structuredClone(workout.exercises));
      setNotesDraft(workout.notes);
    }
  }, [workout]);

  const exerciseMap = useMemo(() => {
    const map = new Map<number, Exercise>();
    allExercises.forEach(e => map.set(e.id!, e));
    return map;
  }, [allExercises]);

  // Validation (E4-09)
  const validationErrors = useMemo<ValidationError[]>(() => {
    const errors: ValidationError[] = [];
    exercises.forEach((ex, exIdx) => {
      ex.sets.forEach((set, setIdx) => {
        if (set.completed) {
          if (set.weight === null || set.weight <= 0) {
            errors.push({
              exerciseIndex: exIdx,
              setIndex: setIdx,
              field: 'weight',
              message: 'Gewicht moet > 0 zijn',
            });
          }
          if (set.actualReps === null || set.actualReps <= 0 || !Number.isInteger(set.actualReps)) {
            errors.push({
              exerciseIndex: exIdx,
              setIndex: setIdx,
              field: 'reps',
              message: 'Reps moet een geheel getal > 0 zijn',
            });
          }
        }
      });
    });
    return errors;
  }, [exercises]);

  const hasMinimumContent = useMemo(() => {
    return exercises.length > 0 && exercises.some(ex => ex.sets.length > 0);
  }, [exercises]);

  const canSave = validationErrors.length === 0 && hasMinimumContent;

  function getFieldError(exIdx: number, setIdx: number, field: 'weight' | 'reps'): string | undefined {
    return validationErrors.find(
      e => e.exerciseIndex === exIdx && e.setIndex === setIdx && e.field === field,
    )?.message;
  }

  // Mutations (all local state)
  function markDirty() {
    setIsDirty(true);
    setGlobalError(null);
  }

  function handleWeightChange(exIdx: number, setIdx: number, value: string) {
    const weight = value === '' ? null : parseFloat(value);
    setExercises(prev => {
      const next = structuredClone(prev);
      const ex = next[exIdx];
      const set = ex?.sets[setIdx];
      if (!ex || !set) return prev;
      set.weight = weight;
      return next;
    });
    markDirty();
  }

  function handleRepsChange(exIdx: number, setIdx: number, value: string) {
    const reps = value === '' ? null : parseInt(value);
    setExercises(prev => {
      const next = structuredClone(prev);
      const ex = next[exIdx];
      const set = ex?.sets[setIdx];
      if (!ex || !set) return prev;
      set.actualReps = reps;
      return next;
    });
    markDirty();
  }

  function handleAddSet(exIdx: number) {
    setExercises(prev => {
      const next = structuredClone(prev);
      const exercise = next[exIdx];
      if (!exercise) return prev;
      const lastSet = exercise.sets[exercise.sets.length - 1];
      const newSet: WorkoutSet = {
        exerciseId: exercise.exerciseId,
        setNumber: exercise.sets.length + 1,
        plannedReps: lastSet?.plannedReps ?? null,
        actualReps: null,
        weight: lastSet?.weight ?? null,
        completed: false,
        skipped: false,
      };
      exercise.sets.push(newSet);
      return next;
    });
    markDirty();
  }

  function handleRemoveSet(exIdx: number, setIdx: number) {
    setExercises(prev => {
      const next = structuredClone(prev);
      const ex = next[exIdx];
      if (!ex) return prev;
      ex.sets.splice(setIdx, 1);
      // Renumber
      ex.sets.forEach((s, i) => { s.setNumber = i + 1; });
      return next;
    });
    markDirty();
  }

  function handleRemoveExercise(exIdx: number) {
    setExercises(prev => {
      const next = structuredClone(prev);
      next.splice(exIdx, 1);
      // Reorder
      next.forEach((ex, i) => { ex.order = i; });
      return next;
    });
    setShowDeleteExercise(null);
    markDirty();
  }

  function handleAddExercise(exerciseId: number) {
    setExercises(prev => {
      const next = structuredClone(prev);
      const newExercise: WorkoutExercise = {
        exerciseId,
        order: next.length,
        sets: Array.from({ length: 3 }, (_, i) => ({
          exerciseId,
          setNumber: i + 1,
          plannedReps: 10,
          actualReps: null,
          weight: null,
          completed: false,
          skipped: false,
        })),
        notes: '',
      };
      next.push(newExercise);
      return next;
    });
    setShowAddExercise(false);
    setExerciseSearch('');
    markDirty();
  }

  const flushExerciseNotes = useCallback((exIdx: number, value: string) => {
    setExercises(prev => {
      const next = structuredClone(prev);
      const ex = next[exIdx];
      if (!ex) return prev;
      ex.notes = value;
      return next;
    });
    setExerciseNotesDrafts(prev => {
      const n = { ...prev };
      delete n[exIdx];
      return n;
    });
    markDirty();
  }, []);

  async function handleSave() {
    if (!workoutId || !canSave) {
      if (!hasMinimumContent) {
        setGlobalError('Minimaal 1 oefening met minimaal 1 set vereist.');
      }
      return;
    }

    setSaving(true);
    try {
      // Flush any pending notes drafts
      const finalExercises = structuredClone(exercises);
      for (const [idx, draft] of Object.entries(exerciseNotesDrafts)) {
        const ex = finalExercises[Number(idx)];
        if (ex) ex.notes = draft;
      }
      await updateWorkout(workoutId, finalExercises, notesDraft);
      navigate(-1);
    } catch {
      setGlobalError('Opslaan mislukt. Probeer opnieuw.');
    } finally {
      setSaving(false);
    }
  }

  function handleBack() {
    if (isDirty) {
      setShowCancel(true);
    } else {
      navigate(-1);
    }
  }

  if (!workout || !workoutId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Training laden...</p>
      </div>
    );
  }

  const filteredAddExercises = allExercises.filter(e =>
    !exerciseSearch || e.name.toLowerCase().includes(exerciseSearch.toLowerCase()),
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={handleBack} className="h-8 w-8">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-sm font-semibold">Training bewerken</h1>
              <span className="text-xs text-muted-foreground">
                {formatDate(workout.startedAt)} om {formatTime(workout.startedAt)}
              </span>
            </div>
          </div>
          <Button
            size="sm"
            className="text-xs"
            onClick={handleSave}
            disabled={!canSave || saving}
          >
            <Save className="h-3 w-3" />
            {saving ? 'Opslaan...' : 'Opslaan'}
          </Button>
        </div>
      </header>

      {/* Global error */}
      {globalError && (
        <div className="mx-4 mt-3 rounded-lg bg-destructive/15 text-destructive px-4 py-2 text-sm">
          {globalError}
        </div>
      )}

      {/* Exercise list */}
      <div className="flex-1 px-4 py-3 space-y-4 pb-24">
        {exercises.map((workoutExercise, exIdx) => {
          const exercise = exerciseMap.get(workoutExercise.exerciseId);

          return (
            <div key={`${workoutExercise.exerciseId}-${exIdx}`} className="bg-card rounded-xl border border-border overflow-hidden">
              {/* Exercise header */}
              <div className="px-3 py-2 flex items-center justify-between border-b border-border">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium truncate">
                    {exercise?.name ?? 'Onbekend'}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {workoutExercise.sets.length} sets
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    onClick={() => setExpandedNotes(expandedNotes === exIdx ? null : exIdx)}
                    aria-label="Notities"
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    onClick={() => handleAddSet(exIdx)}
                    aria-label="Set toevoegen"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (exercises.length === 1) {
                        setShowDeleteExercise(exIdx);
                      } else {
                        handleRemoveExercise(exIdx);
                      }
                    }}
                    aria-label="Oefening verwijderen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Notes */}
              {expandedNotes === exIdx && (
                <div className="px-3 py-2 border-b border-border">
                  <textarea
                    value={exerciseNotesDrafts[exIdx] ?? workoutExercise.notes}
                    onChange={e => {
                      setExerciseNotesDrafts(prev => ({ ...prev, [exIdx]: e.target.value }));
                    }}
                    onBlur={e => flushExerciseNotes(exIdx, e.currentTarget.value)}
                    placeholder="Notities voor deze oefening..."
                    rows={2}
                    className="flex w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                  />
                </div>
              )}

              {/* Sets table */}
              <div className="divide-y divide-border/50">
                {/* Table header */}
                <div className="grid grid-cols-[2rem_1fr_1fr_2.5rem] gap-1 px-3 py-1.5 text-xs text-muted-foreground">
                  <span className="text-center">#</span>
                  <span className="text-center">kg</span>
                  <span className="text-center">reps</span>
                  <span></span>
                </div>

                {workoutExercise.sets.map((set, setIdx) => {
                  const weightError = getFieldError(exIdx, setIdx, 'weight');
                  const repsError = getFieldError(exIdx, setIdx, 'reps');

                  return (
                    <div key={set.setNumber}>
                      <div
                        className={cn(
                          'grid grid-cols-[2rem_1fr_1fr_2.5rem] gap-1 px-3 py-1.5 items-center',
                          set.completed && 'bg-primary/10',
                          set.skipped && 'bg-secondary/50 opacity-50',
                        )}
                      >
                        <span className="text-xs text-muted-foreground text-center">{set.setNumber}</span>
                        <Input
                          type="number"
                          step="0.5"
                          value={set.weight ?? ''}
                          onChange={e => handleWeightChange(exIdx, setIdx, e.target.value)}
                          placeholder="-"
                          className={cn(
                            'h-7 text-center text-sm px-1.5',
                            weightError && 'border-destructive',
                          )}
                        />
                        <Input
                          type="number"
                          value={set.actualReps ?? ''}
                          onChange={e => handleRepsChange(exIdx, setIdx, e.target.value)}
                          placeholder={set.plannedReps?.toString() ?? '-'}
                          className={cn(
                            'h-7 text-center text-sm px-1.5',
                            repsError && 'border-destructive',
                          )}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemoveSet(exIdx, setIdx)}
                          aria-label="Set verwijderen"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      {/* Inline validation errors */}
                      {(weightError || repsError) && (
                        <div className="px-3 pb-1">
                          {weightError && (
                            <p className="text-[10px] text-destructive">{weightError}</p>
                          )}
                          {repsError && (
                            <p className="text-[10px] text-destructive">{repsError}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Add exercise */}
        <Sheet open={showAddExercise} onOpenChange={(open) => { setShowAddExercise(open); if (!open) setExerciseSearch(''); }}>
          <Button
            variant="outline"
            className="w-full border-dashed text-muted-foreground"
            onClick={() => setShowAddExercise(true)}
          >
            <Plus className="h-4 w-4" />
            Oefening toevoegen
          </Button>
          <SheetContent side="bottom" className="max-h-[70vh]">
            <SheetHeader>
              <SheetTitle>Oefening toevoegen</SheetTitle>
              <SheetDescription>Selecteer een oefening om toe te voegen</SheetDescription>
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
                {filteredAddExercises.map(ex => (
                  <button
                    key={ex.id}
                    onClick={() => handleAddExercise(ex.id!)}
                    className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
                  >
                    {ex.name}
                  </button>
                ))}
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Workout notes */}
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => setWorkoutNotesOpen(!workoutNotesOpen)}
          >
            <StickyNote className="h-3 w-3" />
            {workoutNotesOpen ? 'Trainingsnotities verbergen' : 'Trainingsnotities'}
          </Button>
          {workoutNotesOpen && (
            <textarea
              value={notesDraft}
              onChange={e => { setNotesDraft(e.target.value); markDirty(); }}
              placeholder="Notities voor deze training..."
              rows={3}
              className="mt-2 flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
          )}
        </div>
      </div>

      {/* Cancel confirmation */}
      <ConfirmDialog
        open={showCancel}
        title="Wijzigingen annuleren?"
        message="Je hebt niet-opgeslagen wijzigingen. Weet je zeker dat je wilt stoppen met bewerken?"
        confirmLabel="Wijzigingen verwerpen"
        variant="danger"
        onConfirm={() => navigate(-1)}
        onCancel={() => setShowCancel(false)}
      />

      {/* Delete last exercise confirmation */}
      <ConfirmDialog
        open={showDeleteExercise !== null}
        title="Oefening verwijderen?"
        message="Dit is de enige oefening in de training. Weet je zeker dat je deze wilt verwijderen?"
        confirmLabel="Verwijderen"
        variant="danger"
        onConfirm={() => {
          if (showDeleteExercise !== null) handleRemoveExercise(showDeleteExercise);
        }}
        onCancel={() => setShowDeleteExercise(null)}
      />
    </div>
  );
}
