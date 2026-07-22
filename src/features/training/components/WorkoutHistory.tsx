import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Clock, Layers, Weight } from 'lucide-react';
import { useCompletedWorkouts, deleteWorkout } from '../hooks/useProgress';
import { workoutVolume } from '../lib/metrics';
import { formatDurationLong } from '../../../lib/utils';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

function formatDate(date: Date): string {
  return date.toLocaleDateString('nl-NL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function WorkoutHistory() {
  const navigate = useNavigate();
  const workouts = useCompletedWorkouts();
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; date: Date } | null>(null);

  // Newest first
  const items = useMemo(() => workouts.slice().reverse(), [workouts]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    await deleteWorkout(deleteTarget.id);
    setDeleteTarget(null);
  }

  if (items.length === 0) {
    return (
      <div className="px-4 py-16 text-center text-muted-foreground text-sm">
        Nog geen gelogde trainingen.
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-2">
      {items.map(w => {
        const duration = w.completedAt
          ? w.completedAt.getTime() - w.startedAt.getTime() - w.totalPausedMs
          : 0;
        const volume = Math.round(workoutVolume(w));
        const sets = w.exercises.reduce((s, e) => s + e.sets.filter(x => x.completed).length, 0);

        return (
          <Card key={w.id} className="shadow-none">
            <CardContent className="p-3 flex items-center gap-3">
              <button
                onClick={() => navigate(`/workout/${w.id}/summary`, { state: { from: '/start/history' } })}
                className="min-w-0 flex-1 text-left"
              >
                <p className="text-sm font-medium truncate">
                  {w.schemaName ?? 'Losse training'}
                  {w.schemaDayName ? ` — ${w.schemaDayName}` : ''}
                </p>
                <p className="text-xs text-muted-foreground">{formatDate(w.startedAt)}</p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDurationLong(duration)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Layers className="h-3 w-3" />
                    {sets} sets
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Weight className="h-3 w-3" />
                    {volume} kg
                  </span>
                </div>
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => setDeleteTarget({ id: w.id!, date: w.startedAt })}
                aria-label="Verwijder training"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        );
      })}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Training verwijderen"
        message={`Weet je zeker dat je de training van ${deleteTarget ? formatDate(deleteTarget.date) : ''} wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`}
        confirmLabel="Verwijderen"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
