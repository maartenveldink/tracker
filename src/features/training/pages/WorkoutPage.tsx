import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useWorkout,
  updateWorkoutSet,
  addWorkoutSet,
  addWorkoutExercise,
  updateExerciseNotes,
  updateWorkoutNotes,
  pauseWorkout,
  resumeWorkout,
  completeWorkout,
} from '../hooks/useWorkout';
import { useExercises } from '../hooks/useExercises';
import { useCompletedWorkouts, calculate1RM, type OneRMFormula } from '../hooks/useProgress';
import { useSettings } from '../../../hooks/useSettings';
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
import { cn, formatDurationClock } from '@/lib/utils';
import { Pause, Play, Check, SkipForward, Plus, FileText, StickyNote, History } from 'lucide-react';
import type { Exercise, Workout } from '../../../db/index';

// --- Previous session reference (E3-10) ---

interface PreviousSetRef {
  weight: number;
  reps: number;
  estimated1RM: number;
}

interface PreviousSessionRef {
  date: Date;
  sets: PreviousSetRef[];
}

function findPreviousSession(
  exerciseId: number,
  completedWorkouts: Workout[],
  currentWorkoutId: number | undefined,
  formula: OneRMFormula,
): PreviousSessionRef | null {
  // Walk workouts from newest to oldest, skip the current workout
  for (let i = completedWorkouts.length - 1; i >= 0; i--) {
    const w = completedWorkouts[i];
    if (!w) continue;
    if (w.id === currentWorkoutId) continue;

    const exerciseData = w.exercises.find(e => e.exerciseId === exerciseId);
    if (!exerciseData) continue;

    const completedSets = exerciseData.sets.filter(
      s => s.completed && s.weight !== null && s.weight > 0 && s.actualReps !== null && s.actualReps > 0,
    );
    if (completedSets.length === 0) continue;

    return {
      date: w.startedAt,
      sets: completedSets.map(s => ({
        weight: s.weight!,
        reps: s.actualReps!,
        estimated1RM: calculate1RM(s.weight!, s.actualReps!, formula),
      })),
    };
  }
  return null;
}

function formatRefDate(date: Date): string {
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });
}

function PreviousSessionBar({ reference, currentSetCount }: {
  reference: PreviousSessionRef;
  currentSetCount: number;
}) {
  // Only show sets up to the current set count (position matching)
  const setsToShow = reference.sets.slice(0, currentSetCount);

  return (
    <div className="px-3 py-2 border-b border-border bg-muted/30">
      <div className="flex items-center gap-1.5 mb-1">
        <History className="h-3 w-3 text-muted-foreground" />
        <span className="text-[11px] text-muted-foreground font-medium">
          {formatRefDate(reference.date)}
        </span>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
        {setsToShow.map((s, i) => (
          <span key={i} className="text-[11px] text-muted-foreground">
            S{i + 1}: {s.weight}kg x {s.reps}{' '}
            <span className="text-muted-foreground/60">
              (~{Math.round(s.estimated1RM * 10) / 10})
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

// --- Main component ---

export function WorkoutPage() {
  const { id } = useParams<{ id: string }>();
  const workoutId = id ? Number(id) : undefined;
  const workout = useWorkout(workoutId);
  const allExercises = useExercises();
  const completedWorkouts = useCompletedWorkouts();
  const settings = useSettings();
  const navigate = useNavigate();

  const [elapsed, setElapsed] = useState(0);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [showFinish, setShowFinish] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<number | null>(null);
  const [workoutNotesOpen, setWorkoutNotesOpen] = useState(false);
  const [exerciseNotesDrafts, setExerciseNotesDrafts] = useState<Record<number, string>>({});
  const [workoutNotesDraft, setWorkoutNotesDraft] = useState<string | null>(null);

  useEffect(() => {
    setExerciseNotesDrafts({});
    setWorkoutNotesDraft(null);
  }, [workoutId]);

  const exerciseMap = useMemo(() => {
    const map = new Map<number, Exercise>();
    allExercises.forEach(e => map.set(e.id!, e));
    return map;
  }, [allExercises]);

  // Build previous session references for each exercise in the workout (E3-10)
  const previousSessions = useMemo(() => {
    if (!workout) return new Map<number, PreviousSessionRef | null>();
    const map = new Map<number, PreviousSessionRef | null>();
    for (const ex of workout.exercises) {
      if (!map.has(ex.exerciseId)) {
        map.set(
          ex.exerciseId,
          findPreviousSession(ex.exerciseId, completedWorkouts, workoutId, settings.oneRMFormula),
        );
      }
    }
    return map;
  }, [workout, completedWorkouts, workoutId, settings.oneRMFormula]);

  // Timer (E3-06)
  const workoutStatus = workout?.status;
  const startedAt = workout?.startedAt;
  const pausedAt = workout?.pausedAt;
  const totalPausedMs = workout?.totalPausedMs;

  useEffect(() => {
    if (!workoutStatus || workoutStatus === 'completed') return;

    const interval = setInterval(() => {
      if (workoutStatus === 'paused' && pausedAt && startedAt) {
        const activeDuration = pausedAt.getTime() - startedAt.getTime() - (totalPausedMs ?? 0);
        setElapsed(activeDuration);
      } else if (startedAt) {
        const activeDuration = Date.now() - startedAt.getTime() - (totalPausedMs ?? 0);
        setElapsed(activeDuration);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [workoutStatus, startedAt, pausedAt, totalPausedMs]);

  // Navigate to summary when workout is completed (must be in useEffect, not during render)
  const completedRef = useRef(false);
  useEffect(() => {
    if (workout?.status === 'completed' && workoutId && !completedRef.current) {
      completedRef.current = true;
      navigate(`/workout/${workoutId}/summary`, { replace: true });
    }
  }, [workout?.status, workoutId, navigate]);

  if (!workout || !workoutId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Training laden...</p>
      </div>
    );
  }

  if (workout.status === 'completed') {
    return null;
  }

  const filteredAddExercises = allExercises.filter(e =>
    !exerciseSearch || e.name.toLowerCase().includes(exerciseSearch.toLowerCase()),
  );

  async function handleSetComplete(exerciseIndex: number, setIndex: number, currentlyCompleted: boolean) {
    if (!workoutId) return;
    await updateWorkoutSet(workoutId, exerciseIndex, setIndex, {
      completed: !currentlyCompleted,
      skipped: false,
    });
  }

  async function handleSetSkip(exerciseIndex: number, setIndex: number, currentlySkipped: boolean) {
    if (!workoutId) return;
    await updateWorkoutSet(workoutId, exerciseIndex, setIndex, {
      skipped: !currentlySkipped,
      completed: false,
    });
  }

  async function handleWeightChange(exerciseIndex: number, setIndex: number, value: string) {
    if (!workoutId) return;
    const weight = value === '' ? null : parseFloat(value);
    await updateWorkoutSet(workoutId, exerciseIndex, setIndex, { weight });
  }

  async function handleRepsChange(exerciseIndex: number, setIndex: number, value: string) {
    if (!workoutId) return;
    const reps = value === '' ? null : parseInt(value);
    await updateWorkoutSet(workoutId, exerciseIndex, setIndex, { actualReps: reps });
  }

  async function handleAddExercise(exerciseId: number) {
    if (!workoutId) return;
    await addWorkoutExercise(workoutId, exerciseId);
    setShowAddExercise(false);
    setExerciseSearch('');
  }

  async function handleFinish() {
    if (!workoutId) return;
    await completeWorkout(workoutId);
    // Navigation handled exclusively by the useEffect watching workout.status === 'completed'
  }

  const isPaused = workout.status === 'paused';

  return (
    <div className="min-h-screen flex flex-col">
      {/* Minimal header for active training (NF-05) */}
      <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold truncate">
              {workout.schemaName ?? 'Losse training'}
              {workout.schemaDayName && (
                <span className="font-normal text-muted-foreground"> - {workout.schemaDayName}</span>
              )}
            </h1>
            <span className="text-xs text-muted-foreground">{formatDurationClock(elapsed)}</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Pause/Resume (E3-07) */}
            <Button
              size="sm"
              variant={isPaused ? 'default' : 'secondary'}
              className={cn(
                'text-xs',
                !isPaused && 'bg-amber-600 text-white hover:bg-amber-500',
              )}
              onClick={() =>
                isPaused ? resumeWorkout(workoutId) : pauseWorkout(workoutId)
              }
            >
              {isPaused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
              {isPaused ? 'Hervat' : 'Pauze'}
            </Button>
            <Button
              size="sm"
              className="text-xs"
              onClick={() => setShowFinish(true)}
            >
              Afronden
            </Button>
          </div>
        </div>
      </header>

      {/* Paused banner */}
      {isPaused && (
        <div className="bg-amber-900/30 border-b border-amber-800/50 px-4 py-2 text-center">
          <span className="text-amber-300 text-xs font-medium">Training gepauzeerd</span>
        </div>
      )}

      {/* Exercise list -- minimal UI during training (NF-05) */}
      <div className="flex-1 px-4 py-3 space-y-4 pb-24">
        {workout.exercises.map((workoutExercise, exIdx) => {
          const exercise = exerciseMap.get(workoutExercise.exerciseId);
          const completedSets = workoutExercise.sets.filter(s => s.completed).length;
          const totalSets = workoutExercise.sets.length;
          const prevSession = previousSessions.get(workoutExercise.exerciseId);

          return (
            <div key={exIdx} className="bg-card rounded-xl border border-border overflow-hidden">
              {/* Exercise header */}
              <div className="px-3 py-2 flex items-center justify-between border-b border-border">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium truncate">
                    {exercise?.name ?? 'Onbekend'}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {completedSets}/{totalSets} sets
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
                    onClick={() => addWorkoutSet(workoutId, exIdx)}
                    aria-label="Set toevoegen"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Previous session reference (E3-10) */}
              {prevSession ? (
                <PreviousSessionBar reference={prevSession} currentSetCount={totalSets} />
              ) : (
                <div className="px-3 py-1.5 border-b border-border bg-muted/30">
                  <span className="text-[11px] text-muted-foreground/60 flex items-center gap-1.5">
                    <History className="h-3 w-3" />
                    Geen eerdere sessie
                  </span>
                </div>
              )}

              {/* Notes (E3-09) */}
              {expandedNotes === exIdx && (
                <div className="px-3 py-2 border-b border-border">
                  <textarea
                    value={exerciseNotesDrafts[exIdx] ?? workoutExercise.notes}
                    onChange={e => setExerciseNotesDrafts(prev => ({ ...prev, [exIdx]: e.target.value }))}
                    onBlur={e => {
                      const nextNotes = e.currentTarget.value;
                      setExerciseNotesDrafts(prev => {
                        const next = { ...prev };
                        delete next[exIdx];
                        return next;
                      });
                      void updateExerciseNotes(workoutId, exIdx, nextNotes);
                    }}
                    placeholder="Notities voor deze oefening..."
                    rows={2}
                    className="flex w-full rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                  />
                </div>
              )}

              {/* Sets table (E3-02, E3-03, E3-04) */}
              <div className="divide-y divide-border/50">
                {/* Table header */}
                <div className="grid grid-cols-[2rem_1fr_1fr_2.5rem_2.5rem] gap-1 px-3 py-1.5 text-xs text-muted-foreground">
                  <span className="text-center">#</span>
                  <span className="text-center">kg</span>
                  <span className="text-center">reps</span>
                  <span></span>
                  <span></span>
                </div>

                {workoutExercise.sets.map((set, setIdx) => (
                  <div
                    key={set.setNumber}
                    className={cn(
                      'grid grid-cols-[2rem_1fr_1fr_2.5rem_2.5rem] gap-1 px-3 py-1.5 items-center',
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
                      className="h-7 text-center text-sm px-1.5"
                    />
                    <Input
                      type="number"
                      value={set.actualReps ?? ''}
                      onChange={e => handleRepsChange(exIdx, setIdx, e.target.value)}
                      placeholder={set.plannedReps?.toString() ?? '-'}
                      className="h-7 text-center text-sm px-1.5"
                    />
                    {/* Complete button (E3-03) */}
                    <Button
                      variant={set.completed ? 'default' : 'secondary'}
                      size="icon"
                      className={cn(
                        'h-7 w-7',
                        set.completed && 'bg-primary text-primary-foreground',
                      )}
                      onClick={() => handleSetComplete(exIdx, setIdx, set.completed)}
                      aria-label={set.completed ? 'Markeer als niet voltooid' : 'Markeer als voltooid'}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    {/* Skip button (E3-05) */}
                    <Button
                      variant="secondary"
                      size="icon"
                      className={cn(
                        'h-7 w-7',
                        set.skipped && 'text-amber-400',
                      )}
                      onClick={() => handleSetSkip(exIdx, setIdx, set.skipped)}
                      aria-label={set.skipped ? 'Set herstellen' : 'Set overslaan'}
                    >
                      <SkipForward className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {/* Add exercise via Sheet */}
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
              <SheetDescription>Selecteer een oefening om toe te voegen aan je training</SheetDescription>
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

        {/* Workout notes (E3-09) */}
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
              value={workoutNotesDraft ?? workout.notes}
              onChange={e => setWorkoutNotesDraft(e.target.value)}
              onBlur={e => {
                const nextNotes = e.currentTarget.value;
                setWorkoutNotesDraft(null);
                void updateWorkoutNotes(workoutId, nextNotes);
              }}
              placeholder="Notities voor deze training..."
              rows={3}
              className="mt-2 flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
          )}
        </div>
      </div>

      {/* Finish confirmation */}
      <ConfirmDialog
        open={showFinish}
        title="Training afronden"
        message="Wil je deze training afronden? Je kunt daarna de samenvatting bekijken."
        confirmLabel="Afronden"
        onConfirm={handleFinish}
        onCancel={() => setShowFinish(false)}
      />
    </div>
  );
}
