import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Combine } from 'lucide-react';
import { useExercises, deleteExercise, isExerciseInUse, mergeExercises } from '../hooks/useExercises';
import { getMuscleGroups, getMuscleGroupById } from '../db/muscles';
import { useCompletedWorkouts } from '../hooks/useProgress';
import { formatLastPerformed, lastPerformedByExercise } from '../lib/lastPerformed';
import { daysAgo } from '../lib/home';
import { useSettings } from '../../../hooks/useSettings';
import { PageHeader } from '../../../components/PageHeader';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Chip } from '@/components/ui/chip';
import { listRowClass } from '@/components/ui/list-row';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import type { Exercise } from '../../../db/index';

function relativeDay(d: Date): string {
  const n = daysAgo(d);
  return n <= 0 ? 'Vandaag' : n === 1 ? 'Gisteren' : `${n} dagen geleden`;
}

export function ExercisesPage() {
  const exercises = useExercises();
  const navigate = useNavigate();
  const settings = useSettings();
  const [search, setSearch] = useState('');
  const [filterMuscle, setFilterMuscle] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; inUse: boolean } | null>(null);
  // Merge flow: pick a source to merge away, then a target to keep.
  const [mergeSource, setMergeSource] = useState<Exercise | null>(null);
  const [mergePickerOpen, setMergePickerOpen] = useState(false);
  const [mergeSearch, setMergeSearch] = useState('');
  const [mergeTarget, setMergeTarget] = useState<Exercise | null>(null);
  const [merging, setMerging] = useState(false);

  const muscleGroups = getMuscleGroups(settings.muscleDetailLevel);
  const workouts = useCompletedWorkouts();
  const lastById = useMemo(() => lastPerformedByExercise(workouts), [workouts]);

  const filtered = useMemo(() => {
    return exercises.filter(e => {
      const matchesSearch = !search || e.name.toLowerCase().includes(search.toLowerCase());
      const matchesMuscle =
        !filterMuscle ||
        e.primaryMuscles.includes(filterMuscle) ||
        e.secondaryMuscles.includes(filterMuscle);
      return matchesSearch && matchesMuscle;
    });
  }, [exercises, search, filterMuscle]);

  async function handleDeleteClick(id: string, name: string) {
    const inUse = await isExerciseInUse(id);
    setDeleteTarget({ id, name, inUse });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await deleteExercise(deleteTarget.id);
    setDeleteTarget(null);
  }

  // Candidate targets for a merge: every other non-deleted exercise.
  const mergeCandidates = useMemo(() => {
    if (!mergeSource) return [];
    const q = mergeSearch.toLowerCase();
    return exercises.filter(
      (e) => e.id !== mergeSource.id && (!q || e.name.toLowerCase().includes(q)),
    );
  }, [exercises, mergeSource, mergeSearch]);

  function startMerge(exercise: Exercise) {
    setMergeSource(exercise);
    setMergeTarget(null);
    setMergeSearch('');
    setMergePickerOpen(true);
  }

  async function confirmMerge() {
    if (!mergeSource || !mergeTarget) return;
    setMerging(true);
    try {
      await mergeExercises(mergeSource.id, mergeTarget.id);
    } finally {
      setMerging(false);
      setMergePickerOpen(false);
      setMergeTarget(null);
      setMergeSource(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Oefeningen"
        actions={
          <Button asChild size="sm" variant="outline" className="rounded-pill">
            <Link to="/exercises/new">
              <Plus className="h-4 w-4" />
              Nieuw
            </Link>
          </Button>
        }
      />

      {/* Search and filter (E1-05) */}
      <div className="space-y-3 px-5 py-3">
        <Input
          type="text"
          placeholder="Zoek oefening..."
          aria-label="Zoek een oefening"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-12 rounded-pill px-4 text-base"
        />
        <div role="group" aria-label="Filter op spiergroep" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-0.5">
          <Chip selected={filterMuscle === ''} onClick={() => setFilterMuscle('')}>
            Alle
          </Chip>
          {muscleGroups.map(m => (
            <Chip key={m.id} selected={filterMuscle === m.id} onClick={() => setFilterMuscle(m.id)}>
              {m.name}
            </Chip>
          ))}
        </div>
      </div>

      {/* Exercise list (E1-01) */}
      <div className="space-y-1.5 px-5 pb-4">
        {filtered.length === 0 && (
          <p className="py-8 text-center text-small text-muted">Geen oefeningen gevonden.</p>
        )}
        {filtered.map(exercise => {
          const last = lastById.get(exercise.id);
          const muscles = exercise.primaryMuscles
            .map(m => getMuscleGroupById(m)?.name)
            .filter((n): n is string => Boolean(n))
            .join(', ');
          return (
            <div key={exercise.id} className={cn(listRowClass, 'gap-1 py-0 pr-1')}>
              <button
                type="button"
                onClick={() => navigate(`/exercises/${exercise.id}/edit`)}
                className="grid min-h-14 min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex min-w-0 flex-col">
                  <h3 className="truncate text-body-lg font-semibold leading-snug">{exercise.name}</h3>
                  {muscles && <span className="truncate text-caption text-muted">{muscles}</span>}
                </span>
                {last && (
                  <span className="flex flex-col items-end">
                    <span className="text-small font-semibold tabular-nums">{formatLastPerformed(last)}</span>
                    <span className="text-[11px] text-muted">{relativeDay(last.date)}</span>
                  </span>
                )}
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-touch w-10 shrink-0 text-muted hover:text-text"
                onClick={() => startMerge(exercise)}
                aria-label={`Samenvoegen ${exercise.name}`}
              >
                <Combine className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-touch w-10 shrink-0 text-muted hover:text-destructive"
                onClick={() => handleDeleteClick(exercise.id, exercise.name)}
                aria-label={`Verwijder ${exercise.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>

      {/* Delete confirmation (E1-04) */}
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Oefening verwijderen"
        message={
          deleteTarget?.inUse
            ? `"${deleteTarget.name}" wordt gebruikt in schema's of trainingen. Weet je zeker dat je deze wilt verwijderen?`
            : `Weet je zeker dat je "${deleteTarget?.name}" wilt verwijderen?`
        }
        confirmLabel="Verwijderen"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* Merge: pick the exercise to keep, then confirm — one sheet, stable DOM
          (the confirm button is always present, enabled once a target is picked). */}
      <Sheet
        open={mergePickerOpen}
        onOpenChange={(open) => {
          setMergePickerOpen(open);
          if (!open) { setMergeSource(null); setMergeTarget(null); }
        }}
      >
        <SheetContent side="bottom" className="max-h-[70vh]">
          <SheetHeader>
            <SheetTitle>Samenvoegen met…</SheetTitle>
            <SheetDescription>
              Kies de oefening die je wilt behouden. Alle sets, trainingen en
              schema&apos;s van &quot;{mergeSource?.name}&quot; gaan daar naartoe.
              &quot;{mergeSource?.name}&quot; wordt daarna verwijderd.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <Input
              type="text"
              value={mergeSearch}
              onChange={(e) => setMergeSearch(e.target.value)}
              placeholder="Zoek oefening..."
              autoFocus
            />
            <div className="h-64 overflow-y-auto space-y-1">
              {mergeCandidates.length === 0 ? (
                <p className="text-sm text-muted-foreground px-1 py-4">Geen andere oefening gevonden.</p>
              ) : (
                mergeCandidates.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setMergeTarget(e)}
                    className={cn(
                      'w-full text-left px-3 py-2 text-sm rounded-md transition-colors',
                      mergeTarget?.id === e.id
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-line/60',
                    )}
                  >
                    {e.name}
                  </button>
                ))
              )}
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
              <span className="text-xs text-muted-foreground truncate">
                {mergeTarget ? `Behouden: ${mergeTarget.name}` : 'Kies een oefening'}
              </span>
              <Button onClick={confirmMerge} disabled={!mergeTarget || merging}>
                {merging ? 'Bezig…' : 'Samenvoegen'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
