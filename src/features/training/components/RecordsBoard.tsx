import { useMemo } from 'react';
import { Trophy } from 'lucide-react';
import { useCompletedWorkouts } from '../hooks/useProgress';
import { useExercises } from '../hooks/useExercises';
import { allTimePRs } from '../lib/metrics';
import { goalProgress } from '../lib/goalProgress';
import { GoalProgressBar } from './GoalProgressBar';
import { useSettings } from '../../../hooks/useSettings';
import { Card, CardContent } from '@/components/ui/card';

function formatDate(date: Date): string {
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function RecordsBoard({ onSelect }: { onSelect: (exerciseId: string) => void }) {
  const workouts = useCompletedWorkouts();
  const exercises = useExercises();
  const settings = useSettings();

  // Non-deleted exercises only: deleted ones drop off the board (and get no goal UI).
  const byId = useMemo(() => new Map(exercises.map(e => [e.id, e])), [exercises]);

  // All-time PRs, sorted by strongest estimated 1RM first.
  const records = useMemo(
    () =>
      allTimePRs(workouts, settings.oneRMFormula)
        .filter(pr => byId.has(pr.exerciseId))
        .sort((a, b) => b.best1RM - a.best1RM),
    [workouts, settings.oneRMFormula, byId],
  );

  if (records.length === 0) {
    return (
      <div className="px-4 py-16 text-center text-muted-foreground text-small">
        Nog geen records. Log een training om je persoonlijke records te zien.
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-2">
      {records.map(pr => {
        const exercise = byId.get(pr.exerciseId);
        const name = exercise?.name ?? '';
        const progress = goalProgress(exercise?.goal, pr.best1RM, settings.oneRMFormula);
        return (
          <Card key={pr.exerciseId} className="shadow-none overflow-hidden">
            <button
              onClick={() => onSelect(pr.exerciseId)}
              className="w-full text-left hover:bg-line/40 transition-colors"
            >
              <CardContent className="p-3 flex items-center gap-3">
                <Trophy className="h-4 w-4 text-accent shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-small font-medium truncate">{name}</p>
                  <p className="text-caption text-muted-foreground">
                    {pr.weight} kg × {pr.reps} · {formatDate(pr.date)}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-small font-semibold tabular-nums">~{Math.round(pr.best1RM)} kg</p>
                  <p className="text-nav text-muted-foreground">geschat 1RM</p>
                </div>
              </CardContent>
            </button>
            {progress && (
              <GoalProgressBar
                className="px-3 pb-3"
                progress={progress}
                exerciseName={name}
                // Offer a new goal once this one is reached.
                editHref={progress.achieved ? `/exercises/${pr.exerciseId}/edit` : undefined}
              />
            )}
          </Card>
        );
      })}
    </div>
  );
}
