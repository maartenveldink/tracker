import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Plus, Flame } from 'lucide-react';
import type { Habit, HabitLog } from '../../../db/index';
import { useHabits, useHabitLogs, reorderHabits } from '../hooks/useHabits';
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

  // Swap a habit with its visible neighbour, preserving the order of habits that
  // aren't shown on this day, then persist the full reindexed order.
  function moveHabit(habitId: number, dir: -1 | 1) {
    const vi = scheduled.findIndex(h => h.id === habitId);
    const neighbour = scheduled[vi + dir];
    if (!neighbour) return;
    const ids = habits.map(h => h.id!);
    const ia = ids.indexOf(habitId);
    const ib = ids.indexOf(neighbour.id!);
    [ids[ia], ids[ib]] = [ids[ib]!, ids[ia]!];
    void reorderHabits(ids);
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
          scheduled.map((habit, i) => (
            <HabitRow
              key={habit.id}
              habit={habit}
              value={valueByHabit.get(habit.id!) ?? 0}
              dateKey={selectedKey}
              logs={logs}
              canMoveUp={i > 0}
              canMoveDown={i < scheduled.length - 1}
              onMove={dir => moveHabit(habit.id!, dir)}
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
  canMoveUp,
  canMoveDown,
  onMove,
  onOpen,
}: {
  habit: Habit;
  value: number;
  dateKey: string;
  logs: HabitLog[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (dir: -1 | 1) => void;
  onOpen: () => void;
}) {
  const done = isHabitDone(habit, value);
  const streak = useMemo(
    () => habitStreak(habit, doneByDateForHabit(habit, logs)),
    [habit, logs],
  );

  return (
    <Card data-testid="habit-row" className={cn(done && 'border-primary/50')}>
      <CardContent className="p-3 flex items-center gap-2">
        {(canMoveUp || canMoveDown) && (
          <div className="flex flex-col -my-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground"
              onClick={() => onMove(-1)}
              disabled={!canMoveUp}
              aria-label="Omhoog"
            >
              <ChevronUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground"
              onClick={() => onMove(1)}
              disabled={!canMoveDown}
              aria-label="Omlaag"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        )}
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
