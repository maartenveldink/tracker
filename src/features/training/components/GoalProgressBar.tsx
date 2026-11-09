import { Link } from 'react-router-dom';
import { CheckCircle2, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { GoalProgress } from '../lib/goalProgress';

function formatKg(kg: number): string {
  return kg.toLocaleString('nl-NL', { maximumFractionDigits: 1 });
}

/**
 * Progress bar towards an exercise's weight × reps goal. Shows the percentage
 * and, once achieved, a green "Doel gehaald" state. `editHref` adds a link to
 * set a new goal (rendered outside any button by the caller's layout).
 */
export function GoalProgressBar({
  progress,
  exerciseName,
  editHref,
  className,
}: {
  progress: GoalProgress;
  exerciseName: string;
  /** When set, shows a "Nieuw doel" / "Doel wijzigen" link to the exercise form. */
  editHref?: string;
  className?: string;
}) {
  const { goal, estimatedWeight, percent, achieved } = progress;
  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between gap-2 text-caption">
        <span className="inline-flex items-center gap-1 text-muted-foreground min-w-0">
          {achieved ? (
            <CheckCircle2 className="h-3.5 w-3.5 text-accent shrink-0" />
          ) : (
            <Target className="h-3.5 w-3.5 shrink-0" />
          )}
          <span className="truncate">
            Doel: {formatKg(goal.weight)} kg × {goal.reps}
          </span>
        </span>
        <span
          className={cn(
            'font-semibold tabular-nums shrink-0',
            achieved ? 'text-accent' : 'text-foreground',
          )}
        >
          {percent}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`Doel ${exerciseName}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-2 w-full overflow-hidden rounded-full bg-line"
      >
        <div
          className={cn('h-full rounded-full transition-all', achieved ? 'bg-accent' : 'bg-primary')}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-2 text-caption">
        {achieved ? (
          <span className="font-medium text-accent">Doel gehaald!</span>
        ) : (
          <span className="text-muted-foreground">
            {estimatedWeight > 0
              ? `Nu ~${formatKg(estimatedWeight)} kg × ${goal.reps} (geschat)`
              : 'Nog geen gewogen sets'}
          </span>
        )}
        {editHref && (
          <Link to={editHref} className="shrink-0 font-medium text-primary hover:underline">
            {achieved ? 'Nieuw doel' : 'Doel wijzigen'}
          </Link>
        )}
      </div>
    </div>
  );
}
