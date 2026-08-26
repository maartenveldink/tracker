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
import { resolveRestSeconds } from '../lib/restTime';
import { steppedWeight, weightStepForExercise } from '../lib/weightStep';
import { groupSupersets, supersetBlocks } from '../lib/superset';
import { useCompletedWorkouts, calculate1RM, type OneRMFormula } from '../hooks/useProgress';
import { volumePerMuscleGroup } from '../lib/metrics';
import { bestOneRMForExercise, previousBestOneRM } from '../lib/progression';
import { MuscleVolumeBars } from '../components/MuscleVolumeBars';
import { CelebrationBurst } from '../components/CelebrationBurst';
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
import { Pause, Play, Check, Plus, Minus, Trash2, FileText, StickyNote, History, CheckCircle2, RotateCcw, Clock, X as XIcon, ChevronDown, Dumbbell, Link2 } from 'lucide-react';
import type { Exercise, Workout, WorkoutDensity } from '../../../db/index';

// --- Set-control sizing (Settings → "Weergave training") ---
// Class strings are written out in full so Tailwind's JIT keeps them.
const DENSITY: Record<WorkoutDensity, {
  grid: string;    // grid-template-columns shared by the header + set rows
  rowPad: string;  // vertical padding of a set row
  stepper: string; // +/- buttons flanking the inputs
  input: string;   // weight/reps inputs
  action: string;  // skip/delete buttons
  quickRep: string; // quick-reps bar buttons
}> = {
  compact: {
    grid: 'grid-cols-[1.75rem_1fr_1fr_2.25rem_2rem]',
    rowPad: 'py-1.5',
    stepper: 'h-6 w-6',
    input: 'h-7',
    action: 'h-7 w-7',
    quickRep: 'h-7',
  },
  comfortable: {
    grid: 'grid-cols-[2rem_1fr_1fr_2.5rem_2.5rem]',
    rowPad: 'py-2.5',
    stepper: 'h-8 w-8',
    input: 'h-9',
    action: 'h-9 w-9',
    quickRep: 'h-9',
  },
  spacious: {
    grid: 'grid-cols-[2.25rem_1fr_1fr_2.75rem_2.75rem]',
    rowPad: 'py-3.5',
    stepper: 'h-10 w-10',
    input: 'h-11',
    action: 'h-11 w-11',
    quickRep: 'h-11',
  },
};

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

// E3-12: short beep via WebAudio when the rest timer ends.
function playRestBeep(): void {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.36);
    osc.onended = () => void ctx.close();
  } catch {
    // Audio unavailable — ignore
  }
}

// E3-16: ask for notification permission on a user gesture so a background
// alert can fire when the timer ends while the app is not focused.
function requestNotifyPermission(): void {
  if ('Notification' in window && Notification.permission === 'default') {
    void Notification.requestPermission();
  }
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
    <div data-testid="rest-timer" className="px-3 py-2 border-b border-border bg-blue-950/30">
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
  btnClass,
}: {
  selected: number | null;
  onSelect: (reps: number) => void;
  btnClass: string;
}) {
  return (
    <div data-testid="quick-reps" className="px-3 py-1.5 border-b border-border bg-muted/20">
      <div className="grid grid-cols-6 gap-1">
        {QUICK_REP_VALUES.map(n => (
          <Button
            key={n}
            variant={selected === n ? 'default' : 'secondary'}
            size="sm"
            className={cn(
              btnClass,
              'text-xs px-0',
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
  const density = DENSITY[settings.workoutDensity];
  const navigate = useNavigate();

  const [elapsed, setElapsed] = useState(0);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [showFinish, setShowFinish] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<number | null>(null);
  const [workoutNotesOpen, setWorkoutNotesOpen] = useState(false);
  // Muscle-group overview so the user can decide what to still train (open by default)
  const [muscleOverviewOpen, setMuscleOverviewOpen] = useState(true);
  // SL-05: "exIdx-setIdx" of a set the user tried to complete without a weight
  const [weightErrorKey, setWeightErrorKey] = useState<string | null>(null);
  // Suppress the reps-input blur-to-complete when the blur is caused by the
  // +/- steppers or by our own Enter handler (which calls blur() itself).
  const suppressRepsBlurRef = useRef(false);
  const [exerciseNotesDrafts, setExerciseNotesDrafts] = useState<Record<number, string>>({});
  const [workoutNotesDraft, setWorkoutNotesDraft] = useState<string | null>(null);

  // RT-01: Rest timer state
  const [restTimer, setRestTimer] = useState<RestTimerState | null>(null);

  // Per-exercise rest override for this session (exerciseId -> seconds)
  const [exerciseRest, setExerciseRest] = useState<Record<number, number>>({});
  // Confirm dialog for deleting a whole exercise
  const [deleteExerciseIdx, setDeleteExerciseIdx] = useState<number | null>(null);
  // NAV-07: which exercise card is expanded. Defaults to the active exercise;
  // tapping a header lets the user override until the active exercise advances.
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

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

  // Volume per muscle group so far this session — drives the live overview that
  // lets the user decide which muscles still need work.
  const muscleVolume = useMemo(
    () => (workout ? volumePerMuscleGroup([workout], exerciseMap) : new Map<string, number>()),
    [workout, exerciseMap],
  );

  // NAV-07: index of the active exercise (first with unfinished sets), or -1 if
  // every exercise is done. Used to drive auto-expand/collapse.
  const activeExerciseIdx = useMemo(() => {
    if (!workout) return -1;
    return workout.exercises.findIndex(
      ex => !(ex.sets.length > 0 && ex.sets.every(s => s.completed || s.skipped)),
    );
  }, [workout]);

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
  const restAlertFiredRef = useRef<number | null>(null);

  useEffect(() => {
    if (!restTimer) return;

    const interval = setInterval(() => {
      setRestTimer(prev => {
        if (!prev) return null;
        const next = prev.remaining - 1;
        if (next <= 0) {
          // E3-12: fire the alert once per timer (guard against StrictMode re-runs)
          if (restAlertFiredRef.current !== prev.startedAt) {
            restAlertFiredRef.current = prev.startedAt;
            fireRestAlert();
          }
          return null;
        }
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

  // Celebrate the moment an exercise is finished with a better best-1RM than the
  // previous session. The nonce re-triggers the (remounted) burst per exercise.
  const celebratedRef = useRef<Set<number>>(new Set());
  const [celebrateNonce, setCelebrateNonce] = useState(0);
  useEffect(() => {
    celebratedRef.current = new Set();
  }, [workoutId]);
  useEffect(() => {
    if (!workout || workout.status === 'completed') return;
    const formula = settings.oneRMFormula;
    for (const we of workout.exercises) {
      const done = we.sets.length > 0 && we.sets.every(s => s.completed || s.skipped);
      const hasCompleted = we.sets.some(
        s => s.completed && s.weight !== null && s.weight > 0 && s.actualReps !== null && s.actualReps > 0,
      );
      if (!done || !hasCompleted) {
        // Not finished (or edited back open) — let it celebrate again later.
        celebratedRef.current.delete(we.exerciseId);
        continue;
      }
      if (celebratedRef.current.has(we.exerciseId)) continue;
      celebratedRef.current.add(we.exerciseId);
      const current = bestOneRMForExercise(workout, we.exerciseId, formula);
      const previous = previousBestOneRM(completedWorkouts, workoutId, we.exerciseId, formula);
      if (previous !== null && current > previous) setCelebrateNonce(n => n + 1);
    }
  }, [workout, completedWorkouts, workoutId, settings.oneRMFormula]);

  // NAV-01: scroll to exercise. Deferred across two animation frames so the
  // expand/collapse that accompanies advancing to the next exercise (which
  // shrinks the card above the target) is committed and laid out first —
  // otherwise the smooth scroll aims at the pre-collapse position and overshoots.
  const scrollToExercise = useCallback((index: number) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = exerciseRefs.current[index];
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }, []);

  // NAV-07: keep the active exercise expanded. When it advances (previous one
  // fully logged), collapse the old card, expand the new one and scroll it in.
  const prevActiveRef = useRef<number | null>(null);
  useEffect(() => {
    prevActiveRef.current = null;
  }, [workoutId]);
  useEffect(() => {
    if (activeExerciseIdx === -1) return;
    setExpandedIdx(activeExerciseIdx);
    if (prevActiveRef.current !== null && prevActiveRef.current !== activeExerciseIdx) {
      scrollToExercise(activeExerciseIdx);
    }
    prevActiveRef.current = activeExerciseIdx;
  }, [activeExerciseIdx, scrollToExercise]);

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

  // Effective rest time (E3-15): session override -> schema exercise -> per-exercise
  // default -> laterality default -> global.
  function getRest(exerciseId: number): number {
    const override = exerciseRest[exerciseId];
    if (override !== undefined) return override;
    const schemaRestSeconds = workout?.exercises.find(e => e.exerciseId === exerciseId)?.restSeconds;
    return resolveRestSeconds({
      schemaRestSeconds,
      exercise: exerciseMap.get(exerciseId),
      settings,
    });
  }

  // E3-12/16: alert the user when the rest timer ends
  function fireRestAlert() {
    if (settings.restTimerVibrate && typeof navigator.vibrate === 'function') {
      navigator.vibrate([200, 100, 200]);
    }
    if (settings.restTimerSound) playRestBeep();
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('Rust voorbij', { body: 'Tijd voor je volgende set.' });
    }
  }

  // The weight shown in the input when the user hasn't typed one: the actual
  // value, else the planned weight, else the previous session's matching set.
  // This is exactly what the input renders as a placeholder, so confirming a set
  // without editing logs the number the user sees.
  function resolveSetWeight(exerciseIndex: number, setIndex: number): number | null {
    const exercise = workout?.exercises[exerciseIndex];
    const set = exercise?.sets[setIndex];
    if (set?.weight != null) return set.weight;
    if (set?.plannedWeight != null) return set.plannedWeight;
    if (!exercise) return null;
    const prevSet = previousSessions.get(exercise.exerciseId)?.sets[setIndex];
    return prevSet?.weight ?? null;
  }

  // Tapping a rep count completes the set immediately and starts the rest timer
  async function handleQuickReps(exerciseIndex: number, setIndex: number, reps: number) {
    if (!workoutId) return;
    const exercise = workout?.exercises[exerciseIndex];
    // SL-05: a set needs a weight before it counts. 0 is valid (bodyweight
    // exercises like pull-ups/dips), but a truly empty field is a mistake — keep
    // the tapped reps and flag the weight input instead of completing the set.
    // The shown placeholder (planned / previous-session weight) counts as filled.
    const currentWeight = resolveSetWeight(exerciseIndex, setIndex);
    if (currentWeight === null) {
      await updateWorkoutSet(workoutId, exerciseIndex, setIndex, { actualReps: reps });
      setWeightErrorKey(`${exerciseIndex}-${setIndex}`);
      return;
    }
    requestNotifyPermission();
    await updateWorkoutSet(workoutId, exerciseIndex, setIndex, {
      weight: currentWeight,
      actualReps: reps,
      completed: true,
      skipped: false,
    });
    // Carry the entered weight over to the next set if it has none yet
    const nextSet = exercise?.sets[setIndex + 1];
    if (nextSet && nextSet.weight === null) {
      await updateWorkoutSet(workoutId, exerciseIndex, setIndex + 1, { weight: currentWeight });
    }
    finishSet(exerciseIndex, setIndex);
  }

  // After a set is logged: for supersets, alternate to the next exercise in the
  // group without resting (rest only after the last exercise of the round);
  // otherwise start the rest timer as usual. `workout` is the pre-completion
  // snapshot, so the just-finished (exIdx,setIdx) is treated as done here.
  function finishSet(exerciseIndex: number, setIndex: number) {
    const exercises = workout?.exercises ?? [];
    const info = groupSupersets(exercises)[exerciseIndex];

    // The rest duration comes from the just-finished exercise; `displayExIdx`
    // decides which (expanded) card shows the timer bar.
    const startRest = (displayExIdx: number) => {
      const rest = getRest(exercises[exerciseIndex]?.exerciseId ?? -1);
      setRestTimer({
        exerciseIdx: displayExIdx,
        setIdx: setIndex,
        remaining: rest,
        total: rest,
        startedAt: Date.now(),
      });
    };

    const hasOpenSet = (exIdx: number) =>
      (exercises[exIdx]?.sets ?? []).some(
        (s, sIdx) => !s.completed && !s.skipped && !(exIdx === exerciseIndex && sIdx === setIndex),
      );

    if (!info || !info.inSuperset) {
      startRest(exerciseIndex);
      return;
    }

    // Mid-round: hand off to the next group member that still has work — no rest.
    const nextMember = info.members.find(m => m > exerciseIndex && hasOpenSet(m));
    if (nextMember != null) {
      setExpandedIdx(nextMember);
      scrollToExercise(nextMember);
      return;
    }

    // End of the round: focus the first member starting the next round and show
    // the rest timer on that (now expanded) card so it stays visible.
    const firstOpen = info.members.find(hasOpenSet);
    const displayExIdx = firstOpen ?? exerciseIndex;
    startRest(displayExIdx);
    if (firstOpen != null && firstOpen !== exerciseIndex) {
      setExpandedIdx(firstOpen);
      scrollToExercise(firstOpen);
    }
  }

  // E3-19: fill weight + reps from the previous session's matching set and complete it
  async function handleSameAsPrevious(exerciseIndex: number, setIndex: number, prev: PreviousSetRef) {
    if (!workoutId) return;
    requestNotifyPermission();
    await updateWorkoutSet(workoutId, exerciseIndex, setIndex, {
      weight: prev.weight,
      actualReps: prev.reps,
      completed: true,
      skipped: false,
    });
    // Carry the weight over to the next set if it has none yet
    const exercise = workout?.exercises[exerciseIndex];
    const nextSet = exercise?.sets[setIndex + 1];
    if (nextSet && nextSet.weight === null) {
      await updateWorkoutSet(workoutId, exerciseIndex, setIndex + 1, { weight: prev.weight });
    }
    finishSet(exerciseIndex, setIndex);
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

  async function handleWeightChange(exerciseIndex: number, setIndex: number, value: string) {
    if (!workoutId) return;
    const weight = value === '' ? null : parseFloat(value);
    if (weight !== null) clearWeightError(exerciseIndex, setIndex);
    await updateWorkoutSet(workoutId, exerciseIndex, setIndex, { weight });
  }

  // SL-05: drop the "weight required" flag once this set has a weight again
  function clearWeightError(exerciseIndex: number, setIndex: number) {
    setWeightErrorKey(prev => (prev === `${exerciseIndex}-${setIndex}` ? null : prev));
  }

  // SL-03: weight +/- buttons — increment depends on the exercise's equipment
  async function handleWeightStep(
    exerciseIndex: number,
    setIndex: number,
    currentWeight: number | null,
    dir: 1 | -1,
    exercise: Exercise | undefined,
  ) {
    if (!workoutId) return;
    // When the set has no typed weight yet, step from the weight the user
    // actually sees (planned / previous-session placeholder) instead of 0.
    const base = currentWeight ?? resolveSetWeight(exerciseIndex, setIndex);
    const newWeight = steppedWeight(base, dir, weightStepForExercise(exercise, settings.weightSteps));
    if (newWeight !== null) clearWeightError(exerciseIndex, setIndex);
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
      <CelebrationBurst key={celebrateNonce} play={celebrateNonce > 0} />
      {/* Minimal header for active training (NF-05) */}
      <header className="sticky top-0 z-40 bg-card border-b border-border px-4 py-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-semibold truncate">
              {workout.schemaName ?? 'Vrije training'}
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
            const navSsInfo = groupSupersets(workout.exercises)[exIdx]!;
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
                onClick={() => { setExpandedIdx(exIdx); scrollToExercise(exIdx); }}
                className={cn(
                  'shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors',
                  colorClass,
                )}
              >
                {navSsInfo.inSuperset && <span className="text-primary font-semibold">{navSsInfo.label} </span>}
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
        {/* Muscle-group overview: which muscles are already trained this session */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setMuscleOverviewOpen(o => !o)}
            className="w-full px-3 py-2 flex items-center gap-2 text-left"
            aria-expanded={muscleOverviewOpen}
          >
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground shrink-0 transition-transform',
                !muscleOverviewOpen && '-rotate-90',
              )}
            />
            <Dumbbell className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium">Getrainde spiergroepen</span>
          </button>
          {muscleOverviewOpen && (
            <div className="px-3 pb-3 pt-1 border-t border-border">
              {muscleVolume.size > 0 ? (
                <MuscleVolumeBars volume={muscleVolume} />
              ) : (
                <p className="text-xs text-muted-foreground">
                  Nog geen sets voltooid. Zodra je sets logt, zie je hier welke spiergroepen je traint.
                </p>
              )}
            </div>
          )}
        </div>

        {supersetBlocks(workout.exercises).map((ssBlock) => {
          const ssInfos = groupSupersets(workout.exercises);
          const cards = ssBlock.map((exIdx) => {
          const workoutExercise = workout.exercises[exIdx]!;
          const ssInfo = ssInfos[exIdx]!;
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

          // NAV-07: only the expanded card shows its rest controls and set grid
          const isExpanded = expandedIdx === exIdx;

          return (
            <div
              key={`${workoutExercise.exerciseId}-${exIdx}`}
              ref={(el) => { exerciseRefs.current[exIdx] = el; }}
              data-testid="exercise-card"
              data-superset={ssInfo.inSuperset ? ssInfo.label : undefined}
              className={cn(
                'bg-card rounded-xl border border-border overflow-hidden scroll-mt-24',
                ssInfo.inSuperset && 'border-l-4 border-l-primary',
              )}
            >
              {/* Exercise header */}
              <div className={cn('px-3 py-2 flex items-center justify-between', isExpanded && 'border-b border-border')}>
                <button
                  type="button"
                  onClick={() => setExpandedIdx(isExpanded ? null : exIdx)}
                  className="flex-1 min-w-0 flex items-center gap-2 text-left"
                  aria-expanded={isExpanded}
                >
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 text-muted-foreground shrink-0 transition-transform',
                      !isExpanded && '-rotate-90',
                    )}
                  />
                  {ssInfo.inSuperset && (
                    <span className="shrink-0 h-5 w-5 rounded-full bg-primary/15 text-primary text-xs font-semibold flex items-center justify-center">
                      {ssInfo.label}
                    </span>
                  )}
                  <div className="min-w-0">
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
                </button>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    onClick={() => {
                      setExpandedIdx(exIdx);
                      setExpandedNotes(expandedNotes === exIdx ? null : exIdx);
                    }}
                    aria-label="Notities"
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    onClick={() => { setExpandedIdx(exIdx); void addWorkoutSet(workoutId, exIdx); }}
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

              {isExpanded && (
                <>
              {/* Rest time control for this exercise. Hidden for superset members:
                  rest there applies after the round, not between the alternating
                  sets, so a per-exercise rest control is misleading. */}
              {!ssInfo.inSuperset && (
                <RestControlBar
                  seconds={getRest(workoutExercise.exerciseId)}
                  isDefault={exerciseRest[workoutExercise.exerciseId] === undefined}
                  onAdjust={(delta) => adjustRest(workoutExercise.exerciseId, delta)}
                  onSaveDefault={() => saveRestAsDefault(workoutExercise.exerciseId)}
                />
              )}

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
                <div className={cn('grid gap-1 px-3 py-1.5 text-xs text-muted-foreground', density.grid)}>
                  <span className="text-center">#</span>
                  <span className="text-center">kg</span>
                  <span className="text-center">reps</span>
                  <span></span>
                  <span></span>
                </div>

                {workoutExercise.sets.map((set, setIdx) => {
                  // SL-06: highlight the active (first incomplete) set
                  const isActiveSet = setIdx === activeSetIdx;
                  // E3-18: previous session's matching set, for prefill hints
                  const prevSet = prevSession?.sets[setIdx];

                  return (
                    <div key={set.setNumber}>
                    <div
                      className={cn(
                        'grid gap-1 px-3 items-center',
                        density.grid,
                        density.rowPad,
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
                        <span className="text-xs text-muted-foreground text-center">
                          {set.side ? (set.side === 'left' ? 'L' : 'R') : set.setNumber}
                        </span>
                      )}
                      {/* SL-03: kg input with +/- buttons */}
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(density.stepper, 'shrink-0 text-xs text-muted-foreground')}
                          onPointerDown={() => { suppressRepsBlurRef.current = true; }}
                          onClick={() => handleWeightStep(exIdx, setIdx, set.weight, -1, exercise)}
                        >
                          -
                        </Button>
                        <Input
                          type="number"
                          step="0.5"
                          data-testid="set-weight"
                          value={set.weight ?? ''}
                          onChange={e => handleWeightChange(exIdx, setIdx, e.target.value)}
                          onFocus={e => e.target.select()}
                          placeholder={set.plannedWeight != null ? String(set.plannedWeight) : prevSet ? String(prevSet.weight) : '-'}
                          className={cn(
                            density.input,
                            'text-center text-sm px-0.5 min-w-0',
                            weightErrorKey === `${exIdx}-${setIdx}` && 'border-destructive focus-visible:ring-destructive',
                          )}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(density.stepper, 'shrink-0 text-xs text-muted-foreground')}
                          onPointerDown={() => { suppressRepsBlurRef.current = true; }}
                          onClick={() => handleWeightStep(exIdx, setIdx, set.weight, 1, exercise)}
                        >
                          +
                        </Button>
                      </div>
                      {/* SL-04: reps input with +/- buttons */}
                      <div className="flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(density.stepper, 'shrink-0 text-xs text-muted-foreground')}
                          onPointerDown={() => { suppressRepsBlurRef.current = true; }}
                          onClick={() => handleRepsStep(exIdx, setIdx, set.actualReps, -1)}
                        >
                          -
                        </Button>
                        <Input
                          type="number"
                          value={set.actualReps ?? ''}
                          onChange={e => handleRepsChange(exIdx, setIdx, e.target.value)}
                          onFocus={e => { suppressRepsBlurRef.current = false; e.target.select(); }}
                          // Enter/Return confirms the typed reps: complete the set
                          // (same flow as tapping the quick-reps bar). Suppress the
                          // blur handler that our own blur() call would trigger.
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !set.completed && !set.skipped && set.actualReps != null && set.actualReps > 0) {
                              e.preventDefault();
                              suppressRepsBlurRef.current = true;
                              e.currentTarget.blur();
                              handleQuickReps(exIdx, setIdx, set.actualReps);
                            }
                          }}
                          // Tabbing/tapping away after typing reps also completes the
                          // set, unless the blur came from a stepper or Enter (guarded).
                          onBlur={() => {
                            if (suppressRepsBlurRef.current) { suppressRepsBlurRef.current = false; return; }
                            if (!set.completed && !set.skipped && set.actualReps != null && set.actualReps > 0) {
                              handleQuickReps(exIdx, setIdx, set.actualReps);
                            }
                          }}
                          placeholder={set.plannedReps != null ? formatReps(set.plannedReps, set.plannedRepsMax) : prevSet ? String(prevSet.reps) : '-'}
                          className={cn(density.input, 'text-center text-sm px-0.5 min-w-0')}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(density.stepper, 'shrink-0 text-xs text-muted-foreground')}
                          onPointerDown={() => { suppressRepsBlurRef.current = true; }}
                          onClick={() => handleRepsStep(exIdx, setIdx, set.actualReps, 1)}
                        >
                          +
                        </Button>
                      </div>
                      {/* Delete set */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(density.action, 'text-muted-foreground hover:text-destructive')}
                        onClick={() => removeWorkoutSet(workoutId, exIdx, setIdx)}
                        aria-label="Set verwijderen"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {/* E3-19: one-tap "same as previous" for the active set */}
                    {isActiveSet && !set.completed && !set.skipped && prevSet && (
                      <div className="px-3 pt-1">
                        <button
                          type="button"
                          onClick={() => handleSameAsPrevious(exIdx, setIdx, prevSet)}
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent"
                        >
                          <History className="h-3 w-3" />
                          Zelfde als vorige: {prevSet.weight}kg × {prevSet.reps}
                        </button>
                      </div>
                    )}
                    {/* SL-05: weight required before a set can be completed */}
                    {isActiveSet && !set.completed && !set.skipped && weightErrorKey === `${exIdx}-${setIdx}` && (
                      <div className="px-3 pt-1">
                        <span className="text-[11px] text-destructive">
                          Vul eerst een gewicht in (0 voor lichaamsgewicht).
                        </span>
                      </div>
                    )}
                    {/* Quick reps bar under the active set — tapping completes the set */}
                    {isActiveSet && !set.completed && !set.skipped && (
                      <QuickRepsBar
                        selected={set.actualReps}
                        onSelect={(reps) => handleQuickReps(exIdx, setIdx, reps)}
                        btnClass={density.quickRep}
                      />
                    )}
                    </div>
                  );
                })}
              </div>
                </>
              )}
            </div>
          );
          });
          if (ssBlock.length === 1) return cards[0];
          return (
            <div
              key={`ss-${workout.exercises[ssBlock[0]!]!.supersetGroup}`}
              data-testid="superset-group"
              className="rounded-xl border border-primary/30 bg-primary/5 p-1.5 space-y-3"
            >
              <div className="px-1.5 pt-0.5 flex items-center gap-1 text-[11px] font-medium text-primary">
                <Link2 className="h-3 w-3" /> Superset
              </div>
              {cards}
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
              <div className="h-48 overflow-y-auto space-y-1">
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
