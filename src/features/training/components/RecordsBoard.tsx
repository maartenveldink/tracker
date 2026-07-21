import { useMemo } from 'react';
import { Trophy } from 'lucide-react';
import { useCompletedWorkouts } from '../hooks/useProgress';
import { useExercises } from '../hooks/useExercises';
import { allTimePRs } from '../lib/metrics';
import { useSettings } from '../../../hooks/useSettings';
import { Card, CardContent } from '@/components/ui/card';

function formatDate(date: Date): string {
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function RecordsBoard({ onSelect }: { onSelect: (exerciseId: number) => void }) {
  const workouts = useCompletedWorkouts();
  const exercises = useExercises();
  const settings = useSettings();

  const nameById = useMemo(() => new Map(exercises.map(e => [e.id!, e.name])), [exercises]);

  // All-time PRs, sorted by strongest estimated 1RM first.
  const records = useMemo(
    () =>
      allTimePRs(workouts, settings.oneRMFormula)
        .filter(pr => nameById.has(pr.exerciseId))
        .sort((a, b) => b.best1RM - a.best1RM),
    [workouts, settings.oneRMFormula, nameById],
  );

  if (records.length === 0) {
    return (
      <div className="px-4 py-16 text-center text-muted-foreground text-sm">
        Nog geen records. Log een training om je persoonlijke records te zien.
      </div>
    );
  }

  return (
    <div className="px-4 py-3 space-y-2">
      {records.map(pr => (
        <button key={pr.exerciseId} onClick={() => onSelect(pr.exerciseId)} className="w-full text-left">
          <Card className="hover:bg-accent/40 transition-colors shadow-none">
            <CardContent className="p-3 flex items-center gap-3">
              <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{nameById.get(pr.exerciseId)}</p>
                <p className="text-xs text-muted-foreground">
                  {pr.weight} kg × {pr.reps} · {formatDate(pr.date)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold tabular-nums">~{Math.round(pr.best1RM)} kg</p>
                <p className="text-[11px] text-muted-foreground">geschat 1RM</p>
              </div>
            </CardContent>
          </Card>
        </button>
      ))}
    </div>
  );
}
