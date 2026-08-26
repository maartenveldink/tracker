import { Check, Minus, Plus } from 'lucide-react';
import type { Habit } from '../../../db/index';
import { isHabitDone } from '../lib/schedule';
import { toggleHabit, stepHabitCount } from '../hooks/useHabits';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** The done/not-done control for a habit on a given day: toggle or counter. */
export function HabitControl({
  habit,
  value,
  dateKey,
}: {
  habit: Habit;
  value: number;
  dateKey: string;
}) {
  const done = isHabitDone(habit, value);

  if (habit.type === 'boolean') {
    return (
      <button
        type="button"
        onClick={() => void toggleHabit(habit.id!, dateKey)}
        aria-label={done ? 'Afvinken ongedaan maken' : 'Afvinken'}
        aria-pressed={done}
        className={cn(
          'h-9 w-9 rounded-full border flex items-center justify-center transition-colors shrink-0',
          done ? 'bg-primary border-primary text-primary-foreground' : 'border-border text-muted-foreground',
        )}
      >
        <Check className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => void stepHabitCount(habit.id!, dateKey, -1, habit.target)}
        aria-label="Minder"
      >
        <Minus className="h-4 w-4" />
      </Button>
      <span className={cn('tabular-nums text-sm w-12 text-center', done && 'text-primary font-semibold')}>
        {value}/{habit.target ?? 1}
      </span>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8"
        onClick={() => void stepHabitCount(habit.id!, dateKey, 1, habit.target)}
        aria-label="Meer"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
