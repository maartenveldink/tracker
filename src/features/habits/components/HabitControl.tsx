import { useEffect, useState } from 'react';
import { Check, Minus, Plus } from 'lucide-react';
import type { Habit } from '../../../db/index';
import { isHabitDone } from '../lib/schedule';
import { toggleHabit, stepHabitCount, setHabitLog } from '../hooks/useHabits';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

  if (habit.type === 'amount') {
    return <AmountControl habit={habit} value={value} dateKey={dateKey} done={done} />;
  }

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

/** Direct numeric entry for `amount` habits (e.g. grams of protein). */
function AmountControl({
  habit,
  value,
  dateKey,
  done,
}: {
  habit: Habit;
  value: number;
  dateKey: string;
  done: boolean;
}) {
  // Local draft so partial input (e.g. "16.") isn't clobbered by the live value.
  const [draft, setDraft] = useState(() => (value ? String(value) : ''));
  useEffect(() => {
    setDraft(value ? String(value) : '');
  }, [value, dateKey]);

  function commit(next: string) {
    setDraft(next);
    const n = Number(next);
    void setHabitLog(habit.id!, dateKey, Number.isFinite(n) ? Math.max(0, n) : 0);
  }

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <Input
        type="number"
        inputMode="decimal"
        min={0}
        value={draft}
        onChange={e => commit(e.target.value)}
        aria-label="Waarde"
        className={cn('h-8 w-16 text-right tabular-nums', done && 'border-primary text-primary')}
      />
      {(habit.target != null || habit.unit) && (
        <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
          {habit.target != null ? `/ ${habit.target}` : ''}
          {habit.unit ? ` ${habit.unit}` : ''}
        </span>
      )}
    </div>
  );
}
