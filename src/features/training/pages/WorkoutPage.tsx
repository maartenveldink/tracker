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
  setExerciseSets,
} from '../hooks/useWorkout';
import { useExercises, useExerciseLookup, updateExercise } from '../hooks/useExercises';
import { useWakeLock } from '../hooks/useWakeLock';
import { resolveRestSeconds } from '../lib/restTime';
import { resolveStep, steppedWeight, weightStepForExercise } from '../lib/weightStep';
import { groupSupersets } from '../lib/superset';
import { isExerciseDone } from '../lib/insertPosition';
import {
  activeSetIndex,
  afterSetLogged,
  canAddSet,
  canRemoveLastSet,
  exerciseStatuses,
  findNextTodo,
  focusAfterInsert,
  formatDecimal,
  formatPrevLine,
  initialSetValues,
  parseDecimal,
  primaryAction,
  primaryLabel,
  restoreSkippedSets,
  skipRemainingSets,
} from '../lib/liveTraining';
import { useCompletedWorkouts, calculate1RM, type OneRMFormula } from '../hooks/useProgress';
import { volumePerMuscleGroup } from '../lib/metrics';
import { bestOneRMForExercise, previousBestOneRM } from '../lib/progression';
import { CelebrationBurst } from '../components/CelebrationBurst';
import { LiveStepper } from '../components/LiveStepper';
import { LiveRestStrip, type RestTimerState } from '../components/LiveRestStrip';
import { LiveOverviewSheet, type OverviewRow } from '../components/LiveOverviewSheet';
import { LiveAddExerciseSheet } from '../components/LiveAddExerciseSheet';
import { useSettings } from '../../../hooks/useSettings';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { isWeightedSet } from '../lib/sets';
import { cn, formatDurationClock } from '@/lib/utils';
import { Pause, Play, ListChecks, Minus, Plus, Link2, History } from 'lucide-react';
import type { Workout } from '../../../db/index';

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
  exerciseId: string,
  completedWorkouts: Workout[],
  currentWorkoutId: string | undefined,
  formula: OneRMFormula,
): PreviousSessionRef | null {
  // Walk workouts from newest to oldest, skip the current workout
  for (let i = completedWorkouts.length - 1; i >= 0; i--) {
    const w = completedWorkouts[i];
    if (!w) continue;
    if (w.id === currentWorkoutId) continue;

    const exerciseData = w.exercises.find(e => e.exerciseId === exerciseId);
    if (!exerciseData) continue;

    const completedSets = exerciseData.sets.filter(isWeightedSet);
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

// --- Main component ---

const WEIGHT_ERROR = 'Vul eerst een gewicht in (0 voor lichaamsgewicht).';
const REPS_ERROR = 'Vul het aantal herhalingen in.';

/** Local draft of the stepper values; `key` ties it to one current exercise. */
interface StepperDraft {
  key: string;
  weight?: string;
  reps?: string;
}

export function WorkoutPage() {
  const { id } = useParams<{ id: string }>();
  const workoutId = id || undefined;
  const workout = useWorkout(workoutId);
  // allExercises feeds the add-exercise picker (no deleted ones); the lookup is
  // for displaying names/stats of exercises already in the workout.
  const allExercises = useExercises();
  const { byId: exerciseMap, nameOf } = useExerciseLookup();
  const completedWorkouts = useCompletedWorkouts();
  const settings = useSettings();
  const navigate = useNavigate();

  const [elapsed, setElapsed] = useState(0);
  const [showOverview, setShowOverview] = useState(false);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [showFinish, setShowFinish] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [exerciseNotesDraft, setExerciseNotesDraft] = useState<{ idx: number; text: string } | null>(null);
  const [workoutNotesDraft, setWorkoutNotesDraft] = useState<string | null>(null);
  const [draft, setDraft] = useState<StepperDraft | null>(null);
  const [inputError, setInputError] = useState<'weight' | 'reps' | null>(null);
  const [restTimer, setRestTimer] = useState<RestTimerState | null>(null);
  // Per-exercise rest override for this session (exerciseId -> seconds)
  const [exerciseRest, setExerciseRest] = useState<Record<string, number>>({});
  const [deleteExerciseIdx, setDeleteExerciseIdx] = useState<number | null>(null);
  // The "current exercise" pointer (the only UI state of the state machine).
  // undefined = not chosen yet: the first `todo` exercise (resume-friendly);
  // -1 = klaar-toestand.
  const [curState, setCurState] = useState<number | undefined>(undefined);

  // Guards against a double tap logging a set / inserting an exercise twice
  const busyRef = useRef(false);

  useWakeLock(workout?.status === 'active' || workout?.status === 'paused');

  useEffect(() => {
    setExerciseNotesDraft(null);
    setWorkoutNotesDraft(null);
    setDraft(null);
    setCurState(undefined);
    setRestTimer(null);
  }, [workoutId]);

  // Build previous session references for each exercise in the workout (E3-10)
  const previousSessions = useMemo(() => {
    const map = new Map<string, PreviousSessionRef | null>();
    if (!workout) return map;
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

  // Volume per muscle group so far this session (shown in the overview sheet).
  const muscleVolume = useMemo(
    () => (workout ? volumePerMuscleGroup([workout], exerciseMap) : new Map<string, number>()),
    [workout, exerciseMap],
  );

  // Timer (E3-06)
  const workoutStatus = workout?.status;
  const startedAt = workout?.startedAt;
  const pausedAt = workout?.pausedAt;
  const totalPausedMs = workout?.totalPausedMs;

  useEffect(() => {
    if (!workoutStatus || workoutStatus === 'completed') return;
    const tick = () => {
      if (workoutStatus === 'paused' && pausedAt && startedAt) {
        setElapsed(pausedAt.getTime() - startedAt.getTime() - (totalPausedMs ?? 0));
      } else if (startedAt) {
        setElapsed(Date.now() - startedAt.getTime() - (totalPausedMs ?? 0));
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [workoutStatus, startedAt, pausedAt, totalPausedMs]);

  // RT-01: Rest timer countdown. Re-runs only when a new timer starts (unique
  // startedAt); functional updates handle the countdown.
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restTimer?.startedAt]);

  // Navigate to summary when workout is completed (must be in useEffect, not during render)
  const completedRef = useRef(false);
  useEffect(() => {
    completedRef.current = false;
  }, [workoutId]);
  useEffect(() => {
    if (workout?.status === 'completed' && workoutId && !completedRef.current) {
      completedRef.current = true;
      navigate(`/workout/${workoutId}/summary`, { replace: true });
    }
  }, [workout?.status, workoutId, navigate]);

  // --- WP5 extension point ("Oefening klaar" celebration) ---------------------
  // Fires once per exercise at the moment its last set is settled with a better
  // best-1RM than the previous session. WP5 replaces CelebrationBurst + this
  // effect with the full "Oefening klaar" moment (banner, comparison table,
  // confetti); the state machine (`lib/liveTraining.ts`) needs no change: the
  // moment is "the current exercise is complete" (see `exerciseComplete` below).
  const celebratedRef = useRef<Set<string>>(new Set());
  const [celebrateNonce, setCelebrateNonce] = useState(0);
  useEffect(() => {
    celebratedRef.current = new Set();
  }, [workoutId]);
  useEffect(() => {
    if (!workout || workout.status === 'completed') return;
    const formula = settings.oneRMFormula;
    for (const we of workout.exercises) {
      const done = isExerciseDone(we);
      const hasCompleted = we.sets.some(isWeightedSet);
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
  // -----------------------------------------------------------------------------

  // Pin the current-exercise pointer once the workout has loaded, so finishing
  // the last set of an exercise leaves it current ("Volgende oefening") instead
  // of silently jumping to the next todo.
  const exerciseList = workout?.exercises;
  useEffect(() => {
    if (curState === undefined && exerciseList && exerciseList.length > 0) {
      setCurState(findNextTodo(exerciseStatuses(exerciseList), -1));
    }
  }, [curState, exerciseList]);

  const setCur = useCallback((idx: number) => {
    setCurState(idx);
    setDraft(null);
    setInputError(null);
    setNotesOpen(false);
    setExerciseNotesDraft(null);
  }, []);

  if (!workout || !workoutId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted">Training laden...</p>
      </div>
    );
  }

  if (workout.status === 'completed') {
    return null;
  }

  const wid: string = workoutId;
  const exercises = workout.exercises;
  const statuses = exerciseStatuses(exercises);
  const cur = curState === undefined ? findNextTodo(statuses, -1) : curState >= exercises.length ? -1 : curState;
  const finished = cur < 0;
  const current = finished ? undefined : exercises[cur];
  const currentExercise = current ? exerciseMap.get(current.exerciseId) : undefined;
  const prevSession = current ? previousSessions.get(current.exerciseId) : undefined;
  const sets = current?.sets ?? [];
  const activeIdx = activeSetIndex(sets);
  const exerciseComplete = !!current && sets.length > 0 && activeIdx < 0;
  const nextIdx = finished ? -1 : findNextTodo(statuses, cur);
  const nextEx = nextIdx >= 0 ? exercises[nextIdx] : undefined;
  const ssInfo = current ? groupSupersets(exercises)[cur] : undefined;
  const action = primaryAction({ finished, exerciseComplete, hasNext: nextIdx >= 0 });
  const isPaused = workout.status === 'paused';
  const openExercises = statuses.filter(s => s === 'todo').length;

  // Stepper values: the draft while the user edits, else the derived start values.
  const draftKey = `${wid}:${cur}`;
  const base = current
    ? initialSetValues(sets, (prevSession?.sets ?? []).map(s => ({ weight: s.weight, reps: s.reps })))
    : { weight: null, reps: null };
  const live = draft && draft.key === draftKey ? draft : null;
  const weightText = live?.weight !== undefined ? live.weight : formatDecimal(base.weight);
  const repsText = live?.reps !== undefined ? live.reps : base.reps === null ? '' : String(base.reps);
  const weightStep = weightStepForExercise(currentExercise, settings.weightSteps);
  const stepLabel = formatDecimal(Math.round(resolveStep(weightStep).stepKg * 100) / 100);

  const prevSetForActive = activeIdx >= 0 ? prevSession?.sets[activeIdx] : undefined;
  const showSameAsPrevious =
    !!prevSetForActive &&
    (parseDecimal(weightText) !== prevSetForActive.weight || parseInt(repsText) !== prevSetForActive.reps);

  // Effective rest time (E3-15): session override -> schema exercise -> per-exercise
  // default -> laterality default -> global.
  function getRest(exerciseId: string): number {
    const override = exerciseRest[exerciseId];
    if (override !== undefined) return override;
    return resolveRestSeconds({
      schemaRestSeconds: exercises.find(e => e.exerciseId === exerciseId)?.restSeconds,
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

  function startRest(exerciseId: string) {
    const rest = getRest(exerciseId);
    setRestTimer({ remaining: rest, total: rest, startedAt: Date.now() });
  }

  function editDraft(patch: { weight?: string; reps?: string }) {
    setInputError(null);
    setDraft(prev => ({ ...(prev && prev.key === draftKey ? prev : { key: draftKey }), ...patch }));
  }

  function stepWeight(dir: 1 | -1) {
    editDraft({ weight: formatDecimal(steppedWeight(parseDecimal(weightText), dir, weightStep)) });
  }

  function stepReps(dir: 1 | -1) {
    const next = Math.max(1, (parseInt(repsText) || 0) + dir);
    editDraft({ reps: String(next) });
  }

  /** Log the active set (weight + reps) — persisted immediately — and move on. */
  async function logSet(weight: number, reps: number) {
    if (!current || activeIdx < 0 || busyRef.current) return;
    busyRef.current = true;
    try {
      requestNotifyPermission();
      const outcome = afterSetLogged(exercises, cur, activeIdx);
      await updateWorkoutSet(wid, cur, activeIdx, {
        weight,
        actualReps: reps,
        completed: true,
        skipped: false,
      });
      // Carry the weight over to the next set if it has none yet
      const nextSet = sets[activeIdx + 1];
      if (nextSet && nextSet.weight === null) {
        await updateWorkoutSet(wid, cur, activeIdx + 1, { weight });
      }
      setDraft(null);
      setInputError(null);
      if (outcome.rest) startRest(current.exerciseId);
      if (outcome.focusIdx !== cur) setCur(outcome.focusIdx);
    } finally {
      busyRef.current = false;
    }
  }

  async function handleSetDone() {
    const weight = parseDecimal(weightText);
    const reps = parseInt(repsText);
    // SL-05: a set needs a weight before it counts. 0 is valid (bodyweight).
    if (weight === null) return setInputError('weight');
    if (!Number.isFinite(reps) || reps <= 0) return setInputError('reps');
    await logSet(weight, reps);
  }

  async function handleSameAsPrevious() {
    if (prevSetForActive) await logSet(prevSetForActive.weight, prevSetForActive.reps);
  }

  function handlePrimary() {
    if (action === 'set') void handleSetDone();
    else if (action === 'next') setCur(nextIdx);
    else if (action === 'last') setCur(-1);
    else void completeWorkout(wid);
  }

  async function handleAddSet() {
    if (current && canAddSet(sets)) await addWorkoutSet(wid, cur);
  }

  async function handleRemoveLastSet() {
    if (current && canRemoveLastSet(sets)) await removeWorkoutSet(wid, cur, sets.length - 1);
  }

  // Undo completion of a logged set
  async function handleUncomplete(setIndex: number) {
    await updateWorkoutSet(wid, cur, setIndex, { completed: false });
  }

  async function skipExercise(idx: number) {
    const ex = exercises[idx];
    if (!ex) return;
    await setExerciseSets(wid, idx, skipRemainingSets(ex.sets));
    if (idx === cur) {
      const after = statuses.map((s, i) => (i === idx ? 'skipped' : s) as typeof s);
      setCur(findNextTodo(after, idx));
    }
  }

  async function restoreExercise(idx: number) {
    const ex = exercises[idx];
    if (!ex) return;
    await setExerciseSets(wid, idx, restoreSkippedSets(ex.sets));
    // In the klaar-toestand the restored exercise becomes current right away.
    if (finished) setCur(idx);
  }

  async function jumpTo(idx: number) {
    if (statuses[idx] === 'skipped') await restoreExercise(idx);
    setCur(idx);
    setShowOverview(false);
  }

  // Adjust this exercise's rest time for the session (15s steps, 15–600)
  function adjustRest(exerciseId: string, delta: number) {
    setExerciseRest(prev => {
      const currentRest = prev[exerciseId] ?? getRest(exerciseId);
      return { ...prev, [exerciseId]: Math.min(600, Math.max(15, currentRest + delta)) };
    });
  }

  // Persist the current rest time as this exercise's default
  async function saveRestAsDefault(exerciseId: string) {
    await updateExercise(exerciseId, { restTimerSeconds: getRest(exerciseId) });
    setExerciseRest(prev => {
      const next = { ...prev };
      delete next[exerciseId];
      return next;
    });
  }

  async function handleDeleteExercise() {
    if (deleteExerciseIdx === null) return;
    const idx = deleteExerciseIdx;
    await removeWorkoutExercise(wid, idx);
    setDeleteExerciseIdx(null);
    const remaining = statuses.filter((_, i) => i !== idx);
    if (idx < cur) setCur(cur - 1);
    else if (idx === cur) setCur(findNextTodo(remaining, idx - 1));
  }

  async function handleAddExercise(exerciseId: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    let at: number;
    try {
      at = await addWorkoutExercise(wid, exerciseId);
    } finally {
      busyRef.current = false;
    }
    if (at >= 0) {
      // The exercise is inserted mid-list: keep the pointer on the right exercise.
      setCur(focusAfterInsert(exercises, cur, at));
      // Other index-keyed state shifts along with the exercises behind it.
      setDeleteExerciseIdx(prev => (prev === null || prev < at ? prev : prev + 1));
    }
    setShowAddExercise(false);
    setShowOverview(false);
  }

  function openAdd() {
    setShowOverview(false);
    setShowAddExercise(true);
  }

  async function handleFinish() {
    setRestTimer(null);
    setShowFinish(false);
    await completeWorkout(wid);
    // Navigation handled exclusively by the useEffect watching workout.status === 'completed'
  }

  // --- Derived view data ---
  const overviewRows: OverviewRow[] = exercises.map((we, i) => {
    const prev = previousSessions.get(we.exerciseId);
    const settled = we.sets.filter(s => s.completed).length;
    const top = prev ? [...prev.sets].sort((a, b) => b.weight - a.weight || b.reps - a.reps)[0] : undefined;
    const info = groupSupersets(exercises)[i]!;
    return {
      name: nameOf(we.exerciseId),
      status: statuses[i]!,
      isCurrent: i === cur,
      meta:
        `${settled > 0 ? `${settled}/` : ''}${we.sets.length} sets` +
        (top ? ` · vorige ${formatDecimal(top.weight)} × ${top.reps}` : ' · nieuw'),
      superset: info.inSuperset ? info.label : undefined,
    };
  });

  const goal = currentExercise?.goal;
  const barLabel = `${workout.schemaDayName ?? workout.schemaName ?? 'Vrije training'} · ${
    finished ? 'klaar' : `oefening ${cur + 1} van ${exercises.length}`
  }`;
  const firstPlannedReps = nextEx?.sets[0]?.plannedReps;
  const nextLine = finished
    ? exercises.length === 0
      ? 'Voeg je eerste oefening toe.'
      : 'Alle oefeningen zijn gedaan of overgeslagen.'
    : nextEx
      ? `Straks: ${nameOf(nextEx.exerciseId)} · ${nextEx.sets.filter(s => s.side !== 'right').length} × ${firstPlannedReps ?? '–'}`
      : 'Dit is de laatste oefening.';
  const title = finished
    ? exercises.length === 0 ? 'Vrije training' : 'Training klaar'
    : nameOf(current!.exerciseId);
  const subline = finished
    ? exercises.length === 0 ? 'Nog geen oefeningen.' : 'Rond af, of voeg nog een oefening toe.'
    : prevSession
      ? `Vorige keer: ${formatPrevLine(prevSession.sets)}`
      : 'Geen eerdere sessie';

  const textBtn =
    'flex h-touch items-center px-1 text-small font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-chip disabled:opacity-40';

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-column flex-col bg-bg text-text">
      <CelebrationBurst key={celebrateNonce} play={celebrateNonce > 0} />

      <div className="flex flex-col gap-3.5 px-screen-x pt-5">
        {/* Header: no navigation bar during training (DESIGN §6) */}
        <header className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-small text-muted">{barLabel}</span>
            <span
              role="timer"
              aria-label="Duur van de training"
              className="font-display text-[22px] font-bold"
            >
              {formatDurationClock(elapsed)}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label="Oefeningen in deze training"
              onClick={() => setShowOverview(true)}
              className="flex h-touch w-touch items-center justify-center rounded-pill border border-line-strong hover:bg-line/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ListChecks className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => (isPaused ? resumeWorkout(wid) : pauseWorkout(wid))}
              className={cn(
                'flex h-touch items-center gap-1.5 rounded-pill border px-3.5 text-small font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isPaused ? 'border-accent text-accent' : 'border-line-strong text-text',
              )}
            >
              {isPaused ? <Play className="h-3.5 w-3.5" aria-hidden="true" /> : <Pause className="h-3.5 w-3.5" aria-hidden="true" />}
              {isPaused ? 'Hervat' : 'Pauze'}
            </button>
            <button
              type="button"
              onClick={() => setShowFinish(true)}
              className="h-touch rounded-pill border border-line-strong px-4 text-small font-semibold hover:bg-line/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Afronden
            </button>
          </div>
        </header>

        {isPaused && (
          <p role="status" className="rounded-row border border-line bg-surface px-3.5 py-2 text-center text-small text-accent-2">
            Training gepauzeerd
          </p>
        )}

        <div className="flex flex-col gap-2">
          <h1 data-testid="current-exercise" className="font-display text-screen font-bold tracking-tight">
            {title}
          </h1>
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-body text-muted">{subline}</span>
            {goal && (
              <span className="rounded-chip bg-line px-2.5 py-1 text-caption font-semibold text-accent">
                Doel: {formatDecimal(goal.weight)} kg × {goal.reps}
              </span>
            )}
            {ssInfo?.inSuperset && (
              <span
                data-testid="superset-badge"
                className="inline-flex items-center gap-1 rounded-chip bg-line px-2.5 py-1 text-caption font-semibold text-accent"
              >
                <Link2 className="h-3 w-3" aria-hidden="true" />
                Superset {ssInfo.label}
              </span>
            )}
          </div>
        </div>

        {/* Set list: klaar / nu / komt nog (DESIGN §4 "Set-rij") */}
        {current && (
          <ol className="flex flex-col gap-1.5" aria-label="Sets">
            {sets.map((set, i) => {
              const isNow = i === activeIdx;
              const badge = set.side ? (set.side === 'left' ? 'L' : 'R') : set.setNumber;
              const valueLabel = set.completed
                ? `${formatDecimal(set.weight ?? 0)} kg × ${set.actualReps}`
                : `${weightText ? formatDecimal(parseDecimal(weightText)) : '–'} kg × ${repsText || '–'}`;
              const rowBase =
                'grid min-h-12 w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 rounded-row px-3.5 text-left';
              const badgeBase = 'flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-bold';
              if (set.completed) {
                return (
                  <li key={set.setNumber}>
                    <button
                      type="button"
                      data-testid="set-row"
                      data-state="done"
                      aria-label={`Set ${set.setNumber}: ${valueLabel}, klaar. Tik om terug te zetten.`}
                      onClick={() => void handleUncomplete(i)}
                      className={cn(rowBase, 'border border-line bg-surface text-text')}
                    >
                      <span className={cn(badgeBase, 'bg-accent text-on-accent')}>{badge}</span>
                      <span className="text-body-lg font-medium">{valueLabel}</span>
                      <span className="text-[13px] text-muted">Klaar</span>
                    </button>
                  </li>
                );
              }
              if (set.skipped) {
                return (
                  <li key={set.setNumber}>
                    <div data-testid="set-row" data-state="skipped" className={cn(rowBase, 'border border-dashed border-line-strong text-muted opacity-60')}>
                      <span className={cn(badgeBase, 'bg-line text-muted')}>{badge}</span>
                      <span className="text-body-lg font-medium">Overgeslagen</span>
                      <span />
                    </div>
                  </li>
                );
              }
              return (
                <li key={set.setNumber}>
                  <div
                    data-testid="set-row"
                    data-state={isNow ? 'now' : 'todo'}
                    aria-current={isNow ? 'step' : undefined}
                    className={cn(
                      rowBase,
                      isNow
                        ? 'border-2 border-accent bg-bg text-text'
                        : 'border border-dashed border-line-strong text-muted',
                    )}
                  >
                    <span className={cn(badgeBase, isNow ? 'border-2 border-accent text-accent' : 'bg-line text-muted')}>
                      {badge}
                    </span>
                    <span className="text-body-lg font-medium">{valueLabel}</span>
                    <span className={cn('text-[13px]', isNow && 'font-bold text-accent')}>{isNow ? 'Nu' : ''}</span>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        {current && (
          <div className="flex flex-col">
            <div className="flex items-center justify-between">
              <button type="button" className={cn(textBtn, 'text-accent')} onClick={() => void handleAddSet()} disabled={!canAddSet(sets)}>
                + Set toevoegen
              </button>
              <button type="button" className={cn(textBtn, 'text-muted')} onClick={() => void handleRemoveLastSet()} disabled={!canRemoveLastSet(sets)}>
                Laatste set weghalen
              </button>
            </div>
            <div className="flex items-center justify-between">
              <button
                type="button"
                aria-expanded={notesOpen}
                className={cn(textBtn, 'text-muted')}
                onClick={() => setNotesOpen(o => !o)}
              >
                Notities
              </button>
              <button type="button" className={cn(textBtn, 'text-muted')} onClick={() => setDeleteExerciseIdx(cur)}>
                Oefening verwijderen
              </button>
            </div>
            {notesOpen && (
              <textarea
                aria-label="Notities voor deze oefening"
                value={exerciseNotesDraft?.idx === cur ? exerciseNotesDraft.text : current.notes}
                onChange={e => setExerciseNotesDraft({ idx: cur, text: e.target.value })}
                onBlur={e => {
                  const text = e.currentTarget.value;
                  setExerciseNotesDraft(null);
                  void updateExerciseNotes(wid, cur, text);
                }}
                placeholder="Notities voor deze oefening..."
                rows={2}
                className="mb-1 w-full resize-none rounded-row border border-line-strong bg-bg px-3.5 py-2 text-base placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            )}
            {/* Superset members rest after the round, so a per-exercise rest control would mislead. */}
            {!ssInfo?.inSuperset && (
              <RestControl
                seconds={getRest(current.exerciseId)}
                isDefault={exerciseRest[current.exerciseId] === undefined}
                onAdjust={delta => adjustRest(current.exerciseId, delta)}
                onSaveDefault={() => void saveRestAsDefault(current.exerciseId)}
              />
            )}
          </div>
        )}

        {restTimer && (
          <LiveRestStrip
            timer={restTimer}
            onExtend={() => setRestTimer(t => (t ? { ...t, remaining: t.remaining + 30, total: t.total + 30 } : t))}
            onReset={() => setRestTimer(t => (t ? { ...t, remaining: t.total, startedAt: Date.now() } : t))}
            onSkip={() => setRestTimer(null)}
          />
        )}
      </div>

      <div className="flex-1" />

      {/* Fixed bottom panel in thumb reach (DESIGN §5) */}
      <div className="sticky bottom-0 z-30 mt-4 flex flex-col gap-3.5 rounded-t-sheet border-t border-line bg-surface px-screen-x pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[18px]">
        {current && !exerciseComplete && (
          <div className="grid grid-cols-2 gap-3">
            <LiveStepper
              label="Gewicht (kg)"
              testId="weight-input"
              inputMode="decimal"
              value={weightText}
              onChange={text => editDraft({ weight: text })}
              onStep={stepWeight}
              minusLabel={`Gewicht ${stepLabel} kg minder`}
              plusLabel={`Gewicht ${stepLabel} kg meer`}
              invalid={inputError === 'weight'}
            />
            <LiveStepper
              label="Herhalingen"
              testId="reps-input"
              inputMode="numeric"
              value={repsText}
              onChange={text => editDraft({ reps: text.replace(/\D/g, '') })}
              onStep={stepReps}
              minusLabel="Eén herhaling minder"
              plusLabel="Eén herhaling meer"
              invalid={inputError === 'reps'}
            />
          </div>
        )}
        {inputError && (
          <p role="alert" className="-mt-1.5 text-caption text-destructive">
            {inputError === 'weight' ? WEIGHT_ERROR : REPS_ERROR}
          </p>
        )}
        {current && !exerciseComplete && showSameAsPrevious && prevSetForActive && (
          <button
            type="button"
            onClick={() => void handleSameAsPrevious()}
            className="-mt-1 inline-flex h-touch items-center justify-center gap-1.5 self-center rounded-pill border border-line-strong px-4 text-[13px] font-semibold text-muted hover:bg-line/60"
          >
            <History className="h-3.5 w-3.5" aria-hidden="true" />
            Zelfde als vorige: {formatDecimal(prevSetForActive.weight)} kg × {prevSetForActive.reps}
          </button>
        )}

        <Button size="xl" onClick={handlePrimary}>
          {primaryLabel(action)}
        </Button>

        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 text-[13px] text-muted">{nextLine}</span>
          {!finished ? (
            <Button variant="secondary" className="h-touch shrink-0 rounded-pill px-4 text-[13px]" onClick={() => void skipExercise(cur)}>
              Oefening overslaan
            </Button>
          ) : (
            <Button variant="secondary" className="h-touch shrink-0 rounded-pill px-4 text-[13px]" onClick={openAdd}>
              + Oefening toevoegen
            </Button>
          )}
        </div>
      </div>

      <LiveOverviewSheet
        open={showOverview}
        onOpenChange={setShowOverview}
        rows={overviewRows}
        muscleVolume={muscleVolume}
        workoutNotes={workoutNotesDraft ?? workout.notes}
        onWorkoutNotesChange={setWorkoutNotesDraft}
        onWorkoutNotesBlur={text => {
          setWorkoutNotesDraft(null);
          void updateWorkoutNotes(wid, text);
        }}
        onJump={i => void jumpTo(i)}
        onSkip={i => void skipExercise(i)}
        onRestore={i => void restoreExercise(i)}
        onAdd={openAdd}
      />

      <LiveAddExerciseSheet
        open={showAddExercise}
        onOpenChange={setShowAddExercise}
        exercises={allExercises}
        onAdd={id => void handleAddExercise(id)}
      />

      {/* Finish confirmation (sheet pattern, DESIGN §6) */}
      <Sheet open={showFinish} onOpenChange={setShowFinish}>
        <SheetContent side="bottom" className="flex flex-col gap-3">
          <SheetHeader>
            <SheetTitle>Training afronden</SheetTitle>
            <SheetDescription>
              {openExercises > 0
                ? `Je hebt nog ${openExercises} ${openExercises === 1 ? 'oefening' : 'oefeningen'} open staan. Wil je toch afronden?`
                : 'Wil je deze training afronden? Je kunt daarna de samenvatting bekijken.'}
            </SheetDescription>
          </SheetHeader>
          <Button size="lg" onClick={() => void handleFinish()}>
            Afronden
          </Button>
          <Button size="lg" variant="secondary" onClick={() => setShowFinish(false)}>
            Doorgaan met trainen
          </Button>
        </SheetContent>
      </Sheet>

      {/* Delete-exercise confirmation */}
      <ConfirmDialog
        open={deleteExerciseIdx !== null}
        title="Oefening verwijderen"
        message={
          deleteExerciseIdx !== null
            ? `Wil je "${nameOf(exercises[deleteExerciseIdx]?.exerciseId ?? '') || 'deze oefening'}" uit de training verwijderen? De gelogde sets gaan verloren.`
            : ''
        }
        confirmLabel="Verwijderen"
        variant="danger"
        onConfirm={() => void handleDeleteExercise()}
        onCancel={() => setDeleteExerciseIdx(null)}
      />
    </div>
  );
}

// --- Per-exercise rest control (kept from the previous screen) ---

function formatSecs(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function RestControl({
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
  const btn =
    'flex h-touch w-touch items-center justify-center rounded-chip text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  return (
    <div className="flex items-center gap-1">
      <span className="text-small text-muted">Rust</span>
      <button type="button" className={btn} aria-label="Rust verlagen" onClick={() => onAdjust(-15)}>
        <Minus className="h-4 w-4" aria-hidden="true" />
      </button>
      <span className="min-w-[2.5rem] text-center font-display text-small font-bold">{formatSecs(seconds)}</span>
      <button type="button" className={btn} aria-label="Rust verhogen" onClick={() => onAdjust(15)}>
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
      <div className="flex-1" />
      {!isDefault && (
        <button
          type="button"
          className="h-touch px-1 text-small font-semibold text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-chip"
          onClick={onSaveDefault}
        >
          Als standaard
        </button>
      )}
    </div>
  );
}
