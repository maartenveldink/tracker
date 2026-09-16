import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Combine } from 'lucide-react';
import { useExercises, deleteExercise, isExerciseInUse, mergeExercises } from '../hooks/useExercises';
import { getMuscleGroups } from '../db/muscles';
import { useSettings } from '../../../hooks/useSettings';
import { MuscleChip } from '../components/MuscleChip';
import { PageHeader } from '../../../components/PageHeader';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import type { Exercise } from '../../../db/index';

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
          <Button asChild size="sm">
            <Link to="/exercises/new">
              <Plus className="h-4 w-4" />
              Nieuw
            </Link>
          </Button>
        }
      />

      {/* Search and filter (E1-05) */}
      <div className="px-4 py-3 space-y-2">
        <Input
          type="text"
          placeholder="Zoek oefening..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          value={filterMuscle}
          onChange={e => setFilterMuscle(e.target.value)}
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">Alle spiergroepen</option>
          {muscleGroups.map(m => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      {/* Exercise list (E1-01) */}
      <div className="px-4 space-y-2 pb-4">
        {filtered.length === 0 && (
          <p className="text-muted-foreground text-sm text-center py-8">Geen oefeningen gevonden.</p>
        )}
        {filtered.map(exercise => (
          <Card key={exercise.id} className="shadow-none">
            <CardContent className="p-3 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => navigate(`/exercises/${exercise.id}/edit`)}
                  className="text-left w-full"
                >
                  <h3 className="font-medium text-sm truncate">{exercise.name}</h3>
                  {exercise.description && (
                    <p className="text-muted-foreground text-xs mt-0.5 line-clamp-1">{exercise.description}</p>
                  )}
                </button>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {exercise.primaryMuscles.map(m => (
                    <MuscleChip key={m} muscleId={m} type="primary" />
                  ))}
                  {exercise.secondaryMuscles.map(m => (
                    <MuscleChip key={m} muscleId={m} type="secondary" />
                  ))}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                onClick={() => startMerge(exercise)}
                aria-label={`Samenvoegen ${exercise.name}`}
              >
                <Combine className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => handleDeleteClick(exercise.id, exercise.name)}
                aria-label={`Verwijder ${exercise.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ))}
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
                        : 'hover:bg-accent',
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
