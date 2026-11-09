import { useMemo } from 'react';
import { useCompletedWorkouts } from '../hooks/useProgress';
import { useExercises } from '../hooks/useExercises';
import { getMuscleGroupById } from '../db/muscles';
import {
  setsPerPrimaryMuscle,
  WEEKLY_SETS_MAX,
  WEEKLY_SETS_TARGET,
} from '../lib/progressInsights';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

/**
 * "Sets per spiergroep": completed sets per primary muscle group this week.
 * Bar runs 0-20 with a marker at 10; below 10 reads "laag" (text, not colour only).
 */
export function WeeklySetsCard() {
  const workouts = useCompletedWorkouts();
  const exercises = useExercises();

  const rows = useMemo(() => {
    const byId = new Map(exercises.map(e => [e.id, e]));
    return Array.from(setsPerPrimaryMuscle(workouts, byId).entries())
      .map(([id, sets]) => ({ id, name: getMuscleGroupById(id)?.name ?? id, sets }))
      .sort((a, b) => b.sets - a.sets);
  }, [workouts, exercises]);

  return (
    <Card data-testid="weekly-sets-card">
      <CardContent className="space-y-3">
        <div>
          <h3 className="font-display text-body-lg font-semibold">Sets per spiergroep</h3>
          <p className="text-caption text-muted">
            deze week · doel {WEEKLY_SETS_TARGET}+
          </p>
        </div>
        {rows.length === 0 ? (
          <p className="text-small text-muted">Nog geen sets deze week.</p>
        ) : (
          <ul className="space-y-3">
            {rows.map(row => {
              const low = row.sets < WEEKLY_SETS_TARGET;
              return (
                <li key={row.id}>
                  <div className="mb-1 flex items-center justify-between text-small">
                    <span>{row.name}</span>
                    <span className={cn('tabular-nums', low ? 'font-semibold text-accent' : 'text-muted')}>
                      {row.sets} {row.sets === 1 ? 'set' : 'sets'}
                      {low && ' · laag'}
                    </span>
                  </div>
                  <div className="relative">
                    <Progress
                      value={(row.sets / WEEKLY_SETS_MAX) * 100}
                      aria-label={`Sets ${row.name} deze week`}
                      tone={low ? 'accent-2' : 'accent'}
                    />
                    <span
                      aria-hidden
                      className="absolute top-0 h-2 w-0.5 bg-line-strong"
                      style={{ left: `${(WEEKLY_SETS_TARGET / WEEKLY_SETS_MAX) * 100}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
