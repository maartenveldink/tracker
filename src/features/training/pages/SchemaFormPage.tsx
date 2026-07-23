import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSchema, createSchema, updateSchema } from '../hooks/useSchemas';
import { useExercises } from '../hooks/useExercises';
import { useLatestOneRMByExercise, estimateWeightForReps } from '../hooks/useProgress';
import { useSettings } from '../../../hooks/useSettings';
import { formatReps } from '../lib/reps';
import { clampRest, formatRest, resolveRestSeconds } from '../lib/restTime';
import { steppedWeight, weightStepForExercise } from '../lib/weightStep';
import { groupSupersets, normalizeSupersets, supersetBlocks } from '../lib/superset';
import { cn } from '@/lib/utils';
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
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight, X, Plus, Minus, RotateCcw, Pencil, Trash2, Link2, Link2Off } from 'lucide-react';
import type { SchemaExercise, SchemaDay, Exercise } from '../../../db/index';

interface DayState {
  id: string;
  name: string;
  exercises: SchemaExercise[];
  order: number;
}

// --- Draft persistence for a new schema (survives navigating away) ---

const DRAFT_KEY = 'tracker:schemaDraft';

interface SchemaDraft {
  name: string;
  exercises: SchemaExercise[];
  days: DayState[];
  rotation: string[];
}

function loadDraft(): SchemaDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as SchemaDraft) : null;
  } catch {
    return null;
  }
}

function saveDraft(draft: SchemaDraft): void {
  // Don't persist a completely empty form
  const isEmpty = !draft.name.trim() && draft.exercises.length === 0 && draft.days.length === 0;
  try {
    if (isEmpty) localStorage.removeItem(DRAFT_KEY);
    else localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // storage may be unavailable; ignore
  }
}

function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

function roundToStep(value: number, step = 2.5): number {
  return Math.round(value / step) * step;
}

/**
 * Keyboard-free stepper row: label (+ optional caption) on the left, a
 * `– value +` control group on the right. One field per line so the schema
 * form stays legible on narrow screens.
 */
function StepperRow({
  label,
  value,
  onDec,
  onInc,
  decDisabled,
  caption,
  onReset,
}: {
  label: string;
  value: React.ReactNode;
  onDec: () => void;
  onInc: () => void;
  decDisabled?: boolean;
  caption?: React.ReactNode;
  onReset?: () => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium">{label}</span>
          {onReset && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-muted-foreground"
              onClick={onReset}
              aria-label={`${label} terug naar suggestie`}
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
          )}
        </div>
        {caption && <p className="text-xs leading-tight text-muted-foreground">{caption}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-full"
          onClick={onDec}
          disabled={decDisabled}
          aria-label={`${label} verlagen`}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <span className="w-16 text-center text-sm font-semibold tabular-nums select-none">
          {value}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 rounded-full"
          onClick={onInc}
          aria-label={`${label} verhogen`}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function SchemaFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEditing = id !== undefined;
  const schemaId = id ? Number(id) : undefined;
  const existing = useSchema(schemaId);
  const allExercises = useExercises();
  const settings = useSettings();
  const latestOneRM = useLatestOneRMByExercise(settings.oneRMFormula);
  const navigate = useNavigate();

  /** Suggested start weight from the latest 1RM and the rep-range lower bound. */
  const suggestStartWeight = useCallback(
    (exerciseId: number, repsMin: number): number | null => {
      const oneRM = latestOneRM.get(exerciseId);
      if (!oneRM || oneRM <= 0) return null;
      return roundToStep(estimateWeightForReps(oneRM, repsMin, settings.oneRMFormula));
    },
    [latestOneRM, settings.oneRMFormula],
  );

  // Restore a saved draft once (new schema only), before the first render
  const draftRef = useRef<SchemaDraft | null | undefined>(undefined);
  if (draftRef.current === undefined) {
    draftRef.current = isEditing ? null : loadDraft();
  }
  const draft = draftRef.current;

  const [name, setName] = useState(draft?.name ?? '');
  // Single-day mode: exercises stored flat
  const [exercises, setExercises] = useState<SchemaExercise[]>(draft?.exercises ?? []);
  // Multi-day mode: days with their own exercises
  const [days, setDays] = useState<DayState[]>(draft?.days ?? []);
  // Multi-day repetition rhythm: ordered list of day IDs (e.g. A, B, A, C)
  const [rotation, setRotation] = useState<string[]>(draft?.rotation ?? []);
  const [activeTab, setActiveTab] = useState<string>(
    draft?.days && draft.days.length > 0 ? draft.days[0]!.id : 'single',
  );
  const [showPicker, setShowPicker] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState('');
  // Which day ID is currently active for exercise picker (null = single-day mode)
  const [pickerDayId, setPickerDayId] = useState<string | null>(null);
  // Editing day name
  const [editingDayId, setEditingDayId] = useState<string | null>(null);
  // Which exercise cards are expanded (by exerciseId). Added exercises start collapsed
  // so more fit on screen; the header toggles expansion.
  const [expandedExercises, setExpandedExercises] = useState<Set<number>>(new Set());

  function toggleExpanded(exerciseId: number) {
    setExpandedExercises(prev => {
      const next = new Set(prev);
      if (next.has(exerciseId)) next.delete(exerciseId);
      else next.add(exerciseId);
      return next;
    });
  }
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

  // Auto-save the draft while creating a new schema
  useEffect(() => {
    if (isEditing) return;
    saveDraft({ name, exercises, days, rotation });
  }, [isEditing, name, exercises, days, rotation]);

  const exerciseMap = useMemo(() => {
    const map = new Map<number, string>();
    allExercises.forEach(e => map.set(e.id!, e.name));
    return map;
  }, [allExercises]);

  const exerciseById = useMemo(() => {
    const map = new Map<number, Exercise>();
    allExercises.forEach(e => map.set(e.id!, e));
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
      normalizeSupersets(prev.filter((_, i) => i !== index)).map((e, i) => ({ ...e, order: i }))
    );
  }

  /** Link the exercise at `index` into a superset with the one above it, or unlink it. */
  function toggleSupersetLink(index: number) {
    if (index <= 0) return;
    setCurrentExercises(prev => {
      const cur = prev[index]!;
      const above = prev[index - 1]!;
      const isLinked = !!cur.supersetGroup && cur.supersetGroup === above.supersetGroup;
      let next: SchemaExercise[];
      if (isLinked) {
        next = prev.map((e, i) => {
          if (i !== index) return e;
          const { supersetGroup: _drop, ...rest } = e;
          return rest;
        });
      } else {
        const groupId = above.supersetGroup ?? crypto.randomUUID();
        next = prev.map((e, i) =>
          i === index || i === index - 1 ? { ...e, supersetGroup: groupId } : e
        );
      }
      return normalizeSupersets(next);
    });
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
      return normalizeSupersets(updated).map((e, i) => ({ ...e, order: i }));
    });
  }

  function stepSets(index: number, delta: number) {
    setCurrentExercises(prev =>
      prev.map((e, i) => (i === index ? { ...e, sets: Math.max(1, e.sets + delta) } : e))
    );
  }

  function stepReps(index: number, delta: number) {
    setCurrentExercises(prev =>
      prev.map((e, i) => {
        if (i !== index) return e;
        const repsPerSet = Math.max(1, e.repsPerSet + delta);
        // Keep the range valid: drop the max if it no longer exceeds the min.
        const repsMax = e.repsMax != null && e.repsMax <= repsPerSet ? undefined : e.repsMax;
        return { ...e, repsPerSet, repsMax };
      })
    );
  }

  function stepRepsMax(index: number, delta: number) {
    setCurrentExercises(prev =>
      prev.map((e, i) => {
        if (i !== index) return e;
        if (delta > 0) {
          const base = e.repsMax ?? e.repsPerSet;
          return { ...e, repsMax: base + 1 };
        }
        if (e.repsMax == null) return e;
        const next = e.repsMax - 1;
        return { ...e, repsMax: next > e.repsPerSet ? next : undefined };
      })
    );
  }

  function stepStartWeight(index: number, dir: 1 | -1) {
    setCurrentExercises(prev =>
      prev.map((e, i) => {
        if (i !== index) return e;
        const base = e.startWeight ?? suggestStartWeight(e.exerciseId, e.repsPerSet) ?? 0;
        const exercise = exerciseById.get(e.exerciseId);
        return { ...e, startWeight: steppedWeight(base, dir, weightStepForExercise(exercise, settings.weightSteps)) };
      })
    );
  }

  function resetStartWeight(index: number) {
    setCurrentExercises(prev =>
      prev.map((e, i) => (i === index ? { ...e, startWeight: undefined } : e))
    );
  }

  function stepRest(index: number, delta: number) {
    setCurrentExercises(prev =>
      prev.map((e, i) => {
        if (i !== index) return e;
        const base = e.restSeconds ?? resolveRestSeconds({
          exercise: exerciseById.get(e.exerciseId),
          settings,
        });
        return { ...e, restSeconds: clampRest(base + delta) };
      })
    );
  }

  function resetRest(index: number) {
    setCurrentExercises(prev =>
      prev.map((e, i) => (i === index ? { ...e, restSeconds: undefined } : e))
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

    // Snapshot the suggested start weight so a freshly-started workout has a
    // concrete seed even when the user never touched the auto value.
    const snapshotWeights = (exs: SchemaExercise[]): SchemaExercise[] =>
      exs.map(e => {
        if (e.startWeight != null) return e;
        const s = suggestStartWeight(e.exerciseId, e.repsPerSet);
        return s != null ? { ...e, startWeight: s } : e;
      });

    const schemaData = isMultiDay
      ? {
          name: name.trim(),
          exercises: [] as SchemaExercise[],
          days: days.map(d => ({ ...d, exercises: snapshotWeights(d.exercises) })) as SchemaDay[],
          rotation: cleanRotation.length > 0 ? cleanRotation : undefined,
        }
      : { name: name.trim(), exercises: snapshotWeights(exercises), days: undefined, rotation: undefined };

    if (isEditing && schemaId) {
      await updateSchema(schemaId, schemaData);
      navigate(`/schemas/${schemaId}`);
    } else {
      const newId = await createSchema(schemaData.name, schemaData.exercises, schemaData.days, schemaData.rotation);
      clearDraft();
      navigate(`/schemas/${newId}`);
    }
  }

  function discardDraft() {
    setName('');
    setExercises([]);
    setDays([]);
    setRotation([]);
    setActiveTab('single');
    clearDraft();
  }

  // --- Render helpers ---

  function renderExerciseCard(ex: SchemaExercise, i: number, totalLength: number, info: ReturnType<typeof groupSupersets>[number]) {
          const suggestion = suggestStartWeight(ex.exerciseId, ex.repsPerSet);
          const effectiveWeight = ex.startWeight ?? suggestion;
          const isAutoWeight = ex.startWeight == null;
          const inheritedRest = resolveRestSeconds({
            exercise: exerciseById.get(ex.exerciseId),
            settings,
          });
          const effectiveRest = ex.restSeconds ?? inheritedRest;
          const isAutoRest = ex.restSeconds == null;
          const isExpanded = expandedExercises.has(ex.exerciseId);
          // Linked = shares a superset with the exercise directly above.
          const isLinkedAbove = i > 0 && info.inSuperset && !info.isFirst;
          const summary =
            `${ex.sets} × ${formatReps(ex.repsPerSet, ex.repsMax)} · rust ${formatRest(effectiveRest)}` +
            (effectiveWeight != null ? ` · ${effectiveWeight} kg` : '');
          return (
          <Card key={`${ex.exerciseId}-${i}`} data-testid="schema-exercise" className="shadow-none">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleExpanded(ex.exerciseId)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  {info.inSuperset ? (
                    <span className="w-4 text-center shrink-0 text-xs font-semibold text-primary">{info.label}</span>
                  ) : (
                    <span className="text-muted-foreground text-xs w-4 text-center shrink-0">{i + 1}</span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium truncate">
                      {exerciseMap.get(ex.exerciseId) ?? 'Onbekend'}
                    </span>
                    {!isExpanded && (
                      <span className="block text-xs text-muted-foreground truncate">{summary}</span>
                    )}
                  </span>
                </button>
                {i > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={cn('h-7 w-7', isLinkedAbove ? 'text-primary' : 'text-muted-foreground')}
                    onClick={() => toggleSupersetLink(i)}
                    aria-label={isLinkedAbove ? 'Superset ontkoppelen' : 'Superset met vorige'}
                    title={isLinkedAbove ? 'Superset ontkoppelen' : 'Koppel als superset met de oefening erboven'}
                  >
                    {isLinkedAbove ? <Link2Off className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                  </Button>
                )}
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
              {isExpanded && (
                  <div className="mt-1 divide-y divide-border/60 border-t border-border/60">
                    <StepperRow
                      label="Sets"
                      value={ex.sets}
                      decDisabled={ex.sets <= 1}
                      onDec={() => stepSets(i, -1)}
                      onInc={() => stepSets(i, 1)}
                    />
                    <StepperRow
                      label="Reps"
                      value={ex.repsPerSet}
                      decDisabled={ex.repsPerSet <= 1}
                      onDec={() => stepReps(i, -1)}
                      onInc={() => stepReps(i, 1)}
                    />
                    <StepperRow
                      label="Max reps"
                      value={ex.repsMax ?? '—'}
                      caption={ex.repsMax == null ? 'geen bovengrens' : `range ${formatReps(ex.repsPerSet, ex.repsMax)}`}
                      decDisabled={ex.repsMax == null}
                      onDec={() => stepRepsMax(i, -1)}
                      onInc={() => stepRepsMax(i, 1)}
                    />
                    <StepperRow
                      label="Startgewicht"
                      value={effectiveWeight != null ? `${effectiveWeight} kg` : '—'}
                      decDisabled={(effectiveWeight ?? 0) <= 0}
                      onDec={() => stepStartWeight(i, -1)}
                      onInc={() => stepStartWeight(i, 1)}
                      onReset={!isAutoWeight && suggestion != null ? () => resetStartWeight(i) : undefined}
                      caption={
                        isAutoWeight
                          ? suggestion != null
                            ? `auto o.b.v. 1RM · ${ex.repsPerSet} reps`
                            : 'geen 1RM-historie'
                          : 'handmatig aangepast'
                      }
                    />
                    <StepperRow
                      label="Rust"
                      value={formatRest(effectiveRest)}
                      decDisabled={effectiveRest <= 15}
                      onDec={() => stepRest(i, -15)}
                      onInc={() => stepRest(i, 15)}
                      onReset={!isAutoRest ? () => resetRest(i) : undefined}
                      caption={isAutoRest ? 'standaard' : 'handmatig aangepast'}
                    />
                  </div>
              )}
            </CardContent>
          </Card>
          );
  }

  function renderExerciseList(exs: SchemaExercise[], totalLength: number) {
    const infos = groupSupersets(exs);
    const blocks = supersetBlocks(exs);
    return (
      <div className="space-y-2">
        {blocks.map(indices => {
          if (indices.length === 1) {
            const i = indices[0]!;
            return renderExerciseCard(exs[i]!, i, totalLength, infos[i]!);
          }
          return (
            <div
              key={`ss-${exs[indices[0]!]!.supersetGroup}`}
              data-testid="superset-group"
              className="rounded-xl border border-primary/30 bg-primary/5 p-1.5 space-y-1.5"
            >
              <div className="px-1.5 pt-0.5 flex items-center gap-1 text-[11px] font-medium text-primary">
                <Link2 className="h-3 w-3" />
                Superset
              </div>
              {indices.map(i => renderExerciseCard(exs[i]!, i, totalLength, infos[i]!))}
            </div>
          );
        })}
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

        {!isEditing && (name.trim() || exercises.length > 0 || days.length > 0) && (
          <Button
            type="button"
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={discardDraft}
          >
            Concept wissen
          </Button>
        )}
      </form>
    </div>
  );
}
