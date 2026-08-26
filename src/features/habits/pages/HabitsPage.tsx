import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus, Flame } from 'lucide-react';
import type { Habit, HabitLog } from '../../../db/index';
import { useHabits, useHabitLogs } from '../hooks/useHabits';
import { isScheduledOn, doneByDateForHabit, habitStreak, isHabitDone } from '../lib/schedule';
import { toISODate } from '../../../lib/dateUtils';
import { PageHeader } from '../../../components/PageHeader';
import { HabitControl } from '../components/HabitControl';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

function formatDayLabel(date: Date, todayKey: string): string {
  const key = toISODate(date);
  if (key === todayKey) return 'Vandaag';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === toISODate(yesterday)) return 'Gisteren';
  return date.toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function HabitsPage() {
  const habits = useHabits();
  const logs = useHabitLogs();
  const navigate = useNavigate();

  const [selected, setSelected] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const todayKey = toISODate(new Date());
  const selectedKey = toISODate(selected);
  const isToday = selectedKey === todayKey;

  // Fast lookup of a habit's value on the selected day.
  const valueByHabit = useMemo(() => {
    const map = new Map<number, number>();
    for (const log of logs) {
      if (log.date === selectedKey) map.set(log.habitId, log.value);
    }
    return map;
  }, [logs, selectedKey]);

  const scheduled = useMemo(
    () => habits.filter(h => isScheduledOn(h.schedule, selected)),
    [habits, selected],
  );

  function shiftDay(delta: number) {
    setSelected(prev => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + delta);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (next > today) return prev; // no future logging
      return next;
    });
  }

  return (
    <div>
      <PageHeader
        title="Habits"
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link to="/habits/new" aria-label="Nieuwe habit">
              <Plus className="h-4 w-4" /> Nieuw
            </Link>
          </Button>
        }
      />

      {/* Day navigator */}
      <div className="px-4 py-3 flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => shiftDay(-1)} aria-label="Vorige dag">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="text-sm font-medium capitalize">{formatDayLabel(selected, todayKey)}</span>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => shiftDay(1)}
          disabled={isToday}
          aria-label="Volgende dag"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="px-4 space-y-2">
        {habits.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm">
            Nog geen habits.{' '}
            <Link to="/habits/new" className="text-primary underline">
              Maak je eerste habit
            </Link>
            .
          </div>
        ) : scheduled.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground text-sm">
            Geen habits gepland voor deze dag.
          </div>
        ) : (
          scheduled.map(habit => (
            <HabitRow
              key={habit.id}
              habit={habit}
              value={valueByHabit.get(habit.id!) ?? 0}
              dateKey={selectedKey}
              logs={logs}
              onOpen={() => navigate(`/habits/${habit.id}`)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function HabitRow({
  habit,
  value,
  dateKey,
  logs,
  onOpen,
}: {
  habit: Habit;
  value: number;
  dateKey: string;
  logs: HabitLog[];
  onOpen: () => void;
}) {
  const done = isHabitDone(habit, value);
  const streak = useMemo(
    () => habitStreak(habit, doneByDateForHabit(habit, logs)),
    [habit, logs],
  );

  return (
    <Card data-testid="habit-row" className={cn(done && 'border-primary/50')}>
      <CardContent className="p-3 flex items-center gap-3">
        <button type="button" onClick={onOpen} className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            {habit.emoji && <span className="text-lg">{habit.emoji}</span>}
            <span className="font-medium text-sm truncate">{habit.name}</span>
          </div>
          {streak > 0 && (
            <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-amber-400">
              <Flame className="h-3 w-3" /> {streak}
            </span>
          )}
        </button>

        <HabitControl habit={habit} value={value} dateKey={dateKey} />
      </CardContent>
    </Card>
  );
}
