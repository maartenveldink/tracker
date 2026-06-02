import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { useExercises, deleteExercise, isExerciseInUse } from '../hooks/useExercises';
import { getMuscleGroups } from '../db/muscles';
import { MuscleChip } from '../components/MuscleChip';
import { PageHeader } from '../../../components/PageHeader';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

export function ExercisesPage() {
  const exercises = useExercises();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterMuscle, setFilterMuscle] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string; inUse: boolean } | null>(null);

  const muscleGroups = getMuscleGroups('global');

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

  async function handleDeleteClick(id: number, name: string) {
    const inUse = await isExerciseInUse(id);
    setDeleteTarget({ id, name, inUse });
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await deleteExercise(deleteTarget.id);
    setDeleteTarget(null);
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
                className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => handleDeleteClick(exercise.id!, exercise.name)}
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
    </div>
  );
}
