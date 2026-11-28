import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExercises } from '../hooks/useExercises';
import { useCompletedWorkouts } from '../hooks/useProgress';
import { useSettings } from '../../../hooks/useSettings';
import { startWorkout } from '../hooks/useWorkout';
import {
  suggestWorkout,
  findSimilarExercises,
  stalenessByGroup,
  stalestGroupForExercise,
  WEEKLY_SET_TARGET,
  NEVER_TRAINED_DAYS,
  type GroupStaleness,
} from '../lib/suggestWorkout';
import { getMuscleGroupById } from '../db/muscles';
import { estimateExercisesSeconds, formatEstimatedTime } from '../lib/estimateSchemaTime';
import { buildWorkoutExercises, seedHistoryWeights } from '../lib/workoutBuild';
import { normalizeSupersets } from '../lib/superset';
import { formatReps } from '../lib/reps';
import { exerciseCardSummary, toggleExpanded } from '../lib/exerciseEditCard';
import { ExerciseEditCard, ExerciseEditList, StepperRow } from '../components/ExerciseEditCard';
import { isCompletedSet } from '../lib/sets';
import { PageHeader } from '../../../components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  ArrowLeftRight,
  Plus,
  Minus,
  RefreshCw,
  Play,
  Clock,
} from 'lucide-react';
import type { SchemaExercise } from '../../../db/index';

const MIN_TARGET = 15;
const MAX_TARGET = 120;
const STEP_TARGET = 5;
const MIN_SETS = 1;
const MAX_SETS = 10;
const MIN_REPS = 1;
const MAX_REPS = 30;

function newSchemaExercise(exerciseId: string, order: number): SchemaExercise {
  return { exerciseId, sets: 3, repsPerSet: 8, repsMax: 12, order };
}

/** Human explanation of why an exercise's muscle group was prioritised. */
function formatReason(g: GroupStaleness): { text: string; urgent: boolean } {
  const name = getMuscleGroupById(g.groupId)?.name ?? g.groupId;
  if (g.daysSinceLast >= NEVER_TRAINED_DAYS) return { text: `${name} · nog niet getraind`, urgent: true };
  if (g.setsInWindow === 0) return { text: `${name} · ${g.daysSinceLast} dgn niet getraind`, urgent: true };
  if (g.setsInWindow < WEEKLY_SET_TARGET)
    return { text: `${name} · ${g.setsInWindow}/${WEEKLY_SET_TARGET} sets deze week`, urgent: true };
  return { text: `${name} · voldoende getraind`, urgent: false };
}

function reindex(items: SchemaExercise[]): SchemaExercise[] {
  return normalizeSupersets(items).map((it, order) => ({ ...it, order }));
}

export function SuggestWorkoutPage() {
  const exercises = useExercises();
  const completedWorkouts = useCompletedWorkouts();
  const settings = useSettings();
  const navigate = useNavigate();

  const exerciseById = useMemo(() => new Map(exercises.map(e => [e.id, e])), [exercises]);

  const hasHistory = useMemo(() => {
    const ids = new Set<string>();
    for (const w of completedWorkouts) {
      for (const we of w.exercises) {
        if (we.sets.some(isCompletedSet)) ids.add(we.exerciseId);
      }
    }
    return ids;
  }, [completedWorkouts]);

  const [targetMin, setTargetMin] = useState(45);
  const [items, setItems] = useState<SchemaExercise[]>([]);
  // Expanded cards by exercise id; cards start collapsed, like in the schema editor.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const seedRef = useRef(1);
  const initRef = useRef(false);

  const regenerate = useCallback(
    (min: number, seed: number) => {
      const list = suggestWorkout({
        completedWorkouts,
        exercises,
        level: settings.muscleDetailLevel,
        targetSeconds: min * 60,
        settings,
        hasHistory,
        seed,
      });
      setItems(reindex(list));
    },
    [completedWorkouts, exercises, settings, hasHistory],
  );

  // Initialise once exercises have loaded.
  useEffect(() => {
    if (initRef.current || exercises.length === 0) return;
    initRef.current = true;
    regenerate(targetMin, seedRef.current);
  }, [exercises, regenerate, targetMin]);

  const estSeconds = useMemo(
    () => estimateExercisesSeconds(items, exerciseById, settings),
    [items, exerciseById, settings],
  );

  const usedIds = useMemo(() => new Set(items.map(i => i.exerciseId)), [items]);

  // Why each exercise was chosen: the stalest primary muscle group per exercise.
  const stalenessMap = useMemo(
    () => stalenessByGroup(completedWorkouts, exerciseById, settings.muscleDetailLevel),
    [completedWorkouts, exerciseById, settings.muscleDetailLevel],
  );

  function changeTarget(delta: number) {
    const next = Math.min(MAX_TARGET, Math.max(MIN_TARGET, targetMin + delta));
    if (next === targetMin) return;
    setTargetMin(next);
    regenerate(next, seedRef.current);
  }

  function handleRegenerate() {
    seedRef.current += 1;
    regenerate(targetMin, seedRef.current);
  }

  // --- Editing ---
  function removeAt(index: number) {
    setItems(prev => reindex(prev.filter((_, i) => i !== index)));
  }

  function move(index: number, dir: -1 | 1) {
    setItems(prev => {
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return reindex(next);
    });
  }

  function stepSets(index: number, delta: number) {
    setItems(prev =>
      prev.map((it, i) => (i === index ? { ...it, sets: Math.max(MIN_SETS, Math.min(MAX_SETS, it.sets + delta)) } : it)),
    );
  }

  function stepReps(index: number, delta: number) {
    setItems(prev =>
      prev.map((it, i) => {
        if (i !== index) return it;
        const reps = Math.max(MIN_REPS, Math.min(MAX_REPS, it.repsPerSet + delta));
        const repsMax = it.repsMax != null ? Math.max(reps, it.repsMax + delta) : undefined;
        return { ...it, repsPerSet: reps, ...(repsMax != null ? { repsMax } : {}) };
      }),
    );
  }

  function toggleSuperset(index: number) {
    // Link with the previous exercise (join or start a group); unlink if already grouped with it.
    setItems(prev => {
      if (index === 0) return prev;
      const next = [...prev];
      const cur = next[index]!;
      const prevItem = next[index - 1]!;
      const linked = cur.supersetGroup && cur.supersetGroup === prevItem.supersetGroup;
      if (linked) {
        next[index] = { ...cur, supersetGroup: undefined };
      } else {
        const group = prevItem.supersetGroup ?? crypto.randomUUID();
        next[index - 1] = { ...prevItem, supersetGroup: group };
        next[index] = { ...cur, supersetGroup: group };
      }
      return reindex(next);
    });
  }

  function swapAt(index: number, exerciseId: string) {
    const previousId = items[index]?.exerciseId;
    setItems(prev => prev.map((it, i) => (i === index ? { ...it, exerciseId } : it)));
    // Keep the swapped card open when it was open (expansion is keyed by exercise id).
    if (previousId && expanded.has(previousId)) {
      setExpanded(prev => {
        const next = new Set(prev);
        next.delete(previousId);
        next.add(exerciseId);
        return next;
      });
    }
    setSwapIndex(null);
  }

  function addExercise(exerciseId: string) {
    setItems(prev => reindex([...prev, newSchemaExercise(exerciseId, prev.length)]));
    setShowAdd(false);
    setSearch('');
  }

  async function handleStart() {
    if (items.length === 0) return;
    const built = seedHistoryWeights(
      buildWorkoutExercises(items, exerciseById),
      completedWorkouts,
      exerciseById,
      settings,
    );
    const workoutId = await startWorkout(null, 'Voorgestelde training', built);
    navigate(`/workout/${workoutId}`);
  }

  // --- Swap / add sheets ---
  const [swapIndex, setSwapIndex] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState('');

  const swapCandidates = useMemo(() => {
    if (swapIndex === null) return [];
    const it = items[swapIndex];
    const ex = it && exerciseById.get(it.exerciseId);
    if (!ex) return [];
    const exclude = new Set(items.map(i => i.exerciseId));
    return findSimilarExercises(ex, exercises, exclude);
  }, [swapIndex, items, exerciseById, exercises]);

  const addCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return exercises
      .filter(e => !usedIds.has(e.id!))
      .filter(e => (q ? e.name.toLowerCase().includes(q) : true));
  }, [exercises, usedIds, search]);

  const overTarget = estSeconds >= targetMin * 60;

  return (
    <div className="min-h-screen pb-28">
      <PageHeader
        title="Voorgestelde training"
        backTo="/start"
        actions={
          <Button variant="ghost" size="icon" onClick={handleRegenerate} aria-label="Opnieuw genereren">
            <RefreshCw className="h-4 w-4" />
          </Button>
        }
      />

      {/* Duration control */}
      <div className="px-4 py-3">
        <Card>
          <CardContent className="p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-small text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Doelduur</span>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                className="h-touch w-touch"
                onClick={() => changeTarget(-STEP_TARGET)}
                disabled={targetMin <= MIN_TARGET}
                aria-label="Korter"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="tabular-nums font-medium w-14 text-center">{targetMin} min</span>
              <Button
                variant="outline"
                size="icon"
                className="h-touch w-touch"
                onClick={() => changeTarget(STEP_TARGET)}
                disabled={targetMin >= MAX_TARGET}
                aria-label="Langer"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
        <p className={cn('text-caption mt-2 text-center', overTarget ? 'text-muted-foreground' : 'text-accent-2')}>
          Geschat: {formatEstimatedTime(estSeconds)} · {items.length} oefeningen
        </p>
      </div>

      {/* Exercise list */}
      <div className="px-4 space-y-2">
        {items.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-small">
            Geen suggestie beschikbaar. Voeg eerst wat oefeningen toe of log een training.
          </div>
        ) : (
          <ExerciseEditList
            items={items}
            renderCard={(it, index, info) => {
              const ex = exerciseById.get(it.exerciseId);
              const stale = ex ? stalestGroupForExercise(ex, stalenessMap, settings.muscleDetailLevel) : undefined;
              return (
                <ExerciseEditCard
                  key={`${it.exerciseId}-${index}`}
                  name={ex?.name ?? 'Onbekend'}
                  index={index}
                  total={items.length}
                  info={info}
                  summary={exerciseCardSummary(it)}
                  reason={stale ? formatReason(stale) : undefined}
                  expanded={expanded.has(it.exerciseId)}
                  onToggle={() => setExpanded(prev => toggleExpanded(prev, it.exerciseId))}
                  onMove={direction => move(index, direction === 'up' ? -1 : 1)}
                  onRemove={() => removeAt(index)}
                  onToggleSuperset={() => toggleSuperset(index)}
                  actions={
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-touch px-2 text-caption text-muted"
                      onClick={() => setSwapIndex(index)}
                      aria-label="Wissel oefening"
                      title="Wissel voor een vergelijkbare oefening"
                    >
                      <ArrowLeftRight className="h-4 w-4" />
                      Wissel
                    </Button>
                  }
                >
                  <StepperRow
                    label="Sets"
                    value={it.sets}
                    decDisabled={it.sets <= MIN_SETS}
                    incDisabled={it.sets >= MAX_SETS}
                    onDec={() => stepSets(index, -1)}
                    onInc={() => stepSets(index, 1)}
                  />
                  <StepperRow
                    label="Reps"
                    value={formatReps(it.repsPerSet, it.repsMax)}
                    decDisabled={it.repsPerSet <= MIN_REPS}
                    incDisabled={it.repsPerSet >= MAX_REPS}
                    onDec={() => stepReps(index, -1)}
                    onInc={() => stepReps(index, 1)}
                  />
                </ExerciseEditCard>
              );
            }}
          />
        )}

        <Button variant="outline" className="w-full" onClick={() => setShowAdd(true)}>
          <Plus className="h-4 w-4" /> Oefening toevoegen
        </Button>
      </div>

      {/* Start bar */}
      <div className="fixed bottom-0 inset-x-0 border-t border-border bg-background/95 backdrop-blur px-4 py-3">
        <Button size="lg" className="w-full" onClick={handleStart} disabled={items.length === 0}>
          <Play className="h-4 w-4" /> Start training
        </Button>
      </div>

      {/* Swap sheet */}
      <Sheet open={swapIndex !== null} onOpenChange={open => !open && setSwapIndex(null)}>
        <SheetContent side="bottom" className="max-h-[70vh]">
          <SheetHeader>
            <SheetTitle>Vergelijkbare oefening</SheetTitle>
            <SheetDescription>Kies een alternatief voor dezelfde spiergroep.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 h-64 overflow-y-auto space-y-1">
            {swapCandidates.length === 0 ? (
              <p className="text-small text-muted-foreground px-1 py-4">Geen vergelijkbare oefening gevonden.</p>
            ) : (
              swapCandidates.map(e => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => swapAt(swapIndex!, e.id)}
                  className="w-full text-left px-3 py-2 text-small rounded-md hover:bg-line/60 transition-colors"
                >
                  {e.name}
                </button>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Add sheet */}
      <Sheet open={showAdd} onOpenChange={open => { setShowAdd(open); if (!open) setSearch(''); }}>
        <SheetContent side="bottom" className="max-h-[70vh]">
          <SheetHeader>
            <SheetTitle>Oefening toevoegen</SheetTitle>
            <SheetDescription>Voeg een extra oefening toe aan de suggestie.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <Input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Zoek oefening..."
              autoFocus
            />
            <div className="h-56 overflow-y-auto space-y-1">
              {addCandidates.map(e => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => addExercise(e.id)}
                  className="w-full text-left px-3 py-2 text-small rounded-md hover:bg-line/60 transition-colors"
                >
                  {e.name}
                </button>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
