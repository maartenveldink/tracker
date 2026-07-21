import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  useWorkout,
  updateWorkoutSet,
  addWorkoutSet,
  removeWorkoutSet,
  removeWorkoutExercise,
  addWorkoutExercise,
  updateExerciseNotes,
  updateWorkoutNotes,
  pauseWorkout,
  resumeWorkout,
  completeWorkout,
} from '../hooks/useWorkout';
import { useExercises, updateExercise } from '../hooks/useExercises';
import { formatReps } from '../lib/reps';
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
import { Pause, Play, Check, SkipForward, Plus, Minus, Trash2, FileText, StickyNote, History, CheckCircle2, RotateCcw, Clock, X as XIcon } from 'lucide-react';
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

// --- Rest Timer (RT-01/02/04/08) ---

interface RestTimerState {
  exerciseIdx: number;
  setIdx: number;
  remaining: number; // seconds
  total: number;     // seconds
  startedAt: number; // Date.now() — uniquely identifies each timer start for effect deps
}

function RestTimerBar({
  timer,
  onSkip,
  onReset,
}: {
  timer: RestTimerState;
  onSkip: () => void;
  onReset: () => void;
}) {
  const progress = timer.total > 0 ? (timer.remaining / timer.total) * 100 : 0;
  const minutes = Math.floor(timer.remaining / 60);
  const seconds = timer.remaining % 60;

  return (
    <div className="px-3 py-2 border-b border-border bg-blue-950/30">
      <div className="flex items-center gap-2">
        <span className="text-sm font-mono font-medium text-blue-300 min-w-[3rem]">
          {minutes}:{String(seconds).padStart(2, '0')}
        </span>
        <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-1000"
            style={{ width: `${progress}%` }}
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={onReset}
        >
          <RotateCcw className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={onSkip}
        >
          <XIcon className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// --- Quick reps bar: tap a number to fill the active set's reps ---

const QUICK_REP_VALUES = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

function QuickRepsBar({
  selected,
  onSelect,
}: {
  selected: number | null;
  onSelect: (reps: number) => void;
}) {
  return (
    <div className="px-3 py-1.5 border-b border-border bg-muted/20">
      <div className="grid grid-cols-6 gap-1">
        {QUICK_REP_VALUES.map(n => (
          <Button
            key={n}
            variant={selected === n ? 'default' : 'secondary'}
            size="sm"
            className={cn(
              'h-7 text-xs px-0',
              selected === n && 'bg-primary text-primary-foreground',
            )}
            onClick={() => onSelect(n)}
          >
            {n}
          </Button>
        ))}
      </div>
    </div>
  );
}

// --- Per-exercise rest control ---

function formatSecs(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function RestControlBar({
  seconds,
  isDefault,
  onAdjust,
  onSaveDefault,
}: {
  seconds: number;
  isDefault: boolean;
  onAdjust: (delta: number) => void;
  onSaveDefault: () => void;
}) {
  return (
    <div className="px-3 py-1.5 border-b border-border bg-muted/20 flex items-center gap-2">
      <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-[11px] text-muted-foreground">Rust</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground"
        onClick={() => onAdjust(-15)}
        aria-label="Rust verlagen"
      >
        <Minus className="h-3 w-3" />
      </Button>
      <span className="text-xs font-mono font-medium min-w-[2.5rem] text-center">{formatSecs(seconds)}</span>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-muted-foreground"
        onClick={() => onAdjust(15)}
        aria-label="Rust verhogen"
      >
        <Plus className="h-3 w-3" />
      </Button>
      <div className="flex-1" />
      {!isDefault && (
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-[11px] text-primary"
          onClick={onSaveDefault}
        >
          Als standaard
        </Button>
      )}
    </div>
  );
}

// --- Helper: truncate exercise name for nav pills ---
function truncateName(name: string, max: number = 12): string {
  if (name.length <= max) return name;
  return name.slice(0, max - 1) + '\u2026';
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

  // RT-01: Rest timer state
  const [restTimer, setRestTimer] = useState<RestTimerState | null>(null);

  // Per-exercise rest override for this session (exerciseId -> seconds)
  const [exerciseRest, setExerciseRest] = useState<Record<number, number>>({});
  // Confirm dialog for deleting a whole exercise
  const [deleteExerciseIdx, setDeleteExerciseIdx] = useState<number | null>(null);

  // NAV-01: refs for scrolling to exercises
  const exerciseRefs = useRef<(HTMLDivElement | null)[]>([]);

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

  // RT-01: Rest timer countdown effect
  // Re-runs only when a new timer starts (unique startedAt). Functional updates
  // handle the countdown without needing `remaining` in deps.
  useEffect(() => {
    if (!restTimer) return;

    const interval = setInterval(() => {
      setRestTimer(prev => {
        if (!prev) return null;
        const next = prev.remaining - 1;
        if (next <= 0) return null;
        return { ...prev, remaining: next };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [restTimer?.startedAt]);

  // Navigate to summary when workout is completed (must be in useEffect, not during render)
  const completedRef = useRef(false);

  // Reset completedRef whenever we navigate to a different workout
  useEffect(() => {
    completedRef.current = false;
  }, [workoutId]);

  useEffect(() => {
    if (workout?.status === 'completed' && workoutId && !completedRef.current) {
      completedRef.current = true;
      navigate(`/workout/${workoutId}/summary`, { replace: true });
    }
  }, [workout?.status, workoutId, navigate]);

  // NAV-01: scroll to exercise
  const scrollToExercise = useCallback((index: number) => {
    const el = exerciseRefs.current[index];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

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

  // Effective rest time for an exercise: session override -> saved default -> global
  function getRest(exerciseId: number): number {
    const override = exerciseRest[exerciseId];
    if (override !== undefined) return override;
    return exerciseMap.get(exerciseId)?.restTimerSeconds ?? settings.restTimerSeconds;
  }

  // Tapping a rep count completes the set immediately and starts the rest timer
  async function handleQuickReps(exerciseIndex: number, setIndex: number, reps: number) {
    if (!workoutId) return;
    await updateWorkoutSet(workoutId, exerciseIndex, setIndex, {
      actualReps: reps,
      completed: true,
      skipped: false,
    });
    // Carry the entered weight over to the next set if it has none yet
    const exercise = workout?.exercises[exerciseIndex];
    const currentWeight = exercise?.sets[setIndex]?.weight ?? null;
    const nextSet = exercise?.sets[setIndex + 1];
    if (currentWeight !== null && nextSet && nextSet.weight === null) {
      await updateWorkoutSet(workoutId, exerciseIndex, setIndex + 1, { weight: currentWeight });
    }
    // Start the rest timer using this exercise's rest time
    const rest = getRest(exercise?.exerciseId ?? -1);
    setRestTimer({
      exerciseIdx: exerciseIndex,
      setIdx: setIndex,
      remaining: rest,
      total: rest,
      startedAt: Date.now(),
    });
  }

  // Undo completion of a set (the prominent complete button was removed)
  async function handleUncomplete(exerciseIndex: number, setIndex: number) {
    if (!workoutId) return;
    await updateWorkoutSet(workoutId, exerciseIndex, setIndex, { completed: false });
  }

  // Adjust this exercise's rest time for the session (15s steps, 15–600)
  function adjustRest(exerciseId: number, delta: number) {
    setExerciseRest(prev => {
      const current = prev[exerciseId] ?? getRest(exerciseId);
      const next = Math.min(600, Math.max(15, current + delta));
      return { ...prev, [exerciseId]: next };
    });
  }

  // Persist the current rest time as this exercise's default
  async function saveRestAsDefault(exerciseId: number) {
    await updateExercise(exerciseId, { restTimerSeconds: getRest(exerciseId) });
    // Clear the session override so it now reads from the saved default
    setExerciseRest(prev => {
      const next = { ...prev };
      delete next[exerciseId];
      return next;
    });
  }

  async function handleDeleteExercise() {
    if (!workoutId || deleteExerciseIdx === null) return;
    await removeWorkoutExercise(workoutId, deleteExerciseIdx);
    setDeleteExerciseIdx(null);
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

  // SL-03: weight +/- buttons
  async function handleWeightStep(exerciseIndex: number, setIndex: number, currentWeight: number | null, step: number) {
    if (!workoutId) return;
    const newWeight = Math.max(0, (currentWeight ?? 0) + step);
    await updateWorkoutSet(workoutId, exerciseIndex, setIndex, { weight: newWeight });
  }

  async function handleRepsChange(exerciseIndex: number, setIndex: number, value: string) {
    if (!workoutId) return;
    const reps = value === '' ? null : parseInt(value);
    await updateWorkoutSet(workoutId, exerciseIndex, setIndex, { actualReps: reps });
  }

  // SL-04: reps +/- buttons
  async function handleRepsStep(exerciseIndex: number, setIndex: number, currentReps: number | null, step: number) {
    if (!workoutId) return;
    const newReps = Math.max(0, (currentReps ?? 0) + step);
    await updateWorkoutSet(workoutId, exerciseIndex, setIndex, { actualReps: newReps });
  }

  async function handleAddExercise(exerciseId: number) {
    if (!workoutId) return;
    await addWorkoutExercise(workoutId, exerciseId);
    setShowAddExercise(false);
    setExerciseSearch('');
  }

  async function handleFinish() {
    if (!workoutId) return;
    setRestTimer(null);
    await completeWorkout(workoutId);
    // Navigation handled exclusively by the useEffect watching workout.status === 'completed'
  }

  const isPaused = workout.status === 'paused';

  // NAV-04: Check if all sets are done (completed or skipped)
  const allSetsDone = workout.exercises.every(ex =>
    ex.sets.every(s => s.completed || s.skipped),
  );

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

      {/* NAV-01/02/06: Exercise navigation bar */}
      <nav className="sticky top-[52px] z-30 bg-card border-b border-border px-2 py-1.5 overflow-x-auto">
        <div className="flex gap-1.5 min-w-max">
          {workout.exercises.map((we, exIdx) => {
            const ex = exerciseMap.get(we.exerciseId);
            const done = we.sets.filter(s => s.completed).length;
            const skipped = we.sets.filter(s => s.skipped).length;
            const total = we.sets.length;
            const allDone = done + skipped === total && total > 0;
            const partial = done > 0 && !allDone;
            const colorClass = allDone
              ? 'bg-green-900/40 text-green-300 border-green-700/50'
              : partial
                ? 'bg-amber-900/40 text-amber-300 border-amber-700/50'
                : 'bg-secondary text-muted-foreground border-border';

            return (
              <button
                key={`${we.exerciseId}-${exIdx}`}
                onClick={() => scrollToExercise(exIdx)}
                className={cn(
                  'shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors',
                  colorClass,
                )}
              >
                {truncateName(ex?.name ?? '?')} {done}/{total}
              </button>
            );
          })}
          {/* NAV-06: "+" pill to add exercise */}
          <button
            onClick={() => setShowAddExercise(true)}
            className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium border border-dashed border-muted-foreground/40 text-muted-foreground hover:bg-accent transition-colors"
          >
            <Plus className="h-3 w-3 inline -mt-0.5" />
          </button>
        </div>
      </nav>

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
          const completedSetsCount = workoutExercise.sets.filter(s => s.completed).length;
          const skippedSetsCount = workoutExercise.sets.filter(s => s.skipped).length;
          const totalSets = workoutExercise.sets.length;
          const prevSession = previousSessions.get(workoutExercise.exerciseId);

          // MF-01: exercise fully completed
          const exerciseDone = totalSets > 0 && completedSetsCount + skippedSetsCount === totalSets;

          // SL-06: find first non-completed, non-skipped set index
          const activeSetIdx = workoutExercise.sets.findIndex(s => !s.completed && !s.skipped);

          // RT-01: is the rest timer for this exercise?
          const timerForThisExercise = restTimer && restTimer.exerciseIdx === exIdx;

          return (
            <div
              key={`${workoutExercise.exerciseId}-${exIdx}`}
              ref={(el) => { exerciseRefs.current[exIdx] = el; }}
              className="bg-card rounded-xl border border-border overflow-hidden scroll-mt-24"
            >
              {/* Exercise header */}
              <div className="px-3 py-2 flex items-center justify-between border-b border-border">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium truncate flex items-center gap-1.5">
                    {exercise?.name ?? 'Onbekend'}
                    {/* MF-01: green checkmark when all sets done */}
                    {exerciseDone && (
                      <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    )}
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    {completedSetsCount}/{totalSets} sets
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteExerciseIdx(exIdx)}
                    aria-label="Oefening verwijderen"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Rest time control for this exercise */}
              <RestControlBar
                seconds={getRest(workoutExercise.exerciseId)}
                isDefault={exerciseRest[workoutExercise.exerciseId] === undefined}
                onAdjust={(delta) => adjustRest(workoutExercise.exerciseId, delta)}
                onSaveDefault={() => saveRestAsDefault(workoutExercise.exerciseId)}
              />

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

              {/* RT-01/02/04: Rest timer bar above set grid */}
              {timerForThisExercise && restTimer && (
                <RestTimerBar
                  timer={restTimer}
                  onSkip={() => setRestTimer(null)}
                  onReset={() => setRestTimer({ ...restTimer, remaining: restTimer.total, startedAt: Date.now() })}
                />
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

              {/* Sets table (E3-02, E3-03, E3-04, SL-03, SL-04, SL-05, SL-06) */}
              <div className="divide-y divide-border/50">
                {/* Table header */}
                <div className="grid grid-cols-[1.75rem_1fr_1fr_2.25rem_2rem] gap-1 px-3 py-1.5 text-xs text-muted-foreground">
                  <span className="text-center">#</span>
                  <span className="text-center">kg</span>
                  <span className="text-center">reps</span>
                  <span></span>
                  <span></span>
                </div>

                {workoutExercise.sets.map((set, setIdx) => {
                  // SL-06: highlight the active (first incomplete) set
                  const isActiveSet = setIdx === activeSetIdx;

                  return (
                    <div key={set.setNumber}>
                    <div
                      className={cn(
                        'grid grid-cols-[1.75rem_1fr_1fr_2.25rem_2rem] gap-1 px-3 py-1.5 items-center',
                        set.completed && 'bg-primary/10',
                        set.skipped && 'bg-secondary/50 opacity-50',
                        isActiveSet && !set.completed && !set.skipped && 'bg-primary/5 border-l-2 border-primary',
                      )}
                    >
                      {/* Status: green check (tap to undo) when completed, else set number */}
                      {set.completed ? (
                        <button
                          onClick={() => handleUncomplete(exIdx, setIdx)}
                          aria-label="Markeer als niet voltooid"
                          className="flex items-center justify-center"
                        >
                          <Check className="h-4 w-4 text-green-500" />
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground text-center">{set.setNumber}</span>
                      )}
                      {/* SL-03: kg input with +/- buttons */}
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 text-xs text-muted-foreground"
                          onClick={() => handleWeightStep(exIdx, setIdx, set.weight, -2.5)}
                        >
                          -
                        </Button>
                        <Input
                          type="number"
                          step="0.5"
                          value={set.weight ?? ''}
                          onChange={e => handleWeightChange(exIdx, setIdx, e.target.value)}
                          onFocus={e => e.target.select()}
                          placeholder={set.plannedWeight != null ? String(set.plannedWeight) : '-'}
                          className="h-7 text-center text-sm px-0.5 min-w-0"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 text-xs text-muted-foreground"
                          onClick={() => handleWeightStep(exIdx, setIdx, set.weight, 2.5)}
                        >
                          +
                        </Button>
                      </div>
                      {/* SL-04: reps input with +/- buttons */}
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 text-xs text-muted-foreground"
                          onClick={() => handleRepsStep(exIdx, setIdx, set.actualReps, -1)}
                        >
                          -
                        </Button>
                        <Input
                          type="number"
                          value={set.actualReps ?? ''}
                          onChange={e => handleRepsChange(exIdx, setIdx, e.target.value)}
                          onFocus={e => e.target.select()}
                          placeholder={set.plannedReps != null ? formatReps(set.plannedReps, set.plannedRepsMax) : '-'}
                          className="h-7 text-center text-sm px-0.5 min-w-0"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 text-xs text-muted-foreground"
                          onClick={() => handleRepsStep(exIdx, setIdx, set.actualReps, 1)}
                        >
                          +
                        </Button>
                      </div>
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
                      {/* Delete set */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => removeWorkoutSet(workoutId, exIdx, setIdx)}
                        aria-label="Set verwijderen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {/* Quick reps bar under the active set — tapping completes the set */}
                    {isActiveSet && !set.completed && !set.skipped && (
                      <QuickRepsBar
                        selected={set.actualReps}
                        onSelect={(reps) => handleQuickReps(exIdx, setIdx, reps)}
                      />
                    )}
                    </div>
                  );
                })}
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

      {/* NAV-04: Floating finish button */}
      <div className="fixed bottom-20 left-0 right-0 flex justify-center z-30 pointer-events-none px-4">
        <Button
          className="pointer-events-auto shadow-lg"
          onClick={() => setShowFinish(true)}
        >
          <Check className="h-4 w-4" />
          {allSetsDone ? 'Afronden' : 'Toch afronden'}
        </Button>
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

      {/* Delete-exercise confirmation */}
      <ConfirmDialog
        open={deleteExerciseIdx !== null}
        title="Oefening verwijderen"
        message={
          deleteExerciseIdx !== null
            ? `Wil je "${exerciseMap.get(workout.exercises[deleteExerciseIdx]?.exerciseId ?? -1)?.name ?? 'deze oefening'}" uit de training verwijderen? De gelogde sets gaan verloren.`
            : ''
        }
        confirmLabel="Verwijderen"
        variant="danger"
        onConfirm={handleDeleteExercise}
        onCancel={() => setDeleteExerciseIdx(null)}
      />
    </div>
  );
}
